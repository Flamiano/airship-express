import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { Suspense } from "react";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { getAuthenticatedActor } from "@/performance-development-dashboard/lib/auth/actor";
import {
  cachedPerDevAccountType,
  loginRouteForAccountType,
} from "@/performance-development-dashboard/lib/auth/redirect";
import { resolveManagerDirectReportUuids } from "@/performance-development-dashboard/lib/auth/access";
import { isPerDevHrAdminRole } from "@/performance-development-dashboard/lib/auth/hrIdentity";
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

  // PerDev-aware HR flag for UI gating. actorType alone is not sufficient:
  // non-PerDev HR roles share actorType "hr_admin" but are denied by every
  // check-in API. The page data branches below are unchanged.
  const isPerDevHrAdmin =
    actor.actorType === "hr_admin" && isPerDevHrAdminRole(actor.role);

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
      <Suspense>
        <CheckInsManagement
          serverUser={serverUser}
          actorType="hr_admin"
          isPerDevHrAdmin={isPerDevHrAdmin}
          initialCheckIns={checkIns}
          initialError={initialError}
          employees={employees}
          employeeNamesById={employeeNamesById}
          defaultEmployeeId={actor.employeeUuid}
          actorEmployeeUuid={actor.employeeUuid}
        />
      </Suspense>
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
      <Suspense>
        <CheckInsManagement
          serverUser={serverUser}
          actorType="manager"
          isPerDevHrAdmin={isPerDevHrAdmin}
          initialCheckIns={checkIns}
          initialError={initialError}
          employees={employees}
          employeeNamesById={employeeNamesById}
          defaultEmployeeId={actor.employeeUuid}
          actorEmployeeUuid={actor.employeeUuid}
        />
      </Suspense>
    );
  }

  if (actor.employeeUuid) {
    employeeNamesById[actor.employeeUuid] =
      actor.employeeFullName ?? actor.accountFullName;
  }

  return (
    <Suspense>
      <CheckInsManagement
        serverUser={serverUser}
        actorType="employee"
        isPerDevHrAdmin={isPerDevHrAdmin}
        initialCheckIns={checkIns}
        initialError={initialError}
        employees={[]}
        employeeNamesById={employeeNamesById}
        actorEmployeeUuid={actor.employeeUuid}
      />
    </Suspense>
  );
}