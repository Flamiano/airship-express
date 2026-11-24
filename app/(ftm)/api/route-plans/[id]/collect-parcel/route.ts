import { NextResponse } from "next/server";
import { hasPermission } from "../../../../lib/permissions";
import { authenticateFtmRequest } from "../../../../lib/server/ftmRequestAuth";
import { createFtmParcelClient } from "../../../../lib/server/ftmSupabase";
import { isParcelPickupOnRoute, isParcelTableError } from "../../../../lib/server/ftmParcels";
import {
  isParcelAlreadyCollected,
  isParcelAssignedToRoute,
  isParcelTerminalForCollection,
  isRouteClosedForParcelCollection,
} from "../../../../lib/routeParcelEligibility";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "vrds", "update")) {
    return NextResponse.json({ error: "Permission denied: vrds.update" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  const parcelId = String(body.parcel_id ?? body.parcelId ?? "").trim();
  if (!parcelId) return NextResponse.json({ error: "parcel_id is required." }, { status: 400 });

  const { data: route, error: routeError } = await context.serviceClient
    .from("route_plans")
    .select("id,status,route_details,route_geojson,pickup_location,pickup_latitude,pickup_longitude,delivery_destinations")
    .eq("id", id)
    .maybeSingle();
  if (routeError) return NextResponse.json({ error: `Unable to load route plan: ${routeError.message}` }, { status: 500 });
  if (!route) return NextResponse.json({ error: "Route plan not found." }, { status: 404 });
  if (isRouteClosedForParcelCollection(route)) {
    return NextResponse.json({ error: "Parcels cannot be collected on a closed route plan." }, { status: 409 });
  }

  const parcelClient = createFtmParcelClient();
  if (!parcelClient) return NextResponse.json({ error: "FTM parcel database is not configured." }, { status: 503 });
  const { data: parcel, error: parcelError } = await parcelClient.from("parcels").select("*").eq("id", parcelId).maybeSingle();
  if (parcelError) {
    if (isParcelTableError(parcelError)) return NextResponse.json({ error: "The FTM parcels table has not been created yet.", migration: "supabase/migrations/20261009_create_ftm_parcels.sql" }, { status: 503 });
    return NextResponse.json({ error: `Unable to load parcel: ${parcelError.message}` }, { status: 500 });
  }
  if (!parcel) return NextResponse.json({ error: "Parcel not found." }, { status: 404 });
  if (!isParcelAssignedToRoute(parcel, route)) {
    return NextResponse.json({ error: "This parcel is not assigned to the selected route plan." }, { status: 409 });
  }
  if (isParcelAlreadyCollected(parcel)) return NextResponse.json({ error: "This parcel has already been collected." }, { status: 409 });
  const parcelStatus = String(parcel.status || parcel.parcel_status || "").toLowerCase();
  if (isParcelTerminalForCollection(parcel)) {
    return NextResponse.json({ error: `This parcel is ${parcelStatus} and cannot be collected.` }, { status: 409 });
  }
  if (!isParcelPickupOnRoute(parcel, route)) {
    return NextResponse.json({ error: "Parcel pickup location does not match or fall along this route plan." }, { status: 409 });
  }

  const collectedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await parcelClient
    .from("parcels")
    .update({ status: "picked_up", collected_at: collectedAt, updated_at: collectedAt, route_plan_id: String(route.id) })
    .eq("id", parcelId)
    .is("collected_at", null)
    .select("*")
    .maybeSingle();
  if (updateError) {
    if (isParcelTableError(updateError)) return NextResponse.json({ error: "The FTM parcels table has not been created yet.", migration: "supabase/migrations/20261009_create_ftm_parcels.sql" }, { status: 503 });
    return NextResponse.json({ error: `Unable to record parcel collection: ${updateError.message}` }, { status: 500 });
  }
  if (!updated) return NextResponse.json({ error: "This parcel was collected or reassigned by another user." }, { status: 409 });
  return NextResponse.json({ parcel: updated, collected_at: collectedAt });
}