'use client';

import React, { useState, useEffect } from 'react';
import { X, Printer, Wifi, CheckCircle2, AlertCircle, Settings, RefreshCw, HelpCircle } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="glass-modal w-full max-w-lg rounded-2xl p-6 relative border border-white/10 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-white rounded-lg bg-white/5 hover:bg-white/10 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Printer Setup & Connection</h2>
            <p className="text-xs text-gray-400">Configure your target Wi-Fi or network printer</p>
          </div>
        </div>

        {/* Live Status Banner */}
        {testResult && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-medium mb-5 flex items-center justify-between shadow-sm ${
              testResult.is_online
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {testResult.is_online ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <div>
                <p className="font-bold text-xs">{testResult.name} — {testResult.is_online ? 'Ready to Print' : 'Needs Connection Check'}</p>
                <p className="text-[11px] opacity-85 mt-0.5">{testResult.status_message}</p>
              </div>
            </div>
            <span className="text-[10px] font-semibold uppercase px-2 py-1 rounded-lg bg-black/40 border border-white/10 text-gray-300 shrink-0">
              {testResult.is_online ? 'Online' : 'Offline'}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-medium">
              {success}
            </div>
          )}

          {/* Printer Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Printer Display Name</label>
            <input
              type="text"
              placeholder="e.g. Brother_DCP_T430W"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 font-medium"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Connection Type */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Connection Method</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="cups">CUPS System Driver (Recommended)</option>
                <option value="ipp font-mono">Direct Wi-Fi / IPP Network</option>
                <option value="mock">Simulation Mode (Testing)</option>
              </select>
            </div>

            {/* Printer IP Address */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Printer IP Address</label>
              <input
                type="text"
                placeholder="e.g. 192.168.1.19"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 font-mono"
                required
              />
            </div>
          </div>

          {/* Paper Size & Default Copies */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Default Paper Size</label>
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="A4">A4 (Standard Paper)</option>
                <option value="Letter">US Letter</option>
                <option value="Legal">US Legal</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Number of Copies</label>
              <input
                type="number"
                min="1"
                max="10"
                value={copies}
                onChange={(e) => setCopies(parseInt(e.target.value) || 1)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex justify-end gap-3 border-t border-white/10 mt-5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 active:scale-95"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Connecting Printer...</span>
                </>
              ) : (
                <>
                  <Settings className="w-3.5 h-3.5" />
                  <span>Save Printer Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

