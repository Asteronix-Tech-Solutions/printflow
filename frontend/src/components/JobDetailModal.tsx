'use client';

import React, { useState } from 'react';
import { X, FileText, User, Mail, Calendar, Printer, Download, RotateCcw, AlertCircle, Eye, ExternalLink } from 'lucide-react';
import { Job, getJobPDFUrl } from '../lib/api';

interface JobDetailModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  initialTab?: 'details' | 'preview';
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job,
  isOpen,
  onClose,
  onRetry,
  onCancel,
  initialTab = 'details',
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'preview'>(initialTab);

  if (!isOpen || !job) return null;

  const pdfUrl = getJobPDFUrl(job.id);
  const hasPDF = job.form_responses && job.form_responses.length > 0;

  const getStatusBadge = (status: Job['status']) => {
    switch (status) {
      case 'pending':
        return <span className="px-3 py-1 text-xs font-bold rounded-none bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 uppercase tracking-wider">Queued</span>;
      case 'downloading':
      case 'processing':
        return <span className="px-3 py-1 text-xs font-bold rounded-none bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30 uppercase tracking-wider animate-pulse">Preparing PDF...</span>;
      case 'printing':
        return <span className="px-3 py-1 text-xs font-bold rounded-none bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 uppercase tracking-wider animate-pulse">Printing Now</span>;
      case 'completed':
        return <span className="px-3 py-1 text-xs font-bold rounded-none bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">Printed</span>;
      case 'failed':
        return <span className="px-3 py-1 text-xs font-bold rounded-none bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30 uppercase tracking-wider">Failed</span>;
      default:
        return <span className="px-3 py-1 text-xs font-bold rounded-none bg-slate-500/10 text-slate-600 dark:text-slate-400 uppercase tracking-wider">{status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-modal w-full max-w-4xl rounded-none overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-[var(--border-color)] flex items-center justify-between modal-section">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-r from-[#0066b1] via-[#1c69d4] to-[#e22718] text-white rounded-none shadow-md">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-base tracking-wider uppercase truncate max-w-sm sm:max-w-md">
                {job.filename}
              </h2>
              <p className="text-xs font-mono text-[var(--text-subtle)]">
                JOB ID: #{job.id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {getStatusBadge(job.status)}
            <button
              onClick={onClose}
              className="p-1.5 rounded-none text-[var(--text-subtle)] hover:text-[var(--text-main)] hover:bg-[var(--btn-secondary-hover)] transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[var(--border-color)] modal-section px-5 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('details')}
            className={`py-2.5 px-4 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'details'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Form Details</span>
          </button>

          {hasPDF && (
            <button
              onClick={() => setActiveTab('preview')}
              className={`py-2.5 px-4 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'preview'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>Printed PDF Preview</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
          {activeTab === 'details' ? (
            <>
              {/* Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-none modal-section">
                <div className="flex items-center gap-2.5">
                  <User className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div>
                    <span className="text-[10px] text-[var(--text-subtle)] block font-bold uppercase tracking-wider">Submitted By</span>
                    <span className="font-bold">{job.user_name || 'Anonymous User'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div>
                    <span className="text-[10px] text-[var(--text-subtle)] block font-bold uppercase tracking-wider">Email Address</span>
                    <span className="font-bold truncate max-w-[200px] block">{job.user_email || 'N/A'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Printer className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div>
                    <span className="text-[10px] text-[var(--text-subtle)] block font-bold uppercase tracking-wider">Printer & Copies</span>
                    <span className="font-bold">{job.printer || 'Brother DCP-T430W'} ({job.copies} copies)</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div>
                    <span className="text-[10px] text-[var(--text-subtle)] block font-bold uppercase tracking-wider">Created Time</span>
                    <span className="font-bold">{new Date(job.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Diagnostics Error Alert */}
              {job.error_message && (
                <div className="p-4 rounded-none bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                    <span>Error Diagnostic Trace</span>
                  </div>
                  <p className="text-[11px] font-mono whitespace-pre-wrap">{job.error_message}</p>
                </div>
              )}

              {/* Form Questions & Answers Section */}
              {job.form_responses && job.form_responses.length > 0 && (
                <div>
                  <h3 className="font-black text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span>Form Submission Details</span>
                    <span className="px-2 py-0.5 rounded-none text-[10px] bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-extrabold">
                      {job.form_responses.length} FIELDS
                    </span>
                  </h3>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {job.form_responses.map((resp, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-none modal-section"
                      >
                        <p className="font-bold text-[11px] mb-1 uppercase tracking-wider text-[var(--text-muted)]">
                          {resp.question}
                        </p>
                        <p className="text-xs font-semibold break-words">
                          {resp.answer || <em className="text-[var(--text-subtle)] font-normal">No response provided</em>}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Printed PDF Preview Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between modal-section p-3 text-xs">
                <span className="font-bold uppercase tracking-wider">PDF Live Document Viewer</span>
                <div className="flex items-center gap-2">
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-none font-bold text-xs flex items-center gap-1.5 border border-slate-700"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in New Tab</span>
                  </a>
                </div>
              </div>

              <div className="w-full h-[520px] bg-slate-950 border border-[var(--border-color)] relative">
                <iframe
                  src={pdfUrl}
                  className="w-full h-full border-0"
                  title="PDF Preview"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[var(--border-color)] modal-section flex flex-wrap items-center justify-between gap-3">
          <div>
            {hasPDF && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-none font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 shadow-md transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF File</span>
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
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-none font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 shadow-md transition-all active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Re-print Document</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="btn-secondary px-4 py-2 rounded-none font-extrabold text-xs uppercase tracking-wider"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
