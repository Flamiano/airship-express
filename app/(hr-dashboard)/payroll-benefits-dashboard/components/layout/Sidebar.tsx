'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
    LayoutDashboard,
    Wallet,
    TrendingUp,
    Receipt,
    HeartPulse,
    BarChart3,
    Bot,
    X,
} from 'lucide-react';
import { useSidebar } from './SidebarContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';

const MODULES = [
    {
        icon: Wallet,
        label: 'Payroll',
        full: 'Payroll Management',
        href: '/payroll-benefits-dashboard/payroll'
    },
    {
        icon: TrendingUp,
        label: 'Compensation',
        full: 'Compensation Planning',
        href: '/payroll-benefits-dashboard/compensation-planning'
    },
    {
        icon: Receipt,
        label: 'Claims',
        full: 'Claims and Reimbursement',
        href: '/payroll-benefits-dashboard/claims-and-reimbursement'
    },
    {
        // UPDATED: Now points to your new Government Contributions dashboard
        icon: HeartPulse,
        label: 'Benefits',
        full: 'Benefits & Gov\'t Contributions',
        href: '/payroll-benefits-dashboard/benefits'
    },
    {
        icon: BarChart3,
        label: 'Analytics',
        full: 'HR Analytics Dashboard',
        href: '/payroll-benefits-dashboard/hr-analytics-dashboard'
    },
];

const logoVariants: Variants = {
    hidden: { opacity: 0, y: -8, filter: 'blur(4px)' },
    show: {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
    },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, x: -6 },
    show: (i: number) => ({
        opacity: 1,
        x: 0,
        transition: { duration: 0.35, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] },
    }),
};

