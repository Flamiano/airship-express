"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AnimatePresence,
  motion,
  type Variants,
} from "framer-motion";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  Award,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  MessageSquareText,
  Target,
  TrendingUp,
  UserCog,
  X,
  type LucideIcon,
} from "lucide-react";
import { useHrAuth } from "../lib/hr-auth";
import { roleLabel } from "../lib/types";

type SidebarContextType = {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
  isCollapsed: boolean;
  toggleCollapsed: () => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const SIDEBAR_COLLAPSED_KEY = "performance-development-sidebar-collapsed";

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (saved === "true") setIsCollapsed(true);
    } catch {}
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        toggle: () => setIsOpen((v) => !v),
        close: () => setIsOpen(false),
        isCollapsed,
        toggleCollapsed: () =>
          setIsCollapsed((v) => {
            const next = !v;
            try {
              localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
            } catch {}
            return next;
          }),
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return context;
}

type NavItem = {
  icon: LucideIcon;
  label: string;
  href: string;
  adminOnly?: boolean;
};

export const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Overview",
    items: [
      {
        icon: LayoutDashboard,
        label: "Dashboard",
        href: "/performance-development-dashboard",
      },
    ],
  },
  {
    section: "Performance",
    items: [
      { icon: Target, label: "Goals", href: "/performance-development-dashboard/goals" },
      {
        icon: MessageSquareText,
        label: "Feedback",
        href: "/performance-development-dashboard/feedback",
      },
      {
        icon: ClipboardCheck,
        label: "Appraisals",
        href: "/performance-development-dashboard/appraisals",
      },
      { icon: TrendingUp, label: "PIP", href: "/performance-development-dashboard/pip" },
    ],
  },
  {
    section: "Development",
    items: [
      {
        icon: BookOpen,
        label: "Learning Management",
        href: "/performance-development-dashboard/learning",
      },
      {
        icon: GraduationCap,
        label: "Training Management",
        href: "/performance-development-dashboard/training",
      },
      {
        icon: Award,
        label: "Competency Management",
        href: "/performance-development-dashboard/competency",
      },
    ],
  },
  {
    section: "People",
    items: [
      {
        icon: HeartHandshake,
        label: "Social Recognition",
        href: "/performance-development-dashboard/recognition",
      },
      {
        icon: UserCog,
        label: "Succession Planning",
        href: "/performance-development-dashboard/succession",
        adminOnly: true,
      },
    ],
  },
];

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -6 },
  show: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, delay: 0.04 * i, ease: "easeOut" },
  }),
};

export default function Sidebar() {
  const pathname = usePathname();
  const { isAdmin } = useHrAuth();
  const { isOpen, close, isCollapsed } = useSidebar();

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  let itemIndex = 0;

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
            aria-hidden
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed inset-y-0 left-0 z-40 h-full shrink-0 -translate-x-full border-r border-line bg-paper transition-transform duration-300 ease-out sm:sticky sm:top-0 sm:z-0 sm:h-dvh sm:translate-x-0 dark:border-paper/15 dark:bg-ink ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div
          className={`flex h-full w-full flex-col transition-[width] duration-300 ease-out sm:w-64 ${
            isCollapsed ? "sm:w-[76px]" : "sm:w-64"
          }`}
        >
          {/* mobile header */}
          <div className="flex items-center justify-between px-5 pt-5 sm:hidden">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-accent">
              Menu
            </span>
            <button
              type="button"
              onClick={close}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/[0.08] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 dark:hover:text-paper"
              aria-label="Close menu"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>

          <nav
            aria-label="Performance & Development"
            className="flex flex-1 flex-col gap-7 px-3 py-6"
          >
            {NAV.map((group) => {
              const items = group.items.filter(
                (item) => !item.adminOnly || isAdmin
              );
              if (items.length === 0) return null;
              return (
                <div key={group.section}>
                  {!isCollapsed && (
                    <p className="mb-2 px-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted">
                      {group.section}
                    </p>
                  )}
                  <div className="flex flex-col gap-1">
                    {items.map(({ icon: Icon, label, href }) => {
                      const active = pathname === href;
                      const order = itemIndex++;
                      return (
                        <motion.div
                          key={href}
                          custom={order}
                          variants={itemVariants}
                          initial="hidden"
                          animate="show"
                        >
                          <Link
                            href={href}
                            title={label}
                            onClick={close}
                            aria-current={active ? "page" : undefined}
                            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                              isCollapsed ? "sm:justify-center sm:px-0" : ""
                            } ${
                              active
                                ? "bg-accent text-paper shadow-sm shadow-accent/25"
                                : "text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-paper/[0.06] dark:hover:text-paper"
                            }`}
                          >
                            <Icon
                              size={17}
                              strokeWidth={1.9}
                              className={
                                active
                                  ? ""
                                  : "text-muted group-hover:text-ink dark:group-hover:text-paper"
                              }
                            />
                            {!isCollapsed && label}
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          <SidebarFooter isCollapsed={isCollapsed} />
        </div>
      </aside>
    </>
  );
}

function SidebarFooter({ isCollapsed }: { isCollapsed: boolean }) {
  const { user } = useHrAuth();
  if (!user) return null;

  const initials = user.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div
      className={`mt-auto border-t border-line px-4 py-4 dark:border-paper/15 ${
        isCollapsed ? "sm:px-2" : ""
      }`}
    >
      <div
        className={`flex items-center gap-2.5 ${isCollapsed ? "sm:justify-center" : ""}`}
      >
        <span
          title={isCollapsed ? user.fullName : undefined}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-paper"
        >
          {initials || "?"}
        </span>
        {!isCollapsed && (
          <div className="min-w-0 leading-none">
            <p className="truncate text-[12.5px] font-medium text-ink dark:text-paper">
              {user.fullName}
            </p>
            <p className="mt-1 truncate text-[10.5px] capitalize text-muted">
              {roleLabel(user.role)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
