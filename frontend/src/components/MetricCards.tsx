'use client';

import React from 'react';
import { Clock, CheckCircle2, AlertCircle, Printer } from 'lucide-react';
import { HealthResponse } from '../lib/api';

interface MetricCardsProps {
  health?: HealthResponse;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ health }) => {
  const isOnline = health?.printer?.is_online ?? false;
  const printerName = health?.printer?.name || 'Brother DCP-T430W';

  const metrics = [
    {
      title: 'Waiting to Print',
      value: health?.pending_jobs ?? 0,
      subtext: 'In print queue',
      icon: Clock,
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      textColor: 'text-amber-500',
    },
    {
      title: 'Successfully Printed',
      value: health?.completed_jobs ?? 0,
      subtext: 'Printed documents',
      icon: CheckCircle2,
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      textColor: 'text-emerald-500',
    },
    {
      title: 'Needs Attention',
      value: health?.failed_jobs ?? 0,
      subtext: 'Failed attempts',
      icon: AlertCircle,
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/30',
      textColor: 'text-rose-500',
    },
    {
      title: 'Active Printer',
      value: isOnline ? 'Ready & Online' : 'Printer Offline',
      subtext: printerName,
      icon: Printer,
      bgColor: isOnline ? 'bg-indigo-500/10' : 'bg-amber-500/10',
      borderColor: isOnline ? 'border-indigo-500/30' : 'border-amber-500/30',
      textColor: isOnline ? 'text-indigo-500' : 'text-amber-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {metrics.map((m, idx) => {
        const IconComponent = m.icon;
        return (
          <div
            key={idx}
            className="glass-panel p-4 flex items-center justify-between border border-slate-200 dark:border-slate-800/80 transition-all hover:-translate-y-0.5 hover:shadow-xl group"
          >
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">{m.title}</p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate max-w-[160px]">
                {m.value}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-semibold truncate max-w-[160px]">
                {m.subtext}
              </p>
            </div>
            <div className={`p-3 rounded-2xl border ${m.bgColor} ${m.borderColor} ${m.textColor} shrink-0 group-hover:scale-110 transition-transform`}>
              <IconComponent className="w-5 h-5" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
