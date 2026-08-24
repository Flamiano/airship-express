"use client";

import GlobalNavbar from "../../components/GlobalNavbar";
import GlobalFooter from "../../components/GlobalFooter";
import RoleRestricted from "../../components/RoleRestricted";

import { useMemo, useState, useEffect } from "react";
import { getDashboardSnapshot } from "../../lib/api";
import { usePathname } from "next/navigation";

export default function FvmMaintenancePage() {
  const [dateSortDirection, setDateSortDirection] = useState<"asc" | "desc">("desc");
  const [wearItems, setWearItems] = useState<any[]>([]);
  const [repairs, setRepairs] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const dash = await getDashboardSnapshot();
        const vehicles = dash.vehicles || [];

        const wear = vehicles.length
          ? [
              { label: "Braking Systems", value: Math.round((vehicles.reduce((s: number, v: any) => s + Number(v.brake_health_pct ?? v.brake_pct ?? 80), 0) / vehicles.length)), bar: "bg-primary-container" },
              { label: "Transmission", value: Math.round((vehicles.reduce((s: number, v: any) => s + Number(v.transmission_health_pct ?? v.transmission_pct ?? 75), 0) / vehicles.length)), bar: "bg-tertiary" },
              { label: "Tire Tread", value: Math.round((vehicles.reduce((s: number, v: any) => s + Number(v.tire_health_pct ?? v.tire_pct ?? 60), 0) / vehicles.length)), bar: "bg-tertiary" },
            ]
          : [];

        const dAny = dash as any;
        const repairsList = ((dAny.maintenance as any[]) || (dAny.repairs as any[]) || []).map((r: any, i: number) => ({ id: r.id || `r-${i}`, issue: r.issue || r.description || 'Service', date: r.completed_at || r.date || '' }));

        const upcomingList = ((dAny.upcoming_services as any[]) || (dAny.scheduled_maintenance as any[]) || []).map((u: any, i: number) => ({ id: u.vehicle_id || `u-${i}`, task: u.task || u.name || 'Service', when: u.when || u.scheduled_date || 'TBD', dot: 'bg-primary-container', whenColor: 'text-error' }));

        if (mounted) {
          setWearItems(wear);
          setRepairs(repairsList);
          setUpcoming(upcomingList);
        }
      } catch (e) {
        console.warn('Failed to load maintenance snapshot', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const sortedRepairs = useMemo(() => {
    const direction = dateSortDirection === "asc" ? 1 : -1;
    return [...repairs].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return (dateA - dateB) * direction;
    });
  }, [dateSortDirection, repairs]);

  const toggleDateSort = () => setDateSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));

  return (
    <RoleRestricted allowedRoles={["fleet_manager", "admin"]} hideWhenRestricted>
      <div className="flex flex-col min-h-screen bg-background text-on-background">
        <GlobalNavbar />
        <main className="flex-grow w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg space-y-stack-lg">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-stack-md">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-background">Maintenance Control</h1>
          <p className="font-body-md text-body-md text-secondary mt-2">
            Monitor parcel handling systems, schedule service, and track sorter wear.
          </p>
        </div>
        <button className="bg-primary-container text-on-primary-container px-6 py-3 rounded-full font-label-md text-label-md shadow-sm hover:shadow-md transition-all flex items-center gap-2">
          <span className="material-symbols-outlined">build</span>
          Schedule Service
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        <div className="lg:col-span-8 flex flex-col gap-gutter">
          {/* Diagnostic Health */}
          <section className="bg-surface-container-lowest rounded border border-outline-variant p-stack-md shadow-[0px_10px_30px_rgba(0,0,0,0.04)]">
            <h2 className="font-title-md text-title-md text-on-surface mb-stack-md flex items-center gap-2">
              <span
                className="material-symbols-outlined text-primary-container"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                health_and_safety
              </span>
              Diagnostic Health - Sorter Wear
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-stack-md">
              {wearItems.map((item: any) => (
                <div
                  key={item.label}
                  className="bg-surface-container-low rounded-lg p-stack-sm flex flex-col items-center justify-center relative overflow-hidden"
                >
                  <span className="font-label-sm text-label-sm text-secondary mb-2 relative z-10">{item.label}</span>
                  <div className="text-3xl font-bold text-on-surface relative z-10">{item.value}%</div>
                  <div className="w-full bg-secondary-container h-1 rounded-full mt-3 relative z-10">
                    <div className={`${item.bar} h-1 rounded-full`} style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Recent Repairs Log */}
          <section className="bg-surface-container-lowest rounded border border-outline-variant p-stack-md shadow-[0px_10px_30px_rgba(0,0,0,0.04)]">
            <h2 className="font-title-md text-title-md text-on-surface mb-stack-md">Recent Repairs Log</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant font-label-sm text-label-sm text-secondary">
                    <th className="py-3 px-2 font-medium">Sorter ID</th>
                    <th className="py-3 px-2 font-medium">Issue</th>
                    <th className="py-3 px-2 font-medium">
                      <button
                        type="button"
                        onClick={toggleDateSort}
                        className="inline-flex items-center gap-2 text-label-sm font-semibold text-secondary hover:text-primary transition-colors"
                      >
                        Date Completed
                        <span className="material-symbols-outlined text-[18px]">
                          {dateSortDirection === "asc" ? "expand_less" : "expand_more"}
                        </span>
                      </button>
                    </th>
                    <th className="py-3 px-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="font-body-md text-body-md">
                  {sortedRepairs.map((r, i) => (
                    <tr
                      key={r.id}
                      className={`hover:bg-surface-container-low transition-colors ${
                        i < sortedRepairs.length - 1 ? "border-b border-outline-variant/50" : ""
                      }`}
                    >
                      <td className="py-4 px-2 font-medium text-on-surface">{r.id}</td>
                      <td className="py-4 px-2 text-secondary">{r.issue}</td>
                      <td className="py-4 px-2 text-secondary">{r.date}</td>
                      <td className="py-4 px-2">
                        <span className="inline-flex items-center gap-1 bg-surface-variant text-on-surface-variant px-2 py-1 rounded-full font-label-sm text-label-sm">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          Resolved
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Upcoming Services */}
        <div className="lg:col-span-4 flex flex-col gap-gutter">
          <section className="bg-surface-container-lowest rounded border border-outline-variant p-stack-md shadow-[0px_10px_30px_rgba(0,0,0,0.04)] h-full">
            <h2 className="font-title-md text-title-md text-on-surface mb-stack-md flex items-center justify-between">
              Upcoming Services
              <span className="bg-primary-container text-on-primary-container font-label-sm text-label-sm px-2 py-1 rounded-full">
                3 Due
              </span>
            </h2>
            <div className="space-y-stack-sm relative">
              <div className="absolute left-4 top-4 bottom-4 w-px bg-outline-variant" />
              {upcoming.map((item: any) => (
                <div key={item.id} className="relative pl-10">
                  <div
                    className={`absolute left-2 top-2 w-4 h-4 rounded-full ${item.dot} border-4 border-surface-container-lowest shadow-sm z-10`}
                  />
                  <div className="bg-surface-container-low rounded-lg p-stack-sm border border-outline-variant/30">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-label-md text-label-md text-on-surface font-bold">{item.id}</span>
                      <span className={`font-label-sm text-label-sm ${item.whenColor}`}>{item.when}</span>
                    </div>
                    <p className="font-body-md text-body-md text-secondary text-sm">{item.task}</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-stack-md py-2 text-center font-label-md text-label-md text-primary hover:bg-surface-variant rounded-lg transition-colors">
              View Full Schedule
            </button>
          </section>
        </div>
      </div>
    </main>
        <GlobalFooter />
      </div>
    </RoleRestricted>
  );
}

// Maintenance datasets are loaded from Supabase via `getDashboardSnapshot()` into `wearItems`, `repairs`, and `upcoming` state.


function SiteHeader() {
  const pathname = usePathname();
  const PRIMARY_NAV = ["Dispatch", "Fuel", "Cost Analysis", "Alerts"];
  const SUB_NAV = [
    { label: "Overview", href: "/fvm", icon: "dashboard" },
    { label: "Inventory", href: "/fvm/inventory", icon: "inventory_2" },
    { label: "4D Analytics", href: "/fvm/analytics", icon: "analytics" },
    { label: "Maintenance", href: "/fvm/maintenance", icon: "build" },
  ];

  return (
    <nav className="bg-surface-container-low border-b border-outline-variant sticky top-[64px] z-50 w-full">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop flex items-center gap-2 md:gap-8 h-12 overflow-x-auto no-scrollbar">
        {SUB_NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <a
              key={item.href}
              href={item.href}
              className={
                active
                  ? "flex items-center gap-2 h-full border-b-2 border-primary text-primary font-bold text-label-md px-2 whitespace-nowrap shrink-0"
                  : "flex items-center gap-2 h-full border-b-2 border-transparent text-on-surface-variant hover:text-primary font-medium text-label-md px-2 transition-colors whitespace-nowrap shrink-0"
              }
            >
              <span className="material-symbols-outlined text-sm" style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                {item.icon}
              </span>
              {item.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

function SiteFooter() {
  return <GlobalFooter />;
}


function Navbar() {
  const pathname = usePathname();
  const links = [
    { label: "Operations Center", path: "/dashboard", short: "Ops" },
    { label: "Alerts", path: "/alerts", short: "Alerts" },
    { label: "Cost Analysis", path: "/cost", short: "Cost" },
    { label: "Driver Performance", path: "/driver/overview", short: "Driver" },
    { label: "Fuel Management", path: "/fuel", short: "Fuel" },
    { label: "FVM", path: "/fvm", short: "FVM" },
    { label: "VRDS", path: "/vrds/dashboard", short: "VRDS" },
  ];

  return (
    <nav style={navStyles.nav} aria-label="Main navigation">
      <style dangerouslySetInnerHTML={{ __html: NAV_CSS }} />
      <div style={navStyles.navInner}>
        <a href="/dashboard" style={navStyles.brandBtn} aria-label="Go to Operations Center">
          <div style={navStyles.brandBadge}>AX</div>
          <div className="fm-brand-section" style={navStyles.logoTextGroup}>
            <span className="fm-brand-section" style={navStyles.navMark}>AIRSHIP EXPRESS</span>
            <span className="fm-brand-section" style={navStyles.navSection}>PARCEL HUB</span>
          </div>
        </a>

        <div className="fm-nav-scroll ae-scroll" style={navStyles.links}>
          {links.map((link) => {
            const isActive = pathname === link.path || pathname.startsWith(link.path + "/") || (link.path !== "/dashboard" && pathname.startsWith("/" + link.path.split("/")[1]));
            return (
              <a
                key={link.path}
                href={link.path}
                className="fm-nav-link"
                aria-current={isActive ? "page" : undefined}
                style={isActive ? { ...navStyles.link, ...navStyles.active } : navStyles.link}
              >
                <span className="fm-nav-full">{link.label}</span>
                <span className="fm-nav-short">{link.short}</span>
              </a>
            );
          })}
        </div>

        <div style={navStyles.navUser}>
          <div style={navStyles.statusPill}>
            <span style={navStyles.statusDot} />
            Live
          </div>
          <div style={navStyles.navAvatar} title="Fleet Manager">FM</div>
        </div>
      </div>
    </nav>
  );
}

const NAV_CSS = `
  .fm-nav-scroll { scrollbar-width: none; -ms-overflow-style: none; }
  .fm-nav-scroll::-webkit-scrollbar { display: none; }

  .fm-nav-link {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
    transition: color 0.15s ease, background 0.15s ease;
    border-radius: 999px;
  }
  .fm-nav-link:hover:not([aria-current="page"]) {
    color: #b80049 !important;
    background: rgba(184, 0, 73, 0.06);
  }
  .fm-nav-link:focus-visible {
    outline: 2px solid #b80049;
    outline-offset: 2px;
  }

  .fm-nav-short { display: none; }
  @media (max-width: 1100px) {
    .fm-nav-full { display: none; }
    .fm-nav-short { display: inline; }
  }
  @media (max-width: 720px) {
    .fm-brand-section { display: none !important; }
  }
`;

const navStyles: Record<string, React.CSSProperties> = {
  nav: {
    position: "sticky",
    top: 0,
    left: 0,
    right: 0,
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    background: "rgba(255, 247, 252, 0.96)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderBottom: "1px solid rgba(184, 0, 73, 0.12)",
    boxShadow: "0 8px 32px rgba(184, 0, 73, 0.08)",
    zIndex: 1101,
  },
  navInner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
    width: "100%",
    padding: "0.75rem 1.75rem",
    boxSizing: "border-box",
    maxWidth: "100%",
    margin: "0 auto",
  },
  brandBtn: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    flexShrink: 0,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 0,
    textDecoration: "none",
  },
  brandBadge: {
    width: "42px",
    height: "42px",
    borderRadius: "999px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#b80049",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: "0.95rem",
  },
  logoTextGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.1rem",
    textAlign: "left",
  },
  navMark: {
    fontWeight: 700,
    fontSize: "0.88rem",
    color: "#141d23",
    letterSpacing: "0.01em",
    whiteSpace: "nowrap",
  },
  navSection: {
    fontSize: "0.62rem",
    letterSpacing: "0.12em",
    color: "#b80049",
    whiteSpace: "nowrap",
  },
  links: {
    display: "flex",
    gap: "0.35rem",
    overflowX: "auto",
    whiteSpace: "nowrap",
    padding: "0.15rem",
    flex: 1,
    justifyContent: "center",
  },
  link: {
    background: "transparent",
    border: "none",
    color: "#5b6b79",
    fontSize: "0.82rem",
    fontWeight: 500,
    cursor: "pointer",
    padding: "0.45rem 0.85rem",
    flexShrink: 0,
    textDecoration: "none",
  },
  active: {
    color: "#ffffff",
    fontWeight: 600,
    background: "#b80049",
    boxShadow: "0 6px 18px rgba(184, 0, 73, 0.28)",
  },
  navUser: {
    display: "flex",
    alignItems: "center",
    gap: "0.65rem",
    flexShrink: 0,
  },
  statusPill: {
    display: "flex",
    alignItems: "center",
    gap: "0.35rem",
    fontSize: "0.65rem",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#5b6b79",
    background: "rgba(47,143,91,0.10)",
    border: "1px solid rgba(47,143,91,0.22)",
    borderRadius: 999,
    padding: "0.28rem 0.55rem",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#2f8f5b",
    boxShadow: "0 0 0 3px rgba(47,143,91,0.18)",
  },
  navAvatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "rgba(184, 0, 73, 0.10)",
    color: "#b80049",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.68rem",
    fontWeight: 600,
    border: "1px solid rgba(236,33,136,0.18)",
  },
};

