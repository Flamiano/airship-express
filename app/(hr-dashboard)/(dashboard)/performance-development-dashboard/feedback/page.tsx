import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { getAuthenticatedActor } from "@/performance-development-dashboard/lib/auth/actor";
import {
  cachedPerDevAccountType,
  loginRouteForAccountType,
} from "@/performance-development-dashboard/lib/auth/redirect";
import { resolveManagerDirectReportUuids } from "@/performance-development-dashboard/lib/auth/access";
import { isPerDevHrAdminRole } from "@/performance-development-dashboard/lib/auth/hrIdentity";
import { listFeedbackRequests } from "@/performance-development-dashboard/lib/performance/feedback";
import { FeedbackManagement } from "@/performance-development-dashboard/components/feedback/FeedbackManagement";
import type {
  CurrentPerDevUser,
  EmployeeOption,
  FeedbackRequestListItem,
} from "@/performance-development-dashboard/types";

export const dynamic = "force-dynamic";

function fullName(firstName: string, lastName: string): string {
  return `${firstName ?? ""} ${lastName ?? ""}`.trim();
}

type EmployeeRow = {
  id: string;
  first_name: string;
  last_name: string;
  department: string | null;
};

function toOptions(rows: EmployeeRow[]): EmployeeOption[] {
  return rows.map((row) => ({
    id: row.id,
    name: fullName(row.first_name, row.last_name),
    department: row.department,
  }));
}

export default async function FeedbackPage() {
  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse)
    redirect(loginRouteForAccountType(cachedPerDevAccountType()));

  const serverUser: CurrentPerDevUser = {
    fullName: actor.accountFullName,
    role: actor.role,
    email: actor.accountEmail,
  };

  const requestsResult = await listFeedbackRequests();
  const requests =
    requestsResult instanceof NextResponse
      ? []
      : (requestsResult as FeedbackRequestListItem[]);
  const initialError =
    requestsResult instanceof NextResponse
      ? "Failed to load feedback. Please try again."
      : undefined;

  // PerDev-aware HR flag for UI gating. actorType alone is not sufficient:
  // non-PerDev HR roles share actorType "hr_admin" but are denied by every
  // feedback API. Non-PerDev HR renders the access-denied state below.
  const isPerDevHrAdmin =
    actor.actorType === "hr_admin" && isPerDevHrAdminRole(actor.role);

  if (actor.actorType === "hr_admin") {
    if (!isPerDevHrAdmin) {
      return (
        <FeedbackManagement
          serverUser={serverUser}
          actorType="hr_admin"
          isPerDevHrAdmin={isPerDevHrAdmin}
          initialRequests={[]}
          initialError={initialError}
          employees={[]}
          actorEmployeeUuid={actor.employeeUuid}
        />
      );
    }

    const employeesResult = await supabaseAdmin
      .from("hr1_employees")
      .select("id, first_name, last_name, department")
      .eq("status", "active")
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    return (
      <FeedbackManagement
        serverUser={serverUser}
        actorType="hr_admin"
        isPerDevHrAdmin={isPerDevHrAdmin}
        initialRequests={requests}
        initialError={initialError}
        employees={toOptions(
          (employeesResult.data ?? []) as EmployeeRow[]
        )}
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
      .eq("status", "active")
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    return (
      <FeedbackManagement
        serverUser={serverUser}
        actorType="manager"
        isPerDevHrAdmin={isPerDevHrAdmin}
        initialRequests={requests}
        initialError={initialError}
        employees={toOptions(
          (employeesResult.data ?? []) as EmployeeRow[]
        )}
        actorEmployeeUuid={actor.employeeUuid}
      />
    );
  }

  // Employee scope: colleagues are all active employees except self. The
  // selector is convenience only — the API authorizes every recipient.
  const colleaguesResult = actor.employeeUuid
    ? await supabaseAdmin
        .from("hr1_employees")
        .select("id, first_name, last_name, department")
        .eq("status", "active")
        .neq("id", actor.employeeUuid)
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true })
    : { data: [] as EmployeeRow[] };

  return (
    <FeedbackManagement
      serverUser={serverUser}
      actorType="employee"
      isPerDevHrAdmin={isPerDevHrAdmin}
      initialRequests={requests}
      initialError={initialError}
      employees={toOptions((colleaguesResult.data ?? []) as EmployeeRow[])}
      actorEmployeeUuid={actor.employeeUuid}
    />
  );
}
