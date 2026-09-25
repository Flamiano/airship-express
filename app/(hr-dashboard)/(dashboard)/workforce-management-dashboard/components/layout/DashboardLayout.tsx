'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TopNav } from './TopNav';
import { Sidebar } from './Sidebar';
import { SidebarProvider } from './SidebarContext';
import { AiSplitProvider, useAiSplit } from './AiSplitContext';
import { AiConversationSplit } from './AiConversationSplit';
import { ThemeProvider } from '@/app/components/ThemeProvider';
import '../../hrWorkforce.css';

interface DashboardLayoutProps {
  children: React.ReactNode;
  realtimeConnected?: boolean;
}

function MainContent({ children }: { children: React.ReactNode }) {
  const { isAiSplitOpen, closeAiSplit, initialQuery } = useAiSplit();
  
  return (
    <div className="flex min-w-0 flex-1 flex-col h-full bg-paper">
      <TopNav />
      <div className="flex flex-1 min-h-0 overflow-hidden transition-[width] duration-300">
        <main className="flex-1 min-w-0 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-10 bg-ink/5 dark:bg-[#0a0a0a]">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="space-y-6"
          >
            {children}
          </motion.div>
        </main>
        <AiConversationSplit 
          isOpen={isAiSplitOpen} 
          onClose={closeAiSplit} 
          initialQuery={initialQuery}
        />
      </div>
    </div>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <ThemeProvider>
      <AiSplitProvider>
        <SidebarProvider>
          <div className="flex h-dvh w-full bg-paper text-ink font-rethink overflow-hidden" suppressHydrationWarning>
            <Sidebar />
            <MainContent>{children}</MainContent>
          </div>
        </SidebarProvider>
      </AiSplitProvider>
    </ThemeProvider>
  );
}
