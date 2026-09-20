"use client";

import "./perDevTheme.css";
import { SidebarProvider } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/layout/SidebarContext";
import { PerDevShell } from "@/performance-development-dashboard/components/layout/PerDevShell";

export default function PerformanceDevelopmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <PerDevShell>{children}</PerDevShell>
    </SidebarProvider>
  );
}