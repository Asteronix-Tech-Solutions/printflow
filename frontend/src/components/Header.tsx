'use client';

import React from 'react';
import { Printer, RefreshCw, PlusCircle, Wifi, WifiOff, Settings, Sparkles } from 'lucide-react';
import { PrinterStatus } from '../lib/api';

interface HeaderProps {
  printer?: PrinterStatus;
  onOpenQueueModal: () => void;
  onOpenPrinterModal: () => void;
  onOpenTemplateModal: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  printer,
  onOpenQueueModal,
  onOpenPrinterModal,
  onOpenTemplateModal,
  onRefresh,
  isRefreshing,
}) => {
  return (
    <header className="glass-panel p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-white/10">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
          <Printer className="w-7 h-7 animate-pulse-slow" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-wide text-white">PintFlow</h1>
            <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
              v1.1
            </span>
          </div>
          <p className="text-xs text-gray-400">Automatic Google Form Printing Engine</p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap sm:flex-nowrap">
        {/* Printer Live Status Pill & Connect Action */}
        {printer && (
          <button
            onClick={onOpenPrinterModal}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all hover:scale-105 active:scale-95 ${
              printer.is_online
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
            }`}
            title="Click to Connect or Configure Printer"
          >
            {printer.is_online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{printer.name} ({printer.is_online ? 'Online' : 'Offline'})</span>
            <Settings className="w-3 h-3 opacity-60 ml-1" />
          </button>
        )}

        {/* Visual Formatter & Templates Button */}
        <button
          onClick={onOpenTemplateModal}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded-xl font-semibold text-xs border border-indigo-500/30 transition-all active:scale-95 shadow-md shadow-indigo-500/5"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Visual Formatter</span>
        </button>

        {/* Connect Printer Button */}
        <button
          onClick={onOpenPrinterModal}
          className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-200 rounded-xl font-medium text-xs border border-white/10 transition-all active:scale-95"
        >
          <Settings className="w-4 h-4 text-indigo-400" />
          <span>Printer Config</span>
        </button>

        {/* Manual Queue Job Button */}
        <button
          onClick={onOpenQueueModal}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-xs shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Queue Print Job</span>
        </button>

        {/* Manual Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl border border-white/10 transition-all active:scale-95"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
        </button>
      </div>
    </header>
  );
};
