import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../library/supabase/server";
import {
  createBookingRequestForStaff,
  createBookingRequestForPortal,
  getBookingRequests,
  findCustomers,
} from "../../services/booking-request.service";
import { validateDraft, validatePortalDraft } from "../../library/validation/booking-request.validate";



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

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let customerUuid: string | undefined;

    if (isCustomer && !isStaff) {
      // Customer Portal: only see own requests
      customerUuid = customer!.id;
    } else if (isStaff) {
      // Staff: can optionally filter by customer UUID
      const customerIdParam = searchParams.get("customer_id");
      if (customerIdParam) {
        customerUuid = customerIdParam;
      }
    }

    const requests = await getBookingRequests({
      customerUuid,
      status: status || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error("GET /api/crbc/booking-requests error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}


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

    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid payload. Expected a booking request object.",
        },
        { status: 400 }
      );
    }

    let result;

    if (isStaff) {
      // CRM Staff flow: can specify customer_id (UUID) or new_customer
      const validationError = validateDraft(body);
      if (validationError) {
        return NextResponse.json(
          { success: false, error: validationError },
          { status: 400 }
        );
      }

      result = await createBookingRequestForStaff(body);
    } else {
      // Customer Portal flow: customer_id resolved from auth
      // Ignore any customer_id in body for security
      const { customer_id, new_customer, ...portalDraft } = body;

      const validationError = validatePortalDraft({
        ...portalDraft,
        request_channel: "PORTAL",
      });
      if (validationError) {
        return NextResponse.json(
          { success: false, error: validationError },
          { status: 400 }
        );
      }

      result = await createBookingRequestForPortal(portalDraft, user.id);
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/crbc/booking-requests error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}