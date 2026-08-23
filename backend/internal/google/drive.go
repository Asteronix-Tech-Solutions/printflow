package google

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

type DriveClient struct {
	service *drive.Service
	apiKey  string
}

func NewDriveClient(ctx context.Context, credsFile, apiKey string) (*DriveClient, error) {
	client := &DriveClient{apiKey: apiKey}

	if credsFile != "" {
		if _, err := os.Stat(credsFile); err == nil {
			srv, err := drive.NewService(ctx, option.WithCredentialsFile(credsFile), option.WithScopes(drive.DriveReadonlyScope))
			if err == nil {
				client.service = srv
				return client, nil
			}
		}
	}

	if apiKey != "" {
		srv, err := drive.NewService(ctx, option.WithAPIKey(apiKey))
		if err == nil {
			client.service = srv
			return client, nil
		}
	}

	// Service without authentication for public links or mock fallback
	srv, _ := drive.NewService(ctx, option.WithoutAuthentication())
	client.service = srv

	return client, nil
}

func (d *DriveClient) DownloadFile(ctx context.Context, fileID, destPath string) error {
	if fileID == "" {
		return fmt.Errorf("empty file_id provided")
	}

	// Ensure destination directory exists
	if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
		return fmt.Errorf("failed to create destination directory: %w", err)
	}

	// Clean fileID if a full URL was provided
	cleanedID := extractFileID(fileID)

	// Try download via official Google Drive API v3 if service client available
	if d.service != nil {
		res, err := d.service.Files.Get(cleanedID).Context(ctx).Download()
		if err == nil && res.StatusCode == http.StatusOK {
			defer res.Body.Close()
			return saveStream(res.Body, destPath)
		}
	}

	// Fallback download via HTTP drive endpoint
	return d.downloadViaHTTP(cleanedID, destPath)
}

func (d *DriveClient) downloadViaHTTP(fileID, destPath string) error {
	downloadURL := fmt.Sprintf("https://drive.google.com/uc?export=download&id=%s", fileID)
	req, err := http.NewRequest("GET", downloadURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create HTTP download request: %w", err)
	}
	req.Header.Set("User-Agent", "PintFlow/1.0")

	client := &http.Client{Timeout: 2 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to execute HTTP download: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// Fallback to direct API key download URL if key exists
		if d.apiKey != "" {
			apiKeyURL := fmt.Sprintf("https://www.googleapis.com/drive/v3/files/%s?alt=media&key=%s", fileID, d.apiKey)
			resAPI, err := http.Get(apiKeyURL)
			if err == nil && resAPI.StatusCode == http.StatusOK {
				defer resAPI.Body.Close()
				return saveStream(resAPI.Body, destPath)
			}
		}
		return fmt.Errorf("download failed with HTTP status: %s", resp.Status)
	}

	return saveStream(resp.Body, destPath)
}

func saveStream(src io.Reader, destPath string) error {
	out, err := os.Create(destPath)
	if err != nil {
		return fmt.Errorf("failed to create local file %s: %w", destPath, err)
	}
	defer out.Close()

	_, err = io.Copy(out, src)
	if err != nil {
		return fmt.Errorf("failed to save stream to file: %w", err)
	}
	return nil
}

func extractFileID(input string) string {
	input = strings.TrimSpace(input)
	if strings.Contains(input, "/d/") {
		parts := strings.Split(input, "/d/")
		if len(parts) > 1 {
			subParts := strings.Split(parts[1], "/")
			return subParts[0]
		}
	}
	if strings.Contains(input, "id=") {
		parts := strings.Split(input, "id=")
		if len(parts) > 1 {
			subParts := strings.Split(parts[1], "&")
			return subParts[0]
		}
	}
	return input
}
