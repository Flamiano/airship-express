import { NextResponse } from "next/server";
import { hasPermission } from "../../../lib/permissions";
import { authenticateFtmRequest } from "../../../lib/server/ftmRequestAuth";
import { createFtmParcelClient } from "../../../lib/server/ftmSupabase";
import { getAllowedParcelStatuses } from "../../../lib/server/ftmParcels";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (!hasPermission(auth.context.user.role, "vrds", "view")) {
    return NextResponse.json({ error: "Permission denied: vrds.view" }, { status: 403 });
  }
  const supabase = createFtmParcelClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  return NextResponse.json({ statuses: await getAllowedParcelStatuses(supabase) });
}