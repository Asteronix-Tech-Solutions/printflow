'use client';

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  iconOnly?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', iconOnly = false }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={`btn-secondary relative flex items-center justify-center gap-2 rounded-none text-xs font-black tracking-wider uppercase transition-all duration-200 active:scale-95 ${
        iconOnly ? 'w-10 h-10 p-0' : 'px-3 py-2'
      } ${className}`}
      title={`Switch to ${theme === 'dark' ? 'Slate Light' : 'Slate Dark'} theme`}
    >
      {theme === 'dark' ? (
        <>
          <Sun className="w-4 h-4 text-amber-400 shrink-0" />
          {!iconOnly && <span>DARK</span>}
        </>
      ) : (
        <>
          <Moon className="w-4 h-4 text-indigo-600 shrink-0" />
          {!iconOnly && <span>LIGHT</span>}
        </>
      )}
    </button>
  );
};
