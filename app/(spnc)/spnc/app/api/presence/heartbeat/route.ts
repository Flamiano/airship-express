// app/(spnc)/spnc/app/api/presence/heartbeat/route.ts
// POST /spnc/app/api/presence/heartbeat
// Called every ~20s by every logged-in user's browser while they're actively using the app.
import { NextResponse } from "next/server";
import { getSupabaseClient } from "../../../../lib/supabase";
import { getSessionUserId } from "../../../../lib/currentUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("users")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    console.error("Heartbeat error:", error);
    return NextResponse.json({ message: "Failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}