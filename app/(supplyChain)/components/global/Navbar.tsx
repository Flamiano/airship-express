"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { NAV } from "../../lib/navigation";
import Image from "next/image";
import {
    Navbar,
    NavBody,
    MobileNav,
    MobileNavHeader,
    MobileNavMenu,
    MobileNavToggle,
} from "@/app/(supplyChain)/components/ui/resizable-navbar";
import {
    IconChevronDown,
    IconLogout,
    IconUser,
    IconLock,
} from "@tabler/icons-react";
import { useAI } from "../../ai/services/AIContext";
import {
    AnimatePresence,
    motion,
} from "motion/react";
import { cn } from "@/app/(supplyChain)/lib/utils";
import { RobotHeader } from "../../ai/components/RobotHeader";
import { toast } from "sonner";
import { useConfirm } from "@/app/(supplyChain)/components/ui/ConfirmModal";
import { NotificationBell } from "./NotificationBell";
import ThemeToggle from "@/app/components/ThemeToggle";

import '@fortawesome/fontawesome-free/css/all.min.css';

interface NavItem {
    id: string;
    label: string;
    href: string;
    icon: string;
    roles?: string[];
}

interface NavGroup {
    section: string;
    items: NavItem[];
}

export function AceternityNavbar() {
    const [isOpen, setIsOpen] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string>("User");
    const [userName, setUserName] = useState<string>("User");
    const [filteredNav, setFilteredNav] = useState<NavGroup[]>([]);
    const router = useRouter();
    const pathname = usePathname();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const { confirm } = useConfirm();

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const role = localStorage.getItem('user_role');
            const employeeName = localStorage.getItem('user_name');
            if (role) {
                setUserRole(role);
                filterNavigation(role);
            }
            if (employeeName) {
                setUserName(employeeName);
            }
        }
    }, []);

    const filterNavigation = (role: string) => {
        const filtered = (NAV as NavGroup[]).map((group: NavGroup) => {
            const items = group.items.map((item: NavItem) => {
                const isAuthorized = !item.roles || item.roles.length === 0 || item.roles.includes(role);
                return {
                    ...item,
                    isAuthorized,
                };
            });

            return {
                ...group,
                items,
            };
        });

        setFilteredNav(filtered);
    };

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }

        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    const isActive = (href: string) => {
        if (href === '/') {
            return pathname === href;
        }
        return pathname.startsWith(href);
    };

    const isSectionActive = (group: NavGroup) => {
        return group.items.some((item) => isActive(item.href));
    };

    const getSectionIcon = (section: string) => {
        switch (section) {
            case "Operations":
                return "fa-solid fa-gears";
            case "Procurement":
                return "fa-solid fa-cart-shopping";
            case "Intelligence":
                return "fa-solid fa-brain";
            case "Others":
                return "fa-solid fa-shapes";
            default:
                return "fa-solid fa-folder";
        }
    };

    const getSectionAccent = (section: string) => {
        return {
            badge: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-200/50 dark:border-pink-800/50",
            active: "text-pink-600 dark:text-pink-400 bg-pink-50/70 dark:bg-pink-950/30 border-pink-200/80 dark:border-pink-800/60 shadow-sm",
            indicator: "bg-pink-500 dark:bg-pink-400",
            iconColor: "text-pink-500 dark:text-pink-400",
        };
    };

    const handleLogout = async () => {
        const confirmed = await confirm({
            title: "Logout",
            message: "Are you sure you want to logout?",
            confirmText: "Logout",
            cancelText: "Cancel",
        });

        if (!confirmed) {
            return;
        }

        setIsLoggingOut(true);

        try {
            const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;

            if (sessionToken) {
                await fetch('/api/supplyChain/logout', {
                    method: 'POST',
                    headers: { 'x-session-token': sessionToken }
                });
            }

            if (typeof window !== 'undefined') {
                // Clear main session data
                localStorage.removeItem('session_token');
                localStorage.removeItem('user_role');
                localStorage.removeItem('session_expires');
                localStorage.removeItem('user_name');
                localStorage.removeItem('user_email');
                localStorage.removeItem('logged_in_email');
                localStorage.removeItem('user_agent');
                localStorage.removeItem('user_ip');
                localStorage.removeItem('user_id');

                // Clear all backup data
                localStorage.removeItem('session_backup');
                localStorage.removeItem('session_backup_2');
                localStorage.removeItem('session_backup_3');

                // Clear sessionStorage backup
                try {
                    sessionStorage.removeItem('session_backup');
                } catch (e) {
                    // sessionStorage might not be available
                }

                // Clear cookie backups
                document.cookie = 'session_token=; path=/; max-age=0';
                document.cookie = 'session_backup=; path=/; max-age=0';
                document.cookie = 'session_backup_2=; path=/; max-age=0';
                document.cookie = 'session_backup_3=; path=/; max-age=0';
            }

            toast.success('Logged out successfully');
            router.push('/scAuth');
            router.refresh();
        } catch (error) {
            console.error('Logout error:', error);
            if (typeof window !== 'undefined') {

                localStorage.removeItem('session_token');
                localStorage.removeItem('user_role');
                localStorage.removeItem('session_expires');
                localStorage.removeItem('user_name');
                localStorage.removeItem('user_email');
                localStorage.removeItem('logged_in_email');
                localStorage.removeItem('user_agent');
                localStorage.removeItem('user_ip');
                localStorage.removeItem('user_id');

                // Clear all backup data
                localStorage.removeItem('session_backup');
                localStorage.removeItem('session_backup_2');
                localStorage.removeItem('session_backup_3');


                try {
                    sessionStorage.removeItem('session_backup');
                } catch (e) {

                }
                document.cookie = 'session_token=; path=/; max-age=0';
                document.cookie = 'session_backup=; path=/; max-age=0';
                document.cookie = 'session_backup_2=; path=/; max-age=0';
                document.cookie = 'session_backup_3=; path=/; max-age=0';
            }
            toast.error('Logout failed. Please try again.');
            router.push('/scAuth');
        } finally {
            setIsLoggingOut(false);
        }
    };

    return (
        <Navbar className="top-0 dark:border-slate-700/60 bg-white/10 dark:bg-[#1c1b1f]/10 backdrop-blur-sm cursor-pointer">
            <NavBody visible={false}>
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-3 group"
                >
                    <Image
                        src="/images/logo-remove-bg.png"
                        alt="Airship"
                        width={48}
                        height={48}
                        priority
                        className="dark:ring-slate-700/60 group-hover:ring-pink-500/30 transition-all duration-300"
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm tracking-tight">
                        Airship <span className="text-pink-500 dark:text-pink-400">Express</span>
                    </span>
                </button>

                <div className="hidden lg:flex flex-1 items-center justify-center gap-2">
                    {filteredNav.map((group: any) => {
                        const isSectionCurrent = isSectionActive(group);
                        const accent = getSectionAccent(group.section);
                        const isDropdownOpen = openDropdown === group.section;

                        return (
                            <div key={group.section} className="relative group">
                                <button
                                    className={cn(
                                        "flex items-center gap-2 px-3.5 py-2 text-sm font-medium transition-all duration-200 rounded-xl border",
                                        isDropdownOpen
                                            ? "text-pink-600 dark:text-pink-400 bg-pink-50/70 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800/60 shadow-sm"
                                            : isSectionCurrent
                                                ? accent.active
                                                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-slate-800/60 border-transparent"
                                    )}
                                    onClick={() =>
                                        setOpenDropdown(isDropdownOpen ? null : group.section)
                                    }
                                >
                                    <i className={cn(getSectionIcon(group.section), "text-xs", isSectionCurrent ? accent.iconColor : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors")} />
                                    <span>{group.section}</span>
                                    <IconChevronDown className={cn(
                                        "h-3.5 w-3.5 opacity-70 transition-transform duration-200 ml-0.5",
                                        isDropdownOpen && "rotate-180 opacity-100"
                                    )} />
                                </button>

                                {isDropdownOpen && (
                                    <div className="absolute left-0 top-full mt-1.5 w-64 rounded-xl 
                                                bg-white dark:bg-[#2a2a2e] 
                                                p-2 shadow-xl dark:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.4)] 
                                                border border-slate-200/80 dark:border-slate-700/80 
                                                z-50 animate-in fade-in-0 zoom-in-95 duration-200">
                                        <div className="px-3 py-1.5 mb-1 flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50">
                                            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 dark:text-slate-400 flex items-center gap-1.5">
                                                <i className={cn(getSectionIcon(group.section), "text-xs", accent.iconColor)} />
                                                {group.section}
                                            </span>
                                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md font-medium border", accent.badge)}>
                                                {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                                            </span>
                                        </div>
                                        {group.items.map((item: any) => {
                                            const active = isActive(item.href);
                                            const isAuthorized = item.isAuthorized !== false;

                                            return (
                                                <Link
                                                    key={item.id}
                                                    href={isAuthorized ? item.href : '#'}
                                                    onClick={(e) => {
                                                        if (!isAuthorized) {
                                                            e.preventDefault();
                                                            toast.error('You do not have permission to access this page');
                                                            return;
                                                        }
                                                        setOpenDropdown(null);
                                                    }}
                                                    className={cn(
                                                        "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm transition-all duration-200 relative",
                                                        active && isAuthorized
                                                            ? "text-pink-600 bg-pink-50 dark:bg-pink-950/20 dark:text-pink-400 font-medium"
                                                            : !isAuthorized
                                                                ? "text-slate-400 cursor-not-allowed hover:bg-transparent dark:text-slate-600"
                                                                : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50"
                                                    )}
                                                >
                                                    {active && isAuthorized && (
                                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full bg-pink-500 dark:bg-pink-400" />
                                                    )}

                                                    <i className={cn(
                                                        item.icon,
                                                        !isAuthorized && "opacity-50",
                                                        active && isAuthorized ? "text-pink-500 dark:text-pink-400" : "text-slate-500 dark:text-slate-400"
                                                    )}></i>
                                                    <span className={!isAuthorized ? "line-through" : ""}>
                                                        {isAuthorized ? item.label : "Unauthorized"}
                                                    </span>
                                                    {!isAuthorized && (
                                                        <IconLock className="h-3.5 w-3.5 ml-auto text-slate-400 dark:text-slate-600" />
                                                    )}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="hidden lg:flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full 
                                bg-slate-50 dark:bg-slate-800/50 
                                border border-slate-200/60 dark:border-slate-700/60">
                        <IconUser className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        <span className="text-sm text-slate-600 dark:text-slate-300 truncate max-w-[120px] font-medium">
                            {userName}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded-full">
                            {userRole}
                        </span>
                    </div>

                    <NotificationBell />

                    <ThemeToggle />

                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm 
                               text-red-600 dark:text-red-400 
                               hover:bg-red-50 dark:hover:bg-red-950/20 
                               rounded-lg transition-all duration-200 
                               disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoggingOut ? (
                            <>
                                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-red-600 dark:border-red-400 border-t-transparent"></span>
                                Logging out...
                            </>
                        ) : (
                            <>
                                <IconLogout className="h-4 w-4" />
                                Logout
                            </>
                        )}
                    </button>
                </div>
            </NavBody>

            <MobileNav visible={false}>
                <MobileNavHeader>
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-3 group"
                    >
                        <Image
                            src="/images/logo-remove-bg.png"
                            alt="Airship"
                            width={48}
                            height={48}
                            priority
                            className="h-auto w-auto rounded-lg ring-1 ring-slate-200/60 dark:ring-slate-700/60 group-hover:ring-pink-500/30 transition-all duration-300"
                        />
                        <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm tracking-tight">
                            Airship <span className="text-pink-500 dark:text-pink-400">Express</span>
                        </span>
                    </button>

                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <NotificationBell />
                        <MobileNavToggle isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} />
                    </div>
                </MobileNavHeader>

                <MobileNavMenu isOpen={isOpen} onClose={() => setIsOpen(false)}>
                    <div className="flex flex-col h-full bg-white dark:bg-[#1c1b1f]">
                        <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/60">
                            <div className="flex items-center gap-2">
                                <IconUser className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {userName}
                                </span>
                                <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/50 px-2 py-0.5 rounded-full ml-2">
                                    {userRole}
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-2 py-2">
                            {filteredNav.map((group: any) => {
                                const isSectionCurrent = isSectionActive(group);
                                const accent = getSectionAccent(group.section);

                                return (
                                    <div key={group.section} className="w-full mb-3 last:mb-0">
                                        <div className="px-3 py-2 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <i className={cn(getSectionIcon(group.section), "text-xs", accent.iconColor)} />
                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                                                    {group.section}
                                                </span>
                                            </div>
                                            {isSectionCurrent ? (
                                                <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold border flex items-center gap-1.5", accent.badge)}>
                                                    <span className={cn("inline-block h-1.5 w-1.5 rounded-full", accent.indicator)}></span>
                                                    Active Section
                                                </span>
                                            ) : (
                                                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md font-medium border", accent.badge)}>
                                                    {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="space-y-0.5">
                                            {group.items.map((item: any) => {
                                        const active = isActive(item.href);
                                        const isAuthorized = item.isAuthorized !== false;

                                        return (
                                            <Link
                                                key={item.id}
                                                href={isAuthorized ? item.href : '#'}
                                                onClick={(e) => {
                                                    if (!isAuthorized) {
                                                        e.preventDefault();
                                                        toast.error('You do not have permission to access this page');
                                                        return;
                                                    }
                                                    setIsOpen(false);
                                                }}
                                                className={cn(
                                                    "flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-all duration-200 relative",
                                                    active && isAuthorized
                                                        ? "text-pink-600 bg-pink-50 dark:bg-pink-950/20 dark:text-pink-400 font-medium"
                                                        : !isAuthorized
                                                            ? "text-slate-400 cursor-not-allowed hover:bg-transparent dark:text-slate-600"
                                                            : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50"
                                                )}
                                            >
                                                {active && isAuthorized && (
                                                    <motion.div
                                                        layoutId="mobile-active-bar"
                                                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full bg-pink-500 dark:bg-pink-400"
                                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                                    />
                                                )}

                                                <i className={cn(
                                                    item.icon,
                                                    !isAuthorized && "opacity-50",
                                                    active && isAuthorized && "text-pink-500 dark:text-pink-400"
                                                )}></i>

                                                <span className={cn(
                                                    !isAuthorized && "line-through"
                                                )}>
                                                    {isAuthorized ? item.label : "Unauthorized"}
                                                </span>

                                                {!isAuthorized && (
                                                    <IconLock className="h-3.5 w-3.5 ml-auto text-slate-400 dark:text-slate-600" />
                                                )}
                                            </Link>
                                        );
                                    })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex-shrink-0 px-4 py-3 border-t border-slate-200/60 dark:border-slate-700/60 
                                    bg-white/80 dark:bg-[#1c1b1f]/80 backdrop-blur-sm">
                            <button
                                onClick={handleLogout}
                                disabled={isLoggingOut}
                                className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm 
                                       text-red-600 dark:text-red-400 
                                       hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                            >
                                <IconLogout className="h-5 w-5" />
                                <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
                            </button>
                        </div>
                    </div>
                </MobileNavMenu>
            </MobileNav>
        </Navbar>
    );
}

interface ShadUiNavProps {
    onAIClick?: () => void;
}

export function ShadUiNav({ onAIClick }: ShadUiNavProps) {
    const { openChat, isOpen: isAIOpen, isRobotThinking, isRobotResponding } = useAI();
    const [isOpen, setIsOpen] = useState(false);
    const [isHovering, setIsHovering] = useState(false);

    useEffect(() => {
        if (isAIOpen) {
            setIsOpen(false);
        }
    }, [isAIOpen]);

    const greetings = [
        "Hi there!",
        "Hey! How can I help?",
        "Welcome!",
        "Hello! Ready to assist!",
        "Ask me anything!",
    ];
    const [currentGreeting, setCurrentGreeting] = useState(greetings[0]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        let timeout: NodeJS.Timeout;

        if (isHovering) {
            let index = 0;
            interval = setInterval(() => {
                index = (index + 1) % greetings.length;
                setCurrentGreeting(greetings[index]);
            }, 2500);
        } else {
            timeout = setTimeout(() => {
                setCurrentGreeting(greetings[0]);
            }, 300);
        }

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [isHovering]);

    if (isAIOpen) {
        return null;
    }

    return (
        <div className="fixed bottom-8 right-3 z-[9999] flex items-end gap-3 cursor-pointer">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        key="dock-panel"
                        initial={{ x: 50, opacity: 0, scale: 0.95 }}
                        animate={{ x: 0, opacity: 1, scale: 1 }}
                        exit={{ x: 50, opacity: 0, scale: 0.95 }}
                        transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 25,
                            duration: 0.3
                        }}
                    >
                        <div className="flex items-center gap-2 rounded-2xl 
                                border border-pink-200/60 dark:border-pink-800/40 
                                border-b-4 border-b-pink-300 dark:border-b-pink-700/60 
                                bg-white/95 dark:bg-[#2a2a2e]/95 
                                p-2 shadow-xl backdrop-blur-sm 
                                shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] 
                                dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)]">

                            <Link
                                href="/warehousing"
                                className="group relative rounded-xl 
                                   border border-transparent dark:border-transparent 
                                   border-b-2 border-b-slate-200 dark:border-b-slate-700 
                                   bg-slate-50/50 dark:bg-neutral-800/50 
                                   p-2 transition-all duration-75 
                                   hover:border-pink-200 dark:hover:border-pink-800/40 
                                   hover:bg-pink-50 dark:hover:bg-pink-950/20 
                                   active:translate-y-[1px] active:border-b-0"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-6 w-6 text-neutral-600 dark:text-neutral-400 
                                       transition-colors duration-200 
                                       group-hover:text-pink-500 dark:group-hover:text-pink-400"
                                >
                                    <rect x="3" y="3" width="7" height="7" rx="1" />
                                    <rect x="14" y="3" width="7" height="7" rx="1" />
                                    <rect x="3" y="14" width="7" height="7" rx="1" />
                                    <rect x="14" y="14" width="7" height="7" rx="1" />
                                </svg>
                            </Link>

                            <div className="h-8 w-px bg-pink-100 dark:bg-pink-900/30" />

                            <div className="relative">
                                <button
                                    onClick={() => {
                                        openChat();
                                        setIsOpen(false);
                                        if (onAIClick) onAIClick();
                                    }}
                                    onMouseEnter={() => setIsHovering(true)}
                                    onMouseLeave={() => setIsHovering(false)}
                                    className="group relative rounded-xl p-1 transition-all duration-75 active:scale-95 focus-visible:outline-none"
                                >
                                    <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center">
                                        <motion.div
                                            animate={{
                                                y: isHovering ? -15 : 0,
                                                scale: isHovering ? 1.15 : 1,
                                                rotate: isHovering ? [0, -5, 5, -3, 3, 0] : 0,
                                            }}
                                            transition={{
                                                y: {
                                                    type: "spring",
                                                    stiffness: 400,
                                                    damping: 15,
                                                },
                                                scale: {
                                                    duration: 0.2,
                                                },
                                                rotate: {
                                                    duration: 0.5,
                                                    ease: "easeInOut",
                                                },
                                            }}
                                        >
                                            <RobotHeader
                                                size={44}
                                                isThinking={isRobotThinking}
                                                isResponding={isRobotResponding}
                                            />
                                        </motion.div>

                                        <motion.div
                                            className="absolute -bottom-1 left-1/2 -translate-x-1/2 
                                               rounded-full bg-pink-400/20 blur-sm"
                                            animate={{
                                                width: isHovering ? 20 : 30,
                                                height: isHovering ? 2 : 4,
                                                opacity: isHovering ? 0.3 : 0.5,
                                            }}
                                            transition={{
                                                duration: 0.2,
                                            }}
                                        />

                                        {isHovering && (
                                            <motion.div
                                                className="absolute inset-0 rounded-full 
                                                   border-2 border-pink-400/50 dark:border-pink-400/30"
                                                initial={{ scale: 0.8, opacity: 0 }}
                                                animate={{ scale: 1.3, opacity: 0.6 }}
                                                exit={{ scale: 0.8, opacity: 0 }}
                                                transition={{ duration: 0.3 }}
                                            />
                                        )}

                                        {(isRobotThinking || isRobotResponding) && (
                                            <motion.div
                                                className="absolute inset-0 rounded-full 
                                                   border-2 border-pink-400/30 dark:border-pink-400/20"
                                                animate={{
                                                    scale: [1, 1.1, 1],
                                                    opacity: [0.3, 0.7, 0.3],
                                                }}
                                                transition={{
                                                    duration: 1.5,
                                                    repeat: Infinity,
                                                    ease: "easeInOut",
                                                }}
                                            />
                                        )}
                                    </div>
                                </button>

                                <AnimatePresence>
                                    {isHovering && (
                                        <motion.div
                                            className="absolute -top-16 left-1/2 -translate-x-1/2 
                                               whitespace-nowrap z-50 pointer-events-none"
                                            initial={{ opacity: 0, y: 10, scale: 0.8 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -10, scale: 0.8 }}
                                            transition={{ duration: 0.1 }}
                                        >
                                            <motion.div
                                                key={currentGreeting}
                                                className="bg-white dark:bg-[#2a2a2e] 
                                                   rounded-2xl px-4 py-2 shadow-xl 
                                                   border border-pink-200 dark:border-pink-800/40 
                                                   text-sm font-medium text-pink-600 dark:text-pink-400"
                                                initial={{ scale: 0.9, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{ scale: 0.9, opacity: 0 }}
                                                transition={{ duration: 0.1 }}
                                            >
                                                {currentGreeting}
                                            </motion.div>
                                            <div className="w-0 h-0 mx-auto 
                                                    border-x-8 border-x-transparent 
                                                    border-t-8 border-t-white dark:border-t-[#2a2a2e]" />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                onClick={() => setIsOpen((prev) => !prev)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ y: 3 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                aria-label={isOpen ? "Hide navigation" : "Show navigation"}
                aria-expanded={isOpen}
                className={cn(
                    "relative flex h-12 w-5 items-center justify-center rounded-full",
                    "border-b-4 border-pink-700 dark:border-pink-800 bg-pink-500 dark:bg-pink-600 text-white",
                    "shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] shadow-md hover:bg-pink-400 dark:hover:bg-pink-500",
                    "transition-colors duration-75",
                    "focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-2 dark:focus:ring-offset-[#1c1b1f]"
                )}
            >
                <AnimatePresence mode="wait" initial={false}>
                    {isOpen ? (
                        <motion.span
                            key="chevron-right"
                            initial={{ opacity: 0, rotate: -90 }}
                            animate={{ opacity: 1, rotate: 0 }}
                            exit={{ opacity: 0, rotate: 90 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center justify-center"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-6 w-6 text-white drop-shadow-sm"
                            >
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </motion.span>
                    ) : (
                        <motion.span
                            key="chevron-left"
                            initial={{ opacity: 0, rotate: 90 }}
                            animate={{ opacity: 1, rotate: 0 }}
                            exit={{ opacity: 0, rotate: -90 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center justify-center"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-6 w-6 text-white drop-shadow-sm"
                            >
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                        </motion.span>
                    )}
                </AnimatePresence>
            </motion.button>
        </div>
    );
}


export default AceternityNavbar;