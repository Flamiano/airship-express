import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get("include_archived") === "true";

    let query = supabaseAdmin
      .from("hr4_claims")
      .select(
        "id, employee_id, claim_type_id, amount, description, receipt_url, status, submitted_at, reviewed_by, reviewed_at, review_notes, payroll_run_id, reimbursed_at, created_at, updated_at, is_archived, archived_at, archived_by"
      );

    if (!includeArchived) {
      query = query.eq("is_archived", false);
    }

    const { data: claims, error } = await query.order("submitted_at", {
      ascending: false,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = claims || [];

    const employeeIds = Array.from(
      new Set(rows.map((c) => c.employee_id).filter(Boolean))
    );
    const claimTypeIds = Array.from(
      new Set(rows.map((c) => c.claim_type_id).filter(Boolean))
    );
    const reviewerIds = Array.from(
      new Set(rows.map((c) => c.reviewed_by).filter((v): v is string => !!v))
    );

    const [{ data: employees }, { data: claimTypes }, { data: reviewers }] =
      await Promise.all([
        employeeIds.length
          ? supabaseAdmin
              .from("hr1_employees")
              .select(
                "id, employee_id_number, first_name, last_name, department"
              )
              .in("id", employeeIds)
          : Promise.resolve({ data: [] as any[] }),
        claimTypeIds.length
          ? supabaseAdmin
              .from("hr4_claim_types")
              .select("id, name, requires_receipt")
              .in("id", claimTypeIds)
          : Promise.resolve({ data: [] as any[] }),
        reviewerIds.length
          ? supabaseAdmin
              .from("hr_admin")
              .select("id, full_name")
              .in("id", reviewerIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

    const employeeMap = new Map((employees || []).map((e) => [e.id, e]));
    const claimTypeMap = new Map((claimTypes || []).map((t) => [t.id, t]));
    const reviewerMap = new Map((reviewers || []).map((r) => [r.id, r]));

    const result = rows.map((c) => {
      const employee = employeeMap.get(c.employee_id);
      const claimType = claimTypeMap.get(c.claim_type_id);
      const reviewer = c.reviewed_by ? reviewerMap.get(c.reviewed_by) : null;

      return {
        ...c,
        amount: Number(c.amount),
        employee_name: employee
          ? `${employee.first_name} ${employee.last_name}`
          : "Unknown Employee",
        employee_id_number: employee?.employee_id_number ?? null,
        department: employee?.department ?? null,
        claim_type_name: claimType?.name ?? "Unknown Type",
        requires_receipt: claimType?.requires_receipt ?? true,
        reviewed_by_name: reviewer?.full_name ?? null,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /claims error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { employee_id, claim_type_id, amount, description, receipt_url } =
      body;

    if (!employee_id || !claim_type_id || !amount) {
      return NextResponse.json(
        { error: "employee_id, claim_type_id, and amount are required." },
        { status: 400 }
      );
    }

    if (Number(amount) <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than zero" },
        { status: 400 }
      );
    }

    const { data: claimType, error: claimTypeError } = await supabaseAdmin
      .from("hr4_claim_types")
      .select("max_amount, requires_receipt, is_active")
      .eq("id", claim_type_id)
      .maybeSingle();

    if (claimTypeError || !claimType) {
      return NextResponse.json(
        { error: "Invalid claim type" },
        { status: 400 }
      );
    }

    if (!claimType.is_active) {
      return NextResponse.json(
        { error: "This claim type is no longer active" },
        { status: 400 }
      );
    }

    if (
      claimType.max_amount !== null &&
      Number(amount) > Number(claimType.max_amount)
    ) {
      return NextResponse.json(
        {
          error: `Amount exceeds the max allowed (₱${claimType.max_amount}) for this claim type`,
        },
        { status: 400 }
      );
    }

    if (claimType.requires_receipt && !receipt_url) {
      return NextResponse.json(
        { error: "This claim type requires a receipt" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("hr4_claims")
      .insert({
        employee_id,
        claim_type_id,
        amount: Number(amount),
        description: description || null,
        receipt_url: receipt_url || null,
        status: "pending",
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_archived: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating claim:", error);
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "23505" ? 409 : 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /claims error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
