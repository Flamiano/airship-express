import { NextResponse } from "next/server";
import { getAuthenticatedActor } from "@/performance-development-dashboard/lib/auth/actor";
import { isPerDevHrAdminRole } from "@/performance-development-dashboard/lib/auth/hrIdentity";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await getAuthenticatedActor();

  if (actor instanceof NextResponse) return actor;

  // Server-resolved PerDev administration capability. UI navigation gating
  // consumes this flag instead of inferring admin rights from the generic
  // HR account type, so non-PerDev HR roles never see HR-admin navigation.
  // It grants nothing by itself — every page and API re-authorizes.
  const isPerDevHrAdmin =
    actor.actorType === "hr_admin" && isPerDevHrAdminRole(actor.role);

  return NextResponse.json({
    authenticated: true,
    actor: {
      hrAdminId: actor.hrAdminId,
      accountType: actor.actorType,
      fullName: actor.accountFullName,
      email: actor.accountEmail,
      role: actor.role,
    },
    employee: actor.employeeUuid
      ? {
          employeeUuid: actor.employeeUuid,
          employeeIdNumber: actor.employeeIdNumber,
          fullName: actor.employeeFullName,
        }
      : null,
    hasLinkedEmployee: actor.employeeUuid !== null,
    user: {
      hrAdminId: actor.hrAdminId,
      accountType: actor.actorType,
      employeeIdNumber: actor.employeeIdNumber,
      employeeUuid: actor.employeeUuid,
      fullName: actor.accountFullName,
      email: actor.accountEmail,
      role: actor.role,
      isPerDevHrAdmin,
    },
  });
}