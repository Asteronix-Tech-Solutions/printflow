package printer

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"pintflow/backend/internal/models"
)

type NetworkIPPPrinter struct {
	name    string
	address string // e.g. "192.168.1.19" or "192.168.1.19:515"
}

func NewNetworkIPPPrinter(name, address string) *NetworkIPPPrinter {
	if address == "" {
		address = "192.168.1.19"
	}
	return &NetworkIPPPrinter{
		name:    name,
		address: address,
	}
}

func (p *NetworkIPPPrinter) Name() string {
	return p.name
}

// resolveTarget automatically detects the active printer port (515 LPD, 631 IPP, 9100 RAW, or 80 HTTP)
func (p *NetworkIPPPrinter) resolveTarget() string {
	addr := strings.TrimSpace(p.address)
	if addr == "" {
		addr = "192.168.1.19"
	}
	if !strings.Contains(addr, ":") {
		// Probe active ports on Brother printer: 515 (LPD), 631 (IPP), 9100 (RAW), 80 (HTTP)
		for _, port := range []string{"515", "631", "9100", "80"} {
			conn, err := net.DialTimeout("tcp", net.JoinHostPort(addr, port), 1*time.Second)
			if err == nil {
				_ = conn.Close()
				return net.JoinHostPort(addr, port)
			}
		}
		return net.JoinHostPort(addr, "515")
	}
	return addr
}

func (p *NetworkIPPPrinter) Print(ctx context.Context, filePath string, copies int) error {
	targetAddr := p.resolveTarget()
	if copies < 1 {
		copies = 1
	}

	host, port, err := net.SplitHostPort(targetAddr)
	if err != nil {
		host = targetAddr
		port = "515"
	}

	for i := 0; i < copies; i++ {
		file, err := os.Open(filePath)
		if err != nil {
			return fmt.Errorf("failed to open file for printing: %w", err)
		}

		if port == "80" || port == "8080" {
			url := fmt.Sprintf("http://%s:%s/ipp/print", host, port)
			req, err := http.NewRequestWithContext(ctx, "POST", url, file)
			if err != nil {
				file.Close()
				return fmt.Errorf("failed to create HTTP print request: %w", err)
			}
			req.Header.Set("Content-Type", "application/octet-stream")

			client := &http.Client{Timeout: 30 * time.Second}
			resp, err := client.Do(req)
			file.Close()
			if err != nil || (resp != nil && resp.StatusCode >= 400 && resp.StatusCode != 404) {
				file2, err2 := os.Open(filePath)
				if err2 == nil {
					conn, errConn := net.DialTimeout("tcp", targetAddr, 10*time.Second)
					if errConn == nil {
						_ = conn.SetWriteDeadline(time.Now().Add(30 * time.Second))
						_, _ = io.Copy(conn, file2)
						_ = conn.Close()
					}
					file2.Close()
				}
			} else if resp != nil {
				_ = resp.Body.Close()
			}
		} else {
			// Direct TCP stream to LPD / IPP / RAW port (e.g., Port 515 / 631 / 9100)
			conn, err := net.DialTimeout("tcp", targetAddr, 10*time.Second)
			if err != nil {
				file.Close()
				return fmt.Errorf("failed to connect to printer at %s: %w", targetAddr, err)
			}

			_ = conn.SetWriteDeadline(time.Now().Add(30 * time.Second))
			_, err = io.Copy(conn, file)
			_ = conn.Close()
			file.Close()

			if err != nil {
				return fmt.Errorf("failed to send print stream to printer (copy %d/%d): %w", i+1, copies, err)
			}
		}
	}

	return nil
}

func (p *NetworkIPPPrinter) GetStatus(ctx context.Context) (models.PrinterStatus, error) {
	targetAddr := p.resolveTarget()
	conn, err := net.DialTimeout("tcp", targetAddr, 3*time.Second)
	if err != nil {
		return models.PrinterStatus{
			Name:          p.name,
			Type:          "Network Printer (Brother / LPD / IPP)",
			Address:       targetAddr,
			IsOnline:      false,
			StatusMessage: fmt.Sprintf("Printer unreachable at %s: %v", targetAddr, err),
			CheckedAt:     time.Now(),
		}, nil
	}
	_ = conn.Close()

	return models.PrinterStatus{
		Name:          p.name,
		Type:          "Network Printer (Brother / LPD / IPP)",
		Address:       targetAddr,
		IsOnline:      true,
		StatusMessage: "Printer is Online and Ready",
		CheckedAt:     time.Now(),
	}, nil
}


