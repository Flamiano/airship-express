"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import airshiplogo from "../../../../public/images/logo-remove-bg.png"
import {
  LayoutDashboard,
  Building2,
  Map,
  DollarSign,
  ClipboardList,
  Calendar,
  LogOut,
  ShieldCheck,
  Users,
  Activity,
  ChevronDown,
  AlertTriangle,
  X,
} from "lucide-react";
import { useShell } from "./ShellContext";
import { can, type Permission } from "../lib/rbac"; // put rbac.ts next to lib/session.ts and lib/supabase.ts
import { usePresenceHeartbeat } from "./usePresenceHeartbeat";

type NavLink = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  permission: Permission;
  /** Other pages that should also highlight this link */
  alsoActive?: string[];
};

type NavGroup = {
  label: string;
  icon: typeof LayoutDashboard;
  children: NavLink[];
};

const navItems: (NavLink | NavGroup)[] = [
  { label: "Dashboard", href: "/spnc/app/dashboard", icon: LayoutDashboard, permission: "dashboard:view" },
  { label: "Service Providers", href: "/spnc/app/service-providers", icon: Building2, permission: "providers:view" },
  { label: "Network & Routes", href: "/spnc/app/routes", icon: Map, permission: "routes:view" },
  { label: "Rates & Tariffs", href: "/spnc/app/rates", icon: DollarSign, permission: "rates:view" },
  { label: "SOPs", href: "/spnc/app/sops", icon: ClipboardList, permission: "sops:view" },
  { label: "Schedules", href: "/spnc/app/schedules", icon: Calendar, permission: "schedules:view" },
  // "Employees" opens like a dropdown with its pages underneath — admins only
  // (employees don't have employees:view or audit-logs:view, so the whole group is hidden for them)
  {
    label: "Employees",
    icon: Users,
    children: [
      {
        label: "Employee Activity",
        href: "/spnc/app/employees",
        icon: Activity,
        permission: "employees:view", // admins only
        alsoActive: ["/spnc/app/accounts"], // Create Account is opened from Employee Activity
      },
      { label: "Audit Logs", href: "/spnc/app/audit-logs", icon: ShieldCheck, permission: "audit-logs:view" },
    ],
  },
];

const isGroup = (item: NavLink | NavGroup): item is NavGroup => "children" in item;

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarOpen, mounted, role } = useShell();

  // Sidebar is on every app page, so this reports "I'm active" for every logged-in user.
  usePresenceHeartbeat();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [portalMounted, setPortalMounted] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  // Which dropdown groups are open (by label)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const isLinkActive = (link: NavLink) =>
    mounted && !!pathname && [link.href, ...(link.alsoActive ?? [])].some((p) => pathname.startsWith(p));

  // Open a group automatically when you're on one of its pages
  useEffect(() => {
    if (!pathname) return;
    for (const item of navItems) {
      if (isGroup(item) && item.children.some((c) => [c.href, ...(c.alsoActive ?? [])].some((p) => pathname.startsWith(p)))) {
        setOpenGroups((prev) => (prev[item.label] ? prev : { ...prev, [item.label]: true }));
      }
    }
  }, [pathname]);

  // document.body only exists client-side; guard for SSR/hydration.
  useEffect(() => {
    setPortalMounted(true);
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/spnc/app/api/logout", { method: "POST" });
      // Route groups like (auth) are not part of the URL.
      router.push("/spncAuth/login");
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
                {/* Light tile so a dark/transparent logo stays visible.
                    If your logo is white/light, change bg-[#F2F1EC] back to bg-[#0B1220]. */}
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F2F1EC]">
                  {logoFailed ? (
                    <span className="text-sm font-bold text-[#0B1220]">AE</span>
                  ) : (
                    <Image
                      src={airshiplogo}
                      alt="Airship Express"
                      width={40}
                      height={40}
                      priority
                      onError={() => setLogoFailed(true)}
                      className="h-10 w-10 object-contain"
                    />
                  )}
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
            {navItems.map((item) => {
              if (!isGroup(item)) {
                if (!can(role, item.permission)) return null;
                const Icon = item.icon;
                const active = isLinkActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    suppressHydrationWarning
                    className={`flex shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${
                      active
                        ? "bg-[#3A1229] text-[#F2419B] font-medium"
                        : "text-[#C7D1DA] hover:bg-[#121B26] hover:text-[#F2F1EC]"
                    }`}
                  >
                    <Icon size={18} className="shrink-0" />
                    {item.label}
                  </Link>
                );
              }

              // Dropdown group (e.g. Employees → Employee Activity, Audit Logs)
              const children = item.children.filter((c) => can(role, c.permission));
              if (children.length === 0) return null;
              const GroupIcon = item.icon;
              const open = !!openGroups[item.label];
              const groupActive = children.some(isLinkActive);
              return (
                <div key={item.label} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setOpenGroups((prev) => ({ ...prev, [item.label]: !prev[item.label] }))}
                    aria-expanded={open}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${
                      groupActive && !open
                        ? "bg-[#3A1229] text-[#F2419B] font-medium"
                        : groupActive
                        ? "text-[#F2419B] font-medium hover:bg-[#121B26]"
                        : "text-[#C7D1DA] hover:bg-[#121B26] hover:text-[#F2F1EC]"
                    }`}
                  >
                    <GroupIcon size={18} className="shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown size={16} className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                  </button>

                  <div
                    className={`grid transition-all duration-200 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                  >
                    <div className="overflow-hidden">
                      <div className="ml-5 mt-1 flex flex-col gap-1 border-l border-[#23303D] pl-3">
                        {children.map((c) => {
                          const Icon = c.icon;
                          const active = isLinkActive(c);
                          return (
                            <Link
                              key={c.href}
                              href={c.href}
                              tabIndex={open ? 0 : -1}
                              suppressHydrationWarning
                              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition ${
                                active
                                  ? "bg-[#3A1229] text-[#F2419B] font-medium"
                                  : "text-[#8FA0AF] hover:bg-[#121B26] hover:text-[#F2F1EC]"
                              }`}
                            >
                              <Icon size={16} className="shrink-0" />
                              {c.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
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