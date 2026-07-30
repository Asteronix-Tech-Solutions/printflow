'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Printer,
  LayoutDashboard,
  Activity,
  Settings,
  PlusCircle,
  Menu,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { PrinterStatus } from '../lib/api';

interface SidebarProps {
  printer?: PrinterStatus;
  onOpenPrinterModal: () => void;
  onOpenQueueModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  printer,
  onOpenPrinterModal,
  onOpenQueueModal,
}) => {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navItems = [
    {
      label: 'Dashboard',
      href: '/',
      icon: LayoutDashboard,
    },
    {
      label: 'System Activity',
      href: '/activity',
      icon: Activity,
    },
  ];

  return (
    <>
      {/* Mobile Top Header Bar with Hamburger */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-40 text-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl shadow-md">
            <Printer className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-lg tracking-tight">PrintFlow</span>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="p-2 bg-slate-800 text-slate-200 rounded-xl border border-slate-700 hover:bg-slate-700"
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Backdrop overlay for mobile drawer */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Desktop Sidebar & Mobile Drawer */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-64 bg-slate-900/95 dark:bg-slate-950/90 border-r border-slate-200 dark:border-slate-800/80 backdrop-blur-xl flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5">
          {/* Brand Header */}
          <div className="flex items-center justify-between mb-8">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
                <Printer className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                  PrintFlow
                </h1>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Google Form Auto-Print
                </p>
              </div>
            </Link>

            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Primary Action CTA */}
          <button
            onClick={() => {
              setIsMobileOpen(false);
              onOpenQueueModal();
            }}
            className="w-full mb-6 py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Print New Document</span>
          </button>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer section in Sidebar */}
        <div className="p-5 border-t border-slate-200 dark:border-slate-800/80 space-y-3.5">
          {/* Printer Status Badge */}
          {printer && (
            <div
              className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-all ${
                printer.is_online
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/25'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/25'
              }`}
            >
              {printer.is_online ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              )}
              <div className="truncate">
                <p className="font-bold truncate">{printer.name}</p>
                <p className="text-[10px] opacity-80">{printer.is_online ? 'Online & Ready' : 'Offline'}</p>
              </div>
            </div>
          )}

          {/* Theme Switcher & Settings Button */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <ThemeToggle />
            <button
              onClick={() => {
                setIsMobileOpen(false);
                onOpenPrinterModal();
              }}
              className="p-2 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 transition-all"
              title="Printer & System Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
