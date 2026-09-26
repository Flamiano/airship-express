'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { useSidebar } from './SidebarContext';

interface DashboardLayoutProps {
    children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const { isCollapsed } = useSidebar();

    return (
        <div className="flex h-dvh w-full bg-paper text-ink font-rethink overflow-hidden">
            <Sidebar />

            <div className="flex min-w-0 flex-1 flex-col h-full bg-paper">
                <Navbar />

                <main className="w-full min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-10">
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, ease: 'easeOut' }}
                    >
                        {children}
                    </motion.div>
                </main>
            </div>
        </div>
    );
}