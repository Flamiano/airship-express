import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { getAuthenticatedActor } from "@/performance-development-dashboard/lib/auth/actor";
import {
  cachedPerDevAccountType,
  loginRouteForAccountType,
} from "@/performance-development-dashboard/lib/auth/redirect";
import { resolveManagerDirectReportUuids } from "@/performance-development-dashboard/lib/auth/access";
import { listCheckIns } from "@/performance-development-dashboard/lib/performance/checkins";
import { CheckInsManagement } from "@/performance-development-dashboard/components/check-ins/CheckInsManagement";
import type {
  CurrentPerDevUser,
  EmployeeOption,
  PerformanceCheckIn,
} from "@/performance-development-dashboard/types";

export const dynamic = "force-dynamic";

function fullName(firstName: string, lastName: string): string {
  return `${firstName ?? ""} ${lastName ?? ""}`.trim();
}

async function resolveReferencedNames(
  checkIns: PerformanceCheckIn[]
): Promise<Record<string, string>> {
  const employeeIds = [
    ...new Set(
      checkIns.flatMap((checkIn) => [checkIn.employee_id, checkIn.given_by]).filter(Boolean)
    ),
  ] as string[];

  if (employeeIds.length === 0) return {};

  const { data, error } = await supabaseAdmin
    .from("hr1_employees")
    .select("id, first_name, last_name")
    .in("id", employeeIds);

  if (error) {
    console.error("resolveReferencedNames: employee query error:", error);
    return {};
  }

  const employeeNamesById: Record<string, string> = {};
  for (const employee of data ?? []) {
    employeeNamesById[employee.id] = fullName(
      employee.first_name,
      employee.last_name
    );
  }

  return employeeNamesById;
}

export default async function CheckInsPage() {
  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) redirect(loginRouteForAccountType(cachedPerDevAccountType()));

  const serverUser: CurrentPerDevUser = {
    fullName: actor.accountFullName,
    role: actor.role,
    email: actor.accountEmail,
  };

  const checkInsResult = await listCheckIns({});
  const checkIns = checkInsResult instanceof NextResponse ? [] : checkInsResult;
  const initialError =
    checkInsResult instanceof NextResponse
      ? "Failed to load check-ins. Please try again."
      : undefined;

  const employeeNamesById = await resolveReferencedNames(checkIns);

  if (actor.actorType === "hr_admin") {
    if (actor.employeeUuid) {
      employeeNamesById[actor.employeeUuid] =
        actor.employeeFullName ?? actor.accountFullName;
    }

    const employeesResult = await supabaseAdmin
      .from("hr1_employees")
      .select("id, first_name, last_name, department")
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    const employees: EmployeeOption[] = (employeesResult.data ?? []).map((e) => ({
      id: e.id,
      name: fullName(e.first_name, e.last_name),
      department: e.department,
    }));

    return (
      <CheckInsManagement
        serverUser={serverUser}
        actorType="hr_admin"
        initialCheckIns={checkIns}
        initialError={initialError}
        employees={employees}
        employeeNamesById={employeeNamesById}
        defaultEmployeeId={actor.employeeUuid}
        actorEmployeeUuid={actor.employeeUuid}
      />
    );
  }

  if (actor.actorType === "manager" && actor.employeeUuid) {
    const directReportIds = await resolveManagerDirectReportUuids(
      actor.employeeUuid
    );
    const scopedIds = [actor.employeeUuid, ...directReportIds];

    const employeesResult = await supabaseAdmin
      .from("hr1_employees")
      .select("id, first_name, last_name, department")
      .in("id", scopedIds)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    const employees: EmployeeOption[] = (employeesResult.data ?? []).map((e) => ({
      id: e.id,
      name: fullName(e.first_name, e.last_name),
      department: e.department,
    }));

    return (
      <CheckInsManagement
        serverUser={serverUser}
        actorType="manager"
        initialCheckIns={checkIns}
        initialError={initialError}
        employees={employees}
        employeeNamesById={employeeNamesById}
        defaultEmployeeId={actor.employeeUuid}
        actorEmployeeUuid={actor.employeeUuid}
      />
    );
  }

  if (actor.employeeUuid) {
    employeeNamesById[actor.employeeUuid] =
      actor.employeeFullName ?? actor.accountFullName;
  }

  return (
    <CheckInsManagement
      serverUser={serverUser}
      actorType="employee"
      initialCheckIns={checkIns}
      initialError={initialError}
      employees={[]}
      employeeNamesById={employeeNamesById}
      actorEmployeeUuid={actor.employeeUuid}
    />
  );
}