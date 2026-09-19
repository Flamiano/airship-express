'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SignOutButton } from '../../fmscomponents/dashboard/SignOutButton';
import {
  LayoutDashboard,
  BookOpen,
  ReceiptText,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  Wallet,
  PiggyBank,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronDown,
  Menu,
  NotebookPen,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children?: { name: string; href: string }[];
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    items: [{ name: 'Overview', href: '/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Financial Operations',
    items: [
      {
        name: 'General Ledger',
        href: '/dashboard/general-ledger',
        icon: BookOpen,
        children: [{ name: 'Journal', href: '/dashboard/general-ledger/journal' }],
      },
      { name: 'Accounts Receivable', href: '/dashboard/accounts-receivable', icon: ReceiptText },
      { name: 'Accounts Payable', href: '/dashboard/accounts-payable', icon: CreditCard },
      { name: 'Collections', href: '/dashboard/collections', icon: Banknote },
      { name: 'Disbursements', href: '/dashboard/disbursements', icon: ArrowRightLeft },
      { name: 'Cash & Treasury', href: '/dashboard/cash-management', icon: Wallet },
      { name: 'Budgets', href: '/dashboard/budget-management', icon: PiggyBank },
      { name: 'Reports & Analytics', href: '/dashboard/financial-reports', icon: BarChart3 },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { name: 'Settings', href: '/dashboard/settings', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(true);
  const [openParents, setOpenParents] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const next: Record<string, boolean> = {};
    navGroups.forEach((group) => {
      group.items.forEach((item) => {
        if (!item.children) return;
        const childActive = item.children.some((child) => pathname?.startsWith(child.href));
        const parentActive = pathname === item.href;
        if (childActive || parentActive) next[item.href] = true;
      });
    });
    setOpenParents((prev) => ({ ...prev, ...next }));
  }, [pathname]);

  const toggleParent = (href: string) => {
    setOpenParents((prev) => ({ ...prev, [href]: !prev[href] }));
  };

  return (
    <aside
  className={`h-screen z-40 bg-background border-r border-border flex flex-col flex-shrink-0 transition-all duration-300 ${
    isExpanded ? 'w-64' : 'w-20'
  }`}
>
      {/* Header Block */}
      <div className="h-16 flex items-center border-b border-border px-4">
        {isExpanded ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3 overflow-hidden">
              <Image
                src="/images/logo-remove-bg.png"
                alt="Airship Express"
                width={32}
                height={32}
                className="h-8 w-8 flex-shrink-0 object-contain dark:brightness-0 dark:invert dark:opacity-60"
              />
              <div className="whitespace-nowrap">
                <h2 className="text-sm font-extrabold text-foreground leading-none tracking-tight">
                  Airship Express
                </h2>
              </div>
            </div>

            <button
              onClick={() => setIsExpanded(false)}
              className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-border/50 transition flex-shrink-0"
              title="Collapse Sidebar"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <button
              onClick={() => setIsExpanded(true)}
              className="p-2 rounded-xl text-foreground/40 hover:bg-border/50 transition flex items-center justify-center"
              title="Expand Sidebar"
            >
              <Menu size={20} />
            </button>
          </div>
        )}
      </div>

      {/* Navigation Items - Scrollbar visually hidden while retaining full scrolling capability */}
      <nav className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden p-3 space-y-1">
        {navGroups.map((group, groupIndex) => (
          <div key={group.label || `group-${groupIndex}`} className={groupIndex > 0 ? 'pt-4' : ''}>
            {group.label && isExpanded && (
              <p className="px-3.5 mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-foreground/35">
                {group.label}
              </p>
            )}

            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname?.startsWith(item.href));
                const hasChildren = !!item.children?.length;
                const isOpen = !!openParents[item.href];

                return (
                  <div key={item.href}>
                    <div
                      className={`flex items-center rounded-full text-xs font-semibold transition-all ${
                        isExpanded ? 'pl-3.5 pr-2 py-2.5 gap-3' : 'p-3 justify-center'
                      } ${
                        isActive
                          ? 'bg-[#e5167e] text-white shadow-md shadow-[#e5167e]/25'
                          : 'text-foreground/70 hover:text-foreground hover:bg-border/50'
                      }`}
                    >
                      <Link
                        href={item.href}
                        title={!isExpanded ? item.name : undefined}
                        className="flex items-center gap-3 flex-1 min-w-0"
                      >
                        <Icon
                          size={18}
                          className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-foreground/50'}`}
                        />
                        {isExpanded && <span className="whitespace-nowrap truncate">{item.name}</span>}
                      </Link>

                      {hasChildren && isExpanded && (
                        <button
                          type="button"
                          onClick={() => toggleParent(item.href)}
                          className={`p-1 rounded-md flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''} ${
                            isActive ? 'text-white/80 hover:text-white' : 'text-foreground/40 hover:text-foreground'
                          }`}
                          aria-label={isOpen ? `Collapse ${item.name}` : `Expand ${item.name}`}
                        >
                          <ChevronDown size={14} />
                        </button>
                      )}
                    </div>

                    {hasChildren && isExpanded && isOpen && (
                      <div className="ml-[1.4rem] mt-1 space-y-1 border-l border-border pl-3">
                        {item.children!.map((child) => {
                          const childActive = pathname?.startsWith(child.href);
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                                childActive
                                  ? 'text-[#e5167e] bg-[#e5167e]/10'
                                  : 'text-foreground/60 hover:text-foreground hover:bg-border/40'
                              }`}
                            >
                              <NotebookPen size={14} className="flex-shrink-0" />
                              <span className="whitespace-nowrap truncate">{child.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Sign Out Button */}
      <div className="p-3 border-t border-border bg-card/20">
        <SignOutButton isExpanded={isExpanded} />
      </div>
    </aside>
  );
}