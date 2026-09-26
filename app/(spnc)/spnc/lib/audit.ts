import { SESSION_COOKIE_NAME, verifySessionToken } from "./session";
import { getSupabaseClient } from "./supabase";

export type AuditEventType = "login" | "logout" | "session_timeout" | "user_activity" | "archive";

export type LogAuditEventInput = {
  eventType: AuditEventType;
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  request?: Request;
};

export async function getAuditActor(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((cookie) => cookie.trim().split("="))
    .find(([name]) => name === SESSION_COOKIE_NAME)?.[1];
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  return {
    actorId: session.userId,
    actorName: session.full_name,
    actorRole: session.role || null,
  };
}

function getClientIp(request?: Request) {
  if (!request) return null;

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const rawIp =
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("true-client-ip")?.trim() ||
    forwarded ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-client-ip")?.trim() ||
    null;

  if (!rawIp) return null;
  if (rawIp === "::1") return "127.0.0.1";
  if (rawIp.startsWith("::ffff:")) return rawIp.slice(7);
  return rawIp.replace(/^[\[]|[\]]$/g, "");
}

export async function logAuditEvent(input: LogAuditEventInput) {
  try {
    const { error } = await getSupabaseClient().from("audit_logs").insert({
      event_type: input.eventType,
      actor_id: input.actorId ?? null,
      actor_name: input.actorName ?? null,
      actor_role: input.actorRole ?? null,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      metadata: input.metadata ?? null,
      ip_address: getClientIp(input.request),
      user_agent: input.request?.headers.get("user-agent") || null,
    });

    if (error) console.error("Failed to write audit log:", error);
  } catch (error) {
    console.error("Audit logging error:", error);
  }
}
