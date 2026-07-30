'use client';

import React from 'react';
import { Printer, RefreshCw, PlusCircle, Settings, CheckCircle2, AlertCircle } from 'lucide-react';
import { PrinterStatus } from '../lib/api';

interface HeaderProps {
  printer?: PrinterStatus;
  sseConnected?: boolean;
  onOpenQueueModal: () => void;
  onOpenPrinterModal: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  printer,
  sseConnected = true,
  onOpenQueueModal,
  onOpenPrinterModal,
  onRefresh,
  isRefreshing,
}) => {
  return (
    <header className="glass-panel p-4 sm:p-5 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 border-b border-white/10 shadow-xl">
      {/* Brand & Identity */}
      <div className="flex items-center gap-3.5 w-full md:w-auto">
        <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl shadow-lg shadow-indigo-500/25 flex items-center justify-center">
          <Printer className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-tight text-white">PintFlow</h1>
            <span
              className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full border flex items-center gap-1.5 transition-all ${
                sseConnected
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  sseConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                }`}
              ></span>
              {sseConnected ? 'Real-time Live' : 'Connecting...'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Automatic Google Form Document Printing</p>
        </div>
      </div>

      {/* Printer Status Badge & Action Controls */}
      <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap sm:flex-nowrap">
        {/* Printer Live Status Display */}
        {printer && (
          <div
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold shadow-sm ${
              printer.is_online
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            }`}
          >
            {printer.is_online ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span className="truncate max-w-[220px]">
              {printer.name} ({printer.is_online ? 'Ready' : 'Offline'}) - {printer.address || printer.type}
            </span>
          </div>
        )}

        {/* Single Settings Button */}
        <button
          onClick={onOpenPrinterModal}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white/5 hover:bg-white/10 text-gray-200 rounded-xl font-semibold text-xs border border-white/10 transition-all active:scale-95"
        >
          <Settings className="w-4 h-4 text-indigo-400" />
          <span>Settings</span>
        </button>

        {/* Send / Queue New Print Job */}
        <button
          onClick={onOpenQueueModal}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Print New Document</span>
        </button>

        {/* Refresh Status */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl border border-white/10 transition-all active:scale-95"
          title="Refresh live status"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
        </button>
      </div>
    </header>
  );
};


