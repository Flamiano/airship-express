import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("rates")
    .select(`*, routes ( route_code, route_name, origin, destination, mode_of_transport, transit_points ), service_providers ( name )`)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ message: "Rate not found." }, { status: 404 });
    }
    console.error("Fetch rate error:", error);
    return NextResponse.json({ message: "Could not load rate." }, { status: 500 });
  }

  return NextResponse.json({ rate: data });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const {
    rate_code,
    description,
    route_id,
    service_provider_id,
    charge_type,
    currency,
    base_rate,
    min_charge,
    surcharge_pct,
    valid_from,
    valid_to,
    status,
    notes,
  } = body;

  if (!rate_code || base_rate === undefined || base_rate === null || base_rate === "") {
    return NextResponse.json(
      { message: "Rate code and base rate are required." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("rates")
    .update({
      rate_code,
      description: description || null,
      route_id: route_id || null,
      service_provider_id: service_provider_id || null,
      charge_type: charge_type || "per_kg",
      currency: currency || "USD",
      base_rate: Number(base_rate),
      min_charge: min_charge ?? 0,
      surcharge_pct: surcharge_pct ?? 0,
      valid_from: valid_from || null,
      valid_to: valid_to || null,
      status: status || "draft",
      notes: notes || null,
    })
    .eq("id", id)
    .select(
      `*, routes ( route_name, origin, destination, mode_of_transport ), service_providers ( name )`
    )
    .single();

  if (error) {
    console.error("Update rate error:", error);
    return NextResponse.json({ message: "Could not update rate." }, { status: 500 });
  }

  return NextResponse.json({ rate: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseClient();

  const { error } = await supabase.from("rates").delete().eq("id", id);

  if (error) {
    console.error("Delete rate error:", error);
    return NextResponse.json({ message: "Could not delete rate." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}