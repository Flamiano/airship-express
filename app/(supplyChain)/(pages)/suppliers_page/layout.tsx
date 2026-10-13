"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { 
    FileText, 
    MessageSquare, 
    Building2, 
    LogOut, 
    ShieldCheck, 
    Bell, 
    RefreshCw,
    CheckCircle2,
    Clock,
    User,
    ChevronRight,
    Sparkles,
    ExternalLink,
    KeyRound,
    Loader2,
    Calendar,
    Video,
} from "lucide-react";
import { user } from "../../lib/services/Class/user";
import { supabase } from "../../lib/services/client/supabase";
import { toast } from "sonner";
import { SessionGuard } from "../../components/server/SessionGuard";
import { useConfirm } from "../../components/ui/ConfirmModal";
import ThemeToggle from "../../../components/ThemeToggle";
import { SessionLogoutTimer } from "../../components/global/SessionLogoutTimer";
import { ChangePasswordModal } from "../../components/modals/ChangePasswordModal";
import { cn } from "../../lib/utils";

export default function SupplierPortalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const { confirm } = useConfirm();
    const [supplierAccount, setSupplierAccount] = useState<any>(null);
    const [supplierDetails, setSupplierDetails] = useState<any>(null);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
    const [currentUserName, setCurrentUserName] = useState<string>("");
    const [isMounted, setIsMounted] = useState<boolean>(false);

    // Format initials
    const getInitials = (name: string): string => {
        if (!name || !name.trim()) return "SP";
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    };

    useEffect(() => {
        setIsMounted(true);
        const email = user.getEmail();
        const name = user.getName() || "Authorized Supplier";
        setCurrentUserEmail(email);
        setCurrentUserName(name);

        let channel: any = null;

        const fetchSupplierInfo = async () => {
            const activeEmail = email || user.getEmail();
            if (!activeEmail) return;
            try {
                // Fetch supplier account info
                const { data: acc } = await supabase
                    .from("suppliers_account")
                    .select("*, suppliers(*)")
                    .eq("email", activeEmail)
                    .maybeSingle();

                if (acc) {
                    setSupplierAccount(acc);
                    setSupplierDetails(acc.suppliers);

                    // Fetch unread messages count for this supplier
                    if (acc.supplier_id) {
                        try {
                            const { count } = await supabase
                                .from("messages")
                                .select("*", { count: "exact", head: true })
                                .eq("supplier_id", acc.supplier_id)
                                .eq("sender_type", "internal")
                                .eq("is_read", false);

                            setUnreadCount(count || 0);
                        } catch {
                            // Handled if query fails
                        }
                    }
                }
            } catch (err) {
                console.error("Error fetching supplier data:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSupplierInfo();

        // Subscribe to real-time message changes for badge count
        if (email) {
            const channelId = `supplier_nav_${email.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
            channel = supabase
                .channel(channelId)
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "messages",
                    },
                    () => {
                        fetchSupplierInfo();
                    }
                )
                .subscribe();
        }

        return () => {
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, []);

    const handleLogout = async () => {
        const confirmed = await confirm({
            title: "Logout",
            message: "Are you sure you want to sign out of the Supplier Portal?",
            confirmText: "Logout",
            cancelText: "Cancel",
            confirmVariant: "danger",
        });
        if (!confirmed) return;

        if (isLoggingOut) return;
        setIsLoggingOut(true);
        try {
            const sessionToken = user.getSessionToken();
            const userEmail = user.getEmail() || supplierAccount?.email || currentUserEmail;
            const userId = user.getUserId() || supplierAccount?.id;

            await fetch("/api/supplyChain/logout", {
                method: "POST",
                credentials: "include",
                headers: { 
                    "Content-Type": "application/json",
                    ...(sessionToken ? { "x-session-token": sessionToken } : {})
                },
                body: JSON.stringify({ 
                    action: "LOGOUT",
                    session_token: sessionToken,
                    email: userEmail,
                    user_id: userId
                }),
            });
            await supabase.auth.signOut();
        } catch (e) {
            console.error("Logout error:", e);
        } finally {
            user.clearUser();
            if (typeof window !== "undefined") {
                localStorage.removeItem("session_backup");
                localStorage.removeItem("session_backup_2");
                localStorage.removeItem("session_backup_3");
                try {
                    sessionStorage.removeItem("session_backup");
                } catch (e) {}
                document.cookie = "session_backup=; path=/; max-age=0";
                document.cookie = "session_backup_2=; path=/; max-age=0";
                document.cookie = "session_backup_3=; path=/; max-age=0";
                document.cookie = "session_token=; path=/; max-age=0";
                document.cookie = "sc_session_token=; path=/; max-age=0";
            }
            toast.success("Signed out successfully");
            router.push("/scAuth");
        }
    };

    const navItems = [
        {
            name: "Purchase Orders",
            href: "/suppliers_page/purchase-orders",
            icon: FileText,
            description: "View, track and acknowledge POs",
        },
        {
            name: "Meetings & Calls",
            href: "/suppliers_page/meetings",
            icon: Calendar,
            description: "Scheduled procurement & negotiation meetings",
        },
        {
            name: "Messages & Inquiries",
            href: "/suppliers_page/messages",
            icon: MessageSquare,
            description: "Live chat with Supply Chain team",
            badge: unreadCount > 0 ? unreadCount : null,
        },
    ];

    const companyName = supplierDetails?.name || supplierAccount?.suppliers?.name || "Supplier Partner Portal";
    const contactName = supplierAccount?.contact_name || (isMounted ? (currentUserName || "Authorized Supplier") : "");

    return (
        <SessionGuard requiredRole={['Supplier']}>
            <div className="supplychain-container min-h-screen font-rethink bg-[#FCFBF9] dark:bg-[#12131a] text-slate-800 dark:text-slate-100 flex flex-col justify-between relative overflow-x-hidden transition-colors duration-300">
                {/* Ambient decorative background glows & geometric shapes */}
                <div aria-hidden className="pointer-events-none fixed -top-32 -left-32 h-72 w-72 rounded-full bg-pink-500/10 dark:bg-pink-500/10 blur-3xl z-0" />
                <div aria-hidden className="pointer-events-none fixed -top-20 -right-24 h-72 w-72 rounded-full blur-3xl transition-colors duration-500 bg-slate-400/5 dark:bg-pink-900/10 z-0" />
                <div
                    aria-hidden
                    className="pointer-events-none fixed -bottom-10 left-8 hidden h-24 w-24 rounded-full border-[14px] border-pink-500/20 dark:border-pink-500/10 lg:block z-0"
                    style={{ clipPath: "inset(0 0 50% 0)" }}
                />
                <div aria-hidden className="pointer-events-none fixed bottom-24 right-0 hidden h-16 w-16 rounded-tl-full bg-pink-500/10 lg:block z-0" />
                <div aria-hidden className="pointer-events-none fixed bottom-8 right-0 hidden h-16 w-16 rounded-bl-full bg-pink-500/20 lg:block z-0" />

                {/* Top Navigation Bar */}
                <header className="sticky top-0 z-40 bg-[#FCFBF9]/85 dark:bg-[#12131a]/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_25px_rgba(0,0,0,0.6)]">
                    <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between h-20 gap-4">
                            
                            {/* Brand / Company Info */}
                            <div className="flex items-center gap-3.5 shrink-0">
                                <div className="relative group">
                                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-pink-500 via-rose-500 to-pink-600 flex items-center justify-center text-white shadow-[0_4px_14px_rgba(236,72,153,0.4),inset_0_1px_1.5px_rgba(255,255,255,0.5)]">
                                        <Building2 className="w-5 h-5 stroke-[2.2]" />
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-[#12131a] flex items-center justify-center text-[8px] text-white font-bold">
                                        ✓
                                    </div>
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h1 suppressHydrationWarning className="text-sm sm:text-base font-black tracking-tight text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-[280px]">
                                            {companyName}
                                        </h1>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                            <ShieldCheck className="w-3 h-3" />
                                            Portal
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                        Rep: <span suppressHydrationWarning className="font-semibold text-slate-700 dark:text-slate-300">{contactName}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Center Navigation Tabs (Pill style matching Airship Navbar) */}
                            <nav className="hidden md:flex items-center justify-center gap-1.5 p-1 rounded-full bg-[#ebf0f7]/90 dark:bg-[#181924]/90 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.4),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] border border-slate-200/50 dark:border-slate-800/60 shrink-0">
                                {navItems.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = pathname.startsWith(item.href);
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={cn(
                                                "relative flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full transition-all duration-200 whitespace-nowrap active:scale-95 cursor-pointer",
                                                isActive
                                                    ? "text-white bg-gradient-to-b from-pink-500 to-pink-600 border border-pink-400/80 dark:border-pink-500/80 shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5)] font-bold"
                                                    : "text-slate-700 dark:text-slate-300 bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/70 dark:border-[#2a2b38] hover:bg-[#e8edf5] dark:hover:bg-[#232533] shadow-[2px_2px_5px_rgba(166,175,195,0.3),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.5)]"
                                            )}
                                        >
                                            <Icon className={cn("w-3.5 h-3.5", isActive ? "text-white" : "text-slate-400 dark:text-slate-400")} />
                                            <span>{item.name}</span>
                                            {item.badge && (
                                                <span className={cn(
                                                    "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black rounded-full shadow-xs animate-pulse",
                                                    isActive ? "bg-white text-pink-600" : "bg-pink-500 text-white"
                                                )}>
                                                    {item.badge}
                                                </span>
                                            )}
                                        </Link>
                                    );
                                })}
                            </nav>

                            {/* Right Controls: User, Theme Toggle & Sign Out */}
                            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                                <SessionLogoutTimer />
                                <ThemeToggle />
                                
                                <button
                                    type="button"
                                    onClick={() => setIsChangePasswordOpen(true)}
                                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-full transition-all duration-200 border cursor-pointer active:scale-95 text-slate-700 dark:text-slate-300 bg-[#f0f3f8] dark:bg-[#1d1e28] border-white/70 dark:border-[#2a2b38] hover:text-pink-600 dark:hover:text-pink-400 hover:bg-[#e8edf5] dark:hover:bg-[#232533] shadow-xs"
                                    title="Change Password"
                                >
                                    <KeyRound className="w-3.5 h-3.5 text-pink-500" />
                                    <span className="hidden sm:inline">Password</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    disabled={isLoggingOut}
                                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-full transition-all duration-200 border cursor-pointer active:scale-95 text-rose-600 dark:text-rose-400 bg-rose-50/80 dark:bg-rose-950/40 border-rose-200/80 dark:border-rose-900/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
                                    title="Sign out of Supplier Portal"
                                >
                                    {isLoggingOut ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <LogOut className="w-3.5 h-3.5" />
                                    )}
                                    <span className="hidden sm:inline">
                                        {isLoggingOut ? "Signing Out..." : "Sign Out"}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Mobile Navigation Tabs */}
                        <div className="flex md:hidden items-center gap-2 pb-3 overflow-x-auto">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = pathname.startsWith(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-full transition-all whitespace-nowrap",
                                            isActive
                                                ? "text-white bg-pink-500 shadow-[0_3px_10px_rgba(236,72,153,0.35)]"
                                                : "text-slate-600 dark:text-slate-300 bg-[#ebf0f7] dark:bg-[#1a1b26] border border-slate-200 dark:border-white/[0.08]"
                                        )}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        <span>{item.name}</span>
                                        {item.badge && (
                                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-pink-600 text-white">
                                                {item.badge}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 w-full mx-auto px-2 sm:px-4 lg:px-6 py-4 sm:py-6 relative z-10">
                    {children}
                </main>

                {/* Change Password Modal */}
                <ChangePasswordModal
                    isOpen={isChangePasswordOpen}
                    onClose={() => setIsChangePasswordOpen(false)}
                    userEmail={currentUserEmail}
                    userName={currentUserName}
                    userRole="Supplier"
                />
            </div>
        </SessionGuard>
    );
}
