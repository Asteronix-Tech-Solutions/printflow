package printer

import (
	"context"
	"time"

	"pintflow/backend/internal/models"
)

type MockPrinter struct {
	name string
}

func NewMockPrinter(name string) *MockPrinter {
	if name == "" {
		name = "Mock_Brother_DCP_T430W"
	}
	return &MockPrinter{name: name}
}

func (p *MockPrinter) Name() string {
	return p.name
}

func (p *MockPrinter) Print(ctx context.Context, filePath string, copies int) error {
	// Simulate print job duration
	duration := time.Duration(1+copies) * time.Second
	select {
	case <-time.After(duration):
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (p *MockPrinter) GetStatus(ctx context.Context) (models.PrinterStatus, error) {
	return models.PrinterStatus{
		Name:          p.name,
		Type:          "Mock Development Printer",
		Address:       "virtual://localhost",
		IsOnline:      true,
		StatusMessage: "Mock Printer is Ready (Simulation Mode)",
		CheckedAt:     time.Now(),
	}, nil
}
