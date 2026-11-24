import { NextResponse } from "next/server";
import { hasPermission } from "../../lib/permissions";
import { authenticateFtmRequest } from "../../lib/server/ftmRequestAuth";
import { belongsToAirshipCourier, getAirshipCouriers } from "../../lib/server/ftmCourier";
import { isOperationalTrip } from "../../lib/parcelTypes";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const MAINTENANCE_STATUSES = new Set(["scheduled", "in_progress", "completed", "cancelled"]);
const MAINTENANCE_PRIORITIES = new Set(["low", "normal", "high", "urgent"]);
const RECURRENCE_RULES = new Set(["none", "weekly", "monthly"]);

async function getAirshipVehicleIds(supabase: SupabaseClient): Promise<Set<string>> {
  const couriers = await getAirshipCouriers(supabase);
  const courierIds = new Set<string>(couriers.map((courier) => courier.id));
  if (!courierIds.size) return new Set<string>();
  const { data, error } = await supabase.from("vehicles").select("id,courier_id").in("courier_id", [...courierIds]);
  if (error) throw new Error(`Unable to validate maintenance vehicle scope: ${error.message}`);
  return new Set<string>((data || []).filter((vehicle: Record<string, unknown>) => belongsToAirshipCourier(vehicle, courierIds)).map((vehicle: Record<string, unknown>) => String(vehicle.id)));
}

function normalizeRecord(body: Record<string, unknown>) {
  const scheduledAt = new Date(String(body.scheduled_at || ""));
  const durationMinutes = Number(body.duration_minutes ?? 60);
  const status = String(body.status || "scheduled").toLowerCase();
  const priority = String(body.priority || "normal").toLowerCase();
  const recurrenceRule = String(body.recurrence_rule || "none").toLowerCase();
  const laborCost = body.labor_cost === "" || body.labor_cost == null ? null : Number(body.labor_cost);
  const partsCost = body.parts_cost === "" || body.parts_cost == null ? null : Number(body.parts_cost);
  const hasCostBreakdown = body.labor_cost !== undefined || body.parts_cost !== undefined;
  const hasAnyCost = laborCost !== null || partsCost !== null;
  const cost = hasCostBreakdown
    ? hasAnyCost ? (laborCost || 0) + (partsCost || 0) : null
    : body.cost === "" || body.cost == null ? null : Number(body.cost);
  const odometerReading = body.odometer_reading === "" || body.odometer_reading == null ? null : Number(body.odometer_reading);
  const nextDueMileage = body.next_due_mileage === "" || body.next_due_mileage == null ? null : Number(body.next_due_mileage);
  const performedAt = body.performed_at !== undefined ? body.performed_at || null : null;
  if ([laborCost, partsCost, odometerReading, nextDueMileage].some((value) => value !== null && (!Number.isFinite(value) || value < 0))) {
    return { error: "Costs and mileage values must be non-negative numbers." };
  }
  if (body.inspection_results != null && !Array.isArray(body.inspection_results)) {
    return { error: "Inspection results must be a list of checklist items." };
  }
  if (body.replaced_parts != null && !Array.isArray(body.replaced_parts)) {
    return { error: "Replaced parts must be a list." };
  }
  if (Array.isArray(body.replaced_parts) && body.replaced_parts.some((part: Record<string, unknown>) =>
    !String(part.name || "").trim()
    || !Number.isFinite(Number(part.quantity))
    || Number(part.quantity) <= 0
    || (part.unit_cost != null && (!Number.isFinite(Number(part.unit_cost)) || Number(part.unit_cost) < 0)))) {
    return { error: "Each replaced part needs a name, a positive quantity, and a valid optional unit cost." };
  }
  if (Array.isArray(body.inspection_results) && body.inspection_results.some((item: Record<string, unknown>) =>
    !String(item.item || "").trim() || !["pass", "attention", "not_checked"].includes(String(item.result)))) {
    return { error: "Each inspection result needs an item and a valid result." };
  }
  if (status === "completed" && !String(body.work_performed || "").trim()) {
    return { error: "Record the work performed before completing this maintenance." };
  }

  if (!body.vehicle_id || !body.maintenance_type || !Number.isFinite(scheduledAt.getTime())) {
    return { error: "Vehicle, maintenance type, and a valid scheduled date/time are required." };
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 1440) {
    return { error: "Duration must be between 15 minutes and 24 hours." };
  }
  if (!MAINTENANCE_STATUSES.has(status) || !MAINTENANCE_PRIORITIES.has(priority) || !RECURRENCE_RULES.has(recurrenceRule)) {
    return { error: "Maintenance status, priority, or recurrence option is invalid." };
  }
  if (cost !== null && (!Number.isFinite(cost) || cost < 0)) return { error: "Cost must be a non-negative number." };

  return {
    record: {
      vehicle_id: String(body.vehicle_id),
      maintenance_type: String(body.maintenance_type).trim(),
      ...(body.maintenance_category !== undefined ? { maintenance_category: body.maintenance_category ? String(body.maintenance_category).trim() : null } : {}),
      description: String(body.description || body.maintenance_type).trim(),
      cost,
      ...(hasCostBreakdown ? { labor_cost: laborCost, parts_cost: partsCost } : {}),
      performed_by: body.mechanic ? String(body.mechanic).trim() : null,
      performed_at: performedAt,
      next_due_date: body.next_due_date || null,
      ...(body.reported_issue !== undefined ? { reported_issue: body.reported_issue ? String(body.reported_issue).trim() : null } : {}),
      ...(body.diagnosis !== undefined ? { diagnosis: body.diagnosis ? String(body.diagnosis).trim() : null } : {}),
      ...(body.work_performed !== undefined ? { work_performed: body.work_performed ? String(body.work_performed).trim() : null } : {}),
      ...(body.inspection_results !== undefined ? { inspection_results: body.inspection_results } : {}),
      ...(body.replaced_parts !== undefined ? { replaced_parts: body.replaced_parts } : {}),
      ...(body.odometer_reading !== undefined ? { odometer_reading: odometerReading } : {}),
      ...(body.next_due_mileage !== undefined ? { next_due_mileage: nextDueMileage } : {}),
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: durationMinutes,
      mechanic: body.mechanic ? String(body.mechanic).trim() : null,
      priority,
      status,
      recurrence_rule: recurrenceRule,
      recurrence_series_id: body.recurrence_series_id || null,
      is_automated: false,
      automation_key: body.automation_key || null,
      maintenance_source: "manual",
      notes: body.notes ? String(body.notes).trim() : null,
      updated_at: new Date().toISOString(),
    },
  };
}

