import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("routes")
      .select("*, service_providers(name)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch routes error:", error);
      return NextResponse.json({ message: "Couldn't load routes.", error: error.message }, { status: 500 });
    }

    return NextResponse.json({ routes: data });
  } catch (err) {
    console.error("Routes API error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "Internal server error.", error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      route_code,
      route_name,
      origin,
      destination,
      mode_of_transport,
      service_provider_id,
      distance_km,
      estimated_transit_hours,
      transit_points,
      status,
      notes,
    } = body;

    if (!route_code || !route_name || !origin || !destination) {
      return NextResponse.json(
        { message: "Route code, name, origin, and destination are required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("routes")
      .insert({
        route_code,
        route_name,
        origin,
        destination,
        mode_of_transport: mode_of_transport || "road",
        service_provider_id: service_provider_id || null,
        distance_km: distance_km || null,
        estimated_transit_hours: estimated_transit_hours || null,
        transit_points: transit_points || [],
        status: status || "active",
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Create route error:", error);
      return NextResponse.json({ message: "Couldn't save route.", error: error.message }, { status: 500 });
    }

    return NextResponse.json({ route: data });
  } catch (err) {
    console.error("Routes POST error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "Internal server error.", error: errorMessage }, { status: 500 });
  }
}