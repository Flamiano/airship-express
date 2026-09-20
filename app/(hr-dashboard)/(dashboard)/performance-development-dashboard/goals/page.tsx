import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { getAuthenticatedActor } from "@/performance-development-dashboard/lib/auth/actor";
import {
  cachedPerDevAccountType,
  loginRouteForAccountType,
} from "@/performance-development-dashboard/lib/auth/redirect";
import { resolveManagerDirectReportUuids } from "@/performance-development-dashboard/lib/auth/access";
import { listPerformanceGoals } from "@/performance-development-dashboard/lib/performance/goals";
import {
  chooseCurrentCycle,
  listPerformanceCycles,
} from "@/performance-development-dashboard/lib/performance/cycles";
import { GoalsManagement } from "@/performance-development-dashboard/components/goals/GoalsManagement";
import type {
  CurrentPerDevUser,
  EmployeeOption,
  PerformanceCycle,
  PerformanceGoal,
} from "@/performance-development-dashboard/types";

export const dynamic = "force-dynamic";

function fullName(firstName: string, lastName: string): string {
  return `${firstName ?? ""} ${lastName ?? ""}`.trim();
}

/**
 * Row shape for the optional employee-derived fields used by the Goal Create
 * modal. `job_position` is the embedded `hr1_job_positions` join resolved via
 * `hr1_employees.job_position_id` (same pattern the workforce dashboards use).
 */
type EmployeeRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  department: string | null;
  manager_id: string | null;
  job_position_id: string | null;
  /**
   * Runtime verified as a single object (or null) for a to-one embed. Also
   * accepts the array shape so both lookups are defended against.
   */
  job_position?: { title: string | null } | { title: string | null }[] | null;
};

function resolvePositionTitle(
  jobPosition: EmployeeRow["job_position"]
): string | null {
  if (!jobPosition) return null;
  const row = Array.isArray(jobPosition) ? jobPosition[0] : jobPosition;
  return row?.title ?? null;
}

/**
 * Batches one lookup for all distinct reporting-manager ids referenced by the
 * given employee rows. Position titles come from the embedded join on the
 * employee query itself, so managers are the only extra round trip.
 */
