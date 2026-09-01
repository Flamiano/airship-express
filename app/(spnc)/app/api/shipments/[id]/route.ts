import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("shipments")
    .select("*, service_providers(name)")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Fetch shipment error:", error);
    return NextResponse.json({ message: "Couldn't load shipment." }, { status: 500 });
  }

  return NextResponse.json({ shipment: data });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await req.json();
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("shipments")
    .update({
      tracking_number: body.tracking_number,
      origin: body.origin,
      destination: body.destination,
      route: body.route || null,
      service_provider_id: body.service_provider_id || null,
      schedule: body.schedule || null,
      cargo_description: body.cargo_description || null,
      weight: body.weight ?? null,
      volume: body.volume ?? null,
      shipper: body.shipper || null,
      consignee: body.consignee || null,
      mode: body.mode || "road",
      ship_date: body.ship_date || null,
      eta: body.eta || null,
    })
    .eq("id", id)
    .select("*, service_providers(name)")
    .single();

  if (error) {
    console.error("Update shipment error:", error);
    return NextResponse.json({ message: "Couldn't update shipment." }, { status: 500 });
  }

  return NextResponse.json({ shipment: data });
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

  const { error } = await supabase.from("shipments").delete().eq("id", id);

  if (error) {
    console.error("Delete shipment error:", error);
    return NextResponse.json({ message: "Couldn't delete shipment." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
