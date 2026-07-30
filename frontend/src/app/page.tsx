'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { MainLayout } from '../components/MainLayout';
import { Header } from '../components/Header';
import { MetricCards } from '../components/MetricCards';
import { JobList } from '../components/JobList';
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [healthData, jobsData] = await Promise.allSettled([
        fetchHealth(),
        fetchJobs(activeFilter, 100),
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
            title="DOCUMENT PRINTING DASHBOARD"
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
        </>
      )}
    </MainLayout>
  );
}
