package models

import "time"

// Job statuses
const (
	StatusPending     = "pending"
	StatusDownloading = "downloading"
	StatusDownloaded  = "downloaded"
	StatusProcessing  = "processing"
	StatusReady       = "ready"
	StatusPrinting    = "printing"
	StatusCompleted   = "completed"
	StatusFailed      = "failed"
	StatusCancelled   = "cancelled"
)

// FormQuestionAnswer represents a single question and answer from a Google Form
type FormQuestionAnswer struct {
	Question string `json:"question"`
	Answer   string `json:"answer"`
}

// FormTemplate represents a visual response formatting HTML template
type FormTemplate struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	IsSystem    bool      `json:"is_system"`
	ContentHTML string    `json:"content_html"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// PreviewTemplatePayload represents request data to test render a template
type PreviewTemplatePayload struct {
	TemplateHTML string               `json:"template_html"`
	TemplateID   string               `json:"template_id,omitempty"`
	FormTitle    string               `json:"form_title,omitempty"`
	UserName     string               `json:"user_name,omitempty"`
	UserEmail    string               `json:"user_email,omitempty"`
	Responses    []FormQuestionAnswer `json:"form_responses,omitempty"`
}

// Job represents a print job record
type Job struct {
	ID               string               `json:"id"`
	Status           string               `json:"status"`
	GoogleResponseID string               `json:"google_response_id,omitempty"`
	GoogleFileID     string               `json:"google_file_id,omitempty"`
	UserName         string               `json:"user_name,omitempty"`
	UserEmail        string               `json:"user_email,omitempty"`
	Filename         string               `json:"filename"`
	Printer          string               `json:"printer"`
	Copies           int                  `json:"copies"`
	FormTitle        string               `json:"form_title,omitempty"`
	FormResponses    []FormQuestionAnswer `json:"form_responses,omitempty"`
	TemplateID       string               `json:"template_id,omitempty"`
	ErrorMessage     string               `json:"error_message,omitempty"`
	CreatedAt        time.Time            `json:"created_at"`
	UpdatedAt        time.Time            `json:"updated_at"`
	CompletedAt      *time.Time           `json:"completed_at,omitempty"`
}

// Document represents file metadata attached to a job
type Document struct {
	ID        string `json:"id"`
	JobID     string `json:"job_id"`
	LocalPath string `json:"local_path"`
	SHA256    string `json:"sha256"`
	Size      int64  `json:"size"`
	MimeType  string `json:"mime_type"`
}

// Log represents a system/job log entry
type Log struct {
	ID        int       `json:"id"`
	JobID     string    `json:"job_id,omitempty"`
	Level     string    `json:"level"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
}

// Setting represents a key-value setting pair
type Setting struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// PrinterConfig represents printer settings configured via Web UI
type PrinterConfig struct {
	Name      string `json:"name"`
	Type      string `json:"type"`    // "ipp", "cups", "mock"
	Address   string `json:"address"` // IP:Port or CUPS queue
	PaperSize string `json:"paper_size"`
	Copies    int    `json:"copies"`
}

// UploadedFileEntry represents a single uploaded file in a multi-file webhook payload
type UploadedFileEntry struct {
	FileName      string `json:"file_name"`
	FileData      string `json:"file_data"`
	QuestionTitle string `json:"question_title,omitempty"`
}

// WebhookPayload represents request data received from Google Apps Script
type WebhookPayload struct {
	Secret        string               `json:"secret"`
	ResponseID    string               `json:"response_id,omitempty"`
	UserName      string               `json:"user_name,omitempty"`
	UserEmail     string               `json:"user_email,omitempty"`
	FileID        string               `json:"file_id,omitempty"`
	Filename      string               `json:"filename,omitempty"`
	FileData      string               `json:"file_data,omitempty"`       // base64 encoded file data (first/primary file)
	FilesData     []UploadedFileEntry  `json:"files_data,omitempty"`     // array of all uploaded files
	Printer       string               `json:"printer,omitempty"`
	Copies        int                  `json:"copies,omitempty"`
	FormTitle     string               `json:"form_title,omitempty"`
	FormResponses []FormQuestionAnswer `json:"form_responses,omitempty"`
	TemplateID    string               `json:"template_id,omitempty"`
}



