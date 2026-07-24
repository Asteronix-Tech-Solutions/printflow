'use client';

import React, { useEffect, useState } from 'react';
import { X, Printer, Layout, RefreshCw, Check, Sparkles, FileText, Download } from 'lucide-react';
import { Job, FormTemplate, fetchTemplates, previewTemplate, reformatJob, getJobPDFUrl } from '../lib/api';

interface FormResponseViewerModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  onJobUpdated?: () => void;
}

export const FormResponseViewerModal: React.FC<FormResponseViewerModalProps> = ({
  job,
  isOpen,
  onClose,
  onJobUpdated,
}) => {
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('property_checkin');
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [viewMode, setViewMode] = useState<'pdf' | 'html'>('pdf');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      if (job?.template_id) {
        setSelectedTemplateId(job.template_id);
      }
    }
  }, [isOpen, job]);

  useEffect(() => {
    if (isOpen && job && viewMode === 'html') {
      renderPreview(selectedTemplateId);
    }
  }, [selectedTemplateId, isOpen, job, viewMode]);

  const loadTemplates = async () => {
    try {
      const res = await fetchTemplates();
      setTemplates(res.templates || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const renderPreview = async (templateId: string) => {
    if (!job) return;
    setLoading(true);
    try {
      const res = await previewTemplate({
        template_id: templateId,
        form_title: job.form_title || 'Google Form Submission',
        user_name: job.user_name,
        user_email: job.user_email,
        form_responses: job.form_responses || [],
      });
      setPreviewHtml(res.html || '');
    } catch (err) {
      console.error('Failed to render preview:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTemplate = async (reprint: boolean) => {
    if (!job) return;
    setSaving(true);
    setSuccessMsg('');
    try {
      await reformatJob(job.id, selectedTemplateId, reprint);
      setSuccessMsg(reprint ? 'Template applied and PDF print job queued!' : 'Template applied & PDF generated successfully!');
      if (onJobUpdated) onJobUpdated();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to reformat job');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !job) return null;

  const pdfUrl = getJobPDFUrl(job.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400 border border-indigo-500/30">
              <Layout className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Visual Form Response Inspector & PDF Generator</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                  {job.form_title || 'Form Submission'}
                </span>
              </h3>
              <p className="text-xs text-gray-400">
                Respondent: <strong className="text-gray-200">{job.user_name || 'Anonymous'}</strong> ({job.user_email || 'No email'}) • Job ID: {job.id.substring(0, 8)}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3 bg-white/5 border-b border-white/10 text-xs">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* View mode toggle */}
            <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-white/10">
              <button
                onClick={() => setViewMode('pdf')}
                className={`px-3 py-1 rounded-md font-semibold text-xs flex items-center gap-1.5 transition-all ${
                  viewMode === 'pdf' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF Print Preview</span>
              </button>
              <button
                onClick={() => setViewMode('html')}
                className={`px-3 py-1 rounded-md font-semibold text-xs flex items-center gap-1.5 transition-all ${
                  viewMode === 'html' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Layout className="w-3.5 h-3.5" />
                <span>HTML Card View</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-gray-300 font-medium flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Template:</span>
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="bg-slate-800 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.is_system ? '(Built-in)' : '(Custom)'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {successMsg && (
              <span className="text-emerald-400 font-semibold text-xs flex items-center gap-1 animate-pulse">
                <Check className="w-4 h-4" />
                <span>{successMsg}</span>
              </span>
            )}

            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </a>

            <button
              onClick={() => handleApplyTemplate(false)}
              disabled={saving}
              className="px-3.5 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
              <span>Apply Template</span>
            </button>

            <button
              onClick={() => handleApplyTemplate(true)}
              disabled={saving}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Save & Re-Print PDF</span>
            </button>
          </div>
        </div>

        {/* Live Visual Preview Canvas */}
        <div className="flex-1 bg-slate-950 p-4 overflow-auto flex items-center justify-center relative min-h-[500px]">
          {loading && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-10">
              <div className="flex items-center gap-2 text-indigo-400 font-medium text-sm">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Rendering Visual Template...</span>
              </div>
            </div>
          )}

          <div className="w-full h-full bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-300">
            {viewMode === 'pdf' ? (
              <iframe
                title="Form Response PDF Preview"
                src={pdfUrl}
                className="w-full h-full min-h-[520px] border-0"
              />
            ) : (
              <iframe
                title="Form Response Visual Render"
                srcDoc={previewHtml}
                className="w-full h-full min-h-[520px] border-0"
              />
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-950 border-t border-white/10 text-right text-[11px] text-gray-500">
          Form responses are rendered into 1-page-per-guest PDF documents and sent directly to print queues by PintFlow.
        </div>
      </div>
    </div>
  );
};

