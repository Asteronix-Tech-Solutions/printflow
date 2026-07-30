'use client';

import React from 'react';
import { X, FileText, User, Mail, Calendar, Printer, Download, RotateCcw, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Job, getJobPDFUrl } from '../lib/api';

interface JobDetailModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job,
  isOpen,
  onClose,
  onRetry,
  onCancel,
}) => {
  if (!isOpen || !job) return null;

  const getStatusBadge = (status: Job['status']) => {
    switch (status) {
      case 'pending':
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30">Queued</span>;
      case 'downloading':
      case 'processing':
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-cyan-500/10 text-cyan-500 border border-cyan-500/30">Preparing PDF...</span>;
      case 'printing':
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">Printing Now</span>;
      case 'completed':
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">Printed</span>;
      case 'failed':
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/30">Failed</span>;
      default:
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-slate-500/10 text-slate-400 capitalize">{status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-modal w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-xl border border-indigo-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base tracking-tight truncate max-w-sm sm:max-w-md">
                {job.filename}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Job ID: #{job.id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {getStatusBadge(job.status)}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <User className="w-4 h-4 text-indigo-500 shrink-0" />
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Submitted By</span>
                <span className="font-bold">{job.user_name || 'Anonymous User'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-indigo-500 shrink-0" />
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Email Address</span>
                <span className="font-bold truncate max-w-[200px] block">{job.user_email || 'N/A'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Printer className="w-4 h-4 text-indigo-500 shrink-0" />
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Printer & Copies</span>
                <span className="font-bold">{job.printer || 'Brother DCP-T430W'} ({job.copies} copies)</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Created Time</span>
                <span className="font-bold">{new Date(job.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Diagnostics Error Alert */}
          {job.error_message && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-300 space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span>Error Diagnostic Trace</span>
              </div>
              <p className="text-[11px] font-mono whitespace-pre-wrap">{job.error_message}</p>
            </div>
          )}

          {/* Form Questions & Answers Section */}
          {job.form_responses && job.form_responses.length > 0 && (
            <div>
              <h3 className="font-bold text-sm mb-3 text-slate-900 dark:text-white flex items-center gap-2">
                <span>Form Submission Details</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/15 text-indigo-500 font-extrabold">
                  {job.form_responses.length} Fields
                </span>
              </h3>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {job.form_responses.map((resp, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60"
                  >
                    <p className="font-bold text-slate-700 dark:text-slate-300 text-[11px] mb-1">
                      {resp.question}
                    </p>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white break-words">
                      {resp.answer || <em className="text-slate-400 font-normal">No response provided</em>}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-3">
          <div>
            {job.form_responses && job.form_responses.length > 0 && (
              <a
                href={getJobPDFUrl(job.id)}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Download Printable PDF</span>
              </a>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(job.status === 'failed' || job.status === 'cancelled' || job.status === 'completed') && (
              <button
                onClick={() => {
                  onRetry(job.id);
                  onClose();
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Re-print Document</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-xs transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
