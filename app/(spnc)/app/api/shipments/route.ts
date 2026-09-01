import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("shipments")
      .select("*, service_providers(name)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch shipments error:", error);
      return NextResponse.json({ message: "Couldn't load shipments.", error: error.message }, { status: 500 });
    }

    return NextResponse.json({ shipments: data });
  } catch (err) {
    console.error("Shipments API error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "Internal server error.", error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tracking_number,
      origin,
      destination,
      route,
      service_provider_id,
      schedule,
      cargo_description,
      weight,
      volume,
      shipper,
      consignee,
      mode,
      status,
      ship_date,
      eta,
    } = body;

    if (!tracking_number || !origin || !destination) {
      return NextResponse.json(
        { message: "Tracking number, origin, and destination are required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("shipments")
      .insert({
        tracking_number,
        origin,
        destination,
        route: route || null,
        service_provider_id: service_provider_id || null,
        schedule: schedule || null,
        cargo_description: cargo_description || null,
        weight: weight || null,
        volume: volume || null,
        shipper: shipper || null,
        consignee: consignee || null,
        mode: mode || "road",
        status: status || "booked",
        ship_date: ship_date || null,
        eta: eta || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Create shipment error:", error);
      return NextResponse.json({ message: "Couldn't save shipment.", error: error.message }, { status: 500 });
    }

    return NextResponse.json({ shipment: data });
  } catch (err) {
    console.error("Shipments POST error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "Internal server error.", error: errorMessage }, { status: 500 });
  }
}