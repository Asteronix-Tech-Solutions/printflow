package scanner

import (
	"context"
	"fmt"
	"sync"
	"time"

	"pintflow/backend/internal/models"
)

// Scanner interface — all scanner drivers must implement this
type Scanner interface {
	Name() string
	Scan(ctx context.Context, opts ScanOptions) ([]byte, error)
	GetStatus(ctx context.Context) (models.ScannerStatus, error)
	ListDevices(ctx context.Context) ([]models.ScannerDevice, error)
}

// ScanOptions holds parameters for a scan operation
type ScanOptions struct {
	Resolution int    // DPI: 150, 300, 600 (default 300)
	ColorMode  string // "Color", "Gray", "Lineart" (default "Color")
	Format     string // "pdf", "jpeg", "png" (default "pdf")
	PaperSize  string // "A4", "Letter", "Legal" (default "A4")
	Source     string // "Flatbed", "ADF" (default "Flatbed")
	DeviceName string // optional: target a specific scanner
	OutputPath string // full path for the output file
}

// Manager wraps the active scanner driver with thread-safe access
type Manager struct {
	mu            sync.RWMutex
	activeScanner Scanner
	scannerType   string
	deviceName    string
	cachedStatus  models.ScannerStatus
	lastChecked   time.Time
}

// NewManager creates a scanner manager with the specified driver type
func NewManager(deviceName, scannerType string) *Manager {
	m := &Manager{
		scannerType: scannerType,
		deviceName:  deviceName,
	}
	m.activeScanner = m.createDriver(scannerType, deviceName)
	return m
}

func (m *Manager) createDriver(sType, deviceName string) Scanner {
	// All scanner types use SANE — mock driver removed for production
	return NewSANEScanner(deviceName)
}

// UpdateConfig dynamically updates the target scanner device and driver type
func (m *Manager) UpdateConfig(deviceName, scannerType string) models.ScannerStatus {
	m.mu.Lock()
	if scannerType != "" {
		m.scannerType = scannerType
	}
	m.deviceName = deviceName
	m.activeScanner = m.createDriver(m.scannerType, m.deviceName)
	m.cachedStatus = models.ScannerStatus{}
	m.lastChecked = time.Time{} // Invalidate cache
	m.mu.Unlock()

	status, _ := m.GetStatus(context.Background())
	return status
}

// GetDeviceName returns the current target device name/IP
func (m *Manager) GetDeviceName() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.deviceName
}

// Scan triggers a scan using the active driver
func (m *Manager) Scan(ctx context.Context, opts ScanOptions) ([]byte, error) {
	m.mu.RLock()
	scn := m.activeScanner
	m.mu.RUnlock()

	if scn == nil {
		return nil, fmt.Errorf("no active scanner driver configured")
	}

	// Apply defaults
	if opts.Resolution <= 0 {
		opts.Resolution = 300
	}
	if opts.ColorMode == "" {
		opts.ColorMode = "Color"
	}
	if opts.Format == "" {
		opts.Format = "pdf"
	}
	if opts.PaperSize == "" {
		opts.PaperSize = "A4"
	}
	if opts.Source == "" {
		opts.Source = "Flatbed"
	}

	return scn.Scan(ctx, opts)
}

// GetStatus returns the current scanner status
func (m *Manager) GetStatus(ctx context.Context) (models.ScannerStatus, error) {
	m.mu.RLock()
	if time.Since(m.lastChecked) < 10*time.Second && m.cachedStatus.Name != "" {
		status := m.cachedStatus
		m.mu.RUnlock()
		return status, nil
	}
	scn := m.activeScanner
	m.mu.RUnlock()

	if scn == nil {
		return models.ScannerStatus{
			Name:          "None",
			IsOnline:      false,
			StatusMessage: "No active scanner configured",
		}, fmt.Errorf("no active scanner driver")
	}

	reqCtx, cancel := context.WithTimeout(ctx, 2500*time.Millisecond)
	defer cancel()

	status, err := scn.GetStatus(reqCtx)

	m.mu.Lock()
	status.TargetIP = m.deviceName
	m.cachedStatus = status
	m.lastChecked = time.Now()
	m.mu.Unlock()

	return status, err
}

// ListDevices returns all discovered scanner devices
func (m *Manager) ListDevices(ctx context.Context) ([]models.ScannerDevice, error) {
	m.mu.RLock()
	if time.Since(m.lastChecked) < 10*time.Second && len(m.cachedStatus.Devices) > 0 {
		devs := m.cachedStatus.Devices
		m.mu.RUnlock()
		return devs, nil
	}
	scn := m.activeScanner
	m.mu.RUnlock()

	if scn == nil {
		return nil, fmt.Errorf("no active scanner driver")
	}

	reqCtx, cancel := context.WithTimeout(ctx, 2500*time.Millisecond)
	defer cancel()

	return scn.ListDevices(reqCtx)
}

// Name returns the active scanner name
func (m *Manager) Name() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.activeScanner == nil {
		return "None"
	}
	return m.activeScanner.Name()
}

// GetType returns the scanner driver type
func (m *Manager) GetType() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.scannerType
}

