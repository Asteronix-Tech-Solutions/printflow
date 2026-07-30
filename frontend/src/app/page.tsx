'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Header } from '../components/Header';
import { MetricCards } from '../components/MetricCards';
import { JobList } from '../components/JobList';
import { QueueJobModal } from '../components/QueueJobModal';
import { PrinterConfigModal } from '../components/PrinterConfigModal';
import { LogViewer } from '../components/LogViewer';
import {
  fetchHealth,
  fetchJobs,
  fetchLogs,
  retryJob,
  cancelJob,
  subscribeToEvents,
  HealthResponse,
  Job,
  LogEntry,
} from '../lib/api';

export default function DashboardPage() {
  const [health, setHealth] = useState<HealthResponse | undefined>();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [healthData, jobsData, logsData] = await Promise.allSettled([
        fetchHealth(),
        fetchJobs(activeFilter),
        fetchLogs(50),
      ]);

      if (healthData.status === 'fulfilled') setHealth(healthData.value);
      if (jobsData.status === 'fulfilled') setJobs(jobsData.value.jobs || []);
      if (logsData.status === 'fulfilled') setLogs(logsData.value.logs || []);
    } catch (err) {
      console.error('Error refreshing PintFlow dashboard:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [activeFilter]);

  // Initial load + Real-time SSE event listener (replacing continuous HTTP polling)
  useEffect(() => {
    loadData();

    const eventSource = subscribeToEvents((evtType, data) => {
      if (evtType === 'connected' || evtType === 'ping') {
        setSseConnected(true);
      } else if (evtType === 'job_updated') {
        setSseConnected(true);
        if (data && data.id && data.status) {
          setJobs(prev => prev.map(j => (j.id === data.id ? { ...j, status: data.status, error_message: data.error_message } : j)));
        }
        loadData();
      } else if (evtType === 'health_updated') {
        setSseConnected(true);
        fetchHealth().then(setHealth).catch(() => {});
      } else if (evtType === 'log_added' && data) {
        setSseConnected(true);
        setLogs(prev => [data, ...prev].slice(0, 50));
      }
    });

    eventSource.onerror = () => {
      setSseConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, [loadData]);

  const handleRetryJob = async (id: string) => {
    try {
      await retryJob(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to retry job');
    }
  };

  const handleCancelJob = async (id: string) => {
    try {
      await cancelJob(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel job');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <Header
        printer={health?.printer}
        sseConnected={sseConnected}
        onOpenQueueModal={() => setIsQueueModalOpen(true)}
        onOpenPrinterModal={() => setIsPrinterModalOpen(true)}
        onRefresh={loadData}
        isRefreshing={isRefreshing}
      />

      <MetricCards health={health} />

      <JobList
        jobs={jobs}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        onRetry={handleRetryJob}
        onCancel={handleCancelJob}
      />

      <LogViewer logs={logs} />

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
