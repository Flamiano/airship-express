// Save as: app/(spnc)/spnc/app/api/rates/route.ts
//
//   GET   → all rates that aren't archived (includes the pending_* columns)
//   POST  → admin only: create a rate
import { NextRequest, NextResponse } from "next/server";
import { getAuditActor, logAuditEvent } from "../../../lib/audit";
import { getSupabaseClient } from "../../../lib/supabase";
import { getSessionUserId } from "../../../lib/currentUser";
import { normalizeSessionRole } from "../../../lib/session";
import { can } from "../../../lib/rbac";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Rates are standalone records: no route or service provider link.
const RATE_SELECT = "*";

function toNullableText(v: unknown) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
// Money: keep centavos, rounded to 2 decimals
function toMoney(v: unknown, fallback = 0) {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : fallback;
}

// All rates that aren't archived (the Rates list and the Requests table).
// Archived rates are hidden here and can be brought back from Audit Logs → Retrieve.
export async function GET() {
  try {
    const supabase = getSupabaseClient();

    const list = (hideArchived: boolean) => {
      let q = supabase.from("rates").select(RATE_SELECT);
      if (hideArchived) q = q.is("archived_at", null);
      return q.order("created_at", { ascending: false, nullsFirst: false });
    };

    let { data, error } = await list(true);
    // If the archived_at column doesn't exist yet, just list everything.
    if (error && (error.code === "42703" || /archived_at/i.test(error.message || ""))) {
      ({ data, error } = await list(false));
    }

    if (error) {
      console.error("Fetch rates error:", error);
      return NextResponse.json({ message: "Could not load rates.", error: error.message }, { status: 500 });
    }
    return NextResponse.json({ rates: data ?? [] });
  } catch (err) {
    console.error("Rates API error:", err);
    return NextResponse.json({ message: "Internal server error.", error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

// Create a rate (admins only: the "Add Rate" button is hidden for employees, and the server enforces it too)
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const { data: me } = await supabase.from("users").select("role").eq("id", userId).maybeSingle();
    if (!can(normalizeSessionRole(me?.role), "rates:create")) {
      return NextResponse.json({ message: "Only admins can add rates." }, { status: 403 });
    }

    const body = await req.json();
    const { rate_code, description, department, charge_type, currency, base_rate, min_charge, surcharge_pct, valid_from, valid_to, status, notes } = body;

    if (!toNullableText(rate_code) || base_rate === undefined || base_rate === null || base_rate === "") {
      return NextResponse.json({ message: "Rate code and base rate are required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("rates")
      .insert({
        rate_code: String(rate_code).trim(),
        description: toNullableText(description),
        department: toNullableText(department),
        charge_type: charge_type || "per_kg",
        currency: currency || "PHP",
        base_rate: toMoney(base_rate),
        min_charge: toMoney(min_charge),
        surcharge_pct: toMoney(surcharge_pct),
        valid_from: toNullableText(valid_from),
        valid_to: toNullableText(valid_to),
        status: status || "draft",
        notes: toNullableText(notes),
        created_at: new Date().toISOString(),
      })
      .select(RATE_SELECT)
      .single();

    if (error) {
      console.error("Create rate error:", error);
      const duplicate = error.code === "23505";
      return NextResponse.json(
        { message: duplicate ? `Rate code "${rate_code}" already exists.` : "Could not save rate.", error: error.message },
        { status: duplicate ? 409 : 500 }
      );
    }

    const actor = await getAuditActor(req);
    if (actor)
      await logAuditEvent({ ...actor, eventType: "user_activity", action: `${actor.actorName} created rate "${data.rate_code}"`, entityType: "rate", entityId: data.id, request: req });

    return NextResponse.json({ rate: data });
  } catch (err) {
    console.error("Rates POST error:", err);
    return NextResponse.json({ message: "Internal server error.", error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}