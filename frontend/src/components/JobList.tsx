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

  const filterOptions = [
    { key: 'all', label: 'All Submissions' },
    { key: 'pending', label: 'Waiting' },
    { key: 'printing', label: 'Printing Now' },
    { key: 'completed', label: 'Completed' },
    { key: 'failed', label: 'Needs Attention' },
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

  const getStatusBadge = (status: Job['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1.5 w-fit">
            <Clock className="w-3.5 h-3.5" />
            <span>Queued</span>
          </span>
        );
      case 'downloading':
      case 'processing':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30 animate-pulse flex items-center gap-1.5 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            <span>Preparing...</span>
          </span>
        );
      case 'printing':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 animate-pulse flex items-center gap-1.5 w-fit">
            <Printer className="w-3.5 h-3.5 text-indigo-500" />
            <span>Printing Now</span>
          </span>
        );
      case 'completed':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 w-fit">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Printed</span>
          </span>
        );
      case 'failed':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-rose-500/30 flex items-center gap-1.5 w-fit">
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>Failed</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/30 flex items-center gap-1.5 w-fit">
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-slate-500/10 text-slate-400 capitalize">
            {status}
          </span>
        );
    }
  };

  return (
    <>
      <div className="glass-panel p-5 mb-6 shadow-xl border border-slate-200 dark:border-slate-800">
        {/* Header bar: Title, Search, and Filter Tabs */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              <span>Form Print Submissions</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live activity of documents submitted via Google Forms
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by filename or sender..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-semibold"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto w-full sm:w-auto">
              {filterOptions.map((f) => (
                <button
                  key={f.key}
                  onClick={() => onFilterChange(f.key)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                    activeFilter === f.key
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-extrabold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5">Document & Sender</th>
                <th className="py-3 px-3.5">Status</th>
                <th className="py-3 px-3.5">Printer</th>
                <th className="py-3 px-3.5">Copies</th>
                <th className="py-3 px-3.5">Time</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60 font-semibold">
              {paginatedJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        No print submissions found
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Form responses will appear here automatically.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedJobs.map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => setSelectedJob(job)}
                    className="hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-3.5">
                      <div className="font-bold text-slate-900 dark:text-white text-xs truncate max-w-xs group-hover:text-indigo-500 transition-colors">
                        {job.filename}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1">
                        <User className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {job.user_name || 'Anonymous'}
                        </span>
                        {job.user_email && <span className="text-slate-400">({job.user_email})</span>}
                      </div>
                    </td>
                    <td className="py-3.5 px-3.5">
                      {getStatusBadge(job.status)}
                      {job.error_message && (
                        <p
                          className="text-[11px] text-rose-500 mt-1 max-w-xs truncate font-medium"
                          title={job.error_message}
                        >
                          {job.error_message}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-3.5 text-slate-700 dark:text-slate-300">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Printer className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{job.printer || 'Brother DCP-T430W'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3.5 text-slate-700 dark:text-slate-300 font-bold">
                      {job.copies} {job.copies === 1 ? 'copy' : 'copies'}
                    </td>
                    <td className="py-3.5 px-3.5 text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
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
                      onClick={(e) => e.stopPropagation()} // Prevent row selection when clicking action buttons
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedJob(job)}
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold flex items-center transition-all"
                          title="View Submission Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {job.form_responses && job.form_responses.length > 0 && (
                          <a
                            href={getJobPDFUrl(job.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center transition-all"
                            title="Download PDF"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-500" />
                          </a>
                        )}
                        {(job.status === 'failed' ||
                          job.status === 'cancelled' ||
                          job.status === 'completed') && (
                          <button
                            onClick={() => onRetry(job.id)}
                            className="px-2.5 py-1.5 bg-purple-500/15 hover:bg-purple-500/30 text-purple-600 dark:text-purple-300 border border-purple-500/30 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                            title="Send to printer again"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-purple-500" />
                            <span className="hidden sm:inline">Re-print</span>
                          </button>
                        )}
                        {(job.status === 'pending' || job.status === 'downloading') && (
                          <button
                            onClick={() => onCancel(job.id)}
                            className="px-2.5 py-1.5 bg-rose-500/15 hover:bg-rose-500/30 text-rose-600 dark:text-rose-300 border border-rose-500/30 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
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

      {/* Modal for detailed job inspection */}
      <JobDetailModal
        job={selectedJob}
        isOpen={Boolean(selectedJob)}
        onClose={() => setSelectedJob(null)}
        onRetry={onRetry}
        onCancel={onCancel}
      />
    </>
  );
};