async function findScheduleConflict(supabase: SupabaseClient, candidate: Record<string, unknown>, vehicleIds: Set<string>, excludeId?: string) {
  if (["completed", "cancelled"].includes(String(candidate.status || "").toLowerCase())) return null;
  if (!vehicleIds.size) return { error: "No Airship Express vehicles are available for maintenance scheduling." };
  const { data, error } = await supabase.from("maintenance_history").select("*").in("vehicle_id", [...vehicleIds]).limit(5000);
  if (error) return { error: error.message };

  const start = Date.parse(String(candidate.scheduled_at || ""));
  const end = start + Number(candidate.duration_minutes || 60) * 60_000;
  const candidateVehicleId = String(candidate.vehicle_id || "");
  const mechanic = String(candidate.mechanic || "").trim().toLowerCase();
  for (const existing of data || []) {
    if (excludeId && String(existing.id) === excludeId) continue;
    if (["completed", "cancelled"].includes(String(existing.status || "").toLowerCase())) continue;
    const existingStart = Date.parse(String(existing.scheduled_at || ""));
    const existingDuration = Number(existing.duration_minutes || 60);
    if (!Number.isFinite(existingStart)) continue;
    const overlaps = start < existingStart + existingDuration * 60_000 && existingStart < end;
    const sameVehicle = String(existing.vehicle_id) === candidateVehicleId;
    const sameMechanic = mechanic && mechanic === String(existing.mechanic || "").trim().toLowerCase();
    if (overlaps && (sameVehicle || sameMechanic)) {
      return {
        conflict: {
          id: existing.id,
          vehicle_id: existing.vehicle_id,
          mechanic: existing.mechanic,
          scheduled_at: existing.scheduled_at,
          reason: sameVehicle && sameMechanic ? "vehicle and mechanic" : sameVehicle ? "vehicle" : "mechanic",
        },
      };
    }
  }
  return null;
}

