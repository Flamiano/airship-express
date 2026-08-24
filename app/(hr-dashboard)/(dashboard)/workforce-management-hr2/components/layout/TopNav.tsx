import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
 Menu,
 Search,
 Bell,
  Truck,
  ShieldCheck,
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
import { useAuth } from '@/hooks/useAuth';
import { useSearch } from '@/hooks/useSearch';
import { useNotifications, type NotificationType } from '@/hooks/useNotifications';
import { AirshipLogo } from '@/components/ui/AirshipLogo';
import type { SearchResult, SearchResultType } from '@/types/api';

interface TopNavProps {
 onMenuToggle: () => void;
}

const GROUP_META: Record<SearchResultType, { label: string; icon: React.ReactNode }> = {
 person: { label: 'People', icon: <Users size={13} /> },
 shift: { label: 'Shifts & Schedules', icon: <Truck size={13} /> },
 timesheet: { label: 'Timesheets', icon: <FileText size={13} /> },
 leave: { label: 'Leave & Rest', icon: <UserCheck size={13} /> },
 load: { label: 'Freight Loads', icon: <Package size={13} /> },
};

const GROUP_ORDER: SearchResultType[] = ['person', 'shift', 'timesheet', 'leave', 'load'];

const NOTIF_ICON: Record<NotificationType, React.ReactNode> = {
 timesheet: <FileText size={14} className="text-pink-700" />,
 leave: <UserCheck size={14} className="text-pink-700" />,
 attendance: <Clock size={14} className="text-pink-700" />,
};

function relativeTime(iso: string): string {
 const d = new Date(iso);
 if (Number.isNaN(d.getTime())) return '';
 return formatDistanceToNow(d, { addSuffix: true });
}

