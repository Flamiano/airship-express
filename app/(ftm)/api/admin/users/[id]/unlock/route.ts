import { NextResponse } from "next/server";
import { authenticateFtmRequest } from "../../../../../lib/server/ftmRequestAuth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (auth.context.user.role !== "admin") return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 });
  const { data, error } = await auth.context.serviceClient.auth.admin.updateUserById(id, { ban_duration: "none" });
  if (error) return NextResponse.json({ error: error.message || "Failed to unlock account" }, { status: 500 });
  return NextResponse.json({ id, locked: false, locked_until: data.user?.banned_until || null });
}