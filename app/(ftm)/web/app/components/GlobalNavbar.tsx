"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppRole, getCurrentRole, getDashboardRouteForRole } from "../lib/roleAccess";
import { getAllowedNavPaths, getProfileActions } from "../lib/permissions";
import { normalizeRole } from "../lib/roleAccess";
import { supabase } from "../lib/supabaseClient";
import { signOut } from "../lib/auth";
import ThemeToggle from "./ThemeToggle";
import FtmProfileAvatar from "./FtmProfileAvatar";

type Child = { label: string; path: string; description: string };
type Item = { label: string; path: string; children?: Child[] };

const ITEMS: Item[] = [
  { label: "Operations Center", path: "/dashboard" },
  { label: "Alerts", path: "/alerts", children: [
  { label: "Active Alerts", path: "/alerts?tab=active", description: "Review current operational alerts." },
    { label: "Maintenance Notifications", path: "/alerts?tab=maintenance", description: "Review maintenance notices." },
    { label: "Safety Events", path: "/alerts?tab=safety", description: "Inspect recent safety events." },
    { label: "System History", path: "/alerts?tab=history", description: "Review historical system events." },
    { label: "Manage Users", path: "/users", description: "Manage FTM accounts and roles." },
  ] },
  { label: "Cost Analysis", path: "/cost" },
  { label: "Driver Performance", path: "/driver/overview", children: [
    { label: "Overview", path: "/driver/overview", description: "Monitor driver performance." },
    { label: "Performance", path: "/driver/performance", description: "Inspect efficiency and trends." },
    { label: "Safety Scores", path: "/driver/safety", description: "Review safety signals." },
    { label: "Leaderboard", path: "/driver/leaderboard", description: "Compare driver rankings." },
  ] },
  { label: "Fuel Management", path: "/fuel", children: [
    { label: "Fuel Overview", path: "/fuel", description: "See current fuel health." },
    { label: "Consumption", path: "/fuel/consumption", description: "Track consumption patterns." },
    { label: "Efficiency", path: "/fuel/efficiency", description: "Measure fleet efficiency." },
    { label: "Refueling Log", path: "/fuel/refueling-log", description: "Review refueling records." },
  ] },
  { label: "Gallery", path: "/fuel/receipts", children: [
    { label: "Receipt Gallery", path: "/fuel/receipts", description: "Browse driver expense receipts." },
    { label: "Fuel Photo Log", path: "/fuel/photo-log", description: "Review recent image submissions." },
    { label: "Proof of Pickup", path: "/fuel/proof-pickup", description: "Verify pickup confirmations and image proof." },
    { label: "Destination Gallery", path: "/fuel/destination-gallery", description: "Review destination photo submissions." },
    { label: "Parcel History", path: "/fuel/parcel-history", description: "Review parcel status and movement history." },
  ] },
  { label: "FVM", path: "/fvm", children: [
    { label: "Fleet Overview", path: "/fvm", description: "View fleet status." },
    { label: "Inventory", path: "/fvm/inventory", description: "Browse vehicles and assets." },
    { label: "Analytics", path: "/fvm/analytics", description: "Inspect fleet analytics." },
    { label: "Maintenance", path: "/fvm/maintenance", description: "Manage service schedules." },
  ] },
  { label: "VRDS", path: "/vrds/dashboard", children: [
    { label: "Dashboard", path: "/vrds/dashboard", description: "Live dispatch overview." },
    { label: "Parcels", path: "/vrds/parcels", description: "Receive and group parcels." },
    { label: "Bookings", path: "/vrds/bookings", description: "Assign and confirm dispatches." },
    { label: "Active Deliveries", path: "/vrds/missions", description: "Track active deliveries." },
    { label: "Route Planning", path: "/vrds/route-planning", description: "Build optimized routes." },
    { label: "History", path: "/vrds/history", description: "Review completed deliveries." },
  ] },
];

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

