// Save as: app/(spnc)/spnc/app/api/schedules/[id]/trip/route.ts
//
// GET  /spnc/app/api/schedules/:id/trip   → the trip(s) linked to this schedule
//                                           (+ route / provider / live status from the trip_overview view)
// PUT  /spnc/app/api/schedules/:id/trip   → update one linked trip's vehicle, driver and cargo
//
// This is a NEW route, so your existing /api/trips/... routes are untouched.
import { NextRequest, NextResponse } from "next/server";
import { getAuditActor, logAuditEvent } from "../../../../../lib/audit";
import { getSupabaseClient } from "../../../../../lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Row = Record<string, unknown>;

// Only these trip columns can be changed from the Edit Schedule form.
// Same columns your POST /api/trips route writes.
const EDITABLE = [
  "vehicle_plate_no",
  "vehicle_type",
  "vehicle_make_model",
  "vehicle_capacity_tons",
  "driver_name",
  "driver_license_no",
  "driver_contact_no",
  "helper_name",
  "cargo_description",
  "cargo_quantity",
  "cargo_unit",
  "cargo_weight_kg",
] as const;

const NUMERIC = new Set(["vehicle_capacity_tons", "cargo_quantity", "cargo_weight_kg"]);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseClient();

  const { data: trips, error } = await supabase
    .from("trips")
    .select("*")
    .eq("schedule_id", id)
    .is("archived_at", null)
    .order("trip_code", { ascending: true });

  if (error) {
    console.error("Load schedule trips error:", error);
    return NextResponse.json({ message: "Could not load the trip for this schedule." }, { status: 500 });
  }

  // Read-only summary (route, provider, current status) from your trip_overview view.
  const { data: overview } = await supabase.from("trip_overview").select("*").eq("schedule_id", id);
  const overviewByTrip = new Map(((overview ?? []) as Row[]).map((o) => [String(o.trip_id), o]));

  return NextResponse.json(
    {
      trips: ((trips ?? []) as Row[]).map((t) => ({ trip: t, overview: overviewByTrip.get(String(t.id)) ?? null })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const tripId = body.trip_id ? String(body.trip_id) : null;
  if (!tripId) return NextResponse.json({ message: "trip_id is required." }, { status: 400 });

  const supabase = getSupabaseClient();

  // Make sure the trip really belongs to this schedule, and learn which columns exist.
  const { data: current, error: findErr } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .eq("schedule_id", id)
    .maybeSingle();

  if (findErr) {
    console.error("Find trip error:", findErr);
    return NextResponse.json({ message: "Could not load the trip." }, { status: 500 });
  }
  if (!current) return NextResponse.json({ message: "Trip not found for this schedule." }, { status: 404 });

  const update: Row = {};
  for (const key of EDITABLE) {
    if (!(key in body) || !(key in current)) continue;
    const raw = body[key];
    if (NUMERIC.has(key)) {
      const n = raw === "" || raw === null || raw === undefined ? null : Number(raw);
      update[key] = n === null || Number.isFinite(n) ? n : null;
    } else {
      const s = raw === null || raw === undefined ? "" : String(raw).trim();
      update[key] = s || null;
    }
  }

  if (Object.keys(update).length === 0) return NextResponse.json({ trip: current, unchanged: true });

  const { data: saved, error } = await supabase.from("trips").update(update).eq("id", tripId).select("*").single();

  if (error) {
    console.error("Update trip error:", error);
    return NextResponse.json({ message: "Could not update the trip details.", error: error.message }, { status: 500 });
  }

  const actor = await getAuditActor(req);
  if (actor) {
    await logAuditEvent({
      ...actor,
      eventType: "user_activity",
      action: `${actor.actorName} updated trip "${(saved as Row).trip_code ?? tripId}" (vehicle / driver / cargo)`,
      entityType: "trip",
      entityId: tripId,
      request: req,
    });
  }

  return NextResponse.json({ trip: saved });
}