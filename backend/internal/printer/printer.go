package printer

import (
	"context"
	"fmt"
	"sync"

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
	case "ipp", "raw":
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
	m.mu.RUnlock()
	return prn.Print(ctx, filePath, copies)
}

func (m *Manager) GetStatus(ctx context.Context) (models.PrinterStatus, error) {
	m.mu.RLock()
	prn := m.activePrinter
	m.mu.RUnlock()
	if prn == nil {
		return models.PrinterStatus{
			Name:          "None",
			IsOnline:      false,
			StatusMessage: "No active printer configured",
		}, fmt.Errorf("no active printer driver")
	}
	return prn.GetStatus(ctx)
}
