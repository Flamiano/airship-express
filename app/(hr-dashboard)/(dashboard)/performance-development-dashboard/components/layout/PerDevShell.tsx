"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Award,
  BarChart3,
  ChevronDown,
  ClipboardList,
  GitBranch,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  RefreshCw,
  Route,
  Target,
  Trophy,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import ThemeToggle from "@/app/components/ThemeToggle";
import { supabase } from "@/app/(hr-dashboard)/supabase/client";
import { useSidebar } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/layout/SidebarContext";
import { cn } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/utils/helpers/classNames";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import { usePerDevSession } from "@/performance-development-dashboard/hooks/usePerDevSession";
import { PerDevClock } from "@/performance-development-dashboard/components/layout/PerDevClock";
import { redirectToLogin } from "@/performance-development-dashboard/lib/auth/redirect";
import { PerDevNotificationBell } from "@/performance-development-dashboard/components/notifications/PerDevNotificationBell";

const DASHBOARD_PATH = "/performance-development-dashboard";

export function PerDevShell({ children }: { children: ReactNode }) {
  const { isOpen, toggle, close } = useSidebar();
  const { user, loading } = usePerDevSession();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const dashboardActive = pathname === DASHBOARD_PATH;
  const cyclesActive = pathname.startsWith(`${DASHBOARD_PATH}/cycles`);
  const goalsActive = pathname.startsWith(`${DASHBOARD_PATH}/goals`);
  const checkInsActive = pathname.startsWith(`${DASHBOARD_PATH}/check-ins`);
  const appraisalsActive = pathname.startsWith(`${DASHBOARD_PATH}/appraisals`);
  const competenciesActive = pathname.startsWith(
    `${DASHBOARD_PATH}/competencies`,
  );
  const learningActive = pathname.startsWith(
    `${DASHBOARD_PATH}/learning-development`,
  );
  const developmentActive = pathname.startsWith(
    `${DASHBOARD_PATH}/development-planning`,
  );
  const reportsActive = pathname.startsWith(
    `${DASHBOARD_PATH}/reports-analytics`,
  );
  const successionActive = pathname.startsWith(
    `${DASHBOARD_PATH}/succession-planning`,
  );
  const rewardsActive = pathname.startsWith(
    `${DASHBOARD_PATH}/recognition-rewards`,
  );

  const isAdmin = user?.accountType === "hr_admin";

  async function handleLogout() {
    // Capture the server-resolved account type BEFORE clearing the session so
    // the redirect lands on the matching sign-in page (employee/managers →
    // /employeeAuth, HR Admin → /hrAuth).
    const accountType = user?.accountType;
    await supabase.auth.signOut();
    redirectToLogin(accountType);
  }

  return (
    <div className="perdev-scope flex h-dvh w-full overflow-hidden bg-paper font-rethink text-ink dark:bg-paper">
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
        className={cn(
          "fixed inset-y-0 left-0 z-40 h-full shrink-0 -translate-x-full border-r border-line bg-paper transition-transform duration-300 ease-out sm:sticky sm:top-0 sm:z-0 sm:h-dvh sm:translate-x-0",
          isOpen && "translate-x-0",
        )}
      >
        <div className="flex h-full w-72 flex-col sm:w-64">
          <div className="flex h-16 items-center justify-between border-b border-line px-5 sm:justify-start">
            <Link
              href={DASHBOARD_PATH}
              className="flex min-w-0 items-center gap-3"
            >
              <Image
                src="/images/logo-remove-bg.png"
                alt="Airship Express"
                width={130}
                height={36}
                priority
                className="h-7 w-auto object-contain dark:brightness-0 dark:invert"
              />
            </Link>
            <Tooltip label="Close menu">
              <button
                type="button"
                onClick={close}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/[0.08] hover:text-ink sm:hidden"
                aria-label="Close menu"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </Tooltip>
          </div>

          <div className="px-5 pb-4">
            <p className="truncate text-[13px] font-semibold tracking-tight text-ink">
              Airship Express
            </p>
            <p className="mt-0.5 truncate text-[10.5px] font-medium uppercase tracking-[0.14em] text-accent">
              Performance Development
            </p>
          </div>

          <nav className="flex flex-1 flex-col gap-7 overflow-y-auto px-3 py-4">
            <div>
              <p className="mb-2 px-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted">
                Main
              </p>
              <Link
                href={DASHBOARD_PATH}
                onClick={close}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all",
                  dashboardActive
                    ? "bg-accent text-paper shadow-sm shadow-accent/25"
                    : "text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-paper/[0.06]",
                )}
              >
                <LayoutDashboard size={17} strokeWidth={1.9} />
                Dashboard
              </Link>
              {isAdmin && (
                <Link
                  href={`${DASHBOARD_PATH}/cycles`}
                  onClick={close}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all",
                    cyclesActive
                      ? "bg-accent text-paper shadow-sm shadow-accent/25"
                      : "text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-paper/[0.06]",
                  )}
                >
                  <RefreshCw size={17} strokeWidth={1.9} />
                  Performance Cycles
                </Link>
              )}
              <Link
                href={`${DASHBOARD_PATH}/goals`}
                onClick={close}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all",
                  goalsActive
                    ? "bg-accent text-paper shadow-sm shadow-accent/25"
                    : "text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-paper/[0.06]",
                )}
              >
                <Target size={17} strokeWidth={1.9} />
                Goals
              </Link>
              <Link
                href={`${DASHBOARD_PATH}/competencies`}
                onClick={close}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all",
                  competenciesActive
                    ? "bg-accent text-paper shadow-sm shadow-accent/25"
                    : "text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-paper/[0.06]",
                )}
              >
                <Award size={17} strokeWidth={1.9} />
                Competencies
              </Link>
              <Link
                href={`${DASHBOARD_PATH}/check-ins`}
                onClick={close}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all",
                  checkInsActive
                    ? "bg-accent text-paper shadow-sm shadow-accent/25"
                    : "text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-paper/[0.06]",
                )}
              >
                <MessageSquare size={17} strokeWidth={1.9} />
                Check-ins
              </Link>
              <Link
                href={`${DASHBOARD_PATH}/appraisals`}
                onClick={close}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all",
                  appraisalsActive
                    ? "bg-accent text-paper shadow-sm shadow-accent/25"
                    : "text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-paper/[0.06]",
                )}
              >
                <ClipboardList size={17} strokeWidth={1.9} />
                Appraisals
              </Link>
              <Link
                href={`${DASHBOARD_PATH}/learning-development`}
                onClick={close}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all",
                  learningActive
                    ? "bg-accent text-paper shadow-sm shadow-accent/25"
                    : "text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-paper/[0.06]",
                )}
              >
                <GraduationCap size={17} strokeWidth={1.9} />
                Learning &amp; Development
              </Link>
              {isAdmin && (
                <Link
                  href={`${DASHBOARD_PATH}/development-planning`}
                  onClick={close}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all",
                    developmentActive
                      ? "bg-accent text-paper shadow-sm shadow-accent/25"
                      : "text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-paper/[0.06]",
                  )}
                >
                  <Route size={17} strokeWidth={1.9} />
                  Development Planning
                </Link>
              )}
              {isAdmin && (
                <Link
                  href={`${DASHBOARD_PATH}/reports-analytics`}
                  onClick={close}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all",
                    reportsActive
                      ? "bg-accent text-paper shadow-sm shadow-accent/25"
                      : "text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-paper/[0.06]",
                  )}
                >
                  <BarChart3 size={17} strokeWidth={1.9} />
                  Reports &amp; Analytics
                </Link>
              )}
              {isAdmin && (
                <Link
                  href={`${DASHBOARD_PATH}/succession-planning`}
                  onClick={close}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all",
                    successionActive
                      ? "bg-accent text-paper shadow-sm shadow-accent/25"
                      : "text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-paper/[0.06]",
                  )}
                >
                  <GitBranch size={17} strokeWidth={1.9} />
                  Succession Planning
                </Link>
              )}
              {isAdmin && (
                <Link
                  href={`${DASHBOARD_PATH}/recognition-rewards`}
                  onClick={close}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all",
                    rewardsActive
                      ? "bg-accent text-paper shadow-sm shadow-accent/25"
                      : "text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-paper/[0.06]",
                  )}
                >
                  <Trophy size={17} strokeWidth={1.9} />
                  Recognition &amp; Rewards
                </Link>
              )}
            </div>
          </nav>

          <div className="mt-auto border-t border-line px-4 py-4">
            {loading ? (
              <div className="flex animate-pulse items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-line dark:bg-paper/10" />
                <div className="h-3 w-28 rounded-full bg-line dark:bg-paper/10" />
              </div>
            ) : (
              user && (
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-paper">
                    {user.initials}
                  </span>
                  <div className="min-w-0 leading-none">
                    <p className="truncate text-[12.5px] font-medium text-ink">
                      {user.fullName}
                    </p>
                    <p className="mt-1 truncate text-[10.5px] capitalize text-muted">
                      {user.role.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </aside>

      <div className="flex h-full min-w-0 flex-1 flex-col bg-paper">
        <header className="sticky top-0 z-20 w-full border-b border-line bg-paper">
          <div className="flex h-16 w-full items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
            <Tooltip label="Open menu">
              <button
                type="button"
                onClick={toggle}
                aria-label="Open menu"
                className="flex h-9 w-9 shrink-0 items-center justify-center border border-line rounded-lg text-muted transition-colors hover:text-ink sm:hidden"
              >
                <Menu size={18} strokeWidth={1.75} />
              </button>
            </Tooltip>

            <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-3">
              <PerDevClock />
              <PerDevNotificationBell />
              <ThemeToggle className="hidden sm:flex" />

              <div className="relative" ref={accountMenuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-accent/[0.06]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-paper">
                    {user?.initials ?? "U"}
                  </span>
                  <motion.span
                    animate={{ rotate: menuOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="hidden text-muted sm:block"
                  >
                    <ChevronDown size={14} strokeWidth={1.75} />
                  </motion.span>
                </button>

                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute right-0 top-11 z-40 w-52 rounded-xl border border-line bg-paper py-2 shadow-lg dark:border-paper/15"
                    >
                      <div className="px-3 pb-2">
                        <p className="text-[13px] font-medium text-ink">
                          {user?.fullName ?? "HR User"}
                        </p>
                        <p className="text-[11px] capitalize text-muted">
                          {user?.role?.replace(/_/g, " ") ?? "Staff"}
                        </p>
                      </div>
                      {user?.email && (
                        <p className="truncate border-t border-line px-3 py-2 text-[11.5px] text-muted dark:border-paper/10">
                          {user.email}
                        </p>
                      )}
                      <div className="border-t border-line px-3 pt-2 dark:border-paper/10">
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-accent/[0.06] hover:text-ink"
                        >
                          <LogOut size={15} strokeWidth={1.75} />
                          Sign out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        <main className="w-full min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-10">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
