package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port                  string
	DatabaseDriver        string // "sqlite" or "postgres"
	DatabaseURL           string
	WebhookSecret         string
	DefaultPrinter        string
	PrinterType           string // "ipp", "cups", "raw", "mock"
	PrinterAddress        string // IP or printer URI
	GoogleCredentialsFile string
	GoogleAPIKey          string
	APIKey                string
	CORSAllowedOrigins    []string
	MaxPayloadSizeMB      int64
	RateLimitRPS          float64
	RateLimitBurst        int
	TempDir               string
	ArchiveDir            string
	LogDir                string
	MaxConcurrentJobs     int
	ScannerType           string // "sane", "mock"
	ScannerDevice         string // optional: specific SANE device name
	ScanDir               string // output directory for scans
	ScanWatchDir          string // push-scan inbox directory
}

func Load() *Config {
	driver := getEnv("DATABASE_DRIVER", "")
	dbURL := getEnv("DATABASE_URL", "")

	if driver == "" {
		if strings.HasPrefix(dbURL, "postgres://") || strings.HasPrefix(dbURL, "postgresql://") {
			driver = "postgres"
		} else {
			driver = "sqlite"
		}
	}

	if dbURL == "" {
		if driver == "postgres" {
			dbURL = "postgres://postgres:postgrespassword@localhost:5432/pintflow?sslmode=disable"
		} else {
			dbURL = "storage/pintflow.db"
		}
	}

	corsOriginsStr := getEnv("CORS_ALLOWED_ORIGINS", "*")
	corsOrigins := strings.Split(corsOriginsStr, ",")
	for i := range corsOrigins {
		corsOrigins[i] = strings.TrimSpace(corsOrigins[i])
	}

	return &Config{
		Port:                  getEnv("PORT", "8080"),
		DatabaseDriver:        driver,
		DatabaseURL:           dbURL,
		WebhookSecret:         getEnv("WEBHOOK_SECRET", "pintflow_secret_token_123"),
		APIKey:                getEnv("API_KEY", ""),
		CORSAllowedOrigins:    corsOrigins,
		MaxPayloadSizeMB:      int64(getEnvAsInt("MAX_PAYLOAD_SIZE_MB", 25)),
		RateLimitRPS:          float64(getEnvAsInt("RATE_LIMIT_RPS", 50)),
		RateLimitBurst:        getEnvAsInt("RATE_LIMIT_BURST", 100),
		DefaultPrinter:        getEnv("DEFAULT_PRINTER", "Brother_DCP_T430W"),
		PrinterType:           validatePrinterType(getEnv("PRINTER_TYPE", "cups")),
		PrinterAddress:        getEnv("PRINTER_ADDRESS", "192.168.1.100:9100"),
		GoogleCredentialsFile: getEnv("GOOGLE_CREDENTIALS_FILE", "storage/credentials.json"),
		GoogleAPIKey:          getEnv("GOOGLE_API_KEY", ""),
		TempDir:               getEnv("TEMP_DIR", "storage/temp"),
		ArchiveDir:            getEnv("ARCHIVE_DIR", "storage/archive"),
		LogDir:                getEnv("LOG_DIR", "storage/logs"),
		MaxConcurrentJobs:     getEnvAsInt("MAX_CONCURRENT_JOBS", 3),
		ScannerType:           validateScannerType(getEnv("SCANNER_TYPE", "sane")),
		ScannerDevice:         getEnv("SCANNER_DEVICE", ""),
		ScanDir:               getEnv("SCAN_DIR", "storage/scans"),
		ScanWatchDir:          getEnv("SCAN_WATCH_DIR", "storage/scans/inbox"),
	}
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok {
		if idx := strings.Index(val, "#"); idx != -1 {
			val = val[:idx]
		}
		val = strings.TrimSpace(val)
		if val != "" {
			return val
		}
	}
	return fallback
}

func getEnvAsInt(key string, fallback int) int {
	valStr := getEnv(key, "")
	if val, err := strconv.Atoi(valStr); err == nil {
		return val
	}
	return fallback
}

// validatePrinterType ensures only allowed printer driver types are used
func validatePrinterType(t string) string {
	switch strings.ToLower(strings.TrimSpace(t)) {
	case "cups", "ipp", "raw", "lpd":
		return strings.ToLower(strings.TrimSpace(t))
	default:
		return "cups"
	}
}

// validateScannerType ensures only allowed scanner driver types are used
func validateScannerType(t string) string {
	switch strings.ToLower(strings.TrimSpace(t)) {
	case "sane":
		return "sane"
	default:
		return "sane"
	}
}
