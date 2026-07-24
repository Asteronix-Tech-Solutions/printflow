'use client';

import React, { useState } from 'react';
import { Search, RotateCcw, XCircle, FileText, User, Calendar, Printer, Eye, Sparkles, Download } from 'lucide-react';
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

  const filterOptions = ['all', 'pending', 'printing', 'completed', 'failed'];

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
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">Pending</span>;
      case 'downloading':
      case 'processing':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 animate-pulse">Processing</span>;
      case 'printing':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 animate-pulse">Printing...</span>;
      case 'completed':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Completed</span>;
      case 'failed':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">Failed</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/30">Cancelled</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/30">{status}</span>;
    }
  };

  return (
    <div className="glass-panel p-5 mb-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-5">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-400" />
          <span>Print Jobs Queue</span>
        </h2>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search filename or user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10 overflow-x-auto">
            {filterOptions.map((f) => (
              <button
                key={f}
                onClick={() => onFilterChange(f)}
                className={`px-3 py-1 text-xs font-medium rounded-lg capitalize transition-all whitespace-nowrap ${
                  activeFilter === f ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-gray-400 font-semibold uppercase tracking-wider">
              <th className="py-3 px-3">File / User</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Printer</th>
              <th className="py-3 px-3">Copies</th>
              <th className="py-3 px-3">Submitted</th>
              <th className="py-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredJobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  No print jobs found.
                </td>
              </tr>
            ) : (
              filteredJobs.map((job) => (
                <tr key={job.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-3">
                    <div className="font-semibold text-white truncate max-w-xs">{job.filename}</div>
                    <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                      <User className="w-3 h-3" />
                      <span>{job.user_name || 'Anonymous'}</span>
                      {job.user_email && <span className="text-gray-500">({job.user_email})</span>}
                    </div>
                  </td>
                  <td className="py-3.5 px-3">
                    {getStatusBadge(job.status)}
                    {job.error_message && (
                      <p className="text-[10px] text-rose-400 mt-1 max-w-xs truncate" title={job.error_message}>
                        {job.error_message}
                      </p>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-gray-300">
                    <div className="flex items-center gap-1.5">
                      <Printer className="w-3.5 h-3.5 text-gray-400" />
                      <span>{job.printer || 'Default'}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-gray-300 font-mono">{job.copies}</td>
                  <td className="py-3.5 px-3 text-gray-400">
                    <div className="flex items-center gap-1 text-[11px]">
                      <Calendar className="w-3 h-3 text-gray-500" />
                      <span>{new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {onViewForm && (
                        <button
                          onClick={() => onViewForm(job)}
                          className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all"
                          title="Inspect Visual Form Response & Generated PDF"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View PDF/Form</span>
                        </button>
                      )}
                      {(job.form_responses && job.form_responses.length > 0) && (
                        <a
                          href={getJobPDFUrl(job.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/30 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all"
                          title="Download Form PDF"
                        >
                          <Download className="w-3 h-3" />
                        </a>
                      )}
                      {(job.status === 'failed' || job.status === 'cancelled' || job.status === 'completed') && (
                        <button
                          onClick={() => onRetry(job.id)}
                          className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all"
                          title="Re-queue print job"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Re-print</span>
                        </button>
                      )}
                      {(job.status === 'pending' || job.status === 'downloading') && (
                        <button
                          onClick={() => onCancel(job.id)}
                          className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all"
                          title="Cancel pending job"
                        >
                          <XCircle className="w-3 h-3" />
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
