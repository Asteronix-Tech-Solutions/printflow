'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, RotateCcw, XCircle, FileText, User, Calendar, Printer, Download, CheckCircle2, AlertCircle, Clock, Eye } from 'lucide-react';
import { Job, getJobPDFUrl } from '../lib/api';
import { Pagination } from './Pagination';
import { JobDetailModal } from './JobDetailModal';

interface JobListProps {
  jobs: Job[];
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
}

export const JobList: React.FC<JobListProps> = ({
  jobs,
  activeFilter,
  onFilterChange,
  onRetry,
  onCancel,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [modalTab, setModalTab] = useState<'details' | 'preview'>('details');

  const filterOptions = [
    { key: 'all', label: 'ALL SUBMISSIONS' },
    { key: 'pending', label: 'WAITING' },
    { key: 'printing', label: 'PRINTING NOW' },
    { key: 'completed', label: 'COMPLETED' },
    { key: 'failed', label: 'NEEDS ATTENTION' },
  ];

  // Reset to page 1 whenever filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeFilter]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesFilter = activeFilter === 'all' || job.status === activeFilter;
      const matchesSearch =
        searchTerm === '' ||
        job.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.user_name && job.user_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (job.user_email && job.user_email.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesFilter && matchesSearch;
    });
  }, [jobs, activeFilter, searchTerm]);

  const totalPages = Math.ceil(filteredJobs.length / pageSize) || 1;
  const paginatedJobs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredJobs.slice(start, start + pageSize);
  }, [filteredJobs, currentPage, pageSize]);

  const openJobModal = (job: Job, tab: 'details' | 'preview' = 'details') => {
    setModalTab(tab);
    setSelectedJob(job);
  };

  const getStatusBadge = (status: Job['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2.5 py-1 text-[11px] font-bold rounded-none bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1.5 w-fit uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5" />
            <span>Queued</span>
          </span>
        );
      case 'downloading':
      case 'processing':
        return (
          <span className="px-2.5 py-1 text-[11px] font-bold rounded-none bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 animate-pulse flex items-center gap-1.5 w-fit uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            <span>Preparing...</span>
          </span>
        );
      case 'printing':
        return (
          <span className="px-2.5 py-1 text-[11px] font-bold rounded-none bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 animate-pulse flex items-center gap-1.5 w-fit uppercase tracking-wider">
            <Printer className="w-3.5 h-3.5 text-indigo-500" />
            <span>Printing Now</span>
          </span>
        );
      case 'completed':
        return (
          <span className="px-2.5 py-1 text-[11px] font-bold rounded-none bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 w-fit uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Printed</span>
          </span>
        );
      case 'failed':
        return (
          <span className="px-2.5 py-1 text-[11px] font-bold rounded-none bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30 flex items-center gap-1.5 w-fit uppercase tracking-wider">
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>Failed</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2.5 py-1 text-[11px] font-bold rounded-none bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/30 flex items-center gap-1.5 w-fit uppercase tracking-wider">
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-[11px] font-bold rounded-none bg-slate-500/10 text-slate-500 uppercase tracking-wider">
            {status}
          </span>
        );
    }
  };

  return (
    <>
      <div className="glass-panel p-5 mb-6 rounded-none">
        {/* Header bar: Title, Search, and Filter Tabs */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-5 pb-4 border-b border-[var(--border-color)]">
          <div>
            <h2 className="text-base font-black flex items-center gap-2 uppercase tracking-wider">
              <FileText className="w-5 h-5 text-indigo-500" />
              <span>FORM PRINT SUBMISSIONS</span>
            </h2>
            <p className="text-xs font-semibold text-[var(--text-muted)] mt-0.5">
              Automated print pipeline activity from Google Forms
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
              <input
                type="text"
                placeholder="Search by filename or sender..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full theme-input rounded-none pl-9 pr-3 py-2 text-xs font-bold"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center tab-container p-1 rounded-none overflow-x-auto w-full sm:w-auto">
              {filterOptions.map((f) => (
                <button
                  key={f.key}
                  onClick={() => onFilterChange(f.key)}
                  className={`px-3 py-1.5 text-[11px] font-extrabold tracking-wider rounded-none transition-all whitespace-nowrap uppercase ${
                    activeFilter === f.key
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Submissions Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-color)] text-[var(--text-subtle)] font-black uppercase tracking-widest text-[10px]">
                <th className="py-3 px-3.5">DOCUMENT & SENDER</th>
                <th className="py-3 px-3.5">STATUS</th>
                <th className="py-3 px-3.5">PRINTER</th>
                <th className="py-3 px-3.5">COPIES</th>
                <th className="py-3 px-3.5">TIME</th>
                <th className="py-3 px-3.5 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)] font-semibold">
              {paginatedJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="w-8 h-8 text-indigo-500 opacity-60" />
                      <p className="text-sm font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                        No print submissions found
                      </p>
                      <p className="text-xs text-[var(--text-subtle)]">
                        Form responses will appear here automatically.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedJobs.map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => openJobModal(job, 'details')}
                    className="hover:bg-[var(--btn-secondary-hover)] transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-3.5">
                      <div className="font-extrabold text-xs truncate max-w-xs group-hover:text-indigo-500 transition-colors uppercase tracking-wider">
                        {job.filename}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5 mt-1 font-medium">
                        <User className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span className="font-semibold">
                          {job.user_name || 'Anonymous'}
                        </span>
                        {job.user_email && <span className="text-[var(--text-subtle)]">({job.user_email})</span>}
                      </div>
                    </td>
                    <td className="py-3.5 px-3.5">
                      {getStatusBadge(job.status)}
                      {job.error_message && (
                        <p
                          className="text-[11px] text-rose-500 mt-1 max-w-xs truncate font-mono"
                          title={job.error_message}
                        >
                          {job.error_message}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-3.5">
                      <div className="flex items-center gap-1.5 font-medium text-[var(--text-muted)]">
                        <Printer className="w-3.5 h-3.5 text-[var(--text-subtle)] shrink-0" />
                        <span>{job.printer || 'Brother DCP-T430W'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3.5 font-extrabold">
                      {job.copies} {job.copies === 1 ? 'copy' : 'copies'}
                    </td>
                    <td className="py-3.5 px-3.5 text-[var(--text-muted)]">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-[var(--text-subtle)] shrink-0" />
                        <span>
                          {new Date(job.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </td>
                    <td
                      className="py-3.5 px-3.5 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        {/* PDF Preview Shortcut */}
                        {job.form_responses && job.form_responses.length > 0 && (
                          <button
                            onClick={() => openJobModal(job, 'preview')}
                            className="p-1.5 bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 rounded-none text-xs font-bold flex items-center transition-all"
                            title="Preview PDF Document"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {job.form_responses && job.form_responses.length > 0 && (
                          <a
                            href={getJobPDFUrl(job.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 rounded-none text-xs font-bold flex items-center transition-all"
                            title="Download PDF File"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-500" />
                          </a>
                        )}
                        {(job.status === 'failed' ||
                          job.status === 'cancelled' ||
                          job.status === 'completed') && (
                          <button
                            onClick={() => onRetry(job.id)}
                            className="px-2.5 py-1.5 bg-purple-500/15 hover:bg-purple-500/30 text-purple-700 dark:text-purple-300 border border-purple-500/30 rounded-none text-xs font-extrabold flex items-center gap-1 transition-all uppercase tracking-wider"
                            title="Send to printer again"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-purple-500" />
                            <span className="hidden sm:inline">Re-print</span>
                          </button>
                        )}
                        {(job.status === 'pending' || job.status === 'downloading') && (
                          <button
                            onClick={() => onCancel(job.id)}
                            className="px-2.5 py-1.5 bg-rose-500/15 hover:bg-rose-500/30 text-rose-700 dark:text-rose-300 border border-rose-500/30 rounded-none text-xs font-extrabold flex items-center gap-1 transition-all uppercase tracking-wider"
                            title="Cancel print request"
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-500" />
                            <span className="hidden sm:inline">Cancel</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Proper Pagination Controls */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredJobs.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Modal for detailed job inspection & PDF preview */}
      <JobDetailModal
        job={selectedJob}
        isOpen={Boolean(selectedJob)}
        onClose={() => setSelectedJob(null)}
        onRetry={onRetry}
        onCancel={onCancel}
        initialTab={modalTab}
      />
    </>
  );
};
