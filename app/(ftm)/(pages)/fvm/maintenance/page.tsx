"use client";

import GlobalFooter from "../../../components/global/GlobalFooter";
import GlobalNavbar from "../../../components/global/GlobalNavbar";
import RoleRestricted from "../../../components/global/RoleRestricted";
import MaintenanceCalendarDashboard from "./MaintenanceCalendarDashboard";

export default function FvmMaintenancePage() {
  return (
    <RoleRestricted allowedRoles={["fleet_manager", "admin"]} hideWhenRestricted>
      <div className="flex min-h-screen flex-col bg-[#fff8fc] text-slate-800">
        <GlobalNavbar />
        <MaintenanceCalendarDashboard />
        <GlobalFooter />
      </div>
    </RoleRestricted>
  );
}