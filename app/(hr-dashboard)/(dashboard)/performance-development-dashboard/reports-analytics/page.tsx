import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { requireHrAdmin } from "@/performance-development-dashboard/lib/auth/hrIdentity";
import { ReportsAnalytics } from "@/performance-development-dashboard/components/reports/ReportsAnalytics";
import type { CurrentPerDevUser } from "@/performance-development-dashboard/types";

export const dynamic = "force-dynamic";

export default async function ReportsAnalyticsPage() {
  const admin = await requireHrAdmin();

  if (admin instanceof NextResponse) {
    redirect("/hrAuth");
  }

  const serverUser: CurrentPerDevUser = {
    fullName: admin.fullName,
    role: admin.role,
    email: admin.email,
  };

  return <ReportsAnalytics serverUser={serverUser} />;
}