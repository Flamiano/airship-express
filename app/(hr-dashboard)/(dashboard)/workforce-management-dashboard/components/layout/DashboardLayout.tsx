'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TopNav } from './TopNav';
import { Sidebar } from './Sidebar';
import { SidebarProvider } from './SidebarContext';
import { ThemeProvider } from '@/app/components/ThemeProvider';
import '../../hrWorkforce.css';

interface DashboardLayoutProps {
  children: React.ReactNode;
  realtimeConnected?: boolean;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <div className="flex h-dvh w-full bg-paper text-ink font-rethink overflow-hidden" suppressHydrationWarning>
          <Sidebar />

          <div className="flex min-w-0 flex-1 flex-col h-full bg-paper">
            <TopNav />

            <main className="w-full min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-10">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                className="space-y-6"
              >
                {children}
              </motion.div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ThemeProvider>
  );
}
