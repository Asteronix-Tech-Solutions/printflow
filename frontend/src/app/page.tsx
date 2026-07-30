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

  // Initial load + Polling interval every 3 seconds
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
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
