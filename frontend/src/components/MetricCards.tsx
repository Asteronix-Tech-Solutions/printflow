'use client';

import React from 'react';
import { Clock, CheckCircle, AlertCircle, Database } from 'lucide-react';
import { HealthResponse } from '../lib/api';

interface MetricCardsProps {
  health?: HealthResponse;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ health }) => {
  const metrics = [
    {
      title: 'Pending Queue',
      value: health?.pending_jobs ?? 0,
      icon: Clock,
      color: 'amber',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      textColor: 'text-amber-400',
    },
    {
      title: 'Completed Jobs',
      value: health?.completed_jobs ?? 0,
      icon: CheckCircle,
      color: 'emerald',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      textColor: 'text-emerald-400',
    },
    {
      title: 'Failed Jobs',
      value: health?.failed_jobs ?? 0,
      icon: AlertCircle,
      color: 'rose',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/30',
      textColor: 'text-rose-400',
    },
    {
      title: 'Database Engine',
      value: 'PostgreSQL',
      icon: Database,
      color: 'indigo',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-500/30',
      textColor: 'text-indigo-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {metrics.map((m, idx) => {
        const IconComponent = m.icon;
        return (
          <div key={idx} className="glass-panel p-4 flex items-center justify-between border transition-all hover:border-white/20">
            <div>
              <p className="text-xs font-medium text-gray-400 mb-1">{m.title}</p>
              <h3 className="text-2xl font-extrabold text-white tracking-tight">{m.value}</h3>
            </div>
            <div className={`p-3 rounded-xl border ${m.bgColor} ${m.borderColor} ${m.textColor}`}>
              <IconComponent className="w-5 h-5" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
