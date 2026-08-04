package printer

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"pintflow/backend/internal/models"
)

type NetworkIPPPrinter struct {
	name          string
	address       string // e.g. "192.168.1.19" or "192.168.1.19:9100"
	mu            sync.RWMutex
	cachedTarget  string
	targetExpiry  time.Time
}

func NewNetworkIPPPrinter(name, address string) *NetworkIPPPrinter {
	address = strings.TrimSpace(address)
	if address == "" {
		address = "127.0.0.1"
	}
	return &NetworkIPPPrinter{
		name:    name,
		address: address,
	}
}

func (p *NetworkIPPPrinter) Name() string {
	return p.name
}

// InvalidateCache clears cached target port to force fresh probing
func (p *NetworkIPPPrinter) InvalidateCache() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.cachedTarget = ""
	p.targetExpiry = time.Time{}
}

// resolveTarget performs fast concurrent port probing (9100 RAW, 631 IPP, 515 LPD, 80 HTTP)
func (p *NetworkIPPPrinter) resolveTarget() string {
	p.mu.RLock()
	if p.cachedTarget != "" && time.Now().Before(p.targetExpiry) {
		target := p.cachedTarget
		p.mu.RUnlock()
		return target
	}
	p.mu.RUnlock()

	addr := strings.TrimSpace(p.address)
	if addr == "" {
		addr = "127.0.0.1"
	}

	// If explicit port provided, use it directly
	if strings.Contains(addr, ":") {
		return addr
	}

	// Concurrent multi-port probe for fast detection (<100ms)
	ports := []string{"9100", "631", "515", "80"}
	type probeResult struct {
		port string
		err  error
	}

	resChan := make(chan probeResult, len(ports))
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()

	for _, port := range ports {
		go func(pt string) {
			target := net.JoinHostPort(addr, pt)
			d := net.Dialer{Timeout: 200 * time.Millisecond}
			conn, err := d.DialContext(ctx, "tcp", target)
			if err == nil {
				_ = conn.Close()
				resChan <- probeResult{port: pt, err: nil}
			} else {
				resChan <- probeResult{port: pt, err: err}
			}
		}(port)
	}

	// First responding port wins
	resolvedPort := "9100" // Default to standard RAW AppSocket
	select {
	case res := <-resChan:
		if res.err == nil {
			resolvedPort = res.port
		}
	case <-time.After(300 * time.Millisecond):
		// Timeout fallback
	}

	targetAddr := net.JoinHostPort(addr, resolvedPort)

	p.mu.Lock()
	p.cachedTarget = targetAddr
	p.targetExpiry = time.Now().Add(5 * time.Minute)
	p.mu.Unlock()

	return targetAddr
}

func (p *NetworkIPPPrinter) Print(ctx context.Context, filePath string, copies int) error {
	targetAddr := p.resolveTarget()
	if copies < 1 {
		copies = 1
	}

	host, port, err := net.SplitHostPort(targetAddr)
	if err != nil {
		host = targetAddr
		port = "9100"
	}

	for i := 0; i < copies; i++ {
		file, err := os.Open(filePath)
		if err != nil {
			return fmt.Errorf("failed to open file for printing: %w", err)
		}

		if port == "631" || port == "80" || port == "8080" {
			// IPP / HTTP Protocol Submission
			url := fmt.Sprintf("http://%s:%s/ipp/print", host, port)
			req, err := http.NewRequestWithContext(ctx, "POST", url, file)
			if err != nil {
				file.Close()
				return fmt.Errorf("failed to create HTTP/IPP print request: %w", err)
			}
			req.Header.Set("Content-Type", "application/ipp")

			client := &http.Client{Timeout: 30 * time.Second}
			resp, err := client.Do(req)
			file.Close()

			if err != nil || (resp != nil && resp.StatusCode >= 400 && resp.StatusCode != 404) {
				// Protocol fallback: direct RAW TCP stream
				if errRaw := p.printRAWStream(targetAddr, filePath); errRaw != nil {
					return fmt.Errorf("IPP request failed and RAW fallback failed: %w", errRaw)
				}
			} else if resp != nil {
				_ = resp.Body.Close()
			}
		} else if port == "515" {
			// LPD Protocol Handshake & Direct Stream
			file.Close()
			if errLPD := p.printLPDStream(targetAddr, filePath); errLPD != nil {
				return fmt.Errorf("LPD print failed: %w", errLPD)
			}
		} else {
			// RAW / AppSocket Stream (Port 9100)
			file.Close()
			if errRAW := p.printRAWStream(targetAddr, filePath); errRAW != nil {
				return fmt.Errorf("failed to send print stream to printer at %s (copy %d/%d): %w", targetAddr, i+1, copies, errRAW)
			}
		}
	}

	return nil
}

func (p *NetworkIPPPrinter) printRAWStream(targetAddr, filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	d := net.Dialer{Timeout: 3 * time.Second}
	conn, err := d.Dial("tcp", targetAddr)
	if err != nil {
		return err
	}
	defer conn.Close()

	_ = conn.SetWriteDeadline(time.Now().Add(30 * time.Second))
	_, err = io.Copy(conn, file)
	return err
}

func (p *NetworkIPPPrinter) printLPDStream(targetAddr, filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	d := net.Dialer{Timeout: 3 * time.Second}
	conn, err := d.Dial("tcp", targetAddr)
	if err != nil {
		return err
	}
	defer conn.Close()

	_ = conn.SetWriteDeadline(time.Now().Add(30 * time.Second))
	// LPD receive job command: \x02printer\n
	cmd := fmt.Sprintf("\x02%s\n", p.name)
	if _, err := conn.Write([]byte(cmd)); err != nil {
		// Fallback to raw copy if LPD header rejected
		_, _ = file.Seek(0, 0)
		_, errCopy := io.Copy(conn, file)
		return errCopy
	}

	// Buffer & stream file content
	var buf bytes.Buffer
	_, _ = io.Copy(&buf, file)
	_, err = conn.Write(buf.Bytes())
	return err
}

func (p *NetworkIPPPrinter) GetStatus(ctx context.Context) (models.PrinterStatus, error) {
	targetAddr := p.resolveTarget()
	_, port, _ := net.SplitHostPort(targetAddr)

	protoName := "RAW AppSocket (Port 9100)"
	switch port {
	case "631":
		protoName = "IPP (Port 631)"
	case "515":
		protoName = "LPD Daemon (Port 515)"
	case "80", "8080":
		protoName = "HTTP Print Server"
	}

	d := net.Dialer{Timeout: 1 * time.Second}
	conn, err := d.DialContext(ctx, "tcp", targetAddr)
	if err != nil {
		p.InvalidateCache()
		return models.PrinterStatus{
			Name:          p.name,
			Type:          "Network Printer",
			Address:       p.address,
			ResolvedPort:  targetAddr,
			Protocol:      protoName,
			IsOnline:      false,
			StatusMessage: fmt.Sprintf("Printer unreachable at %s (%v)", targetAddr, err),
			StateReasons:  []string{"offline", "unreachable"},
			CheckedAt:     time.Now(),
		}, nil
	}
	_ = conn.Close()

	return models.PrinterStatus{
		Name:          p.name,
		Type:          "Network Printer",
		Address:       p.address,
		ResolvedPort:  targetAddr,
		Protocol:      protoName,
		IsOnline:      true,
		StatusMessage: fmt.Sprintf("Online and Ready (%s)", protoName),
		StateReasons:  []string{"idle"},
		CheckedAt:     time.Now(),
	}, nil
}
