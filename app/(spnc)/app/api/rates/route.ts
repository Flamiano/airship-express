import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("rates")
      .select(
        `*, routes ( route_name, origin, destination, mode_of_transport ), service_providers ( name )`
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch rates error:", error);
      return NextResponse.json({ message: "Could not load rates.", error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rates: data });
  } catch (err) {
    console.error("Rates API error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "Internal server error.", error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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
      .insert({
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
      .select(
        `*, routes ( route_name, origin, destination, mode_of_transport ), service_providers ( name )`
      )
      .single();

    if (error) {
      console.error("Create rate error:", error);
      return NextResponse.json({ message: "Could not save rate.", error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rate: data });
  } catch (err) {
    console.error("Rates POST error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "Internal server error.", error: errorMessage }, { status: 500 });
  }
}