function formatRoleLabel(role: AppRole | null | undefined): string {
  if (!role) return "User";
  return role.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function GlobalNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileChild, setMobileChild] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState<AppRole | null>(null);
  const [profileName, setProfileName] = useState("Account");
  const [profileEmail, setProfileEmail] = useState("account@airship.com");
  const navRef = useRef<HTMLElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const homeDashboardPath = getDashboardRouteForRole(currentRole) || "/ftmAuth";

  useEffect(() => {
    let active = true;
    const hydrateProfile = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data } = sessionData.session?.user
        ? { data: { user: sessionData.session.user } }
        : await supabase.auth.getUser();
      if (!active) return;
      const authUser = data.user;
      const role = normalizeRole(authUser?.app_metadata?.role ?? authUser?.user_metadata?.role) ?? getCurrentRole();
      const storedEmail = window.localStorage.getItem("email");
      setCurrentRole(role);
      setProfileName(authUser?.user_metadata?.full_name || authUser?.email || window.localStorage.getItem("displayName") || storedEmail || "Account");
      setProfileEmail(authUser?.email || storedEmail || "account@airship.com");
    };
    void hydrateProfile();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => void hydrateProfile());
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const allowedPaths = currentRole ? getAllowedNavPaths(currentRole) : [];
  const profileActions = getProfileActions(currentRole);
  const isAllowedPath = (path: string) => allowedPaths.includes(path.split("?")[0]);
  const primaryNavPath = currentRole === "fleet_manager" ? "/dashboard" : homeDashboardPath;
  const visibleItems = ITEMS.map((item) => {
    const visibleChildren = item.children?.filter((child) => isAllowedPath(child.path));

    if (isAllowedPath(item.path)) {
      return visibleChildren ? { ...item, children: visibleChildren } : item;
    }

    return visibleChildren?.length ? { ...item, children: visibleChildren } : null;
  }).filter((item): item is Item => item !== null).sort((left, right) => {
    const homePath = primaryNavPath.split("?")[0];
    const leftIsHome = left.path === homePath;
    const rightIsHome = right.path === homePath;
    if (leftIsHome === rightIsHome) return 0;
    return leftIsHome ? -1 : 1;
  });

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setOpenMenu(null);
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
    setMobileChild(null);
    setProfileOpen(false);
  }, [pathname]);

  const activePath = (() => {
    const currentPath = pathname.split("?")[0];
    let bestMatch: string | null = null;

    for (const item of visibleItems) {
      const candidates = [item.path, ...(item.children ?? []).map((child) => child.path)];

      for (const candidate of candidates) {
        const candidatePath = candidate.split("?")[0];

        if (currentPath === candidatePath || currentPath.startsWith(`${candidatePath}/`)) {
          if (!bestMatch || candidatePath.length > bestMatch.length) {
            bestMatch = candidatePath;
          }
        }
      }
    }

    return bestMatch;
  })();

  const active = (item: Item) => {
    if (!activePath) {
      return false;
    }

    if (item.path.split("?")[0] === activePath) {
      return true;
    }

    return !!item.children?.some((child) => child.path.split("?")[0] === activePath);
  };

  const handleLogout = async () => {
    await signOut();
    setProfileOpen(false);
    router.replace("/ftmAuth");
  };

  return (
    <header className="ftm-global-nav relative z-[1101] w-full">
      <div className="hidden border-b border-white/70 bg-slate-100/70 text-xs text-slate-500 lg:block">
        <div className="mx-auto flex h-9 max-w-[1700px] items-center justify-between px-7">
          <div className="flex gap-5"><a href="tel:+639454418789" className="hover:text-white">☎ 0945 441 8789</a><a href="mailto:airshipexpress.s@gmail.com" className="hover:text-white">✉ airshipexpress.s@gmail.com</a></div>
          <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-pink-500" />Live network · Manila</span>
        </div>
      </div>
      <div className="ftm-soft-nav-surface border-b border-white/80 bg-slate-100/80 shadow-[0_8px_30px_rgba(148,163,184,0.14)] backdrop-blur-xl">
        <div className="mx-auto flex h-[48px] max-w-[1700px] items-center gap-5 px-4 sm:px-7">
          <a href={homeDashboardPath} className="shrink-0 h-full flex items-center" aria-label="Go to your home dashboard">
            <img src="/airship-logo.png" alt="Airship Express logo" className="h-full w-auto object-contain" />
          </a>
          <nav ref={navRef} className="hidden min-w-0 flex-1 items-center justify-center gap-2 lg:flex" aria-label="Main navigation">
            {visibleItems.map((item) => (
              <div key={item.path} className="relative shrink-0" onMouseEnter={() => item.children && setOpenMenu(item.path)} onMouseLeave={() => item.children && setOpenMenu(null)}>
                {item.children ? (
                  <div className={`flex items-center whitespace-nowrap rounded-lg text-xs font-semibold transition-colors ${active(item) || openMenu === item.path ? "bg-[#b80049] text-white" : "text-[#5b6b79] hover:bg-pink-50 hover:text-[#b80049]"}`}>
                    <a href={item.path} className="rounded-l-lg px-3 py-2">{item.label}</a>
                    <button type="button" onClick={() => setOpenMenu(openMenu === item.path ? null : item.path)} aria-haspopup="menu" aria-expanded={openMenu === item.path} aria-label={`Open ${item.label} menu`} className="rounded-r-lg px-1.5 py-2">
                      <span className={`material-symbols-outlined text-[16px] transition-transform ${openMenu === item.path ? "rotate-180" : ""}`}>expand_more</span>
                    </button>
                  </div>
                ) : <a href={item.path} className={`block whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${active(item) ? "bg-[#b80049] text-white" : "text-[#5b6b79] hover:bg-pink-50 hover:text-[#b80049]"}`}>{item.label}</a>}
                {item.children && openMenu === item.path && (
                  <div className={`absolute top-full z-[1200] pt-2 ${item.children.length > 4 ? "left-1/2 w-[min(44rem,calc(100vw-2rem))] -translate-x-1/2" : "left-0 w-72"}`} role="menu">
                    <div className="rounded-2xl border border-pink-200 bg-white p-2 shadow-[0_18px_45px_rgba(20,29,35,0.16)]">
                      <div className="border-b border-pink-100 px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#b80049]">{item.label}</div>
                      <div className={item.children.length > 4 ? "grid grid-cols-2 gap-1" : ""}>
                        {item.children.map((child) => <a key={child.path} href={child.path} role="menuitem" className="mt-1 flex min-w-0 flex-col rounded-xl px-3 py-2.5 hover:bg-pink-50"><span className="text-sm font-bold text-[#141d23]">{child.label}</span><span className="mt-0.5 text-xs text-[#6e6870]">{child.description}</span></a>)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <ThemeToggle className="ml-2" />
          </div>

          <div ref={profileRef} className="relative hidden lg:block">
            <button
              type="button"
              onClick={() => setProfileOpen((current) => !current)}
              className={`group flex min-w-[214px] items-center gap-2.5 rounded-xl px-1.5 py-1 text-left transition-all duration-200 ${profileOpen ? "bg-pink-50" : "hover:bg-pink-50/70"}`}
              aria-haspopup="menu"
              aria-expanded={profileOpen}
            >
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#b80049] text-sm font-black text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.12)]">
                <FtmProfileAvatar name={profileName} className="h-full w-full rounded-full object-cover" />
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" aria-label="Online" />
              </span>
              <span className="hidden min-w-0 flex-1 xl:block">
                <span className="block text-[10px] font-extrabold uppercase tracking-[0.2em] leading-none text-pink-700">{formatRoleLabel(currentRole)}</span>
                <span className="mt-1 block max-w-[132px] truncate text-[13px] font-extrabold leading-none text-[#141d23]">{profileName}</span>
              </span>
              <span className={`material-symbols-outlined text-[20px] text-[#5b6b79] transition-transform duration-200 group-hover:text-[#b80049] ${profileOpen ? "rotate-180 text-[#b80049]" : ""}`}>expand_more</span>
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full z-[1201] mt-3 w-64 overflow-hidden rounded-2xl border border-pink-100 bg-white shadow-[0_20px_50px_rgba(20,29,35,0.18)]">
                <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#b80049] text-sm font-black text-white">
                      <FtmProfileAvatar name={profileName} className="h-full w-full rounded-full object-cover" />
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" aria-label="Online" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold text-[#141d23]">{profileName}</div>
                      <div className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.16em] text-pink-700">{formatRoleLabel(currentRole)}</div>
                    </div>
                  </div>
                </div>

                <div className="p-2">
                  <a href="/account/profile" onClick={() => setProfileOpen(false)} className="flex w-full items-center gap-3 rounded-lg bg-pink-50 px-3 py-2.5 text-left text-sm font-semibold text-[#141d23] transition hover:bg-pink-100">
                    <span className="material-symbols-outlined text-[20px] text-[#5b6b79]">person</span>
                    <span>Profile</span>
                  </a>
                  <a href={homeDashboardPath} onClick={() => setProfileOpen(false)} className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#141d23] transition hover:bg-pink-50">
                    <span className="material-symbols-outlined text-[20px] text-[#5b6b79]">dashboard</span>
                    <span>Dashboard</span>
                  </a>
                  {profileActions.userManagement && <a href="/users" onClick={() => setProfileOpen(false)} className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#141d23] transition hover:bg-pink-50">
                    <span className="material-symbols-outlined text-[20px] text-[#5b6b79]">manage_accounts</span>
                    <span>User Management</span>
                  </a>}
                  {profileActions.settings && <a href="/account/settings?tab=overview" onClick={() => setProfileOpen(false)} className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#141d23] transition hover:bg-pink-50">
                    <span className="material-symbols-outlined text-[20px] text-[#5b6b79]">settings</span>
                    <span>Settings</span>
                  </a>}
                  <div className="my-1.5 border-t border-slate-100" />
                  <button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#141d23] transition hover:bg-pink-50">
                    <span className="material-symbols-outlined text-[20px] text-[#5b6b79]">logout</span>
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button type="button" onClick={() => setMobileOpen(!mobileOpen)} className="ml-auto flex h-10 w-10 items-center justify-center rounded-full text-[#141d23] hover:bg-pink-50 lg:hidden" aria-label="Toggle menu" aria-expanded={mobileOpen}><span className="material-symbols-outlined">{mobileOpen ? "close" : "menu"}</span></button>
        </div>
      </div>
      {mobileOpen && <div className="border-b border-pink-200 bg-white px-5 py-4 shadow-lg lg:hidden"><nav className="flex flex-col" aria-label="Mobile navigation">{visibleItems.map((item) => <div key={item.path} className="border-b border-dashed border-pink-100 last:border-0"><div className="flex items-center"><a href={item.path} className="flex-1 py-3 text-base font-bold text-[#141d23]">{item.label}</a>{item.children && <button type="button" onClick={() => setMobileChild(mobileChild === item.path ? null : item.path)} className="p-3 text-[#b80049]" aria-label={`Expand ${item.label}`}><span className={`material-symbols-outlined transition-transform ${mobileChild === item.path ? "rotate-180" : ""}`}>expand_more</span></button>}</div>{item.children && mobileChild === item.path && <div className="mb-3 flex flex-col gap-1 pl-4">{item.children.map((child) => <a key={child.path} href={child.path} className="rounded-lg px-3 py-2 text-sm text-[#5b6b79] hover:bg-pink-50 hover:text-[#b80049]">{child.label}</a>)}</div>}</div>)}</nav><div className="mt-4 space-y-2 border-t border-pink-100 pt-4">{profileActions.userManagement && <a href="/users" onClick={() => setMobileOpen(false)} className="flex w-full items-center justify-between rounded-full border border-pink-200 px-4 py-3 text-left text-sm font-bold text-[#141d23]"><span>User management</span><span className="material-symbols-outlined text-base">manage_accounts</span></a>}{profileActions.settings && <a href="/account/settings?tab=overview" onClick={() => setMobileOpen(false)} className="flex w-full items-center justify-between rounded-full border border-pink-200 px-4 py-3 text-left text-sm font-bold text-[#141d23]"><span>Account settings</span><span className="material-symbols-outlined text-base">manage_accounts</span></a>}<button type="button" onClick={handleLogout} className="flex w-full items-center justify-between rounded-full bg-[#b80049] px-4 py-3 text-left text-sm font-bold text-white"><span>Logout</span><span className="material-symbols-outlined text-base">logout</span></button></div></div>}
</header>
  );
}