export default function Sidebar() {
    const pathname = usePathname();
    const { isOpen, close, isCollapsed } = useSidebar();
    const { user, loading } = useCurrentUser();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        setReady(true);
    }, []);

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={close}
                        className="fixed inset-0 z-30 bg-ink/30 backdrop-blur-[1px] sm:hidden"
                    />
                )}
            </AnimatePresence>

            <aside
                className={`fixed inset-y-0 left-0 z-40 h-full shrink-0 -translate-x-full border-r border-line bg-paper transition-transform duration-300 ease-out sm:sticky sm:top-0 sm:z-0 sm:h-dvh sm:translate-x-0 dark:border-line ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div
                    className={`flex h-full w-72 flex-col transition-[width] duration-300 ease-out sm:w-64 ${isCollapsed ? 'sm:w-[76px]' : 'sm:w-64'
                        }`}
                >
                    {/* mobile close */}
                    <div className="flex items-center justify-between px-5 pt-5 sm:hidden">
                        <span className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-accent">
                            Menu
                        </span>
                        <button
                            type="button"
                            onClick={close}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/[0.08] hover:text-ink"
                            aria-label="Close menu"
                        >
                            <X size={16} strokeWidth={1.75} />
                        </button>
                    </div>

                    {/* brand header */}
                    <div
                        className={`flex h-16 items-center border-b border-line px-5 dark:border-line ${isCollapsed ? 'sm:justify-center sm:px-3' : ''
                            }`}
                    >
                        <motion.div
                            variants={logoVariants}
                            initial="hidden"
                            animate={ready ? 'show' : 'hidden'}
                            className="flex min-w-0 items-center gap-3"
                        >
                            <Link
                                href="/payroll-benefits-dashboard"
                                className="flex shrink-0 items-center"
                            >
                                <Image
                                    src="/images/logo-remove-bg.png"
                                    alt="Airship Express"
                                    width={130}
                                    height={36}
                                    priority
                                    className="h-7 w-auto object-contain sm:h-8 dark:brightness-0 dark:invert"
                                />
                            </Link>

                            {!isCollapsed && (
                                <div className="min-w-0 leading-none">
                                    <p className="truncate text-[13px] font-semibold tracking-tight text-ink">
                                        Airship Express
                                    </p>
                                    <p className="mt-1 truncate text-[10.5px] font-medium uppercase tracking-[0.14em] text-accent">
                                        Payroll &amp; Benefits
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    </div>

                    {/* nav */}
                    <nav className="flex flex-1 flex-col gap-7 overflow-y-auto px-3 py-6">
                        <div>
                            {!isCollapsed && (
                                <p className="mb-2 px-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted">
                                    Main
                                </p>
                            )}
                            <motion.div
                                custom={0}
                                variants={itemVariants}
                                initial="hidden"
                                animate={ready ? 'show' : 'hidden'}
                            >
                                <Link
                                    href="/payroll-benefits-dashboard"
                                    title="Dashboard"
                                    onClick={close}
                                    className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all ${isCollapsed ? 'justify-center' : ''
                                        } ${pathname === '/payroll-benefits-dashboard'
                                            ? 'bg-accent text-paper shadow-sm shadow-accent/25'
                                            : 'text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-paper/[0.06]'
                                        }`}
                                >
                                    <LayoutDashboard
                                        size={17}
                                        strokeWidth={1.9}
                                        className={pathname === '/payroll-benefits-dashboard' ? '' : 'text-muted group-hover:text-ink'}
                                    />
                                    {!isCollapsed && 'Dashboard'}
                                </Link>
                            </motion.div>
                        </div>

                        <div>
                            {!isCollapsed && (
                                <p className="mb-2 px-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted">
                                    Modules
                                </p>
                            )}
                            <div className="flex flex-col gap-1">
                                {MODULES.map(({ icon: Icon, label, full, href }, i) => {
                                    const active = pathname === href;
                                    return (
                                        <motion.div
                                            key={href}
                                            custom={i + 1}
                                            variants={itemVariants}
                                            initial="hidden"
                                            animate={ready ? 'show' : 'hidden'}
                                        >
                                            <Link
                                                href={href}
                                                title={full}
                                                onClick={close}
                                                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all ${isCollapsed ? 'justify-center' : ''
                                                    } ${active
                                                        ? 'bg-accent text-paper shadow-sm shadow-accent/25'
                                                        : 'text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-paper/[0.06]'
                                                    }`}
                                            >
                                                <Icon
                                                    size={17}
                                                    strokeWidth={1.9}
                                                    className={active ? '' : 'text-muted group-hover:text-ink'}
                                                />
                                                {!isCollapsed && label}
                                            </Link>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            {!isCollapsed && (
                                <p className="mb-2 px-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted">
                                    Tools
                                </p>
                            )}
                            <motion.div
                                custom={MODULES.length + 1}
                                variants={itemVariants}
                                initial="hidden"
                                animate={ready ? 'show' : 'hidden'}
                            >
                                <Link
                                    href="/payroll-benefits-dashboard/chatbot"
                                    title="Payroll Assistant"
                                    onClick={close}
                                    className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all ${isCollapsed ? 'justify-center' : ''
                                        } ${pathname === '/payroll-benefits-dashboard/chatbot'
                                            ? 'bg-accent text-paper shadow-sm shadow-accent/25'
                                            : 'text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-paper/[0.06]'
                                        }`}
                                >
                                    <Bot
                                        size={17}
                                        strokeWidth={1.9}
                                        className={pathname === '/payroll-benefits-dashboard/chatbot' ? '' : 'text-muted group-hover:text-ink'}
                                    />
                                    {!isCollapsed && (
                                        <>
                                            Assistant
                                            <span
                                                className={`ml-auto rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide ${pathname === '/payroll-benefits-dashboard/chatbot'
                                                    ? 'bg-paper/20 text-paper'
                                                    : 'bg-accent/10 text-accent'
                                                    }`}
                                            >
                                                AI
                                            </span>
                                        </>
                                    )}
                                </Link>
                            </motion.div>
                        </div>
                    </nav>

                    {/* footer identity */}
                    {user && (
                        <div className={`mt-auto border-t border-line px-4 py-4 dark:border-line ${isCollapsed ? 'sm:px-2' : ''}`}>
                            <div className={`flex items-center gap-2.5 ${isCollapsed ? 'sm:justify-center' : ''}`}>
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-paper">
                                    {user.initials}
                                </span>
                                {!isCollapsed && (
                                    <div className="min-w-0 leading-none">
                                        <p className="truncate text-[12.5px] font-medium text-ink">{user.fullName}</p>
                                        <p className="mt-1 truncate text-[10.5px] capitalize text-muted">
                                            {user.role.replace(/_/g, ' ')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
}