package scanner

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"pintflow/backend/internal/models"
)

// SANEScanner implements Scanner using the scanimage CLI (printer-agnostic)
type SANEScanner struct {
	deviceName string // optional: specific SANE device name
}

// NewSANEScanner creates a new SANE-based scanner driver
func NewSANEScanner(deviceName string) *SANEScanner {
	return &SANEScanner{
		deviceName: deviceName,
	}
}

func (s *SANEScanner) Name() string {
	if s.deviceName != "" {
		return s.deviceName
	}
	return "SANE Auto-Detect"
}

// ListDevices discovers all connected scanners via `scanimage -L`
func (s *SANEScanner) ListDevices(ctx context.Context) ([]models.ScannerDevice, error) {
	cmd := exec.CommandContext(ctx, "scanimage", "-L")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("scanimage -L failed: %w (output: %s)", err, string(output))
	}

	var devices []models.ScannerDevice
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "device") {
			continue
		}
		// Format: device `brother4:net1;dev0' is a Brother DCP-T430W flatbed scanner
		dev := parseDeviceLine(line)
		if dev.DeviceName != "" {
			devices = append(devices, dev)
		}
	}

	return devices, nil
}

// parseDeviceLine parses a single line from scanimage -L output
func parseDeviceLine(line string) models.ScannerDevice {
	dev := models.ScannerDevice{}

	// Extract device name between backticks
	startTick := strings.Index(line, "`")
	endTick := strings.Index(line, "'")
	if startTick >= 0 && endTick > startTick {
		dev.DeviceName = line[startTick+1 : endTick]
	}

	// Extract description after "is a "
	isAIdx := strings.Index(line, "is a ")
	if isAIdx >= 0 {
		desc := strings.TrimSpace(line[isAIdx+5:])
		parts := strings.Fields(desc)
		if len(parts) >= 2 {
			dev.Vendor = parts[0]
			dev.Model = parts[1]
			if len(parts) >= 3 {
				dev.Type = strings.Join(parts[2:], " ")
			}
		} else if len(parts) == 1 {
			dev.Vendor = parts[0]
			dev.Model = parts[0]
		}
	}

	return dev
}

// resolveDevice determines which device to use for scanning
func (s *SANEScanner) resolveDevice(ctx context.Context, requestedDevice string) string {
	if requestedDevice != "" {
		return requestedDevice
	}
	if s.deviceName != "" {
		return s.deviceName
	}

	// Auto-detect first available device
	devices, err := s.ListDevices(ctx)
	if err == nil && len(devices) > 0 {
		return devices[0].DeviceName
	}
	return ""
}

// Scan performs a scan using scanimage CLI
func (s *SANEScanner) Scan(ctx context.Context, opts ScanOptions) ([]byte, error) {
	device := s.resolveDevice(ctx, opts.DeviceName)

	// Determine scanimage output format
	scanFormat := opts.Format
	needsPDFConversion := false
	if scanFormat == "pdf" {
		scanFormat = "png" // scan as PNG, convert to PDF afterwards
		needsPDFConversion = true
	}

	// Build scanimage command
	args := []string{}
	if device != "" {
		args = append(args, "--device-name="+device)
	}
	args = append(args, fmt.Sprintf("--resolution=%d", opts.Resolution))

	// Map color mode to SANE mode names
	mode := "Color"
	switch strings.ToLower(opts.ColorMode) {
	case "gray", "grayscale", "grey":
		mode = "Gray"
	case "lineart", "bw", "blackwhite", "black_white":
		mode = "Lineart"
	}
	args = append(args, "--mode="+mode)
	args = append(args, "--format="+scanFormat)

	if opts.OutputPath != "" && !needsPDFConversion {
		args = append(args, "-o", opts.OutputPath)
	}

	cmd := exec.CommandContext(ctx, "scanimage", args...)
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("scanimage failed: %w (stderr: %s)", err, stderr.String())
	}

	scannedBytes := stdout.Bytes()

	// Convert to PDF if requested
	if needsPDFConversion {
		pdfBytes, err := convertToPDF(ctx, scannedBytes, opts.OutputPath)
		if err != nil {
			return nil, fmt.Errorf("PDF conversion failed: %w", err)
		}
		return pdfBytes, nil
	}

	// Write to output path if specified
	if opts.OutputPath != "" {
		if err := os.WriteFile(opts.OutputPath, scannedBytes, 0644); err != nil {
			return nil, fmt.Errorf("failed to write scan output: %w", err)
		}
	}

	return scannedBytes, nil
}

// convertToPDF converts scanned image bytes to PDF using img2pdf
func convertToPDF(ctx context.Context, imageBytes []byte, outputPath string) ([]byte, error) {
	// Write image to temp file
	tmpFile, err := os.CreateTemp("", "scan_*.png")
	if err != nil {
		return nil, err
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	if _, err := tmpFile.Write(imageBytes); err != nil {
		tmpFile.Close()
		return nil, err
	}
	tmpFile.Close()

	// Use img2pdf to convert to PDF
	var pdfOutput bytes.Buffer
	if outputPath != "" {
		cmd := exec.CommandContext(ctx, "img2pdf", tmpPath, "-o", outputPath)
		if out, err := cmd.CombinedOutput(); err != nil {
			// Fallback: try convert from ImageMagick
			cmd2 := exec.CommandContext(ctx, "convert", tmpPath, outputPath)
			if out2, err2 := cmd2.CombinedOutput(); err2 != nil {
				return nil, fmt.Errorf("img2pdf failed: %s; convert failed: %s", string(out), string(out2))
			}
		}
		pdfBytes, err := os.ReadFile(outputPath)
		if err != nil {
			return nil, err
		}
		return pdfBytes, nil
	}

	// Output to stdout
	cmd := exec.CommandContext(ctx, "img2pdf", tmpPath)
	cmd.Stdout = &pdfOutput
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("img2pdf failed: %w", err)
	}
	return pdfOutput.Bytes(), nil
}

// GetStatus checks if any scanner is available via SANE
func (s *SANEScanner) GetStatus(ctx context.Context) (models.ScannerStatus, error) {
	devices, err := s.ListDevices(ctx)

	status := models.ScannerStatus{
		Name:      s.Name(),
		Type:      "SANE",
		Devices:   devices,
		CheckedAt: time.Now(),
	}

	if err != nil || len(devices) == 0 {
		status.IsOnline = false
		status.StatusMessage = "No scanners detected"
		if err != nil {
			status.StatusMessage = fmt.Sprintf("Scanner detection failed: %v", err)
		}
		return status, nil
	}

	status.IsOnline = true
	status.StatusMessage = fmt.Sprintf("%d scanner(s) detected and ready", len(devices))
	return status, nil
}
