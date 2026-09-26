import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";
import {
  sendPayslipEmail,
  sendPayslipBatchSummary,
} from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/mailer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const admin = authResult as {
      id: string;
      email: string;
      fullName: string;
      role: string;
    };

    const { id } = await params;
    const runId = Number(id);
    if (!runId || isNaN(runId)) {
      return NextResponse.json({ error: "Invalid run ID" }, { status: 400 });
    }

    const { data: run, error: runErr } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .select("*")
      .eq("id", runId)
      .single();

    if (runErr || !run)
      return NextResponse.json(
        { error: "Payroll run not found" },
        { status: 404 }
      );

    if (run.approval_status !== "approved") {
      return NextResponse.json(
        {
          error: `Only approved runs can be distributed. Current: "${run.approval_status}".`,
        },
        { status: 400 }
      );
    }

    const { data: payslips, error: psErr } = await supabaseAdmin
      .from("hr4_payslips")
      .select(
        `id, employee_id, net_pay, hr1_employees ( id, first_name, last_name, email, employee_id_number )`
      )
      .eq("payroll_run_id", runId);

    if (psErr || !payslips || payslips.length === 0) {
      return NextResponse.json(
        { error: "No payslips found. Process the run first." },
        { status: 400 }
      );
    }

    const periodLabel = `${new Date(run.period_start).toLocaleDateString(
      "en-PH",
      { month: "long", day: "numeric" }
    )} – ${new Date(run.period_end).toLocaleDateString("en-PH", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })}`;

    const results: {
      employee_id: string;
      name: string;
      email: string;
      status: "sent" | "failed";
      reason?: string;
    }[] = [];

    for (const slip of payslips) {
      const emp = Array.isArray(slip.hr1_employees)
        ? slip.hr1_employees[0]
        : slip.hr1_employees;

      if (!emp?.email) {
        results.push({
          employee_id: slip.employee_id,
          name: emp ? `${emp.first_name} ${emp.last_name}` : "Unknown",
          email: "",
          status: "failed",
          reason: "No email on file",
        });
        continue;
      }

      const portalUrl = `${SITE_URL}/employee-portal/payslip/${slip.id}`;

      try {
        await sendPayslipEmail({
          to: emp.email,
          employeeName: `${emp.first_name} ${emp.last_name}`,
          periodStart: run.period_start,
          periodEnd: run.period_end,
          netPay: Number(slip.net_pay),
          portalUrl,
          employeeIdNumber: emp.employee_id_number,
        });

        await supabaseAdmin.from("hr4_payslip_distributions").upsert(
          {
            payroll_run_id: runId,
            employee_id: slip.employee_id,
            payslip_id: slip.id,
            email: emp.email,
            status: "sent",
            sent_at: new Date().toISOString(),
            sent_by: admin.id,
            sent_by_name: admin.fullName,
            error_message: null,
          },
          { onConflict: "payslip_id" }
        );

        results.push({
          employee_id: slip.employee_id,
          name: `${emp.first_name} ${emp.last_name}`,
          email: emp.email,
          status: "sent",
        });
      } catch (err: any) {
        console.error(`Failed to send payslip to ${emp.email}:`, err);
        await supabaseAdmin.from("hr4_payslip_distributions").upsert(
          {
            payroll_run_id: runId,
            employee_id: slip.employee_id,
            payslip_id: slip.id,
            email: emp.email,
            status: "failed",
            error_message: err?.message || "Send failed",
            sent_by: admin.id,
            sent_by_name: admin.fullName,
          },
          { onConflict: "payslip_id" }
        );
        results.push({
          employee_id: slip.employee_id,
          name: `${emp.first_name} ${emp.last_name}`,
          email: emp.email,
          status: "failed",
          reason: err?.message || "Send failed",
        });
      }
    }

    const sentCount = results.filter((r) => r.status === "sent").length;
    const failedList = results.filter((r) => r.status === "failed");

    await supabaseAdmin
      .from("hr4_payroll_runs")
      .update({
        approval_status: "distributed",
        distributed_at: new Date().toISOString(),
        distributed_by: admin.id,
        distributed_by_name: admin.fullName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId);

    try {
      await sendPayslipBatchSummary({
        to: admin.email,
        adminName: admin.fullName,
        periodLabel,
        sentCount,
        failedCount: failedList.length,
        failedList: failedList.map((f) => ({
          name: f.name,
          email: f.email || "—",
          reason: f.reason || "Unknown",
        })),
      });
    } catch (err) {
      console.error("Failed to send summary email:", err);
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      failed: failedList.length,
      results,
    });
  } catch (error: any) {
    console.error("POST /distribute error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
