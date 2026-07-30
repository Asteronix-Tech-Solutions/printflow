'use client';

import React from 'react';
import { RefreshCw, PlusCircle, Settings, CheckCircle2, AlertCircle } from 'lucide-react';
import { PrinterStatus } from '../lib/api';

interface HeaderProps {
  printer?: PrinterStatus;
  sseConnected?: boolean;
  onOpenQueueModal: () => void;
  onOpenPrinterModal: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  title?: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  printer,
  sseConnected = true,
  onOpenQueueModal,
  onOpenPrinterModal,
  onRefresh,
  isRefreshing,
  title = 'DOCUMENT PRINTING DASHBOARD',
  subtitle = 'Automated printing engine for Google Form responses',
}) => {
  return (
    <header className="glass-panel p-4 sm:p-5 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-none relative overflow-hidden">
      {/* M-Stripe Top Accent Line */}
      <div className="absolute top-0 left-0 right-0 m-stripe-line" />

      {/* Page Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-black tracking-wider uppercase">
              {title}
            </h1>
            <span
              className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-none border flex items-center gap-1.5 transition-all uppercase tracking-wider ${
                sseConnected
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  sseConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                }`}
              />
              {sseConnected ? 'LIVE SSE STREAM' : 'RECONNECTING...'}
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 font-medium">{subtitle}</p>
        </div>
      </div>

      {/* Printer Status Badge & Action Controls */}
      <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap sm:flex-nowrap">
        {/* Printer Live Status Display */}
        {printer && (
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-none border text-xs font-bold uppercase tracking-wider ${
              printer.is_online
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
            }`}
          >
            {printer.is_online ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            )}
            <span className="truncate max-w-[200px]">
              {printer.name} ({printer.is_online ? 'READY' : 'OFFLINE'})
            </span>
          </div>
        )}

        {/* Settings Button */}
        <button
          onClick={onOpenPrinterModal}
          className="btn-secondary flex items-center gap-1.5 px-3.5 py-2 rounded-none font-extrabold text-xs uppercase tracking-wider active:scale-95"
        >
          <Settings className="w-4 h-4 text-indigo-500" />
          <span className="hidden sm:inline">SETTINGS</span>
        </button>

        {/* Send / Queue New Print Job */}
        <button
          onClick={onOpenQueueModal}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-none font-extrabold text-xs tracking-wider uppercase shadow-lg transition-all active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          <span>PRINT DOCUMENT</span>
        </button>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="btn-secondary p-2 rounded-none active:scale-95"
          title="Refresh live status"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-500' : ''}`} />
        </button>
      </div>
    </header>
  );
};
