package api

import (
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"pintflow/backend/internal/config"
	"pintflow/backend/internal/database"
	"pintflow/backend/internal/formatter"
	"pintflow/backend/internal/events"
	"pintflow/backend/internal/logger"
	"pintflow/backend/internal/models"
	"pintflow/backend/internal/printer"
	"pintflow/backend/internal/queue"
	"pintflow/backend/internal/storage"
)

type Handler struct {
	cfg         *config.Config
	db          *database.DB
	printer     *printer.Manager
	queue       *queue.WorkerPool
	storage     *storage.Storage
	formatter   *formatter.Formatter
	logger      *logger.Logger
	broadcaster *events.Broadcaster
}

func NewHandler(cfg *config.Config, db *database.DB, prn *printer.Manager, q *queue.WorkerPool, stg *storage.Storage, l *logger.Logger) *Handler {
	return &Handler{
		cfg:       cfg,
		db:        db,
		printer:   prn,
		queue:     q,
		storage:   stg,
		formatter: formatter.NewFormatter(),
		logger:    l,
	}
}

func (h *Handler) SetBroadcaster(b *events.Broadcaster) {
	if h != nil {
		h.broadcaster = b
	}
}

func (h *Handler) HandleSSE(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, `{"error":"streaming unsupported"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	rc := http.NewResponseController(w)
	_ = rc.SetWriteDeadline(time.Time{})

	if h.broadcaster == nil {
		http.Error(w, `{"error":"broadcaster uninitialized"}`, http.StatusInternalServerError)
		return
	}

	ch := h.broadcaster.Subscribe()
	defer h.broadcaster.Unsubscribe(ch)

	fmt.Fprintf(w, "event: connected\ndata: {\"status\":\"connected\"}\n\n")
	flusher.Flush()

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			fmt.Fprintf(w, "event: ping\ndata: {\"time\":%d}\n\n", time.Now().Unix())
			flusher.Flush()
		case ev, open := <-ch:
			if !open {
				return
			}
			dataJSON, err := json.Marshal(ev.Data)
			if err != nil {
				continue
			}
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.Type, string(dataJSON))
			flusher.Flush()
		}
	}
}

func (h *Handler) HandleWebhook(w http.ResponseWriter, r *http.Request) {
	var payload models.WebhookPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error":"invalid JSON payload"}`, http.StatusBadRequest)
		return
	}

	secret := r.Header.Get("X-Webhook-Secret")
	if secret == "" {
		secret = payload.Secret
	}

	if secret == "" || subtle.ConstantTimeCompare([]byte(secret), []byte(h.cfg.WebhookSecret)) != 1 {
		h.logger.Warn(fmt.Sprintf("Unauthorized webhook request attempt with invalid secret from IP: %s", r.RemoteAddr))
		http.Error(w, `{"error":"unauthorized secret"}`, http.StatusUnauthorized)
		return
	}

	if payload.Filename == "" && payload.FileID != "" {
		payload.Filename = fmt.Sprintf("form_document_%s.pdf", payload.FileID)
	} else if payload.Filename == "" {
		payload.Filename = "google_form_submission.pdf"
	}
	payload.Filename = storage.SanitizeFilename(payload.Filename)

	if payload.Printer == "" {
		payload.Printer = h.printer.Name()
	}
	if payload.Copies < 1 {
		payload.Copies = 1
	}

	job := &models.Job{
		ID:               uuid.New().String(),
		Status:           models.StatusPending,
		GoogleResponseID: payload.ResponseID,
		GoogleFileID:     payload.FileID,
		UserName:         payload.UserName,
		UserEmail:        payload.UserEmail,
		Filename:         payload.Filename,
		Printer:          payload.Printer,
		Copies:           payload.Copies,
		FormTitle:        payload.FormTitle,
		FormResponses:    payload.FormResponses,
		TemplateID:       payload.TemplateID,
	}

	// Handle base64 encoded file data if provided in webhook payload
	// If files_data array is present, decode ALL files as separate temp files
	if len(payload.FilesData) > 0 {
		for idx, fileEntry := range payload.FilesData {
			if fileEntry.FileData == "" {
				continue
			}
			rawBytes, err := decodeBase64Flex(fileEntry.FileData)
			if err == nil && len(rawBytes) > 0 {
				fileName := fileEntry.FileName
				if fileName == "" {
					fileName = fmt.Sprintf("upload_%d.jpg", idx+1)
				}
				tempPath := h.storage.TempPathForJob(job.ID, fmt.Sprintf("file_%d_%s", idx+1, fileName))
				if err := os.WriteFile(tempPath, rawBytes, 0644); err == nil {
					// Use first file as the primary temp file too
					if idx == 0 {
						primaryPath := h.storage.TempPathForJob(job.ID, payload.Filename)
						_ = os.WriteFile(primaryPath, rawBytes, 0644)
					}
					job.GoogleFileID = "" // clear drive ID so worker uses local files directly
				}
			}
		}
	} else if payload.FileData != "" {
		rawBytes, err := decodeBase64Flex(payload.FileData)
		if err == nil && len(rawBytes) > 0 {
			tempPath := h.storage.TempPathForJob(job.ID, payload.Filename)
			if err := os.WriteFile(tempPath, rawBytes, 0644); err == nil {
				job.GoogleFileID = "" // clear drive ID so worker uses local file directly
			}
		}
	}


	if err := h.db.CreateJob(job); err != nil {
		h.logger.Error(fmt.Sprintf("Failed to save webhook job to database: %v", err))
		http.Error(w, `{"error":"failed to create print job"}`, http.StatusInternalServerError)
		return
	}


	h.logger.Info(fmt.Sprintf("Webhook received and job created: %s for user %s", job.ID, job.UserName))
	h.queue.NotifyNewJob()
	if h.broadcaster != nil {
		h.broadcaster.Publish(events.Event{Type: "job_updated", Data: job})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Print job queued successfully",
		"job_id":  job.ID,
		"status":  job.Status,
	})
}

