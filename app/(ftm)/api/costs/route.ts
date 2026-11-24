import { NextResponse } from "next/server";
import { hasPermission } from "../../lib/permissions";
import { authenticateFtmRequest } from "../../lib/server/ftmRequestAuth";

export const dynamic = "force-dynamic";
const COST_CATEGORIES = new Set(["Fuel", "Maintenance", "Toll", "Salary", "Insurance", "Other", "Driver", "Parking", "Revenue"]);

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDetails(value: unknown): JsonRecord {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return isJsonRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return isJsonRecord(value) ? value : {};
}

function buildCategoryDetails(category: string, record: JsonRecord = {}): JsonRecord {
  const base = parseDetails(record.category_details ?? record.categoryDetails ?? record.category_metadata ?? record.categoryMetadata ?? record.details ?? record.metadata);
  const source = { ...base, ...record };
  const normalized = {
    category,
    note: source.note ?? source.remarks ?? source.description ?? null,
    description: source.description ?? source.remarks ?? source.note ?? null,
  };
  if (category === "Fuel") return { ...normalized, liters: source.liters ?? source.quantity ?? null, odometer_reading: source.odometer_reading ?? source.odometerReading ?? null, fuel_station: source.fuel_station ?? source.fuelStation ?? null, fuel_type: source.fuel_type ?? source.fuelType ?? null, reference_number: source.reference_number ?? source.referenceNumber ?? null, location: source.location ?? null, payment_method: source.payment_method ?? source.paymentMethod ?? null };
  if (category === "Maintenance") return { ...normalized, maintenance_type: source.maintenance_type ?? source.maintenanceType ?? source.type ?? null, vendor: source.vendor ?? null, service_date: source.service_date ?? source.serviceDate ?? null };
  if (category === "Toll") return { ...normalized, toll_location: source.toll_location ?? source.tollLocation ?? null, vehicle_number: source.vehicle_number ?? source.vehicleNumber ?? null };
  if (category === "Parking") return { ...normalized, parking_location: source.parking_location ?? source.parkingLocation ?? null, duration_hours: source.duration_hours ?? source.durationHours ?? null };
  if (category === "Other") return { ...normalized, description: source.description ?? source.remarks ?? source.note ?? null };
  return normalized;
}

function categoryCost(entry: JsonRecord): JsonRecord {
  const details = parseDetails(entry.category_details ?? entry.categoryDetails ?? entry.category_metadata ?? entry.categoryMetadata ?? entry.details ?? entry.metadata);
  if (Object.keys(details).length) return details;
  return buildCategoryDetails(typeof entry.category === "string" ? entry.category : "Other", entry);
}

function normalizeCost(entry: JsonRecord) {
  const details = categoryCost(entry);
  const category = String(entry.category || "").toLowerCase();
  const liters = entry.liters ?? details.liters ?? null;
  const pricePerLiter = entry.price_per_liter ?? details.price_per_liter ?? null;
  const flags = Array.isArray(entry.review_flags)
    ? entry.review_flags.filter((flag): flag is string => typeof flag === "string")
    : [];
  if (category !== "revenue" && (!(Number(entry.amount) > 0) || !Number.isFinite(Number(entry.amount)))
    && !flags.includes("Recorded expense amount is unavailable")) flags.push("Recorded expense amount is unavailable");
  if (!entry.vehicle_id && !flags.includes("Vehicle is unavailable")) flags.push("Vehicle is unavailable");
  if (category === "fuel") {
    if (!(Number(liters) > 0) && !flags.includes("Fuel liters are unavailable")) flags.push("Fuel liters are unavailable");
    if (!(Number(pricePerLiter) > 0) && !flags.includes("Fuel price per liter is unavailable")) flags.push("Fuel price per liter is unavailable");
    if (Number(liters) > 0 && Number(pricePerLiter) > 0 && Math.abs(Number(liters) * Number(pricePerLiter) - Number(entry.amount)) > 0.01
      && !flags.includes("Fuel total differs from liters multiplied by price per liter")) {
      flags.push("Fuel total differs from liters multiplied by price per liter");
    }
    if (!entry.receipt_image && !flags.includes("Fuel receipt is unavailable")) flags.push("Fuel receipt is unavailable");
    if (entry.receipt_image && !entry.receipt_verified && !flags.includes("Fuel receipt is not verified")) flags.push("Fuel receipt is not verified");
  }
  return {
    ...entry,
    vehicleId: entry.vehicle_id || entry.vehicleId || null,
    tripId: entry.trip_id || entry.tripId || null,
    driverId: entry.driver_id || entry.driverId || null,
    amount: entry.amount != null ? Number(entry.amount) : null,
    entryDate: entry.entry_date || entry.entryDate || null,
    remarks: entry.remarks ?? entry.description ?? null,
    description: entry.description ?? entry.remarks ?? "",
    recorded_at: entry.recorded_at ?? entry.entry_date ?? entry.created_at ?? null,
    review_status: entry.review_status || "pending",
    review_flags: flags,
    liters: liters == null ? null : Number(liters),
    price_per_liter: pricePerLiter == null ? null : Number(pricePerLiter),
    calculated_amount: category === "fuel" && Number(liters) > 0 && Number(pricePerLiter) > 0
      ? Number(liters) * Number(pricePerLiter)
      : Number(entry.amount ?? 0),
    categoryCost: details,
  };
}

