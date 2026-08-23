package logger

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"
	"pintflow/backend/internal/events"
)

type Logger struct {
	db          *sql.DB
	file        *os.File
	stdLog      *log.Logger
	broadcaster *events.Broadcaster
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

func (l *Logger) SetBroadcaster(b *events.Broadcaster) {
	if l != nil {
		l.broadcaster = b
	}
}

func (l *Logger) Log(jobID, level, msg string) {
	if l == nil {
		log.Printf("[PintFlow] [%s] %s %s\n", level, jobIDPrefix(jobID), msg)
		return
	}
	timestamp := time.Now()
	entry := fmt.Sprintf("[%s] [%s] %s %s\n", timestamp.Format(time.RFC3339), level, jobIDPrefix(jobID), msg)

	// Write to console
	if l.stdLog != nil {
		l.stdLog.Print(entry)
	} else {
		log.Print(entry)
	}

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

	// Broadcast SSE log event
	if l.broadcaster != nil {
		l.broadcaster.Publish(events.Event{
			Type: "log_added",
			Data: map[string]interface{}{
				"job_id":    jobID,
				"level":     level,
				"message":   msg,
				"timestamp": timestamp.Format(time.RFC3339),
			},
		})
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

// StartCleanupRoutine periodically deletes logs older than retentionDays
func (l *Logger) StartCleanupRoutine(ctx context.Context, retentionDays int) {
	if l.db == nil {
		return
	}
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()

		// Run once on startup
		l.cleanupOldLogs(retentionDays)

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				l.cleanupOldLogs(retentionDays)
			}
		}
	}()
}

func (l *Logger) cleanupOldLogs(retentionDays int) {
	cutoff := time.Now().AddDate(0, 0, -retentionDays)
	query := `DELETE FROM logs WHERE timestamp < $1`
	res, err := l.db.Exec(query, cutoff)
	if err != nil {
		l.Error(fmt.Sprintf("Failed to clean up old logs: %v", err))
		return
	}
	if rows, _ := res.RowsAffected(); rows > 0 {
		l.Info(fmt.Sprintf("Cleaned up %d old log entries", rows))
	}
}

func jobIDPrefix(jobID string) string {
	if jobID == "" {
		return ""
	}
	return fmt.Sprintf("(Job %s)", jobID)
}
