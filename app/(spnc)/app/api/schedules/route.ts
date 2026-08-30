import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("schedules")
      .select(
        `*, routes ( route_name, origin, destination, mode_of_transport ), service_providers ( name )`
      )
      .order("departure_datetime", { ascending: true });

    if (error) {
      console.error("Fetch schedules error:", error);
      return NextResponse.json({ message: "Could not load schedules.", error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { schedules: data },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (err) {
    console.error("Schedules API error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "Internal server error.", error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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
      .insert({
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
      .select(
        `*, routes ( route_name, origin, destination, mode_of_transport ), service_providers ( name )`
      )
      .single();

    if (error) {
      console.error("Create schedule error:", error);
      return NextResponse.json({ message: "Could not save schedule.", error: error.message }, { status: 500 });
    }

    return NextResponse.json({ schedule: data });
  } catch (err) {
    console.error("Schedules POST error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "Internal server error.", error: errorMessage }, { status: 500 });
  }
}