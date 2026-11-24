import { NextResponse } from "next/server";
import { hasPermission } from "../../lib/permissions";
import { authenticateFtmRequest } from "../../lib/server/ftmRequestAuth";
import { createFtmParcelClient } from "../../lib/server/ftmSupabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (!hasPermission(auth.context.user.role, "fvm", "view")) {
    return NextResponse.json({ error: "Permission denied: fvm.view" }, { status: 403 });
  }

  const inventorySupabase = createFtmParcelClient();
  if (!inventorySupabase) return NextResponse.json({ error: "Parcel data database is not configured" }, { status: 503 });
  const { data, error } = await inventorySupabase
    .from("inventory_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) return NextResponse.json({ error: `Unable to load inventory items: ${error.message}` }, { status: 500 });
  return NextResponse.json(data || []);
}
