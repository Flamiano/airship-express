'use client';

import { useEffect, useRef, useState } from 'react';
import {
    Menu,
    PanelLeftClose,
    PanelLeftOpen,
    Search,
    MessageSquare,
    X,
    Loader2,
    User,
    Receipt,
    Wallet,
    Landmark,
    HeartPulse,
    TrendingUp,
    Settings as SettingsIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSidebar } from './SidebarContext';
import UserMenu from './UserMenu';
import NotificationBell from './NotificationBell';
import ThemeToggle from '@/app/components/ThemeToggle';
import { useTheme } from '@/app/components/ThemeProvider';
import { createClient } from '@/app/(hr-dashboard)/supabase/client';

type SearchResult = {
    id: string;
    type:
    | 'employee'
    | 'claim'
    | 'payroll_run'
    | 'bank'
    | 'benefit'
    | 'compensation'
    | 'settings';
    title: string;
    subtitle: string | null;
    href: string;
};

const TYPE_META: Record<
    SearchResult['type'],
    { icon: React.ComponentType<{ className?: string; size?: number; title?: string }>; label: string; tone: string }
> = {
    employee: { icon: User, label: 'Employee', tone: 'text-blue-600 dark:text-blue-400' },
    claim: { icon: Receipt, label: 'Claim', tone: 'text-pink-600 dark:text-pink-400' },
    payroll_run: { icon: Wallet, label: 'Payroll run', tone: 'text-emerald-600 dark:text-emerald-400' },
    bank: { icon: Landmark, label: 'Bank', tone: 'text-indigo-600 dark:text-indigo-400' },
    benefit: { icon: HeartPulse, label: 'Benefit', tone: 'text-rose-600 dark:text-rose-400' },
    compensation: { icon: TrendingUp, label: 'Compensation', tone: 'text-amber-600 dark:text-amber-400' },
    settings: { icon: SettingsIcon, label: 'Settings', tone: 'text-violet-600 dark:text-violet-400' },
};

