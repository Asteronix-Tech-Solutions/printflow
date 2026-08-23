# PintFlow 🖨️ - Automated Document Printing & Scanning Hub

A self-hosted, resilient application that serves as a centralized hub for automated printing and scanning. Designed for performance and reliability, PintFlow features a **Go** backend engine, **PostgreSQL** database, and a highly responsive **Next.js** interactive web dashboard.

---

## 🌟 Key Features

* **Automated Form Response Ingestion**: Instant HTTP webhook receiver connected to Google Apps Script triggers.
* **Google Drive API v3 Integration**: Downloads form attachments securely via official Google Drive API v3 (`drive.files.get`) using Service Accounts or API keys.
* **Smart PDF Form Templates**: Built-in HTML-to-PDF template engine that converts raw JSON form responses into beautifully structured, printable summary documents (e.g., Guest Registration Forms).
* **Pluggable Printer Engine**:
  * **Network IPP / RAW Socket 9100**: Direct printing to Wi-Fi printers like **Brother DCP-T430W**.
  * **CUPS Driver**: Native Linux `lp` print queue integration for robust queue management.
* **Network Scanner Support (SANE)**:
  * Control networked scanners directly from the web dashboard.
  * **Push-Scan Support**: Automatically detect and process files scanned via physical hardware buttons using a lightning-fast filesystem watcher.
* **Production Hardened & Resilient**: 
  * State-machine worker pool (`Pending` → `Downloading` → `Processing` → `Printing` → `Completed` / `Failed`). 
  * Crashed or interrupted jobs are automatically reset on boot.
  * Deep memory optimizations (streaming large files, `io.Copy` buffers) and strict API authentication.
* **Super Lightweight Web Dashboard (Next.js)**:
  * Visualizes printer/scanner status, live job queues, and real-time audit logs using long-polling SSE (Server-Sent Events).
  * **Manual Print/Scan Controls**: Upload local files, paste Google Drive URLs, or trigger physical scans directly from the browser.
* **Persistent Archiving**: Automatically computes SHA256 checksums and moves processed files to `/storage/archive/`.
* **Full Containerization**: Pre-configured `docker-compose.prod.yml` optimized for pure production environments.

---

## 📂 Project Structure

```text
pintflow/
├── backend/                          # Go Backend Application
│   ├── cmd/server/main.go            # Entry point & graceful shutdown
│   ├── internal/
│   │   ├── api/                      # Webhook & REST API routes (Chi)
│   │   ├── config/                   # Env loader
│   │   ├── database/                 # PostgreSQL driver & migrations
│   │   ├── google/                   # Google Drive API downloader
│   │   ├── formatter/                # HTML-to-PDF Template Engine
│   │   ├── printer/                  # IPP & CUPS printer drivers
│   │   ├── scanner/                  # SANE scanner driver & push-scan watcher
│   │   ├── queue/                    # Worker pool state machine
│   │   └── storage/                  # Temp, archive, and checksum manager
│   └── go.mod
├── frontend/                         # Super Lightweight Next.js WebApp
│   ├── src/
│   │   ├── app/                      # App Router (page.tsx, layout.tsx)
│   │   ├── components/               # Header, MetricCards, JobList, Scanner Modal
│   │   └── lib/                      # REST API fetch client & SSE hooks
│   └── package.json
├── storage/                          # Persistent storage volume
│   ├── temp/
│   ├── archive/
│   ├── logs/
│   └── scan/                         # Push-scan inbox
├── scripts/
│   └── google-apps-script.js         # Production Google Apps Script snippet
├── Dockerfile.backend                # Multi-stage Go build
├── Dockerfile.frontend               # Standalone Next.js build
└── docker-compose.prod.yml           # Hardened production orchestrator
```

---

## 🚀 Quick Start (Docker Compose)

### Option A: Standalone Copy-Paste Deployment (No Repository Clone Required)
Simply copy `docker-compose.prod.yml` into any folder on your server and run:
```bash
docker compose -f docker-compose.prod.yml up -d
```
All published production images (`ghcr.io/asteronix-tech-solutions/pintflow-backend:latest` and `ghcr.io/asteronix-tech-solutions/pintflow-frontend:latest`), PostgreSQL database settings, and storage volumes will spin up automatically!

### Option B: From Source Repository
1. Clone the repository and navigate to the project directory:
   ```bash
   git clone https://github.com/Asteronix-Tech-Solutions/printflow.git
   cd printflow
   ```

2. Start the PostgreSQL, Go Backend, and Next.js Frontend containers:
   ```bash
   docker compose -f docker-compose.prod.yml up --build -d
   ```

3. Access the services:
   * **Next.js Web Dashboard**: [http://localhost:3000](http://localhost:3000)
   * **Go REST API Health Check**: [http://localhost:8080/api/v1/health](http://localhost:8080/api/v1/health)

---

## ⚙️ Configuration

Copy `.env.example` to `.env` or set environment variables:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `API_KEY` | `pintflow_admin_secret` | Master authentication key for Dashboard/API |
| `WEBHOOK_SECRET` | `pintflow_webhook_secret` | Security secret for Google Apps Script requests |
| `DATABASE_URL` | `postgres://postgres:postgrespassword@localhost:5432/pintflow?sslmode=disable` | PostgreSQL connection URI |
| `DEFAULT_PRINTER` | `Brother_DCP_T430W` | Target printer name |
| `PRINTER_TYPE` | `cups` | Driver type: `ipp` or `cups` |
| `SCANNER_TYPE` | `sane` | Driver type for document scanning |
| `TARGET_HOST_IP` | `192.168.1.100` | IP Address of the network printer/scanner |
| `GOOGLE_CREDENTIALS_FILE` | `storage/credentials.json` | Path to Google Service Account JSON |

---

## 📋 Google Apps Script Setup

1. Open your Google Form.
2. Click the three dots (⋮) in the top-right corner → **Script editor**.
3. Copy and paste the contents of `scripts/google-apps-script.js`.
4. Update `WEBHOOK_URL` with your server address (e.g., `https://your-domain.com/api/v1/webhook`).
5. Set up a trigger:
   * **Function to run**: `onFormSubmit`
   * **Event source**: `From form`
   * **Event type**: `On form submit`
6. Save and authorize permissions.

---

## 🧪 Testing the API Manually

Queue a job manually via `curl`:
```bash
curl -X POST http://localhost:8080/api/v1/webhook \
  -H "Content-Type: application/json" \
  -H "X-API-Key: pintflow_admin_secret" \
  -d '{
    "secret": "pintflow_webhook_secret",
    "response_id": "test_resp_001",
    "user_name": "Test User",
    "filename": "sample_document.pdf",
    "copies": 1
  }'
```

---

## 🔄 CI/CD & GitHub Container Registry (GHCR) Deployment

PintFlow includes automated CI/CD GitHub Actions workflows:

1. **Automated Testing & Linting**:
   - Runs backend Go tests (`go test ./...`) and verifies server build.
   - Runs Next.js frontend type checks and builds production bundle (`npm run build`).

2. **Automated Docker Image Publishing**:
   - Automatically builds and pushes production Docker images to GitHub Container Registry (`ghcr.io`):
     - `ghcr.io/asteronix-tech-solutions/pintflow-backend:latest`
     - `ghcr.io/asteronix-tech-solutions/pintflow-frontend:latest`