async function canStartMaintenance(supabase: SupabaseClient, vehicleId: string, excludeId?: string) {
  const { data: trips, error: tripError } = await supabase.from("trips").select("id,status").eq("vehicle_id", vehicleId);
  if (tripError) return { error: `Unable to verify active trips: ${tripError.message}` };
  if ((trips || []).some((trip: Record<string, unknown>) => isOperationalTrip({ id: String(trip.id || ""), status: String(trip.status || "") }))) {
    return { error: "Maintenance cannot start while the vehicle is assigned to an active trip." };
  }
  let query = supabase.from("maintenance_history").select("id").eq("vehicle_id", vehicleId).eq("status", "in_progress").limit(1);
  if (excludeId) query = query.neq("id", excludeId);
  const { data: activeMaintenance, error: maintenanceError } = await query;
  if (maintenanceError) return { error: `Unable to verify current maintenance: ${maintenanceError.message}` };
  if (activeMaintenance?.length) return { error: "Another maintenance job is already in progress for this vehicle." };
  return { error: null };
}

async function syncVehicleMaintenanceStatus(supabase: SupabaseClient, vehicleId: string, maintenanceStatus: string): Promise<string | null> {
  const { data: vehicle, error: vehicleError } = await supabase.from("vehicles").select("id,status").eq("id", vehicleId).maybeSingle();
  if (vehicleError || !vehicle) return vehicleError ? `Maintenance saved, but vehicle status could not be loaded: ${vehicleError.message}` : "Maintenance saved, but the linked vehicle was not found.";

  if (maintenanceStatus === "in_progress") {
    let update = await supabase.from("vehicles").update({ status: "Under Maintenance", availability: "under maintenance", assignment_status: "in_progress" }).eq("id", vehicleId);
    if (update.error && /assignment_status|column .* does not exist|schema cache/i.test(update.error.message)) {
      update = await supabase.from("vehicles").update({ status: "Under Maintenance", availability: "under maintenance" }).eq("id", vehicleId);
    }
    return update.error ? `Maintenance started, but vehicle status could not be updated: ${update.error.message}` : null;
  }

  if (!/maintenance|service|repair|out.of.service/i.test(String(vehicle.status || ""))) return null;
  const { data: activeMaintenance, error: maintenanceError } = await supabase.from("maintenance_history").select("id").eq("vehicle_id", vehicleId).eq("status", "in_progress").limit(1);
  if (maintenanceError) return `Work was saved, but remaining maintenance could not be checked: ${maintenanceError.message}`;
  if (activeMaintenance?.length) return null;
  const { data: trips, error: tripError } = await supabase.from("trips").select("id,status").eq("vehicle_id", vehicleId);
  if (tripError) return `Work was saved, but active trips could not be checked: ${tripError.message}`;
  if ((trips || []).some((trip: Record<string, unknown>) => isOperationalTrip({ id: String(trip.id || ""), status: String(trip.status || "") }))) return null;

  let update = await supabase.from("vehicles").update({ status: "Available", availability: "available", assignment_status: "available" }).eq("id", vehicleId);
  if (update.error && /assignment_status|column .* does not exist|schema cache/i.test(update.error.message)) {
    update = await supabase.from("vehicles").update({ status: "Available", availability: "available" }).eq("id", vehicleId);
  }
  return update.error ? `Work was saved, but the vehicle could not be released: ${update.error.message}` : null;
}

