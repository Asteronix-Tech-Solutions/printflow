package printer

import (
	"context"
	"fmt"
	"io"
	"net"
	"os"
	"time"

	"pintflow/backend/internal/models"
)

type NetworkIPPPrinter struct {
	name    string
	address string // e.g. "192.168.1.100:9100" or "192.168.1.100:631"
}

func NewNetworkIPPPrinter(name, address string) *NetworkIPPPrinter {
	if address == "" {
		address = "192.168.1.100:9100"
	}
	return &NetworkIPPPrinter{
		name:    name,
		address: address,
	}
}

func (p *NetworkIPPPrinter) Name() string {
	return p.name
}

func (p *NetworkIPPPrinter) Print(ctx context.Context, filePath string, copies int) error {
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("failed to open file for printing: %w", err)
	}
	defer file.Close()

	if copies < 1 {
		copies = 1
	}

	for i := 0; i < copies; i++ {
		if i > 0 {
			_, _ = file.Seek(0, 0)
		}
		
		conn, err := net.DialTimeout("tcp", p.address, 10*time.Second)
		if err != nil {
			return fmt.Errorf("failed to connect to printer at %s: %w", p.address, err)
		}

		_ = conn.SetWriteDeadline(time.Now().Add(30 * time.Second))
		_, err = io.Copy(conn, file)
		_ = conn.Close()

		if err != nil {
			return fmt.Errorf("failed to send print stream to printer (copy %d/%d): %w", i+1, copies, err)
		}
	}

	return nil
}

func (p *NetworkIPPPrinter) GetStatus(ctx context.Context) (models.PrinterStatus, error) {
	conn, err := net.DialTimeout("tcp", p.address, 3*time.Second)
	if err != nil {
		return models.PrinterStatus{
			Name:          p.name,
			Type:          "Network IPP / Socket 9100",
			Address:       p.address,
			IsOnline:      false,
			StatusMessage: fmt.Sprintf("Printer unreachable at %s: %v", p.address, err),
			CheckedAt:     time.Now(),
		}, nil
	}
	_ = conn.Close()

	return models.PrinterStatus{
		Name:          p.name,
		Type:          "Network IPP / Socket 9100",
		Address:       p.address,
		IsOnline:      true,
		StatusMessage: "Printer is Online and Ready",
		CheckedAt:     time.Now(),
	}, nil
}
