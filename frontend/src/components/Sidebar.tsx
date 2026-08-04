'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Printer,
  LayoutDashboard,
  Activity,
  ScanLine,
  Settings,
  PlusCircle,
  Menu,
  X,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { PrinterStatus } from '../lib/api';

interface SidebarProps {
  printer?: PrinterStatus;
  onOpenPrinterModal: () => void;
  onOpenQueueModal: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  printer,
  onOpenPrinterModal,
  onOpenQueueModal,
  isCollapsed,
  onToggleCollapse,
}) => {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navItems = [
    {
      label: 'DASHBOARD',
      href: '/',
      icon: LayoutDashboard,
    },
    {
      label: 'SCANNER',
      href: '/scan',
      icon: ScanLine,
    },
    {
      label: 'SYSTEM ACTIVITY',
      href: '/activity',
      icon: Activity,
    },
  ];

  const showExpanded = !isCollapsed || isMobileOpen;

  return (
    <>
      {/* Mobile Top Header Bar with Hamburger */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-[var(--bg-sidebar)] border-b border-[var(--border-color)] sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-r from-[#0066b1] via-[#1c69d4] to-[#e22718] text-white rounded-none shadow-md">
            <Printer className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-lg tracking-tight uppercase">PRINTFLOW</span>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="btn-secondary p-2 rounded-none"
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Backdrop overlay for mobile drawer */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Desktop Sidebar & Mobile Drawer */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] flex flex-col justify-between transition-[width,transform] duration-300 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        <div>
          {/* M Tricolor Header Stripe */}
          <div className="m-stripe-line" />

          {/* Brand Header & Desktop Collapse Toggle */}
          <div className="p-4 sm:p-5">
            {showExpanded ? (
              <div className="flex items-center justify-between w-full">
                <Link href="/" className="flex items-center gap-3 group overflow-hidden">
                  <div className="p-2.5 bg-gradient-to-br from-[#0066b1] via-[#1c69d4] to-[#e22718] text-white rounded-none shadow-lg group-hover:scale-105 transition-transform shrink-0">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div className="truncate">
                    <h1 className="text-lg font-black tracking-wider uppercase">
                      PRINTFLOW
                    </h1>
                    <p className="text-[10px] font-semibold text-[var(--text-subtle)] uppercase tracking-widest">
                      M-PRINT ENGINE
                    </p>
                  </div>
                </Link>

                <button
                  onClick={onToggleCollapse}
                  className="btn-secondary hidden lg:flex w-8 h-8 items-center justify-center rounded-none shrink-0"
                  title="Collapse Sidebar"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* Collapsed Header Layout */
              <div className="flex flex-col items-center gap-3 w-full">
                <Link
                  href="/"
                  className="p-2.5 bg-gradient-to-br from-[#0066b1] via-[#1c69d4] to-[#e22718] text-white rounded-none shadow-lg flex items-center justify-center"
                  title="PrintFlow Dashboard"
                >
                  <Printer className="w-5 h-5" />
                </Link>

                <button
                  onClick={onToggleCollapse}
                  className="btn-secondary hidden lg:flex w-8 h-8 items-center justify-center rounded-none"
                  title="Expand Sidebar"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Quick Primary Action CTA */}
          <div className="px-3 sm:px-4 mb-4">
            {showExpanded ? (
              <button
                onClick={() => {
                  setIsMobileOpen(false);
                  onOpenQueueModal();
                }}
                className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs tracking-wider uppercase rounded-none shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                title="Print New Document"
              >
                <PlusCircle className="w-4 h-4 shrink-0" />
                <span>PRINT DOCUMENT</span>
              </button>
            ) : (
              <button
                onClick={onOpenQueueModal}
                className="w-10 h-10 mx-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs rounded-none shadow-lg flex items-center justify-center transition-all active:scale-95"
                title="Print New Document"
              >
                <PlusCircle className="w-5 h-5 shrink-0" />
              </button>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="px-2 sm:px-3 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center rounded-none text-xs font-bold tracking-wider uppercase transition-all relative group ${
                    showExpanded
                      ? 'px-3.5 py-3 gap-3 justify-start w-full'
                      : 'w-10 h-10 mx-auto justify-center text-center p-0'
                  } ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md m-stripe-accent'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--btn-secondary-hover)]'
                  }`}
                  title={!showExpanded ? item.label : undefined}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : ''}`} />
                  {showExpanded && <span className="truncate">{item.label}</span>}

                  {/* Tooltip for Collapsed State */}
                  {!showExpanded && (
                    <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 text-white text-[11px] font-bold rounded-none shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 uppercase tracking-wider border border-slate-700">
                      {item.label}
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer section in Sidebar */}
        <div className="p-3 sm:p-4 border-t border-[var(--border-color)] space-y-3">
          {/* Printer Status Badge */}
          {printer && (
            showExpanded ? (
              <div
                className={`p-3 rounded-none border text-xs font-semibold flex items-center gap-2.5 transition-all ${
                  printer.is_online
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                }`}
              >
                {printer.is_online ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                )}
                <div className="truncate">
                  <p className="font-extrabold truncate uppercase text-[11px]">{printer.name}</p>
                  <p className="text-[10px] opacity-80">{printer.is_online ? 'ONLINE & READY' : 'OFFLINE'}</p>
                </div>
              </div>
            ) : (
              <div
                className={`w-10 h-10 mx-auto rounded-none border text-xs flex items-center justify-center transition-all ${
                  printer.is_online
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                }`}
                title={`${printer.name} (${printer.is_online ? 'ONLINE' : 'OFFLINE'})`}
              >
                {printer.is_online ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                )}
              </div>
            )
          )}

          {/* Theme Switcher & Settings Button */}
          {showExpanded ? (
            <div className="flex items-center justify-between gap-2">
              <ThemeToggle />
              <button
                onClick={() => {
                  setIsMobileOpen(false);
                  onOpenPrinterModal();
                }}
                className="btn-secondary p-2 rounded-none"
                title="Printer & System Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <ThemeToggle iconOnly />
              <button
                onClick={onOpenPrinterModal}
                className="btn-secondary w-10 h-10 flex items-center justify-center rounded-none"
                title="Printer & System Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Credit Footer */}
          {showExpanded ? (
            <p className="text-[10px] text-[var(--text-subtle)] text-center pt-3 leading-relaxed">
              Made with ♥ by{' '}
              <a
                href="https://itsashik.dev"
                target="_blank"
                rel="noreferrer"
                className="font-bold text-indigo-500 hover:text-indigo-400 transition-colors"
              >
                Ashik Eqbal
              </a>
            </p>
          ) : (
            <a
              href="https://itsashik.dev"
              target="_blank"
              rel="noreferrer"
              className="block text-[10px] text-[var(--text-subtle)] text-center pt-2 hover:text-indigo-500 transition-colors"
              title="Made with ♥ by Ashik Eqbal"
            >
              ♥
            </a>
          )}
        </div>
      </aside>
    </>
  );
};
