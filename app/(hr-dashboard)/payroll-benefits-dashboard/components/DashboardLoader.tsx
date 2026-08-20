'use client';

import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

interface DashboardLoaderProps {
    title?: string;
    description?: string;
}

export default function DashboardLoader({
    title,
    description
}: DashboardLoaderProps) {
    const pathname = usePathname();

    const loadingMessages = {
        '/payroll-benefits-dashboard': {
            title: 'Loading your Payroll Dashboard',
            description: 'Preparing your payroll cycles, claims, and analytics...'
        },
        '/payroll-benefits-dashboard/compensation-planning': {
            title: 'Loading your Compensation Plan',
            description: 'Calculating salary structures and bonus allocations...'
        },
        '/payroll-benefits-dashboard/claims-and-reimbursement': {
            title: 'Loading your Claims',
            description: 'Fetching pending requests and reimbursement history...'
        },
        '/payroll-benefits-dashboard/benefits': {
            title: 'Loading your Benefits',
            description: 'Updating SSS, PhilHealth, and Pag-IBIG contribution tables...'
        },
        '/payroll-benefits-dashboard/hr-analytics-dashboard': {
            title: 'Loading your Analytics',
            description: 'Compiling workforce data and performance metrics...'
        }
    };

    // Determine which message to use
    const currentMessage = loadingMessages[pathname as keyof typeof loadingMessages];
    const displayTitle = title || currentMessage?.title || 'Loading your dashboard';
    const displayDescription = description || currentMessage?.description || 'Getting your payroll & benefits ready...';

    return (
        <div className="flex h-full w-full items-center justify-center bg-paper text-ink font-rethink">
            <div className="flex flex-col items-center gap-6">

                {/* Brand Logo Animation */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/10"
                >
                    <div className="h-12 w-12 rounded-full border-4 border-line border-t-accent animate-spin" />
                    <div className="absolute inset-0 rounded-3xl bg-accent/5 animate-pulse" />
                </motion.div>

                {/* Dynamic Loading Text */}
                <div className="flex flex-col items-center gap-2">
                    <motion.h2
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.4, ease: 'easeOut' }}
                        className="font-bricolage text-2xl font-medium tracking-tight text-ink"
                    >
                        {displayTitle}
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35, duration: 0.4, ease: 'easeOut' }}
                        className="text-sm text-muted"
                    >
                        {displayDescription}
                    </motion.p>
                </div>

                {/* Animated Dots */}
                <div className="flex gap-2.5 mt-1">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0.2, scale: 0.8 }}
                            animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1, 0.8] }}
                            transition={{
                                duration: 1.2,
                                repeat: Infinity,
                                delay: i * 0.2,
                                ease: 'easeInOut',
                            }}
                            className="h-3 w-3 rounded-full bg-accent"
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}