function toEntryDate(value: unknown) {
  const date = value ? new Date(String(value)) : new Date();
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (!hasPermission(auth.context.user.role, "costAnalysis", "view")) {
    return NextResponse.json({ error: "Permission denied: costAnalysis.view" }, { status: 403 });
  }
  const data: JsonRecord[] = [];
  const supabase = auth.context.serviceClient;
  let error: { message: string } | null = null;
  for (let from = 0; ; from += 1000) {
    const result = await supabase.from("cost_entries").select("*").order("entry_date", { ascending: false }).range(from, from + 999);
    if (result.error) { error = result.error; break; }
    data.push(...(result.data || []));
    if ((result.data || []).length < 1000) break;
  }
  if (error) {
    return NextResponse.json({ error: `Unable to load cost entries: ${error.message}` }, { status: 500 });
  }
  const userIds = [...new Set(data.flatMap((entry) => [entry.driver_id, entry.reviewed_by, entry.receipt_verified_by].filter(Boolean).map(String)))];
  const { data: users } = userIds.length
    ? await supabase.from("users").select("id,full_name,email").in("id", userIds)
    : { data: [] };
  const userById = new Map((users || []).map((user) => [String(user.id), user]));
  const maintenanceIds = [...new Set(data.map((entry) => entry.source_maintenance_record_id).filter(Boolean).map(String))];
  const { data: linkedMaintenance } = maintenanceIds.length
    ? await supabase.from("maintenance_history").select("*").in("id", maintenanceIds)
    : { data: [] };
  const maintenanceById = new Map((linkedMaintenance || []).map((record) => [String(record.id), record]));
  return NextResponse.json(data.map((entry) => ({
    ...normalizeCost(entry),
    driver_name: userById.get(String(entry.driver_id || ""))?.full_name || null,
    reviewer_name: userById.get(String(entry.reviewed_by || ""))?.full_name || userById.get(String(entry.reviewed_by || ""))?.email || null,
    receipt_verifier_name: userById.get(String(entry.receipt_verified_by || ""))?.full_name || userById.get(String(entry.receipt_verified_by || ""))?.email || null,
    maintenance_source: maintenanceById.get(String(entry.source_maintenance_record_id || "")) || null,
  })));
}

