import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireHrAdmin, requireHrEmployee } from "@/performance-development-dashboard/lib/auth/hrIdentity";
import {
  listCompetencies,
  listEmployeeCompetencies,
  listPositionCompetencyRequirements,
} from "@/performance-development-dashboard/lib/performance/competencies";
import { CompetencyManagement } from "@/performance-development-dashboard/components/competencies/CompetencyManagement";
import type {
  Competency,
  CurrentPerDevUser,
  EmployeeCompetencyProfileItem,
  EmployeeOption,
  PositionCompetencyRequirement,
  PositionOption,
} from "@/performance-development-dashboard/types";

export const dynamic = "force-dynamic";

function fullName(firstName: string, lastName: string): string {
  return `${firstName ?? ""} ${lastName ?? ""}`.trim();
}

async function loadPositions(): Promise<PositionOption[]> {
  const { data, error } = await supabaseAdmin
    .from("hr1_job_positions")
    .select("id, title, department, is_active")
    .order("title", { ascending: true });

  if (error) {
    console.error("loadPositions: query error:", error);
    return [];
  }

  return (data ?? []).map((position) => ({
    id: position.id,
    title: position.title,
    department: position.department,
  }));
}

async function loadEmployeeOptions(): Promise<EmployeeOption[]> {
  const { data, error } = await supabaseAdmin
    .from("hr1_employees")
    .select("id, first_name, last_name, department, job_position_id")
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

async function loadEmployeePositionId(
  employeeUuid: string | null
): Promise<string | null> {
  if (!employeeUuid) return null;

  const { data } = await supabaseAdmin
    .from("hr1_employees")
    .select("job_position_id")
    .eq("id", employeeUuid)
    .maybeSingle();

  return data?.job_position_id ?? null;
}

export default async function CompetenciesPage() {
  const admin = await requireHrAdmin();

  if (admin instanceof NextResponse) {
    const employee = await requireHrEmployee();
    if (employee instanceof NextResponse) redirect("/hrAuth");

    const serverUser: CurrentPerDevUser = {
      fullName: employee.fullName,
      role: employee.role,
      email: employee.email,
    };

    const [competenciesResult, requirementsResult, profileResult] =
      await Promise.all([
        listCompetencies({}),
        listPositionCompetencyRequirements({}),
        listEmployeeCompetencies({}),
      ]);

    const initialError =
      competenciesResult instanceof NextResponse ||
      requirementsResult instanceof NextResponse ||
      profileResult instanceof NextResponse
        ? "Failed to load competency data. Please try again."
        : undefined;

    const competenciesById: Record<string, string> = {};
    for (const competency of competenciesResult instanceof NextResponse
      ? []
      : competenciesResult) {
      competenciesById[competency.id] = competency.name;
    }

    const myPositionId = await loadEmployeePositionId(employee.employeeUuid);

    const positions = await loadPositions();

    const currentUserEmployeeId = employee.employeeUuid;
    const employeeNamesById: Record<string, string> = {};
    const { data: ownEmployeeRow } = await supabaseAdmin
      .from("hr1_employees")
      .select("id, first_name, last_name")
      .eq("id", currentUserEmployeeId)
      .maybeSingle();
    if (ownEmployeeRow) {
      employeeNamesById[ownEmployeeRow.id] = fullName(
        ownEmployeeRow.first_name,
        ownEmployeeRow.last_name
      );
    }

    return (
      <CompetencyManagement
        serverUser={serverUser}
        isHrAdmin={false}
        competencies={
          competenciesResult instanceof NextResponse
            ? []
            : competenciesResult
        }
        initialRequirements={
          requirementsResult instanceof NextResponse ? [] : requirementsResult
        }
        initialProfile={
          profileResult instanceof NextResponse ? [] : profileResult
        }
        initialError={initialError}
        employees={[]}
        positions={positions}
        competenciesById={competenciesById}
        employeeNamesById={employeeNamesById}
        currentUserEmployeeId={currentUserEmployeeId}
        defaultPositionId={myPositionId}
        defaultEmployeeId={currentUserEmployeeId}
        employeePositionById={{ [employee.employeeUuid]: myPositionId }}
      />
    );
  }

  const serverUser: CurrentPerDevUser = {
    fullName: admin.fullName,
    role: admin.role,
    email: admin.email,
  };

  const [competenciesResult, requirementsResult, profileResult] =
    await Promise.all([
      listCompetencies({}),
      listPositionCompetencyRequirements({}),
      listEmployeeCompetencies({}),
    ]);

  const initialError =
    competenciesResult instanceof NextResponse ||
    requirementsResult instanceof NextResponse ||
    profileResult instanceof NextResponse
      ? "Failed to load competency data. Please try again."
      : undefined;

  const competencies = competenciesResult instanceof NextResponse
    ? []
    : (competenciesResult as Competency[]);
  const initialRequirements = requirementsResult instanceof NextResponse
    ? []
    : (requirementsResult as PositionCompetencyRequirement[]);
  const initialProfile = profileResult instanceof NextResponse
    ? []
    : (profileResult as EmployeeCompetencyProfileItem[]);

  const competenciesById: Record<string, string> = {};
  for (const competency of competencies) {
    competenciesById[competency.id] = competency.name;
  }

  const [positions, employees, adminPositionId] = await Promise.all([
    loadPositions(),
    loadEmployeeOptions(),
    loadEmployeePositionId(admin.employeeUuid),
  ]);

  const employeeNamesById: Record<string, string> = {};
  const employeePositionById: Record<string, string> = {};
  for (const employee of employees) {
    employeeNamesById[employee.id] = employee.name;
    if (employee.job_position_id) {
      employeePositionById[employee.id] = employee.job_position_id;
    }
  }

  return (
    <CompetencyManagement
      serverUser={serverUser}
      isHrAdmin
      competencies={competencies}
      initialRequirements={initialRequirements}
      initialProfile={initialProfile}
      initialError={initialError}
      employees={employees}
      positions={positions}
      competenciesById={competenciesById}
      employeeNamesById={employeeNamesById}
      currentUserEmployeeId={admin.employeeUuid}
      defaultPositionId={adminPositionId}
      defaultEmployeeId={admin.employeeUuid}
      employeePositionById={employeePositionById}
    />
  );
}