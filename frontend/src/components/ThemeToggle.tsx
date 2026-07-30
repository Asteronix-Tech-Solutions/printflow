'use client';

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`relative flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-200 active:scale-95 ${
        theme === 'dark'
          ? 'bg-slate-800/80 hover:bg-slate-700/80 text-amber-300 border-slate-700/80 shadow-inner'
          : 'bg-white hover:bg-slate-100 text-indigo-600 border-slate-200 shadow-sm'
      } ${className}`}
      title={`Switch to ${theme === 'dark' ? 'Slate Light' : 'Slate Dark'} theme`}
    >
      {theme === 'dark' ? (
        <>
          <Sun className="w-4 h-4 text-amber-400 animate-in spin-in-180 duration-300" />
          <span className="hidden sm:inline">Slate Dark</span>
        </>
      ) : (
        <>
          <Moon className="w-4 h-4 text-indigo-600 animate-in spin-in-180 duration-300" />
          <span className="hidden sm:inline">Slate Light</span>
        </>
      )}
    </button>
  );
};
