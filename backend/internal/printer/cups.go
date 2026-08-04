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
	printerName := strings.TrimSpace(name)
	if printerName == "" {
		printerName = "default"
	}
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
		targetIP = "127.0.0.1"
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
	cmdCtx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond)
	defer cancel()

	cmd := exec.CommandContext(cmdCtx, "lpstat", "-p", p.printerName)
	output, err := cmd.CombinedOutput()
	if err != nil {
		p.AutoSyncQueue()
		cmd2 := exec.CommandContext(cmdCtx, "lpstat", "-p", p.printerName)
		output2, err2 := cmd2.CombinedOutput()
		if err2 != nil {
			return models.PrinterStatus{
				Name:          p.name,
				Type:          "CUPS (lp)",
				Address:       p.printerName,
				ResolvedPort:  p.printerName,
				Protocol:      "CUPS Daemon",
				IsOnline:      false,
				StatusMessage: fmt.Sprintf("CUPS printer unavailable: %s", strings.TrimSpace(string(output))),
				StateReasons:  []string{"unavailable"},
				CheckedAt:     time.Now(),
			}, nil
		}
		output = output2
	}

	msg := strings.TrimSpace(string(output))
	return models.PrinterStatus{
		Name:          p.name,
		Type:          "CUPS (lp)",
		Address:       p.printerName,
		ResolvedPort:  p.printerName,
		Protocol:      "CUPS Daemon",
		IsOnline:      true,
		StatusMessage: fmt.Sprintf("Online: %s", msg),
		StateReasons:  []string{"idle"},
		CheckedAt:     time.Now(),
	}, nil
}
