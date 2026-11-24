import { NextResponse } from "next/server";
import { hasPermission } from "../../lib/permissions";
import { authenticateFtmRequest } from "../../lib/server/ftmRequestAuth";
import { createFtmParcelClient } from "../../lib/server/ftmSupabase";

export async function POST(request: Request) {
  try {
    const auth = await authenticateFtmRequest(request);
    if (!("context" in auth)) return auth.response;
    if (!hasPermission(auth.context.user.role, "vrds", "view")) {
      return NextResponse.json({ error: "Permission denied: vrds.view" }, { status: 403 });
    }
    const { action } = await request.json();
    if (action !== "geocode-all") return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    const supabase = createFtmParcelClient();
    if (!supabase) return NextResponse.json({ error: "Core Supabase service is not configured" }, { status: 503 });
    const { data, error } = await supabase.from("parcels").select("*").limit(2000);
    if (error) return NextResponse.json({ error: `Failed to fetch parcels: ${error.message}` }, { status: 500 });

    const parcels = (data || []).map((parcel) => {
      const hasCoordinates = parcel.dest_lat != null && parcel.dest_lng != null &&
        Number.isFinite(Number(parcel.dest_lat)) && Number.isFinite(Number(parcel.dest_lng));
      return {
        id: parcel.id,
        tracking_number: parcel.tracking_number,
        destination: parcel.destination,
        coordinates: hasCoordinates ? { lat: Number(parcel.dest_lat), lng: Number(parcel.dest_lng) } : null,
      };
    });
    return NextResponse.json({
      total: parcels.length,
      located: parcels.filter((parcel) => parcel.coordinates).length,
      withoutCoordinates: parcels.filter((parcel) => !parcel.coordinates).length,
      parcels,
    });
  } catch (error) {
    console.error("[geocode-parcels] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
