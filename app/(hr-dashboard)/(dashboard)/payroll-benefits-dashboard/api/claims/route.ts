import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeId(raw: any): string {
  if (raw === null || raw === undefined) return "";
  const s = String(raw).trim();
  if (!s) return "";
  if (s === "undefined" || s === "null" || s === "NaN") return "";
  return s;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { data: claimsRaw, error: claimsError } = await supabaseAdmin
      .from("hr4_claims")
      .select("*")
      .order("submitted_at", { ascending: false });

    if (claimsError) {
      console.error("[claims GET] claims error:", claimsError);
      return NextResponse.json({ error: claimsError.message }, { status: 500 });
    }

    const claims = claimsRaw ?? [];

    const employeeUuids = Array.from(
      new Set(claims.map((c: any) => c.employee_id).filter(Boolean))
    );
    const claimTypeIds = Array.from(
      new Set(claims.map((c: any) => c.claim_type_id).filter(Boolean))
    );
    const adminIds = Array.from(
      new Set(claims.map((c: any) => c.reviewed_by).filter(Boolean))
    );

    const employeesMap = new Map<string, any>();
    const claimTypesMap = new Map<number, any>();
    const adminsMap = new Map<string, string>();

    if (employeeUuids.length > 0) {
      const { data: emps, error: empErr } = await supabaseAdmin
        .from("hr1_employees")
        .select("id, employee_id_number, first_name, last_name")
        .in("id", employeeUuids);
      if (empErr) console.error("[claims GET] employees error:", empErr);
      (emps ?? []).forEach((e: any) => employeesMap.set(e.id, e));
    }

    if (claimTypeIds.length > 0) {
      const { data: types, error: typeErr } = await supabaseAdmin
        .from("hr4_claim_types")
        .select("id, name")
        .in("id", claimTypeIds);
      if (typeErr) console.error("[claims GET] claim types error:", typeErr);
      (types ?? []).forEach((t: any) => claimTypesMap.set(t.id, t));
    }

    if (adminIds.length > 0) {
      const { data: admins, error: adminErr } = await supabaseAdmin
        .from("hr_admin")
        .select("id, full_name")
        .in("id", adminIds);
      if (adminErr) console.error("[claims GET] admins error:", adminErr);
      (admins ?? []).forEach((a: any) => adminsMap.set(a.id, a.full_name));
    }

    const enriched = claims
      .filter((c: any) => {
        const id = normalizeId(c.id);
        if (!id || !UUID_RE.test(id)) {
          console.warn("[claims GET] dropping row with invalid id:", c.id);
          return false;
        }
        return true;
      })
      .map((c: any) => {
        const emp = employeesMap.get(c.employee_id);
        const type = claimTypesMap.get(c.claim_type_id);
        const employee_name = emp
          ? `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim()
          : null;

        return {
          id: normalizeId(c.id),
          employee_id: c.employee_id,
          employee_name,
          employee_id_number: emp?.employee_id_number ?? null,
          claim_type_id: c.claim_type_id,
          claim_type_name: type?.name ?? null,
          amount: Number(c.amount ?? 0),
          description: c.description,
          receipt_url: c.receipt_url,
          status: c.status,
          submitted_at: c.submitted_at,
          reviewed_by: c.reviewed_by,
          reviewed_at: c.reviewed_at,
          reviewed_by_name: c.reviewed_by
            ? adminsMap.get(c.reviewed_by) ?? null
            : null,
          review_notes: c.review_notes,
          payroll_run_id: c.payroll_run_id,
          reimbursed_at: c.reimbursed_at,
          created_at: c.created_at,
          updated_at: c.updated_at,
        };
      });

    return NextResponse.json(enriched);
  } catch (error: any) {
    console.error("[claims GET] unexpected error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load claims" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;
    const admin = authResult as {
      id?: string;
      email?: string;
      fullName?: string;
      role?: string;
    };

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const employeeId = normalizeId(body?.employee_id);
    const claimTypeIdRaw = body?.claim_type_id;
    const amountRaw = body?.amount;
    const receiptUrlRaw = body?.receipt_url;
    const descriptionRaw = body?.description;

    if (!employeeId || !UUID_RE.test(employeeId)) {
      return NextResponse.json(
        { error: "Invalid employee. Please select a valid employee." },
        { status: 400 }
      );
    }

    const claimTypeId = Number(claimTypeIdRaw);
    if (!Number.isFinite(claimTypeId) || claimTypeId <= 0) {
      return NextResponse.json(
        { error: "Invalid claim type. Please select a valid claim type." },
        { status: 400 }
      );
    }

    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a number greater than zero." },
        { status: 400 }
      );
    }

    if (!receiptUrlRaw || typeof receiptUrlRaw !== "string") {
      return NextResponse.json(
        {
          error:
            "Receipt is required. Upload a receipt image before submitting.",
        },
        { status: 400 }
      );
    }

    const aiVerdict = body?.ai_verdict;
    const aiConfidence = body?.ai_confidence;
    const aiNotes = body?.ai_notes;
    const aiOverride = body?.ai_override === true;

    if (
      aiVerdict !== "approve" &&
      aiVerdict !== "review" &&
      aiVerdict !== "reject"
    ) {
      return NextResponse.json(
        {
          error:
            "Receipt has not been verified yet. Run the AI scan before submitting.",
        },
        { status: 400 }
      );
    }

    if (aiVerdict === "reject" && !aiOverride) {
      return NextResponse.json(
        {
          error:
            "AI rejected this receipt. Fix the issue or check the override box before submitting.",
        },
        { status: 400 }
      );
    }

    const insertPayload: Record<string, any> = {
      employee_id: employeeId,
      claim_type_id: claimTypeId,
      amount,
      description: descriptionRaw ?? null,
      receipt_url: receiptUrlRaw,
      status: "pending",
    };

    if (hasClaimAiColumns) {
      insertPayload.ai_verdict = aiVerdict;
      insertPayload.ai_confidence =
        typeof aiConfidence === "number" ? aiConfidence : null;
      insertPayload.ai_notes = aiNotes ?? null;
      insertPayload.ai_override = aiOverride;
    }

    const { data, error } = await supabaseAdmin
      .from("hr4_claims")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error("[claims POST] insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabaseAdmin.from("hr4_claim_receipt_verifications").insert({
      claim_id: data.id,
      employee_id: employeeId,
      receipt_url: receiptUrlRaw,
      claimed_amount: amount,
      claimed_description: descriptionRaw ?? null,
      claimed_claim_type: String(claimTypeId),
      verdict: aiVerdict,
      confidence: typeof aiConfidence === "number" ? aiConfidence : 0,
      notes: aiNotes ?? null,
      provider: body?.ai_provider ?? "unknown",
      model: body?.ai_model ?? "unknown",
      verified_by: admin.id ?? null,
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error("[claims POST] unexpected error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create claim" },
      { status: 500 }
    );
  }
}

const hasClaimAiColumns = true;
