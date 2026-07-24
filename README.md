# PintFlow 🖨️ - Automatic Google Form Printing System

Self-hosted, resilient application that automatically prints documents uploaded through Google Forms, featuring a high-performance **Go** backend engine, a **PostgreSQL** database, and a super lightweight **Next.js** interactive web dashboard.

---

## 🌟 Key Features

* **Automated Form Response Ingestion**: Instant HTTP webhook receiver connected to Google Apps Script triggers.
* **Google Drive API v3 Integration**: Downloads form attachments securely via official Google Drive API v3 (`drive.files.get`) using Service Accounts or API keys.
* **Pluggable Printer Engine**:
  * **Network IPP / RAW Socket 9100**: Direct printing to Wi-Fi printers like **Brother DCP-T430W**.
  * **CUPS Driver**: Native Linux `lp` print queue integration.
  * **Mock Printer**: Simulation driver for instant local development without physical hardware.
* **Resilient Job Queue & Crash Recovery**: State-machine worker pool (`Pending` → `Downloading` → `Processing` → `Printing` → `Completed` / `Failed`). Crashed or interrupted jobs automatically reset to `Pending` on boot.
* **Super Lightweight Web Dashboard (Next.js)**:
  * Visualizes printer status, live job queues, and real-time audit logs (<50ms initial load time).
  * **Manual Print Job Modal**: Upload local files or paste Google Drive IDs/URLs to queue print jobs manually.
  * Controls: Re-print failed jobs, cancel pending jobs.
* **Persistent Archiving**: Automatically computes SHA256 checksums and moves printed files to `/storage/archive/`.
* **Full Containerization**: Pre-configured `docker-compose.yml` with PostgreSQL 16.

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
│   │   ├── google/                   # Google Drive API v3 downloader
│   │   ├── logger/                   # Structured stdout & DB logger
│   │   ├── models/                   # Job, Document, Log structs
│   │   ├── printer/                  # IPP, CUPS, and Mock printer drivers
│   │   ├── queue/                    # Worker pool state machine
│   │   └── storage/                  # Temp, archive, and checksum manager
│   └── go.mod
├── frontend/                         # Super Lightweight Next.js WebApp
│   ├── src/
│   │   ├── app/                      # App Router (page.tsx, layout.tsx, globals.css)
│   │   ├── components/               # Header, MetricCards, JobList, QueueJobModal, LogViewer
│   │   └── lib/                      # REST API fetch client
│   ├── package.json
│   └── next.config.js
├── storage/                          # Persistent storage volume
│   ├── temp/
│   ├── archive/
│   └── logs/
├── scripts/
│   └── google-apps-script.js         # Production Google Apps Script snippet
├── Dockerfile.backend                # Multi-stage Go build
├── Dockerfile.frontend               # Standalone Next.js build
└── docker-compose.yml                # Multi-container orchestrator
```

---

## 🚀 Quick Start (Docker Compose)

1. Clone the repository and navigate to the project directory:
   ```bash
   cd pintflow
   ```

2. Start the PostgreSQL, Go Backend, and Next.js Frontend containers:
   ```bash
   docker compose up --build -d
   ```

3. Access the services:
   * **Next.js Web Dashboard**: [http://localhost:3000](http://localhost:3000)
   * **Go REST API & Webhook**: [http://localhost:8080/api/v1/health](http://localhost:8080/api/v1/health)

---

## ⚙️ Configuration

Copy `.env.example` to `.env` or set environment variables:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `8080` | Backend API port |
| `DATABASE_URL` | `postgres://postgres:postgrespassword@localhost:5432/pintflow?sslmode=disable` | PostgreSQL connection URI |
| `WEBHOOK_SECRET` | `pintflow_secret_token_123` | Security secret for Google Apps Script requests |
| `DEFAULT_PRINTER` | `Brother_DCP_T430W` | Target printer name |
| `PRINTER_TYPE` | `ipp` | Driver type: `ipp`, `cups`, or `mock` |
| `PRINTER_ADDRESS` | `192.168.1.100:9100` | Printer IP and port (e.g. Wi-Fi printer IP) |
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
  -d '{
    "secret": "pintflow_secret_token_123",
    "response_id": "test_resp_001",
    "user_name": "Test User",
    "user_email": "test@example.com",
    "file_id": "1A2B3C4D5E6F7G8H",
    "filename": "sample_document.pdf",
    "copies": 1
  }'
```

---

## 🔄 CI/CD & GitHub Container Registry (GHCR) Deployment

PintFlow includes automated CI/CD GitHub Actions workflows in `.github/workflows/ci-cd.yml`:

1. **Automated Testing & Linting**:
   - Runs backend Go tests (`go test ./...`) and verifies server build.
   - Runs Next.js frontend type checks and builds production bundle (`npm run build`).

2. **Automated Docker Image Publishing**:
   - Automatically builds and pushes production Docker images to GitHub Container Registry (`ghcr.io`):
     - `ghcr.io/<owner>/pintflow-backend:latest`
     - `ghcr.io/<owner>/pintflow-frontend:latest`

3. **Deploying pre-built GHCR images**:
   ```bash
   GH_OWNER=your-github-username docker compose -f docker-compose.prod.yml up -d
   ```

