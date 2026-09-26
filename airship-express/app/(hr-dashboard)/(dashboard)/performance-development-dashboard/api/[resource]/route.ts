import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import {
  ERROR_CODES,
  errorResponse,
  handle,
  internalError,
  validateJson,
  validateQuery,
  validationResponse,
} from "../lib/validate";
import { getAuthenticatedHrUser, requireHrAdmin } from "../lib/auth";
import {
  getResourceConfig,
  type FkCheck,
  type PgErrorMap,
  type ResourceConfig,
} from "../lib/resource-config";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ resource: string }> };

function unknownResource(): NextResponse {
  return errorResponse(ERROR_CODES.NOT_FOUND, "Not found");
}

function methodNotAllowed(config: ResourceConfig): NextResponse {
  const allowed = [
    "GET",
    config.post && "POST",
    config.put && "PUT",
    config.del && "DELETE",
  ].filter(Boolean);
  return new NextResponse(null, {
    status: 405,
    headers: { Allow: allowed.join(", ") },
  });
}

function mappedPgError(
  errorMap: PgErrorMap | undefined,
  error: { code?: string }
): NextResponse | null {
  if (!errorMap || !error.code) return null;
  const mapped = errorMap[error.code];
  if (!mapped) return null;
  return errorResponse(mapped.code, mapped.message);
}

async function runFkChecks(
  body: Record<string, unknown>,
  fkChecks: FkCheck[]
): Promise<NextResponse | null> {
  for (const fk of fkChecks) {
    const value = body[fk.field];
    if (fk.when === "if-present" && !value) continue;

    const { data, error } = await supabaseAdmin
      .from(fk.table)
      .select("id")
      .eq("id", value as string)
      .maybeSingle();

    if (error) {
      return internalError(error);
    }

    if (!data) {
      return errorResponse(ERROR_CODES.NOT_FOUND, fk.message);
    }
  }
  return null;
}