async function writeMaintenanceAudit(
  supabase: SupabaseClient,
  record: Record<string, unknown>,
  actorId: string,
  source: string,
  previous?: Record<string, unknown> | null,
  changedFields: string[] = [],
) {
  const { data: vehicle } = await supabase.from("vehicles").select("maintenance_attention_status,mileage").eq("id", String(record.vehicle_id || "")).maybeSingle();
  const eventKey = `${source}:${String(record.id || "")}:${String(record.updated_at || record.created_at || new Date().toISOString())}`;
  const { error } = await supabase.from("maintenance_automation_audit").insert({
    event_key: eventKey,
    vehicle_id: String(record.vehicle_id),
    source,
    source_id: String(record.id),
    actor_id: actorId,
    previous_odometer_km: previous?.odometer_reading ?? null,
    current_odometer_km: record.odometer_reading ?? vehicle?.mileage ?? null,
    interval_days: record.interval_days_snapshot ?? null,
    interval_km: record.interval_km_snapshot ?? null,
    next_due_date: record.next_due_date || null,
    next_due_mileage: record.next_due_mileage ?? null,
    attention_status: String(vehicle?.maintenance_attention_status || "unconfigured"),
    details: {
      maintenance_record_id: record.id ?? null,
      previous_status: previous?.status ?? null,
      current_status: record.status ?? null,
      changed_fields: changedFields,
      maintenance_type: record.maintenance_type,
      work_performed: record.work_performed || null,
    },
  });
  if (error && !/could not find the table|schema cache|relation .* does not exist/i.test(error.message)) {
    console.warn("Maintenance record saved but audit event could not be written:", error.message);
  }
  return error;
}

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (!hasPermission(auth.context.user.role, "fvm", "view")) {
    return NextResponse.json({ error: "Permission denied: fvm.view" }, { status: 403 });
  }
  let vehicleIds: Set<string>;
  try { vehicleIds = await getAirshipVehicleIds(auth.context.serviceClient); } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to validate maintenance vehicle scope." }, { status: 500 });
  }
  if (!vehicleIds.size) return NextResponse.json([]);
  const { data, error } = await auth.context.serviceClient.from("maintenance_history").select("*").in("vehicle_id", [...vehicleIds]).order("scheduled_at", { ascending: true, nullsFirst: false });
  if (error) {
    console.error("Supabase maintenance query error:", error.message);
    return NextResponse.json({ error: "Failed to fetch maintenance records" }, { status: 500 });
  }
  const reviewerIds = [...new Set((data || []).map((record) => record.cost_reviewed_by).filter(Boolean).map(String))];
  const { data: reviewers } = reviewerIds.length
    ? await auth.context.serviceClient.from("users").select("id,full_name,email").in("id", reviewerIds)
    : { data: [] };
  const reviewerById = new Map((reviewers || []).map((reviewer) => [String(reviewer.id), reviewer]));
  return NextResponse.json((data || []).map((record) => ({
    ...record,
    cost_review_status: record.cost_review_status || "pending",
    cost_reviewer_name: reviewerById.get(String(record.cost_reviewed_by || ""))?.full_name
      || reviewerById.get(String(record.cost_reviewed_by || ""))?.email
      || null,
  })));
}

