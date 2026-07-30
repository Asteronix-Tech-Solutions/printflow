package printer

import (
	"context"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"pintflow/backend/internal/models"
)


type CUPSPrinter struct {
	name        string
	printerName string
}

func NewCUPSPrinter(name, printerName string) *CUPSPrinter {
	if printerName == "" || strings.Contains(printerName, ".") || strings.Contains(printerName, ":") {
		printerName = name
	}
	return &CUPSPrinter{
		name:        name,
		printerName: printerName,
	}
}


func (p *CUPSPrinter) Name() string {
	return p.name
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
		return fmt.Errorf("lp command failed: %w (output: %s)", err, string(output))
	}

	return nil
}

func (p *CUPSPrinter) GetStatus(ctx context.Context) (models.PrinterStatus, error) {
	cmd := exec.CommandContext(ctx, "lpstat", "-p", p.printerName)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return models.PrinterStatus{
			Name:          p.name,
			Type:          "CUPS (lp)",
			Address:       p.printerName,
			IsOnline:      false,
			StatusMessage: fmt.Sprintf("CUPS printer unavailable: %s", string(output)),
			CheckedAt:     time.Now(),
		}, nil
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
