import { NextResponse } from "next/server";
import { hasPermission } from "../../../../lib/permissions";
import { authenticateFtmRequest } from "../../../../lib/server/ftmRequestAuth";
import { normalizeTrip, updateTripStatus } from "../../../../lib/server/ftmTrips";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "operations", "create")) {
    return NextResponse.json({ error: "Permission denied: operations.create" }, { status: 403 });
  }
  const result = await updateTripStatus(context.serviceClient, id, "Completed", 100);
  if (result.error) return NextResponse.json({ error: `Unable to update trip: ${result.error.message}` }, { status: 500 });
  if (!result.data) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  return NextResponse.json(normalizeTrip(result.data));
}