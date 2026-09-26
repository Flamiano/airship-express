'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard,
  Clock,
  Calendar,
  FileText,
  UserCheck,
  PieChart,
  Settings,
  X,
} from 'lucide-react';
import { useSidebar } from './SidebarContext';
import { useAuth } from '../../contexts/AuthContext';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/workforce-management-dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/workforce-management-dashboard/attendance', label: 'Time & Attendance', icon: Clock },
  { href: '/workforce-management-dashboard/shifts', label: 'Shifts & Schedules', icon: Calendar },
  { href: '/workforce-management-dashboard/timesheets', label: 'Timesheet Workflow', icon: FileText },
  { href: '/workforce-management-dashboard/leave', label: 'Leave & Fatigue Rest', icon: UserCheck },
  { href: '/workforce-management-dashboard/analytics', label: 'Workforce Full Analytics', icon: PieChart },
  { href: '/workforce-management-dashboard/settings', label: 'System Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isOpen, close, isCollapsed } = useSidebar();
  const { profile, role } = useAuth();

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
        className={`fixed inset-y-0 left-0 z-40 h-full shrink-0 -translate-x-full border-r border-line bg-paper transition-transform duration-300 ease-out sm:sticky sm:top-0 sm:z-0 sm:h-dvh sm:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div
          className={`flex h-full flex-col transition-[width] duration-300 ease-out will-change-[width] ${
            isCollapsed ? 'w-72 sm:w-[76px]' : 'w-72 sm:w-64'
          }`}
        >
          {/* Mobile close */}
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

          {/* Brand header */}
          <div
            className={`flex h-16 items-center border-b border-line px-5 ${
              isCollapsed ? 'sm:justify-center sm:px-3' : ''
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/workforce-management-dashboard"
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
                    Workforce Management
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-6">
            <div>
              {!isCollapsed && (
                <p className="mb-2 px-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted">
                  Modules
                </p>
              )}
              <div className="flex flex-col gap-1">
                {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
                  const active = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      title={label}
                      onClick={close}
                      className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all ${
                        isCollapsed ? 'justify-center' : ''
                      } ${
                        active
                          ? 'bg-accent text-paper shadow-sm shadow-accent/25'
                          : 'text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-paper/[0.06]'
                      }`}
                    >
                      <Icon
                        size={17}
                        strokeWidth={1.9}
                        className={active ? 'text-paper' : 'text-muted group-hover:text-ink'}
                      />
                      {!isCollapsed && <span>{label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>

          {/* Footer identity */}
          {profile && (
            <div className={`mt-auto border-t border-line px-4 py-4 ${isCollapsed ? 'sm:px-2' : ''}`}>
              <div className={`flex items-center gap-2.5 ${isCollapsed ? 'sm:justify-center' : ''}`}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-paper">
                  {profile.avatar_initials ?? 'U'}
                </span>
                {!isCollapsed && (
                  <div className="min-w-0 leading-none">
                    <p className="truncate text-[12.5px] font-medium text-ink">{profile.full_name}</p>
                    <p className="mt-1 truncate text-[10.5px] capitalize text-muted">
                      {role ?? 'Staff'}
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
