'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Bell,
  Truck,
  Users,
  FileText,
  UserCheck,
  RefreshCw,
  CornerDownLeft,
  Clock,
  CheckCheck,
  Package,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useSidebar } from './SidebarContext';
import UserMenu from './UserMenu';
import ThemeToggle from '@/app/components/ThemeToggle';
import { useSearch } from '../../hooks/useSearch';
import { useNotifications, type NotificationType } from '../../hooks/useNotifications';
import type { SearchResult, SearchResultType } from '../../types/api';

const GROUP_META: Record<SearchResultType, { label: string; icon: React.ReactNode }> = {
  person: { label: 'People', icon: <Users size={13} /> },
  shift: { label: 'Shifts & Schedules', icon: <Truck size={13} /> },
  timesheet: { label: 'Timesheets', icon: <FileText size={13} /> },
  leave: { label: 'Leave & Rest', icon: <UserCheck size={13} /> },
  load: { label: 'Freight Loads', icon: <Package size={13} /> },
};

const GROUP_ORDER: SearchResultType[] = ['person', 'shift', 'timesheet', 'leave', 'load'];

const NOTIF_ICON: Record<NotificationType, React.ReactNode> = {
  timesheet: <FileText size={14} className="text-accent" />,
  leave: <UserCheck size={14} className="text-accent" />,
  attendance: <Clock size={14} className="text-accent" />,
};

function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { addSuffix: true });
}

export function TopNav() {
  const router = useRouter();
  const { toggle, isCollapsed, toggleCollapsed } = useSidebar();
  const notifications = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);

  const { query, setQuery, results, loading, clear } = useSearch();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const ordered: SearchResult[] = GROUP_ORDER.flatMap((type) =>
    results.filter((r) => r.type === type)
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      clear();
      router.push(result.href);
    },
    [clear, router]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      clear();
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!ordered.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % ordered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + ordered.length) % ordered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = ordered[activeIndex];
      if (chosen) go(chosen);
    }
  };

  const showDropdown = open && query.trim().length >= 2;

  return (
    <header className="sticky top-0 z-30 w-full border-b border-line bg-paper transition-colors duration-300">
      <div className="flex h-16 w-full items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={toggle}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:text-ink sm:hidden"
          aria-label="Toggle menu"
        >
          <Menu size={18} strokeWidth={1.75} />
        </button>

        {/* Desktop sidebar collapse toggle */}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:text-ink sm:flex"
          aria-label="Collapse sidebar"
        >
          {isCollapsed ? (
            <PanelLeftOpen size={19} strokeWidth={1.75} />
          ) : (
            <PanelLeftClose size={19} strokeWidth={1.75} />
          )}
        </button>

        {/* Center: Global Search */}
        <div ref={searchRef} className="relative flex flex-1 items-center max-w-md mx-2 sm:mx-4">
          <div className="flex w-full items-center gap-2 rounded-lg border border-line px-3 py-2 text-[12.5px] transition-colors">
            <Search size={14} strokeWidth={1.75} className="shrink-0 text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              role="combobox"
              aria-expanded={showDropdown}
              aria-controls="global-search-listbox"
              placeholder="Search drivers, shifts, routes, timesheets…"
              className="w-full bg-transparent outline-none placeholder:text-muted text-ink"
            />
            {loading ? (
              <RefreshCw size={11} className="animate-spin text-accent shrink-0" />
            ) : (
              <kbd className="hidden shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-muted sm:block">
                ⌘K
              </kbd>
            )}
          </div>

          {/* Results dropdown */}
          {showDropdown && (
            <div
              id="global-search-listbox"
              role="listbox"
              className="absolute top-full left-0 right-0 mt-2 bg-paper border border-line rounded-2xl shadow-xl py-2 max-h-96 overflow-y-auto z-50 text-ink"
            >
              {ordered.length === 0 && !loading && (
                <p className="px-4 py-6 text-center text-xs text-muted">
                  No matches for &quot;{query.trim()}&quot;.
                </p>
              )}

              {ordered.length === 0 && loading && (
                <p className="px-4 py-6 text-center text-xs text-muted">Searching…</p>
              )}

              {GROUP_ORDER.map((type) => {
                const group = results.filter((r) => r.type === type);
                if (group.length === 0) return null;
                return (
                  <div key={type} className="px-1.5">
                    <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1 text-[10px] font-bold text-muted uppercase tracking-wider">
                      {GROUP_META[type].icon}
                      {GROUP_META[type].label}
                    </div>
                    {group.map((result) => {
                      const flatIdx = ordered.indexOf(result);
                      const active = flatIdx === activeIndex;
                      return (
                        <button
                          key={`${result.type}-${result.id}`}
                          role="option"
                          aria-selected={active}
                          onMouseEnter={() => setActiveIndex(flatIdx)}
                          onClick={() => go(result)}
                          className={`w-full text-left flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl transition ${
                            active ? 'bg-accent/10 text-accent font-semibold' : 'hover:bg-ink/[0.04] dark:hover:bg-paper/[0.06]'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-ink truncate">
                              {result.title}
                            </p>
                            <p className="text-[10px] text-muted truncate">{result.subtitle}</p>
                          </div>
                          {active && (
                            <CornerDownLeft size={13} className="text-accent flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Action Icons: ThemeToggle + Notifications + UserMenu */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3 ml-auto">
          <ThemeToggle className="hidden sm:flex" />

          {/* Notifications */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setNotifOpen((v) => !v)}
              aria-label="Notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:text-ink"
            >
              <Bell size={18} strokeWidth={1.75} />
              {notifications.unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" />
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-paper border border-line rounded-2xl shadow-xl z-50 overflow-hidden text-ink">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-line bg-paper/50">
                  <p className="text-xs font-bold text-ink">
                    Notifications
                    {notifications.unreadCount > 0 && (
                      <span className="ml-1.5 text-[10px] bg-accent text-paper px-1.5 py-0.5 rounded-full font-bold">
                        {notifications.unreadCount}
                      </span>
                    )}
                  </p>
                  {notifications.unreadCount > 0 && (
                    <button
                      onClick={notifications.markAllRead}
                      className="text-[10px] font-bold text-accent hover:underline flex items-center gap-1"
                    >
                      <CheckCheck size={12} />
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {notifications.loading && (
                    <p className="px-4 py-6 text-center text-xs text-muted">Loading…</p>
                  )}
                  {!notifications.loading && notifications.items.length === 0 && (
                    <p className="px-4 py-6 text-center text-xs text-muted">
                      You&apos;re all caught up.
                    </p>
                  )}
                  {notifications.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        notifications.markRead(item.id);
                        setNotifOpen(false);
                        router.push(item.href);
                      }}
                      className="w-full text-left px-4 py-3 border-b border-line hover:bg-ink/[0.03] dark:hover:bg-paper/[0.04] transition flex items-start gap-3"
                    >
                      <div className="p-2 rounded-lg bg-accent/10 text-accent flex-shrink-0">
                        {NOTIF_ICON[item.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-ink truncate">{item.title}</p>
                          {notifications.isUnread(item.id) && (
                            <span className="w-2 h-2 bg-accent rounded-full flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] text-muted truncate">{item.detail}</p>
                        <p className="text-[9px] text-muted/80 mt-0.5">
                          {relativeTime(item.createdAt)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <span className="hidden h-6 w-px bg-line sm:block" />

          {/* User Profile */}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
