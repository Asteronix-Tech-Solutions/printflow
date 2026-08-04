package printer

import (
	"context"
	"fmt"
	"net"
	"strings"
	"sync"
	"time"

	"pintflow/backend/internal/models"
)

// DiscoverPrinters scans local network interface subnets and configured address for active printers
func DiscoverPrinters(ctx context.Context, configuredAddress string) ([]models.DiscoveredPrinter, error) {
	discovered := make([]models.DiscoveredPrinter, 0)
	var mu sync.Mutex

	// Collect target IPs to scan: local subnet IPs and configured address
	targetIPs := collectTargetIPs(configuredAddress)
	if len(targetIPs) == 0 {
		targetIPs = []string{"127.0.0.1", "192.168.1.19", "192.168.1.206", "192.168.1.100"}
	}

	portsToScan := []struct {
		port     string
		protocol string
	}{
		{"9100", "RAW (AppSocket)"},
		{"631", "IPP (Internet Printing Protocol)"},
		{"515", "LPD (Line Printer Daemon)"},
		{"80", "HTTP Web Print"},
	}

	subCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var wg sync.WaitGroup
	// Limit concurrency to avoid overwhelming local network
	sem := make(chan struct{}, 20)

	for _, ip := range targetIPs {
		for _, p := range portsToScan {
			wg.Add(1)
			sem <- struct{}{}

			go func(targetIP, port, proto string) {
				defer wg.Done()
				defer func() { <-sem }()

				addr := net.JoinHostPort(targetIP, port)
				d := net.Dialer{Timeout: 300 * time.Millisecond}
				conn, err := d.DialContext(subCtx, "tcp", addr)
				if err == nil {
					_ = conn.Close()

					name := fmt.Sprintf("Printer (%s)", targetIP)
					if port == "9100" {
						name = fmt.Sprintf("AppSocket Printer (%s:9100)", targetIP)
					} else if port == "631" {
						name = fmt.Sprintf("IPP Printer (%s:631)", targetIP)
					} else if port == "515" {
						name = fmt.Sprintf("LPD Printer (%s:515)", targetIP)
					}

					mu.Lock()
					discovered = append(discovered, models.DiscoveredPrinter{
						IP:       targetIP,
						Port:     port,
						Protocol: proto,
						Name:     name,
						IsOnline: true,
					})
					mu.Unlock()
				}
			}(ip, p.port, p.protocol)
		}
	}

	wg.Wait()
	return discovered, nil
}

func collectTargetIPs(configuredAddress string) []string {
	ipMap := make(map[string]bool)

	// Clean configuredAddress
	if configuredAddress != "" {
		host := configuredAddress
		if strings.Contains(configuredAddress, ":") {
			if h, _, err := net.SplitHostPort(configuredAddress); err == nil {
				host = h
			}
		}
		if host != "" && host != "localhost" {
			ipMap[host] = true
		}
	}

	// Iterate local interfaces to build local subnet sweep (e.g. 192.168.1.X)
	ifaces, err := net.Interfaces()
	if err == nil {
		for _, iface := range ifaces {
			if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
				continue
			}
			addrs, err := iface.Addrs()
			if err != nil {
				continue
			}
			for _, addr := range addrs {
				ipnet, ok := addr.(*net.IPNet)
				if !ok || ipnet.IP.To4() == nil {
					continue
				}
				ip := ipnet.IP.To4()
				prefix := fmt.Sprintf("%d.%d.%d.", ip[0], ip[1], ip[2])
				for i := 1; i <= 254; i++ {
					candidate := fmt.Sprintf("%s%d", prefix, i)
					if i == 1 || i == 10 || i == 19 || i == 20 || i == 50 || i == 100 || i == 206 || candidate == configuredAddress {
						ipMap[candidate] = true
					}
				}
			}
		}
	}

	result := make([]string, 0, len(ipMap))
	for ip := range ipMap {
		result = append(result, ip)
	}
	return result
}
