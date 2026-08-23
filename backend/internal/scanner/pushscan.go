package scanner

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"pintflow/backend/internal/database"
	"pintflow/backend/internal/events"
	"pintflow/backend/internal/logger"
	"pintflow/backend/internal/models"
)

// PushScanWatcher monitors a directory for new files from physical scan button
type PushScanWatcher struct {
	watchDir    string
	scanDir     string
	db          *database.DB
	logger      *logger.Logger
	broadcaster *events.Broadcaster
	pollInterval time.Duration
}

// NewPushScanWatcher creates a filesystem watcher for push-scan support
func NewPushScanWatcher(watchDir, scanDir string, db *database.DB, l *logger.Logger, broadcaster *events.Broadcaster) *PushScanWatcher {
	// Ensure directories exist
	_ = os.MkdirAll(watchDir, 0755)
	_ = os.MkdirAll(scanDir, 0755)

	return &PushScanWatcher{
		watchDir:     watchDir,
		scanDir:      scanDir,
		db:           db,
		logger:       l,
		broadcaster:  broadcaster,
		pollInterval: 2 * time.Second,
	}
}

// Start begins polling the watch directory for new files
func (w *PushScanWatcher) Start(ctx context.Context) {
	w.logger.Info(fmt.Sprintf("Push-scan watcher started, monitoring directory: %s", w.watchDir))

	ticker := time.NewTicker(w.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			w.logger.Info("Push-scan watcher stopped")
			return
		case <-ticker.C:
			w.scanForNewFiles()
		}
	}
}

// scanForNewFiles checks the watch directory for new files and processes them
func (w *PushScanWatcher) scanForNewFiles() {
	entries, err := os.ReadDir(w.watchDir)
	if err != nil {
		return
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		// Skip hidden files and temp files
		if strings.HasPrefix(name, ".") || strings.HasSuffix(name, ".tmp") || strings.HasSuffix(name, ".part") {
			continue
		}

		srcPath := filepath.Join(w.watchDir, name)

		// Check file is not still being written (wait for stable size)
		info, err := entry.Info()
		if err != nil {
			continue
		}
		// Skip files modified in the last second (still being written)
		if time.Since(info.ModTime()) < 1*time.Second {
			continue
		}

		w.processInboxFile(srcPath, name, info.Size())
	}
}

// processInboxFile moves a file from inbox to scan directory and creates a scan job
func (w *PushScanWatcher) processInboxFile(srcPath, filename string, fileSize int64) {
	scanJobID := uuid.New().String()

	// Determine format from extension
	ext := strings.ToLower(filepath.Ext(filename))
	format := "pdf"
	switch ext {
	case ".jpg", ".jpeg":
		format = "jpeg"
	case ".png":
		format = "png"
	case ".tif", ".tiff":
		format = "pdf" // treat TIFF as PDF-like
	}

	// Move file to scan directory with job ID prefix
	destFilename := fmt.Sprintf("%s_%s", scanJobID[:8], filename)
	destPath := filepath.Join(w.scanDir, destFilename)

	srcFile, err := os.Open(srcPath)
	if err != nil {
		w.logger.Warn(fmt.Sprintf("Push-scan: failed to open inbox file %s: %v", filename, err))
		return
	}

	destFile, err := os.Create(destPath)
	if err != nil {
		srcFile.Close()
		w.logger.Warn(fmt.Sprintf("Push-scan: failed to create destination file %s: %v", destPath, err))
		return
	}

	// Copy file content
	if _, err := io.Copy(destFile, srcFile); err != nil {
		srcFile.Close()
		destFile.Close()
		w.logger.Warn(fmt.Sprintf("Push-scan: failed to copy file content: %v", err))
		return
	}
	
	srcFile.Close()
	destFile.Close()

	// Remove the inbox file after successful copy
	_ = os.Remove(srcPath)

	// Create scan job record
	now := time.Now()
	scanJob := &models.ScanJob{
		ID:          scanJobID,
		Status:      models.ScanStatusCompleted,
		ScannerName: "Push Scan",
		Resolution:  300,
		ColorMode:   "Color",
		Format:      format,
		PaperSize:   "A4",
		Filename:    destFilename,
		FileSize:    fileSize,
		LocalPath:   destPath,
		UserName:    "Physical Scanner",
		Source:      "push",
		CreatedAt:   now,
		CompletedAt: &now,
	}

	if err := w.db.CreateScanJob(scanJob); err != nil {
		w.logger.Warn(fmt.Sprintf("Push-scan: failed to create scan job record: %v", err))
		return
	}

	w.logger.Info(fmt.Sprintf("Push-scan: New document detected and registered — %s (%.1f KB)", filename, float64(fileSize)/1024))

	// Broadcast SSE event
	if w.broadcaster != nil {
		w.broadcaster.Publish(events.Event{
			Type: "scan_updated",
			Data: scanJob,
		})
	}
}
