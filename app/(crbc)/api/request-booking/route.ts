import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../library/supabase/server";
import {
  submitBookingRequest,
  type BookingRequestDraft,
} from "../../actions/booking-request";

// list CRM booking requests.
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("booking_requests")
      .select(
        `
        id,
        request_id,
        customer_id,
        request_channel,
        receiver_name,
        receiver_contact,
        receiver_address,
        package_quantity,
        package_type,
        status,
        created_at
        `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

/* 
   create a CRM booking request.
   sample api for testing
*/


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();


    if (!body || typeof body !== "object" || !body.request_channel) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid payload. Expected a BookingRequestDraft (see app/(crbc)/actions/booking-request.ts).",
        },
        { status: 400 }
      );
    }

    const result = await submitBookingRequest(body as BookingRequestDraft);

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
