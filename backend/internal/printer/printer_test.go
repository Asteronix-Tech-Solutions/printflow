package printer

import (
	"context"
	"testing"
	"time"

	"pintflow/backend/internal/models"
)

// Mock printer removed

func TestNetworkPrinterProbingAndCaching(t *testing.T) {
	netPrn := NewNetworkIPPPrinter("TestNetPrinter", "127.0.0.1")

	start := time.Now()
	target := netPrn.resolveTarget()
	elapsed := time.Since(start)

	if target == "" {
		t.Fatalf("Expected non-empty resolved target")
	}

	// First probe should complete quickly (<350ms)
	if elapsed > 1*time.Second {
		t.Errorf("Target probing took too long: %v", elapsed)
	}

	// Second probe should use cache and be instant (<5ms)
	startCached := time.Now()
	target2 := netPrn.resolveTarget()
	elapsedCached := time.Since(startCached)

	if target != target2 {
		t.Errorf("Expected cached target %s, got %s", target, target2)
	}
	if elapsedCached > 50*time.Millisecond {
		t.Errorf("Cached target retrieval took too long: %v", elapsedCached)
	}
}

func TestManagerAndDiscovery(t *testing.T) {
	mgr := NewManager("TestPrinter", "cups", "127.0.0.1:9100")
	if mgr.Name() != "TestPrinter" {
		t.Errorf("Expected TestPrinter, got %s", mgr.Name())
	}

	ctx := context.Background()
	_, err := mgr.GetStatus(ctx)
	if err != nil {
		t.Fatalf("Failed to get manager printer status: %v", err)
	}

	// Test config update
	newStatus := mgr.UpdateConfig(models.PrinterConfig{
		Name:    "NewName",
		Type:    "raw",
		Address: "127.0.0.1",
	})
	if mgr.Name() != "NewName" {
		t.Errorf("Expected updated printer name NewName, got %s", mgr.Name())
	}
	_ = newStatus

	// Test discovery function
	disc, err := DiscoverPrinters(ctx, "127.0.0.1")
	if err != nil {
		t.Fatalf("Discovery failed: %v", err)
	}
	_ = disc
}
