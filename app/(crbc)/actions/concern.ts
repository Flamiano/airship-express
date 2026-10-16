"use server";

import { createClient } from "../library/supabase/server";
import { getCurrentUser } from "../library/auth/getCurrentUser";
import { recordAudit } from "../services/audit.service";
import type { Concern, ConcernUpdate, ConcernInternalNote, ConcernTimelineEntry } from "../types/concern";

export interface CreateConcernInput {
  subject: string;
  description: string;
  category: "delivery" | "wrong_item" | "damaged" | "billing" | "other";
  shipmentId?: string;
}

export interface CreateConcernResult {
  success: boolean;
  concern?: Concern;
  error?: string;
}

export async function createConcern(input: CreateConcernInput): Promise<CreateConcernResult> {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.profile.role !== "customer" || !currentUser.customer) {
    return { success: false, error: "Unauthorized. Only authenticated customers can submit concerns." };
  }

  const customerId = currentUser.customer.id;

  // Validate input
  if (!input.subject?.trim()) {
    return { success: false, error: "Subject is required." };
  }
  if (!input.description?.trim()) {
    return { success: false, error: "Description is required." };
  }

  // Validate category
  const validCategories = ["delivery", "wrong_item", "damaged", "billing", "other"] as const;
  if (!validCategories.includes(input.category as typeof validCategories[number])) {
    return { success: false, error: "Invalid category." };
  }

  let shipmentUuid: string | null = null;
  let referenceNote = "";
  const ref = input.shipmentId?.trim();
  if (ref) {
    const { data: linked } = await supabase
      .from("booking_requests")
      .select("id")
      .eq("request_id", ref)
      .eq("customer_id", customerId)
      .maybeSingle();
    shipmentUuid = linked?.id ?? null;
    if (!shipmentUuid) {
      referenceNote = `\n\n[Customer-provided shipment reference: ${ref}]`;
    }
  }

  // Determine initial priority based on category
  const priorityMap: Record<string, "high" | "medium" | "low"> = {
    delivery: "high",
    damaged: "high",
    wrong_item: "medium",
    billing: "low",
    other: "low",
  };
  const priority = priorityMap[input.category] ?? "low";

  // Insert concern
  const { data: concern, error: concernError } = await supabase
    .from("concerns")
    .insert({
      customer_id: customerId,
      subject: input.subject.trim(),
      description: input.description.trim() + referenceNote,
      category: input.category,
      priority,
      shipment_id: shipmentUuid,
    })
    .select("*")
    .single();

  if (concernError || !concern) {
    console.error("Create concern error:", concernError);
    return { success: false, error: "Failed to create concern. Please try again." };
  }

  // Create timeline entry
  await supabase
    .from("concern_timeline")
    .insert({
      concern_id: concern.id,
      type: "created",
      author_id: currentUser.profile.id,
      text: `Concern ${concern.concern_number} submitted by ${currentUser.profile.full_name ?? currentUser.profile.email}.`,
    });

  // Audit log
  await recordAudit({
    action: "concern.created",
    targetType: "customer",
    targetId: concern.id,
    description: `Concern ${concern.concern_number} created`,
    metadata: { concern_number: concern.concern_number, category: input.category },
  });

  // TODO: Trigger notification to staff (extend notification.service.ts)
  // For now, concern is created and will appear in staff list

  return { success: true, concern: concern as Concern };
}

export interface GetCustomerConcernsResult {
  concerns: Concern[];
  error?: string;
}

type SupabaseAuthorRow = { id: string; full_name: string | null; email: string | null } | null;
type SupabaseUpdateRow = { id: string; text: string; created_at: string; author: SupabaseAuthorRow };
type SupabaseNoteRow   = { id: string; text: string; created_at: string; author: SupabaseAuthorRow };
type SupabaseTimelineRow = { id: string; type: string; text: string; metadata: Record<string, unknown> | null; created_at: string; author: SupabaseAuthorRow };

