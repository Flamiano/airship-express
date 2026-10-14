// Save as: app/(spnc)/spnc/app/api/sops/route.ts
//
//   GET   → all SOPs that aren't archived (includes the pending_* columns)
//   POST  → admin only: create an SOP
import { NextRequest, NextResponse } from "next/server";
import { getAuditActor, logAuditEvent } from "../../../lib/audit";
import { getSupabaseClient } from "../../../lib/supabase";
import { getSessionUserId } from "../../../lib/currentUser";
import { normalizeSessionRole } from "../../../lib/session";
import { can } from "../../../lib/rbac";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const { data, error } = await getSupabaseClient()
      .from("sops")
      .select("*")
      .is("archived_at", null) // archived SOPs are hidden; they come back from Audit Logs → Retrieve
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch SOPs error:", error);
      return NextResponse.json({ message: "Could not load SOPs.", error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sops: data ?? [] });
  } catch (err) {
    console.error("SOPs API error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "Internal server error.", error: errorMessage }, { status: 500 });
  }
}

// Create an SOP (admins only: the "Add SOP" button is hidden for employees, and the server enforces it too)
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const { data: me } = await supabase.from("users").select("role").eq("id", userId).maybeSingle();
    if (!can(normalizeSessionRole(me?.role), "sops:create")) {
      return NextResponse.json({ message: "Only admins can add SOPs." }, { status: 403 });
    }

    const body = await req.json();
    const { title, sop_code, category, scope, department, version, effective_date, review_date, content, owner, status } = body;

    if (!String(title ?? "").trim() || !String(sop_code ?? "").trim()) {
      return NextResponse.json({ message: "Title and SOP code are required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("sops")
      .insert({
        title: String(title).trim(),
        sop_code: String(sop_code).trim(),
        category: category || "general",
        scope: scope || null,
        department: department || null,
        version: version || "1.0",
        effective_date: effective_date || null,
        review_date: review_date || null,
        content: content || null,
        owner: owner || null,
        status: status || "draft",
      })
      .select()
      .single();

    if (error) {
      console.error("Create SOP error:", error);
      const duplicate = error.code === "23505";
      return NextResponse.json(
        { message: duplicate ? `SOP code "${sop_code}" already exists.` : "Could not save SOP.", error: error.message },
        { status: duplicate ? 409 : 500 }
      );
    }

    const actor = await getAuditActor(req);
    if (actor) {
      await logAuditEvent({
        ...actor,
        eventType: "user_activity",
        action: `${actor.actorName} created SOP "${data.title}"`,
        entityType: "sop",
        entityId: data.id,
        request: req,
      });
    }

    return NextResponse.json({ sop: data });
  } catch (err) {
    console.error("SOPs POST error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "Internal server error.", error: errorMessage }, { status: 500 });
  }
}