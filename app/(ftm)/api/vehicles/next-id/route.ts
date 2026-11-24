import { NextResponse } from "next/server";
import { hasPermission } from "../../../lib/permissions";
import { authenticateFtmRequest } from "../../../lib/server/ftmRequestAuth";
import { getAirshipCouriers } from "../../../lib/server/ftmCourier";
import { getNextVehicleId } from "../../../lib/server/ftmVehicles";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (!hasPermission(auth.context.user.role, "fvm", "view")) return NextResponse.json({ error: "Permission denied: fvm.view" }, { status: 403 });
  try {
    const airshipCourier = (await getAirshipCouriers(auth.context.serviceClient))[0];
    if (!airshipCourier) return NextResponse.json({ error: "No active Airship Express courier is registered." }, { status: 409 });
    const requestedCourierId = new URL(request.url).searchParams.get("courier_id");
    if (requestedCourierId && requestedCourierId !== airshipCourier.id) return NextResponse.json({ error: "Vehicle IDs are issued only for Airship Express." }, { status: 400 });
    return NextResponse.json({ id: await getNextVehicleId(auth.context.serviceClient, airshipCourier.id) });
  } catch (error) {
    return NextResponse.json({ error: "Unable to calculate the next vehicle ID", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}