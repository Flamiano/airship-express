"use client";

import GlobalFooter from "../../../components/global/GlobalFooter";
import GlobalNavbar from "../../../components/global/GlobalNavbar";
import RoutePlanningWorkspace from "./RoutePlanningWorkspace";

export default function RoutePlanningPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#fff8fc] text-slate-800">
      <GlobalNavbar />
      <RoutePlanningWorkspace />
      <GlobalFooter />
    </div>
  );
}