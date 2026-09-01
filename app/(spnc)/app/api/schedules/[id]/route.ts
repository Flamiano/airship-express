import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("schedules")
    .select(`*, routes ( route_code, route_name, origin, destination, mode_of_transport ), service_providers ( name )`)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ message: "Schedule not found." }, { status: 404 });
    }
    console.error("Fetch schedule error:", error);
    return NextResponse.json({ message: "Could not load schedule." }, { status: 500 });
  }

  return NextResponse.json({ schedule: data });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  if (!schedule_code || !route_id || !departure_datetime || !arrival_datetime) {
    return NextResponse.json(
      { message: "Schedule code, route, departure, and arrival are required." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("schedules")
    .update({
      schedule_code,
      route_id,
      service_provider_id: service_provider_id || null,
      departure_datetime,
      arrival_datetime,
      frequency: frequency || "weekly",
      day_of_week: day_of_week || null,
      capacity: capacity ?? null,
      unit_type: unit_type || "kg",
      cutoff_hours: cutoff_hours ?? 24,
      status: status || "scheduled",
      notes: notes || null,
    })
    .eq("id", id)
    .select(
      `*, routes ( route_name, origin, destination, mode_of_transport ), service_providers ( name )`
    )
    .single();

  if (error) {
    console.error("Update schedule error:", error);
    return NextResponse.json({ message: "Could not update schedule." }, { status: 500 });
  }

  return NextResponse.json({ schedule: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseClient();

  const { error, count } = await supabase
    .from("schedules")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    console.error("Delete schedule error:", error);
    return NextResponse.json({ message: "Could not delete schedule." }, { status: 500 });
  }

  if (!count) {
    console.error("Delete schedule matched 0 rows — likely blocked by RLS or wrong id:", id);
    return NextResponse.json(
      { message: "Schedule not found or you don't have permission to delete it." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}