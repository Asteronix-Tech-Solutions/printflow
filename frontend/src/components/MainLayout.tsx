'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { QueueJobModal } from './QueueJobModal';
import { PrinterConfigModal } from './PrinterConfigModal';
import { PrinterStatus } from '../lib/api';

interface MainLayoutProps {
  children: (props: {
    isQueueModalOpen: boolean;
    setIsQueueModalOpen: (open: boolean) => void;
    isPrinterModalOpen: boolean;
    setIsPrinterModalOpen: (open: boolean) => void;
  }) => React.ReactNode;
  printer?: PrinterStatus;
  onRefreshData?: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  printer,
  onRefreshData,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('printflow_sidebar_collapsed');
    if (saved === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  const toggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('printflow_sidebar_collapsed', String(nextState));
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] transition-colors duration-200 flex flex-col lg:flex-row">
      {/* Sidebar Component */}
      <Sidebar
        printer={printer}
        onOpenPrinterModal={() => setIsPrinterModalOpen(true)}
        onOpenQueueModal={() => setIsQueueModalOpen(true)}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
      />

      {/* Dynamic Margin Main Container */}
      <div
        className={`flex-1 w-full min-h-screen transition-[margin-left] duration-300 ease-in-out ${
          isCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children({
            isQueueModalOpen,
            setIsQueueModalOpen,
            isPrinterModalOpen,
            setIsPrinterModalOpen,
          })}
        </div>
      </div>

      {/* Global Modals */}
      <QueueJobModal
        isOpen={isQueueModalOpen}
        onClose={() => setIsQueueModalOpen(false)}
        onJobQueued={() => onRefreshData && onRefreshData()}
      />

      <PrinterConfigModal
        isOpen={isPrinterModalOpen}
        onClose={() => setIsPrinterModalOpen(false)}
        onConfigSaved={() => onRefreshData && onRefreshData()}
      />
    </div>
  );
};
