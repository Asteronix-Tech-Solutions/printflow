package queue

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"


	"github.com/google/uuid"
	"pintflow/backend/internal/database"
	"pintflow/backend/internal/events"
	"pintflow/backend/internal/formatter"
	"pintflow/backend/internal/google"
	"pintflow/backend/internal/logger"
	"pintflow/backend/internal/models"
	"pintflow/backend/internal/printer"
	"pintflow/backend/internal/storage"
)

type WorkerPool struct {
	db          *database.DB
	driveClient *google.DriveClient
	printer     *printer.Manager
	storage     *storage.Storage
	formatter   *formatter.Formatter
	logger      *logger.Logger
	broadcaster *events.Broadcaster
	concurrency int
	notifyChan  chan struct{}
	ctx         context.Context
	cancel      context.CancelFunc
	wg          sync.WaitGroup
}

func NewWorkerPool(db *database.DB, driveClient *google.DriveClient, prn *printer.Manager, stg *storage.Storage, l *logger.Logger, concurrency int) *WorkerPool {
	if concurrency < 1 {
		concurrency = 1
	}
	ctx, cancel := context.WithCancel(context.Background())
	return &WorkerPool{
		db:          db,
		driveClient: driveClient,
		printer:     prn,
		storage:     stg,
		formatter:   formatter.NewFormatter(),
		logger:      l,
		concurrency: concurrency,
		notifyChan:  make(chan struct{}, 100),
		ctx:         ctx,
		cancel:      cancel,
	}
}

func (wp *WorkerPool) SetBroadcaster(b *events.Broadcaster) {
	if wp != nil {
		wp.broadcaster = b
	}
}

func (wp *WorkerPool) updateJobStatus(jobID, status, errMsg string) error {
	err := wp.db.UpdateJobStatus(jobID, status, errMsg)
	if wp.broadcaster != nil {
		wp.broadcaster.Publish(events.Event{
			Type: "job_updated",
			Data: map[string]interface{}{
				"id":            jobID,
				"status":        status,
				"error_message": errMsg,
			},
		})
	}
	return err
}

func (wp *WorkerPool) Start() {
	wp.logger.Info(fmt.Sprintf("Starting worker pool with %d worker threads", wp.concurrency))
	for i := 0; i < wp.concurrency; i++ {
		wp.wg.Add(1)
		go wp.workerLoop(i + 1)
	}
}

func (wp *WorkerPool) NotifyNewJob() {
	select {
	case wp.notifyChan <- struct{}{}:
	default:
	}
}

func (wp *WorkerPool) Stop() {
	wp.cancel()
	wp.wg.Wait()
	wp.logger.Info("Worker pool shut down gracefully")
}

func (wp *WorkerPool) workerLoop(workerID int) {
	defer wp.wg.Done()
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-wp.ctx.Done():
			return
		case <-wp.notifyChan:
			wp.processAvailableJobs()
		case <-ticker.C:
			wp.processAvailableJobs()
		}
	}
}

func (wp *WorkerPool) processAvailableJobs() {
	for {
		select {
		case <-wp.ctx.Done():
			return
		default:
		}

		job, err := wp.db.GetNextPendingJob()
		if err != nil || job == nil {
			break // No pending jobs available right now
		}

		wp.processJob(job)
	}
}

