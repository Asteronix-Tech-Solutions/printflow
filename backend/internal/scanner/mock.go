package scanner

import (
	"context"
	"fmt"
	"os"
	"time"

	"pintflow/backend/internal/models"
)

// MockScanner is a development/testing scanner that generates placeholder output
type MockScanner struct{}

// NewMockScanner creates a new mock scanner driver
func NewMockScanner() *MockScanner {
	return &MockScanner{}
}

func (m *MockScanner) Name() string {
	return "Mock Scanner (Development)"
}

// ListDevices returns a simulated device list
func (m *MockScanner) ListDevices(ctx context.Context) ([]models.ScannerDevice, error) {
	return []models.ScannerDevice{
		{
			DeviceName: "mock:scanner0",
			Vendor:     "PrintFlow",
			Model:      "Mock Scanner",
			Type:       "virtual flatbed scanner",
		},
	}, nil
}

// Scan generates a placeholder scanned document
func (m *MockScanner) Scan(ctx context.Context, opts ScanOptions) ([]byte, error) {
	// Simulate scan duration
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-time.After(2 * time.Second):
	}

	timestamp := time.Now().Format("2006-01-02 15:04:05")

	if opts.Format == "pdf" {
		// Generate a minimal valid PDF with scan metadata
		pdfContent := generateMockPDF(opts, timestamp)
		if opts.OutputPath != "" {
			if err := os.WriteFile(opts.OutputPath, pdfContent, 0644); err != nil {
				return nil, fmt.Errorf("failed to write mock scan output: %w", err)
			}
		}
		return pdfContent, nil
	}

	// For JPEG/PNG, generate a simple placeholder image
	imgContent := generateMockImage(opts, timestamp)
	if opts.OutputPath != "" {
		if err := os.WriteFile(opts.OutputPath, imgContent, 0644); err != nil {
			return nil, fmt.Errorf("failed to write mock scan output: %w", err)
		}
	}
	return imgContent, nil
}

// generateMockPDF creates a minimal valid PDF document
func generateMockPDF(opts ScanOptions, timestamp string) []byte {
	pageText := fmt.Sprintf(
		"PrintFlow Mock Scan\\nTimestamp: %s\\nResolution: %d DPI\\nColor Mode: %s\\nPaper Size: %s\\nFormat: %s",
		timestamp, opts.Resolution, opts.ColorMode, opts.PaperSize, opts.Format,
	)

	pdf := fmt.Sprintf(`%%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 200 >>
stream
BT
/F1 16 Tf
50 780 Td
(%s) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000518 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
600
%%%%EOF`, pageText)

	return []byte(pdf)
}

// generateMockImage creates a simple PPM (portable pixmap) placeholder image
func generateMockImage(opts ScanOptions, timestamp string) []byte {
	width := 200
	height := 100

	// Create a simple PPM image (P6 format - portable pixmap)
	header := fmt.Sprintf("P6\n%d %d\n255\n", width, height)
	pixels := make([]byte, width*height*3)

	// Fill with a light gray background and a darker border
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			idx := (y*width + x) * 3
			if x < 2 || x >= width-2 || y < 2 || y >= height-2 {
				// Border: dark blue
				pixels[idx] = 30
				pixels[idx+1] = 60
				pixels[idx+2] = 150
			} else {
				// Background: light gray
				pixels[idx] = 240
				pixels[idx+1] = 240
				pixels[idx+2] = 245
			}
		}
	}

	result := append([]byte(header), pixels...)
	return result
}

// GetStatus returns mock scanner status (always online)
func (m *MockScanner) GetStatus(ctx context.Context) (models.ScannerStatus, error) {
	devices, _ := m.ListDevices(ctx)
	return models.ScannerStatus{
		Name:          m.Name(),
		Type:          "Mock",
		IsOnline:      true,
		StatusMessage: "Mock scanner is ready (development mode)",
		Devices:       devices,
		CheckedAt:     time.Now(),
	}, nil
}
