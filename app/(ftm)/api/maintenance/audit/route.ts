import { NextResponse } from "next/server";
import { hasPermission } from "../../../lib/permissions";
import { authenticateFtmRequest } from "../../../lib/server/ftmRequestAuth";
import { belongsToAirshipCourier, getAirshipCouriers } from "../../../lib/server/ftmCourier";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const params = new URL(request.url).searchParams;
  const maintenanceId = params.get("maintenance_id")?.trim();
  if (maintenanceId) {
    if (!hasPermission(auth.context.user.role, "fvm", "update") || !hasPermission(auth.context.user.role, "costAnalysis", "update")) {
      return NextResponse.json({ error: "Permission denied: maintenance cost audit requires fvm.update and costAnalysis.update." }, { status: 403 });
    }
    let vehicleIds: Set<string>;
    try { vehicleIds = new Set((await getAirshipCouriers(auth.context.serviceClient)).map((courier) => courier.id)); } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to verify vehicle scope." }, { status: 500 });
    }
    const { data: source, error: sourceError } = await auth.context.serviceClient.from("maintenance_history").select("id,vehicle_id").eq("id", maintenanceId).maybeSingle();
    if (sourceError) return NextResponse.json({ error: `Unable to verify maintenance source: ${sourceError.message}` }, { status: 500 });
    if (!source) return NextResponse.json({ error: "Maintenance record not found." }, { status: 404 });
    const { data: vehicle, error: vehicleError } = await auth.context.serviceClient.from("vehicles").select("id,courier_id").eq("id", source.vehicle_id).maybeSingle();
    if (vehicleError) return NextResponse.json({ error: `Unable to verify vehicle: ${vehicleError.message}` }, { status: 500 });
    if (!vehicle || !belongsToAirshipCourier(vehicle, vehicleIds)) return NextResponse.json({ error: "Maintenance record not found." }, { status: 404 });
    const { data, error } = await auth.context.serviceClient.from("maintenance_cost_audit").select("*").eq("maintenance_record_id", maintenanceId).order("changed_at", { ascending: false }).limit(100);
    if (error) return NextResponse.json({ error: `Unable to load maintenance cost audit: ${error.message}` }, { status: 500 });
    const actorIds = [...new Set((data || []).map((entry) => entry.actor_id).filter(Boolean).map(String))];
    const { data: actors } = actorIds.length ? await auth.context.serviceClient.from("users").select("id,full_name,email").in("id", actorIds) : { data: [] };
    const actorById = new Map((actors || []).map((actor) => [String(actor.id), actor]));
    return NextResponse.json((data || []).map((entry) => ({
      ...entry,
      actor_name: actorById.get(String(entry.actor_id || ""))?.full_name || actorById.get(String(entry.actor_id || ""))?.email || null,
    })));
  }
  if (!hasPermission(auth.context.user.role, "fvm", "view")) {
    return NextResponse.json({ error: "Permission denied: fvm.view" }, { status: 403 });
  }

  const vehicleId = params.get("vehicle_id")?.trim();
  if (!vehicleId) return NextResponse.json({ error: "A vehicle_id is required." }, { status: 400 });

  const supabase = auth.context.serviceClient;
  let courierIds: Set<string>;
  try {
    courierIds = new Set((await getAirshipCouriers(supabase)).map((courier) => courier.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to verify vehicle scope." }, { status: 500 });
  }
  const { data: vehicle, error: vehicleError } = await supabase.from("vehicles").select("id,courier_id").eq("id", vehicleId).maybeSingle();
  if (vehicleError) return NextResponse.json({ error: `Unable to verify vehicle: ${vehicleError.message}` }, { status: 500 });
  if (!vehicle || !belongsToAirshipCourier(vehicle, courierIds)) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });

  const { data, error } = await supabase.from("maintenance_automation_audit")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("calculated_at", { ascending: false })
    .limit(100);
  if (error) {
    const migrationMissing = /could not find the table|schema cache|relation .* does not exist/i.test(error.message);
    return NextResponse.json({ error: migrationMissing ? "Maintenance automation migration is not installed." : `Unable to load maintenance audit: ${error.message}` }, { status: migrationMissing ? 503 : 500 });
  }
  return NextResponse.json(data || []);
}
