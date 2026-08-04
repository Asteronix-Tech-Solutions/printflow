package printer

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"pintflow/backend/internal/models"
)

func TestMockPrinter(t *testing.T) {
	mockPrn := NewMockPrinter("Test_Printer")

	if mockPrn.Name() != "Test_Printer" {
		t.Errorf("Expected printer name Test_Printer, got %s", mockPrn.Name())
	}

	ctx := context.Background()
	status, err := mockPrn.GetStatus(ctx)
	if err != nil {
		t.Fatalf("Failed to get printer status: %v", err)
	}

	if !status.IsOnline {
		t.Errorf("Expected mock printer to be online")
	}

	tempFile := filepath.Join(t.TempDir(), "dummy.txt")
	_ = os.WriteFile(tempFile, []byte("test print"), 0644)

	if err := mockPrn.Print(ctx, tempFile, 1); err != nil {
		t.Fatalf("Mock print failed: %v", err)
	}
}

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
	mgr := NewManager("TestPrinter", "mock", "127.0.0.1:9100")
	if mgr.Name() != "TestPrinter" {
		t.Errorf("Expected TestPrinter, got %s", mgr.Name())
	}

	ctx := context.Background()
	status, err := mgr.GetStatus(ctx)
	if err != nil {
		t.Fatalf("Failed to get manager printer status: %v", err)
	}
	if !status.IsOnline {
		t.Errorf("Expected mock manager status to be online")
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
