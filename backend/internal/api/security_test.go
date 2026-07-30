package api

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"pintflow/backend/internal/config"
	"pintflow/backend/internal/storage"
)

func TestSecurityHeadersAndAuth(t *testing.T) {
	cfg := &config.Config{
		WebhookSecret:      "test_webhook_secret_123",
		APIKey:             "test_admin_api_key_456",
		CORSAllowedOrigins: []string{"*"},
		MaxPayloadSizeMB:   1,
		RateLimitRPS:       100,
		RateLimitBurst:     200,
	}

	h := &Handler{
		cfg: cfg,
	}

	router := NewRouter(h)

	t.Run("Security Response Headers Present", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/health", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Header().Get("X-Content-Type-Options") != "nosniff" {
			t.Errorf("Expected X-Content-Type-Options nosniff, got %s", rec.Header().Get("X-Content-Type-Options"))
		}
		if rec.Header().Get("X-Frame-Options") != "DENY" {
			t.Errorf("Expected X-Frame-Options DENY, got %s", rec.Header().Get("X-Frame-Options"))
		}
	})

	t.Run("Protected Endpoint Requires API Key", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/jobs", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("Expected status 401 Unauthorized without API key, got %d", rec.Code)
		}
	})

	t.Run("Protected Endpoint Accepts Valid X-API-Key Header", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/jobs", nil)
		req.Header.Set("X-API-Key", "test_admin_api_key_456")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		// Code should not be 401 Unauthorized (it will be 500 or 200 depending on mock DB, but auth passed)
		if rec.Code == http.StatusUnauthorized {
			t.Errorf("Expected auth to pass with valid X-API-Key header, got status 401")
		}
	})

	t.Run("Protected Endpoint Accepts Valid Authorization Bearer Header", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/jobs", nil)
		req.Header.Set("Authorization", "Bearer test_admin_api_key_456")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code == http.StatusUnauthorized {
			t.Errorf("Expected auth to pass with valid Authorization Bearer header, got status 401")
		}
	})

	t.Run("Webhook Endpoint Rejects Invalid Secret", func(t *testing.T) {
		body := []byte(`{"secret":"invalid_secret","response_id":"r1"}`)
		req := httptest.NewRequest("POST", "/api/v1/webhook", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("Expected 401 for invalid webhook secret, got %d", rec.Code)
		}
	})
}

func TestFilenameSanitization(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"../../etc/passwd", "passwd"},
		{"../../../var/log/syslog", "syslog"},
		{"sample_document.pdf", "sample_document.pdf"},
		{"folder/subfolder/file.png", "file.png"},
		{"", "document.pdf"},
		{"   ", "document.pdf"},
	}

	for _, tt := range tests {
		got := storage.SanitizeFilename(tt.input)
		if got != tt.expected {
			t.Errorf("SanitizeFilename(%q) = %q, expected %q", tt.input, got, tt.expected)
		}
	}
}