// ManualQueuePayload represents request data when queuing a job from WebApp
type ManualQueuePayload struct {
	UserName      string               `json:"user_name"`
	UserEmail     string               `json:"user_email"`
	FileID        string               `json:"file_id,omitempty"`
	Filename      string               `json:"filename"`
	Printer       string               `json:"printer,omitempty"`
	Copies        int                  `json:"copies,omitempty"`
	FileData      string               `json:"file_data,omitempty"` // base64 encoded file data
	FormTitle     string               `json:"form_title,omitempty"`
	FormResponses []FormQuestionAnswer `json:"form_responses,omitempty"`
	TemplateID    string               `json:"template_id,omitempty"`
}

// PrinterStatus represents live printer health information
type PrinterStatus struct {
	Name          string    `json:"name"`
	Type          string    `json:"type"`
	Address       string    `json:"address"`
	IsOnline      bool      `json:"is_online"`
	StatusMessage string    `json:"status_message"`
	CheckedAt     time.Time `json:"checked_at"`
}

// Scan job statuses
const (
	ScanStatusPending   = "scan_pending"
	ScanStatusScanning  = "scanning"
	ScanStatusCompleted = "scan_completed"
	ScanStatusFailed    = "scan_failed"
)

// ScanJob represents a scan job record
type ScanJob struct {
	ID           string     `json:"id"`
	Status       string     `json:"status"`
	ScannerName  string     `json:"scanner_name"`
	Resolution   int        `json:"resolution"`
	ColorMode    string     `json:"color_mode"`
	Format       string     `json:"format"`
	PaperSize    string     `json:"paper_size"`
	Filename     string     `json:"filename"`
	FileSize     int64      `json:"file_size"`
	LocalPath    string     `json:"local_path,omitempty"`
	UserName     string     `json:"user_name,omitempty"`
	Source       string     `json:"source"` // "web" or "push"
	ErrorMessage string     `json:"error_message,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
}

// ScannerDevice represents a discovered scanner device
type ScannerDevice struct {
	DeviceName string `json:"device_name"`
	Vendor     string `json:"vendor"`
	Model      string `json:"model"`
	Type       string `json:"type"`
}

// ScannerStatus represents live scanner hardware info
type ScannerStatus struct {
	Name          string          `json:"name"`
	Type          string          `json:"type"`
	IsOnline      bool            `json:"is_online"`
	StatusMessage string          `json:"status_message"`
	Devices       []ScannerDevice `json:"devices"`
	CheckedAt     time.Time       `json:"checked_at"`
}

// ScanRequest represents incoming scan request from the dashboard
type ScanRequest struct {
	Resolution int    `json:"resolution,omitempty"`
	ColorMode  string `json:"color_mode,omitempty"`
	Format     string `json:"format,omitempty"`
	PaperSize  string `json:"paper_size,omitempty"`
	Source     string `json:"source,omitempty"` // "Flatbed" or "ADF"
	DeviceName string `json:"device_name,omitempty"`
	UserName   string `json:"user_name,omitempty"`
}

// HealthResponse represents the /health endpoint output
type HealthResponse struct {
	Status         string        `json:"status"`
	Database       string        `json:"database"`
	Printer        PrinterStatus `json:"printer"`
	Scanner        ScannerStatus `json:"scanner"`
	PendingJobs    int           `json:"pending_jobs"`
	CompletedJobs  int           `json:"completed_jobs"`
	FailedJobs     int           `json:"failed_jobs"`
	PendingScans   int           `json:"pending_scans"`
	CompletedScans int           `json:"completed_scans"`
}

