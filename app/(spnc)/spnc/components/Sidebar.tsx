"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Map,
  DollarSign,
  ClipboardList,
  Calendar,
  LogOut,
  ShieldCheck,
  AlertTriangle,
  X,
} from "lucide-react";
import { useShell } from "./ShellContext";

const navItems = [
  { label: "Dashboard", href: "/spnc/app/dashboard", icon: LayoutDashboard },
  { label: "Service Providers", href: "/spnc/app/service-providers", icon: Building2 },
  { label: "Network & Routes", href: "/spnc/app/routes", icon: Map },
  { label: "Rates & Tariffs", href: "/spnc/app/rates", icon: DollarSign },
  { label: "SOPs", href: "/spnc/app/sops", icon: ClipboardList },
  { label: "Schedules", href: "/spnc/app/schedules", icon: Calendar },
  { label: "Audit Logs", href: "/spnc/app/audit-logs", icon: ShieldCheck },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarOpen, mounted } = useShell();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [portalMounted, setPortalMounted] = useState(false);

  // document.body only exists client-side; guard for SSR/hydration.
  useEffect(() => {
    setPortalMounted(true);
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/spnc/app/api/logout", { method: "POST" });
      router.push("/spnc/app/login");
      router.refresh();
    } finally {
      setSigningOut(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <aside
        className={`print-hidden flex h-screen shrink-0 flex-col overflow-hidden border-r border-[#23303D] bg-[#0B1220] transition-all duration-200 ${
          sidebarOpen ? "w-64" : "w-0"
        }`}
      >
        <div className={`flex h-full flex-col overflow-hidden ${sidebarOpen ? "px-4 py-6" : "px-0 py-6"}`}>
          {/* Brand — pinned, never scrolls */}
          <div className="mb-6 shrink-0 whitespace-nowrap">
            <Link
              href="/spnc/app/dashboard"
              suppressHydrationWarning
              className="group flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-[#121B26]"
            >
              <span
                className="relative shrink-0 rounded-[14px] p-[2px] shadow-[0_0_22px_rgba(242,65,155,0.35)] transition group-hover:shadow-[0_0_28px_rgba(242,65,155,0.55)]"
                style={{ background: "linear-gradient(135deg, #F2419B, #FF8CC6 55%, #3A1229)" }}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0B1220] p-1.5">
                  <img
                    src="/ae.png"
                    alt="Airship Express"
                    className="h-full w-full rounded-md object-contain"
                  />
                </span>
              </span>

              <span className="min-w-0">
                <span
                  className="block text-[16px] leading-tight font-bold tracking-tight text-[#F2F1EC]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Airship{" "}
                  <span
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: "linear-gradient(90deg, #F2419B, #FF8CC6)" }}
                  >
                    Express
                  </span>
                </span>
                <span className="mt-0.5 block text-[11px] text-[#8FA0AF]">Network Control Suite</span>
              </span>
            </Link>

            <div
              className="mt-5 h-px w-full"
              style={{ background: "linear-gradient(90deg, rgba(242,65,155,0.6), #23303D 60%, transparent)" }}
            />
          </div>

          {/* Nav — the only part that scrolls if it overflows */}
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto whitespace-nowrap">
            {navItems.map(({ label, href, icon: Icon }) => {
              const active = mounted && !!pathname && pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  suppressHydrationWarning
                  className={`flex shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${
                    active
                      ? "bg-[#3A1229] text-[#F2419B] font-medium"
                      : "text-[#C7D1DA] hover:bg-[#121B26] hover:text-[#F2F1EC]"
                  }`}
                >
                  <Icon size={18} className="shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Sign out — pinned, never scrolls */}
          <div className="mt-auto shrink-0 border-t border-[#23303D] pt-4 whitespace-nowrap">
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-[#F2419B] transition hover:bg-[#3A1229]"
            >
              <LogOut size={18} className="shrink-0" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Sign-out confirmation dialog — portaled to <body> so it always
          renders above the app shell, regardless of any parent's
          overflow/transform/z-index stacking context. */}
      {confirmOpen &&
        portalMounted &&
        createPortal(
          <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="signout-title"
          onClick={() => !signingOut && setConfirmOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
          >
            {/* Close icon */}
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={signingOut}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
            >
              <X size={16} />
            </button>

            {/* Icon + heading */}
            <div className="flex flex-col items-center text-center">
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#FCE4F0]">
                <AlertTriangle size={22} className="text-[#F2419B]" />
              </span>
              <h2 id="signout-title" className="text-base font-semibold text-gray-900">
                Confirm Sign Out
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                You are about to end your current session on the Network Control Suite.
                Any unsaved changes will be lost. Do you wish to proceed?
              </p>
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={signingOut}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex-1 rounded-lg bg-[#F2419B] px-4 py-2.5 text-sm font-semibold text-[#0B1220] transition hover:bg-[#FF8CC6] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {signingOut ? "Signing out…" : "Yes, Sign Out"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
