"use client";

import { usePathname } from "next/navigation";

export const VRDS_TABS = [
  { label: "Dashboard", href: "/vrds/dashboard" },
  { label: "Parcels", href: "/vrds/parcels" },
  { label: "Bookings", href: "/vrds/bookings" },
  { label: "Active Deliveries", href: "/vrds/missions" },
  { label: "Route Planning", href: "/vrds/route-planning" },
  { label: "History", href: "/vrds/history" },
] as const;

export function SubNav() {
  const pathname = usePathname();

  return (
    <div className="w-full bg-surface-container-low border-b border-surface-container-highest">
      <div className="w-full max-w-full px-4 md:px-8 h-14 flex items-center gap-8 overflow-x-auto thin-scroll">
        <span className="text-title-md text-on-surface shrink-0">VRDS Dispatch</span>
        <nav className="flex items-center gap-6 text-label-md whitespace-nowrap">
          {VRDS_TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <a
                key={tab.href}
                href={tab.href}
                className={
                  active
                    ? "text-primary border-b-2 border-primary py-4 -mb-px"
                    : "text-secondary hover:text-on-surface py-4"
                }
              >
                {tab.label}
              </a>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="w-full bg-surface-container-high border-t border-surface-container-highest mt-auto">
      <div className="w-full max-w-full px-4 md:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-label-sm text-secondary">
        <span>© 2026 Airship Express · 352 T. Pinpin Escolta St., Binondo, Manila 1006</span>
        <div className="flex items-center gap-6">
          <a href="#" className="hover:text-primary">Support</a>
          <a href="#" className="hover:text-primary">Privacy</a>
          <a href="#" className="hover:text-primary">Terms</a>
          <a href="#" className="hover:text-primary">API Documentation</a>
        </div>
      </div>
    </footer>
  );
}

export function Navbar() {
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
            <span className="fm-brand-section" style={navStyles.navSection}>PARCEL &amp; DELIVERY</span>
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
