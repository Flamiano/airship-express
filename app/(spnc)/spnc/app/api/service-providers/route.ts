// app/(spnc)/spnc/app/api/service-providers/route.ts
//
//   GET   → all providers that are not archived (includes the pending_* columns)
//   POST  → admin only: create a provider
import { NextRequest, NextResponse } from "next/server";
import { getAuditActor, logAuditEvent } from "../../../lib/audit";
import { getSupabaseClient } from "../../../lib/supabase";
import { getSessionUserId } from "../../../lib/currentUser";
import { normalizeSessionRole } from "../../../lib/session";
import { can } from "../../../lib/rbac";

// Lists only providers that are not archived.
export async function GET(req: NextRequest) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("service_providers")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fetch providers error:", error);
    return NextResponse.json({ message: "Couldn't load providers." }, { status: 500 });
  }

  return NextResponse.json({ providers: data });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseClient();

  // Admins only (the "Add Provider" button is hidden for employees, but the server must enforce it too).
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { data: me } = await supabase.from("users").select("role").eq("id", userId).maybeSingle();
  if (!can(normalizeSessionRole(me?.role), "providers:create")) {
    return NextResponse.json({ message: "Only admins can add providers." }, { status: 403 });
  }

  const body = await req.json();
  const {
    name, type, agency, department, contact_person, email, phone,
    address, country, service_modes, rating, status, contract_ref, notes, attachments,
  } = body;

  if (!name || !type) {
    return NextResponse.json({ message: "Company name and type are required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("service_providers")
    .insert({
      name,
      type,
      agency: agency || null,
      department: department || null,
      contact_person: contact_person || null,
      email: email || null,
      phone: phone || null,
      address: address || null,
      country: country || null,
      service_modes: Array.isArray(service_modes) ? service_modes : [],
      rating: rating ?? 3,
      status: status || "active",
      contract_ref: contract_ref || null,
      notes: notes || null,
      attachments: Array.isArray(attachments) ? attachments : [],
    })
    .select()
    .single();

  if (error) {
    console.error("Create provider error:", error);
    return NextResponse.json({ message: "Couldn't create provider." }, { status: 500 });
  }

  const actor = await getAuditActor(req);
  if (actor) {
    await logAuditEvent({
      ...actor,
      eventType: "user_activity",
      action: `${actor.actorName} created service provider "${data.name}"`,
      entityType: "service_provider",
      entityId: data.id,
      request: req,
    });
  }

  return NextResponse.json({ provider: data }, { status: 201 });
}