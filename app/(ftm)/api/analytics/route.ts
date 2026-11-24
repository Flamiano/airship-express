import { NextResponse } from "next/server";
import { hasPermission } from "../../lib/permissions";
import { authenticateFtmRequest } from "../../lib/server/ftmRequestAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (!hasPermission(auth.context.user.role, "operations", "view")) {
    return NextResponse.json({ error: "Permission denied: operations.view" }, { status: 403 });
  }
  const { data, error } = await auth.context.serviceClient.from("trip_statistics").select("*");
  if (error) {
    console.error("Supabase analytics query error:", error.message);
    return NextResponse.json({ error: "Failed to fetch analytics data" }, { status: 500 });
  }
  return NextResponse.json(data);
}