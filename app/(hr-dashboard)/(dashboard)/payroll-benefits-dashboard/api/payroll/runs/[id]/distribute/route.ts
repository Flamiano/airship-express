import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { sendPayslipEmail } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/mailer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const MAX_SENDS = 3;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const runId = Number(id);
    if (!runId || isNaN(runId)) {
      return NextResponse.json({ error: "Invalid run ID" }, { status: 400 });
    }

    const { data: run, error: runErr } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .select("id, period_start, period_end, approval_status, distribute_count")
      .eq("id", runId)
      .single();

    if (runErr || !run) {
      return NextResponse.json(
        { error: "Payroll run not found" },
        { status: 404 }
      );
    }

    if (
      run.approval_status !== "approved" &&
      run.approval_status !== "distributed"
    ) {
      return NextResponse.json(
        { error: "Run must be approved by Financial before distributing." },
        { status: 400 }
      );
    }

    const currentCount = Number(run.distribute_count || 0);
    if (currentCount >= MAX_SENDS) {
      return NextResponse.json(
        {
          error: `Distribution limit reached. This run has already been sent ${MAX_SENDS} times.`,
          send_count: currentCount,
          max_sends: MAX_SENDS,
          can_send_more: false,
        },
        { status: 429 }
      );
    }

    const { data: payslips, error: slipErr } = await supabaseAdmin
      .from("hr4_payslips")
      .select(
        `id, employee_id, net_pay,
        hr1_employees ( first_name, last_name, email )`
      )
      .eq("payroll_run_id", runId);

    if (slipErr) {
      return NextResponse.json({ error: slipErr.message }, { status: 500 });
    }

    if (!payslips || payslips.length === 0) {
      return NextResponse.json(
        { error: "No payslips found for this run." },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL_HR!;

    let sent = 0;
    let failed = 0;
    const failedList: Array<{ name: string; email: string; reason: string }> =
      [];

    for (const slip of payslips) {
      const emp = Array.isArray(slip.hr1_employees)
        ? slip.hr1_employees[0]
        : slip.hr1_employees;
      if (!emp?.email) {
        failed++;
        failedList.push({
          name: emp ? `${emp.first_name} ${emp.last_name}` : "Unknown",
          email: "—",
          reason: "No email on file",
        });
        continue;
      }

      const portalUrl = `${baseUrl}/employee-portal/payslip/${slip.id}`;
      const employeeName = `${emp.first_name} ${emp.last_name}`;

      try {
        await sendPayslipEmail({
          to: emp.email,
          employeeName,
          periodStart: run.period_start,
          periodEnd: run.period_end,
          netPay: Number(slip.net_pay || 0),
          portalUrl,
          employeeIdNumber: "",
        });

        await supabaseAdmin.from("hr4_payslip_distributions").upsert(
          {
            payroll_run_id: runId,
            employee_id: slip.employee_id,
            payslip_id: slip.id,
            email: emp.email,
            status: "sent",
            sent_at: new Date().toISOString(),
          },
          { onConflict: "payslip_id" }
        );

        sent++;
      } catch (err: any) {
        failed++;
        failedList.push({
          name: employeeName,
          email: emp.email,
          reason: err?.message || "Send failed",
        });

        await supabaseAdmin.from("hr4_payslip_distributions").upsert(
          {
            payroll_run_id: runId,
            employee_id: slip.employee_id,
            payslip_id: slip.id,
            email: emp.email,
            status: "failed",
            error_message: err?.message || "Send failed",
          },
          { onConflict: "payslip_id" }
        );
      }
    }

    const newCount = currentCount + 1;

    await supabaseAdmin
      .from("hr4_payroll_runs")
      .update({
        distribute_count: newCount,
        distributed_at: new Date().toISOString(),
        approval_status: "distributed",
      })
      .eq("id", runId);

    return NextResponse.json({
      sent,
      failed,
      failedList,
      send_count: newCount,
      max_sends: MAX_SENDS,
      can_send_more: newCount < MAX_SENDS,
      remaining_sends: Math.max(0, MAX_SENDS - newCount),
    });
  } catch (error: any) {
    console.error("POST /distribute error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
