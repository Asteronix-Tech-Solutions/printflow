package printer

import (
	"context"
	"fmt"
	"net"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"pintflow/backend/internal/models"
)


type CUPSPrinter struct {
	name        string
	printerName string
	address     string
}

func NewCUPSPrinter(name, address string) *CUPSPrinter {
	printerName := name
	if address != "" && !strings.Contains(address, ".") && !strings.Contains(address, ":") {
		printerName = address
	}
	return &CUPSPrinter{
		name:        name,
		printerName: printerName,
		address:     address,
	}
}

func (p *CUPSPrinter) Name() string {
	return p.name
}

func (p *CUPSPrinter) AutoSyncQueue() {
	targetIP := strings.TrimSpace(p.address)
	if targetIP == "" || targetIP == p.name {
		targetIP = "192.168.1.206"
	}
	if strings.Contains(targetIP, ":") {
		host, _, err := net.SplitHostPort(targetIP)
		if err == nil {
			targetIP = host
		}
	}
	// Synchronize CUPS queue URI to IPP port 631
	uri := fmt.Sprintf("ipp://%s:631/ipp/print", targetIP)
	cmd := exec.Command("lpadmin", "-p", p.printerName, "-v", uri, "-E")
	_ = cmd.Run()
}

func (p *CUPSPrinter) Print(ctx context.Context, filePath string, copies int) error {
	if copies < 1 {
		copies = 1
	}

	args := []string{
		"-d", p.printerName,
		"-n", strconv.Itoa(copies),
		filePath,
	}

	cmd := exec.CommandContext(ctx, "lp", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		// Attempt Guardrail Auto-Sync & Retry
		p.AutoSyncQueue()
		cmdRetry := exec.CommandContext(ctx, "lp", args...)
		outputRetry, errRetry := cmdRetry.CombinedOutput()
		if errRetry != nil {
			return fmt.Errorf("lp command failed: %w (output: %s)", err, string(output))
		}
		_ = outputRetry
	}

	return nil
}

func (p *CUPSPrinter) GetStatus(ctx context.Context) (models.PrinterStatus, error) {
	cmd := exec.CommandContext(ctx, "lpstat", "-p", p.printerName)
	output, err := cmd.CombinedOutput()
	if err != nil {
		p.AutoSyncQueue()
		cmd2 := exec.CommandContext(ctx, "lpstat", "-p", p.printerName)
		output2, err2 := cmd2.CombinedOutput()
		if err2 != nil {
			return models.PrinterStatus{
				Name:          p.name,
				Type:          "CUPS (lp)",
				Address:       p.printerName,
				IsOnline:      false,
				StatusMessage: fmt.Sprintf("CUPS printer unavailable: %s", string(output)),
				CheckedAt:     time.Now(),
			}, nil
		}
		output = output2
	}

	return models.PrinterStatus{
		Name:          p.name,
		Type:          "CUPS (lp)",
		Address:       p.printerName,
		IsOnline:      true,
		StatusMessage: fmt.Sprintf("Online: %s", string(output)),
		CheckedAt:     time.Now(),
	}, nil
}
