import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/(crbc)/library/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is staff (CRM)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const isStaff = !profileError && profile?.role === "staff";

    if (!isStaff) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Staff access required" },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid payload. Expected a customer object.",
        },
        { status: 400 }
      );
    }

    const {
      full_name,
      phone,
      address,
      email,
      source = "walk_in",
    } = body;

    if (!full_name) {
      return NextResponse.json(
        { success: false, error: "Full name is required" },
        { status: 400 }
      );
    }

    // Insert customer record
    const { data: customer, error: insertError } = await supabase
      .from("customers")
      .insert({
        full_name: full_name.trim(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        email: email?.trim() || null,
        source,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Customer creation error:", insertError);
      return NextResponse.json(
        { success: false, error: "Failed to create customer" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Customer created successfully",
        customer: {
          id: customer.id,
          customer_id: customer.customer_id,
          full_name: customer.full_name,
          phone: customer.phone,
          address: customer.address,
          email: customer.email,
          source: customer.source,
          created_at: customer.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/crbc/customers error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}