export const GET = handle(async (_request: Request, context: RouteContext) => {
  const { resource } = await context.params;
  const config = getResourceConfig(resource);
  if (!config) return unknownResource();

  const auth =
    config.getAccess === "admin"
      ? await requireHrAdmin()
      : await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;

  let query = supabaseAdmin.from(config.table).select(config.select ?? "*");

  if (
    config.getAccess === "authenticated" &&
    config.getScope === "by-employee" &&
    !auth.user.isAdmin
  ) {
    if (!auth.user.employeeId) {
      return NextResponse.json({ [config.listKey]: [] });
    }
    query = query.eq("employee_id", auth.user.employeeId);
  }

  if (config.orderBy) {
    query = query.order(config.orderBy.column, {
      ascending: config.orderBy.ascending ?? false,
    });
  }

  const { data, error } = await query;

  if (error) {
    // #region agent log
    fetch("http://127.0.0.1:7412/ingest/0eaccd84-c262-43ee-a949-541d824d3d38", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "994ee8",
      },
      body: JSON.stringify({
        sessionId: "994ee8",
        runId: "pre-fix",
        hypothesisId: "G",
        location: "api/[resource]/route.ts:GET-error",
        message: "resource GET failed",
        data: {
          resource,
          table: config.table,
          select: config.select ?? "*",
          pgCode: error.code,
          pgMessage: error.message,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return internalError(error);
  }

  return NextResponse.json({ [config.listKey]: data ?? [] });
});

export const POST = handle(async (request: Request, context: RouteContext) => {
  const { resource } = await context.params;
  const config = getResourceConfig(resource);
  if (!config) return unknownResource();
  const post = config.post;
  if (!post) return methodNotAllowed(config);

  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;
  const actor = admin.user;

  if (post.profileRequired && !actor.employeeId) {
    return errorResponse(
      ERROR_CODES.EMPLOYEE_PROFILE_REQUIRED,
      "Your account is not linked to an employee profile yet. Contact HR."
    );
  }

  const parsed = await validateJson(request, post.schema);
  if (!parsed.ok) {
    return parsed.response;
  }
  const body = parsed.value;

  const fkFailure = await runFkChecks(body, post.fkChecks ?? []);
  if (fkFailure) {
    return fkFailure;
  }

  const payload = post.toInsert(body, actor.employeeId ?? null);

  const { data, error } = await supabaseAdmin
    .from(config.table)
    .insert(payload)
    .select();

  if (error) {
    const mapped = mappedPgError(post.errorMap, error);
    if (mapped) return mapped;
    return internalError(error);
  }

  const created = data?.[0] as Record<string, unknown> | undefined;

  if (
    resource === "sessions" &&
    body.session_type === "mandatory" &&
    body.auto_enroll === true &&
    created
  ) {
    const sessionId = created.id as string;
    const capacity = created.capacity as number | null;

    const { data: activeEmployees, error: empError } = await supabaseAdmin
      .from("hr1_employees")
      .select("id")
      .eq("status", "active");

    if (empError) {
      return internalError(empError);
    }

    const employees = (activeEmployees ?? []) as Array<{ id: string }>;

    if (capacity !== null && capacity !== undefined && employees.length > capacity) {
      return errorResponse(
        ERROR_CODES.CONFLICT,
        `Cannot auto-enroll ${employees.length} employees: session capacity is ${capacity}. Increase capacity or uncheck auto-enroll.`
      );
    }

    if (employees.length > 0) {
      const { data: existingEnrollments } = await supabaseAdmin
        .from("hr3_training_enrollments")
        .select("employee_id")
        .eq("session_id", sessionId);

      const existingIds = new Set(
        (existingEnrollments ?? []).map((e) => (e as { employee_id: string }).employee_id)
      );

      const newEnrollments = employees
        .filter((emp) => !existingIds.has(emp.id))
        .map((emp) => ({
          employee_id: emp.id,
          session_id: sessionId,
          approval_status: "approved",
          approved_by: actor.employeeId ?? null,
          attendance_status: null,
        }));

      if (newEnrollments.length > 0) {
        const { error: enrollError } = await supabaseAdmin
          .from("hr3_training_enrollments")
          .insert(newEnrollments);

        if (enrollError) {
          return internalError(enrollError);
        }
      }
    }
  }

  return NextResponse.json({ [config.itemKey]: created }, { status: 201 });
});

export const PUT = handle(async (request: Request, context: RouteContext) => {
  const { resource } = await context.params;
  const config = getResourceConfig(resource);
  if (!config) return unknownResource();
  const put = config.put;
  if (!put) return methodNotAllowed(config);

  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const parsed = await validateJson(request, put.schema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const payload = put.toUpdate(body, admin.user.employeeId ?? null);

  const { data, error } = await supabaseAdmin
    .from(config.table)
    .update(payload)
    .eq("id", body.id as string)
    .select();

  if (error) {
    const mapped = mappedPgError(put.errorMap, error);
    if (mapped) return mapped;
    return internalError(error);
  }

  if (!data || data.length === 0) {
    return errorResponse(ERROR_CODES.NOT_FOUND, put.notFoundMessage);
  }

  return NextResponse.json({ [config.itemKey]: data[0] });
});

export const DELETE = handle(async (
  request: Request,
  context: RouteContext
) => {
  const { resource } = await context.params;
  const config = getResourceConfig(resource);
  if (!config) return unknownResource();
  const del = config.del;
  if (!del) return methodNotAllowed(config);

  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const errors = validateQuery(request.url, del.schema);
  if (errors.length > 0) return validationResponse(errors);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")!;

  const { data, error } = await supabaseAdmin
    .from(config.table)
    .delete()
    .eq("id", id)
    .select();

  if (error) {
    const mapped = mappedPgError(del.errorMap, error);
    if (mapped) return mapped;
    return internalError(error);
  }

  if (!data || data.length === 0) {
    return errorResponse(ERROR_CODES.NOT_FOUND, del.notFoundMessage);
  }

  return NextResponse.json({ success: true });
});