func (wp *WorkerPool) processJob(job *models.Job) {
	wp.logger.InfoJ(job.ID, fmt.Sprintf("Processing job for file '%s' (User: %s)", job.Filename, job.UserName))

	// Step 1: Form Formatting (Generate Form Response Summary PDF document if form responses are present)
	if len(job.FormResponses) > 0 || job.FormTitle != "" {
		wp.logger.InfoJ(job.ID, "Formatting Google Form response summary PDF document...")
		formSummaryPDFPath := wp.storage.TempPathForJob(job.ID, "form_summary.pdf")
		formSummaryHTMLPath := wp.storage.TempPathForJob(job.ID, "form_summary.html")

		_ = wp.formatter.GenerateFormSummaryDocument(job, formSummaryHTMLPath)

		if err := wp.formatter.GenerateFormSummaryPDF(job, formSummaryPDFPath); err != nil {
			wp.logger.WarnJ(job.ID, fmt.Sprintf("Failed to generate form response summary PDF document: %v", err))
		} else {
			wp.logger.InfoJ(job.ID, fmt.Sprintf("Sending generated Form PDF document to printer '%s' (Copies: %d)...", wp.printer.Name(), job.Copies))
			if err := wp.printer.Print(wp.ctx, formSummaryPDFPath, job.Copies); err != nil {
				errMsg := fmt.Sprintf("Form PDF print failed: %v", err)
				wp.logger.ErrorJ(job.ID, errMsg)
				_ = wp.updateJobStatus(job.ID, models.StatusFailed, errMsg)
				return
			} else {
				wp.logger.InfoJ(job.ID, "Successfully printed Form PDF document!")
			}
			_, _ = wp.storage.ArchiveFile(formSummaryPDFPath, job.ID, "form_summary.pdf")
		}
	}

	// Step 2: Downloading / Restoring Attached Document
	_ = wp.updateJobStatus(job.ID, models.StatusDownloading, "")
	localTempPath := wp.storage.TempPathForJob(job.ID, job.Filename)

	if job.GoogleFileID != "" {
		wp.logger.InfoJ(job.ID, fmt.Sprintf("Downloading Google Drive File ID: %s", job.GoogleFileID))
		if err := wp.driveClient.DownloadFile(wp.ctx, job.GoogleFileID, localTempPath); err != nil {
			// If Drive download fails, check if we can restore from local archive (e.g. reprint)
			if restoredPath, errRest := wp.storage.RestoreFromArchive(job.ID, job.Filename, localTempPath); errRest == nil {
				wp.logger.InfoJ(job.ID, fmt.Sprintf("Drive download skipped/failed; restored document from local archive: %s", restoredPath))
			} else {
				errMsg := fmt.Sprintf("Failed to download file from Google Drive: %v", err)
				wp.logger.ErrorJ(job.ID, errMsg)
				_ = wp.updateJobStatus(job.ID, models.StatusFailed, errMsg)
				return
			}
		}
	} else if _, err := os.Stat(localTempPath); os.IsNotExist(err) {
		// Attempt to restore file from archive if missing from temp (reprint scenario)
		if restoredPath, errRest := wp.storage.RestoreFromArchive(job.ID, job.Filename, localTempPath); errRest == nil {
			wp.logger.InfoJ(job.ID, fmt.Sprintf("Restored job document from archive storage for re-printing: %s", restoredPath))
		} else if len(job.FormResponses) > 0 || job.FormTitle != "" {
			_ = wp.updateJobStatus(job.ID, models.StatusCompleted, "")
			wp.logger.InfoJ(job.ID, "Job completed successfully (Form summary document printed!)")
			return
		} else {
			errMsg := "Print job failed: No printable document file found on server"
			wp.logger.ErrorJ(job.ID, errMsg)
			_ = wp.updateJobStatus(job.ID, models.StatusFailed, errMsg)
			return
		}
	}


	// Step 3: Processing & Metadata
	_ = wp.updateJobStatus(job.ID, models.StatusProcessing, "")
	hash, size, err := wp.storage.CalculateSHA256(localTempPath)
	if err != nil {
		errMsg := fmt.Sprintf("Failed to calculate document checksum: %v", err)
		wp.logger.ErrorJ(job.ID, errMsg)
		_ = wp.updateJobStatus(job.ID, models.StatusFailed, errMsg)
		wp.storage.RemoveTemp(localTempPath)
		return
	}

	mimeType := wp.storage.GetMimeType(localTempPath)
	doc := &models.Document{
		ID:        uuid.New().String(),
		JobID:     job.ID,
		LocalPath: localTempPath,
		SHA256:    hash,
		Size:      size,
		MimeType:  mimeType,
	}
	_ = wp.db.SaveDocument(doc)

	// Step 4: Printing Document Attachment
	// Safety Check: Verify file is not HTML web preview/sign-in page
	if isHTMLContent(localTempPath) {
		wp.logger.WarnJ(job.ID, fmt.Sprintf("Skipping document print for '%s': File content is an HTML web page (Google Drive sign-in/preview page), not a printable document/image/PDF.", job.Filename))
		_ = wp.updateJobStatus(job.ID, models.StatusCompleted, "")
		wp.storage.RemoveTemp(localTempPath)
		return
	}

	_ = wp.updateJobStatus(job.ID, models.StatusPrinting, "")
	wp.logger.InfoJ(job.ID, fmt.Sprintf("Sending document to printer '%s' (Copies: %d)...", wp.printer.Name(), job.Copies))

	if err := wp.printer.Print(wp.ctx, localTempPath, job.Copies); err != nil {
		errMsg := fmt.Sprintf("Print job failed: %v", err)
		wp.logger.ErrorJ(job.ID, errMsg)
		_ = wp.updateJobStatus(job.ID, models.StatusFailed, errMsg)
		wp.storage.RemoveTemp(localTempPath)
		return
	}


	// Step 5: Archive & Complete
	archivePath, err := wp.storage.ArchiveFile(localTempPath, job.ID, filepath.Base(job.Filename))
	if err != nil {
		wp.logger.WarnJ(job.ID, fmt.Sprintf("Failed to archive file: %v", err))
	} else {
		wp.logger.InfoJ(job.ID, fmt.Sprintf("File archived successfully at %s", archivePath))
	}

	_ = wp.updateJobStatus(job.ID, models.StatusCompleted, "")
	wp.logger.InfoJ(job.ID, "Job completed successfully!")
}

func isHTMLContent(filePath string) bool {
	data, err := os.ReadFile(filePath)
	if err != nil || len(data) == 0 {
		return false
	}
	maxLen := 512
	if len(data) < maxLen {
		maxLen = len(data)
	}
	header := strings.ToLower(string(data[:maxLen]))
	return strings.Contains(header, "<!doctype html") ||
		strings.Contains(header, "<html") ||
		strings.Contains(header, "google-analytics") ||
		strings.Contains(header, "vfppkd-") ||
		strings.Contains(header, "accounts.google.com")
}