export default function Navbar() {
    const { toggle, isCollapsed, toggleCollapsed } = useSidebar();
    const { theme } = useTheme();
    const router = useRouter();
    const supabase = createClient();

    const [paletteOpen, setPaletteOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    const paletteInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setPaletteOpen(true);
            }
            if (e.key === 'Escape') setPaletteOpen(false);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    useEffect(() => {
        if (paletteOpen) {
            setTimeout(() => paletteInputRef.current?.focus(), 40);
        } else {
            setQuery('');
            setResults([]);
            setActiveIndex(0);
        }
    }, [paletteOpen]);

    useEffect(() => {
        let cancelled = false;
        if (query.trim().length < 2) {
            setResults([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        const handle = setTimeout(async () => {
            try {
                const { data: session } = await supabase.auth.getSession();
                const token = session.session?.access_token;
                const res = await fetch(
                    `/payroll-benefits-dashboard/api/search?q=${encodeURIComponent(
                        query.trim()
                    )}`,
                    {
                        headers: token
                            ? { Authorization: `Bearer ${token}` }
                            : undefined,
                    }
                );
                if (!res.ok) throw new Error('Search failed');
                const data = await res.json();
                if (cancelled) return;
                setResults(data.results ?? []);
                setActiveIndex(0);
            } catch {
                if (!cancelled) setResults([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 220);
        return () => {
            cancelled = true;
            clearTimeout(handle);
        };
    }, [query, supabase]);

    const goTo = (href: string) => {
        setPaletteOpen(false);
        router.push(href);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, results.length - 1));
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
        }
        if (e.key === 'Enter' && results[activeIndex]) {
            e.preventDefault();
            goTo(results[activeIndex].href);
        }
    };

    return (
        <>
            <header
                className={`sticky top-0 z-30 w-full border-b transition-colors duration-300 ${theme === 'dark'
                        ? 'bg-[#1c1b22] border-[#2b2a33]'
                        : 'bg-[#fcfbf9] border-[#eaeaea]'
                    }`}
            >
                <div className="flex h-16 w-full items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
                    <button
                        type="button"
                        onClick={toggle}
                        className={`flex h-9 w-9 shrink-0 items-center justify-center border transition-colors sm:hidden ${theme === 'dark'
                                ? 'border-[#2b2a33] text-[#9a98a3] hover:text-[#f4f3f6]'
                                : 'border-[#eaeaea] text-[#6b6b76] hover:text-[#1c1b1f]'
                            }`}
                        aria-label="Toggle menu"
                    >
                        <Menu size={18} strokeWidth={1.75} />
                    </button>

                    <button
                        type="button"
                        onClick={toggleCollapsed}
                        className={`hidden h-9 w-9 shrink-0 items-center justify-center transition-colors sm:flex ${theme === 'dark'
                                ? 'text-[#9a98a3] hover:text-[#f4f3f6]'
                                : 'text-[#6b6b76] hover:text-[#1c1b1f]'
                            }`}
                        aria-label="Collapse sidebar"
                    >
                        {isCollapsed ? (
                            <PanelLeftOpen size={19} strokeWidth={1.75} />
                        ) : (
                            <PanelLeftClose size={19} strokeWidth={1.75} />
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setPaletteOpen(true)}
                        className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12.5px] transition-colors ${theme === 'dark'
                                ? 'border-[#2b2a33] text-[#9a98a3] hover:bg-white/[0.03]'
                                : 'border-[#eaeaea] text-[#6b6b76] hover:bg-black/[0.02]'
                            }`}
                    >
                        <Search size={14} strokeWidth={1.75} className="shrink-0" />
                        <span className="flex-1 truncate">
                            Search payroll runs, employees, claims…
                        </span>
                        <kbd
                            className={`hidden shrink-0 rounded border px-1.5 py-0.5 text-[10px] sm:block ${theme === 'dark'
                                    ? 'border-[#2b2a33] text-[#9a98a3]'
                                    : 'border-[#eaeaea] text-[#6b6b76]'
                                }`}
                        >
                            ⌘K
                        </kbd>
                    </button>

                    <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
                        <ThemeToggle className="hidden sm:flex" />

                        <button
                            type="button"
                            className={`relative flex h-9 w-9 items-center justify-center transition-colors ${theme === 'dark'
                                    ? 'text-[#9a98a3] hover:text-[#f4f3f6]'
                                    : 'text-[#6b6b76] hover:text-[#1c1b1f]'
                                }`}
                            aria-label="Messages"
                        >
                            <MessageSquare size={17} strokeWidth={1.75} />
                            <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#e5167e] text-[9px] font-medium text-[#fcfbf9]">
                                3
                            </span>
                        </button>

                        <NotificationBell />

                        <span
                            className={`hidden h-6 w-px sm:block ${theme === 'dark' ? 'bg-[#2b2a33]' : 'bg-[#eaeaea]'
                                }`}
                        />

                        <UserMenu />
                    </div>
                </div>
            </header>

            {paletteOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-start justify-center bg-ink/50 backdrop-blur-sm pt-[12vh]"
                    onClick={() => setPaletteOpen(false)}
                >
                    <div
                        className="w-full max-w-xl overflow-hidden rounded-xl border border-line bg-paper shadow-2xl dark:border-line/40"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-2 border-b border-line px-4 py-3 dark:border-line/40">
                            <Search className="h-4 w-4 shrink-0 text-muted" />
                            <input
                                ref={paletteInputRef}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Search employees, runs, claims, banks, modules…"
                                className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted font-rethink"
                            />
                            {loading && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />
                            )}
                            <button
                                type="button"
                                onClick={() => setPaletteOpen(false)}
                                className="rounded-md p-1 text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink dark:hover:bg-paper/[0.06]"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>

                        <div className="max-h-[55vh] overflow-y-auto">
                            {query.trim().length < 2 ? (
                                <div className="px-4 py-6 text-center text-[12px] text-muted font-rethink">
                                    Type at least 2 characters to search.
                                </div>
                            ) : results.length === 0 && !loading ? (
                                <div className="px-4 py-6 text-center text-[12px] text-muted font-rethink">
                                    No results for &quot;{query}&quot;.
                                </div>
                            ) : (
                                <ul className="py-1">
                                    {results.map((r, i) => {
                                        const meta = TYPE_META[r.type];
                                        const Icon = meta.icon;
                                        const isActive = i === activeIndex;
                                        return (
                                            <li key={`${r.type}-${r.id}`}>
                                                <button
                                                    type="button"
                                                    onClick={() => goTo(r.href)}
                                                    onMouseEnter={() => setActiveIndex(i)}
                                                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${isActive
                                                            ? 'bg-accent/10'
                                                            : 'hover:bg-ink/[0.03] dark:hover:bg-paper/[0.04]'
                                                        }`}
                                                >
                                                    <Icon
                                                        className={`h-4 w-4 shrink-0 ${meta.tone}`}
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-[13px] font-medium text-ink font-rethink">
                                                            {r.title}
                                                        </p>
                                                        {r.subtitle && (
                                                            <p className="truncate text-[11px] text-muted font-rethink">
                                                                {r.subtitle}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <span className="shrink-0 rounded-md bg-ink/[0.05] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted dark:bg-paper/[0.08] font-rethink">
                                                        {meta.label}
                                                    </span>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[10.5px] text-muted dark:border-line/40 font-rethink">
                            <span className="flex items-center gap-3">
                                <span className="flex items-center gap-1">
                                    <kbd className="rounded border border-line px-1 dark:border-line/40">
                                        ↑↓
                                    </kbd>
                                    navigate
                                </span>
                                <span className="flex items-center gap-1">
                                    <kbd className="rounded border border-line px-1 dark:border-line/40">
                                        ↵
                                    </kbd>
                                    open
                                </span>
                                <span className="flex items-center gap-1">
                                    <kbd className="rounded border border-line px-1 dark:border-line/40">
                                        esc
                                    </kbd>
                                    close
                                </span>
                            </span>
                            {results.length > 0 && (
                                <span>{results.length} results</span>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}