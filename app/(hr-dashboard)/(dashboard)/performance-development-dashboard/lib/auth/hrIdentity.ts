import "server-only";

import { NextResponse } from "next/server";
import {
  DASHBOARD_ACCESS,
  ACCOUNT_TYPE,
  type AccountType,
  isValidHRRole,
} from "@/app/(hr-dashboard)/utils/roleValidation";
import { HR_ROUTES as HR_ROUTE_PATHS } from "@/app/(hr-dashboard)/constants/route";
import type { AppRole } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/types";
import { getAuthenticatedActor } from "@/performance-development-dashboard/lib/auth/actor";

export type AuthenticatedHrUser = {
  hrAdminId: string | null;
  accountType: AccountType;
  employeeIdNumber: string | null;
  employeeUuid: string | null;
  fullName: string;
  email: string | null;
  role: AppRole | Exclude<AccountType, "hr_admin">;
};

export type AuthenticatedHrEmployee = Omit<AuthenticatedHrUser, "employeeUuid"> & {
  employeeUuid: string; // guaranteed non-null
};

/**
 * Backward-compatible facade over the PerDev Actor resolver.
 *
 * Identity resolution is owned exclusively by getAuthenticatedActor() in
 * actor.ts. This function keeps the historic AuthenticatedHrUser shape for
 * existing consumers (fullName = account full name) without re-querying the
 * database.
 */
export async function getAuthenticatedHrUser(): Promise<
  AuthenticatedHrUser | NextResponse
> {
  const actor = await getAuthenticatedActor();

  if (actor instanceof NextResponse) return actor;

  return {
    hrAdminId: actor.hrAdminId,
    accountType: actor.actorType,
    employeeIdNumber: actor.employeeIdNumber,
    employeeUuid: actor.employeeUuid,
    fullName: actor.accountFullName,
    email: actor.accountEmail,
    role: actor.role as AuthenticatedHrUser["role"],
  };
}

const PERFORMANCE_DASHBOARD_ALLOWED_ROLES =
  DASHBOARD_ACCESS[HR_ROUTE_PATHS.PERFORMANCE_DEVELOPMENT];

/**
 * Returns true only for HR Admin roles that are explicitly allowed for the
 * Performance Development module. An HR Admin with an unrelated role must
 * NOT be treated as a PerDev HR administrator.
 */
export function isPerDevHrAdminRole(role: string): boolean {
  return PERFORMANCE_DASHBOARD_ALLOWED_ROLES.includes(role as AppRole);
}

/**
 * Requires an authenticated account with a real employee identity.
 *
 * Succeeds for:
 *   - HR Admin accounts linked to an hr1_employees record
 *   - Manager accounts (hr1_employees with direct reports)
 *   - Employee accounts (hr1_employees with no direct reports)
 */
export async function requireHrEmployee(): Promise<
  AuthenticatedHrEmployee | NextResponse
> {
  const identity = await getAuthenticatedHrUser();

  if (identity instanceof NextResponse) return identity;

  if (!identity.employeeUuid) {
    console.error(
      "requireHrEmployee: account has no linked employee record:",
      identity.hrAdminId
    );
    return NextResponse.json(
      {
        error: "Forbidden - account has no linked employee record",
      },
      { status: 403 }
    );
  }

  return {
    ...identity,
    employeeUuid: identity.employeeUuid,
  };
}

/**
 * Requires an HR Admin account with access to the PerDev dashboard.
 *
 * Manager and Employee accounts never pass this guard: the PerDev admin
 * surfaces are reserved for `super_admin` and `hr_performance_admin`.
 */
export async function requireHrAdmin(): Promise<
  AuthenticatedHrUser | NextResponse
> {
  const identity = await getAuthenticatedHrUser();

  if (identity instanceof NextResponse) return identity;

  if (
    identity.accountType !== ACCOUNT_TYPE.HR_ADMIN ||
    !isValidHRRole(identity.role) ||
    !PERFORMANCE_DASHBOARD_ALLOWED_ROLES.includes(identity.role as AppRole)
  ) {
    console.error(
      "requireHrAdmin: Insufficient permissions:",
      identity.accountType,
      identity.role
    );
    return NextResponse.json(
      {
        error: "Forbidden - This account does not have access to this dashboard",
      },
      { status: 403 }
    );
  }

  return identity;
}