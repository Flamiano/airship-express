import { NextResponse } from "next/server";
import { getAuthenticatedActor } from "@/performance-development-dashboard/lib/auth/actor";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await getAuthenticatedActor();

  if (actor instanceof NextResponse) return actor;

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
    },
  });
}