func (h *Handler) ListJobs(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	offset := 0
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}
	if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
		offset = o
	}

	jobs, err := h.db.ListJobs(status, limit, offset)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to list jobs: %v"}`, err), http.StatusInternalServerError)
		return
	}

	if jobs == nil {
		jobs = []*models.Job{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"jobs":  jobs,
		"count": len(jobs),
	})
}

func (h *Handler) GetJob(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	job, err := h.db.GetJob(id)
	if err != nil {
		http.Error(w, `{"error":"job not found"}`, http.StatusNotFound)
		return
	}

	doc, _ := h.db.GetDocument(id)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"job":      job,
		"document": doc,
	})
}

func (h *Handler) ManualQueueJob(w http.ResponseWriter, r *http.Request) {
	var payload models.ManualQueuePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error":"invalid JSON payload"}`, http.StatusBadRequest)
		return
	}

	if payload.Filename == "" {
		payload.Filename = "manual_print_job.pdf"
	}
	payload.Filename = storage.SanitizeFilename(payload.Filename)
	if payload.Printer == "" {
		payload.Printer = h.printer.Name()
	}
	if payload.Copies < 1 {
		payload.Copies = 1
	}

	jobID := uuid.New().String()
	job := &models.Job{
		ID:            jobID,
		Status:        models.StatusPending,
		GoogleFileID:  payload.FileID,
		UserName:      payload.UserName,
		UserEmail:     payload.UserEmail,
		Filename:      payload.Filename,
		Printer:       payload.Printer,
		Copies:        payload.Copies,
		FormTitle:     payload.FormTitle,
		FormResponses: payload.FormResponses,
		TemplateID:    payload.TemplateID,
	}

	// Handle base64 encoded file data if uploaded directly via WebApp
	if payload.FileData != "" {
		rawBytes, err := decodeBase64Flex(payload.FileData)
		if err != nil {
			h.logger.Error(fmt.Sprintf("Failed to decode base64 file data for job %s: %v", jobID, err))
			http.Error(w, fmt.Sprintf(`{"error":"invalid base64 file data: %v"}`, err), http.StatusBadRequest)
			return
		}
		tempPath := h.storage.TempPathForJob(jobID, payload.Filename)
		if err := os.WriteFile(tempPath, rawBytes, 0644); err != nil {
			h.logger.Error(fmt.Sprintf("Failed to save uploaded file for job %s: %v", jobID, err))
			http.Error(w, fmt.Sprintf(`{"error":"failed to save uploaded file: %v"}`, err), http.StatusInternalServerError)
			return
		}
		job.GoogleFileID = "" // clear drive ID since file is local
	}

	if err := h.db.CreateJob(job); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to queue manual job: %v"}`, err), http.StatusInternalServerError)
		return
	}

	h.logger.Info(fmt.Sprintf("Manual print job queued via WebApp: %s for %s", job.ID, job.UserName))
	h.queue.NotifyNewJob()
	if h.broadcaster != nil {
		h.broadcaster.Publish(events.Event{Type: "job_updated", Data: job})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Manual print job queued successfully",
		"job_id":  job.ID,
		"status":  job.Status,
	})
}

