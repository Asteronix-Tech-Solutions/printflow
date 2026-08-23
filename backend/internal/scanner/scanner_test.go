package scanner

import (
	"context"
	"testing"
)

func TestExtractHostIP(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"192.168.1.19", "192.168.1.19"},
		{"192.168.1.19:9100", "192.168.1.19"},
		{"192.168.1.19:631", "192.168.1.19"},
		{"ipp://192.168.1.100:631/ipp/print", "192.168.1.100"},
		{"http://192.168.1.50:8080/eSCL/", "192.168.1.50"},
		{"escl:http://192.168.1.19:80/", "192.168.1.19"},
		{"[fe80::1]:80", "fe80::1"},
		{"printer-host.local:9100", "printer-host.local"},
		{"", ""},
	}

	for _, tt := range tests {
		got := ExtractHostIP(tt.input)
		if got != tt.expected {
			t.Errorf("ExtractHostIP(%q) = %q; want %q", tt.input, got, tt.expected)
		}
	}
}

func TestSANEScannerResolveDevice(t *testing.T) {
	s := NewSANEScanner("192.168.1.19:9100")
	ctx := context.Background()

	resolved := s.resolveDevice(ctx, "")
	expected := "escl:http://192.168.1.19:80/"
	if resolved != expected {
		t.Errorf("resolveDevice with port = %q; want %q", resolved, expected)
	}

	// Direct IP without port
	resolvedDirect := s.resolveDevice(ctx, "10.0.0.50")
	expectedDirect := "escl:http://10.0.0.50:80/"
	if resolvedDirect != expectedDirect {
		t.Errorf("resolveDevice direct IP = %q; want %q", resolvedDirect, expectedDirect)
	}

	// Full URI driver string should pass through unchanged
	resolvedFull := s.resolveDevice(ctx, "net:192.168.1.19")
	if resolvedFull != "net:192.168.1.19" {
		t.Errorf("resolveDevice full driver URI = %q; want 'net:192.168.1.19'", resolvedFull)
	}
}

func TestManagerUpdateConfig(t *testing.T) {
	mgr := NewManager("192.168.1.10", "sane")
	if mgr.GetDeviceName() != "192.168.1.10" {
		t.Errorf("Initial deviceName = %q; want '192.168.1.10'", mgr.GetDeviceName())
	}

	mgr.UpdateConfig("192.168.1.99", "sane")
	if mgr.GetDeviceName() != "192.168.1.99" {
		t.Errorf("Updated deviceName = %q; want '192.168.1.99'", mgr.GetDeviceName())
	}

	status, err := mgr.GetStatus(context.Background())
	if err != nil {
		t.Fatalf("GetStatus failed: %v", err)
	}
	if status.TargetIP != "192.168.1.99" {
		t.Errorf("status.TargetIP = %q; want '192.168.1.99'", status.TargetIP)
	}
}
