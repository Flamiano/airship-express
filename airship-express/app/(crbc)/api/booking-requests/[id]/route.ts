import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../library/supabase/server";
import { adminCreateClient } from "../../../library/supabase/admin";
import { isServiceCall } from "../../../library/auth/service-call";
import { getBookingRequestById } from "../../../services/booking-request.service";

const STAFF_ALLOWED_STATUSES = ["ACCEPTED", "REJECTED"] as const;
const CUSTOMER_ALLOWED_STATUSES = ["CANCELLED"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { success: false, error: "Status is required" },
        { status: 400 }
      );
    }

    const serviceCall = isServiceCall(request);
    const supabase = serviceCall
      ? adminCreateClient()
      : await createClient();

    if (serviceCall) {
      if (!STAFF_ALLOWED_STATUSES.includes(status)) {
        return NextResponse.json(
          { success: false, error: `Service calls can only set status to: ${STAFF_ALLOWED_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
    } else {
      // Normal user auth: validate staff/customer
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const isStaff = profile?.role === "staff";

      if (isStaff && !STAFF_ALLOWED_STATUSES.includes(status)) {
        return NextResponse.json(
          { success: false, error: `Staff can only set status to: ${STAFF_ALLOWED_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }

      if (!isStaff && !CUSTOMER_ALLOWED_STATUSES.includes(status)) {
        return NextResponse.json(
          { success: false, error: `Customers can only set status to: ${CUSTOMER_ALLOWED_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const { data: existing } = await supabase
      .from("booking_requests")
      .select("id, status, customer_id")
      .eq("request_id", id)
      .single();

    if (!existing) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    // Customer ownership check (skip for service calls)
    if (!serviceCall) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .maybeSingle();
      const isStaff = profile?.role === "staff";

      if (!isStaff) {
        const { data: customer } = await supabase
          .from("customers")
          .select("id")
          .eq("id", (await supabase.auth.getUser()).data.user?.id)
          .single();

        if (!customer || existing.customer_id !== customer.id) {
          return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
      }
    }

    if (existing.status !== "PENDING") {
      return NextResponse.json(
        { success: false, error: "Only PENDING requests can be updated" },
        { status: 409 }
      );
    }

    const { error: updateError } = await supabase
      .from("booking_requests")
      .update({ status })
      .eq("id", existing.id);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: "Failed to update booking request" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error("PATCH /api/booking-requests/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}


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

    const bookingRequest = await getBookingRequestById(id, supabase);

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