export async function getCustomerConcerns(): Promise<GetCustomerConcernsResult> {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.profile.role !== "customer" || !currentUser.customer) {
    return { concerns: [], error: "Unauthorized" };
  }

  const customerId = currentUser.customer.id;

  const { data: concerns, error } = await supabase
    .from("concerns")
    .select(`
      *,
      concern_updates (
        id,
        text,
        created_at,
        author:profiles!concern_updates_author_id_fkey ( id, full_name, email )
      ),
      concern_timeline (
        id,
        type,
        text,
        metadata,
        created_at,
        author:profiles!concern_timeline_author_id_fkey ( id, full_name, email )
      )
    `)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Get customer concerns error:", error);
    return { concerns: [], error: "Failed to load concerns." };
  }

  // Transform to include nested data
  const transformed = (concerns ?? []).map(c => ({
    ...c,
    customerUpdates: (c.concern_updates ?? []).map((u: SupabaseUpdateRow) => ({
      id: u.id,
      author: u.author?.full_name ?? u.author?.email ?? "Staff",
      text: u.text,
      time: u.created_at,
    })),
    timeline: (c.concern_timeline ?? [])
      .filter((t: SupabaseTimelineRow) => t.type !== "internal_note")
      .map((t: SupabaseTimelineRow) => ({
        id: t.id,
        type: t.type,
        text: t.text,
        time: t.created_at,
        author: t.author?.full_name ?? t.author?.email ?? "System",
        metadata: t.metadata,
      })),
  })) as Concern[];

  return { concerns: transformed };
}

export interface GetConcernDetailResult {
  concern: Concern | null;
  error?: string;
}

export async function getConcernDetail(concernId: string): Promise<GetConcernDetailResult> {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { concern: null, error: "Unauthorized" };
  }

  let query = supabase
    .from("concerns")
    .select(`
      *,
      customer:customers!concerns_customer_id_fkey ( id, customer_id, full_name, email, phone ),
      shipment:booking_requests!concerns_shipment_id_fkey ( id, request_id, status ),
      assigned_to_profile:profiles!concerns_assigned_to_fkey ( id, full_name, email ),
      concern_updates (
        id,
        text,
        created_at,
        author:profiles!concern_updates_author_id_fkey ( id, full_name, email )
      ),
      concern_timeline (
        id,
        type,
        text,
        metadata,
        created_at,
        author:profiles!concern_timeline_author_id_fkey ( id, full_name, email )
      ),
      concern_internal_notes (
        id,
        text,
        created_at,
        author:profiles!concern_internal_notes_author_id_fkey ( id, full_name, email )
      )
    `)
    .eq("id", concernId);

  // Customer can only see their own concerns
  if (currentUser.profile.role === "customer") {
    if (!currentUser.customer) {
      return { concern: null, error: "Customer profile not found." };
    }
    query = query.eq("customer_id", currentUser.customer.id);
  }

  const { data: concern, error } = await query.maybeSingle();

  if (error || !concern) {
    return { concern: null, error: "Concern not found or access denied." };
  }

  // Transform
  const transformed: Concern = {
    ...concern,
    customerUpdates: (concern.concern_updates ?? []).map((u: SupabaseUpdateRow) => ({
      id: u.id,
      author: u.author?.full_name ?? u.author?.email ?? "Staff",
      text: u.text,
      time: u.created_at,
    })),
    internalNotes: currentUser.profile.role !== "customer" ? (concern.concern_internal_notes ?? []).map((n: SupabaseNoteRow) => ({
      id: n.id,
      author: n.author?.full_name ?? n.author?.email ?? "Staff",
      text: n.text,
      time: n.created_at,
    })) : [],
    timeline: (concern.concern_timeline ?? [])
      .filter((t: SupabaseTimelineRow) => currentUser.profile.role !== "customer" || t.type !== "internal_note")
      .map((t: SupabaseTimelineRow) => ({
        id: t.id,
        type: t.type,
        text: t.text,
        time: t.created_at,
        author: t.author?.full_name ?? t.author?.email ?? "System",
        metadata: t.metadata,
      })),
  };

  return { concern: transformed };
}

