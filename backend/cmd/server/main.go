package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"pintflow/backend/internal/api"
	"pintflow/backend/internal/config"
	"pintflow/backend/internal/database"
	"pintflow/backend/internal/events"
	"pintflow/backend/internal/google"
	"pintflow/backend/internal/logger"
	"pintflow/backend/internal/printer"
	"pintflow/backend/internal/queue"
	"pintflow/backend/internal/scanner"
	"pintflow/backend/internal/storage"
)

func main() {
	cfg := config.Load()

	// Initialize Storage
	stg, err := storage.NewStorage(cfg.TempDir, cfg.ArchiveDir, cfg.LogDir)
	if err != nil {
		fmt.Printf("FATAL: Failed to initialize file storage: %v\n", err)
		os.Exit(1)
	}
	stg.SetScanDir(cfg.ScanDir)

	// Initialize Database
	db, err := database.Connect(cfg.DatabaseDriver, cfg.DatabaseURL)
	if err != nil {
		fmt.Printf("FATAL: Failed to connect to database at %s: %v\n", cfg.DatabaseURL, err)
		os.Exit(1)
	}
	defer db.Close()

	// Initialize Event Broadcaster for SSE
	broadcaster := events.NewBroadcaster()

	// Initialize Logger
	log, err := logger.New(db.DB, cfg.LogDir)
	if err != nil {
		fmt.Printf("FATAL: Failed to initialize logger: %v\n", err)
		os.Exit(1)
	}
	defer log.Close()
	log.SetBroadcaster(broadcaster)

	log.Info(fmt.Sprintf("PintFlow backend starting up... (Database: %s, Port: %s)", cfg.DatabaseDriver, cfg.Port))

	// Restore Printer Settings from DB if present
	pName, _ := db.GetSetting("printer_name")
	pType, _ := db.GetSetting("printer_type")
	pAddress, _ := db.GetSetting("printer_address")
	if pName != "" {
		cfg.DefaultPrinter = pName
	}
	if pType != "" {
		cfg.PrinterType = pType
	}
	if pAddress != "" {
		cfg.PrinterAddress = pAddress
	}

	// Extract centralized IP address shared by both Printer and Scanner
	targetHostIP := scanner.ExtractHostIP(cfg.PrinterAddress)
	_ = db.SetSetting("scanner_device", targetHostIP)

	// Initialize Google Drive API v3 Client
	ctx := context.Background()
	driveClient, err := google.NewDriveClient(ctx, cfg.GoogleCredentialsFile, cfg.GoogleAPIKey)
	if err != nil {
		log.Warn(fmt.Sprintf("Google Drive client initialized with warning: %v", err))
	}

	// Initialize Printer Manager
	printerMgr := printer.NewManager(cfg.DefaultPrinter, cfg.PrinterType, cfg.PrinterAddress)
	log.Info(fmt.Sprintf("Printer driver manager initialized (Name: %s, Type: %s, Address: %s)", cfg.DefaultPrinter, cfg.PrinterType, cfg.PrinterAddress))

	// Initialize Scanner Manager (ALWAYS centralized with Printer IP)
	scannerMgr := scanner.NewManager(targetHostIP, cfg.ScannerType)
	log.Info(fmt.Sprintf("Scanner driver manager initialized (Type: %s, Centralized Printer/Scanner IP: %s)", cfg.ScannerType, targetHostIP))

	// Start Push-Scan File Watcher (for physical scan button support)
	pushWatcher := scanner.NewPushScanWatcher(cfg.ScanWatchDir, cfg.ScanDir, db, log, broadcaster)
	go pushWatcher.Start(ctx)

	// Initialize Worker Queue Pool
	workerPool := queue.NewWorkerPool(db, driveClient, printerMgr, stg, log, cfg.MaxConcurrentJobs)
	workerPool.SetBroadcaster(broadcaster)
	workerPool.Start()
	defer workerPool.Stop()

	// Initialize HTTP API Router
	handler := api.NewHandler(cfg, db, printerMgr, scannerMgr, workerPool, stg, log)
	handler.SetBroadcaster(broadcaster)
	router := api.NewRouter(handler)

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful Shutdown Setup
	go func() {
		log.Info(fmt.Sprintf("HTTP REST API Server listening on http://0.0.0.0:%s", cfg.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error(fmt.Sprintf("HTTP server error: %v", err))
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	log.Info("Shutting down PintFlow backend server...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error(fmt.Sprintf("HTTP server forced shutdown: %v", err))
	}

	log.Info("PintFlow server stopped gracefully")
}

