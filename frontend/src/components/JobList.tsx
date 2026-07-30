'use client';

import React, { useState } from 'react';
import { Search, RotateCcw, XCircle, FileText, User, Calendar, Printer, Eye, Download, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { Job, getJobPDFUrl } from '../lib/api';

interface JobListProps {
  jobs: Job[];
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  onViewForm?: (job: Job) => void;
}

export const JobList: React.FC<JobListProps> = ({
  jobs,
  activeFilter,
  onFilterChange,
  onRetry,
  onCancel,
  onViewForm,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filterOptions = [
    { key: 'all', label: 'All Submissions' },
    { key: 'pending', label: 'Waiting' },
    { key: 'printing', label: 'Printing Now' },
    { key: 'completed', label: 'Completed' },
    { key: 'failed', label: 'Needs Attention' },
  ];

  const filteredJobs = jobs.filter((job) => {
    const matchesFilter = activeFilter === 'all' || job.status === activeFilter;
    const matchesSearch =
      searchTerm === '' ||
      job.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.user_name && job.user_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (job.user_email && job.user_email.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const getStatusBadge = (status: Job['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 w-fit">
            <Clock className="w-3.5 h-3.5" />
            <span>Queued</span>
          </span>
        );
      case 'downloading':
      case 'processing':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 animate-pulse flex items-center gap-1.5 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            <span>Preparing...</span>
          </span>
        );
      case 'printing':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 animate-pulse flex items-center gap-1.5 w-fit">
            <Printer className="w-3.5 h-3.5 text-indigo-400" />
            <span>Printing Now</span>
          </span>
        );
      case 'completed':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 w-fit">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Printed</span>
          </span>
        );
      case 'failed':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 w-fit">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>Failed</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/30 flex items-center gap-1.5 w-fit">
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/30 capitalize">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="glass-panel p-5 mb-6 shadow-xl">
      {/* Header section with title, search bar, and filter tabs */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-5 pb-4 border-b border-white/10">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <span>Form Print Submissions</span>
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Live activity of documents submitted via Google Forms</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by form or sender..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-all font-medium"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10 overflow-x-auto w-full sm:w-auto">
            {filterOptions.map((f) => (
              <button
                key={f.key}
                onClick={() => onFilterChange(f.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  activeFilter === f.key
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Submissions List Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-gray-400 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-3.5">Document & Sender</th>
              <th className="py-3 px-3.5">Print Status</th>
              <th className="py-3 px-3.5">Target Printer</th>
              <th className="py-3 px-3.5">Copies</th>
              <th className="py-3 px-3.5">Submitted Time</th>
              <th className="py-3 px-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-medium">
            {filteredJobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FileText className="w-8 h-8 text-gray-600" />
                    <p className="text-sm font-semibold text-gray-400">No print submissions found</p>
                    <p className="text-xs text-gray-500">Submissions from Google Forms will appear here automatically.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredJobs.map((job) => (
                <tr key={job.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-3.5">
                    <div className="font-bold text-white text-xs truncate max-w-xs">{job.filename}</div>
                    <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-1">
                      <User className="w-3 h-3 text-indigo-400 shrink-0" />
                      <span className="font-medium text-gray-300">{job.user_name || 'Anonymous'}</span>
                      {job.user_email && <span className="text-gray-500">({job.user_email})</span>}
                    </div>
                  </td>
                  <td className="py-3.5 px-3.5">
                    {getStatusBadge(job.status)}
                    {job.error_message && (
                      <p className="text-[11px] text-rose-400 mt-1 max-w-xs truncate font-medium" title={job.error_message}>
                        {job.error_message}
                      </p>
                    )}
                  </td>
                  <td className="py-3.5 px-3.5 text-gray-300">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Printer className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>{job.printer || 'Brother DCP-T430W'}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-3.5 text-gray-300 font-semibold">{job.copies} {job.copies === 1 ? 'copy' : 'copies'}</td>
                  <td className="py-3.5 px-3.5 text-gray-400">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                      <span>{new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {onViewForm && (
                        <button
                          onClick={() => onViewForm(job)}
                          className="px-3 py-1.5 bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                          title="Inspect document preview and form responses"
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-400" />
                          <span>View Form</span>
                        </button>
                      )}
                      {(job.form_responses && job.form_responses.length > 0) && (
                        <a
                          href={getJobPDFUrl(job.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all shadow-sm active:scale-95"
                          title="Download printable PDF file"
                        >
                          <Download className="w-3.5 h-3.5 text-emerald-400" />
                        </a>
                      )}
                      {(job.status === 'failed' || job.status === 'cancelled' || job.status === 'completed') && (
                        <button
                          onClick={() => onRetry(job.id)}
                          className="px-3 py-1.5 bg-purple-500/15 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                          title="Send to printer again"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
                          <span>Re-print</span>
                        </button>
                      )}
                      {(job.status === 'pending' || job.status === 'downloading') && (
                        <button
                          onClick={() => onCancel(job.id)}
                          className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                          title="Cancel print request"
                        >
                          <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span>Cancel</span>
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
    </div>
  );
};

