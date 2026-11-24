import { NextResponse } from "next/server";
import { authenticateFtmRequest } from "../../../../lib/server/ftmRequestAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (auth.context.user.role !== "admin") return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 });
  const { data, error } = await auth.context.serviceClient.from("optimized_routes").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message || "Failed to fetch optimized route" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}