import { NextResponse } from "next/server";
import { authenticateFtmRequest } from "../../../../../lib/server/ftmRequestAuth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (auth.context.user.role !== "admin") return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 });
  if (id === auth.context.user.id) return NextResponse.json({ error: "You cannot lock your own account." }, { status: 400 });
  const { data, error } = await auth.context.serviceClient.auth.admin.updateUserById(id, { ban_duration: "876000h" });
  if (error) return NextResponse.json({ error: error.message || "Failed to lock account" }, { status: 500 });
  return NextResponse.json({ id, locked: true, locked_until: data.user?.banned_until || null });
}