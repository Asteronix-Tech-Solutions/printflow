'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { MainLayout } from '../../components/MainLayout';
import { Header } from '../../components/Header';
import {
  ScanLine,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  FileText,
  Image as ImageIcon,
  Monitor,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  fetchHealth,
  fetchScanJobs,
  fetchScannerStatus,
  startScan,
  getScanFileUrl,
  subscribeToEvents,
  HealthResponse,
  ScanJob,
  ScannerStatus,
} from '../../lib/api';

export default function ScanPage() {
  const [health, setHealth] = useState<HealthResponse | undefined>();
  const [scanJobs, setScanJobs] = useState<ScanJob[]>([]);
  const [scannerStatus, setScannerStatus] = useState<ScannerStatus | undefined>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);

  // Scan options
  const [resolution, setResolution] = useState(300);
  const [colorMode, setColorMode] = useState('Color');
  const [format, setFormat] = useState('pdf');
  const [paperSize, setPaperSize] = useState('A4');
  const [scanning, setScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [healthData, scanData, statusData] = await Promise.allSettled([
        fetchHealth(),
        fetchScanJobs(100),
        fetchScannerStatus(),
      ]);

      if (healthData.status === 'fulfilled') setHealth(healthData.value);
      if (scanData.status === 'fulfilled') setScanJobs(scanData.value.scan_jobs || []);
      if (statusData.status === 'fulfilled') setScannerStatus(statusData.value.status);
    } catch (err) {
      console.error('Error refreshing scan page:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const eventSource = subscribeToEvents((evtType, data) => {
      if (evtType === 'connected' || evtType === 'ping') {
        setSseConnected(true);
      } else if (evtType === 'scan_updated') {
        setSseConnected(true);
        loadData();
      } else if (evtType === 'health_updated') {
        setSseConnected(true);
        fetchHealth().then(setHealth).catch(() => {});
      }
    });

    eventSource.onerror = () => setSseConnected(false);
    return () => eventSource.close();
  }, [loadData]);

  const handleStartScan = async () => {
    setScanning(true);
    setScanError(null);
    setScanSuccess(null);

    try {
      const result = await startScan({
        resolution,
        color_mode: colorMode,
        format,
        paper_size: paperSize,
      });
      setScanSuccess(`Scan started! Job ID: ${result.scan_id.slice(0, 8)}...`);
      setTimeout(() => setScanSuccess(null), 4000);
      loadData();
    } catch (err: any) {
      setScanError(err.message || 'Failed to start scan');
    } finally {
      setScanning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scan_completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'scan_failed':
        return <AlertCircle className="w-4 h-4 text-rose-500" />;
      case 'scanning':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-amber-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scan_completed': return 'COMPLETED';
      case 'scan_failed': return 'FAILED';
      case 'scanning': return 'SCANNING';
      case 'scan_pending': return 'PENDING';
      default: return status.toUpperCase();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scan_completed': return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'scan_failed': return 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30';
      case 'scanning': return 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/30';
      default: return 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const isOnline = scannerStatus?.is_online ?? false;

  return (
    <MainLayout printer={health?.printer} onRefreshData={loadData}>
      {({ setIsQueueModalOpen, setIsPrinterModalOpen }) => (
        <>
          <Header
            printer={health?.printer}
            sseConnected={sseConnected}
            onOpenQueueModal={() => setIsQueueModalOpen(true)}
            onOpenPrinterModal={() => setIsPrinterModalOpen(true)}
            onRefresh={loadData}
            isRefreshing={isRefreshing}
            title="DOCUMENT SCANNER"
            subtitle="Scan documents directly from any connected scanner"
          />

          {/* Scanner Control + Status Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
            {/* Scan Control Panel */}
            <div className="lg:col-span-2 card-glass p-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 bg-gradient-to-br from-cyan-600 to-teal-600 text-white rounded-none shadow-lg">
                  <ScanLine className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wider">Scan Settings</h2>
                  <p className="text-[10px] text-[var(--text-subtle)] uppercase tracking-widest">Configure and start a new scan</p>
                </div>
              </div>

              {scanError && (
                <div className="p-3 mb-4 rounded-none bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{scanError}</span>
                </div>
              )}
              {scanSuccess && (
                <div className="p-3 mb-4 rounded-none bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{scanSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                {/* Resolution */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[var(--text-muted)] mb-1.5 tracking-wider">Resolution</label>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(Number(e.target.value))}
                    className="w-full theme-input rounded-none p-2 text-xs font-semibold"
                  >
                    <option value={150}>150 DPI</option>
                    <option value={300}>300 DPI</option>
                    <option value={600}>600 DPI</option>
                  </select>
                </div>

                {/* Color Mode */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[var(--text-muted)] mb-1.5 tracking-wider">Color Mode</label>
                  <select
                    value={colorMode}
                    onChange={(e) => setColorMode(e.target.value)}
                    className="w-full theme-input rounded-none p-2 text-xs font-semibold"
                  >
                    <option value="Color">Color</option>
                    <option value="Gray">Grayscale</option>
                    <option value="Lineart">Black & White</option>
                  </select>
                </div>

                {/* Format */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[var(--text-muted)] mb-1.5 tracking-wider">Output Format</label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-full theme-input rounded-none p-2 text-xs font-semibold"
                  >
                    <option value="pdf">PDF</option>
                    <option value="jpeg">JPEG</option>
                    <option value="png">PNG</option>
                  </select>
                </div>

                {/* Paper Size */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[var(--text-muted)] mb-1.5 tracking-wider">Paper Size</label>
                  <select
                    value={paperSize}
                    onChange={(e) => setPaperSize(e.target.value)}
                    className="w-full theme-input rounded-none p-2 text-xs font-semibold"
                  >
                    <option value="A4">A4</option>
                    <option value="Letter">Letter</option>
                    <option value="Legal">Legal</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleStartScan}
                disabled={scanning}
                className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-extrabold text-sm tracking-wider uppercase rounded-none shadow-lg flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {scanning ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>SCANNING...</span>
                  </>
                ) : (
                  <>
                    <ScanLine className="w-5 h-5" />
                    <span>START SCAN</span>
                  </>
                )}
              </button>
            </div>

            {/* Scanner Status Card */}
            <div className="card-glass p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 rounded-none shadow-lg ${isOnline ? 'bg-gradient-to-br from-emerald-600 to-green-600' : 'bg-gradient-to-br from-slate-600 to-slate-700'} text-white`}>
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wider">Scanner Status</h2>
                  <p className="text-[10px] text-[var(--text-subtle)] uppercase tracking-widest">Device information</p>
                </div>
              </div>

              <div className={`p-3.5 rounded-none border mb-4 ${isOnline ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-500/10 border-slate-500/30'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {isOnline ? <Wifi className="w-4 h-4 text-emerald-500" /> : <WifiOff className="w-4 h-4 text-slate-500" />}
                  <span className={`text-xs font-extrabold uppercase ${isOnline ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'}`}>
                    {isOnline ? 'ONLINE & READY' : 'OFFLINE'}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--text-muted)]">
                  {scannerStatus?.status_message || 'No scanner status available'}
                </p>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)] font-bold uppercase text-[10px]">Scanner Name</span>
                  <span className="font-semibold">{scannerStatus?.name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)] font-bold uppercase text-[10px]">Driver Type</span>
                  <span className="font-semibold">{scannerStatus?.type || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)] font-bold uppercase text-[10px]">Devices Found</span>
                  <span className="font-semibold">{scannerStatus?.devices?.length ?? 0}</span>
                </div>
              </div>

              {scannerStatus?.devices && scannerStatus.devices.length > 0 && (
                <div className="mt-4 border-t border-[var(--border-color)] pt-3">
                  <p className="text-[10px] font-bold uppercase text-[var(--text-muted)] mb-2 tracking-wider">Detected Devices</p>
                  {scannerStatus.devices.map((dev, i) => (
                    <div key={i} className="p-2 mb-1.5 rounded-none bg-[var(--bg-card)] border border-[var(--border-color)] text-[10px]">
                      <span className="font-bold">{dev.vendor} {dev.model}</span>
                      <span className="text-[var(--text-subtle)] ml-2">{dev.type}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Scan Stats */}
              <div className="mt-4 border-t border-[var(--border-color)] pt-3 grid grid-cols-2 gap-2">
                <div className="text-center p-2 bg-[var(--bg-card)] rounded-none border border-[var(--border-color)]">
                  <p className="text-lg font-black text-cyan-600 dark:text-cyan-400">{health?.completed_scans ?? 0}</p>
                  <p className="text-[9px] font-bold uppercase text-[var(--text-muted)] tracking-wider">Completed</p>
                </div>
                <div className="text-center p-2 bg-[var(--bg-card)] rounded-none border border-[var(--border-color)]">
                  <p className="text-lg font-black text-amber-600 dark:text-amber-400">{health?.pending_scans ?? 0}</p>
                  <p className="text-[9px] font-bold uppercase text-[var(--text-muted)] tracking-wider">In Progress</p>
                </div>
              </div>
            </div>
          </div>

          {/* Scan History Table */}
          <div className="card-glass">
            <div className="p-4 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-cyan-500" />
                <h2 className="text-sm font-extrabold uppercase tracking-wider">Scan History</h2>
                <span className="text-[10px] font-bold text-[var(--text-muted)] bg-[var(--bg-card)] px-2 py-0.5 rounded-none border border-[var(--border-color)]">
                  {scanJobs.length} SCANS
                </span>
              </div>
            </div>

            {scanJobs.length === 0 ? (
              <div className="p-12 text-center">
                <ScanLine className="w-12 h-12 text-[var(--text-subtle)] mx-auto mb-3 opacity-40" />
                <p className="text-sm font-bold text-[var(--text-muted)]">No scan history yet</p>
                <p className="text-xs text-[var(--text-subtle)] mt-1">Start a scan using the controls above</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] text-[10px] font-bold uppercase text-[var(--text-muted)] tracking-wider">
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Filename</th>
                      <th className="text-left p-3 hidden sm:table-cell">Format</th>
                      <th className="text-left p-3 hidden md:table-cell">Resolution</th>
                      <th className="text-left p-3 hidden md:table-cell">Size</th>
                      <th className="text-left p-3 hidden lg:table-cell">Source</th>
                      <th className="text-left p-3">Date</th>
                      <th className="text-right p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanJobs.map((job) => (
                      <tr key={job.id} className="border-b border-[var(--border-color)] hover:bg-[var(--btn-secondary-hover)] transition-colors">
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-none border text-[10px] font-bold uppercase ${getStatusColor(job.status)}`}>
                            {getStatusIcon(job.status)}
                            {getStatusLabel(job.status)}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {job.format === 'pdf' ? (
                              <FileText className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            ) : (
                              <ImageIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            )}
                            <span className="font-semibold truncate max-w-[200px]">{job.filename || '—'}</span>
                          </div>
                          {job.error_message && (
                            <p className="text-[10px] text-rose-500 mt-0.5 truncate max-w-[250px]">{job.error_message}</p>
                          )}
                        </td>
                        <td className="p-3 hidden sm:table-cell">
                          <span className="font-semibold uppercase">{job.format}</span>
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          <span className="font-semibold">{job.resolution} DPI</span>
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          <span className="font-semibold">{formatFileSize(job.file_size)}</span>
                        </td>
                        <td className="p-3 hidden lg:table-cell">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-none border text-[10px] font-bold uppercase ${
                            job.source === 'push'
                              ? 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400'
                              : 'bg-slate-500/10 border-slate-500/30 text-slate-600 dark:text-slate-400'
                          }`}>
                            {job.source === 'push' ? 'PUSH' : 'WEB'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="font-medium text-[var(--text-muted)]">
                            {formatDate(job.created_at)}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {job.status === 'scan_completed' && (
                            <a
                              href={getScanFileUrl(job.id)}
                              download
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-[10px] font-bold uppercase rounded-none shadow-md transition-all active:scale-95"
                            >
                              <Download className="w-3.5 h-3.5" />
                              DOWNLOAD
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </MainLayout>
  );
}
