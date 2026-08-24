"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppRole, getCurrentRole, getDashboardRouteForRole } from "../lib/roleAccess";
import { signOut } from "../lib/auth";
import ThemeToggle from "./ThemeToggle";

type Child = { label: string; path: string; description: string };
type Item = { label: string; path: string; children?: Child[] };

const ITEMS: Item[] = [
  { label: "Operations Center", path: "/dashboard" },
  { label: "Alerts", path: "/alerts", children: [
    { label: "Active Alerts", path: "/alerts", description: "Review current operational alerts." },
    { label: "Maintenance Notifications", path: "/alerts?tab=maintenance", description: "Review maintenance notices." },
    { label: "Safety Events", path: "/alerts?tab=safety", description: "Inspect recent safety events." },
    { label: "System History", path: "/alerts?tab=history", description: "Review historical system events." },
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
    "/dashboard",
    "/alerts",
    "/cost",
    "/driver/overview",
    "/fuel",
    "/fuel/receipts",
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
    "/alerts",
  ],
  customer: [
    "/dashboard",
    "/alerts",
    "/cost",
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

  const profileInitials = profileName
    .split(/[\s@.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "A";

  useEffect(() => {
    setCurrentRole(getCurrentRole());
    const storedEmail = window.localStorage.getItem("email");
    setProfileName(window.localStorage.getItem("displayName") || storedEmail || "Account");
    setProfileEmail(storedEmail || "account@airship.com");
  }, []);

  const allowedPaths = currentRole ? ROLE_NAV_PATHS[currentRole] : ["/dashboard"];
  const isAllowedPath = (path: string) => allowedPaths.includes(path.split("?")[0]);
  const visibleItems = ITEMS.map((item) => {
    const visibleChildren = item.children?.filter((child) => isAllowedPath(child.path));

    if (isAllowedPath(item.path)) {
      return visibleChildren ? { ...item, children: visibleChildren } : item;
    }

    return visibleChildren?.length ? { ...item, children: visibleChildren } : null;
  }).filter((item): item is Item => item !== null);

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
    router.push("/auth");
  };

  const handleAccountSettings = () => {
    setProfileOpen(false);
    router.push("/account/settings");
  };

  return (
    <header className="sticky top-0 z-[1101] w-full">
      <div className="hidden border-b border-white/10 bg-[#17151a] text-xs text-white/70 lg:block">
        <div className="mx-auto flex h-9 max-w-[1700px] items-center justify-between px-7">
          <div className="flex gap-5"><a href="tel:+639454418789" className="hover:text-white">☎ 0945 441 8789</a><a href="mailto:airshipexpress.s@gmail.com" className="hover:text-white">✉ airshipexpress.s@gmail.com</a></div>
          <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#e2165f]" />Live network · Manila</span>
        </div>
      </div>
      <div className="border-b border-pink-200/70 bg-white/90 shadow-[0_8px_30px_rgba(184,0,73,0.08)] backdrop-blur-xl">
        <div className="mx-auto flex h-[48px] max-w-[1700px] items-center gap-5 px-4 sm:px-7">
          <a href={homeDashboardPath} className="shrink-0 h-full flex items-center" aria-label="Go to your home dashboard">
            <img src="/airship-logo.png" alt="Airship Express logo" className="h-full w-auto object-contain" />
          </a>
          <nav ref={navRef} className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex" aria-label="Main navigation">
            {visibleItems.map((item) => (
              <div key={item.path} className="relative shrink-0" onMouseEnter={() => item.children && setOpenMenu(item.path)} onMouseLeave={() => item.children && setOpenMenu(null)}>
                {item.children ? (
                  <button type="button" onClick={() => setOpenMenu(openMenu === item.path ? null : item.path)} aria-haspopup="menu" aria-expanded={openMenu === item.path} className={`flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors ${active(item) || openMenu === item.path ? "bg-[#b80049] text-white" : "text-[#5b6b79] hover:bg-pink-50 hover:text-[#b80049]"}`}>
                    {item.label}<span className={`material-symbols-outlined text-[16px] transition-transform ${openMenu === item.path ? "rotate-180" : ""}`}>expand_more</span>
                  </button>
                ) : <a href={item.path} className={`block rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors ${active(item) ? "bg-[#b80049] text-white" : "text-[#5b6b79] hover:bg-pink-50 hover:text-[#b80049]"}`}>{item.label}</a>}
                {item.children && openMenu === item.path && (
                  <div className="absolute left-0 top-full z-[1200] w-72 pt-2" role="menu">
                    <div className="rounded-2xl border border-pink-200 bg-white p-2 shadow-[0_18px_45px_rgba(20,29,35,0.16)]">
                      <div className="border-b border-pink-100 px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#b80049]">{item.label}</div>
                      {item.children.map((child) => <a key={child.path} href={child.path} role="menuitem" className="mt-1 flex flex-col rounded-xl px-3 py-2.5 hover:bg-pink-50"><span className="text-sm font-bold text-[#141d23]">{child.label}</span><span className="mt-0.5 text-xs text-[#6e6870]">{child.description}</span></a>)}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            {isAllowedPath("/vrds/missions") && <a href="/vrds/missions" className="rounded-full border border-pink-200 px-4 py-2 text-xs font-bold text-[#141d23] hover:bg-pink-50">Track Shipment</a>}
            {isAllowedPath("/vrds/bookings") && <a href="/vrds/bookings" className="rounded-full bg-[#17151a] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#b80049]">Book a Delivery <span aria-hidden>→</span></a>}
            <ThemeToggle className="ml-2" />
          </div>

          <div ref={profileRef} className="relative hidden lg:block">
            <button
              type="button"
              onClick={() => setProfileOpen((current) => !current)}
              className="flex items-center gap-3 rounded-full border border-pink-200 bg-white px-2 py-1.5 text-left shadow-sm transition hover:border-pink-300 hover:bg-pink-50"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#b80049] text-sm font-black text-white">
                {profileInitials}
              </span>
              <span className="hidden xl:block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-pink-700">{formatRoleLabel(currentRole)}</span>
                <span className="block text-xs font-bold text-[#141d23]">{profileName}</span>
              </span>
              <span className="material-symbols-outlined text-base text-[#5b6b79]">expand_more</span>
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full z-[1201] mt-2 w-64 rounded-2xl border border-pink-200 bg-white p-2 shadow-[0_18px_45px_rgba(20,29,35,0.16)]">
                <div className="flex items-center gap-3 border-b border-pink-100 px-2 pb-3 pt-1">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#b80049] text-sm font-black text-white">{profileInitials}</span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-[#141d23]">{profileName}</div>
                    <div className="truncate text-[11px] text-[#5b6b79]">{profileEmail}</div>
                  </div>
                </div>

                <button type="button" onClick={handleAccountSettings} className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[#141d23] hover:bg-pink-50">
                  <span className="material-symbols-outlined text-base text-[#b80049]">manage_accounts</span>
                  Account settings
                </button>
                <button type="button" onClick={handleLogout} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[#141d23] hover:bg-pink-50">
                  <span className="material-symbols-outlined text-base text-[#b80049]">logout</span>
                  Logout
                </button>
              </div>
            )}
          </div>

          <button type="button" onClick={() => setMobileOpen(!mobileOpen)} className="ml-auto flex h-10 w-10 items-center justify-center rounded-full text-[#141d23] hover:bg-pink-50 lg:hidden" aria-label="Toggle menu" aria-expanded={mobileOpen}><span className="material-symbols-outlined">{mobileOpen ? "close" : "menu"}</span></button>
        </div>
      </div>
      {mobileOpen && <div className="border-b border-pink-200 bg-white px-5 py-4 shadow-lg lg:hidden"><nav className="flex flex-col" aria-label="Mobile navigation">{visibleItems.map((item) => <div key={item.path} className="border-b border-dashed border-pink-100 last:border-0"><div className="flex items-center"><a href={item.path} className="flex-1 py-3 text-base font-bold text-[#141d23]">{item.label}</a>{item.children && <button type="button" onClick={() => setMobileChild(mobileChild === item.path ? null : item.path)} className="p-3 text-[#b80049]" aria-label={`Expand ${item.label}`}><span className={`material-symbols-outlined transition-transform ${mobileChild === item.path ? "rotate-180" : ""}`}>expand_more</span></button>}</div>{item.children && mobileChild === item.path && <div className="mb-3 flex flex-col gap-1 pl-4">{item.children.map((child) => <a key={child.path} href={child.path} className="rounded-lg px-3 py-2 text-sm text-[#5b6b79] hover:bg-pink-50 hover:text-[#b80049]">{child.label}</a>)}</div>}</div>)}</nav><div className="mt-4 space-y-2 border-t border-pink-100 pt-4"><button type="button" onClick={handleAccountSettings} className="flex w-full items-center justify-between rounded-full border border-pink-200 px-4 py-3 text-left text-sm font-bold text-[#141d23]"><span>Account settings</span><span className="material-symbols-outlined text-base">manage_accounts</span></button><button type="button" onClick={handleLogout} className="flex w-full items-center justify-between rounded-full bg-[#b80049] px-4 py-3 text-left text-sm font-bold text-white"><span>Logout</span><span className="material-symbols-outlined text-base">logout</span></button></div><div className="mt-4 grid grid-cols-2 gap-2"><a href="/vrds/missions" className="rounded-full border border-pink-200 px-4 py-3 text-center text-sm font-bold">Track</a><a href="/vrds/bookings" className="rounded-full bg-[#b80049] px-4 py-3 text-center text-sm font-bold text-white">Book a Delivery</a></div></div>}
</header>
  );
}
