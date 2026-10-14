// Save as: app/(spnc)/spnc/app/api/audit-logs/[id]/restore/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuditActor, logAuditEvent } from "../../../../../lib/audit";
import { getSupabaseClient } from "../../../../../lib/supabase";
import { requirePermission } from "../../../../../lib/authz";

// Which table each archived entity lives in, and which column holds its display name.
// Several spellings are accepted so it works with whatever entity_type your DELETE routes log.
type RestoreTarget = {
  table: string;
  entityType: string; // used for the "retrieved" audit event
  label: string;      // shown in messages, e.g. "SOP"
  select: string;     // columns to read back after restoring
  nameOf: (row: Record<string, unknown>) => string;
};

const PROVIDER: RestoreTarget = {
  table: "service_providers",
  entityType: "service_provider",
  label: "service provider",
  select: "id, name",
  nameOf: (r) => String(r.name ?? "Unnamed provider"),
};

const SOP: RestoreTarget = {
  table: "sops",
  entityType: "sop",
  label: "SOP",
  select: "id, title, sop_code",
  nameOf: (r) => [r.sop_code, r.title].filter(Boolean).join(" · ") || "Untitled SOP",
};

const RATE: RestoreTarget = {
  table: "rates",
  entityType: "rate",
  label: "rate",
  select: "id, rate_code",
  nameOf: (r) => String(r.rate_code ?? "Unnamed rate"),
};

const RESTORE_TARGETS: Record<string, RestoreTarget> = {
  service_provider: PROVIDER,
  service_providers: PROVIDER,
  provider: PROVIDER,
  sop: SOP,
  sops: SOP,
  rate: RATE,
  rates: RATE,
};

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  // RBAC: restoring archived records is an audit-log action, so admin only (401 / 403 otherwise).
  const auth = await requirePermission(request, "audit-logs:view");
  if (!auth.ok) return auth.response;

  const actor = await getAuditActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = getSupabaseClient();

  const { data: log, error: logError } = await supabase
    .from("audit_logs")
    .select("id, event_type, entity_type, entity_id, metadata")
    .eq("id", id)
    .maybeSingle();

  if (logError || !log) {
    console.error("Load archive entry failed:", logError);
    return NextResponse.json({ message: "Archive entry not found." }, { status: 404 });
  }

  const target = RESTORE_TARGETS[String(log.entity_type ?? "").toLowerCase()];
  if (log.event_type !== "archive" || !target || !log.entity_id) {
    console.error("Restore rejected:", { event_type: log.event_type, entity_type: log.entity_type, entity_id: log.entity_id });
    return NextResponse.json(
      { message: `This archive entry can't be retrieved (type: ${log.entity_type ?? "unknown"}).` },
      { status: 400 }
    );
  }
  if (log.metadata?.restored_at) {
    return NextResponse.json({ message: "This record was already retrieved." }, { status: 409 });
  }
  if (log.metadata?.unrecoverable) {
    return NextResponse.json(
      { message: "This record was permanently deleted before archiving was enabled and can't be retrieved." },
      { status: 410 }
    );
  }

  // Clear archived_at so the record shows up in its list again.
  const { data: restored, error: restoreError } = await supabase
    .from(target.table)
    .update({ archived_at: null })
    .eq("id", log.entity_id)
    .select(target.select)
    .maybeSingle();

  if (restoreError) {
    console.error(`Restore ${target.label} failed:`, restoreError);
    return NextResponse.json({ message: "Couldn't retrieve this record." }, { status: 500 });
  }
  if (!restored) {
    // The row was permanently deleted (e.g. archived before soft-archive existed), so it can never come back.
    // Mark the entry so the Retrieve button turns into "Unavailable" instead of failing every time.
    await supabase
      .from("audit_logs")
      .update({ metadata: { ...(log.metadata ?? {}), unrecoverable: true } })
      .eq("id", log.id);
    return NextResponse.json(
      { message: `This ${target.label} was permanently deleted, so it can't be retrieved. Rates archived from now on can be.` },
      { status: 410 }
    );
  }

  const row = restored as unknown as Record<string, unknown>;
  const name = target.nameOf(row);

  const restoredAt = new Date().toISOString();
  const { error: auditUpdateError } = await supabase
    .from("audit_logs")
    .update({
      metadata: {
        ...(log.metadata ?? {}),
        restored_at: restoredAt,
        restored_by: actor.actorId,
        restored_by_name: actor.actorName,
      },
    })
    .eq("id", log.id);

  if (auditUpdateError) {
    console.error("Mark archive entry retrieved failed:", auditUpdateError);
    return NextResponse.json(
      { message: `The ${target.label} was retrieved, but the archive entry could not be updated.` },
      { status: 500 }
    );
  }

  await logAuditEvent({
    ...actor,
    eventType: "user_activity",
    action: `${actor.actorName} retrieved ${target.label} "${name}" from archive`,
    entityType: target.entityType,
    entityId: String(row.id),
    request,
  });

  return NextResponse.json({ success: true, restoredAt });
}