/**
 * FTM side-menu configuration. These are the same routes and labels the old
 * top navbar used (GlobalNavbar ITEMS), grouped for the sidebar. Visibility is
 * still decided by getAllowedNavPaths(role) in lib/permissions.ts.
 */
export type FtmNavChild = { label: string; path: string; description: string };
export type FtmNavItem = {
  key: string;
  label: string;
  path: string;
  icon: string;
  children?: FtmNavChild[];
};
export type FtmNavGroup = { title: string; items: FtmNavItem[] };

export const FTM_NAV_GROUPS: FtmNavGroup[] = [
  {
    title: "Operations",
    items: [
      { key: "ops", label: "Operations Center", path: "/dashboard", icon: "dashboard" },
      {
        key: "alerts",
        label: "Alerts",
        path: "/alerts",
        icon: "notifications",
        children: [
          { label: "Active Alerts", path: "/alerts?tab=active", description: "Review current operational alerts." },
          { label: "Maintenance Notifications", path: "/alerts?tab=maintenance", description: "Review maintenance notices." },
          { label: "Safety Events", path: "/alerts?tab=safety", description: "Inspect recent safety events." },
          { label: "System History", path: "/alerts?tab=history", description: "Review historical system events." },
        ],
      },
    ],
  },
  {
    title: "Dispatch (VRDS)",
    items: [
      {
        key: "vrds",
        label: "VRDS Dispatch",
        path: "/vrds/dashboard",
        icon: "local_shipping",
        children: [
          { label: "Dashboard", path: "/vrds/dashboard", description: "Live dispatch overview." },
          { label: "Parcels", path: "/vrds/parcels", description: "Receive and group parcels." },
          { label: "Bookings", path: "/vrds/bookings", description: "Assign and confirm dispatches." },
          { label: "Active Deliveries", path: "/vrds/missions", description: "Track active deliveries." },
          { label: "Route Planning", path: "/vrds/route-planning", description: "Build optimized routes." },
          { label: "History", path: "/vrds/history", description: "Review completed deliveries." },
        ],
      },
    ],
  },
  {
    title: "Fleet & Drivers",
    items: [
      {
        key: "fvm",
        label: "Fleet (FVM)",
        path: "/fvm",
        icon: "directions_car",
        children: [
          { label: "Fleet Overview", path: "/fvm", description: "View fleet status." },
          { label: "Inventory", path: "/fvm/inventory", description: "Browse vehicles and assets." },
          { label: "Analytics", path: "/fvm/analytics", description: "Inspect fleet analytics." },
          { label: "Maintenance", path: "/fvm/maintenance", description: "Manage service schedules." },
        ],
      },
      {
        key: "driver",
        label: "Driver Performance",
        path: "/driver/overview",
        icon: "group",
        children: [
          { label: "Overview", path: "/driver/overview", description: "Monitor driver performance." },
          { label: "Performance", path: "/driver/performance", description: "Inspect efficiency and trends." },
          { label: "Safety Scores", path: "/driver/safety", description: "Review safety signals." },
          { label: "Leaderboard", path: "/driver/leaderboard", description: "Compare driver rankings." },
        ],
      },
    ],
  },
  {
    title: "Fuel & Finance",
    items: [
      {
        key: "fuel",
        label: "Fuel Management",
        path: "/fuel",
        icon: "local_gas_station",
        children: [
          { label: "Fuel Overview", path: "/fuel", description: "See current fuel health." },
          { label: "Consumption", path: "/fuel/consumption", description: "Track consumption patterns." },
          { label: "Efficiency", path: "/fuel/efficiency", description: "Measure fleet efficiency." },
          { label: "Refueling Log", path: "/fuel/refueling-log", description: "Review refueling records." },
        ],
      },
      {
        key: "gallery",
        label: "Gallery",
        path: "/fuel/receipts",
        icon: "photo_library",
        children: [
          { label: "Receipt Gallery", path: "/fuel/receipts", description: "Browse driver expense receipts." },
          { label: "Fuel Photo Log", path: "/fuel/photo-log", description: "Review recent image submissions." },
          { label: "Proof of Pickup", path: "/fuel/proof-pickup", description: "Verify pickup confirmations and image proof." },
          { label: "Destination Gallery", path: "/fuel/destination-gallery", description: "Review destination photo submissions." },
          { label: "Parcel History", path: "/fuel/parcel-history", description: "Review parcel status and movement history." },
        ],
      },
      { key: "cost", label: "Cost Analysis", path: "/cost", icon: "payments" },
    ],
  },
  {
    title: "Administration",
    items: [
      { key: "users", label: "Manage Users", path: "/users", icon: "manage_accounts" },
    ],
  },
];

/** Strip the query string so "/alerts?tab=active" can be checked against allowed paths. */
export const basePath = (path: string) => path.split("?")[0];
