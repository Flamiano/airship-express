import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../library/supabase/server";
import { findCustomers } from "../../../services/booking-request.service";

/**
 * GET /api/crbc/customers/search?q=...
 * Search customers by name, customer_id, email, or phone
 * Staff only - used for CRM wizard customer search
 */
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";

    const result = await findCustomers(query);

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("GET /api/crbc/customers/search error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}