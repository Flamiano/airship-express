'use client';

import { Menu, PanelLeftClose, PanelLeftOpen, Search, Bell, MessageSquare } from 'lucide-react';
import { useSidebar } from './SidebarContext';
import UserMenu from './UserMenu';
import ThemeToggle from '@/app/components/ThemeToggle';
import { useTheme } from '@/app/components/ThemeProvider';

export default function Navbar() {
    const { toggle, isCollapsed, toggleCollapsed } = useSidebar();
    const { theme } = useTheme();

    return (
        <header className={`sticky top-0 z-30 w-full border-b transition-colors duration-300 ${theme === 'dark'
                ? 'bg-[#1c1b22] border-[#2b2a33]'
                : 'bg-[#fcfbf9] border-[#eaeaea]'
            }`}>
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

                <div className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] transition-colors ${theme === 'dark'
                        ? 'border-[#2b2a33] text-[#9a98a3]'
                        : 'border-[#eaeaea] text-[#6b6b76]'
                    }`}>
                    <Search size={14} strokeWidth={1.75} className="shrink-0" />
                    <input
                        type="text"
                        placeholder="Search payroll runs, employees, claims…"
                        className={`w-full bg-transparent outline-none placeholder:text-[#6b6b76] ${theme === 'dark' ? 'text-[#f4f3f6]' : 'text-[#1c1b1f]'
                            }`}
                    />
                    <kbd className={`hidden shrink-0 rounded border px-1.5 py-0.5 text-[10px] sm:block ${theme === 'dark'
                            ? 'border-[#2b2a33] text-[#9a98a3]'
                            : 'border-[#eaeaea] text-[#6b6b76]'
                        }`}>
                        ⌘K
                    </kbd>
                </div>

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

                    <button
                        type="button"
                        className={`relative flex h-9 w-9 items-center justify-center transition-colors ${theme === 'dark'
                                ? 'text-[#9a98a3] hover:text-[#f4f3f6]'
                                : 'text-[#6b6b76] hover:text-[#1c1b1f]'
                            }`}
                        aria-label="Notifications"
                    >
                        <Bell size={17} strokeWidth={1.75} />
                        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#e5167e]" />
                    </button>

                    <span className={`hidden h-6 w-px sm:block ${theme === 'dark' ? 'bg-[#2b2a33]' : 'bg-[#eaeaea]'
                        }`} />

                    <UserMenu />
                </div>
            </div>
        </header>
    );
}