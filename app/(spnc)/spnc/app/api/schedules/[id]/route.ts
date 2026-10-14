// Save as: app/(spnc)/spnc/app/api/schedules/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuditActor, logAuditEvent } from "../../../../lib/audit";
import { getSupabaseClient } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Row = Record<string, unknown>;

/**
 * Adds the schedule's route and service provider as `routes` and `service_providers`
 * (the same shape the old Supabase join returned), using separate lookups.
 * Your database no longer has a foreign key between schedules and routes, so the
 * `routes ( … )` join in a select() fails with PGRST200.
 */
async function withRouteAndProvider(supabase: ReturnType<typeof getSupabaseClient>, schedule: Row) {
  const routeId = schedule.route_id ? String(schedule.route_id) : null;
  const providerId = schedule.service_provider_id ? String(schedule.service_provider_id) : null;

  const [route, provider] = await Promise.all([
    routeId
      ? supabase.from("routes").select("*").eq("id", routeId).maybeSingle().then((r) => (r.error ? null : r.data))
      : Promise.resolve(null),
    providerId
      ? supabase.from("service_providers").select("id, name, type, contact_person, phone, email").eq("id", providerId).maybeSingle().then((r) => (r.error ? null : r.data))
      : Promise.resolve(null),
  ]);

  return { ...schedule, routes: route ?? null, service_providers: provider ?? null };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.from("schedules").select("*").eq("id", id).maybeSingle();

  if (error) {
    console.error("Fetch schedule error:", error);
    return NextResponse.json({ message: "Could not load schedule." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ message: "Schedule not found." }, { status: 404 });

  // Viewing a schedule is a read, not an update — no audit log write here.
  return NextResponse.json({ schedule: await withRouteAndProvider(supabase, data as Row) });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const {
    schedule_code,
    route_id,
    service_provider_id,
    departure_datetime,
    arrival_datetime,
    frequency,
    day_of_week,
    capacity,
    unit_type,
    cutoff_hours,
    status,
    notes,
  } = body;

  // Route is optional here: deliveries added automatically by Route Planning may not have a
  // matching route yet. The Schedules form still requires a route before it sends anything.
  if (!schedule_code || !departure_datetime || !arrival_datetime) {
    return NextResponse.json({ message: "Schedule code, departure, and arrival are required." }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  // The route decides the provider (same rule as the Schedules form)
  let providerId: string | null = service_provider_id || null;
  if (route_id) {
    const { data: route } = await supabase.from("routes").select("service_provider_id").eq("id", route_id).maybeSingle();
    if (route?.service_provider_id) providerId = String(route.service_provider_id);
  }

  // Older schedule columns sent by Route Planning: only updated when they are sent
  const extra: Record<string, unknown> = {};
  for (const key of ["vehicle", "cargo_details", "tracking"]) {
    if (key in body) extra[key] = body[key] || null;
  }

  const { data, error } = await supabase
    .from("schedules")
    .update({
      schedule_code,
      route_id: route_id || null,
      service_provider_id: providerId,
      departure_datetime,
      arrival_datetime,
      frequency: frequency || "weekly",
      day_of_week: day_of_week || null,
      capacity: capacity ?? null,
      unit_type: unit_type || "kg",
      cutoff_hours: cutoff_hours ?? 24,
      status: status || "scheduled",
      notes: notes || null,
      ...extra,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Update schedule error:", error);
    return NextResponse.json({ message: "Could not update schedule." }, { status: 500 });
  }

  const actor = await getAuditActor(req);
  if (actor) {
    await logAuditEvent({
      ...actor,
      eventType: "user_activity",
      action: `${actor.actorName} updated schedule "${data.schedule_code}"`,
      entityType: "schedule",
      entityId: data.id,
      request: req,
    });
  }

  return NextResponse.json({ schedule: await withRouteAndProvider(supabase, data as Row) });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseClient();

  const { error, count } = await supabase.from("schedules").delete({ count: "exact" }).eq("id", id);

  if (error) {
    console.error("Delete schedule error:", error);
    return NextResponse.json({ message: "Could not delete schedule." }, { status: 500 });
  }

  if (!count) {
    console.error("Delete schedule matched 0 rows — likely blocked by RLS or wrong id:", id);
    return NextResponse.json({ message: "Schedule not found or you don't have permission to delete it." }, { status: 404 });
  }

  const actor = await getAuditActor(req);
  if (actor) {
    await logAuditEvent({
      ...actor,
      eventType: "archive",
      action: `${actor.actorName} deleted schedule ${id}`,
      entityType: "schedule",
      entityId: id,
      request: req,
    });
  }

  return NextResponse.json({ success: true });
}