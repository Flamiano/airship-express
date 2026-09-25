import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireHrAdmin } from "@/performance-development-dashboard/lib/auth/hrIdentity";
import {
  listCriticalPositions,
  listSuccessionCandidates,
} from "@/performance-development-dashboard/lib/performance/succession";
import { SuccessionPlanning } from "@/performance-development-dashboard/components/succession/SuccessionPlanning";
import type {
  CriticalPositionListItem,
  CurrentPerDevUser,
  EmployeeOption,
  JobPositionOption,
  SuccessionCandidateListItem,
} from "@/performance-development-dashboard/types";

export const dynamic = "force-dynamic";

function fullName(firstName: string, lastName: string): string {
  return `${firstName ?? ""} ${lastName ?? ""}`.trim();
}

async function loadEmployeeOptions(): Promise<EmployeeOption[]> {
  // New-candidacy selector: active employees only. Existing candidates that
  // later become inactive are preserved until explicit HR removal; their
  // names remain server-enriched regardless of status.
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

async function loadJobPositionOptions(): Promise<JobPositionOption[]> {
  const { data, error } = await supabaseAdmin
    .from("hr1_job_positions")
    .select("id, title, is_active")
    .order("title", { ascending: true });

  if (error) {
    console.error("loadJobPositionOptions: query error:", error);
    return [];
  }

  return (data ?? []).map((position) => ({
    id: position.id,
    title: position.title,
    isActive: position.is_active,
  }));
}

async function loadSuccessionData() {
  const results = await Promise.all([
    listCriticalPositions({}),
    listSuccessionCandidates({}),
  ]);

  const anyError = results.some((result) => result instanceof NextResponse);

  const fromResult = <T,>(index: number): T[] =>
    results[index] instanceof NextResponse ? [] : (results[index] as T[]);

  return {
    initialPositions: fromResult<CriticalPositionListItem>(0),
    initialCandidates: fromResult<SuccessionCandidateListItem>(1),
    initialError: anyError
      ? "Failed to load succession data. Please try again."
      : undefined,
  };
}

export default async function SuccessionPlanningPage() {
  const admin = await requireHrAdmin();

  if (admin instanceof NextResponse) {
    redirect("/hrAuth");
  }

  const serverUser: CurrentPerDevUser = {
    fullName: admin.fullName,
    role: admin.role,
    email: admin.email,
  };

  const [succession, employees, jobPositions] = await Promise.all([
    loadSuccessionData(),
    loadEmployeeOptions(),
    loadJobPositionOptions(),
  ]);

  return (
    <SuccessionPlanning
      serverUser={serverUser}
      initialPositions={succession.initialPositions}
      initialCandidates={succession.initialCandidates}
      initialError={succession.initialError}
      employees={employees}
      jobPositions={jobPositions}
    />
  );
}