export function TopNav({ onMenuToggle }: TopNavProps) {
  const router = useRouter();
  const { profile, role } = useAuth();
  const notifications = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);

 const { query, setQuery, results, loading, clear } = useSearch();
 const [open, setOpen] = useState(false);
 const [activeIndex, setActiveIndex] = useState(0);
 const searchRef = useRef<HTMLDivElement>(null);
 const inputRef = useRef<HTMLInputElement>(null);
 const notifRef = useRef<HTMLDivElement>(null);

 // Flat list mirrors the visual order for arrow-key navigation.
 const ordered: SearchResult[] = GROUP_ORDER.flatMap((type) =>
 results.filter((r) => r.type === type)
 );

 // Reset the highlighted row whenever the result set changes.
 useEffect(() => {
 setActiveIndex(0);
 }, [results]);

 // ⌘K / Ctrl+K focuses the search from anywhere.
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

 // Close the dropdown on any outside click.
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
 <header className="bg-white border-b border-pink-100 sticky top-0 z-30 shadow-sm px-4 lg:px-8 py-3">
 <div className="flex items-center justify-between gap-4">
 {/* Left: logo + mobile menu */}
 <div className="flex items-center gap-3">
 <button
 onClick={onMenuToggle}
 aria-label="Toggle sidebar"
 className="lg:hidden p-2 text-pink-600 hover:bg-pink-50 rounded-lg transition"
 >
 <Menu size={22} />
 </button>

 <div className="flex items-center gap-2.5">
 <AirshipLogo size={44} className="flex-shrink-0" />
 <div>
 <span className="font-bold text-lg text-pink-900 tracking-tight flex items-center gap-1.5">
 Airship Express
 <span className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full font-medium border border-pink-200">
 Workforce
 </span>
 </span>
 <p className="text-[11px] text-pink-500 font-medium hidden sm:block">
 Automated Logistics &amp; HR Ecosystem
 </p>
 </div>
 </div>
 </div>

 {/* Center: global search */}
 <div ref={searchRef} className="hidden md:flex items-center flex-1 max-w-md mx-6 relative">
 <div className="relative w-full">
 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-pink-400" size={16} />
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
 placeholder="Search drivers, shifts, routes, timesheets..."
 className="w-full bg-pink-50/50 border border-pink-200 rounded-full pl-10 pr-12 py-1.5 text-xs text-pink-950 placeholder-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white transition"
 />
 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-white border border-pink-200 text-pink-400 px-1.5 py-0.5 rounded font-mono">
 {loading ? <RefreshCw size={11} className="animate-spin text-pink-500" /> : '⌘K'}
 </span>
 </div>

 {/* Results dropdown */}
 {showDropdown && (
 <div
 id="global-search-listbox"
 role="listbox"
 className="absolute top-full left-0 right-0 mt-2 bg-white border border-pink-200 rounded-2xl shadow-xl shadow-pink-100 py-2 max-h-96 overflow-y-auto z-50"
 >
 {ordered.length === 0 && !loading && (
 <p className="px-4 py-6 text-center text-xs text-pink-400">
 No matches for &quot;{query.trim()}&quot;.
 </p>
 )}

 {ordered.length === 0 && loading && (
 <p className="px-4 py-6 text-center text-xs text-pink-400">Searching…</p>
 )}

 {GROUP_ORDER.map((type) => {
 const group = results.filter((r) => r.type === type);
 if (group.length === 0) return null;
 return (
 <div key={type} className="px-1.5">
 <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1 text-[10px] font-bold text-pink-400 uppercase tracking-wider">
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
 active ? 'bg-pink-50 ' : 'hover:bg-pink-50/60 '
 }`}
 >
 <div className="min-w-0">
 <p className="text-xs font-bold text-pink-950 truncate">
 {result.title}
 </p>
 <p className="text-[10px] text-pink-500 truncate">{result.subtitle}</p>
 </div>
 {active && (
 <CornerDownLeft size={13} className="text-pink-400 flex-shrink-0" />
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

 {/* Right: role + notifications + profile */}
 <div className="flex items-center gap-3">
 {/* Role badge */}
 <div className="hidden sm:flex items-center gap-1 bg-pink-100/70 p-1 rounded-full border border-pink-200 text-xs font-medium text-pink-900">
 <ShieldCheck size={14} className="text-pink-600 ml-1.5" />
 <span className="font-semibold text-pink-800 pr-2 pl-1">{role || 'Loading...'}</span>
 </div>

  {/* Notifications */}
  <div ref={notifRef} className="relative">
 <button
 onClick={() => setNotifOpen((v) => !v)}
 aria-label="Notifications"
 className="relative p-2 text-pink-700 hover:bg-pink-50 rounded-full border border-pink-200 transition"
 >
 <Bell size={18} />
 {notifications.unreadCount > 0 && (
 <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-pink-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
 {notifications.unreadCount > 99 ? '99+' : notifications.unreadCount}
 </span>
 )}
 </button>

 {notifOpen && (
 <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border border-pink-200 rounded-2xl shadow-xl shadow-pink-100 z-50 overflow-hidden">
 <div className="flex items-center justify-between px-4 py-2.5 border-b border-pink-100 bg-pink-50/50">
 <p className="text-xs font-bold text-pink-950">
 Notifications
 {notifications.unreadCount > 0 && (
 <span className="ml-1.5 text-[10px] bg-pink-600 text-white px-1.5 py-0.5 rounded-full font-bold">
 {notifications.unreadCount}
 </span>
 )}
 </p>
 {notifications.unreadCount > 0 && (
 <button
 onClick={notifications.markAllRead}
 className="text-[10px] font-bold text-pink-600 hover:text-pink-800 flex items-center gap-1"
 >
 <CheckCheck size={12} />
 Mark all read
 </button>
 )}
 </div>

 <div className="max-h-80 overflow-y-auto">
 {notifications.loading && (
 <p className="px-4 py-6 text-center text-xs text-pink-400">Loading…</p>
 )}
 {!notifications.loading && notifications.items.length === 0 && (
 <p className="px-4 py-6 text-center text-xs text-pink-400">
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
 className="w-full text-left px-4 py-3 border-b border-pink-50 hover:bg-pink-50/60 transition flex items-start gap-3"
 >
 <div className="p-2 bg-pink-50 rounded-lg border border-pink-100 flex-shrink-0">
 {NOTIF_ICON[item.type]}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between gap-2">
 <p className="text-xs font-bold text-pink-950 truncate">{item.title}</p>
 {notifications.isUnread(item.id) && (
 <span className="w-2 h-2 bg-pink-600 rounded-full flex-shrink-0" />
 )}
 </div>
 <p className="text-[10px] text-pink-600 truncate">{item.detail}</p>
 <p className="text-[9px] text-pink-400 mt-0.5">
 {relativeTime(item.createdAt)}
 </p>
 </div>
 </button>
 ))}
 </div>
 </div>
 )}
 </div>

  {/* Profile */}
  <div className="flex items-center gap-2 pl-2 border-l border-pink-100 px-2 py-1">
  <div className="w-8 h-8 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-xs ring-2 ring-pink-300">
  {profile?.avatar_initials || 'U'}
  </div>
  <div className="hidden sm:block text-left">
  <p className="text-xs font-bold text-pink-950 leading-tight">
  {profile?.full_name || 'User'}
  </p>
  <p className="text-[10px] text-pink-500 font-medium">{role || '—'}</p>
  </div>
  </div>
 </div>
 </div>
 </header>
 );
}
