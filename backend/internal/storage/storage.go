package storage

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"mime"
	"os"
	"path/filepath"
	"time"
)

type Storage struct {
	TempDir    string
	ArchiveDir string
	LogDir     string
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

func (s *Storage) TempPath(filename string) string {
	return filepath.Join(s.TempDir, fmt.Sprintf("%d_%s", time.Now().UnixNano(), filename))
}

func (s *Storage) TempPathForJob(jobID, filename string) string {
	return filepath.Join(s.TempDir, fmt.Sprintf("%s_%s", jobID, filename))
}

func (s *Storage) ArchivePath(jobID, filename string) string {
	dateSubdir := time.Now().Format("2006-01-02")
	archiveSubdir := filepath.Join(s.ArchiveDir, dateSubdir)
	_ = os.MkdirAll(archiveSubdir, 0755)
	return filepath.Join(archiveSubdir, fmt.Sprintf("%s_%s", jobID, filename))
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
