import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { getAuthenticatedActor } from "@/performance-development-dashboard/lib/auth/actor";
import { isPerDevHrAdminRole } from "@/performance-development-dashboard/lib/auth/hrIdentity";
import { resolveManagerDirectReportUuids } from "@/performance-development-dashboard/lib/auth/access";
import {
  cachedPerDevAccountType,
  loginRouteForAccountType,
} from "@/performance-development-dashboard/lib/auth/redirect";
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

async function loadScopedPositions(
  positionIds: string[]
): Promise<PositionOption[]> {
  if (positionIds.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from("hr1_job_positions")
    .select("id, title, department")
    .in("id", positionIds)
    .order("title", { ascending: true });

  if (error) {
    console.error("loadScopedPositions: query error:", error);
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

async function loadScopedEmployees(
  employeeIds: string[]
): Promise<EmployeeOption[]> {
  if (employeeIds.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from("hr1_employees")
    .select("id, first_name, last_name, department, job_position_id")
    .in("id", employeeIds)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (error) {
    console.error("loadScopedEmployees: query error:", error);
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
  // Actor-aware READ authorization. requireHrAdmin() must never gate page
  // rendering: employees and managers hold a linked hr1_employees identity and
  // the competency loaders below already enforce employee/manager scope
  // server-side. Only PerDev HR Admin (super_admin / hr_performance_admin)
  // receives the administration branch.
  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) {
    redirect(loginRouteForAccountType(cachedPerDevAccountType()));
  }

  // PerDev-aware HR branch: actorType alone is not sufficient evidence of
  // PerDev HR Admin. Non-PerDev HR shares actorType "hr_admin" but is denied
  // by every competency loader, so deny at the page boundary too.
  const isPerDevHrAdmin =
    actor.actorType === "hr_admin" && isPerDevHrAdminRole(actor.role);

  if (actor.actorType === "hr_admin" && !isPerDevHrAdmin) {
    redirect("/hrAuth");
  }

  if (!actor.employeeUuid && !isPerDevHrAdmin) {
    redirect(loginRouteForAccountType(actor.actorType));
  }

  const serverUser: CurrentPerDevUser = {
    fullName: actor.accountFullName,
    role: actor.role,
    email: actor.accountEmail,
  };

  // Server-scoped reads. No client-supplied employee/position scope is sent:
  // listPositionCompetencyRequirements and listEmployeeCompetencies force
  // non-admin callers to their own position/profile inside the service.
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

  if (isPerDevHrAdmin) {
    const competencies = competenciesResult instanceof NextResponse
      ? []
      : (competenciesResult as Competency[]);
    const initialRequirements = requirementsResult instanceof NextResponse
      ? []
      : (requirementsResult as PositionCompetencyRequirement[]);
    const initialProfile = profileResult instanceof NextResponse
      ? []
      : (profileResult as EmployeeCompetencyProfileItem[]);

    const [positions, employees, adminPositionId] = await Promise.all([
      loadPositions(),
      loadEmployeeOptions(),
      loadEmployeePositionId(actor.employeeUuid),
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
        currentUserEmployeeId={actor.employeeUuid}
        defaultPositionId={adminPositionId}
        defaultEmployeeId={actor.employeeUuid}
        employeePositionById={employeePositionById}
      />
    );
  }

  if (actor.actorType === "manager" && actor.employeeUuid) {
    const directReportIds = await resolveManagerDirectReportUuids(
      actor.employeeUuid
    );
    const scopedIds = [actor.employeeUuid, ...directReportIds];

    const scopedEmployees = await loadScopedEmployees(scopedIds);

    const scopedPositionIds = [
      ...new Set(
        scopedEmployees
          .map((employee) => employee.job_position_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const positions = await loadScopedPositions(scopedPositionIds);

    const employeeNamesById: Record<string, string> = {};
    const employeePositionById: Record<string, string | null> = {};
    for (const employee of scopedEmployees) {
      employeeNamesById[employee.id] = employee.name;
      employeePositionById[employee.id] = employee.job_position_id ?? null;
    }

    const myPositionId = employeePositionById[actor.employeeUuid] ?? null;

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
        employees={scopedEmployees}
        positions={positions}
        competenciesById={competenciesById}
        employeeNamesById={employeeNamesById}
        currentUserEmployeeId={actor.employeeUuid}
        defaultPositionId={myPositionId}
        defaultEmployeeId={actor.employeeUuid}
        employeePositionById={employeePositionById}
      />
    );
  }

  const currentUserEmployeeId = actor.employeeUuid;
  const myPositionId = await loadEmployeePositionId(actor.employeeUuid);
  const positions = await loadScopedPositions(
    myPositionId ? [myPositionId] : []
  );

  const employeeNamesById: Record<string, string> = {};
  if (currentUserEmployeeId) {
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
  }

  return (
    <CompetencyManagement
      serverUser={serverUser}
      isHrAdmin={false}
      competencies={
        competenciesResult instanceof NextResponse ? [] : competenciesResult
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
      employeePositionById={
        currentUserEmployeeId ? { [currentUserEmployeeId]: myPositionId } : {}
      }
    />
  );
}
