import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireHrAdmin } from "@/performance-development-dashboard/lib/auth/hrIdentity";
import { DevelopmentPlanning } from "@/performance-development-dashboard/components/development/DevelopmentPlanning";
import type { CurrentPerDevUser, EmployeeOption } from "@/performance-development-dashboard/types";

export const dynamic = "force-dynamic";

function fullName(firstName: string, lastName: string): string {
  return `${firstName ?? ""} ${lastName ?? ""}`.trim();
}

async function loadEmployeeOptions(): Promise<EmployeeOption[]> {
  const { data, error } = await supabaseAdmin
    .from("hr1_employees")
    .select(
      "id, employee_id_number, first_name, last_name, department, job_position_id, status"
    )
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
    employeeIdNumber: employee.employee_id_number ?? undefined,
    status: employee.status,
    department: employee.department,
    job_position_id: employee.job_position_id,
  }));
}

export default async function DevelopmentPlanningPage() {
  const admin = await requireHrAdmin();

  if (admin instanceof NextResponse) {
    redirect("/hrAuth");
  }

  const serverUser: CurrentPerDevUser = {
    fullName: admin.fullName,
    role: admin.role,
    email: admin.email,
  };

  const employees = await loadEmployeeOptions();

  return <DevelopmentPlanning serverUser={serverUser} employees={employees} />;
}