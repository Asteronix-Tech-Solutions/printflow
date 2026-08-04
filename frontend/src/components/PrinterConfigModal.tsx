'use client';

import React, { useState, useEffect } from 'react';
import { X, Printer, Wifi, CheckCircle2, AlertCircle, RefreshCw, Radar, Zap } from 'lucide-react';
import { updatePrinterConfig, fetchPrinterConfig, discoverPrinters, PrinterStatus, DiscoveredPrinter } from '../lib/api';

interface PrinterConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

export const PrinterConfigModal: React.FC<PrinterConfigModalProps> = ({ isOpen, onClose, onConfigSaved }) => {
  const [name, setName] = useState('Brother_DCP_T430W');
  const [type, setType] = useState('raw');
  const [address, setAddress] = useState('192.168.1.19');
  const [paperSize, setPaperSize] = useState('A4');
  const [copies, setCopies] = useState(1);

  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discoveredList, setDiscoveredList] = useState<DiscoveredPrinter[]>([]);
  const [testResult, setTestResult] = useState<PrinterStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPrinterConfig()
        .then((data) => {
          if (data.config) {
            setName(data.config.name || 'Brother_DCP_T430W');
            setType(data.config.type || 'raw');
            setAddress(data.config.address || '192.168.1.19');
            setPaperSize(data.config.paper_size || 'A4');
            setCopies(data.config.copies || 1);
          }
          if (data.status) {
            setTestResult(data.status);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleScanNetwork = async () => {
    setDiscovering(true);
    setError(null);
    try {
      const res = await discoverPrinters();
      setDiscoveredList(res.discovered || []);
      if (!res.discovered || res.discovered.length === 0) {
        setSuccess('Scan complete: No new printers found on subnet.');
      } else {
        setSuccess(`Discovered ${res.discovered.length} active printer(s) on your network!`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to scan network for printers.');
    } finally {
      setDiscovering(false);
    }
  };

  const handleSelectDiscovered = (p: DiscoveredPrinter) => {
    setAddress(p.ip);
    setName(p.name);
    if (p.port === '9100') {
      setType('raw');
    } else if (p.port === '631') {
      setType('ipp');
    } else if (p.port === '515') {
      setType('lpd');
    }
    setSuccess(`Selected ${p.name} (${p.ip}:${p.port}). Click 'Save & Test Connection' below to activate.`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await updatePrinterConfig({
        name,
        type,
        address,
        paper_size: paperSize,
        copies: Number(copies),
      });

      setTestResult(res.status);
      setSuccess('Printer settings updated and connected successfully!');
      setTimeout(() => {
        onConfigSaved();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to printer. Please check the IP address.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
      <div className="glass-modal w-full max-w-xl rounded-none p-6 relative shadow-2xl overflow-y-auto max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[var(--text-subtle)] hover:text-[var(--text-main)] rounded-none hover:bg-[var(--btn-secondary-hover)] transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-none border border-indigo-500/20">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold uppercase tracking-wider">Printer Setup & Fast Connection</h2>
              <p className="text-xs text-[var(--text-muted)]">Configure Wi-Fi, LAN, or local CUPS printers</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleScanNetwork}
            disabled={discovering}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 rounded-none text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 shrink-0"
          >
            {discovering ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Radar className="w-3.5 h-3.5" />
            )}
            <span>{discovering ? 'Scanning Network...' : 'Auto-Scan LAN'}</span>
          </button>
        </div>

        {/* Discovered Printers Bar */}
        {discoveredList.length > 0 && (
          <div className="mb-5 p-3.5 bg-indigo-500/5 border border-indigo-500/20 rounded-none">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                <span>Discovered Printers ({discoveredList.length})</span>
              </span>
              <span className="text-[10px] text-[var(--text-subtle)]">Click to select</span>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {discoveredList.map((dp, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectDiscovered(dp)}
                  className="p-2 bg-[var(--card-bg)] hover:bg-indigo-500/10 border border-[var(--border-color)] hover:border-indigo-500/40 rounded-none cursor-pointer flex items-center justify-between text-xs transition-all"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <div>
                      <p className="font-bold text-[var(--text-main)]">{dp.name}</p>
                      <p className="text-[10px] text-[var(--text-subtle)]">{dp.protocol} - Port {dp.port}</p>
                    </div>
                  </div>
                  <span className="font-mono text-[11px] px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-bold border border-indigo-500/20">
                    {dp.ip}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Status Banner */}
        {testResult && (
          <div
            className={`p-3.5 rounded-none border text-xs font-semibold mb-5 flex items-center justify-between shadow-sm uppercase ${
              testResult.is_online
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {testResult.is_online ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              )}
              <div>
                <p className="font-bold">
                  {testResult.name} - {testResult.is_online ? 'Connected & Fast Ready' : 'Printer Offline'}
                </p>
                <p className="text-[11px] opacity-80">{testResult.status_message}</p>
                {testResult.protocol && (
                  <p className="text-[10px] opacity-70 normal-case mt-0.5">
                    Protocol: <span className="font-bold">{testResult.protocol}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[var(--text-subtle)] font-mono block">
                {testResult.resolved_port || testResult.address}
              </span>
              {testResult.state_reasons && testResult.state_reasons.length > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 uppercase font-bold rounded-none">
                  {testResult.state_reasons[0]}
                </span>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3.5 mb-4 rounded-none bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3.5 mb-4 rounded-none bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
          <div>
            <label className="block font-bold mb-1.5 uppercase text-[var(--text-muted)]">
              Printer Name / Queue Identifier
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full theme-input rounded-none p-2.5 font-semibold"
              placeholder="e.g. Brother_DCP_T430W"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1.5 uppercase text-[var(--text-muted)]">
                Driver / Protocol
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full theme-input rounded-none p-2.5 font-semibold"
              >
                <option value="raw">Raw Socket (Port 9100 - Fastest)</option>
                <option value="ipp">IPP (Internet Printing Protocol - Port 631)</option>
                <option value="lpd">LPD / Line Printer Daemon (Port 515)</option>
                <option value="cups">CUPS Print System (Local/Network)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold mb-1.5 uppercase text-[var(--text-muted)]">
                IP Address / Target Host
              </label>
              <div className="relative">
                <Wifi className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full theme-input rounded-none pl-9 pr-3 py-2.5 font-semibold font-mono"
                  placeholder="192.168.1.19"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1.5 uppercase text-[var(--text-muted)]">
                Paper Size
              </label>
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value)}
                className="w-full theme-input rounded-none p-2.5 font-semibold"
              >
                <option value="A4">A4 (210 x 297 mm)</option>
                <option value="Letter">Letter (8.5 x 11 in)</option>
                <option value="Legal">Legal (8.5 x 14 in)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold mb-1.5 uppercase text-[var(--text-muted)]">
                Default Copies
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={copies}
                onChange={(e) => setCopies(parseInt(e.target.value) || 1)}
                className="w-full theme-input rounded-none p-2.5 font-bold"
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-[var(--border-color)]">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary px-4 py-2 rounded-none font-bold text-xs uppercase tracking-wider"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-none font-bold text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Testing Connection...' : 'Save & Test Connection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