export interface UpdateConcernInput {
  status?: "open" | "in_progress" | "resolved" | "closed";
  priority?: "high" | "medium" | "low";
  assignedTo?: string | null;
  resolutionNotes?: string;
}

export interface UpdateConcernResult {
  success: boolean;
  concern?: Concern;
  error?: string;
}

export async function updateConcern(concernId: string, input: UpdateConcernInput): Promise<UpdateConcernResult> {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();

  if (!currentUser || !["staff", "admin", "super_admin"].includes(currentUser.profile.role)) {
    return { success: false, error: "Unauthorized. Staff access required." };
  }

  // Get current concern for comparison
  const { data: currentConcern, error: fetchError } = await supabase
    .from("concerns")
    .select("*")
    .eq("id", concernId)
    .single();

  if (fetchError || !currentConcern) {
    return { success: false, error: "Concern not found." };
  }

  const updates: Record<string, string | number | boolean | null> = {};
  const timelineEntries: Array<{ type: string; text: string; metadata?: Record<string, unknown> }> = [];

  if (input.status && input.status !== currentConcern.status) {
    updates.status = input.status;
    const statusLabels: Record<string, string> = {
      open: "Open",
      in_progress: "In Progress",
      resolved: "Resolved",
      closed: "Closed",
    };
    timelineEntries.push({
      type: "status_changed",
      text: `Status changed from ${statusLabels[currentConcern.status]} to ${statusLabels[input.status]}.`,
      metadata: { from: currentConcern.status, to: input.status },
    });

    if (input.status === "resolved") {
      updates.resolved_at = new Date().toISOString();
      if (!input.resolutionNotes) {
        return { success: false, error: "Resolution notes are required when resolving a concern." };
      }
      updates.resolution_notes = input.resolutionNotes;
      timelineEntries.push({
        type: "resolved",
        text: `Concern resolved: ${input.resolutionNotes}`,
        metadata: { resolution_notes: input.resolutionNotes },
      });
    }

    if (input.status === "closed") {
      updates.closed_at = new Date().toISOString();
      timelineEntries.push({
        type: "closed",
        text: "Concern closed.",
      });
    }
  }

  if (input.priority && input.priority !== currentConcern.priority) {
    updates.priority = input.priority;
    timelineEntries.push({
      type: "status_changed",
      text: `Priority changed from ${currentConcern.priority} to ${input.priority}.`,
      metadata: { from: currentConcern.priority, to: input.priority },
    });
  }

  if (input.assignedTo !== undefined && input.assignedTo !== currentConcern.assigned_to) {
    updates.assigned_to = input.assignedTo;
    if (input.assignedTo) {
      const { data: assignee } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", input.assignedTo)
        .single();
      timelineEntries.push({
        type: "assigned",
        text: `Assigned to ${assignee?.full_name ?? assignee?.email ?? "staff member"}.`,
        metadata: { assignee_id: input.assignedTo },
      });
    } else {
      timelineEntries.push({
        type: "assigned",
        text: "Assignment removed.",
        metadata: { assignee_id: null },
      });
    }
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("concerns")
      .update(updates)
      .eq("id", concernId)
      .select("*")
      .single();

    if (updateError) {
      console.error("Update concern error:", updateError);
      return { success: false, error: "Failed to update concern." };
    }

    // Insert timeline entries
    if (timelineEntries.length > 0) {
      await supabase
        .from("concern_timeline")
        .insert(
          timelineEntries.map(t => ({
            concern_id: concernId,
            author_id: currentUser.profile.id,
            ...t,
          }))
        );
    }

    // Audit log
    await recordAudit({
      action: "concern.updated",
      targetType: "customer",
      targetId: concernId,
      description: `Concern updated`,
      metadata: { changes: updates },
    });

    // Trigger customer notification for status changes or customer updates
    try {
      const { data: concernForNotification } = await supabase
        .from("concerns")
        .select("customer_id, subject, concern_number, status, updated_at")
        .eq("id", concernId)
        .single();

      if (concernForNotification) {
        const { data: customerProfile } = await supabase
          .from("customers")
          .select("auth_user_id")
          .eq("id", concernForNotification.customer_id)
          .single();

        if (customerProfile?.auth_user_id) {
          // Re-fetch notifications for this customer to ensure they're up to date
          // The notification service generates them on-the-fly from concern data
          // No additional action needed here - notifications are derived from concern state
        }
      }
    } catch (notificationError) {
      console.error("Failed to trigger concern notification:", notificationError);
      // Non-blocking - don't fail the update if notification fails
    }

    return { success: true, concern: updated as Concern };
  }

  return { success: true, concern: currentConcern as Concern };
}

