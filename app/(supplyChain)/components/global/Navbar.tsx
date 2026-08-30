"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
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
import { UserProfileMenu } from "./UserProfileMenu";
import ThemeToggle from "@/app/components/ThemeToggle";
import { AppButton } from "@/app/(supplyChain)/components/ui/AppButton";
import { StatusBadge } from "@/app/(supplyChain)/components/ui/StatusBadge";
import { ChangePasswordModal } from "@/app/(supplyChain)/components/modals/ChangePasswordModal";

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
    const [userEmail, setUserEmail] = useState<string>("");
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
    const [filteredNav, setFilteredNav] = useState<NavGroup[]>([]);
    const router = useRouter();
    const pathname = usePathname();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const { confirm } = useConfirm();
    const navRef = useRef<HTMLDivElement>(null);

    // format name into initials (e.g. Janzel -> J, Jana Mendez -> JM)
    const getInitials = (name: string): string => {
        if (!name || !name.trim()) return "U";
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 1) {
            return parts[0].charAt(0).toUpperCase();
        }
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    };

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const role = localStorage.getItem('user_role');
            const employeeName = localStorage.getItem('user_name');
            const email = localStorage.getItem('user_email') || localStorage.getItem('logged_in_email');
            if (role) {
                setUserRole(role);
                filterNavigation(role);
            }
            if (employeeName) {
                setUserName(employeeName);
            }
            if (email) {
                setUserEmail(email);
            }
        }
    }, []);

    // close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (openDropdown && navRef.current && !navRef.current.contains(e.target as Node)) {
                setOpenDropdown(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [openDropdown]);

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
                // clear session and storage data
                localStorage.removeItem('session_token');
                localStorage.removeItem('user_role');
                localStorage.removeItem('session_expires');
                localStorage.removeItem('user_name');
                localStorage.removeItem('user_email');
                localStorage.removeItem('logged_in_email');
                localStorage.removeItem('user_agent');
                localStorage.removeItem('user_ip');
                localStorage.removeItem('user_id');

                localStorage.removeItem('session_backup');
                localStorage.removeItem('session_backup_2');
                localStorage.removeItem('session_backup_3');

                try {
                    sessionStorage.removeItem('session_backup');
                } catch (e) {
                }

                // clear cookie backups
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
        <>
            <Navbar className="top-0 dark:border-slate-700/60 bg-white/10 dark:bg-[#1c1b1f]/10 backdrop-blur-sm">
                <NavBody visible={false}>
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2.5 group shrink-0 focus:outline-none"
                >
                    <Image
                        src="/images/logo-remove-bg.png"
                        alt="Airship"
                        width={40}
                        height={40}
                        priority
                        className="dark:ring-slate-700/60 group-hover:ring-pink-500/30 transition-all duration-300 object-contain dark:brightness-0 dark:invert"
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm tracking-tight whitespace-nowrap">
                        Airship <span className="text-pink-500 dark:text-pink-400">Express</span>
                    </span>
                </button>

                <div ref={navRef} className="hidden lg:flex items-center justify-center gap-1 xl:gap-2 shrink-0">
                    {filteredNav.map((group: any) => {
                        const isSectionCurrent = isSectionActive(group);
                        const accent = getSectionAccent(group.section);
                        const isDropdownOpen = openDropdown === group.section;

                        return (
                            <div key={group.section} className="relative group">
                                <button
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 text-xs xl:text-sm font-semibold transition-all duration-200 rounded-full border whitespace-nowrap cursor-pointer",
                                        isDropdownOpen || isSectionCurrent
                                            ? "text-pink-700 dark:text-pink-200 bg-[#ffe6f0] dark:bg-[#341427] border-pink-300 dark:border-[#67224c] shadow-[0_2px_8px_rgba(244,63,94,0.16),inset_0_1px_0_#ffffff] dark:shadow-[0_3px_10px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)]"
                                            : "text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-[#1c1d25]/80 border-slate-200/80 dark:border-[#353746] hover:bg-slate-50 dark:hover:bg-[#252630] shadow-[0_2px_6px_rgba(0,0,0,0.04),inset_0_1px_0_#ffffff] dark:shadow-[0_2px_6px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] active:scale-96"
                                    )}
                                    onClick={() =>
                                        setOpenDropdown(isDropdownOpen ? null : group.section)
                                    }
                                >
                                    <i className={cn(getSectionIcon(group.section), "text-xs", (isDropdownOpen || isSectionCurrent) ? "text-pink-600 dark:text-pink-400" : "text-slate-400 dark:text-slate-400")} />
                                    <span>{group.section}</span>
                                    <IconChevronDown className={cn(
                                        "h-3.5 w-3.5 opacity-70 transition-transform duration-200 ml-0.5",
                                        isDropdownOpen && "rotate-180 opacity-100"
                                    )} />
                                </button>

                                {isDropdownOpen && (
                                    <div className="absolute left-0 top-full mt-2 w-64 rounded-2xl 
                                                bg-white dark:bg-[#1c1d25] 
                                                p-2 shadow-[0_16px_45px_rgba(0,0,0,0.14),inset_0_1px_0_#ffffff] dark:shadow-[0_20px_50px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] 
                                                border border-slate-200/90 dark:border-[#353746] 
                                                z-50 animate-in fade-in-0 zoom-in-95 duration-200">
                                        <div className="px-3 py-1.5 mb-1 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                                            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-400 flex items-center gap-1.5">
                                                <i className={cn(getSectionIcon(group.section), "text-xs text-pink-500 dark:text-pink-400")} />
                                                {group.section}
                                            </span>
                                            <StatusBadge tone="pink" size="xs">
                                                {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                                            </StatusBadge>
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
                                                        "flex items-center gap-3 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium transition-all duration-200 relative",
                                                        active && isAuthorized
                                                            ? "text-pink-700 bg-[#ffe6f0] border border-pink-300 dark:bg-[#341427] dark:text-pink-200 dark:border-[#67224c] shadow-[0_2px_6px_rgba(244,63,94,0.12),inset_0_1px_0_#ffffff] dark:shadow-[0_2px_8px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]"
                                                            : !isAuthorized
                                                                ? "text-slate-400 cursor-not-allowed hover:bg-transparent dark:text-slate-600"
                                                                : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60"
                                                    )}
                                                >
                                                    <i className={cn(
                                                        item.icon,
                                                        !isAuthorized && "opacity-50",
                                                        active && isAuthorized ? "text-pink-600 dark:text-pink-400" : "text-slate-500 dark:text-slate-400"
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

                <div className="hidden lg:flex items-center gap-2 xl:gap-2.5 shrink-0">
                    <UserProfileMenu />

                    <NotificationBell />

                    <ThemeToggle />

                    <AppButton
                        type="button"
                        variant="danger"
                        size="xs"
                        pill
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        title="Logout"
                    >
                        {isLoggingOut ? (
                            <>
                                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-rose-600 dark:border-rose-400 border-t-transparent"></span>
                                <span className="hidden xl:inline">Logging out...</span>
                            </>
                        ) : (
                            <>
                                <IconLogout className="h-3.5 w-3.5 shrink-0" />
                                <span className="hidden xl:inline">Logout</span>
                            </>
                        )}
                    </AppButton>
                </div>
            </NavBody>

            <MobileNav visible={false}>
                <MobileNavHeader>
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2.5 group"
                    >
                        <Image
                            src="/images/logo-remove-bg.png"
                            alt="Airship"
                            width={36}
                            height={36}
                            priority
                            className="h-auto w-auto rounded-lg ring-1 ring-slate-200/60 dark:ring-slate-700/60 group-hover:ring-pink-500/30 transition-all duration-300 object-contain dark:brightness-0 dark:invert"
                        />
                        <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm tracking-tight whitespace-nowrap">
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
                    <div className="flex flex-col h-full bg-white dark:bg-[#181920]">
                        <div className="flex-shrink-0 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsOpen(false);
                                    setIsChangePasswordOpen(true);
                                }}
                                title="Click to Change Password"
                                className="w-full flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/90 dark:border-[#353746] shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_#ffffff] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-pink-300 dark:hover:border-pink-500/50 hover:bg-pink-50/50 dark:hover:bg-pink-950/20 transition-all text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-tr from-pink-500 to-rose-400 text-white text-sm font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] select-none shrink-0 group-hover:scale-105 transition-transform">
                                        {getInitials(userName)}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                                            {userName}
                                        </span>
                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                            {userRole} • <span className="text-pink-500 dark:text-pink-400 font-semibold">Change Password</span>
                                        </span>
                                    </div>
                                </div>
                                <IconLock className="h-4 w-4 text-slate-400 group-hover:text-pink-500 transition-colors shrink-0" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
                            {filteredNav.map((group: any) => {
                                const isSectionCurrent = isSectionActive(group);
                                const accent = getSectionAccent(group.section);

                                return (
                                    <div key={group.section} className="w-full">
                                        <div className="px-2 py-1.5 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <i className={cn(getSectionIcon(group.section), "text-xs text-pink-500 dark:text-pink-400")} />
                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                                    {group.section}
                                                </span>
                                            </div>
                                            {isSectionCurrent ? (
                                                <StatusBadge tone="pink" dot size="xs">
                                                    Active
                                                </StatusBadge>
                                            ) : (
                                                <StatusBadge tone="neutral" size="xs">
                                                    {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                                                </StatusBadge>
                                            )}
                                        </div>
                                        <div className="space-y-1 mt-1">
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
                                                    "flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium transition-all duration-200 relative",
                                                    active && isAuthorized
                                                        ? "text-pink-700 bg-[#ffe6f0] border border-pink-300 dark:bg-[#341427] dark:text-pink-200 dark:border-[#67224c] shadow-[0_2px_6px_rgba(244,63,94,0.12),inset_0_1px_0_#ffffff] dark:shadow-[0_2px_8px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]"
                                                        : !isAuthorized
                                                            ? "text-slate-400 cursor-not-allowed hover:bg-transparent dark:text-slate-600"
                                                            : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50"
                                                )}
                                            >
                                                <i className={cn(
                                                    item.icon,
                                                    !isAuthorized && "opacity-50",
                                                    active && isAuthorized ? "text-pink-600 dark:text-pink-400" : "text-slate-500 dark:text-slate-400"
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

                        <div className="flex-shrink-0 p-4 border-t border-slate-100 dark:border-slate-800 bg-white/90 dark:bg-[#181920]/90 backdrop-blur-sm">
                            <AppButton
                                type="button"
                                variant="danger"
                                size="md"
                                pill
                                onClick={handleLogout}
                                disabled={isLoggingOut}
                                className="w-full justify-center"
                            >
                                <IconLogout className="h-4 w-4 shrink-0" />
                                <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
                            </AppButton>
                        </div>
                    </div>
                </MobileNavMenu>
            </MobileNav>
        </Navbar>

        <ChangePasswordModal
            isOpen={isChangePasswordOpen}
            onClose={() => setIsChangePasswordOpen(false)}
            userEmail={userEmail}
            userName={userName}
            userRole={userRole}
        />
    </>
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
                                border border-pink-200/90 dark:border-[#67224c] 
                                bg-white dark:bg-[#1c1d25] 
                                p-2 shadow-[0_16px_45px_rgba(0,0,0,0.14),inset_0_1px_0_#ffffff] dark:shadow-[0_20px_50px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md">

                            <Link
                                href="/warehousing"
                                className="group relative rounded-xl 
                                   border border-slate-200/80 dark:border-[#353746] 
                                   bg-slate-50 dark:bg-slate-900/60 
                                   p-2 transition-all duration-150 
                                   hover:border-pink-300 dark:hover:border-[#67224c] 
                                   hover:bg-[#ffe6f0] dark:hover:bg-[#341427] 
                                   shadow-[0_2px_6px_rgba(0,0,0,0.04),inset_0_1px_0_#ffffff] dark:shadow-[0_2px_6px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]
                                   active:scale-95 cursor-pointer"
                                title="Warehousing"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-5 w-5 text-slate-600 dark:text-slate-300 
                                       transition-colors duration-200 
                                       group-hover:text-pink-600 dark:group-hover:text-pink-300"
                                >
                                    <rect x="3" y="3" width="7" height="7" rx="1" />
                                    <rect x="14" y="3" width="7" height="7" rx="1" />
                                    <rect x="3" y="14" width="7" height="7" rx="1" />
                                    <rect x="14" y="14" width="7" height="7" rx="1" />
                                </svg>
                            </Link>

                            <div className="h-7 w-px bg-pink-200/60 dark:bg-[#67224c]" />

                            <div className="relative">
                                <button
                                    onClick={() => {
                                        openChat();
                                        setIsOpen(false);
                                        if (onAIClick) onAIClick();
                                    }}
                                    onMouseEnter={() => setIsHovering(true)}
                                    onMouseLeave={() => setIsHovering(false)}
                                    className="group relative rounded-xl p-1 transition-all duration-75 active:scale-95 focus-visible:outline-none cursor-pointer"
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
                                                className="bg-white dark:bg-[#1c1d25] 
                                                   rounded-2xl px-4 py-2 shadow-[0_8px_25px_rgba(0,0,0,0.12),inset_0_1px_0_#ffffff] dark:shadow-[0_10px_30px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)] 
                                                   border border-pink-200 dark:border-[#67224c] 
                                                   text-xs sm:text-sm font-semibold text-pink-600 dark:text-pink-300"
                                                initial={{ scale: 0.9, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{ scale: 0.9, opacity: 0 }}
                                                transition={{ duration: 0.1 }}
                                            >
                                                {currentGreeting}
                                            </motion.div>
                                            <div className="w-0 h-0 mx-auto 
                                                    border-x-8 border-x-transparent 
                                                    border-t-8 border-t-white dark:border-t-[#1c1d25]" />
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
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                aria-label={isOpen ? "Hide navigation" : "Show navigation"}
                aria-expanded={isOpen}
                className={cn(
                    "relative flex h-11 w-6 items-center justify-center rounded-full",
                    "border border-pink-400/60 dark:border-[#832b61] bg-gradient-to-tr from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white",
                    "shadow-[0_4px_16px_rgba(244,63,94,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] cursor-pointer",
                    "transition-all duration-150",
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
                                className="h-5 w-5 text-white drop-shadow-sm"
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
                                className="h-5 w-5 text-white drop-shadow-sm"
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