async function resolveManagerNames(
  rows: EmployeeRow[]
): Promise<Record<string, string>> {
  const managerIds = [
    ...new Set(
      rows
        .map((row) => row.manager_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  if (managerIds.length === 0) return {};

  const { data, error } = await supabaseAdmin
    .from("hr1_employees")
    .select("id, first_name, last_name")
    .in("id", managerIds);

  if (error) {
    console.error("resolveManagerNames: query error:", error);
    return {};
  }

  const names: Record<string, string> = {};
  for (const manager of data ?? []) {
    names[manager.id] = fullName(manager.first_name, manager.last_name);
  }
  return names;
}

function toEmployeeOption(
  employee: EmployeeRow,
  managerNamesById: Record<string, string>
): EmployeeOption {
  return {
    id: employee.id,
    name: fullName(employee.first_name ?? "", employee.last_name ?? ""),
    department: employee.department,
    job_position_id: employee.job_position_id,
    position: resolvePositionTitle(employee.job_position),
    managerId: employee.manager_id,
    managerName: employee.manager_id
      ? managerNamesById[employee.manager_id] ?? null
      : null,
  };
}

async function resolveReferencedNames(
  goals: PerformanceGoal[]
): Promise<{
  cycleNamesById: Record<string, string>;
  employeeNamesById: Record<string, string>;
}> {
  const cycleIds = [
    ...new Set(goals.map((g) => g.cycle_id).filter(Boolean)),
  ] as string[];
  const employeeIds = [
    ...new Set(
      goals.flatMap((g) => [g.employee_id, g.assigned_by]).filter(Boolean)
    ),
  ] as string[];

  const [cycleResult, employeeResult] = await Promise.all([
    cycleIds.length > 0
      ? supabaseAdmin
          .from("hr3_performance_cycles")
          .select("id, name")
          .in("id", cycleIds)
      : Promise.resolve({ data: null, error: null }),
    employeeIds.length > 0
      ? supabaseAdmin
          .from("hr1_employees")
          .select("id, first_name, last_name")
          .in("id", employeeIds)
      : Promise.resolve({ data: null, error: null }),
  ]);

  const cycleNamesById: Record<string, string> = {};
  for (const cycle of cycleResult.data ?? []) {
    cycleNamesById[cycle.id] = cycle.name;
  }

  const employeeNamesById: Record<string, string> = {};
  for (const employee of employeeResult.data ?? []) {
    employeeNamesById[employee.id] = fullName(
      employee.first_name,
      employee.last_name
    );
  }

  return { cycleNamesById, employeeNamesById };
}

export default async function GoalsPage() {
  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) redirect(loginRouteForAccountType(cachedPerDevAccountType()));

  const serverUser: CurrentPerDevUser = {
    fullName: actor.accountFullName,
    role: actor.role,
    email: actor.accountEmail,
  };

  const goalsResult = await listPerformanceGoals({});
  const goals = goalsResult instanceof NextResponse ? [] : goalsResult;
  const initialError =
    goalsResult instanceof NextResponse
      ? "Failed to load goals. Please try again."
      : undefined;

  const names = await resolveReferencedNames(goals);

  if (actor.actorType === "hr_admin") {
    const [cyclesResult, employeesResult] = await Promise.all([
      listPerformanceCycles(),
      supabaseAdmin
        .from("hr1_employees")
        .select(
          "id, first_name, last_name, department, manager_id, job_position_id, job_position:hr1_job_positions(title)"
        )
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true }),
    ]);

    const cycles = cyclesResult instanceof NextResponse ? [] : cyclesResult;

    const employeeRows = (employeesResult.data ?? []) as unknown as EmployeeRow[];
    const managerNamesById = await resolveManagerNames(employeeRows);

    const employees: EmployeeOption[] = employeeRows.map((e) =>
      toEmployeeOption(e, managerNamesById)
    );

    const defaultCycleId = chooseCurrentCycle(cycles as PerformanceCycle[])?.id;

    return (
      <GoalsManagement
        serverUser={serverUser}
        actorType="hr_admin"
        initialGoals={goals}
        initialError={initialError}
        cycles={cycles as PerformanceCycle[]}
        employees={employees}
        cycleNamesById={names.cycleNamesById}
        employeeNamesById={names.employeeNamesById}
        defaultCycleId={defaultCycleId}
      />
    );
  }

  if (actor.actorType === "manager" && actor.employeeUuid) {
    const directReportIds = await resolveManagerDirectReportUuids(
      actor.employeeUuid
    );
    const scopedIds = [actor.employeeUuid, ...directReportIds];

    const [employeesResult] = await Promise.all([
      supabaseAdmin
        .from("hr1_employees")
        .select(
          "id, first_name, last_name, department, manager_id, job_position_id, job_position:hr1_job_positions(title)"
        )
        .in("id", scopedIds)
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true }),
    ]);

    const employeeRows = (employeesResult.data ?? []) as unknown as EmployeeRow[];
    const managerNamesById = await resolveManagerNames(employeeRows);

    const employees: EmployeeOption[] = employeeRows.map((e) =>
      toEmployeeOption(e, managerNamesById)
    );

    return (
      <GoalsManagement
        serverUser={serverUser}
        actorType="manager"
        initialGoals={goals}
        initialError={initialError}
        cycles={[]}
        employees={employees}
        cycleNamesById={names.cycleNamesById}
        employeeNamesById={names.employeeNamesById}
      />
    );
  }

  return (
    <GoalsManagement
      serverUser={serverUser}
      actorType="employee"
      initialGoals={goals}
      initialError={initialError}
      cycles={[]}
      employees={[]}
      cycleNamesById={names.cycleNamesById}
      employeeNamesById={names.employeeNamesById}
    />
  );
}
