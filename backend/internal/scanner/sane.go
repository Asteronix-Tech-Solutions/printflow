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
	var devices []models.ScannerDevice

	cmdCtx, cancel := context.WithTimeout(ctx, 2500*time.Millisecond)
	defer cancel()

	cmd := exec.CommandContext(cmdCtx, "scanimage", "-L")
	output, err := cmd.CombinedOutput()
	if err == nil {
		lines := strings.Split(string(output), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if !strings.HasPrefix(line, "device") {
				continue
			}
			dev := parseDeviceLine(line)
			if dev.DeviceName != "" {
				devices = append(devices, dev)
			}
		}
	}

	// If a specific scanner IP/device is configured, ensure it is included
	if s.deviceName != "" {
		configuredDev := s.resolveDevice(ctx, s.deviceName)
		found := false
		for _, d := range devices {
			if d.DeviceName == configuredDev || d.DeviceName == s.deviceName {
				found = true
				break
			}
		}
		if !found {
			devices = append(devices, models.ScannerDevice{
				DeviceName: configuredDev,
				Vendor:     "Network Scanner",
				Model:      s.deviceName,
				Type:       "eSCL / SANE Network Device",
			})
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

// ExtractHostIP extracts pure IPv4/IPv6 address or hostname from raw target string (stripping schemes, ports, and paths)
func ExtractHostIP(address string) string {
	addr := strings.TrimSpace(address)
	if addr == "" {
		return ""
	}

	// Remove scheme if present (e.g. "ipp://", "http://", "escl:http://")
	if idx := strings.Index(addr, "://"); idx != -1 {
		addr = addr[idx+3:]
	} else if idx := strings.Index(addr, ":/"); idx != -1 {
		addr = addr[idx+2:]
	}

	// Remove path if present (e.g. "192.168.1.19:631/ipp/print")
	if idx := strings.Index(addr, "/"); idx != -1 {
		addr = addr[:idx]
	}

	// Handle bracketed IPv6 address e.g. [fe80::1]:80
	if strings.HasPrefix(addr, "[") {
		if endIdx := strings.Index(addr, "]"); endIdx != -1 {
			return addr[1:endIdx]
		}
	}

	// Remove port if present (e.g. "192.168.1.19:9100")
	if idx := strings.LastIndex(addr, ":"); idx != -1 {
		// Ensure it's not part of an unbracketed IPv6 address
		if !strings.Contains(addr[:idx], ":") {
			addr = addr[:idx]
		}
	}

	return strings.Trim(addr, "[]")
}

// resolveDevice determines which device to use for scanning
func (s *SANEScanner) resolveDevice(ctx context.Context, requestedDevice string) string {
	dev := requestedDevice
	if dev == "" {
		dev = strings.TrimSpace(s.deviceName)
	}

	if dev == "" {
		// Auto-detect first available device
		devices, err := s.ListDevices(ctx)
		if err == nil && len(devices) > 0 {
			return devices[0].DeviceName
		}
		return ""
	}

	// If device is already a full SANE/eSCL URI driver string
	if strings.HasPrefix(dev, "escl:") || strings.HasPrefix(dev, "net:") || strings.HasPrefix(dev, "airscan:") || strings.HasPrefix(dev, "pixma:") || strings.HasPrefix(dev, "hpaio:") {
		return dev
	}

	// If device is an IP address or host string (e.g. "192.168.1.19" or "192.168.1.19:9100"), convert to eSCL URI
	if strings.Contains(dev, ".") || strings.Contains(dev, ":") {
		hostIP := ExtractHostIP(dev)
		if hostIP != "" {
			return fmt.Sprintf("escl:http://%s:80/", hostIP)
		}
	}

	return dev
}

// Scan performs a scan using scanimage CLI
func (s *SANEScanner) Scan(ctx context.Context, opts ScanOptions) ([]byte, error) {
	device := s.resolveDevice(ctx, opts.DeviceName)

	// Determine scanimage output format
	// Build scanimage command
	args := []string{}
	if device != "" {
		args = append(args, "--device-name="+device)
	}
	args = append(args, fmt.Sprintf("--resolution=%d", opts.Resolution))

	// Source parameter (Flatbed / ADF)
	source := validateSource(opts.Source)
	args = append(args, "--source="+source)

	// Map color mode to SANE mode names
	mode := validateMode(opts.ColorMode)
	args = append(args, "--mode="+mode)
	
	scanFormat := validateFormat(opts.Format)
	needsPDFConversion := false
	if scanFormat == "pdf" {
		scanFormat = "png"
		needsPDFConversion = true
	}
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
		errStr := stderr.String()

		// Guardrail: If ADF is out of documents or source is rejected, auto-fallback to Flatbed alternatives
		if strings.Contains(errStr, "feeder out of documents") || strings.Contains(errStr, "Document feeder") || strings.Contains(errStr, "Invalid source") || strings.Contains(errStr, "source") {
			flatbedSources := []string{"Flatbed", "Platen", "Glass"}
			var stdoutFallback, stderrFallback bytes.Buffer
			var errFallback error
			success := false

			for _, fb := range flatbedSources {
				if strings.EqualFold(source, fb) { 
					continue 
				} // skip what we already tried

				fallbackArgs := make([]string, 0, len(args))
				for _, arg := range args {
					if !strings.HasPrefix(arg, "--source=") {
						fallbackArgs = append(fallbackArgs, arg)
					}
				}
				fallbackArgs = append(fallbackArgs, "--source="+fb)

				cmdFallback := exec.CommandContext(ctx, "scanimage", fallbackArgs...)
				stdoutFallback.Reset()
				stderrFallback.Reset()
				cmdFallback.Stdout = &stdoutFallback
				cmdFallback.Stderr = &stderrFallback

				if errFallback = cmdFallback.Run(); errFallback == nil {
					stdout = stdoutFallback
					stderr = stderrFallback
					success = true
					break
				}
			}

			if !success {
				return nil, fmt.Errorf("scanimage failed: %w (stderr: %s; fallback: %s)", err, errStr, stderrFallback.String())
			}
		} else {
			return nil, fmt.Errorf("scanimage failed: %w (stderr: %s)", err, errStr)
		}
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
	devices, _ := s.ListDevices(ctx)

	status := models.ScannerStatus{
		Name:      s.Name(),
		Type:      "SANE",
		Devices:   devices,
		CheckedAt: time.Now(),
	}

	if len(devices) == 0 {
		status.IsOnline = false
		status.StatusMessage = "No scanners detected"
		return status, nil
	}

	status.IsOnline = true
	status.StatusMessage = fmt.Sprintf("%d scanner(s) available and ready", len(devices))
	return status, nil
}

func validateSource(src string) string {
	if strings.EqualFold(src, "ADF") || strings.EqualFold(src, "Automatic Document Feeder") {
		return "ADF"
	}
	return "Flatbed"
}

func validateMode(mode string) string {
	switch strings.ToLower(mode) {
	case "gray", "grayscale", "grey":
		return "Gray"
	case "lineart", "bw", "blackwhite", "black_white":
		return "Lineart"
	default:
		return "Color"
	}
}

func validateFormat(format string) string {
	switch strings.ToLower(format) {
	case "jpeg", "jpg":
		return "jpeg"
	case "png":
		return "png"
	default:
		return "pdf"
	}
}
