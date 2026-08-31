import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../library/supabase/server";
import { getBookingRequestById, getBookingRequestsByCustomerId } from "../../../services/booking-request.service";


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Check if user is staff (CRM) or customer
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const isStaff = !profileError && profile?.role === "staff";

    // Check if user has a customer profile
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const isCustomer = !customerError && !!customer;

    if (!isStaff && !isCustomer) {
      return NextResponse.json(
        { success: false, error: "Forbidden: No valid role" },
        { status: 403 }
      );
    }

    const bookingRequest = await getBookingRequestById(id);

    if (!bookingRequest) {
      return NextResponse.json(
        { success: false, error: "Booking request not found" },
        { status: 404 }
      );
    }

    // Authorization: Customer can only see their own requests
    if (isCustomer && !isStaff) {
      if (bookingRequest.customer_id !== customer!.id) {
        return NextResponse.json(
          { success: false, error: "Forbidden: Cannot access this booking request" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: bookingRequest,
    });
  } catch (error) {
    console.error(`GET /api/booking-requests/${(await params).id} error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}