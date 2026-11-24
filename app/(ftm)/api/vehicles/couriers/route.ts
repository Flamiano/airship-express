import { NextResponse } from "next/server";
import { hasPermission } from "../../../lib/permissions";
import { authenticateFtmRequest } from "../../../lib/server/ftmRequestAuth";
import { getAirshipCouriers } from "../../../lib/server/ftmCourier";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (!hasPermission(auth.context.user.role, "fvm", "view")) return NextResponse.json({ error: "Permission denied: fvm.view" }, { status: 403 });
  try {
    const couriers = await getAirshipCouriers(auth.context.serviceClient);
    return NextResponse.json(couriers.slice(0, 1));
  } catch (error) {
    return NextResponse.json({ error: "Unable to load Airship Express courier", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}