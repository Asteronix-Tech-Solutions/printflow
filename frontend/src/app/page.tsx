'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { MetricCards } from '../components/MetricCards';
import { JobList } from '../components/JobList';
import { QueueJobModal } from '../components/QueueJobModal';
import { PrinterConfigModal } from '../components/PrinterConfigModal';
import {
  fetchHealth,
  fetchJobs,
  retryJob,
  cancelJob,
  subscribeToEvents,
  HealthResponse,
  Job,
} from '../lib/api';

export default function DashboardPage() {
  const [health, setHealth] = useState<HealthResponse | undefined>();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [healthData, jobsData] = await Promise.allSettled([
        fetchHealth(),
        fetchJobs(activeFilter, 100), // Fetch up to 100 recent jobs for frontend client pagination
      ]);

      if (healthData.status === 'fulfilled') setHealth(healthData.value);
      if (jobsData.status === 'fulfilled') setJobs(jobsData.value.jobs || []);
    } catch (err) {
      console.error('Error refreshing PrintFlow dashboard:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [activeFilter]);

  // Initial load + Real-time SSE event listener
  useEffect(() => {
    loadData();

    const eventSource = subscribeToEvents((evtType, data) => {
      if (evtType === 'connected' || evtType === 'ping') {
        setSseConnected(true);
      } else if (evtType === 'job_updated') {
        setSseConnected(true);
        if (data && data.id && data.status) {
          setJobs(prev =>
            prev.map(j =>
              j.id === data.id
                ? { ...j, status: data.status, error_message: data.error_message }
                : j
            )
          );
        }
        loadData();
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Sidebar Navigation */}
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
          title="Document Printing Dashboard"
          subtitle="Real-time automated print queue & Form submission status"
        />

        <MetricCards health={health} />

        <JobList
          jobs={jobs}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          onRetry={handleRetryJob}
          onCancel={handleCancelJob}
        />
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
