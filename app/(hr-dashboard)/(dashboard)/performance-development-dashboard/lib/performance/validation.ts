import "server-only";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import {
  COMPETENCY_LEVEL_MAX,
  COMPETENCY_LEVEL_MIN,
} from "@/performance-development-dashboard/types";

/**
 * Shared PerDev validation helpers.
 *
 * This module centralizes the request-validation primitives that were
 * previously duplicated across the `lib/performance/*` domain modules. The
 * implementations here are moved verbatim from those modules so that the
 * accept/reject behavior, status codes, and error messages are unchanged.
 *
 * Server-only: these helpers construct `NextResponse` error payloads and must
 * never be imported into client components.
 */

export const BAD_REQUEST_RESPONSE = (message: string) =>
  NextResponse.json({ error: message }, { status: 400 });

export const CONFLICT_RESPONSE = (message: string) =>
  NextResponse.json({ error: message }, { status: 409 });

/**
 * 403: authenticated but not authorized. Generic so an unauthorized user
 * cannot distinguish a record they do not own from one that does not exist
 * (matches the module's shared record-forbidden convention).
 */
export const FORBIDDEN_RESPONSE = () =>
  NextResponse.json(
    { error: "Forbidden - You do not have access to this record" },
    { status: 403 }
  );

export const NOT_FOUND_RESPONSE = (label: string) =>
  NextResponse.json({ error: `${label} not found` }, { status: 404 });

/**
 * Sentinel for "field not supplied at all" (undefined), distinct from null.
 */
export const ABSENT = "__PERDEV_ABSENT__";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireValidUuid(
  value: unknown,
  field: string
): string | NextResponse {
  if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
    return BAD_REQUEST_RESPONSE(`${field} must be a valid UUID.`);
  }
  return value.trim().toLowerCase();
}

/**
 * Validates that a value references an existing ACTIVE employee.
 *
 * Used exclusively for NEW assignments (goal/appraisal/enrollment/
 * candidacy creation): PerDev follow-up work targets current employees.
 * Historical reads, updates to existing records, and employee-scoped
 * self access must NOT use this helper — inactive employees keep full
 * historical visibility through the existing existence checks.
 */
export async function requireActiveEmployeeId(
  value: unknown,
  field: string
): Promise<string | NextResponse> {
  const id = requireValidUuid(value, field);
  if (id instanceof NextResponse) return id;

  const { data, error } = await supabaseAdmin
    .from("hr1_employees")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("requireActiveEmployeeId: query error:", error);
    return NextResponse.json(
      { error: "Failed to validate employee" },
      { status: 500 }
    );
  }

  if (!data) {
    return BAD_REQUEST_RESPONSE(
      `${field} does not reference an existing employee.`
    );
  }

  if (data.status && data.status !== "active") {
    return BAD_REQUEST_RESPONSE(
      "New PerDev assignments require an active employee."
    );
  }

  return id;
}

export function requireFiniteNumber(
  value: unknown,
  field: string
): number | NextResponse {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "string" &&
    value.trim() !== "" &&
    Number.isFinite(Number(value))
  ) {
    return Number(value.trim());
  }
  return BAD_REQUEST_RESPONSE(`${field} must be a valid number.`);
}

/**
 * Validates an OPTIONAL percentage (0–100). Absent/empty → null; non-numeric →
 * 400; out-of-range → 400.
 */
export function requireProgressPercent(
  value: unknown,
  field: string
): number | null | NextResponse {
  if (value === undefined || value === null || value === "") return null;
  const numeric = requireFiniteNumber(value, field);
  if (numeric instanceof NextResponse) return numeric;
  if (numeric < 0 || numeric > 100) {
    return BAD_REQUEST_RESPONSE(`${field} must be between 0 and 100.`);
  }
  return numeric;
}

/**
 * Validates an integer competency level in the schema's 1..5 range. When
 * `allowNull` is set, absent/null values pass through; otherwise they are a 400.
 */
export function requireLevel(
  value: unknown,
  field: string,
  { allowNull = false } = {}
): number | NextResponse {
  if (value === undefined || value === null) {
    if (allowNull) return null as unknown as number;
    return BAD_REQUEST_RESPONSE(`${field} is required.`);
  }
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < COMPETENCY_LEVEL_MIN ||
    value > COMPETENCY_LEVEL_MAX
  ) {
    return BAD_REQUEST_RESPONSE(
      `${field} must be an integer between ${COMPETENCY_LEVEL_MIN} and ${COMPETENCY_LEVEL_MAX}.`
    );
  }
  return value;
}

export function requireNonEmptyText(
  value: unknown,
  field: string,
  maxLength: number
): string | NextResponse {
  if (typeof value !== "string") {
    return BAD_REQUEST_RESPONSE(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return BAD_REQUEST_RESPONSE(`${field} is required.`);
  }
  if (trimmed.length > maxLength) {
    return BAD_REQUEST_RESPONSE(
      `${field} must be at most ${maxLength} characters.`
    );
  }
  return trimmed;
}

/**
 * Validates an OPTIONAL text value. Absent (undefined) → the `ABSENT` sentinel
 * so the caller can decide whether to keep an existing value; null → null
 * (clear); string → trimmed with empty collapsed to null.
 */
export function requireOptionalText(
  value: unknown,
  field: string,
  maxLength: number
): string | null | typeof ABSENT | NextResponse {
  if (value === undefined) return ABSENT;
  if (value === null) return null;
  if (typeof value !== "string") {
    return BAD_REQUEST_RESPONSE(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    return BAD_REQUEST_RESPONSE(
      `${field} must be at most ${maxLength} characters.`
    );
  }
  return trimmed || null;
}

/**
 * Validates an OPTIONAL non-negative integer. With `optional`, absent → the
 * `ABSENT` sentinel and null → null; otherwise absent/null are a 400. Negative
 * or non-integer values are always a 400.
 */
export function requireNonNegativeInteger(
  value: unknown,
  field: string,
  options: { optional?: boolean } = {}
): number | null | typeof ABSENT | NextResponse {
  if (options.optional) {
    if (value === undefined) return ABSENT;
  }
  if (value === null) {
    if (options.optional) return null;
    return BAD_REQUEST_RESPONSE(`${field} must be an integer.`);
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return BAD_REQUEST_RESPONSE(
      `${field} must be a non-negative integer${options.optional ? ", or null" : ""}.`
    );
  }
  return value;
}

/**
 * Validates an OPTIONAL signed integer (positive, negative, or zero).
 * With `optional`, absent → the `ABSENT` sentinel and null → null;
 * otherwise absent/null are a 400. Non-integer values are always a 400.
 */
export function requireSignedInteger(
  value: unknown,
  field: string,
  options: { optional?: boolean } = {}
): number | null | typeof ABSENT | NextResponse {
  if (options.optional) {
    if (value === undefined) return ABSENT;
  }
  if (value === null) {
    if (options.optional) return null;
    return BAD_REQUEST_RESPONSE(`${field} must be an integer.`);
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return BAD_REQUEST_RESPONSE(
      `${field} must be an integer${options.optional ? ", or null" : ""}.`
    );
  }
  return value;
}
