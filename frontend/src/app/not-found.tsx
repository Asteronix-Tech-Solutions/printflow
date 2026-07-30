import React from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 font-sans">
      <div className="glass-panel p-8 max-w-md w-full border border-slate-800 rounded-none text-center space-y-4 shadow-2xl">
        <div className="w-12 h-12 bg-rose-500/10 text-rose-500 border border-rose-500/30 rounded-none mx-auto flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-black uppercase tracking-wider">PAGE NOT FOUND</h1>
        <p className="text-xs text-slate-400 font-semibold">
          The requested page or print flow endpoint does not exist on this server.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-none inline-flex items-center gap-2 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>RETURN TO DASHBOARD</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
