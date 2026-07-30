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
      textColor: 'text-amber-400',
    },
    {
      title: 'Successfully Printed',
      value: health?.completed_jobs ?? 0,
      subtext: 'Printed documents',
      icon: CheckCircle2,
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      textColor: 'text-emerald-400',
    },
    {
      title: 'Needs Attention',
      value: health?.failed_jobs ?? 0,
      subtext: 'Failed attempts',
      icon: AlertCircle,
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/30',
      textColor: 'text-rose-400',
    },
    {
      title: 'Active Printer',
      value: isOnline ? 'Ready & Connected' : 'Check Printer',
      subtext: printerName,
      icon: Printer,
      bgColor: isOnline ? 'bg-indigo-500/10' : 'bg-amber-500/10',
      borderColor: isOnline ? 'border-indigo-500/30' : 'border-amber-500/30',
      textColor: isOnline ? 'text-indigo-400' : 'text-amber-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {metrics.map((m, idx) => {
        const IconComponent = m.icon;
        return (
          <div key={idx} className="glass-panel p-4 flex items-center justify-between border transition-all hover:border-white/20 shadow-md">
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-0.5">{m.title}</p>
              <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight truncate max-w-[150px]">
                {m.value}
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5 font-medium truncate max-w-[150px]">
                {m.subtext}
              </p>
            </div>
            <div className={`p-3 rounded-2xl border ${m.bgColor} ${m.borderColor} ${m.textColor} shrink-0`}>
              <IconComponent className="w-5 h-5" />
            </div>
          </div>
        );
      })}
    </div>
  );
};

