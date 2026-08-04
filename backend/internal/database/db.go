package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	_ "github.com/lib/pq"
	_ "modernc.org/sqlite"

	"pintflow/backend/internal/models"
)

type DB struct {
	*sql.DB
	driverName string
	jobMu      sync.Mutex
}

func Connect(driverName, connStr string) (*DB, error) {
	if driverName == "" {
		if strings.HasPrefix(connStr, "postgres://") || strings.HasPrefix(connStr, "postgresql://") {
			driverName = "postgres"
		} else {
			driverName = "sqlite"
		}
	}

	if driverName == "sqlite" {
		// Ensure parent directory exists for local SQLite file
		dir := filepath.Dir(connStr)
		if dir != "." && dir != "" {
			_ = os.MkdirAll(dir, 0755)
		}
	}

	db, err := sql.Open(driverName, connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	database := &DB{
		DB:         db,
		driverName: driverName,
	}

	if err := database.Migrate(); err != nil {
		return nil, fmt.Errorf("failed to run database migrations: %w", err)
	}

	_ = database.ResetInterruptedJobs()

	return database, nil
}

func (db *DB) Migrate() error {
	logIDDef := "id SERIAL PRIMARY KEY"
	if db.driverName == "sqlite" {
		logIDDef = "id INTEGER PRIMARY KEY AUTOINCREMENT"
	}

	queries := []string{
		`CREATE TABLE IF NOT EXISTS jobs (
			id VARCHAR(36) PRIMARY KEY,
			status VARCHAR(32) NOT NULL DEFAULT 'pending',
			google_response_id VARCHAR(255),
			google_file_id VARCHAR(255),
			user_name VARCHAR(255),
			user_email VARCHAR(255),
			filename VARCHAR(255) NOT NULL,
			printer VARCHAR(255),
			copies INT DEFAULT 1,
			form_title TEXT,
			form_responses TEXT,
			template_id VARCHAR(128),
			error_message TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			completed_at TIMESTAMP
		);`,
		`CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);`,
		`CREATE TABLE IF NOT EXISTS documents (
			id VARCHAR(36) PRIMARY KEY,
			job_id VARCHAR(36) REFERENCES jobs(id) ON DELETE CASCADE,
			local_path VARCHAR(512) NOT NULL,
			sha256 VARCHAR(64),
			size BIGINT,
			mime_type VARCHAR(128)
		);`,
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS logs (
			%s,
			job_id VARCHAR(36),
			level VARCHAR(16) NOT NULL,
			message TEXT NOT NULL,
			timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`, logIDDef),
		`CREATE TABLE IF NOT EXISTS settings (
			key VARCHAR(128) PRIMARY KEY,
			value TEXT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS templates (
			id VARCHAR(64) PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			description TEXT,
			is_system BOOLEAN DEFAULT FALSE,
			content_html TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS scan_jobs (
			id VARCHAR(36) PRIMARY KEY,
			status VARCHAR(32) NOT NULL DEFAULT 'scan_pending',
			scanner_name VARCHAR(255),
			resolution INT DEFAULT 300,
			color_mode VARCHAR(32) DEFAULT 'Color',
			format VARCHAR(16) DEFAULT 'pdf',
			paper_size VARCHAR(16) DEFAULT 'A4',
			filename VARCHAR(255),
			file_size BIGINT DEFAULT 0,
			local_path VARCHAR(512),
			user_name VARCHAR(255),
			source VARCHAR(16) DEFAULT 'web',
			error_message TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			completed_at TIMESTAMP
		);`,
		`CREATE INDEX IF NOT EXISTS idx_scan_jobs_status ON scan_jobs(status);`,
	}

	for _, query := range queries {
		if _, err := db.Exec(query); err != nil {
			return err
		}
	}

	// Safe alter columns for existing databases
	_ = db.addColIfNotExists("jobs", "form_title", "TEXT")
	_ = db.addColIfNotExists("jobs", "form_responses", "TEXT")
	_ = db.addColIfNotExists("jobs", "template_id", "VARCHAR(128)")

	return nil
}

func (db *DB) addColIfNotExists(table, col, colType string) error {
	var query string
	if db.driverName == "sqlite" {
		query = fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", table, col, colType)
		_, err := db.Exec(query)
		return err
	}
	query = fmt.Sprintf("ALTER TABLE %s ADD COLUMN IF NOT EXISTS %s %s", table, col, colType)
	_, err := db.Exec(query)
	return err
}

func (db *DB) ResetInterruptedJobs() error {
	query := `UPDATE jobs SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE status IN ('downloading', 'downloaded', 'processing', 'printing')`
	_, err := db.Exec(query)
	return err
}

func (db *DB) CreateJob(job *models.Job) error {
	query := `INSERT INTO jobs (id, status, google_response_id, google_file_id, user_name, user_email, filename, printer, copies, form_title, form_responses, template_id, created_at, updated_at)
			  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`
	now := time.Now()
	job.CreatedAt = now
	job.UpdatedAt = now

	responsesJSON := ""
	if len(job.FormResponses) > 0 {
		if bytes, err := json.Marshal(job.FormResponses); err == nil {
			responsesJSON = string(bytes)
		}
	}

	_, err := db.Exec(query, job.ID, job.Status, job.GoogleResponseID, job.GoogleFileID, job.UserName, job.UserEmail, job.Filename, job.Printer, job.Copies, job.FormTitle, responsesJSON, job.TemplateID, job.CreatedAt, job.UpdatedAt)
	return err
}

func (db *DB) UpdateJobStatus(id, status, errMsg string) error {
	var query string
	now := time.Now()
	if status == models.StatusCompleted {
		query = `UPDATE jobs SET status = $1, error_message = $2, updated_at = $3, completed_at = $4 WHERE id = $5`
		_, err := db.Exec(query, status, errMsg, now, now, id)
		return err
	}
	query = `UPDATE jobs SET status = $1, error_message = $2, updated_at = $3 WHERE id = $4`
	_, err := db.Exec(query, status, errMsg, now, id)
	return err
}

func (db *DB) UpdateJobTemplate(id, templateID string) error {
	query := `UPDATE jobs SET template_id = $1, updated_at = $2 WHERE id = $3`
	_, err := db.Exec(query, templateID, time.Now(), id)
	return err
}

func (db *DB) GetJob(id string) (*models.Job, error) {
	query := `SELECT id, status, COALESCE(google_response_id, ''), COALESCE(google_file_id, ''), COALESCE(user_name, ''), COALESCE(user_email, ''), filename, printer, copies, COALESCE(form_title, ''), COALESCE(form_responses, ''), COALESCE(template_id, ''), COALESCE(error_message, ''), created_at, updated_at, completed_at FROM jobs WHERE id = $1`
	row := db.QueryRow(query, id)

	var job models.Job
	var completedAt sql.NullTime
	var responsesJSON string

	err := row.Scan(&job.ID, &job.Status, &job.GoogleResponseID, &job.GoogleFileID, &job.UserName, &job.UserEmail, &job.Filename, &job.Printer, &job.Copies, &job.FormTitle, &responsesJSON, &job.TemplateID, &job.ErrorMessage, &job.CreatedAt, &job.UpdatedAt, &completedAt)
	if err != nil {
		return nil, err
	}
	if completedAt.Valid {
		job.CompletedAt = &completedAt.Time
	}
	if responsesJSON != "" {
		_ = json.Unmarshal([]byte(responsesJSON), &job.FormResponses)
	}
	return &job, nil
}

func (db *DB) ListJobs(status string, limit, offset int) ([]*models.Job, error) {
	var rows *sql.Rows
	var err error

	if status != "" {
		query := `SELECT id, status, COALESCE(google_response_id, ''), COALESCE(google_file_id, ''), COALESCE(user_name, ''), COALESCE(user_email, ''), filename, printer, copies, COALESCE(form_title, ''), COALESCE(form_responses, ''), COALESCE(template_id, ''), COALESCE(error_message, ''), created_at, updated_at, completed_at FROM jobs WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
		rows, err = db.Query(query, status, limit, offset)
	} else {
		query := `SELECT id, status, COALESCE(google_response_id, ''), COALESCE(google_file_id, ''), COALESCE(user_name, ''), COALESCE(user_email, ''), filename, printer, copies, COALESCE(form_title, ''), COALESCE(form_responses, ''), COALESCE(template_id, ''), COALESCE(error_message, ''), created_at, updated_at, completed_at FROM jobs ORDER BY created_at DESC LIMIT $1 OFFSET $2`
		rows, err = db.Query(query, limit, offset)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var jobs []*models.Job
	for rows.Next() {
		var job models.Job
		var completedAt sql.NullTime
		var responsesJSON string
		if err := rows.Scan(&job.ID, &job.Status, &job.GoogleResponseID, &job.GoogleFileID, &job.UserName, &job.UserEmail, &job.Filename, &job.Printer, &job.Copies, &job.FormTitle, &responsesJSON, &job.TemplateID, &job.ErrorMessage, &job.CreatedAt, &job.UpdatedAt, &completedAt); err != nil {
			return nil, err
		}
		if completedAt.Valid {
			job.CompletedAt = &completedAt.Time
		}
		if responsesJSON != "" {
			_ = json.Unmarshal([]byte(responsesJSON), &job.FormResponses)
		}
		jobs = append(jobs, &job)
	}
	return jobs, nil
}

func (db *DB) GetNextPendingJob() (*models.Job, error) {
	db.jobMu.Lock()
	defer db.jobMu.Unlock()

	var id string
	err := db.QueryRow(`SELECT id FROM jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1`).Scan(&id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	now := time.Now()
	res, err := db.Exec(`UPDATE jobs SET status = $1, updated_at = $2 WHERE id = $3 AND status = 'pending'`, models.StatusDownloading, now, id)
	if err != nil {
		return nil, err
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return nil, nil // Job was claimed by another thread
	}

	return db.GetJob(id)
}

func (db *DB) ListTemplates() ([]*models.FormTemplate, error) {
	query := `SELECT id, name, COALESCE(description, ''), is_system, content_html, created_at, updated_at FROM templates ORDER BY is_system DESC, name ASC`
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var templates []*models.FormTemplate
	for rows.Next() {
		var t models.FormTemplate
		if err := rows.Scan(&t.ID, &t.Name, &t.Description, &t.IsSystem, &t.ContentHTML, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		templates = append(templates, &t)
	}
	return templates, nil
}

func (db *DB) GetTemplate(id string) (*models.FormTemplate, error) {
	query := `SELECT id, name, COALESCE(description, ''), is_system, content_html, created_at, updated_at FROM templates WHERE id = $1`
	row := db.QueryRow(query, id)
	var t models.FormTemplate
	err := row.Scan(&t.ID, &t.Name, &t.Description, &t.IsSystem, &t.ContentHTML, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (db *DB) SaveTemplate(tmpl *models.FormTemplate) error {
	now := time.Now()
	if tmpl.CreatedAt.IsZero() {
		tmpl.CreatedAt = now
	}
	tmpl.UpdatedAt = now

	var query string
	if db.driverName == "postgres" {
		query = `INSERT INTO templates (id, name, description, is_system, content_html, created_at, updated_at)
		         VALUES ($1, $2, $3, $4, $5, $6, $7)
		         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, content_html = EXCLUDED.content_html, updated_at = EXCLUDED.updated_at`
	} else {
		query = `INSERT OR REPLACE INTO templates (id, name, description, is_system, content_html, created_at, updated_at)
		         VALUES ($1, $2, $3, $4, $5, $6, $7)`
	}
	_, err := db.Exec(query, tmpl.ID, tmpl.Name, tmpl.Description, tmpl.IsSystem, tmpl.ContentHTML, tmpl.CreatedAt, tmpl.UpdatedAt)
	return err
}

func (db *DB) DeleteTemplate(id string) error {
	query := `DELETE FROM templates WHERE id = $1 AND is_system = FALSE`
	_, err := db.Exec(query, id)
	return err
}

func (db *DB) SaveDocument(doc *models.Document) error {
	query := `INSERT INTO documents (id, job_id, local_path, sha256, size, mime_type) VALUES ($1, $2, $3, $4, $5, $6)`
	_, err := db.Exec(query, doc.ID, doc.JobID, doc.LocalPath, doc.SHA256, doc.Size, doc.MimeType)
	return err
}

func (db *DB) GetDocument(jobID string) (*models.Document, error) {
	query := `SELECT id, job_id, local_path, sha256, size, mime_type FROM documents WHERE job_id = $1`
	row := db.QueryRow(query, jobID)
	var doc models.Document
	err := row.Scan(&doc.ID, &doc.JobID, &doc.LocalPath, &doc.SHA256, &doc.Size, &doc.MimeType)
	if err != nil {
		return nil, err
	}
	return &doc, nil
}

func (db *DB) GetJobStats() (pending, completed, failed int, err error) {
	query := `SELECT 
		COALESCE(SUM(CASE WHEN status IN ('pending', 'downloading', 'downloaded', 'processing', 'ready', 'printing') THEN 1 ELSE 0 END), 0) as pending,
		COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) as completed,
		COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) as failed
		FROM jobs`
	err = db.QueryRow(query).Scan(&pending, &completed, &failed)
	return
}

func (db *DB) ListLogs(limit int) ([]*models.Log, error) {
	query := `SELECT id, COALESCE(job_id, ''), level, message, timestamp FROM logs ORDER BY id DESC LIMIT $1`
	rows, err := db.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []*models.Log
	for rows.Next() {
		var l models.Log
		if err := rows.Scan(&l.ID, &l.JobID, &l.Level, &l.Message, &l.Timestamp); err != nil {
			return nil, err
		}
		logs = append(logs, &l)
	}
	return logs, nil
}

func (db *DB) GetSetting(key string) (string, error) {
	query := `SELECT value FROM settings WHERE key = $1`
	var val string
	err := db.QueryRow(query, key).Scan(&val)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return val, err
}

func (db *DB) SetSetting(key, value string) error {
	var query string
	if db.driverName == "postgres" {
		query = `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
	} else {
		query = `INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)`
	}
	_, err := db.Exec(query, key, value)
	return err
}

// ===== Scan Job Methods =====

func (db *DB) CreateScanJob(job *models.ScanJob) error {
	query := `INSERT INTO scan_jobs (id, status, scanner_name, resolution, color_mode, format, paper_size, filename, file_size, local_path, user_name, source, error_message, created_at, completed_at)
			  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`
	if job.CreatedAt.IsZero() {
		job.CreatedAt = time.Now()
	}
	_, err := db.Exec(query, job.ID, job.Status, job.ScannerName, job.Resolution, job.ColorMode, job.Format, job.PaperSize, job.Filename, job.FileSize, job.LocalPath, job.UserName, job.Source, job.ErrorMessage, job.CreatedAt, job.CompletedAt)
	return err
}

func (db *DB) UpdateScanJobStatus(id, status, errMsg string) error {
	query := `UPDATE scan_jobs SET status = $1, error_message = $2 WHERE id = $3`
	_, err := db.Exec(query, status, errMsg, id)
	return err
}

func (db *DB) CompleteScanJob(id, filename, localPath string, fileSize int64) error {
	now := time.Now()
	query := `UPDATE scan_jobs SET status = $1, filename = $2, local_path = $3, file_size = $4, completed_at = $5 WHERE id = $6`
	_, err := db.Exec(query, models.ScanStatusCompleted, filename, localPath, fileSize, now, id)
	return err
}

func (db *DB) GetScanJob(id string) (*models.ScanJob, error) {
	query := `SELECT id, status, COALESCE(scanner_name, ''), resolution, COALESCE(color_mode, 'Color'), COALESCE(format, 'pdf'), COALESCE(paper_size, 'A4'), COALESCE(filename, ''), file_size, COALESCE(local_path, ''), COALESCE(user_name, ''), COALESCE(source, 'web'), COALESCE(error_message, ''), created_at, completed_at FROM scan_jobs WHERE id = $1`
	row := db.QueryRow(query, id)

	var job models.ScanJob
	var completedAt sql.NullTime
	err := row.Scan(&job.ID, &job.Status, &job.ScannerName, &job.Resolution, &job.ColorMode, &job.Format, &job.PaperSize, &job.Filename, &job.FileSize, &job.LocalPath, &job.UserName, &job.Source, &job.ErrorMessage, &job.CreatedAt, &completedAt)
	if err != nil {
		return nil, err
	}
	if completedAt.Valid {
		job.CompletedAt = &completedAt.Time
	}
	return &job, nil
}

func (db *DB) ListScanJobs(limit, offset int) ([]*models.ScanJob, error) {
	query := `SELECT id, status, COALESCE(scanner_name, ''), resolution, COALESCE(color_mode, 'Color'), COALESCE(format, 'pdf'), COALESCE(paper_size, 'A4'), COALESCE(filename, ''), file_size, COALESCE(local_path, ''), COALESCE(user_name, ''), COALESCE(source, 'web'), COALESCE(error_message, ''), created_at, completed_at FROM scan_jobs ORDER BY created_at DESC LIMIT $1 OFFSET $2`
	rows, err := db.Query(query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var jobs []*models.ScanJob
	for rows.Next() {
		var job models.ScanJob
		var completedAt sql.NullTime
		if err := rows.Scan(&job.ID, &job.Status, &job.ScannerName, &job.Resolution, &job.ColorMode, &job.Format, &job.PaperSize, &job.Filename, &job.FileSize, &job.LocalPath, &job.UserName, &job.Source, &job.ErrorMessage, &job.CreatedAt, &completedAt); err != nil {
			return nil, err
		}
		if completedAt.Valid {
			job.CompletedAt = &completedAt.Time
		}
		jobs = append(jobs, &job)
	}
	return jobs, nil
}

func (db *DB) GetScanJobStats() (pending, completed, failed int, err error) {
	query := `SELECT
		COALESCE(SUM(CASE WHEN status IN ('scan_pending', 'scanning') THEN 1 ELSE 0 END), 0) as pending,
		COALESCE(SUM(CASE WHEN status = 'scan_completed' THEN 1 ELSE 0 END), 0) as completed,
		COALESCE(SUM(CASE WHEN status = 'scan_failed' THEN 1 ELSE 0 END), 0) as failed
		FROM scan_jobs`
	err = db.QueryRow(query).Scan(&pending, &completed, &failed)
	return
}
