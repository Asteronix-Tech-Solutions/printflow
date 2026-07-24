package storage

import (
	"os"
	"path/filepath"
	"testing"
)

func TestStorageManager(t *testing.T) {
	tempDir := t.TempDir()
	archiveDir := t.TempDir()
	logDir := t.TempDir()

	stg, err := NewStorage(tempDir, archiveDir, logDir)
	if err != nil {
		t.Fatalf("Failed to initialize storage: %v", err)
	}

	// Create test temp file
	testFile := filepath.Join(tempDir, "test_doc.txt")
	content := []byte("Hello PintFlow Automatic Google Form Printer!")
	if err := os.WriteFile(testFile, content, 0644); err != nil {
		t.Fatalf("Failed to write test file: %v", err)
	}

	// Test SHA256 hashing
	hash, size, err := stg.CalculateSHA256(testFile)
	if err != nil {
		t.Fatalf("Failed to calculate SHA256: %v", err)
	}

	if size != int64(len(content)) {
		t.Errorf("Expected size %d, got %d", len(content), size)
	}

	if hash == "" {
		t.Errorf("Expected valid SHA256 hash string, got empty")
	}

	// Test Archive File
	archivePath, err := stg.ArchiveFile(testFile, "job_123", "test_doc.txt")
	if err != nil {
		t.Fatalf("Failed to archive file: %v", err)
	}

	if _, err := os.Stat(archivePath); os.IsNotExist(err) {
		t.Errorf("Expected archived file to exist at %s", archivePath)
	}

	// Original temp file should be removed
	if _, err := os.Stat(testFile); !os.IsNotExist(err) {
		t.Errorf("Expected temp file to be removed after archiving")
	}
}