func (h *Handler) RetryJob(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	job, err := h.db.GetJob(id)
	if err != nil {
		http.Error(w, `{"error":"job not found"}`, http.StatusNotFound)
		return
	}

	if err := h.db.UpdateJobStatus(job.ID, models.StatusPending, ""); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to retry job: %v"}`, err), http.StatusInternalServerError)
		return
	}

	h.logger.InfoJ(job.ID, "Job re-queued for retry by operator")
	h.queue.NotifyNewJob()
	if h.broadcaster != nil {
		h.broadcaster.Publish(events.Event{Type: "job_updated", Data: map[string]interface{}{"id": job.ID, "status": models.StatusPending}})
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Job re-queued for retry",
		"job_id":  job.ID,
	})
}

func (h *Handler) CancelJob(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.db.UpdateJobStatus(id, models.StatusCancelled, "Cancelled by user"); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to cancel job: %v"}`, err), http.StatusInternalServerError)
		return
	}

	h.logger.InfoJ(id, "Job cancelled by operator")
	if h.broadcaster != nil {
		h.broadcaster.Publish(events.Event{Type: "job_updated", Data: map[string]interface{}{"id": id, "status": models.StatusCancelled, "error_message": "Cancelled by user"}})
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Job cancelled successfully",
		"job_id":  id,
	})
}

func (h *Handler) GetPrinterStatus(w http.ResponseWriter, r *http.Request) {
	status, err := h.printer.GetStatus(r.Context())
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to get printer status: %v"}`, err), http.StatusInternalServerError)
		return
	}

	config := h.printer.GetConfig()

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status": status,
		"config": config,
	})
}

func (h *Handler) UpdatePrinterConfig(w http.ResponseWriter, r *http.Request) {
	var cfg models.PrinterConfig
	if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
		http.Error(w, `{"error":"invalid JSON payload"}`, http.StatusBadRequest)
		return
	}

	status := h.printer.UpdateConfig(cfg)
	h.logger.Info(fmt.Sprintf("Printer configuration updated live via Web UI: %s (%s at %s)", cfg.Name, cfg.Type, cfg.Address))

	// Persist to DB settings
	_ = h.db.SetSetting("printer_name", cfg.Name)
	_ = h.db.SetSetting("printer_type", cfg.Type)
	_ = h.db.SetSetting("printer_address", cfg.Address)
	_ = h.db.SetSetting("paper_size", cfg.PaperSize)

	if h.broadcaster != nil {
		h.broadcaster.Publish(events.Event{Type: "health_updated", Data: status})
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Printer connection configuration updated successfully",
		"status":  status,
		"config":  h.printer.GetConfig(),
	})
}

func (h *Handler) ListLogs(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	limit := 100
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}

	logs, err := h.db.ListLogs(limit)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to fetch logs: %v"}`, err), http.StatusInternalServerError)
		return
	}

	if logs == nil {
		logs = []*models.Log{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"logs":  logs,
		"count": len(logs),
	})
}

