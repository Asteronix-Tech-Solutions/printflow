package printer

import (
	"context"
	"os"
	"path/filepath"
	"testing"
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
