'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { MainLayout } from '../../components/MainLayout';
import { Header } from '../../components/Header';
import { Pagination } from '../../components/Pagination';
import {
  fetchHealth,
  fetchLogs,
  subscribeToEvents,
  HealthResponse,
  LogEntry,
} from '../../lib/api';
import { Terminal, Play, Pause, Trash2, ShieldAlert, Info, CheckCircle2, Copy } from 'lucide-react';

export default function ActivityPage() {
  const [health, setHealth] = useState<HealthResponse | undefined>();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeLevel, setActiveLevel] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [healthData, logsData] = await Promise.allSettled([
        fetchHealth(),
        fetchLogs(300),
      ]);

      if (healthData.status === 'fulfilled') setHealth(healthData.value);
      if (logsData.status === 'fulfilled') setLogs(logsData.value.logs || []);
    } catch (err) {
      console.error('Error fetching activity logs:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const eventSource = subscribeToEvents((evtType, data) => {
      if (evtType === 'connected' || evtType === 'ping') {
        setSseConnected(true);
      } else if (evtType === 'log_added' && data) {
        setSseConnected(true);
        setLogs(prev => [data, ...prev].slice(0, 300));
      } else if (evtType === 'health_updated') {
        setSseConnected(true);
        fetchHealth().then(setHealth).catch(() => {});
      }
    });

    eventSource.onerror = () => {
      setSseConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, [loadData]);

  // Auto-scroll effect when new log arrives
  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Reset to page 1 on search or level filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeLevel]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesLevel =
        activeLevel === 'ALL' || log.level.toUpperCase() === activeLevel.toUpperCase();
      const matchesSearch =
        searchTerm === '' ||
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.job_id && log.job_id.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesLevel && matchesSearch;
    });
  }, [logs, activeLevel, searchTerm]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const handleCopyLogs = () => {
    const text = filteredLogs
      .map(
        (l) =>
          `[${new Date(l.timestamp).toISOString()}] [${l.level}] ${
            l.job_id ? `(Job #${l.job_id}) ` : ''
          }${l.message}`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'INFO':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'WARN':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'ERROR':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      default:
        return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
    }
  };

  return (
    <MainLayout printer={health?.printer} onRefreshData={loadData}>
      {({ setIsQueueModalOpen, setIsPrinterModalOpen }) => (
        <>
          <Header
            printer={health?.printer}
            sseConnected={sseConnected}
            onOpenQueueModal={() => setIsQueueModalOpen(true)}
            onOpenPrinterModal={() => setIsPrinterModalOpen(true)}
            onRefresh={loadData}
            isRefreshing={isRefreshing}
            title="SYSTEM ACTIVITY & LOG CONSOLE"
            subtitle="Real-time terminal output stream for PrintFlow engine"
          />

          {/* Terminal Console Window Container */}
          <div className="terminal-window rounded-none border border-slate-800 shadow-2xl overflow-hidden mb-6">
            {/* Terminal Window Title Bar */}
            <div className="terminal-header px-4 py-3 flex flex-wrap items-center justify-between gap-3 select-none">
              {/* Window Controls */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 mr-3">
                  <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
                  <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
                  <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs text-slate-300">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-slate-200">printflow@server:~/logs</span>
                  <span className="text-slate-500">$ tail -f stdout.log</span>
                </div>
              </div>

              {/* Terminal Actions Bar */}
              <div className="flex items-center gap-2 font-mono text-xs">
                <button
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`px-2.5 py-1 rounded-none border text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                    autoScroll
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                  title="Toggle Auto-scroll stream"
                >
                  {autoScroll ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span>{autoScroll ? 'AUTO-SCROLL ON' : 'AUTO-SCROLL OFF'}</span>
                </button>

                <button
                  onClick={handleCopyLogs}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-none border border-slate-700 text-[11px] font-bold flex items-center gap-1.5 transition-all"
                  title="Copy current console output"
                >
                  {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'COPIED' : 'COPY LOGS'}</span>
                </button>

                <button
                  onClick={() => setLogs([])}
                  className="px-2 py-1 bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-rose-300 rounded-none border border-slate-700 text-[11px] font-bold transition-all"
                  title="Clear console view"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Terminal Command Filter Bar */}
            <div className="p-3 bg-[#070b14] border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs">
              {/* Grep search prompt */}
              <div className="relative w-full sm:w-80">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 select-none">
                  grep -i
                </span>
                <input
                  type="text"
                  placeholder='"keyword or job ID"'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#03060d] border border-slate-800 rounded-none pl-20 pr-3 py-1.5 text-xs text-emerald-400 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              {/* Terminal Level Filters */}
              <div className="flex items-center gap-1 bg-[#03060d] p-1 border border-slate-800 w-full sm:w-auto">
                <span className="text-[10px] text-slate-500 px-2 uppercase font-bold select-none">FILTER:</span>
                {['ALL', 'INFO', 'WARN', 'ERROR'].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setActiveLevel(lvl)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-none transition-all uppercase ${
                      activeLevel === lvl
                        ? 'bg-emerald-600 text-black shadow-md font-extrabold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Console Text Terminal Output */}
            <div className="p-4 bg-[#02040a] font-mono text-xs space-y-1.5 max-h-[550px] overflow-y-auto select-text">
              {paginatedLogs.length === 0 ? (
                <div className="py-16 text-center text-slate-600 font-mono">
                  <p className="text-sm">[SYSTEM] No activity log events matching current terminal filter.</p>
                  <p className="text-xs text-slate-700 mt-1">Waiting for incoming SSE broadcast events...</p>
                </div>
              ) : (
                paginatedLogs.map((log, index) => {
                  const lineNum = String((currentPage - 1) * pageSize + index + 1).padStart(3, '0');
                  const levelStyle = getLevelColor(log.level);
                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-2 py-1 px-1 hover:bg-slate-900/60 rounded-none transition-colors border-l-2 border-transparent hover:border-emerald-500 group"
                    >
                      {/* Line Number */}
                      <span className="text-slate-600 select-none text-[11px] shrink-0 w-8 font-mono">
                        {lineNum}
                      </span>

                      {/* Timestamp */}
                      <span className="text-slate-500 text-[11px] shrink-0 font-mono">
                        [{new Date(log.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}]
                      </span>

                      {/* Level Pill */}
                      <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-none border uppercase tracking-wider shrink-0 ${levelStyle}`}>
                        {log.level}
                      </span>

                      {/* Job Reference Token */}
                      {log.job_id && (
                        <span className="text-purple-400 text-[10px] bg-purple-950/60 px-2 py-0.5 rounded-none border border-purple-800/60 shrink-0">
                          job#{log.job_id.slice(0, 8)}
                        </span>
                      )}

                      {/* Message Body */}
                      <span className="text-slate-200 break-all font-mono leading-relaxed">
                        {log.message}
                      </span>
                    </div>
                  );
                })
              )}

              {/* Terminal Blinking Cursor Prompt */}
              <div className="pt-3 flex items-center gap-2 text-slate-500 font-mono text-xs select-none">
                <span className="text-emerald-400 font-bold">printflow@server:~$</span>
                <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse" />
                <span className="text-slate-600 text-[11px]">Live log stream active ({filteredLogs.length} events logged)</span>
              </div>

              <div ref={consoleEndRef} />
            </div>
          </div>

          {/* Console Pagination */}
          <div className="bg-slate-900/40 p-4 border border-slate-800 rounded-none">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filteredLogs.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              pageSizeOptions={[15, 25, 50, 100]}
            />
          </div>
        </>
      )}
    </MainLayout>
  );
}
