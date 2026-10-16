import { createClient } from "../library/supabase/server";
import { isAnyStaff } from "../library/auth/rbac";


export type AuditAction =
  // Authentication
  | "auth.login"
  | "auth.logout"
  | "auth.login_failed"
  | "mfa.enabled"
  | "mfa.disabled"
  | "mfa.verified"
  // User management
  | "user.created"
  | "user.role_changed"
  | "user.activated"
  | "user.deactivated"
  // Business records
  | "booking.created"
  | "booking.status_changed"
  | "booking.cancelled"
  | "booking.updated"
  | "customer.created"
  | "customer.updated"
  | "sla_policy.created"
  | "sla_policy.updated"
  | "sla_policy.deleted"
  | "compliance.reviewed"
  // Concerns
  | "concern.created"
  | "concern.updated"
  | "concern.status_changed"
  | "concern.resolved"
  | "concern.closed"
  | "concern.customer_update.created"
  | "concern.internal_note.created";

export type AuditTargetType =
  | "profile"
  | "booking_request"
  | "customer"
  | "delivery_policy"
  | "compliance_record"
  | "session";

export type AuditEntry = {
  action: AuditAction;
  targetType?: AuditTargetType;
  targetId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
};


export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: actorProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!isAnyStaff(actorProfile?.role)) return;

    const { error } = await supabase.from("audit_logs").insert({
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      description: entry.description ?? null,
      metadata: entry.metadata ?? null,
      ip_address: null,
      user_agent: null,
    });

    if (error) {
      console.error("Audit write failed:", error.message);
    }
  } catch (error) {
    console.error(
      "Audit write threw:",
      error instanceof Error ? error.message : error
    );
  }
}