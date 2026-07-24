'use client';

import React, { useEffect, useState } from 'react';
import { X, Layout, Plus, Trash2, Save, Eye, Code, Sparkles, Check, HelpCircle } from 'lucide-react';
import { FormTemplate, fetchTemplates, saveTemplate, deleteTemplate, previewTemplate } from '../lib/api';

interface TemplateManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TemplateManagerModal: React.FC<TemplateManagerModalProps> = ({ isOpen, onClose }) => {
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<Partial<FormTemplate>>({});
  const [htmlContent, setHtmlContent] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    try {
      const res = await fetchTemplates();
      const tmpls = res.templates || [];
      setTemplates(tmpls);
      if (tmpls.length > 0) {
        selectTemplate(tmpls[0]);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const selectTemplate = (tmpl: FormTemplate) => {
    setActiveTemplate(tmpl);
    setHtmlContent(tmpl.content_html || '');
    updatePreview(tmpl.content_html || '', tmpl.id);
  };

  const handleNewTemplate = () => {
    const newTmpl: Partial<FormTemplate> = {
      id: '',
      name: 'My Custom Response Template',
      description: 'Custom HTML visual layout for Google Form printouts',
      is_system: false,
      content_html: `<div style="font-family: sans-serif; padding: 20px; border: 2px solid #4f46e5; border-radius: 8px;">\n  <h2>{{.FormTitle}}</h2>\n  <p><strong>Respondent:</strong> {{.UserName}} ({{.UserEmail}})</p>\n  <hr/>\n  <table style="width: 100%; border-collapse: collapse;">\n    {{range .Responses}}\n    <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>{{.Question}}</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">{{.Answer}}</td></tr>\n    {{end}}\n  </table>\n</div>`,
    };
    setActiveTemplate(newTmpl);
    setHtmlContent(newTmpl.content_html || '');
    updatePreview(newTmpl.content_html || '');
  };

  const updatePreview = async (code: string, templateId?: string) => {
    try {
      const res = await previewTemplate({
        template_html: code,
        template_id: templateId,
      });
      setPreviewHtml(res.html || '');
    } catch (err) {
      console.error('Preview render error:', err);
    }
  };

  const handleSave = async () => {
    if (!activeTemplate.name) return;
    setSaving(true);
    setMessage('');
    try {
      const payload: Partial<FormTemplate> = {
        ...activeTemplate,
        content_html: htmlContent,
      };
      const res = await saveTemplate(payload);
      setMessage('Template saved successfully!');
      await loadTemplates();
      if (res.template) {
        setActiveTemplate(res.template);
      }
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this custom template?')) return;
    try {
      await deleteTemplate(id);
      loadTemplates();
    } catch (err: any) {
      alert(err.message || 'Failed to delete template');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/20 rounded-xl text-indigo-400 border border-indigo-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Visual Response Formatter & Template Manager
              </h3>
              <p className="text-xs text-gray-400">
                Customize printable HTML layouts and view response templates for Google Form submissions
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

        {/* Main Content Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Sidebar Template List */}
          <div className="w-full md:w-72 bg-slate-950 border-r border-white/10 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Templates</span>
              <button
                onClick={handleNewTemplate}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {templates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  onClick={() => selectTemplate(tmpl)}
                  className={`p-3 rounded-xl cursor-pointer border transition-all ${
                    activeTemplate.id === tmpl.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                      : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-xs truncate">{tmpl.name}</span>
                    {tmpl.is_system ? (
                      <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.2 rounded font-mono">
                        System
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(tmpl.id);
                        }}
                        className="text-gray-500 hover:text-rose-400 p-0.5"
                        title="Delete custom template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 line-clamp-2">{tmpl.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Editor / Preview Area */}
          <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
            {/* Template Title & Metadata Form */}
            <div className="p-4 bg-white/5 border-b border-white/10 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  placeholder="Template Name"
                  value={activeTemplate.name || ''}
                  disabled={activeTemplate.is_system}
                  onChange={(e) => setActiveTemplate({ ...activeTemplate, name: e.target.value })}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                />
                <input
                  type="text"
                  placeholder="Short Description"
                  value={activeTemplate.description || ''}
                  disabled={activeTemplate.is_system}
                  onChange={(e) => setActiveTemplate({ ...activeTemplate, description: e.target.value })}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                />
              </div>

              {/* Tabs & Actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-white/10">
                  <button
                    onClick={() => setActiveTab('editor')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                      activeTab === 'editor' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Code className="w-3.5 h-3.5" />
                    <span>HTML Editor</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('preview');
                      updatePreview(htmlContent, activeTemplate.id);
                    }}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                      activeTab === 'preview' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Live Preview</span>
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {message && (
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>{message}</span>
                    </span>
                  )}
                  {!activeTemplate.is_system && (
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Template</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Code Editor or Live Preview Pane */}
            <div className="flex-1 overflow-hidden relative p-4 flex flex-col">
              {activeTab === 'editor' ? (
                <div className="flex-1 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] text-gray-400 bg-slate-950 p-2 rounded-t-xl border border-white/10">
                    <span className="font-mono text-indigo-300">Template HTML Code</span>
                    <span className="flex items-center gap-1 text-amber-400 font-medium">
                      <HelpCircle className="w-3 h-3" />
                      <span>Placeholders: &#123;&#123;.FormTitle&#125;&#125;, &#123;&#123;.UserName&#125;&#125;, &#123;&#123;.UserEmail&#125;&#125;, &#123;&#123;.Responses&#125;&#125;</span>
                    </span>
                  </div>
                  <textarea
                    value={htmlContent}
                    disabled={activeTemplate.is_system}
                    onChange={(e) => {
                      setHtmlContent(e.target.value);
                      updatePreview(e.target.value, activeTemplate.id);
                    }}
                    placeholder="Enter custom HTML template..."
                    className="flex-1 bg-slate-950 font-mono text-xs text-indigo-100 p-4 rounded-b-xl border border-t-0 border-white/10 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed disabled:opacity-75"
                  />
                </div>
              ) : (
                <div className="flex-1 bg-white rounded-xl shadow-inner overflow-hidden border border-gray-300">
                  <iframe
                    title="Live Template Preview"
                    srcDoc={previewHtml}
                    className="w-full h-full min-h-[450px] border-0"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-2.5 bg-slate-950 border-t border-white/10 text-xs text-gray-400 flex items-center justify-between">
          <span className="text-gray-500">
            Presets include: Property & Guest Registration Card, Modern Table Summary, Compact Guest Pass, ID Compliance Form.
          </span>
          <span className="text-indigo-400 font-medium">PintFlow Visual Formatter v1.1</span>
        </div>
      </div>
    </div>
  );
};
