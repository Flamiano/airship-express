import { NextRequest, NextResponse } from "next/server";
import { getAuditActor, logAuditEvent } from "../../../lib/audit";
import { SESSION_COOKIE_NAME } from "../../../lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const actor = await getAuditActor(request);
  let reason = "user_logout";

  try {
    const body = await request.json();
    if (body?.reason === "session_timeout") reason = body.reason;
  } catch {
    // A logout request may have no body.
  }

  if (actor) {
    await logAuditEvent({
      eventType: reason === "session_timeout" ? "session_timeout" : "logout",
      ...actor,
      action: reason === "session_timeout" ? `${actor.actorName} was logged out after inactivity` : `${actor.actorName} logged out`,
      request,
    });
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0, // expires immediately
  });

  return response;
}