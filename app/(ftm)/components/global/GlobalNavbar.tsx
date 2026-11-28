"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { AppRole, getDashboardRouteForRole } from "../../lib/roleAccess";
import { getAllowedNavPaths, getProfileActions, hasPermission } from "../../lib/permissions";
import { signOut } from "../../lib/auth";
import { getAlerts } from "../../lib/api";
import { useTheme } from "../providers/ThemeProvider";
import FtmProfileAvatar from "./FtmProfileAvatar";
import { FTM_NAV_GROUPS, basePath, type FtmNavChild, type FtmNavGroup, type FtmNavItem } from "./ftmNavConfig";
import { firstNameOf, formatRoleLabel, useFtmProfile } from "./useFtmProfile";

const ROLE_NAV_PATHS: Record<AppRole, string[]> = {
  fleet_manager: [
    "/dashboard",
    "/alerts",
    "/cost",
    "/driver/overview",
    "/driver/performance",
    "/driver/safety",
    "/driver/leaderboard",
    "/fuel",
    "/fuel/consumption",
    "/fuel/efficiency",
    "/fuel/refueling-log",
    "/fuel/receipts",
    "/fuel/photo-log",
    "/fuel/proof-pickup",
    "/fuel/destination-gallery",
    "/fuel/parcel-history",
    "/fvm",
    "/fvm/inventory",
    "/fvm/analytics",
    "/fvm/maintenance",
    "/vrds/dashboard",
    "/vrds/parcels",
    "/vrds/bookings",
    "/vrds/missions",
    "/vrds/route-planning",
    "/vrds/history",
  ],
  admin: [
    "/dashboard",
    "/alerts",
    "/users",
    "/cost",
    "/driver/overview",
    "/driver/performance",
    "/driver/safety",
    "/driver/leaderboard",
    "/fuel",
    "/fuel/consumption",
    "/fuel/efficiency",
    "/fuel/refueling-log",
    "/fuel/receipts",
    "/fuel/photo-log",
    "/fuel/proof-pickup",
    "/fuel/destination-gallery",
    "/fuel/parcel-history",
    "/fvm",
    "/fvm/inventory",
    "/fvm/analytics",
    "/fvm/maintenance",
    "/vrds/dashboard",
    "/vrds/parcels",
    "/vrds/bookings",
    "/vrds/missions",
    "/vrds/route-planning",
    "/vrds/history",
  ],
  dispatcher: [
    "/alerts",
    "/driver/overview",
    "/vrds/dashboard",
    "/vrds/parcels",
    "/vrds/bookings",
    "/vrds/missions",
    "/vrds/route-planning",
    "/vrds/history",
  ],
  driver: [
    "/dashboard",
    "/driver/overview",
    "/fuel",
    "/fuel/efficiency",
    "/fuel/refueling-log",
    "/alerts",
  ],
  customer: [
    "/customer",
    "/account",
  ],
};

const SIDEBAR_STORAGE_KEY = "ftm.sidebarCollapsed";
const DASHBOARD_PATHS = ["/dashboard", "/ftm-dashboard"];

type DashboardTab = { label: string; target: string };
const DASHBOARD_TABS: DashboardTab[] = [
  { label: "Overview", target: "ftm-dashboard-top" },
  { label: "Live Map", target: "ftm-live-map" },
  { label: "Activity", target: "ftm-mission-logs" },
];

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return <span aria-hidden="true" className={`material-symbols-outlined shrink-0 text-[20px] leading-none ${className}`}>{name}</span>;
}