export interface AddCustomerUpdateInput {
  concernId: string;
  text: string;
}

export async function addCustomerUpdate(input: AddCustomerUpdateInput): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();

  if (!currentUser || !["staff", "admin", "super_admin"].includes(currentUser.profile.role)) {
    return { success: false, error: "Unauthorized. Staff access required." };
  }

  const { error } = await supabase
    .from("concern_updates")
    .insert({
      concern_id: input.concernId,
      author_id: currentUser.profile.id,
      text: input.text.trim(),
    });

  if (error) {
    console.error("Add customer update error:", error);
    return { success: false, error: "Failed to add update." };
  }

  // Timeline entry
  await supabase
    .from("concern_timeline")
    .insert({
      concern_id: input.concernId,
      type: "customer_update",
      author_id: currentUser.profile.id,
      text: `Customer update posted: ${input.text.trim()}`,
    });

  // Audit
  await recordAudit({
    action: "concern.customer_update.created",
    targetType: "customer",
    targetId: input.concernId,
    description: `Customer update added to concern`,
    metadata: { text: input.text },
  });

  // Trigger customer notification for customer update
  try {
    const { data: concernForNotification } = await supabase
      .from("concerns")
      .select("customer_id, subject, concern_number, updated_at")
      .eq("id", input.concernId)
      .single();

    if (concernForNotification) {
      const { data: customerProfile } = await supabase
        .from("customers")
        .select("auth_user_id")
        .eq("id", concernForNotification.customer_id)
        .single();

      if (customerProfile?.auth_user_id) {
        // Notification is derived from concern state - no action needed
      }
    }
  } catch (notificationError) {
    console.error("Failed to trigger concern notification:", notificationError);
  }

  return { success: true };
}

export interface AddInternalNoteInput {
  concernId: string;
  text: string;
}

export async function addInternalNote(input: AddInternalNoteInput): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();

  if (!currentUser || !["staff", "admin", "super_admin"].includes(currentUser.profile.role)) {
    return { success: false, error: "Unauthorized. Staff access required." };
  }

  const { error } = await supabase
    .from("concern_internal_notes")
    .insert({
      concern_id: input.concernId,
      author_id: currentUser.profile.id,
      text: input.text.trim(),
    });

  if (error) {
    console.error("Add internal note error:", error);
    return { success: false, error: "Failed to add internal note." };
  }

  // Timeline entry (staff only)
  await supabase
    .from("concern_timeline")
    .insert({
      concern_id: input.concernId,
      type: "internal_note",
      author_id: currentUser.profile.id,
      text: `Internal note: ${input.text.trim()}`,
    });

  // Audit
  await recordAudit({
    action: "concern.internal_note.created",
    targetType: "customer",
    targetId: input.concernId,
    description: `Internal note added to concern`,
    metadata: { text: input.text },
  });

  return { success: true };
}

export interface RequestInvestigationInput {
  concernId: string;
  notes: string;
}

export interface RequestInvestigationResult {
  success: boolean;
  alreadyPending?: boolean;
  error?: string;
}

