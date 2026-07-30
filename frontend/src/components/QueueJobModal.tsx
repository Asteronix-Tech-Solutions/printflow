'use client';

import React, { useState } from 'react';
import { X, Upload, Link, Printer, CheckCircle, AlertCircle } from 'lucide-react';
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
        user_email: userEmail || 'user@pintflow.local',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="glass-modal w-full max-w-lg rounded-2xl p-6 relative border border-white/10 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-white rounded-lg bg-white/5 hover:bg-white/10 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl shadow-md">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Send New Print Document</h2>
            <p className="text-xs text-gray-400">Upload a PDF/Image or paste a Google Drive link to print</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10 mb-5">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
              activeTab === 'upload' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Upload Document</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('drive')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
              activeTab === 'drive' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Link className="w-4 h-4" />
            <span>Google Drive Link</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2 font-medium">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {activeTab === 'upload' ? (
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">Choose File to Print (PDF or Image)</label>
              <input
                type="file"
                onChange={handleFileChange}
                className="w-full text-xs text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-500/20 file:text-indigo-300 hover:file:bg-indigo-500/30 cursor-pointer bg-white/5 border border-white/10 rounded-xl p-2 font-medium"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Google Drive Link or File ID</label>
              <input
                type="text"
                placeholder="Paste link e.g. https://drive.google.com/file/d/..."
                value={googleFileId}
                onChange={(e) => setGoogleFileId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 font-medium"
              />
              <label className="block text-xs font-semibold text-gray-300 mt-3 mb-1">Document Display Title</label>
              <input
                type="text"
                placeholder="e.g. Guest_Registration.pdf"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 font-medium"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Submitted By (Name)</label>
              <input
                type="text"
                placeholder="Your Name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Number of Copies</label>
              <input
                type="number"
                min="1"
                max="50"
                value={copies}
                onChange={(e) => setCopies(parseInt(e.target.value) || 1)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
              />
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-3 border-t border-white/10 mt-5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 active:scale-95"
            >
              {loading ? 'Sending to Printer...' : 'Send to Printer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

