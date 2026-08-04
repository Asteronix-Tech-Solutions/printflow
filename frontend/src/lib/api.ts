export const API_BASE_URL = typeof window !== 'undefined'
  ? '/api/v1'
  : (process.env.INTERNAL_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://pintflow_backend:8080/api/v1');

export const API_KEY = process.env.NEXT_PUBLIC_API_KEY || process.env.API_KEY || '';

function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  let key = API_KEY;
  if (typeof window !== 'undefined') {
    const localKey = localStorage.getItem('pintflow_api_key');
    if (localKey) key = localKey;
  }
  if (key) {
    headers['X-API-Key'] = key;
  }
  return headers;
}

export interface FormQuestionAnswer {
  question: string;
  answer: string;
}

export interface Job {
  id: string;
  status: 'pending' | 'downloading' | 'downloaded' | 'processing' | 'ready' | 'printing' | 'completed' | 'failed' | 'cancelled';
  google_response_id?: string;
  google_file_id?: string;
  user_name?: string;
  user_email?: string;
  filename: string;
  printer: string;
  copies: number;
  form_title?: string;
  form_responses?: FormQuestionAnswer[];
  template_id?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface PrinterStatus {
  name: string;
  type: string;
  address: string;
  is_online: boolean;
  status_message: string;
  checked_at: string;
}

export interface PrinterConfig {
  name: string;
  type: string;
  address: string;
  paper_size?: string;
  copies?: number;
}

export interface HealthResponse {
  status: string;
  database: string;
  printer: PrinterStatus;
  scanner: ScannerStatus;
  pending_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  pending_scans: number;
  completed_scans: number;
}

export interface ScanJob {
  id: string;
  status: 'scan_pending' | 'scanning' | 'scan_completed' | 'scan_failed';
  scanner_name: string;
  resolution: number;
  color_mode: string;
  format: string;
  paper_size: string;
  filename: string;
  file_size: number;
  user_name?: string;
  source: 'web' | 'push';
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export interface ScanRequest {
  resolution?: number;
  color_mode?: string;
  format?: string;
  paper_size?: string;
  device_name?: string;
  user_name?: string;
}

export interface ScannerDevice {
  device_name: string;
  vendor: string;
  model: string;
  type: string;
}

export interface ScannerStatus {
  name: string;
  type: string;
  is_online: boolean;
  status_message: string;
  devices: ScannerDevice[];
  checked_at: string;
}

export interface LogEntry {
  id: number;
  job_id?: string;
  level: string;
  message: string;
  timestamp: string;
}

export interface ManualQueuePayload {
  user_name: string;
  user_email: string;
  file_id?: string;
  filename: string;
  printer?: string;
  copies?: number;
  file_data?: string; // Base64
  form_title?: string;
  form_responses?: FormQuestionAnswer[];
  template_id?: string;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE_URL}/health`, { headers: getAuthHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch health status');
  return res.json();
}

export async function fetchJobs(status?: string, limit = 50, offset = 0): Promise<{ jobs: Job[]; count: number }> {
  const query = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
  if (status && status !== 'all') query.append('status', status);

  const res = await fetch(`${API_BASE_URL}/jobs?${query.toString()}`, { headers: getAuthHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch jobs');
  return res.json();
}

export async function fetchPrinterConfig(): Promise<{ status: PrinterStatus; config: PrinterConfig }> {
  const res = await fetch(`${API_BASE_URL}/printer/status`, { headers: getAuthHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch printer config');
  return res.json();
}

export async function updatePrinterConfig(config: PrinterConfig): Promise<{ success: boolean; status: PrinterStatus; config: PrinterConfig }> {
  const res = await fetch(`${API_BASE_URL}/printer/config`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to update printer config');
  }
  return res.json();
}

export async function manualQueueJob(payload: ManualQueuePayload): Promise<{ success: boolean; job_id: string; message: string }> {
  const res = await fetch(`${API_BASE_URL}/jobs`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to queue job');
  }
  return res.json();
}

export async function retryJob(jobId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/retry`, { method: 'POST', headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to retry job');
  return res.json();
}

export async function cancelJob(jobId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/cancel`, { method: 'POST', headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to cancel job');
  return res.json();
}

export async function fetchLogs(limit = 100): Promise<{ logs: LogEntry[]; count: number }> {
  const res = await fetch(`${API_BASE_URL}/logs?limit=${limit}`, { headers: getAuthHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch logs');
  return res.json();
}

export function getJobPDFUrl(jobId: string): string {
  const url = `${API_BASE_URL}/jobs/${jobId}/pdf`;
  if (API_KEY) {
    return `${url}?api_key=${encodeURIComponent(API_KEY)}`;
  }
  return url;
}

export function subscribeToEvents(onEvent: (type: string, data: any) => void): EventSource {
  let key = API_KEY;
  if (typeof window !== 'undefined') {
    const localKey = localStorage.getItem('pintflow_api_key');
    if (localKey) key = localKey;
  }

  const url = key 
    ? `${API_BASE_URL}/events?api_key=${encodeURIComponent(key)}`
    : `${API_BASE_URL}/events`;

  const es = new EventSource(url);

  const eventTypes = ['connected', 'ping', 'job_updated', 'log_added', 'health_updated', 'scan_updated'];
  eventTypes.forEach(evt => {
    es.addEventListener(evt, (e: MessageEvent) => {
      try {
        const data = e.data ? JSON.parse(e.data) : null;
        onEvent(evt, data);
      } catch (err) {
        console.error('Error parsing SSE event data:', err);
      }
    });
  });

  return es;
}

// ===== Scanner API Functions =====

export async function startScan(req: ScanRequest): Promise<{ success: boolean; scan_id: string; message: string }> {
  const res = await fetch(`${API_BASE_URL}/scan`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to start scan');
  }
  return res.json();
}

export async function fetchScanJobs(limit = 50, offset = 0): Promise<{ scan_jobs: ScanJob[]; count: number }> {
  const query = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
  const res = await fetch(`${API_BASE_URL}/scan/jobs?${query.toString()}`, { headers: getAuthHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch scan jobs');
  return res.json();
}

export async function fetchScanJob(id: string): Promise<ScanJob> {
  const res = await fetch(`${API_BASE_URL}/scan/jobs/${id}`, { headers: getAuthHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch scan job');
  return res.json();
}

export function getScanFileUrl(scanId: string): string {
  const url = `${API_BASE_URL}/scan/jobs/${scanId}/file`;
  let key = API_KEY;
  if (typeof window !== 'undefined') {
    const localKey = localStorage.getItem('pintflow_api_key');
    if (localKey) key = localKey;
  }
  if (key) {
    return `${url}?api_key=${encodeURIComponent(key)}`;
  }
  return url;
}

export async function fetchScannerStatus(): Promise<{ status: ScannerStatus }> {
  const res = await fetch(`${API_BASE_URL}/scanner/status`, { headers: getAuthHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch scanner status');
  return res.json();
}
