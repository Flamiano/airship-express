import { NextRequest, NextResponse } from "next/server";
import { getAuditActor, logAuditEvent } from "../../../../lib/audit";
import { getSupabaseClient } from "../../../../lib/supabase";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("service_providers")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Fetch provider error:", error);
    return NextResponse.json({ message: "Couldn't load provider." }, { status: 500 });
  }

  // Viewing is not a mutation — no audit log here.

  return NextResponse.json({ provider: data });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await req.json();
  const {
    name,
    type,
    contact_person,
    email,
    phone,
    address,
    country,
    service_modes,
    rating,
    status,
    contract_ref,
    notes,
    attachments,
  } = body;

  if (!name || !type) {
    return NextResponse.json(
      { message: "Company name and type are required." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("service_providers")
    .update({
      name,
      type,
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
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Update provider error:", error);
    return NextResponse.json({ message: "Couldn't update provider." }, { status: 500 });
  }

  const actor = await getAuditActor(req);
  if (actor) {
    await logAuditEvent({
      ...actor,
      eventType: "user_activity",
      action: `${actor.actorName} updated service provider "${data.name}"`,
      entityType: "service_provider",
      entityId: data.id,
      request: req,
    });
  }

  return NextResponse.json({ provider: data });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("service_providers")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Delete provider error:", error);
    return NextResponse.json({ message: "Couldn't delete provider." }, { status: 500 });
  }

  const actor = await getAuditActor(req);
  if (actor) {
    await logAuditEvent({
      ...actor,
      eventType: "archive",
      action: `${actor.actorName} deleted service provider ${id}`,
      entityType: "service_provider",
      entityId: id,
      request: req,
    });
  }

  return NextResponse.json({ success: true });
}