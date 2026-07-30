'use client';

import React, { useState } from 'react';
import { Activity, ShieldAlert, CheckCircle2, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { LogEntry } from '../lib/api';

interface LogViewerProps {
  logs: LogEntry[];
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getLevelBadge = (level: string) => {
    switch (level.toUpperCase()) {
      case 'INFO':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Activity</span>;
      case 'WARN':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">Notice</span>;
      case 'ERROR':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">Attention</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/30">{level}</span>;
    }
  };

  return (
    <div className="glass-panel p-5 shadow-lg">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between cursor-pointer select-none group"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
              System Activity & Print History
            </h2>
            <p className="text-[11px] text-gray-400">Live log of background actions and form print events</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold px-2.5 py-1 bg-white/5 text-gray-300 rounded-lg border border-white/10">
            {logs.length} events
          </span>
          <button className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg border border-white/10 transition-all">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-white/10 animate-in fade-in duration-200">
          <div className="bg-black/40 border border-white/10 rounded-xl p-3.5 max-h-72 overflow-y-auto font-sans text-xs space-y-2.5">
            {logs.length === 0 ? (
              <div className="text-center py-6 text-gray-500">No activity recorded yet.</div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0 hover:bg-white/[0.02] px-2 rounded-lg transition-colors"
                >
                  <span className="text-gray-500 text-[11px] shrink-0 font-mono">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <div className="shrink-0">{getLevelBadge(log.level)}</div>
                  {log.job_id && (
                    <span className="text-indigo-300 text-[10px] shrink-0 bg-indigo-500/15 px-2 py-0.5 rounded-full border border-indigo-500/30 font-medium">
                      Job #{log.job_id.slice(0, 6)}
                    </span>
                  )}
                  <span className="text-gray-300 font-medium text-xs break-all leading-normal">
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

