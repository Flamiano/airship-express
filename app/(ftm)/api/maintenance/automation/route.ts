import { NextResponse } from "next/server";
import { hasPermission } from "../../../lib/permissions";
import { authenticateFtmRequest } from "../../../lib/server/ftmRequestAuth";
import { belongsToAirshipCourier, getAirshipCouriers } from "../../../lib/server/ftmCourier";
import { createFtmServiceClient } from "../../../lib/server/ftmSupabase";

export const dynamic = "force-dynamic";

function authorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  let supabase;
  let actorId: string | null = null;

  if (authorizedCron(request)) {
    supabase = createFtmServiceClient();
    if (!supabase) return NextResponse.json({ error: "FTM service client is not configured." }, { status: 503 });
  } else {
    const auth = await authenticateFtmRequest(request);
    if (!("context" in auth)) return auth.response;
    if (!hasPermission(auth.context.user.role, "fvm", "update")) {
      return NextResponse.json({ error: "Permission denied: fvm.update" }, { status: 403 });
    }
    supabase = auth.context.serviceClient;
    actorId = auth.context.user.id;
  }

  let courierIds: Set<string>;
  try {
    courierIds = new Set((await getAirshipCouriers(supabase)).map((courier) => courier.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to validate Airship Express scope." }, { status: 500 });
  }
  if (!courierIds.size) return NextResponse.json({ processed: 0, calculated_at: new Date().toISOString() });

  const { data: rows, error: vehicleError } = await supabase
    .from("vehicles")
    .select("id,courier_id,mileage")
    .in("courier_id", [...courierIds]);
  if (vehicleError) return NextResponse.json({ error: `Unable to load fleet vehicles: ${vehicleError.message}` }, { status: 500 });
  const vehicles = (rows || []).filter((vehicle) => belongsToAirshipCourier(vehicle, courierIds));
  const sourceId = new Date().toISOString().slice(0, 10);
  let processed = 0;

  for (const vehicle of vehicles) {
    const { error } = await supabase.rpc("recalculate_vehicle_maintenance", {
      p_vehicle_id: String(vehicle.id),
      p_source: actorId ? "fleet_manager_refresh" : "scheduled_daily_recalculation",
      p_source_id: sourceId,
      p_previous_odometer: null,
      p_current_odometer: vehicle.mileage == null ? null : Number(vehicle.mileage),
      p_actor_id: actorId,
    });
    if (error) {
      const unavailable = /recalculate_vehicle_maintenance|schema cache|function .* does not exist/i.test(error.message);
      return NextResponse.json({ error: unavailable ? "Maintenance automation migration is not installed." : `Unable to calculate maintenance for vehicle ${vehicle.id}: ${error.message}` }, { status: unavailable ? 503 : 500 });
    }
    processed += 1;
  }

  return NextResponse.json({ processed, calculated_at: new Date().toISOString() });
}