func (h *Handler) GetHealth(w http.ResponseWriter, r *http.Request) {
	var pStatus models.PrinterStatus
	if h.printer != nil {
		pStatus, _ = h.printer.GetStatus(r.Context())
	}
	var pending, completed, failed int
	if h.db != nil {
		pending, completed, failed, _ = h.db.GetJobStats()
	}

	resp := models.HealthResponse{
		Status:        "healthy",
		Database:      "connected",
		Printer:       pStatus,
		PendingJobs:   pending,
		CompletedJobs: completed,
		FailedJobs:    failed,
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func cleanBase64(input string) string {
	if idx := strings.Index(input, ","); idx != -1 {
		return input[idx+1:]
	}
	return input
}

func decodeBase64Flex(input string) ([]byte, error) {
	cleaned := cleanBase64(input)
	cleaned = strings.ReplaceAll(cleaned, "\r", "")
	cleaned = strings.ReplaceAll(cleaned, "\n", "")
	cleaned = strings.ReplaceAll(cleaned, " ", "+")

	// Try standard encoding
	if b, err := base64.StdEncoding.DecodeString(cleaned); err == nil && len(b) > 0 {
		return b, nil
	}
	// Try URL encoding
	if b, err := base64.URLEncoding.DecodeString(cleaned); err == nil && len(b) > 0 {
		return b, nil
	}
	// Try raw standard encoding
	if b, err := base64.RawStdEncoding.DecodeString(cleaned); err == nil && len(b) > 0 {
		return b, nil
	}
	// Try raw URL encoding
	return base64.RawURLEncoding.DecodeString(cleaned)
}

func (h *Handler) ListTemplates(w http.ResponseWriter, r *http.Request) {
	sysTemplates := h.formatter.GetSystemTemplates()
	dbTemplates, _ := h.db.ListTemplates()

	all := make([]*models.FormTemplate, 0, len(sysTemplates)+len(dbTemplates))
	all = append(all, sysTemplates...)
	all = append(all, dbTemplates...)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"templates": all,
		"count":     len(all),
	})
}

func (h *Handler) GetTemplate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	for _, tmpl := range h.formatter.GetSystemTemplates() {
		if tmpl.ID == id {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(tmpl)
			return
		}
	}

	tmpl, err := h.db.GetTemplate(id)
	if err != nil {
		http.Error(w, `{"error":"template not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(tmpl)
}

func (h *Handler) SaveTemplate(w http.ResponseWriter, r *http.Request) {
	var tmpl models.FormTemplate
	if err := json.NewDecoder(r.Body).Decode(&tmpl); err != nil {
		http.Error(w, `{"error":"invalid JSON payload"}`, http.StatusBadRequest)
		return
	}

	if tmpl.ID == "" {
		tmpl.ID = fmt.Sprintf("tmpl_%d", time.Now().UnixNano())
	}
	tmpl.IsSystem = false

	if err := h.db.SaveTemplate(&tmpl); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to save template: %v"}`, err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"message":  "Template saved successfully",
		"template": tmpl,
	})
}

func (h *Handler) DeleteTemplate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.db.DeleteTemplate(id); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to delete template: %v"}`, err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Template deleted successfully",
	})
}

func (h *Handler) PreviewTemplate(w http.ResponseWriter, r *http.Request) {
	var payload models.PreviewTemplatePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error":"invalid JSON payload"}`, http.StatusBadRequest)
		return
	}

	dummyJob := &models.Job{
		ID:            "preview_sample_001",
		FormTitle:     payload.FormTitle,
		UserName:      payload.UserName,
		UserEmail:     payload.UserEmail,
		FormResponses: payload.Responses,
		CreatedAt:     time.Now(),
	}

	if dummyJob.FormTitle == "" {
		dummyJob.FormTitle = "Hotel / Property Guest Registration Form"
	}
	if dummyJob.UserName == "" {
		dummyJob.UserName = "John Doe"
	}
	if dummyJob.UserEmail == "" {
		dummyJob.UserEmail = "john.doe@example.com"
	}
	if len(dummyJob.FormResponses) == 0 {
		dummyJob.FormResponses = []models.FormQuestionAnswer{
			{Question: "Which Property Have you Booked?", Answer: "Villa Sunrise - Beachfront Resort"},
			{Question: "Phone", Answer: "+1 (555) 234-5678"},
			{Question: "Check-in Date", Answer: "2026-08-01"},
			{Question: "Check-out Date", Answer: "2026-08-07"},
			{Question: "Purpose of Visit", Answer: "Vacation / Leisure"},
			{Question: "My/Our Martial Status is", Answer: "Married"},
			{Question: "Guest Selection", Answer: "2 Guests"},
			{Question: "Name of Guest 1", Answer: "John Doe"},
			{Question: "Ages", Answer: "34"},
			{Question: "Guest 1 Gender", Answer: "Male"},
			{Question: "Name of Guest 2", Answer: "Jane Doe"},
			{Question: "Guest 2 Gender", Answer: "Female"},
			{Question: "Upload photos ID for all Guests (Aadhar Card or Passport)", Answer: "Aadhar_Card_Verified.pdf"},
			{Question: "Statement Of Responsibility", Answer: "Accepted and Verified"},
		}
	}

	renderedHTML, err := h.formatter.RenderFormHTML(dummyJob, payload.TemplateID, payload.TemplateHTML)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to render preview: %v"}`, err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"html": renderedHTML,
	})
}