function greeting(now: Date) {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function GlobalNavbar() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const profile = useFtmProfile();
  const currentRole = profile.role;

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const [alertCount, setAlertCount] = useState(0);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [dashboardTab, setDashboardTab] = useState(DASHBOARD_TABS[0].target);
  const [greetingText, setGreetingText] = useState("Welcome");
  const searchRef = useRef<HTMLDivElement | null>(null);

  const homeDashboardPath = getDashboardRouteForRole(currentRole) || "/ftmAuth";
  const profileActions = getProfileActions(currentRole);
  const canViewAlerts = hasPermission(currentRole, "alerts", "view");
  const isDashboard = DASHBOARD_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  // Visible menu = same rule as the old top navbar: getAllowedNavPaths(role).
  const visibleGroups = useMemo<FtmNavGroup[]>(() => {
    const allowedPaths = currentRole ? getAllowedNavPaths(currentRole) : [];
    const allowed = (path: string) => allowedPaths.includes(basePath(path));
    return FTM_NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items
        .map((item) => {
          const children = item.children?.filter((child) => allowed(child.path));
          if (allowed(item.path)) return children ? { ...item, children } : item;
          return children?.length ? { ...item, path: children[0].path, children } : null;
        })
        .filter((item): item is FtmNavItem => item !== null),
    })).filter((group) => group.items.length > 0);
  }, [currentRole]);

  const flatLinks = useMemo(() => visibleGroups.flatMap((group) => group.items.flatMap((item) => (
    item.children?.length
      ? item.children.map((child) => ({ label: child.label, path: child.path, section: item.label, icon: item.icon }))
      : [{ label: item.label, path: item.path, section: group.title, icon: item.icon }]
  ))), [visibleGroups]);

  // Longest matching route wins, so /fuel/receipts lights up Gallery, not Fuel Management.
  const active = useMemo(() => {
    const current = isDashboard ? "/dashboard" : pathname;
    const tab = searchParams?.get("tab");
    let best: { key: string; childPath: string | null; length: number } | null = null;
    for (const group of visibleGroups) {
      for (const item of group.items) {
        const candidates: Array<{ path: string; child: FtmNavChild | null }> = [
          { path: item.path, child: null },
          ...(item.children ?? []).map((child) => ({ path: child.path, child })),
        ];
        for (const candidate of candidates) {
          const candidateBase = basePath(candidate.path);
          if (current !== candidateBase && !current.startsWith(`${candidateBase}/`)) continue;
          const candidateTab = new URLSearchParams(candidate.path.split("?")[1] ?? "").get("tab");
          const tabScore = candidateTab ? (candidateTab === (tab ?? "active") ? 1 : -1) : 0;
          if (tabScore < 0) continue;
          const length = candidateBase.length * 2 + tabScore + (candidate.child ? 0 : -1);
          if (!best || length > best.length) {
            best = { key: item.key, childPath: candidate.child?.path ?? null, length };
          }
        }
      }
    }
    return best;
  }, [isDashboard, pathname, searchParams, visibleGroups]);

  const activeItem = visibleGroups.flatMap((group) => group.items).find((item) => item.key === active?.key) ?? null;

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    startTransition(() => {
      setCollapsed(stored === "true");
      setGreetingText(greeting(new Date()));
    });
  }, []);

  useEffect(() => {
    startTransition(() => {
      setMobileOpen(false);
      setSearchOpen(false);
      setQuery("");
      if (active?.key) setOpenKeys((keys) => (keys.has(active.key) ? keys : new Set([...keys, active.key])));
    });
  }, [pathname, active?.key]);

  // Real badge: number of ACTIVE alerts from /api/alerts (same source as the Alerts page).
  useEffect(() => {
    if (!canViewAlerts) return;
    let alive = true;
    const load = () => {
      getAlerts({ status: "ACTIVE" })
        .then((items: unknown) => { if (alive) setAlertCount(Array.isArray(items) ? items.length : 0); })
        .catch(() => { if (alive) setAlertCount(0); });
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => { alive = false; window.clearInterval(id); };
  }, [canViewAlerts]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!value));
      return !value;
    });
  };

  const toggleOpen = (key: string) => {
    setOpenKeys((keys) => {
      const next = new Set(keys);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleLogout = async () => {
    await signOut();
    router.replace("/ftmAuth");
  };

  const searchResults = query.trim()
    ? flatLinks.filter((link) => `${link.label} ${link.section}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : [];

  const scrollToSection = (target: string) => {
    setDashboardTab(target);
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const canCreateBooking = currentRole ? getAllowedNavPaths(currentRole).includes("/vrds/bookings") : false;
  const sectionTabs = !isDashboard && activeItem?.children && activeItem.children.length > 1 ? activeItem.children : null;

  const renderNav = (isCollapsed: boolean) => (
    <nav aria-label="Main navigation" className="ftm-sidebar-scroll -mx-1 flex-1 overflow-y-auto px-1">
      {visibleGroups.map((group, groupIndex) => (
        <div key={group.title}>
          {isCollapsed ? (
            groupIndex > 0 && <div className="mx-[18px] my-2.5 h-px bg-[#ead3dc] dark:bg-slate-700" />
          ) : (
            <div className={`px-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-[.18em] text-[#a8939c] ${groupIndex ? "mt-4" : "mt-1"}`}>{group.title}</div>
          )}
          {group.items.map((item) => {
            const isActive = active?.key === item.key;
            const children = item.children ?? [];
            const hasChildren = children.length > 1;
            const isOpen = hasChildren && openKeys.has(item.key) && !isCollapsed;
            const badge = item.key === "alerts" && alertCount > 0 ? alertCount : null;
            const rowClass = `ftm-nav-item relative flex h-11 w-full items-center gap-3 rounded-[14px] text-sm font-semibold transition-colors ${isCollapsed ? "justify-center px-0" : "px-3"} ${isActive
              ? "bg-[#b80049] text-white shadow-[0_8px_18px_rgba(184,0,73,0.28)]"
              : "text-[#5b6b79] hover:bg-[#fff0f6] hover:text-[#b80049] dark:text-slate-300 dark:hover:bg-slate-800"}`;
            const inner = (
              <>
                <Icon name={item.icon} />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
                {badge != null && (isCollapsed
                  ? <span className="absolute right-[18px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" aria-label={`${badge} active alerts`} />
                  : <span className={`ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold ${isActive ? "bg-white text-[#b80049]" : "bg-red-500 text-white"}`}>{badge > 99 ? "99+" : badge}</span>)}
                {hasChildren && !isCollapsed && (
                  <Icon name="expand_more" className={`${badge != null ? "ml-2" : "ml-auto"} text-[18px] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                )}
              </>
            );
            return (
              <div key={item.key} className="mb-0.5">
                {hasChildren && !isCollapsed ? (
                  <button type="button" className={rowClass} onClick={() => toggleOpen(item.key)} aria-expanded={isOpen}>{inner}</button>
                ) : (
                  <Link href={item.path} className={rowClass} title={isCollapsed ? item.label : undefined} aria-label={isCollapsed ? item.label : undefined} aria-current={isActive ? "page" : undefined}>{inner}</Link>
                )}
                {isOpen && (
                  <div className="mb-2 mt-1">
                    {children.map((child) => {
                      const childActive = isActive && active?.childPath === child.path;
                      return (
                        <Link
                          key={child.path}
                          href={child.path}
                          aria-current={childActive ? "page" : undefined}
                          className={`ml-[22px] flex h-[34px] items-center rounded-r-[10px] border-l-2 pl-[22px] pr-3 text-[13px] transition-colors ${childActive
                            ? "border-[#b80049] bg-[#fff0f6] font-bold text-[#b80049] dark:bg-slate-800"
                            : "border-[#f1e4ea] font-medium text-[#5b6b79] hover:bg-[#fff0f6] hover:text-[#b80049] dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"}`}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const renderSidebarBody = (isCollapsed: boolean, inDrawer: boolean) => (
    <>
      <div className="mb-3 flex h-12 items-center gap-3 px-1">
        <button
          type="button"
          onClick={inDrawer ? () => setMobileOpen(false) : toggleCollapsed}
          title={inDrawer ? "Close menu" : isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={inDrawer ? "Close menu" : isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#b80049] text-sm font-extrabold text-white shadow-lg shadow-[#b80049]/30"
        >
          AX
        </button>
        {!isCollapsed && (
          <>
            <Link href={homeDashboardPath} className="min-w-0 leading-tight" aria-label="Go to your home dashboard">
              <div className="text-[15px] font-extrabold tracking-tight text-[#141d23] dark:text-white">AIRSHIP EXPRESS</div>
              <div className="text-[10px] font-bold tracking-[.14em] text-[#b80049]">FLEET &amp; TRANSPORT</div>
            </Link>
            <button
              type="button"
              onClick={inDrawer ? () => setMobileOpen(false) : toggleCollapsed}
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl text-[#5b6b79] hover:bg-[#fff0f6] dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label={inDrawer ? "Close menu" : "Collapse sidebar"}
            >
              <Icon name={inDrawer ? "close" : "left_panel_close"} />
            </button>
          </>
        )}
      </div>

      {renderNav(isCollapsed)}

      <div className="mt-2 space-y-1 border-t border-[#f1e4ea] pt-3 dark:border-slate-700">
        <button
          type="button"
          onClick={toggleTheme}
          title={isCollapsed ? "Dark mode" : undefined}
          aria-label="Toggle dark mode"
          className={`flex h-11 w-full items-center gap-3 rounded-[14px] text-sm font-semibold text-[#5b6b79] transition-colors hover:bg-[#fff0f6] hover:text-[#b80049] dark:text-slate-300 dark:hover:bg-slate-800 ${isCollapsed ? "justify-center" : "px-3"}`}
        >
          <Icon name={theme === "dark" ? "light_mode" : "dark_mode"} />
          {!isCollapsed && (
            <>
              <span>Dark mode</span>
              <span className={`relative ml-auto h-5 w-9 rounded-full transition-colors ${theme === "dark" ? "bg-[#b80049]" : "bg-[#f1e4ea]"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-[#ffffff] shadow transition-all ${theme === "dark" ? "left-[18px]" : "left-0.5"}`} />
              </span>
            </>
          )}
        </button>
        {profileActions.settings && (
          <Link
            href="/account/settings?tab=overview"
            title={isCollapsed ? "Account Settings" : undefined}
            aria-label={isCollapsed ? "Account Settings" : undefined}
            className={`flex h-11 w-full items-center gap-3 rounded-[14px] text-sm font-semibold transition-colors ${pathname.startsWith("/account/settings") ? "bg-[#fff0f6] text-[#b80049]" : "text-[#5b6b79] hover:bg-[#fff0f6] hover:text-[#b80049] dark:text-slate-300 dark:hover:bg-slate-800"} ${isCollapsed ? "justify-center" : "px-3"}`}
          >
            <Icon name="settings" />
            {!isCollapsed && <span>Account Settings</span>}
          </Link>
        )}
        <div className={`mt-2 flex items-center gap-3 rounded-2xl ${isCollapsed ? "flex-col bg-transparent p-0" : "bg-[#fff0f6] p-2 dark:bg-slate-800"}`}>
          <Link href="/account/profile" title="Profile" aria-label="Open profile" className="relative shrink-0">
            <FtmProfileAvatar name={profile.name} className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#b80049] text-sm font-extrabold text-white" />
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" aria-label="Online" />
          </Link>
          {!isCollapsed && (
            <Link href="/account/profile" className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-bold text-[#141d23] dark:text-white">{profile.name}</div>
              <div className="truncate text-[10px] font-extrabold uppercase tracking-[.16em] text-[#b80049]">{formatRoleLabel(currentRole)}</div>
            </Link>
          )}
          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#b80049] hover:bg-[#ffffff] dark:hover:bg-slate-700 ${isCollapsed ? "" : "ml-auto"}`}
          >
            <Icon name="logout" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <aside
        className="ftm-sidebar fixed inset-y-0 left-0 z-[1102] hidden flex-col border-r border-[#f1e4ea] bg-[#ffffff] px-3 py-4 transition-[width] duration-200 ease-out dark:border-slate-800 dark:bg-slate-950 lg:flex"
        data-collapsed={collapsed ? "true" : "false"}
        style={{ width: collapsed ? 84 : 272 }}
      >
        {renderSidebarBody(collapsed, false)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-[1200] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-[min(86vw,300px)] flex-col bg-[#ffffff] px-3 py-4 shadow-2xl dark:bg-slate-950">
            {renderSidebarBody(false, true)}
          </aside>
        </div>
      )}

      <header className="ftm-topbar sticky top-0 z-[1101] w-full bg-[#fbf6f8]/90 backdrop-blur-md dark:bg-slate-950/85">
        <div className="flex h-[76px] items-center gap-3 px-4 sm:px-6 lg:gap-4 lg:px-8">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#f1e4ea] bg-[#ffffff] text-[#141d23] lg:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            aria-label="Open menu"
          >
            <Icon name="menu" />
          </button>

          {(isDashboard || sectionTabs) && (
            <div className="hidden max-w-[46%] shrink-0 items-center overflow-x-auto rounded-full bg-[#f6e9ef] p-1 md:flex dark:bg-slate-800">
              {isDashboard ? (
                <>
                  {DASHBOARD_TABS.map((tab) => (
                    <button
                      key={tab.target}
                      type="button"
                      onClick={() => scrollToSection(tab.target)}
                      className={`whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold ${dashboardTab === tab.target ? "bg-[#ffffff] text-[#b80049] shadow-[0_2px_8px_rgba(184,0,73,0.12)] dark:bg-slate-900" : "text-[#5b6b79] hover:text-[#b80049] dark:text-slate-300"}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                  {canViewAlerts && (
                    <Link href="/alerts" className="whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold text-[#5b6b79] hover:text-[#b80049] dark:text-slate-300">Alerts</Link>
                  )}
                </>
              ) : (
                sectionTabs?.map((child) => {
                  const on = active?.childPath === child.path;
                  return (
                    <Link
                      key={child.path}
                      href={child.path}
                      className={`whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold ${on ? "bg-[#ffffff] text-[#b80049] shadow-[0_2px_8px_rgba(184,0,73,0.12)] dark:bg-slate-900" : "text-[#5b6b79] hover:text-[#b80049] dark:text-slate-300"}`}
                    >
                      {child.label}
                    </Link>
                  );
                })
              )}
            </div>
          )}

          <div ref={searchRef} className="relative min-w-0 max-w-md flex-1 lg:ml-2">
            <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#5b6b79]" />
            <input
              value={query}
              onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && searchResults[0]) router.push(searchResults[0].path);
                if (event.key === "Escape") setSearchOpen(false);
              }}
              placeholder="Search modules and pages…"
              aria-label="Search FTM modules"
              className="h-11 w-full rounded-full border border-[#f1e4ea] bg-[#ffffff] pl-12 pr-4 text-sm text-[#141d23] outline-none placeholder:text-[#94a3b8] focus:border-[#b80049] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            {searchOpen && query.trim() && (
              <div className="absolute left-0 right-0 top-full z-[1203] mt-2 overflow-hidden rounded-2xl border border-[#f1e4ea] bg-[#ffffff] p-1.5 shadow-[0_18px_45px_rgba(20,29,35,0.16)] dark:border-slate-700 dark:bg-slate-900">
                {searchResults.length ? searchResults.map((result) => (
                  <Link key={result.path} href={result.path} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-[#fff0f6] dark:hover:bg-slate-800">
                    <Icon name={result.icon} className="text-[#b80049]" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-[#141d23] dark:text-white">{result.label}</span>
                      <span className="block truncate text-[11px] text-[#5b6b79] dark:text-slate-400">{result.section}</span>
                    </span>
                  </Link>
                )) : <div className="px-3 py-2 text-xs text-[#5b6b79]">No matching page.</div>}
              </div>
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <span className="hidden h-9 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-bold uppercase tracking-wider text-[#5b6b79] lg:flex dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]" />
              Live
            </span>
            {canViewAlerts && (
              <Link
                href="/alerts"
                className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[#f1e4ea] bg-[#ffffff] text-[#141d23] hover:text-[#b80049] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                aria-label={alertCount > 0 ? `${alertCount} active alerts` : "Alerts"}
                title={alertCount > 0 ? `${alertCount} active alerts` : "Alerts"}
              >
                <Icon name="notifications" />
                {alertCount > 0 && <span className="absolute right-2.5 top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />}
              </Link>
            )}
            {canCreateBooking && (
              <Link
                href="/vrds/bookings"
                className="hidden h-11 items-center gap-2 rounded-full bg-[#b80049] px-5 text-sm font-bold text-white shadow-lg shadow-[#b80049]/30 hover:bg-[#9a003c] sm:flex"
              >
                <Icon name="add" />
                New Booking
              </Link>
            )}
            <Link href="/account/profile" className="flex items-center gap-3 pl-1" aria-label="Open profile">
              <FtmProfileAvatar name={profile.name} className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#b80049] text-sm font-extrabold text-white" />
              <span className="hidden leading-tight 2xl:block">
                <span className="block text-[11px] text-[#5b6b79] dark:text-slate-400">{greetingText}</span>
                <span className="block max-w-[140px] truncate text-sm font-bold text-[#141d23] dark:text-white">{firstNameOf(profile.name)}</span>
              </span>
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}

