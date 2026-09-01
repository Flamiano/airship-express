import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("service_providers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch providers error:", error);
      return NextResponse.json({ message: "Couldn't load service providers.", error: error.message }, { status: 500 });
    }

    return NextResponse.json({ providers: data ?? [] });
  } catch (err) {
    console.error("Service providers API error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "Internal server error.", error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      type,
      contact_person,
      email,
      phone,
      address,
      country,
      service_modes,
      rating,
      contract_ref,
      notes,
    } = body;

    if (!name || !type) {
      return NextResponse.json(
        { message: "Company name and type are required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("service_providers")
      .insert({
        name,
        type,
        contact_person: contact_person || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        country: country || null,
        service_modes: Array.isArray(service_modes) ? service_modes : [],
        rating: rating ?? 3,
        contract_ref: contract_ref || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Create provider error:", error);
      return NextResponse.json({ message: "Couldn't save provider.", error: error.message }, { status: 500 });
    }

    return NextResponse.json({ provider: data });
  } catch (err) {
    console.error("Service providers POST error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "Internal server error.", error: errorMessage }, { status: 500 });
  }
}

