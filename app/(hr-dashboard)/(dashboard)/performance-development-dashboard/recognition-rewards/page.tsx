import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireHrAdmin } from "@/performance-development-dashboard/lib/auth/hrIdentity";
import {
  listBadges,
  listEmployeePoints,
  listRecognitions,
  listRewardRedemptions,
} from "@/performance-development-dashboard/lib/performance/rewards";
import { RecognitionRewards } from "@/performance-development-dashboard/components/rewards/RecognitionRewards";
import type {
  BadgeListItem,
  CurrentPerDevUser,
  EmployeeOption,
  EmployeePointsListItem,
  RecognitionListItem,
  RedemptionListItem,
} from "@/performance-development-dashboard/types";

export const dynamic = "force-dynamic";

function fullName(firstName: string, lastName: string): string {
  return `${firstName ?? ""} ${lastName ?? ""}`.trim();
}

async function loadEmployeeOptions(): Promise<EmployeeOption[]> {
  // New-recognition selector: active employees only (recognition is a
  // current award with no backdate support). Historical recognitions remain
  // visible via server-enriched sender/recipient names regardless of status.
  const { data, error } = await supabaseAdmin
    .from("hr1_employees")
    .select("id, first_name, last_name, department, job_position_id")
    .eq("status", "active")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (error) {
    console.error("loadEmployeeOptions: query error:", error);
    return [];
  }

  return (data ?? []).map((employee) => ({
    id: employee.id,
    name: fullName(employee.first_name, employee.last_name),
    department: employee.department,
    job_position_id: employee.job_position_id,
  }));
}

async function loadRewardsData() {
  const results = await Promise.all([
    listRecognitions(),
    listBadges(),
    listEmployeePoints(),
    listRewardRedemptions(),
  ]);

  const anyError = results.some((result) => result instanceof NextResponse);

  const fromResult = <T,>(index: number): T[] =>
    results[index] instanceof NextResponse ? [] : (results[index] as T[]);

  return {
    initialRecognitions: fromResult<RecognitionListItem>(0),
    initialBadges: fromResult<BadgeListItem>(1),
    initialPoints: fromResult<EmployeePointsListItem>(2),
    initialRedemptions: fromResult<RedemptionListItem>(3),
    initialError: anyError
      ? "Failed to load rewards data. Please try again."
      : undefined,
  };
}

export default async function RecognitionRewardsPage() {
  const admin = await requireHrAdmin();

  if (admin instanceof NextResponse) {
    redirect("/hrAuth");
  }

  const serverUser: CurrentPerDevUser = {
    fullName: admin.fullName,
    role: admin.role,
    email: admin.email,
  };

  const [rewards, employees] = await Promise.all([
    loadRewardsData(),
    loadEmployeeOptions(),
  ]);

  return (
    <RecognitionRewards
      serverUser={serverUser}
      initialRecognitions={rewards.initialRecognitions}
      initialBadges={rewards.initialBadges}
      initialPoints={rewards.initialPoints}
      initialRedemptions={rewards.initialRedemptions}
      initialError={rewards.initialError}
      employees={employees}
    />
  );
}