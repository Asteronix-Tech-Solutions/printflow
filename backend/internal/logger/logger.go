package logger

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"
)

type Logger struct {
	db       *sql.DB
	file     *os.File
	stdLog   *log.Logger
}

func New(db *sql.DB, logDir string) (*Logger, error) {
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create log directory: %w", err)
	}

	logPath := filepath.Join(logDir, fmt.Sprintf("pintflow_%s.log", time.Now().Format("2006-01-02")))
	f, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return nil, fmt.Errorf("failed to open log file: %w", err)
	}

	return &Logger{
		db:     db,
		file:   f,
		stdLog: log.New(os.Stdout, "[PintFlow] ", log.LstdFlags),
	}, nil
}

func (l *Logger) Log(jobID, level, msg string) {
	timestamp := time.Now()
	entry := fmt.Sprintf("[%s] [%s] %s %s\n", timestamp.Format(time.RFC3339), level, jobIDPrefix(jobID), msg)

	// Write to console
	l.stdLog.Print(entry)

	// Write to file
	if l.file != nil {
		_, _ = l.file.WriteString(entry)
	}

	// Write to database if DB instance is available
	if l.db != nil {
		query := `INSERT INTO logs (job_id, level, message, timestamp) VALUES ($1, $2, $3, $4)`
		var nullableJobID interface{}
		if jobID != "" {
			nullableJobID = jobID
		}
		_, _ = l.db.Exec(query, nullableJobID, level, msg, timestamp)
	}
}

func (l *Logger) Info(msg string) {
	l.Log("", "INFO", msg)
}

func (l *Logger) InfoJ(jobID, msg string) {
	l.Log(jobID, "INFO", msg)
}

func (l *Logger) Error(msg string) {
	l.Log("", "ERROR", msg)
}

func (l *Logger) ErrorJ(jobID, msg string) {
	l.Log(jobID, "ERROR", msg)
}

func (l *Logger) Warn(msg string) {
	l.Log("", "WARN", msg)
}

func (l *Logger) WarnJ(jobID, msg string) {
	l.Log(jobID, "WARN", msg)
}

func (l *Logger) Close() {
	if l.file != nil {
		_ = l.file.Close()
	}
}

func jobIDPrefix(jobID string) string {
	if jobID == "" {
		return ""
	}
	return fmt.Sprintf("(Job %s)", jobID)
}
