'use client';

import React from 'react';
import { Clock, CheckCircle2, AlertCircle, Printer, ScanLine } from 'lucide-react';
import { HealthResponse } from '../lib/api';

interface MetricCardsProps {
  health?: HealthResponse;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ health }) => {
  const isOnline = health?.printer?.is_online ?? false;
  const printerName = health?.printer?.name || 'Brother DCP-T430W';

  const metrics = [
    {
      title: 'WAITING TO PRINT',
      value: health?.pending_jobs ?? 0,
      subtext: 'IN PRINT QUEUE',
      icon: Clock,
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      textColor: 'text-amber-500',
    },
    {
      title: 'SUCCESSFULLY PRINTED',
      value: health?.completed_jobs ?? 0,
      subtext: 'PRINTED DOCUMENTS',
      icon: CheckCircle2,
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      textColor: 'text-emerald-500',
    },
    {
      title: 'NEEDS ATTENTION',
      value: health?.failed_jobs ?? 0,
      subtext: 'FAILED ATTEMPTS',
      icon: AlertCircle,
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/30',
      textColor: 'text-rose-500',
    },
    {
      title: 'ACTIVE PRINTER',
      value: isOnline ? 'ONLINE & READY' : 'OFFLINE',
      subtext: printerName,
      icon: Printer,
      bgColor: isOnline ? 'bg-indigo-500/10' : 'bg-amber-500/10',
      borderColor: isOnline ? 'border-indigo-500/30' : 'border-amber-500/30',
      textColor: isOnline ? 'text-indigo-500' : 'text-amber-500',
    },
    {
      title: 'DOCUMENTS SCANNED',
      value: (health?.completed_scans ?? 0) + (health?.pending_scans ?? 0),
      subtext: health?.scanner?.is_online ? 'SCANNER READY' : 'SCANNER OFFLINE',
      icon: ScanLine,
      bgColor: health?.scanner?.is_online ? 'bg-cyan-500/10' : 'bg-slate-500/10',
      borderColor: health?.scanner?.is_online ? 'border-cyan-500/30' : 'border-slate-500/30',
      textColor: health?.scanner?.is_online ? 'text-cyan-500' : 'text-slate-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {metrics.map((m, idx) => {
        const IconComponent = m.icon;
        return (
          <div
            key={idx}
            className="glass-panel p-4 flex items-center justify-between rounded-none transition-all hover:-translate-y-0.5 group"
          >
            <div>
              <p className="text-[11px] font-black opacity-70 mb-0.5 tracking-wider uppercase">{m.title}</p>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight truncate max-w-[160px] uppercase">
                {m.value}
              </h3>
              <p className="text-[10px] opacity-60 mt-0.5 font-bold truncate max-w-[160px] tracking-widest uppercase">
                {m.subtext}
              </p>
            </div>
            <div className={`p-3 rounded-none border ${m.bgColor} ${m.borderColor} ${m.textColor} shrink-0 group-hover:scale-105 transition-transform`}>
              <IconComponent className="w-5 h-5" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
