import "server-only";

import { cache } from "react";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/app/(hr-dashboard)/supabase/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { isValidHRRole } from "@/app/(hr-dashboard)/utils/roleValidation";
import { resolveHrAccountForSession } from "@/app/(hr-dashboard)/lib/hr-account";

/**
 * PerDev Actor identity abstraction.
 *
 * Resolves and distinguishes the identities involved in every PerDev action:
 *
 *   AUTHENTICATED ACTOR ACCOUNT  = the account that performed the action
 *                                  → hr_admin.id (hrAdminId) for HR Admin
 *                                    accounts, or the linked hr1_employees row
 *                                    for Manager/Employee accounts
 *   EMPLOYEE IDENTITY OF ACTOR   = employee record linked to that account
 *                                  → hr1_employees.id (employeeUuid)
 *   EMPLOYEE SUBJECT             = employee affected by the action
 *                                  (handled at each operation's scope, resolved
 *                                   server-side per record)
 *
 * `hrAdminId` and `employeeUuid` are separate fields and are permanently
 * distinct: an hr_admin id is never an employee UUID and an employee UUID is
 * never an hr_admin id. `hrAdminId` is null for Manager/Employee accounts,
 * which have no hr_admin row.
 *
 * Identity resolution chain (all server-side, never client-supplied):
 *
 *   Supabase session user.id
 *     → hr_admin.id                            (HR Admin account → actorType "hr_admin")
 *     OR hr1_employees.auth_user_id            (Manager/Employee account)
 *     → manager_id relationships               (actorType "manager" when an active
 *                                               employee has manager_id → employee.id,
 *                                               otherwise "employee")
 */
export type PerDevActorType = "hr_admin" | "manager" | "employee";

export type PerDevActor = {
  hrAdminId: string | null;
  employeeUuid: string | null;
  employeeIdNumber: string | null;
  accountFullName: string;
  accountEmail: string | null;
  employeeFullName: string | null;
  role: string;
  actorType: PerDevActorType;
};

/**
 * Sole server-side resolver for the authenticated PerDev actor.
 *
 * Derives every field from the authenticated Supabase session plus the shared
 * account resolution chain in `resolveHrAccountForSession`. Returns a
 * NextResponse (401 / 403 / 500) on failure exactly like the previous
 * `getAuthenticatedHrUser`, so this is a drop-in source of truth for the
 * entire PerDev identity model.
 */
export const getAuthenticatedActor = cache(async (): Promise<
  PerDevActor | NextResponse
> => {
  try {
    const supabase = await createServerSupabaseClient();

    // Validate the authenticated user against Supabase Auth rather than
    // trusting a locally stored session. getUser() verifies the access token
    // is still valid; an expired or revoked token is rejected even if a
    // session object exists locally.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("getAuthenticatedActor: No valid session found");
      return NextResponse.json(
        { error: "Unauthorized - No valid session" },
        { status: 401 }
      );
    }

    const resolved = await resolveHrAccountForSession(user.id);

    if (!resolved) {
      console.error(
        "getAuthenticatedActor: session user does not map to an HR account:",
        user.id
      );
      return NextResponse.json(
        { error: "Unauthorized - HR account not found" },
        { status: 401 }
      );
    }

    // ---------- HR Admin account ----------
    if (resolved.accountType === "hr_admin") {
      if (!isValidHRRole(resolved.role)) {
        console.error("getAuthenticatedActor: Invalid HR role:", resolved.role);
        return NextResponse.json(
          {
            error: `Forbidden - Role "${resolved.role}" is not a valid HR role`,
          },
          { status: 403 }
        );
      }

      let employeeUuid: string | null = null;
      let employeeFullName: string | null = null;
      const employeeIdNumber = resolved.employeeIdNumber;

      if (employeeIdNumber) {
        const { data: employee, error: employeeError } = await supabaseAdmin
          .from("hr1_employees")
          .select("id, first_name, last_name")
          .eq("employee_id_number", employeeIdNumber)
          .maybeSingle();

        if (employeeError) {
          console.error(
            "getAuthenticatedActor: Linked employee lookup error:",
            employeeError
          );
        } else if (employee) {
          employeeUuid = employee.id;
          employeeFullName =
            [employee.first_name, employee.last_name].filter(Boolean).join(" ").trim() ||
            null;
        }
      }

      return {
        hrAdminId: resolved.hrAdminId,
        employeeUuid,
        employeeIdNumber,
        accountFullName: resolved.fullName,
        accountEmail: resolved.email ?? user.email ?? null,
        employeeFullName,
        role: resolved.role,
        actorType: "hr_admin",
      };
    }

    // ---------- Manager / Employee account ----------
    return {
      hrAdminId: null,
      employeeUuid: resolved.employeeUuid,
      employeeIdNumber: resolved.employeeIdNumber,
      accountFullName: resolved.fullName,
      accountEmail: resolved.email ?? user.email ?? null,
      employeeFullName: resolved.fullName,
      role: resolved.role,
      actorType: resolved.accountType,
    };
  } catch (error) {
    console.error("getAuthenticatedActor error:", error);
    return NextResponse.json(
      {
        error: "Authentication error - Please try again.",
      },
      { status: 500 }
    );
  }
});

export function isHrAdminActor(actor: PerDevActor): boolean {
  return actor.actorType === "hr_admin";
}

export function isManagerActor(actor: PerDevActor): boolean {
  return actor.actorType === "manager";
}

export function hasLinkedEmployee(actor: PerDevActor): boolean {
  return actor.employeeUuid !== null && actor.employeeIdNumber !== null;
}