export async function POST(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (!hasPermission(auth.context.user.role, "fvm", "create")) {
    return NextResponse.json({ error: "Permission denied: fvm.create" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  const normalized = normalizeRecord(body);
  if ("error" in normalized) return NextResponse.json({ error: normalized.error }, { status: 400 });
  let vehicleIds: Set<string>;
  try { vehicleIds = await getAirshipVehicleIds(auth.context.serviceClient); } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to validate maintenance vehicle scope." }, { status: 500 });
  }
  if (!vehicleIds.has(normalized.record.vehicle_id)) return NextResponse.json({ error: "Maintenance records can only be created for Airship Express vehicles." }, { status: 404 });
  if (normalized.record.status === "in_progress") {
    const startCheck = await canStartMaintenance(auth.context.serviceClient, normalized.record.vehicle_id);
    if (startCheck.error) return NextResponse.json({ error: startCheck.error }, { status: 409 });
  }
  const conflict = await findScheduleConflict(auth.context.serviceClient, normalized.record, vehicleIds);
  if (conflict?.error) return NextResponse.json({ error: `Unable to check schedule conflicts: ${conflict.error}` }, { status: 500 });
  if (conflict?.conflict) return NextResponse.json({ error: "This schedule overlaps another appointment for the same vehicle or mechanic.", conflict: conflict.conflict }, { status: 409 });
  const { data, error } = await auth.context.serviceClient.from("maintenance_history").insert([normalized.record]).select("*").single();
  if (error) {
    console.error("Supabase maintenance insert error:", error.message);
    return NextResponse.json({ error: "Failed to create maintenance record" }, { status: 500 });
  }
  const auditError = await writeMaintenanceAudit(auth.context.serviceClient, data, auth.context.user.id, "manual_maintenance_schedule", null, Object.keys(body));
  const vehicleStatusWarning = normalized.record.status === "in_progress"
    ? await syncVehicleMaintenanceStatus(auth.context.serviceClient, normalized.record.vehicle_id, normalized.record.status)
    : null;
  return NextResponse.json({ ...data, ...(vehicleStatusWarning ? { vehicle_status_warning: vehicleStatusWarning } : {}), ...(auditError && /could not find the table|schema cache|relation .* does not exist/i.test(auditError.message) ? { audit_warning: "Apply the maintenance automation migration to enable the audit trail." } : {}) });
}

export async function PATCH(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(auth.context.user.role, "fvm", "update")) {
    return NextResponse.json({ error: "Permission denied: fvm.update" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "A maintenance record id is required." }, { status: 400 });
  if (body.action === "review_cost") {
    if (!hasPermission(context.user.role, "costAnalysis", "update") || !hasPermission(context.user.role, "fvm", "update")) {
      return NextResponse.json({ error: "Permission denied: maintenance cost review requires costAnalysis.update and fvm.update." }, { status: 403 });
    }
    const reviewStatus = String(body.cost_review_status || "").toLowerCase();
    const reviewNotes = String(body.cost_review_notes || "").trim();
    if (!["approved", "rejected", "pending"].includes(reviewStatus)) {
      return NextResponse.json({ error: "cost_review_status must be approved, rejected, or pending." }, { status: 400 });
    }
    if (reviewStatus === "rejected" && !reviewNotes) {
      return NextResponse.json({ error: "A reason is required to reject a maintenance cost." }, { status: 400 });
    }
    const { data: existing, error: readError } = await context.serviceClient
      .from("maintenance_history")
      .select("id,vehicle_id,status,cost,labor_cost,parts_cost,cost_review_status")
      .eq("id", id)
      .maybeSingle();
    if (readError) return NextResponse.json({ error: `Unable to load maintenance cost: ${readError.message}` }, { status: 500 });
    if (!existing) return NextResponse.json({ error: "Maintenance record not found." }, { status: 404 });
    let vehicleIds: Set<string>;
    try { vehicleIds = await getAirshipVehicleIds(context.serviceClient); } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to validate maintenance vehicle scope." }, { status: 500 });
    }
    if (!vehicleIds.has(String(existing.vehicle_id))) return NextResponse.json({ error: "Maintenance record not found." }, { status: 404 });
    if (String(existing.status || "").toLowerCase() !== "completed") {
      return NextResponse.json({ error: "Only completed maintenance records can be cost-approved." }, { status: 409 });
    }
    const breakdownComplete = existing.labor_cost != null && existing.parts_cost != null;
    const amount = breakdownComplete
      ? Number(existing.labor_cost) + Number(existing.parts_cost)
      : existing.cost == null ? null : Number(existing.cost);
    if (reviewStatus === "approved" && (amount == null || !Number.isFinite(amount) || amount <= 0)) {
      return NextResponse.json({ error: "A recorded maintenance amount is required before approval." }, { status: 409 });
    }
    const { data, error } = await context.serviceClient.from("maintenance_history").update({
      cost_review_status: reviewStatus,
      cost_reviewed_by: context.user.id,
      cost_reviewed_at: new Date().toISOString(),
      cost_review_notes: reviewNotes || null,
    }).eq("id", id).select("*").single();
    if (error) return NextResponse.json({ error: `Unable to update maintenance cost review: ${error.message}` }, { status: 500 });
    return NextResponse.json(data);
  }
  const normalized = normalizeRecord(body);
  if ("error" in normalized) return NextResponse.json({ error: normalized.error }, { status: 400 });
  let vehicleIds: Set<string>;
  try { vehicleIds = await getAirshipVehicleIds(auth.context.serviceClient); } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to validate maintenance vehicle scope." }, { status: 500 });
  }
  if (!vehicleIds.has(normalized.record.vehicle_id)) return NextResponse.json({ error: "Maintenance records can only be updated for Airship Express vehicles." }, { status: 404 });
  const { data: existing, error: existingError } = await context.serviceClient.from("maintenance_history").select("id,vehicle_id,source_cost_entry_id,source_incident_id,is_automated,automation_key,maintenance_source,status,cost,labor_cost,parts_cost,cost_review_status,cost_reviewed_by,cost_reviewed_at,cost_review_notes,odometer_reading,scheduled_at,maintenance_type").eq("id", id).maybeSingle();
  if (existingError) return NextResponse.json({ error: `Unable to load maintenance record: ${existingError.message}` }, { status: 500 });
  if (!existing || !vehicleIds.has(String(existing.vehicle_id))) return NextResponse.json({ error: "Maintenance record not found." }, { status: 404 });
  if (normalized.record.status === "in_progress") {
    const startCheck = await canStartMaintenance(auth.context.serviceClient, normalized.record.vehicle_id, id);
    if (startCheck.error) return NextResponse.json({ error: startCheck.error }, { status: 409 });
  }
  const managerConfirmedRecommendation = Boolean(existing.is_automated && ["in_progress", "completed"].includes(normalized.record.status));
  if (existing.is_automated) {
    normalized.record.is_automated = false;
    normalized.record.maintenance_source = managerConfirmedRecommendation ? "manager_confirmed" : "manual";
    normalized.record.automation_key = existing.automation_key;
  }
  const conflict = await findScheduleConflict(auth.context.serviceClient, normalized.record, vehicleIds, id);
  if (conflict?.error) return NextResponse.json({ error: `Unable to check schedule conflicts: ${conflict.error}` }, { status: 500 });
  if (conflict?.conflict) return NextResponse.json({ error: "This schedule overlaps another appointment for the same vehicle or mechanic.", conflict: conflict.conflict }, { status: 409 });

  const costChanged = ["cost", "labor_cost", "parts_cost"].some((field) =>
    body[field] !== undefined && Number(body[field] ?? 0) !== Number(existing[field] ?? 0)
  );
  const completionChanged = body.status !== undefined && String(body.status) !== String(existing.status);
  if (existing.source_cost_entry_id && (costChanged || completionChanged)) {
    return NextResponse.json({ error: "This FVM cost is linked to an original submitted expense. Edit that source while it is pending or rejected; approved driver-submitted values cannot be overwritten here." }, { status: 409 });
  }
  const resetCostReview = costChanged || completionChanged;
  const updateRecord = resetCostReview ? {
    ...normalized.record,
    cost_review_status: "pending",
    cost_reviewed_by: null,
    cost_reviewed_at: null,
    cost_review_notes: null,
  } : normalized.record;
  const { data, error } = await auth.context.serviceClient.from("maintenance_history")
    .update(updateRecord)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("Supabase maintenance update error:", error.message);
    return NextResponse.json({ error: "Failed to update maintenance record" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Maintenance record not found." }, { status: 404 });
  await writeMaintenanceAudit(context.serviceClient, data, context.user.id, managerConfirmedRecommendation ? "manager_confirmed_recommendation" : "manual_maintenance_update", existing, Object.keys(body));
  let incidentWarning: string | null = null;
  if (normalized.record.status === "completed" && (data.source_incident_id || existing.source_incident_id)) {
    const incidentId = String(data.source_incident_id || existing.source_incident_id);
    const { error: incidentError } = await context.serviceClient.from("incident_reports").update({
      resolved_at: data.performed_at || new Date().toISOString(),
      resolved_by: context.user.id,
      resolution_notes: data.work_performed || data.notes || null,
    }).eq("id", incidentId).is("resolved_at", null);
    if (incidentError) incidentWarning = `Maintenance was completed, but the linked incident could not be cleared: ${incidentError.message}`;
  }
  const vehicleStatusWarning = ["in_progress", "completed"].includes(normalized.record.status)
    ? await syncVehicleMaintenanceStatus(context.serviceClient, normalized.record.vehicle_id, normalized.record.status)
    : null;
  const warning = incidentWarning || vehicleStatusWarning;
  return NextResponse.json(warning ? { ...data, vehicle_status_warning: warning } : data);
}