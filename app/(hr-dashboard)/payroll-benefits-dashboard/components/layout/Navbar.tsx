'use client';

import { Menu, PanelLeftClose, PanelLeftOpen, Search, Bell, MessageSquare } from 'lucide-react';
import { useSidebar } from './SidebarContext';
import UserMenu from './UserMenu';
import ThemeToggle from '@/app/components/ThemeToggle';

export default function Navbar() {
    const { toggle, isCollapsed, toggleCollapsed } = useSidebar();

    return (
        <header className="sticky top-0 z-30 w-full border-b border-line bg-paper/95 backdrop-blur dark:border-paper/10">
            <div className="flex h-16 w-full items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
                <button
                    type="button"
                    onClick={toggle}
                    className="flex h-9 w-9 shrink-0 items-center justify-center border border-line text-muted transition-colors hover:text-ink sm:hidden dark:border-paper/15"
                    aria-label="Toggle menu"
                >
                    <Menu size={18} strokeWidth={1.75} />
                </button>

                <button
                    type="button"
                    onClick={toggleCollapsed}
                    className="hidden h-9 w-9 shrink-0 items-center justify-center text-muted transition-colors hover:text-ink sm:flex"
                    aria-label="Collapse sidebar"
                >
                    {isCollapsed ? (
                        <PanelLeftOpen size={19} strokeWidth={1.75} />
                    ) : (
                        <PanelLeftClose size={19} strokeWidth={1.75} />
                    )}
                </button>

                <div className="flex flex-1 items-center gap-2 rounded-lg border border-line px-3 py-2 text-[12.5px] text-muted dark:border-paper/15">
                    <Search size={14} strokeWidth={1.75} className="shrink-0" />
                    <input
                        type="text"
                        placeholder="Search payroll runs, employees, claims…"
                        className="w-full bg-transparent text-ink outline-none placeholder:text-muted"
                    />
                    <kbd className="hidden shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-muted sm:block dark:border-paper/15">
                        ⌘K
                    </kbd>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
                    <ThemeToggle className="hidden sm:flex" />

                    <button
                        type="button"
                        className="relative flex h-9 w-9 items-center justify-center text-muted transition-colors hover:text-ink"
                        aria-label="Messages"
                    >
                        <MessageSquare size={17} strokeWidth={1.75} />
                        <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[9px] font-medium text-paper">
                            3
                        </span>
                    </button>

                    <button
                        type="button"
                        className="relative flex h-9 w-9 items-center justify-center text-muted transition-colors hover:text-ink"
                        aria-label="Notifications"
                    >
                        <Bell size={17} strokeWidth={1.75} />
                        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
                    </button>

                    <span className="hidden h-6 w-px bg-line sm:block dark:bg-paper/15" />

                    <UserMenu />
                </div>
            </div>
        </header>
    );
}