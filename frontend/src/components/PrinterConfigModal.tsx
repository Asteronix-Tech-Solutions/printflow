'use client';

import React, { useState, useEffect } from 'react';
import { X, Printer, Wifi, CheckCircle2, AlertCircle, Settings } from 'lucide-react';
import { updatePrinterConfig, fetchPrinterConfig, PrinterStatus } from '../lib/api';

interface PrinterConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

export const PrinterConfigModal: React.FC<PrinterConfigModalProps> = ({ isOpen, onClose, onConfigSaved }) => {
  const [name, setName] = useState('Brother_DCP_T430W');
  const [type, setType] = useState('cups');
  const [address, setAddress] = useState('192.168.1.19');
  const [paperSize, setPaperSize] = useState('A4');
  const [copies, setCopies] = useState(1);

  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<PrinterStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPrinterConfig()
        .then((data) => {
          if (data.config) {
            setName(data.config.name || 'Brother_DCP_T430W');
            setType(data.config.type || 'cups');
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
      <div className="glass-modal w-full max-w-lg rounded-2xl p-6 relative border border-slate-200 dark:border-slate-800 shadow-2xl text-slate-900 dark:text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-2xl border border-indigo-500/20">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">Printer Setup & Connection</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Configure your target Wi-Fi or network printer</p>
          </div>
        </div>

        {/* Live Status Banner */}
        {testResult && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-semibold mb-5 flex items-center justify-between shadow-sm ${
              testResult.is_online
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-300'
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
                  {testResult.name} - {testResult.is_online ? 'Connected & Ready' : 'Printer Offline'}
                </p>
                <p className="text-[11px] opacity-80">{testResult.status_message}</p>
              </div>
            </div>
            <span className="text-[10px] opacity-70 font-mono">
              {testResult.address}
            </span>
          </div>
        )}

        {error && (
          <div className="p-3.5 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3.5 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
              Printer Name / Queue Identifier
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                Driver / Protocol
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              >
                <option value="cups">CUPS Print System</option>
                <option value="ipp">IPP (Internet Printing Protocol)</option>
                <option value="lpd">LPD / Line Printer Daemon</option>
                <option value="raw">Raw Socket (Port 9100)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                IP Address / Host
              </label>
              <div className="relative">
                <Wifi className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold font-mono"
                  placeholder="192.168.1.19"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                Paper Size
              </label>
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              >
                <option value="A4">A4 (210 x 297 mm)</option>
                <option value="Letter">Letter (8.5 x 11 in)</option>
                <option value="Legal">Legal (8.5 x 14 in)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                Default Copies
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={copies}
                onChange={(e) => setCopies(parseInt(e.target.value) || 1)}
                className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-xs transition-all"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Testing Connection...' : 'Save & Test Connection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
