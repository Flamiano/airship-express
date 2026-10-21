// POST /api/login/lock-status   body: { idNumber }   ->   { locked: boolean }
// Save this file as app/api/login/lock-status/route.ts (next to the login route folder's other
// routes). The login page calls it every few seconds while it is locked, so that when an admin
// unlocks the account the page opens straight away instead of waiting out its cooldown.
// It only reports whether a lock exists. It never counts as a failed attempt and never
// accepts a password.

import { NextRequest, NextResponse } from "next/server";
import { getPasswordLockRemaining } from "../../../../lib/authLimiter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_ID_LENGTH = 64;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = typeof body?.idNumber === "string" ? body.idNumber.trim() : "";

  // Same ID rules as the login route: anything else can't be a real ID.
  if (!id || id.length > MAX_ID_LENGTH || !/^[A-Za-z0-9._-]+$/.test(id)) {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  const remaining = await getPasswordLockRemaining(id);
  return NextResponse.json({ locked: remaining > 0 }, { headers: { "Cache-Control": "no-store" } });
}