export async function PATCH(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  let body: JsonRecord;
  try {
    const parsed: unknown = await request.json();
    if (!isJsonRecord(parsed)) {
      return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
    }
    body = parsed;
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  const id = String(body.id || "").trim();
  if (!id) return NextResponse.json({ error: "An expense id is required." }, { status: 400 });
  const supabase = auth.context.serviceClient;
  const { data: existing, error: readError } = await supabase.from("cost_entries").select("*").eq("id", id).maybeSingle();
  if (readError) return NextResponse.json({ error: `Unable to load expense: ${readError.message}` }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Expense not found." }, { status: 404 });
  const category = String(existing.category || "").toLowerCase();
  const permissionModule = category === "fuel" ? "fuelManagement" : "costAnalysis";
  if (!hasPermission(auth.context.user.role, permissionModule, "update")) {
    return NextResponse.json({ error: `Permission denied: ${permissionModule}.update` }, { status: 403 });
  }
  if (existing.source_maintenance_record_id
    && (!hasPermission(auth.context.user.role, "fvm", "update") || !hasPermission(auth.context.user.role, "costAnalysis", "update"))) {
    return NextResponse.json({ error: "Linked maintenance expense review requires both costAnalysis.update and fvm.update." }, { status: 403 });
  }

  if (body.action === "link_maintenance") {
    if (!hasPermission(auth.context.user.role, "fvm", "update") || category !== "maintenance") {
      return NextResponse.json({ error: "Only authorized reviewers can link a maintenance expense to FVM work." }, { status: 403 });
    }
    const maintenanceId = String(body.maintenance_record_id || "").trim();
    if (!maintenanceId) return NextResponse.json({ error: "A maintenance source record id is required." }, { status: 400 });
    const { data: maintenance, error: maintenanceError } = await supabase.from("maintenance_history")
      .select("id,vehicle_id,status,cost,labor_cost,parts_cost,cost_review_status,source_cost_entry_id")
      .eq("id", maintenanceId)
      .maybeSingle();
    if (maintenanceError) return NextResponse.json({ error: `Unable to validate maintenance source: ${maintenanceError.message}` }, { status: 500 });
    if (!maintenance) return NextResponse.json({ error: "Maintenance source record not found." }, { status: 404 });
    if (String(existing.vehicle_id || "") !== String(maintenance.vehicle_id || "")) {
      return NextResponse.json({ error: "The expense and maintenance record must reference the same vehicle." }, { status: 409 });
    }
    if (String(existing.review_status || "pending") !== "pending" || String(maintenance.cost_review_status || "pending") !== "pending") {
      return NextResponse.json({ error: "Both source records must still be pending review." }, { status: 409 });
    }
    if (String(maintenance.status || "").toLowerCase() !== "completed") {
      return NextResponse.json({ error: "Only completed FVM maintenance can be linked to an expense." }, { status: 409 });
    }
    const costAmount = existing.amount == null ? null : Number(existing.amount);
    const maintenanceAmount = maintenance.labor_cost != null && maintenance.parts_cost != null
      ? Number(maintenance.labor_cost) + Number(maintenance.parts_cost)
      : maintenance.cost == null ? null : Number(maintenance.cost);
    if (costAmount == null || maintenanceAmount == null || Math.abs(costAmount - maintenanceAmount) > 0.01) {
      return NextResponse.json({ error: "Source amounts must match before records can be linked." }, { status: 409 });
    }
    const { error: linkError } = await supabase.rpc("link_maintenance_cost_entry", {
      p_cost_entry_id: id,
      p_maintenance_record_id: maintenanceId,
      p_actor_id: auth.context.user.id,
    });
    if (linkError) return NextResponse.json({ error: `Unable to link source records: ${linkError.message}` }, { status: 409 });
    const { data: linked, error: linkedError } = await supabase.from("cost_entries").select("*").eq("id", id).single();
    if (linkedError) return NextResponse.json({ error: `Sources linked, but refresh failed: ${linkedError.message}` }, { status: 500 });
    return NextResponse.json(normalizeCost(linked));
  }
  if (body.action === "unlink_maintenance") {
    if (!hasPermission(auth.context.user.role, "fvm", "update") || !hasPermission(auth.context.user.role, "costAnalysis", "update")) {
      return NextResponse.json({ error: "Unlinking maintenance sources requires both costAnalysis.update and fvm.update." }, { status: 403 });
    }
    if (!existing.source_maintenance_record_id) return NextResponse.json({ error: "This expense has no linked FVM source." }, { status: 409 });
    const { data: linkedSource, error: linkedSourceError } = await supabase.from("maintenance_history")
      .select("id,cost_review_status")
      .eq("id", existing.source_maintenance_record_id)
      .maybeSingle();
    if (linkedSourceError) return NextResponse.json({ error: `Unable to validate linked maintenance source: ${linkedSourceError.message}` }, { status: 500 });
    if (!linkedSource || String(existing.review_status || "pending") === "approved" || String(linkedSource.cost_review_status || "pending") === "approved") {
      return NextResponse.json({ error: "Approved source records cannot be unlinked." }, { status: 409 });
    }
    const { error: unlinkError } = await supabase.rpc("unlink_maintenance_cost_entry", { p_cost_entry_id: id, p_actor_id: auth.context.user.id });
    if (unlinkError) return NextResponse.json({ error: `Unable to unlink source records: ${unlinkError.message}` }, { status: 409 });
    const { data: unlinked, error: unlinkedError } = await supabase.from("cost_entries").select("*").eq("id", id).single();
    if (unlinkedError) return NextResponse.json({ error: `Sources unlinked, but refresh failed: ${unlinkedError.message}` }, { status: 500 });
    return NextResponse.json(normalizeCost(unlinked));
  }

  const now = new Date().toISOString();
  const action = String(body.action || "");
  let update: JsonRecord;
  if (action === "verify_receipt") {
    if (!existing.receipt_image) return NextResponse.json({ error: "A receipt must be attached before it can be verified." }, { status: 409 });
    update = {
      receipt_verified: true,
      receipt_verified_by: auth.context.user.id,
      receipt_verified_at: now,
    };
  } else if (action === "review") {
    const status = String(body.review_status || "").toLowerCase();
    if (!["approved", "rejected", "pending"].includes(status)) {
      return NextResponse.json({ error: "review_status must be approved, rejected, or pending." }, { status: 400 });
    }
    if (status === "approved") {
      if (category === "revenue") return NextResponse.json({ error: "Revenue records cannot be approved as transportation expenses." }, { status: 409 });
      const flags = normalizeCost(existing).review_flags;
      if (!(Number(existing.amount) > 0)) flags.push("Recorded expense amount is unavailable");
      if (flags.length) {
        return NextResponse.json({ error: `Resolve these review flags before approval: ${flags.join("; ")}` }, { status: 409 });
      }
    }
    update = {
      review_status: status,
      reviewed_by: auth.context.user.id,
      reviewed_at: now,
      review_notes: body.review_notes || null,
    };
    if (existing.source_maintenance_record_id) {
      const { error: linkedReviewError } = await supabase.rpc("review_linked_maintenance_cost_entry", {
        p_cost_entry_id: id,
        p_review_status: status,
        p_reviewer_id: auth.context.user.id,
        p_review_notes: body.review_notes || null,
      });
      if (linkedReviewError) return NextResponse.json({ error: `Unable to update linked source reviews: ${linkedReviewError.message}` }, { status: 409 });
      const { data: linked, error: linkedError } = await supabase.from("cost_entries").select("*").eq("id", id).single();
      if (linkedError) return NextResponse.json({ error: `Review saved, but refresh failed: ${linkedError.message}` }, { status: 500 });
      return NextResponse.json(normalizeCost(linked));
    }
  } else {
    return NextResponse.json({ error: "Unsupported expense action." }, { status: 400 });
  }

  const { data, error } = await supabase.from("cost_entries").update(update).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: `Unable to update expense: ${error.message}` }, { status: 500 });
  return NextResponse.json(normalizeCost(data));
}

