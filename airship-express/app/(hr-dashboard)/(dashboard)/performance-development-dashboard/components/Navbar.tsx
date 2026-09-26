"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import ThemeToggle from "@/app/components/ThemeToggle";
import { NAV, useSidebar } from "./Sidebar";
import { useHrAuth } from "../lib/hr-auth";

export default function Navbar() {
  const { logout } = useHrAuth();
  const { toggle, isCollapsed, toggleCollapsed } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();

  const breadcrumb = (() => {
    for (const group of NAV) {
      for (const item of group.items) {
        if (pathname === item.href) {
          return { section: group.section, label: item.label };
        }
      }
    }
    return null;
  })();

  async function handleSignOut() {
    await logout();
    router.replace("/hrAuth");
  }

  return (
    <header className="z-30 w-full border-b border-line bg-paper/95 backdrop-blur dark:border-paper/15 dark:bg-ink/95">
      <div className="flex h-16 w-full items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={toggle}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 sm:hidden dark:border-paper/15"
            aria-label="Toggle menu"
          >
            <Menu size={18} strokeWidth={1.75} />
          </button>

          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 dark:hover:bg-paper/[0.06] dark:hover:text-paper sm:flex"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <PanelLeftOpen size={19} strokeWidth={1.75} />
            ) : (
              <PanelLeftClose size={19} strokeWidth={1.75} />
            )}
          </button>

          <Image
            src="/images/logo-remove-bg.png"
            alt="Airship Express"
            width={140}
            height={38}
            className="h-8 w-auto shrink-0 dark:brightness-0 dark:invert"
          />

          {breadcrumb && (
            <div className="hidden min-w-0 items-center gap-2.5 pl-2.5 sm:flex">
              <span className="h-5 w-px shrink-0 bg-line dark:bg-paper/15" aria-hidden />
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="shrink-0 text-[13px] font-medium uppercase tracking-[0.2em] text-accent">
                  {breadcrumb.section}
                </span>
                <span
                  className="h-3 w-px shrink-0 bg-line dark:bg-paper/15"
                  aria-hidden
                />
                <span className="truncate text-sm font-semibold text-ink dark:text-paper">
                  {breadcrumb.label}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2.5 sm:gap-4">
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-full border border-line px-3 py-1.5 font-rethink text-xs font-semibold text-muted transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 dark:border-paper/15"
          >
            Sign out
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
