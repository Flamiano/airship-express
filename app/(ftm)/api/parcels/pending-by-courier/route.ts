import { NextResponse } from "next/server";
import { hasPermission } from "../../../lib/permissions";
import { authenticateFtmRequest } from "../../../lib/server/ftmRequestAuth";
import { createFtmParcelClient } from "../../../lib/server/ftmSupabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (!hasPermission(auth.context.user.role, "vrds", "view")) {
    return NextResponse.json({ error: "Permission denied: vrds.view" }, { status: 403 });
  }
  const supabase = createFtmParcelClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { data, error } = await supabase.from("parcels").select("*").is("booking_id", null).limit(2000);
  if (error) return NextResponse.json({ error: error.message || "Failed to fetch parcels" }, { status: 500 });

  const grouped: Record<string, { courier: string; parcels: unknown[]; totalParcels: number; totalWeight: number }> = {};
  (data || []).forEach((parcel) => {
    const courier = parcel.courier || "Unassigned";
    if (!grouped[courier]) grouped[courier] = { courier, parcels: [], totalParcels: 0, totalWeight: 0 };
    grouped[courier].parcels.push(parcel);
    grouped[courier].totalParcels += 1;
    grouped[courier].totalWeight += Number(parcel.weight_kg || parcel.weight || 0);
  });
  return NextResponse.json(Object.values(grouped));
}