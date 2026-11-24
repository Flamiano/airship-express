import "server-only";
import { NextResponse } from "next/server";
import { hasPermission } from "../../../lib/permissions";
import { authenticateFtmRequest } from "../../../lib/server/ftmRequestAuth";
import { handleChat } from "../../../lib/server/backend/services/fleetAiService.mjs";
import { initSupabase } from "../../../lib/server/backend/config/db.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "operations", "view")) {
    return NextResponse.json({ error: "Fleet AI is not available for this account." }, { status: 403 });
  }
  let body: { message?: string; conversationId?: string; context?: { page?: string } };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  const message = body.message;
  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "A non-empty \"message\" is required." }, { status: 400 });
  }
  if (message.length > 2000) return NextResponse.json({ error: "Message is too long (max 2000 characters)." }, { status: 400 });
  if (body.conversationId && typeof body.conversationId !== "string") {
    return NextResponse.json({ error: "conversationId must be a string." }, { status: 400 });
  }

  try {
    initSupabase();
    const result = await handleChat({
      userId: context.user.id,
      role: context.user.role,
      driverId: context.user.role === "driver" ? context.user.id : null,
      message: message.trim(),
      conversationId: body.conversationId || null,
      page: body.context?.page,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Fleet AI chat error:", error);
    return NextResponse.json({ error: "SERVER_ERROR", reply: "Something went wrong on our end. Please try again." }, { status: 500 });
  }
}