import { NextResponse } from "next/server";
import { authenticateFtmRequest } from "../../../lib/server/ftmRequestAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (auth.context.user.role !== "admin") return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 });
  const { data, error } = await auth.context.serviceClient.from("optimized_routes")
    .select("id, trip_id, distance_km, estimated_duration_min, generated_by, created_at")
    .order("created_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: error.message || "Failed to fetch optimized routes" }, { status: 500 });
  return NextResponse.json(data || []);
}