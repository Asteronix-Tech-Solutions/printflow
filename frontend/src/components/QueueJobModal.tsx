'use client';

import React, { useState } from 'react';
import { X, Upload, Link as LinkIcon, Printer, CheckCircle2, AlertCircle } from 'lucide-react';
import { manualQueueJob } from '../lib/api';

interface QueueJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJobQueued: () => void;
}

export const QueueJobModal: React.FC<QueueJobModalProps> = ({ isOpen, onClose, onJobQueued }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'drive'>('upload');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [googleFileId, setGoogleFileId] = useState('');
  const [filename, setFilename] = useState('');
  const [copies, setCopies] = useState(1);
  const [fileBase64, setFileBase64] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFileBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (activeTab === 'upload' && !fileBase64) {
        throw new Error('Please select a document file to print');
      }
      if (activeTab === 'drive' && !googleFileId.trim()) {
        throw new Error('Please enter a valid Google Drive link or File ID');
      }

      await manualQueueJob({
        user_name: userName || 'Manual Print Request',
        user_email: userEmail || 'user@printflow.local',
        file_id: activeTab === 'drive' ? googleFileId.trim() : undefined,
        filename: filename || 'printed_document.pdf',
        copies: Number(copies),
        file_data: activeTab === 'upload' && fileBase64 ? fileBase64 : undefined,
      });

      setSuccess('Document sent to print queue successfully!');
      setTimeout(() => {
        onJobQueued();
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to send print request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
      <div className="glass-modal w-full max-w-lg rounded-2xl p-6 relative border border-slate-200 dark:border-slate-800 shadow-2xl text-slate-900 dark:text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl shadow-md">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">Send New Print Document</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload a document or paste a Google Drive link to queue for printing
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800 mb-5">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'upload'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Upload Document</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('drive')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'drive'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            <span>Google Drive File</span>
          </button>
        </div>

        {error && (
          <div className="p-3.5 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3.5 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
          {activeTab === 'upload' ? (
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                Select PDF or Image File
              </label>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                onChange={handleFileChange}
                className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
          ) : (
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                Google Drive File ID or URL
              </label>
              <input
                type="text"
                placeholder="e.g. 1A2B3C4D5E6F..."
                value={googleFileId}
                onChange={(e) => setGoogleFileId(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                Sender Name
              </label>
              <input
                type="text"
                placeholder="John Doe"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                Sender Email
              </label>
              <input
                type="email"
                placeholder="john@example.com"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
              Number of Copies
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-xs transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Queue Print Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
