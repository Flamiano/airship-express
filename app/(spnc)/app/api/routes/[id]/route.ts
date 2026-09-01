import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("routes")
    .select("*, service_providers(name)")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Fetch route error:", error);
    return NextResponse.json({ message: "Couldn't load route." }, { status: 500 });
  }

  return NextResponse.json({ route: data });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await req.json();
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("routes")
    .update({
      route_code: body.route_code,
      route_name: body.route_name,
      origin: body.origin,
      destination: body.destination,
      mode_of_transport: body.mode_of_transport || "road",
      service_provider_id: body.service_provider_id || null,
      distance_km: body.distance_km ?? null,
      estimated_transit_hours: body.estimated_transit_hours ?? null,
      transit_points: Array.isArray(body.transit_points) ? body.transit_points : [],
      status: body.status || "active",
      notes: body.notes || null,
    })
    .eq("id", id)
    .select("*, service_providers(name)")
    .single();

  if (error) {
    console.error("Update route error:", error);
    return NextResponse.json({ message: "Couldn't update route." }, { status: 500 });
  }

  return NextResponse.json({ route: data });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PUT(req, context);
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = getSupabaseClient();

  const { error } = await supabase.from("routes").delete().eq("id", id);

  if (error) {
    console.error("Delete route error:", error);
    return NextResponse.json({ message: "Couldn't delete route." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}