export async function POST(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (!hasPermission(auth.context.user.role, "costAnalysis", "create")) {
    return NextResponse.json({ error: "Permission denied: costAnalysis.create" }, { status: 403 });
  }
  let record: JsonRecord;
  try {
    const parsed: unknown = await request.json();
    if (!isJsonRecord(parsed)) {
      return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
    }
    record = parsed;
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  const amount = Number(record.amount);
  if (typeof record.category !== "string" || !COST_CATEGORIES.has(record.category)) {
    return NextResponse.json({ error: "A valid cost category is required" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: "amount must be a non-negative number" }, { status: 400 });
  const entryDate = toEntryDate(record.entry_date || record.recorded_at || record.date);
  if (!entryDate) return NextResponse.json({ error: "entry_date must be a valid date" }, { status: 400 });

  const payload: JsonRecord = {
    driver_id: record.driver_id || record.driverId || null,
    vehicle_id: record.vehicle_id || record.vehicle || null,
    trip_id: record.trip_id || record.trip || null,
    category: record.category,
    amount,
    entry_date: entryDate,
    remarks: record.remarks ?? record.description ?? null,
    receipt_image: record.receipt_image ?? null,
    category_details: buildCategoryDetails(record.category, record),
  };
  const supabase = auth.context.serviceClient;
  let result = await supabase.from("cost_entries").insert(payload).select("*").single();
  if (result.error && /receipt_image/i.test(result.error.message)) {
    const fallback = { ...payload };
    delete fallback.receipt_image;
    result = await supabase.from("cost_entries").insert(fallback).select("*").single();
  }
  if (result.error && /category_details|driver_id/i.test(result.error.message)) {
    const fallback = { ...payload };
    delete fallback.category_details;
    delete fallback.driver_id;
    result = await supabase.from("cost_entries").insert(fallback).select("*").single();
  }
  if (result.error) return NextResponse.json({ error: `Unable to create cost entry: ${result.error.message}` }, { status: 500 });
  const details = buildCategoryDetails(record.category, record);
  const { error: detailsError } = await supabase.from("cost_entries").update({ category_details: details }).eq("id", result.data.id);
  if (detailsError && !/column .*category_details|does not exist|not found/i.test(detailsError.message)) {
    return NextResponse.json({ error: `Unable to save category details: ${detailsError.message}` }, { status: 500 });
  }
  return NextResponse.json(normalizeCost({ ...result.data, categoryCost: details }), { status: 201 });
}