func (h *Handler) ReformatJob(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	job, err := h.db.GetJob(id)
	if err != nil {
		http.Error(w, `{"error":"job not found"}`, http.StatusNotFound)
		return
	}

	var req struct {
		TemplateID string `json:"template_id"`
		RePrint    bool   `json:"reprint"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	if req.TemplateID != "" {
		_ = h.db.UpdateJobTemplate(job.ID, req.TemplateID)
		job.TemplateID = req.TemplateID
	}

	// Regenerate form summary HTML & PDF files
	formSummaryHTMLPath := h.storage.TempPathForJob(job.ID, "form_summary.html")
	formSummaryPDFPath := h.storage.TempPathForJob(job.ID, "form_summary.pdf")

	_ = h.formatter.GenerateFormSummaryDocument(job, formSummaryHTMLPath)

	if err := h.formatter.GenerateFormSummaryPDF(job, formSummaryPDFPath); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to regenerate form PDF: %v"}`, err), http.StatusInternalServerError)
		return
	}

	if req.RePrint {
		_ = h.printer.Print(r.Context(), formSummaryPDFPath, job.Copies)
		h.logger.InfoJ(job.ID, fmt.Sprintf("Form response PDF re-printed with template '%s'", job.TemplateID))
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Job summary reformatted and PDF generated successfully",
		"job_id":  job.ID,
	})
}

func (h *Handler) GetJobPDF(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	job, err := h.db.GetJob(id)
	if err != nil {
		http.Error(w, `{"error":"job not found"}`, http.StatusNotFound)
		return
	}

	pdfBytes, err := h.formatter.GeneratePDFBytes(job, job.TemplateID)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to generate job PDF: %v"}`, err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=\"form_summary_%s.pdf\"", id))
	w.Header().Set("Content-Length", strconv.Itoa(len(pdfBytes)))
	_, _ = w.Write(pdfBytes)
}

func (h *Handler) PreviewTemplatePDF(w http.ResponseWriter, r *http.Request) {
	var payload models.PreviewTemplatePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error":"invalid JSON payload"}`, http.StatusBadRequest)
		return
	}

	dummyJob := &models.Job{
		ID:            "preview_sample_001",
		FormTitle:     payload.FormTitle,
		UserName:      payload.UserName,
		UserEmail:     payload.UserEmail,
		FormResponses: payload.Responses,
		CreatedAt:     time.Now(),
	}

	if dummyJob.FormTitle == "" {
		dummyJob.FormTitle = "Hotel / Property Guest Registration Form"
	}
	if dummyJob.UserName == "" {
		dummyJob.UserName = "John Doe"
	}
	if dummyJob.UserEmail == "" {
		dummyJob.UserEmail = "john.doe@example.com"
	}
	if len(dummyJob.FormResponses) == 0 {
		dummyJob.FormResponses = []models.FormQuestionAnswer{
			{Question: "Which Property Have you Booked?", Answer: "Villa Sunrise - Beachfront Resort"},
			{Question: "Phone", Answer: "+1 (555) 234-5678"},
			{Question: "Check-in Date", Answer: "2026-08-01"},
			{Question: "Check-out Date", Answer: "2026-08-07"},
			{Question: "Purpose of Visit", Answer: "Vacation / Leisure"},
			{Question: "My/Our Martial Status is", Answer: "Married"},
			{Question: "Guest Selection", Answer: "2 Guests"},
			{Question: "Name of Guest 1", Answer: "John Doe"},
			{Question: "Ages", Answer: "34"},
			{Question: "Guest 1 Gender", Answer: "Male"},
			{Question: "Name of Guest 2", Answer: "Jane Doe"},
			{Question: "Guest 2 Gender", Answer: "Female"},
			{Question: "Upload photos ID for all Guests (Aadhar Card or Passport)", Answer: "Aadhar_Card_Verified.pdf"},
			{Question: "Statement Of Responsibility", Answer: "Accepted and Verified"},
		}
	}

	pdfBytes, err := h.formatter.GeneratePDFBytes(dummyJob, payload.TemplateID)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to generate PDF preview: %v"}`, err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "inline; filename=\"preview.pdf\"")
	w.Header().Set("Content-Length", strconv.Itoa(len(pdfBytes)))
	_, _ = w.Write(pdfBytes)
}

