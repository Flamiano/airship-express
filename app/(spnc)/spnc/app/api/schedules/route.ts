// Save as: app/(spnc)/spnc/app/api/schedules/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuditActor, logAuditEvent } from "../../../lib/audit";
import { getSupabaseClient } from "../../../lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Row = Record<string, unknown>;

const STATUSES = ["scheduled", "delayed", "cancelled", "completed"];

function toNumberOrNull(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toTextOrNull(v: unknown) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function toIsoOrNull(v: unknown) {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Adds each schedule's route and service provider as `routes` and `service_providers`
 * (the shape the Schedules page and the Trip Log expect), using two batch lookups.
 * This works with or without a foreign key between schedules and routes
 * (a `routes ( … )` join in select() fails with PGRST200 when there is none).
 */
async function withRoutesAndProviders(supabase: ReturnType<typeof getSupabaseClient>, schedules: Row[]) {
  const routeIds = [...new Set(schedules.map((s) => s.route_id).filter(Boolean).map(String))];
  const providerIds = [...new Set(schedules.map((s) => s.service_provider_id).filter(Boolean).map(String))];

  const [routes, providers] = await Promise.all([
    routeIds.length
      ? supabase
          .from("routes")
          .select("id, route_code, route_name, origin, destination, mode_of_transport, service_provider_id")
          .in("id", routeIds)
          .then((r: { data: Row[] | null; error: unknown }) => (r.error ? [] : r.data ?? []))
      : Promise.resolve([] as Row[]),
    providerIds.length
      ? supabase
          .from("service_providers")
          .select("id, name")
          .in("id", providerIds)
          .then((r: { data: Row[] | null; error: unknown }) => (r.error ? [] : r.data ?? []))
      : Promise.resolve([] as Row[]),
  ]);

  const routeById = new Map((routes as Row[]).map((r) => [String(r.id), r]));
  const providerById = new Map((providers as Row[]).map((p) => [String(p.id), p]));

  return schedules.map((s) => ({
    ...s,
    routes: s.route_id ? routeById.get(String(s.route_id)) ?? null : null,
    service_providers: s.service_provider_id ? providerById.get(String(s.service_provider_id)) ?? null : null,
  }));
}

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.from("schedules").select("*").order("departure_datetime", { ascending: true });

    if (error) {
      console.error("Fetch schedules error:", error);
      return NextResponse.json({ message: "Could not load schedules.", error: error.message }, { status: 500 });
    }

    // Leave out archived schedules when the table has an archived_at column
    const rows = ((data ?? []) as Row[]).filter((s) => !s.archived_at);

    return NextResponse.json(
      { schedules: await withRoutesAndProviders(supabase, rows) },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (err) {
    console.error("Schedules API error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "Internal server error.", error: errorMessage }, { status: 500 });
  }
}

// Used by the Schedules form AND automatically by Route Planning (codes "SCH-SHP-…").
// Only the code and the two times are required here. The Schedules form still asks for
// route, capacity, unit type, etc. on its own; Route Planning may leave route_id empty
// when no matching route exists yet (it can be picked later with Edit → Route).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const schedule_code = toTextOrNull(body.schedule_code);
    const departure_datetime = toIsoOrNull(body.departure_datetime);
    const arrival_datetime = toIsoOrNull(body.arrival_datetime);

    const missing: string[] = [];
    if (!schedule_code) missing.push("schedule code");
    if (!departure_datetime) missing.push("departure date/time");
    if (!arrival_datetime) missing.push("arrival date/time");
    if (missing.length) {
      return NextResponse.json({ message: `Please provide: ${missing.join(", ")}.` }, { status: 400 });
    }
    if (new Date(arrival_datetime!).getTime() <= new Date(departure_datetime!).getTime()) {
      return NextResponse.json({ message: "Arrival must be after departure." }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Same delivery saved twice (e.g. two browser tabs)? Return the existing one instead of a copy.
    const { data: existing } = await supabase.from("schedules").select("*").eq("schedule_code", schedule_code).limit(1);
    if (Array.isArray(existing) && existing.length > 0) {
      const [withJoins] = await withRoutesAndProviders(supabase, existing as Row[]);
      return NextResponse.json({ schedule: withJoins, existing: true });
    }

    // The route decides the provider (same rule as the Schedules form)
    const route_id = toTextOrNull(body.route_id);
    let service_provider_id = toTextOrNull(body.service_provider_id);
    if (route_id) {
      const { data: route } = await supabase.from("routes").select("service_provider_id").eq("id", route_id).maybeSingle();
      if (route?.service_provider_id) service_provider_id = String(route.service_provider_id);
    }

    const { data: created, error } = await supabase
      .from("schedules")
      .insert({
        schedule_code,
        route_id,
        service_provider_id,
        departure_datetime,
        arrival_datetime,
        frequency: toTextOrNull(body.frequency),
        day_of_week: toTextOrNull(body.day_of_week),
        capacity: toNumberOrNull(body.capacity),
        unit_type: toTextOrNull(body.unit_type),
        cutoff_hours: toNumberOrNull(body.cutoff_hours) ?? 24,
        status: STATUSES.includes(String(body.status)) ? String(body.status) : "scheduled",
        notes: toTextOrNull(body.notes),
        // older schedule columns, filled by Route Planning
        vehicle: toTextOrNull(body.vehicle),
        cargo_details: toTextOrNull(body.cargo_details),
        tracking: toTextOrNull(body.tracking),
      })
      .select("*")
      .single();

    if (error) {
      console.error("Create schedule error:", error);
      return NextResponse.json({ message: "Could not save schedule.", error: error.message }, { status: 500 });
    }

    const actor = await getAuditActor(req);
    if (actor)
      await logAuditEvent({
        ...actor,
        eventType: "user_activity",
        action: `${actor.actorName} created schedule "${schedule_code}"`,
        entityType: "schedule",
        entityId: created.id,
        request: req,
      });

    const [withJoins] = await withRoutesAndProviders(supabase, [created as Row]);
    return NextResponse.json({ schedule: withJoins });
  } catch (err) {
    console.error("Schedules POST error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "Internal server error.", error: errorMessage }, { status: 500 });
  }
}