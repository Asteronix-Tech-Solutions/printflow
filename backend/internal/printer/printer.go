package printer

import (
	"context"
	"fmt"
	"sync"
	"time"

	"pintflow/backend/internal/models"
)

type Printer interface {
	Name() string
	Print(ctx context.Context, filePath string, copies int) error
	GetStatus(ctx context.Context) (models.PrinterStatus, error)
}

type Manager struct {
	mu            sync.RWMutex
	activePrinter Printer
	config        models.PrinterConfig
	cachedStatus  models.PrinterStatus
	lastChecked   time.Time
}

func NewManager(defaultName, defaultType, defaultAddress string) *Manager {
	m := &Manager{
		config: models.PrinterConfig{
			Name:      defaultName,
			Type:      defaultType,
			Address:   defaultAddress,
			PaperSize: "A4",
			Copies:    1,
		},
	}
	m.activePrinter = m.createDriver(defaultName, defaultType, defaultAddress)
	return m
}

func (m *Manager) createDriver(name, pType, address string) Printer {
	switch pType {
	case "cups":
		return NewCUPSPrinter(name, address)
	case "ipp", "raw", "lpd":
		return NewNetworkIPPPrinter(name, address)
	default:
		return NewMockPrinter(name)
	}
}

func (m *Manager) UpdateConfig(cfg models.PrinterConfig) models.PrinterStatus {
	m.mu.Lock()
	if cfg.Name != "" {
		m.config.Name = cfg.Name
	}
	if cfg.Type != "" {
		m.config.Type = cfg.Type
	}
	if cfg.Address != "" {
		m.config.Address = cfg.Address
	}
	if cfg.PaperSize != "" {
		m.config.PaperSize = cfg.PaperSize
	}
	if cfg.Copies > 0 {
		m.config.Copies = cfg.Copies
	}

	m.activePrinter = m.createDriver(m.config.Name, m.config.Type, m.config.Address)
	m.lastChecked = time.Time{} // Invalidate cache
	m.mu.Unlock()

	status, _ := m.GetStatus(context.Background())
	return status
}

func (m *Manager) GetConfig() models.PrinterConfig {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.config
}

func (m *Manager) Name() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.activePrinter.Name()
}

func (m *Manager) Print(ctx context.Context, filePath string, copies int) error {
	m.mu.RLock()
	prn := m.activePrinter
	cfg := m.config
	m.mu.RUnlock()

	if prn == nil {
		return fmt.Errorf("no active printer driver configured")
	}

	err := prn.Print(ctx, filePath, copies)
	if err == nil {
		return nil
	}

	// GUARDRAIL: Dynamic Driver Fallback
	// If primary printer driver fails, dynamically attempt printing with alternate driver
	var fallbackPrinter Printer
	if cfg.Type == "cups" {
		fallbackPrinter = NewNetworkIPPPrinter(cfg.Name, cfg.Address)
	} else if cfg.Type == "ipp" || cfg.Type == "raw" || cfg.Type == "lpd" {
		fallbackPrinter = NewCUPSPrinter(cfg.Name, cfg.Address)
	}

	if fallbackPrinter != nil {
		fallbackErr := fallbackPrinter.Print(ctx, filePath, copies)
		if fallbackErr == nil {
			return nil
		}
		return fmt.Errorf("primary driver '%s' failed: %v; fallback driver failed: %w", cfg.Type, err, fallbackErr)
	}

	return err
}

func (m *Manager) GetStatus(ctx context.Context) (models.PrinterStatus, error) {
	m.mu.RLock()
	if time.Since(m.lastChecked) < 10*time.Second && m.cachedStatus.Name != "" {
		status := m.cachedStatus
		m.mu.RUnlock()
		return status, nil
	}
	prn := m.activePrinter
	m.mu.RUnlock()

	if prn == nil {
		return models.PrinterStatus{
			Name:          "None",
			IsOnline:      false,
			StatusMessage: "No active printer configured",
		}, fmt.Errorf("no active printer driver")
	}

	// Fetch status with a max timeout context of 2.5s if ctx has no tighter deadline
	reqCtx, cancel := context.WithTimeout(ctx, 2500*time.Millisecond)
	defer cancel()

	status, err := prn.GetStatus(reqCtx)

	m.mu.Lock()
	m.cachedStatus = status
	m.lastChecked = time.Now()
	m.mu.Unlock()

	return status, err
}

func (m *Manager) DiscoverPrinters(ctx context.Context) ([]models.DiscoveredPrinter, error) {
	m.mu.RLock()
	configuredAddr := m.config.Address
	m.mu.RUnlock()

	return DiscoverPrinters(ctx, configuredAddr)
}