export async function requestInvestigation(
  input: RequestInvestigationInput
): Promise<RequestInvestigationResult> {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();

  if (!currentUser || !["staff", "admin", "super_admin"].includes(currentUser.profile.role)) {
    return { success: false, error: "Unauthorized. Staff access required." };
  }

  if (!input.notes.trim()) {
    return { success: false, error: "Investigation notes are required." };
  }

  // Fetch concern + existing timeline to check for duplicate active referral
  const { data: concern, error: fetchError } = await supabase
    .from("concerns")
    .select("id, concern_number, subject, category, description, shipment_id, shipment:booking_requests!concerns_shipment_id_fkey(request_id)")
    .eq("id", input.concernId)
    .maybeSingle();

  if (fetchError || !concern) {
    return { success: false, error: "Concern not found." };
  }

  const { data: existingTimeline } = await supabase
    .from("concern_timeline")
    .select("id, type")
    .eq("concern_id", input.concernId)
    .eq("type", "investigation_requested");

  if (existingTimeline && existingTimeline.length > 0) {
    return { success: false, alreadyPending: true, error: "An investigation has already been requested for this concern." };
  }

  const shipmentRef = (concern.shipment as unknown as { request_id: string } | null)?.request_id ?? null;
  const staffName = currentUser.profile.full_name ?? currentUser.profile.email ?? "Staff";

  // Persist as timeline entry — no new table needed
  const { error: timelineError } = await supabase
    .from("concern_timeline")
    .insert({
      concern_id: input.concernId,
      type: "investigation_requested",
      author_id: currentUser.profile.id,
      text: `Investigation requested by ${staffName}.${
        shipmentRef ? ` Shipment reference: ${shipmentRef}.` : ""
      } Notes: ${input.notes.trim()}`,
      metadata: {
        notes: input.notes.trim(),
        requested_by: staffName,
        requested_by_id: currentUser.profile.id,
        requested_at: new Date().toISOString(),
        shipment_ref: shipmentRef,
        concern_number: concern.concern_number,
        category: concern.category,
      },
    });

  if (timelineError) {
    console.error("Request investigation error:", timelineError);
    return { success: false, error: "Failed to record investigation request." };
  }

  // Also add as internal note so it surfaces in the Internal Notes section
  await supabase
    .from("concern_internal_notes")
    .insert({
      concern_id: input.concernId,
      author_id: currentUser.profile.id,
      text: `[Investigation Requested] Referred to Freight Operations for investigation.${
        shipmentRef ? ` Shipment: ${shipmentRef}.` : ""
      } Notes: ${input.notes.trim()}`,
    });

  await recordAudit({
    action: "concern.updated",
    targetType: "customer",
    targetId: input.concernId,
    description: `Investigation requested for concern ${concern.concern_number}`,
    metadata: { shipment_ref: shipmentRef, notes: input.notes.trim() },
  });

  return { success: true };
}

export interface GetStaffConcernsResult {
  concerns: Concern[];
  error?: string;
}

export async function getStaffConcerns(filters?: {
  status?: string;
  priority?: string;
  assignedTo?: string;
  search?: string;
}): Promise<GetStaffConcernsResult> {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();

  if (!currentUser || !["staff", "admin", "super_admin"].includes(currentUser.profile.role)) {
    return { concerns: [], error: "Unauthorized. Staff access required." };
  }

  let query = supabase
    .from("concerns")
    .select(`
      *,
      customer:customers!concerns_customer_id_fkey ( id, customer_id, full_name, email ),
      assigned_to_profile:profiles!concerns_assigned_to_fkey ( id, full_name, email ),
      shipment:booking_requests!concerns_shipment_id_fkey ( id, request_id )
    `)
    .order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.priority && filters.priority !== "all") {
    query = query.eq("priority", filters.priority);
  }
  if (filters?.assignedTo === "me") {
    query = query.eq("assigned_to", currentUser.profile.id);
  } else if (filters?.assignedTo === "unassigned") {
    query = query.is("assigned_to", null);
  }
  if (filters?.search) {
    query = query.or(`subject.ilike.%${filters.search}%,concern_number.ilike.%${filters.search}%,customer.full_name.ilike.%${filters.search}%`);
  }

  const { data: concerns, error } = await query;

  if (error) {
    console.error("Get staff concerns error:", error);
    return { concerns: [], error: "Failed to load concerns." };
  }

  return { concerns: (concerns ?? []) as Concern[] };
}