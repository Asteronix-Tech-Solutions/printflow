'use client';

import React from 'react';
import { Terminal, ShieldAlert, Info, AlertTriangle } from 'lucide-react';
import { LogEntry } from '../lib/api';

interface LogViewerProps {
  logs: LogEntry[];
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
  const getLevelBadge = (level: string) => {
    switch (level.toUpperCase()) {
      case 'INFO':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">INFO</span>;
      case 'WARN':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">WARN</span>;
      case 'ERROR':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">ERROR</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-gray-500/10 text-gray-400 border border-gray-500/30">{level}</span>;
    }
  };

  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Terminal className="w-4 h-4 text-indigo-400" />
          <span>System Audit Trail & Worker Logs</span>
        </h2>
        <span className="text-[11px] text-gray-400">{logs.length} entries</span>
      </div>

      <div className="bg-black/40 border border-white/10 rounded-xl p-3 h-64 overflow-y-auto font-mono text-xs space-y-2">
        {logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No log entries available yet.</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 py-1 border-b border-white/5 last:border-0 hover:bg-white/[0.02] px-1 rounded transition-colors">
              <span className="text-gray-500 text-[10px] shrink-0">
                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <div className="shrink-0">{getLevelBadge(log.level)}</div>
              {log.job_id && (
                <span className="text-indigo-400 text-[10px] shrink-0 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                  Job {log.job_id.slice(0, 8)}
                </span>
              )}
              <span className="text-gray-300 break-all leading-relaxed">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
