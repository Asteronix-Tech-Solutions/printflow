'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { Header } from '../../components/Header';
import { QueueJobModal } from '../../components/QueueJobModal';
import { PrinterConfigModal } from '../../components/PrinterConfigModal';
import { Pagination } from '../../components/Pagination';
import {
  fetchHealth,
  fetchLogs,
  subscribeToEvents,
  HealthResponse,
  LogEntry,
} from '../../lib/api';
import { Activity, Search, RefreshCw, Filter, Clock, ShieldAlert, CheckCircle2, Info } from 'lucide-react';

export default function ActivityPage() {
  const [health, setHealth] = useState<HealthResponse | undefined>();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeLevel, setActiveLevel] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [healthData, logsData] = await Promise.allSettled([
        fetchHealth(),
        fetchLogs(200), // Fetch up to 200 activity entries
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
        setLogs(prev => [data, ...prev].slice(0, 200));
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

  const getLevelBadge = (level: string) => {
    switch (level.toUpperCase()) {
      case 'INFO':
        return (
          <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit">
            <Info className="w-3 h-3" />
            <span>INFO</span>
          </span>
        );
      case 'WARN':
        return (
          <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1 w-fit">
            <ShieldAlert className="w-3 h-3" />
            <span>WARN</span>
          </span>
        );
      case 'ERROR':
        return (
          <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1 w-fit">
            <ShieldAlert className="w-3 h-3" />
            <span>ERROR</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/30 uppercase">
            {level}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Sidebar Component */}
      <Sidebar
        printer={health?.printer}
        onOpenPrinterModal={() => setIsPrinterModalOpen(true)}
        onOpenQueueModal={() => setIsQueueModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
        <Header
          printer={health?.printer}
          sseConnected={sseConnected}
          onOpenQueueModal={() => setIsQueueModalOpen(true)}
          onOpenPrinterModal={() => setIsPrinterModalOpen(true)}
          onRefresh={loadData}
          isRefreshing={isRefreshing}
          title="System Activity & Live Logs"
          subtitle="Real-time event stream and background print diagnostics"
        />

        {/* Logs Console Container */}
        <div className="glass-panel p-5 shadow-xl border border-slate-200 dark:border-slate-800">
          {/* Header Controls */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-500" />
                <span>Live Activity Feed</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Monitoring system events, webhooks, and worker tasks
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search logs by message or job ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                />
              </div>

              {/* Level Filter Tabs */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto w-full sm:w-auto">
                {['ALL', 'INFO', 'WARN', 'ERROR'].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setActiveLevel(lvl)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      activeLevel === lvl
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Activity Logs Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-extrabold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3.5 w-32">Timestamp</th>
                  <th className="py-3 px-3.5 w-24">Level</th>
                  <th className="py-3 px-3.5 w-32">Job Reference</th>
                  <th className="py-3 px-3.5">Log Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60 font-semibold">
                {paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Activity className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          No matching activity logs recorded
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-3.5 text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString([], {
                          month: 'short',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-3.5">{getLevelBadge(log.level)}</td>
                      <td className="py-3 px-3.5">
                        {log.job_id ? (
                          <span className="text-indigo-600 dark:text-indigo-400 text-[10px] bg-indigo-500/15 px-2 py-0.5 rounded-full border border-indigo-500/30 font-bold font-mono">
                            #{log.job_id.slice(0, 8)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-slate-900 dark:text-slate-200 font-medium text-xs break-words">
                        {log.message}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Proper Pagination */}
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
            pageSizeOptions={[15, 30, 50, 100]}
          />
        </div>
      </main>

      {/* Modals */}
      <QueueJobModal
        isOpen={isQueueModalOpen}
        onClose={() => setIsQueueModalOpen(false)}
        onJobQueued={loadData}
      />

      <PrinterConfigModal
        isOpen={isPrinterModalOpen}
        onClose={() => setIsPrinterModalOpen(false)}
        onConfigSaved={loadData}
      />
    </div>
  );
}
