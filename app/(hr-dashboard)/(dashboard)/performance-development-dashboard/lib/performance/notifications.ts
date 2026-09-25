import "server-only";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { getAuthenticatedActor } from "@/performance-development-dashboard/lib/auth/actor";
import { requireValidUuid } from "@/performance-development-dashboard/lib/performance/validation";
import type {
  PerDevNotification,
  PerDevNotificationType,
} from "@/performance-development-dashboard/types";

/**
 * PerDev notification service.
 *
 * Dedicated notification infrastructure for Performance Development workflow
 * events. Isolated from the Supply Chain `notifications` table.
 *
 * Recipient-based targeting: each notification is addressed to a specific
 * employee via `recipient_employee_id`. The authenticated recipient is
 * resolved server-side through the existing PerDev identity chain.
 *
 * Notification creation is server-side only. Client endpoints can only read
 * and mark read — they cannot create notifications.
 */

const NOTIFICATION_SELECT =
  "id, recipient_employee_id, actor_employee_id, actor_hr_admin_id, title, message, type, link, entity_id, is_read, read_at, created_at";

/* ------------------------------------------------------------------ */
/*  Read operations (used by API routes)                                */
/* ------------------------------------------------------------------ */

/**
 * Lists notifications for the authenticated employee, most recent first.
 */
export async function listNotifications(): Promise<
  PerDevNotification[] | NextResponse
> {
  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  if (!actor.employeeUuid) {
    return NextResponse.json(
      { error: "No linked employee identity found." },
      { status: 403 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_notifications")
    .select(NOTIFICATION_SELECT)
    .eq("recipient_employee_id", actor.employeeUuid)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("listNotifications: query error:", error);
    return NextResponse.json(
      { error: "Failed to load notifications" },
      { status: 500 },
    );
  }

  return (data ?? []) as PerDevNotification[];
}

/**
 * Returns the unread notification count for the authenticated employee.
 */
export async function getUnreadCount(): Promise<number | NextResponse> {
  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  if (!actor.employeeUuid) {
    return 0;
  }

  const { count, error } = await supabaseAdmin
    .from("hr3_performance_notifications")
    .select("*", { count: "exact", head: true })
    .eq("recipient_employee_id", actor.employeeUuid)
    .eq("is_read", false);

  if (error) {
    console.error("getUnreadCount: query error:", error);
    return 0;
  }

  return count ?? 0;
}

/**
 * Marks a single notification as read. Only the recipient may mark their
 * own notification read.
 */
export async function markNotificationRead(
  notificationId: string,
): Promise<PerDevNotification | NextResponse> {
  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  if (!actor.employeeUuid) {
    return NextResponse.json(
      { error: "No linked employee identity found." },
      { status: 403 },
    );
  }

  const id = requireValidUuid(notificationId, "notification id");
  if (id instanceof NextResponse) return id;

  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_notifications")
    .update({ is_read: true, read_at: now })
    .eq("id", id)
    .eq("recipient_employee_id", actor.employeeUuid)
    .select(NOTIFICATION_SELECT)
    .maybeSingle();

  if (error) {
    console.error("markNotificationRead: update error:", error);
    return NextResponse.json(
      { error: "Failed to mark notification as read" },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Notification not found" },
      { status: 404 },
    );
  }

  return data as PerDevNotification;
}

/**
 * Marks all unread notifications as read for the authenticated employee.
 */
export async function markAllNotificationsRead(): Promise<
  { updated: number } | NextResponse
> {
  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  if (!actor.employeeUuid) {
    return { updated: 0 };
  }

  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_notifications")
    .update({ is_read: true, read_at: now })
    .eq("recipient_employee_id", actor.employeeUuid)
    .eq("is_read", false)
    .select("id");

  if (error) {
    console.error("markAllNotificationsRead: update error:", error);
    return NextResponse.json(
      { error: "Failed to mark all notifications as read" },
      { status: 500 },
    );
  }

  return { updated: (data ?? []).length };
}

/* ------------------------------------------------------------------ */
/*  Write operations (server-side only)                                 */
/* ------------------------------------------------------------------ */

export type CreatePerDevNotificationInput = {
  recipient_employee_id: string;
  actor_employee_id?: string | null;
  actor_hr_admin_id?: string | null;
  title: string;
  message: string;
  type: PerDevNotificationType;
  link?: string | null;
  entity_id?: string | null;
};

/**
 * Creates notifications for multiple recipients in a single batch.
 * Deduplicates recipients (e.g. if actor == recipient, the notification is
 * skipped unless explicitly intended).
 *
 * Best-effort: failures are logged but do NOT throw.
 */
export async function createNotifications(
  inputs: CreatePerDevNotificationInput[],
): Promise<void> {
  if (inputs.length === 0) return;

  const rows = inputs
    .filter((input) => {
      if (!input.recipient_employee_id) return false;
      if (
        input.actor_employee_id &&
        input.actor_employee_id === input.recipient_employee_id
      ) {
        return false;
      }
      return true;
    })
    .map((input) => ({
      recipient_employee_id: input.recipient_employee_id,
      actor_employee_id: input.actor_employee_id ?? null,
      actor_hr_admin_id: input.actor_hr_admin_id ?? null,
      title: input.title,
      message: input.message,
      type: input.type,
      link: input.link ?? null,
      entity_id: input.entity_id ?? null,
    }));

  if (rows.length === 0) return;

  const { error } = await supabaseAdmin
    .from("hr3_performance_notifications")
    .insert(rows);

  if (error) {
    console.error("createNotifications: batch insert error:", error);
  }
}
