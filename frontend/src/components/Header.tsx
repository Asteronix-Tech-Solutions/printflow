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
  title = 'Print Submissions Dashboard',
  subtitle = 'Automated printing engine for Google Form responses',
}) => {
  return (
    <header className="glass-panel p-4 sm:p-5 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-slate-200 dark:border-slate-800 shadow-lg">
      {/* Page Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {title}
            </h1>
            <span
              className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border flex items-center gap-1.5 transition-all ${
                sseConnected
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  sseConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                }`}
              />
              {sseConnected ? 'Live SSE Sync' : 'Reconnecting...'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
        </div>
      </div>

      {/* Printer Status Badge & Action Controls */}
      <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap sm:flex-nowrap">
        {/* Printer Live Status Display */}
        {printer && (
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-sm ${
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
              {printer.name} ({printer.is_online ? 'Ready' : 'Offline'})
            </span>
          </div>
        )}

        {/* Settings Button */}
        <button
          onClick={onOpenPrinterModal}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-semibold text-xs border border-slate-200 dark:border-slate-700 transition-all active:scale-95"
        >
          <Settings className="w-4 h-4 text-indigo-500" />
          <span className="hidden sm:inline">Settings</span>
        </button>

        {/* Send / Queue New Print Job */}
        <button
          onClick={onOpenQueueModal}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-semibold text-xs shadow-lg shadow-indigo-600/25 transition-all active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Print Document</span>
        </button>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 transition-all active:scale-95"
          title="Refresh live status"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-500' : ''}`} />
        </button>
      </div>
    </header>
  );
};
