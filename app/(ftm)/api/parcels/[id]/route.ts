import { NextResponse } from "next/server";
import { hasPermission } from "../../../lib/permissions";
import { authenticateFtmRequest } from "../../../lib/server/ftmRequestAuth";
import { createFtmParcelClient } from "../../../lib/server/ftmSupabase";
import { getAllowedParcelStatuses, normalizeParcelStatus } from "../../../lib/server/ftmParcels";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const parcels = createFtmParcelClient();
  if (!parcels) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const safeUpdate: Record<string, unknown> = {};

  if (body.booking_id != null || body.trip_id != null) {
    return NextResponse.json({ error: "Link parcels through the booking manifest; parcel records do not store booking_id or trip_id." }, { status: 400 });
  }
  if (body.status != null) {
    const allowed = await getAllowedParcelStatuses(parcels);
    const status = normalizeParcelStatus(body.status) || String(body.status);
    if (allowed.includes(status)) safeUpdate.status = status;
  }
  if (body.courier !== undefined) safeUpdate.courier = body.courier === null ? null : String(body.courier);
  if (!Object.keys(safeUpdate).length) return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });

  const { data, error } = await parcels.from("parcels").update(safeUpdate).eq("id", id).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message || "Failed to update parcel", details: error }, { status: 500 });
  return NextResponse.json(data || {});
}