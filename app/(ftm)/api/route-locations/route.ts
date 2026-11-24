import { NextResponse } from "next/server";
import { hasPermission } from "../../lib/permissions";
import { authenticateFtmRequest } from "../../lib/server/ftmRequestAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (!hasPermission(auth.context.user.role, "vrds", "view")) {
    return NextResponse.json({ error: "Permission denied: vrds.view" }, { status: 403 });
  }

  const { data, error } = await auth.context.serviceClient
    .from("locations")
    .select("id,name,address,latitude,longitude,is_active")
    .or("is_active.eq.true,is_active.is.null")
    .order("name", { ascending: true });
  if (error) {
    if (/could not find the table|schema cache|relation .* does not exist/i.test(error.message)) return NextResponse.json([]);
    return NextResponse.json({ error: `Unable to load route locations: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json(data || []);
}