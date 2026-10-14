// app/(spnc)/spnc/app/api/presence/route.ts
// GET /spnc/app/api/presence  → list of users + last_seen_at + locked flag (admins only)
import { NextResponse } from "next/server";
import { getSupabaseClient } from "../../../lib/supabase";
import { getSessionUserId } from "../../../lib/currentUser";
import { normalizeSessionRole } from "../../../lib/session";
import { can } from "../../../lib/rbac";
import { getLockedIdNumbers } from "../../../lib/authLimiter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseClient();

  // Admins only (same permission as the Create Account page).
  const { data: me } = await supabase.from("users").select("role").eq("id", userId).maybeSingle();
  const role = normalizeSessionRole(me?.role);
  if (!me || !can(role as Parameters<typeof can>[0], "users:create")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("users")
    .select("id, id_number, full_name, email, role, last_seen_at")
    .order("last_seen_at", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("Presence list error:", error);
    return NextResponse.json({ message: "Couldn't load employees." }, { status: 500 });
  }

  const users = data ?? [];
  const lockedIds = await getLockedIdNumbers(users.map((u) => u.id_number).filter((v): v is string => !!v));

  return NextResponse.json({
    serverNow: new Date().toISOString(), // page uses this to correct for clock differences
    employees: users.map((u) => ({
      ...u,
      locked: !!u.id_number && lockedIds.has(u.id_number.trim().toLowerCase()),
    })),
  });
}