import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { Suspense } from "react";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { getAuthenticatedActor } from "@/performance-development-dashboard/lib/auth/actor";
import {
  cachedPerDevAccountType,
  loginRouteForAccountType,
} from "@/performance-development-dashboard/lib/auth/redirect";
import { requireHrAdmin, requireHrEmployee } from "@/performance-development-dashboard/lib/auth/hrIdentity";
import { listAppraisals } from "@/performance-development-dashboard/lib/performance/appraisals";
import { listPerformanceCycles } from "@/performance-development-dashboard/lib/performance/cycles";
import { AppraisalsManagement } from "@/performance-development-dashboard/components/appraisals/AppraisalsManagement";
import type {
  CurrentPerDevUser,
  EmployeeOption,
  PerformanceAppraisal,
  PerformanceCycle,
} from "@/performance-development-dashboard/types";

export const dynamic = "force-dynamic";

function fullName(firstName: string, lastName: string): string {
  return `${firstName ?? ""} ${lastName ?? ""}`.trim();
}

async function resolveReferencedNames(
  appraisals: PerformanceAppraisal[]
): Promise<Record<string, string>> {
  const employeeIds = [
    ...new Set(
      appraisals
        .flatMap((appraisal) => [
          appraisal.employee_id,
          appraisal.reviewer_id,
          appraisal.evaluator_id,
        ])
        .filter(Boolean)
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

  const namesById: Record<string, string> = {};
  for (const employee of data ?? []) {
    namesById[employee.id] = fullName(employee.first_name, employee.last_name);
  }

  return namesById;
}

export default async function AppraisalsPage() {
  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) redirect(loginRouteForAccountType(cachedPerDevAccountType()));

  const isHrAdmin = actor.actorType === "hr_admin";
  const isManager = actor.actorType === "manager";

  if (isHrAdmin) {
    const admin = await requireHrAdmin();
    if (admin instanceof NextResponse) redirect("/hrAuth");

    const serverUser: CurrentPerDevUser = {
      fullName: admin.fullName,
      role: admin.role,
      email: admin.email,
    };

    const appraisalsResult = await listAppraisals({});
    const appraisals =
      appraisalsResult instanceof NextResponse ? [] : appraisalsResult;
    const initialError =
      appraisalsResult instanceof NextResponse
        ? "Failed to load appraisals. Please try again."
        : undefined;

    const [employeesResult, employeeNamesById] = await Promise.all([
      // New-appraisal subject selector: active employees only. Finalized and
      // historical appraisals (including inactive subjects) still load via
      // listAppraisals and resolve names through resolveReferencedNames.
      supabaseAdmin
        .from("hr1_employees")
        .select("id, first_name, last_name, department")
        .eq("status", "active")
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true }),
      resolveReferencedNames(appraisals),
    ]);

    const employees: EmployeeOption[] = (employeesResult.data ?? []).map((e) => ({
      id: e.id,
      name: fullName(e.first_name, e.last_name),
      department: e.department,
    }));

    const cyclesResult = await listPerformanceCycles();
    const cycles: PerformanceCycle[] =
      cyclesResult instanceof NextResponse ? [] : cyclesResult;

    return (
      <Suspense>
        <AppraisalsManagement
          serverUser={serverUser}
          isHrAdmin
          isManager={false}
          initialAppraisals={appraisals}
          initialError={initialError}
          employees={employees}
          cycles={cycles}
          employeeNamesById={employeeNamesById}
          reviewerByAccountNameById={{}}
          currentUserEmployeeId={admin.employeeUuid}
          defaultEmployeeId={admin.employeeUuid}
        />
      </Suspense>
    );
  }

  // Manager or Employee branch
  const employee = await requireHrEmployee();
  if (employee instanceof NextResponse) redirect("/hrAuth");

  const serverUser: CurrentPerDevUser = {
    fullName: employee.fullName,
    role: employee.role,
    email: employee.email,
  };

  const appraisalsResult = await listAppraisals({});
  const appraisals =
    appraisalsResult instanceof NextResponse ? [] : appraisalsResult;
  const initialError =
    appraisalsResult instanceof NextResponse
      ? "Failed to load your appraisals. Please try again."
      : undefined;

  const employeeNamesById = await resolveReferencedNames(appraisals);
  employeeNamesById[employee.employeeUuid] = employee.fullName;

  // For managers: also load direct report names
  let employees: EmployeeOption[] = [];
  if (isManager) {
    const { resolveManagerDirectReportUuids } = await import(
      "@/performance-development-dashboard/lib/auth/access"
    );
    const directReportIds = await resolveManagerDirectReportUuids(
      employee.employeeUuid
    );
    if (directReportIds.length > 0) {
      const { data } = await supabaseAdmin
        .from("hr1_employees")
        .select("id, first_name, last_name, department")
        .in("id", directReportIds);
      employees = (data ?? []).map((e) => ({
        id: e.id,
        name: fullName(e.first_name, e.last_name),
        department: e.department,
      }));
      for (const e of data ?? []) {
        employeeNamesById[e.id] = fullName(e.first_name, e.last_name);
      }
    }
  }

  return (
    <Suspense>
      <AppraisalsManagement
        serverUser={serverUser}
        isHrAdmin={false}
        isManager={isManager}
        initialAppraisals={appraisals}
        initialError={initialError}
        employees={employees}
        cycles={[]}
        employeeNamesById={employeeNamesById}
        reviewerByAccountNameById={{}}
        currentUserEmployeeId={employee.employeeUuid}
        defaultEmployeeId={null}
      />
    </Suspense>
  );
}