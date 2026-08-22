package storage

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"mime"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Storage struct {
	TempDir    string
	ArchiveDir string
	LogDir     string
	ScanDir    string
}

func NewStorage(tempDir, archiveDir, logDir string) (*Storage, error) {
	s := &Storage{
		TempDir:    tempDir,
		ArchiveDir: archiveDir,
		LogDir:     logDir,
	}

	for _, dir := range []string{tempDir, archiveDir, logDir} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create directory %s: %w", dir, err)
		}
	}

	return s, nil
}

// SetScanDir sets up the scan output directory
func (s *Storage) SetScanDir(scanDir string) {
	s.ScanDir = scanDir
	_ = os.MkdirAll(scanDir, 0755)
}

// ScanPathForJob returns the full path for a scan output file
func (s *Storage) ScanPathForJob(scanJobID, filename string) string {
	return filepath.Join(s.ScanDir, fmt.Sprintf("%s_%s", SanitizeFilename(scanJobID[:8]), SanitizeFilename(filename)))
}

func SanitizeFilename(filename string) string {
	clean := filepath.Base(filename)
	clean = strings.ReplaceAll(clean, "..", "")
	clean = strings.ReplaceAll(clean, "/", "_")
	clean = strings.ReplaceAll(clean, "\\", "_")
	clean = strings.TrimSpace(clean)
	if clean == "" || clean == "." {
		return "document.pdf"
	}
	return clean
}

func (s *Storage) TempPath(filename string) string {
	return filepath.Join(s.TempDir, fmt.Sprintf("%d_%s", time.Now().UnixNano(), SanitizeFilename(filename)))
}

func (s *Storage) TempPathForJob(jobID, filename string) string {
	return filepath.Join(s.TempDir, fmt.Sprintf("%s_%s", SanitizeFilename(jobID), SanitizeFilename(filename)))
}

func (s *Storage) ArchivePath(jobID, filename string) string {
	dateSubdir := time.Now().Format("2006-01-02")
	archiveSubdir := filepath.Join(s.ArchiveDir, dateSubdir)
	_ = os.MkdirAll(archiveSubdir, 0755)
	return filepath.Join(archiveSubdir, fmt.Sprintf("%s_%s", SanitizeFilename(jobID), SanitizeFilename(filename)))
}

func (s *Storage) CalculateSHA256(filePath string) (string, int64, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", 0, err
	}
	defer file.Close()

	hash := sha256.New()
	size, err := io.Copy(hash, file)
	if err != nil {
		return "", 0, err
	}

	return hex.EncodeToString(hash.Sum(nil)), size, nil
}

func (s *Storage) GetMimeType(filePath string) string {
	ext := filepath.Ext(filePath)
	mimeType := mime.TypeByExtension(ext)
	if mimeType == "" {
		return "application/octet-stream"
	}
	return mimeType
}

func (s *Storage) ArchiveFile(srcPath, jobID, filename string) (string, error) {
	destPath := s.ArchivePath(jobID, filename)

	srcFile, err := os.Open(srcPath)
	if err != nil {
		return "", fmt.Errorf("failed to open source temp file: %w", err)
	}

	destFile, err := os.Create(destPath)
	if err != nil {
		_ = srcFile.Close()
		return "", fmt.Errorf("failed to create archive destination file: %w", err)
	}

	_, err = io.Copy(destFile, srcFile)
	_ = srcFile.Close()
	_ = destFile.Close()

	if err != nil {
		return "", fmt.Errorf("failed to copy file to archive: %w", err)
	}

	// Remove temp file after successful archive copy
	_ = os.Remove(srcPath)

	return destPath, nil
}

func (s *Storage) RemoveTemp(filePath string) {
	if filePath != "" && filepath.HasPrefix(filePath, s.TempDir) {
		_ = os.Remove(filePath)
	}
}

// FindArchivedFile searches for an archived job file in ArchiveDir subdirectories
func (s *Storage) FindArchivedFile(jobID, filename string) string {
	if jobID == "" {
		return ""
	}
	cleanJobID := SanitizeFilename(jobID)
	cleanFilename := SanitizeFilename(filename)
	expectedName := fmt.Sprintf("%s_%s", cleanJobID, cleanFilename)

	// 1. Direct check in today's archive path
	todayPath := s.ArchivePath(jobID, filename)
	if _, err := os.Stat(todayPath); err == nil {
		return todayPath
	}

	// 2. Search recursively inside ArchiveDir for matching job file
	var foundPath string
	_ = filepath.Walk(s.ArchiveDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		base := info.Name()
		if base == expectedName || strings.HasPrefix(base, cleanJobID+"_") {
			foundPath = path
			return filepath.SkipAll
		}
		return nil
	})

	return foundPath
}

// RestoreFromArchive copies an archived file back to destTempPath for re-printing
func (s *Storage) RestoreFromArchive(jobID, filename, destTempPath string) (string, error) {
	archivedPath := s.FindArchivedFile(jobID, filename)
	if archivedPath == "" {
		return "", fmt.Errorf("archived file for job %s (%s) not found in archive storage", jobID, filename)
	}

	_ = os.MkdirAll(filepath.Dir(destTempPath), 0755)

	srcFile, err := os.Open(archivedPath)
	if err != nil {
		return "", fmt.Errorf("failed to open archived file: %w", err)
	}
	defer srcFile.Close()

	destFile, err := os.Create(destTempPath)
	if err != nil {
		return "", fmt.Errorf("failed to create target temp file for restore: %w", err)
	}
	defer destFile.Close()

	if _, err := io.Copy(destFile, srcFile); err != nil {
		return "", fmt.Errorf("failed to restore file content from archive: %w", err)
	}

	return destTempPath, nil
}

