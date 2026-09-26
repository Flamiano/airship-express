"use server";

import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { renderPayslipPng } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/payslip/renderPayslip";
import { buildPayslipRenderData } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/payslip/getPayslipData";
import type { PayslipRenderData } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/payslip/renderPayslip";

export type GenerateResult =
  | {
      ok: true;
      url: string;
      downloadUrl: string;
      label: string;
      employeeName: string;
      netPay: number;
      periodLabel: string;
      isDemo: boolean;
    }
  | { ok: false; error: string };

function buildDemoRenderData(): PayslipRenderData {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 16);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthName = start
    .toLocaleDateString("en-PH", { month: "long" })
    .toUpperCase();

  return {
    companyName: "R.E.T AIRSHIP COURIER SERVICES",
    companyAddress: "352 Escolta St., Tomas Pinpin, Binondo, Manila.",
    logoPath: "images/logo-remove-bg.png",
    periodLabel: `${monthName} 16-${end.getDate()}, ${now.getFullYear()}`,
    employee: {
      email: "juan.delacruz@airship-express.com",
      name: "DELA CRUZ, JUAN",
      position: "MARKETING/ADMIN STAFF",
      idNumber: "AE-0001",
      cutOff: `PERIOD ${monthName} 16 - ${end
        .toLocaleDateString("en-PH", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
        .toUpperCase()}`,
      dailyRate: 610,
    },
    earnings: {
      totalPay: 11130,
      daysWorked: 11,
      overtime: 762.5,
      regularHoliday: 915,
      specialHoliday: 183,
      incentives: 1500,
      load: 0,
      transpo: 500,
      miscellaneous: 0,
      gas: 0,
      adjustment: 0,
    },
    deductions: {
      sss: 450,
      pagibig: 100,
      philhealth: 275,
      sssLoan: 0,
      pagibigLoan: 0,
      cashAdvanceBalance: 0,
      tardiness: 0,
      penalty: 0,
      employeeSavings: 0,
      excess: 0,
    },
    grossTotal: 14990.5,
    totalDeduction: 825,
    netPay: 14165.5,
  };
}

export async function generatePayslipImageForEmployee(
  employeeNameQuery: string,
  specificRunId?: number
): Promise<GenerateResult> {
  try {
    const cleaned = (employeeNameQuery || "").trim();

    if (!cleaned || cleaned === "__EXAMPLE__") {
      const demo = buildDemoRenderData();
      const fileName = `payslip_example_${Date.now()}.png`;
      const { publicUrl } = await renderPayslipPng(demo, fileName);
      return {
        ok: true,
        url: publicUrl,
        downloadUrl: publicUrl,
        label: `Example Payslip — ${demo.periodLabel}`,
        employeeName: "Sample Employee",
        netPay: demo.netPay,
        periodLabel: demo.periodLabel,
        isDemo: true,
      };
    }

    const parts = cleaned.split(/\s+/);
    const first = parts[0] || "";
    const last = parts.slice(1).join(" ") || "";

    let matches: any[] = [];

    if (last) {
      const { data } = await supabaseAdmin
        .from("hr1_employees")
        .select("id, first_name, last_name")
        .or(
          `and(first_name.ilike.%${first}%,last_name.ilike.%${last}%),` +
            `and(first_name.ilike.%${last}%,last_name.ilike.%${first}%)`
        )
        .limit(5);
      matches = data || [];
    }

    if (matches.length === 0 && first) {
      const { data } = await supabaseAdmin
        .from("hr1_employees")
        .select("id, first_name, last_name")
        .or(`first_name.ilike.%${first}%,last_name.ilike.%${first}%`)
        .limit(5);
      matches = data || [];
    }

    if (matches.length === 0) {
      const demo = buildDemoRenderData();
      const fileName = `payslip_example_${Date.now()}.png`;
      const { publicUrl } = await renderPayslipPng(demo, fileName);
      return {
        ok: true,
        url: publicUrl,
        downloadUrl: publicUrl,
        label: `Example Payslip — ${demo.periodLabel}`,
        employeeName: cleaned,
        netPay: demo.netPay,
        periodLabel: demo.periodLabel,
        isDemo: true,
      };
    }

    const emp = matches[0];

    let slipQuery = supabaseAdmin
      .from("hr4_payslips")
      .select(`id, net_pay`)
      .eq("employee_id", emp.id);

    if (specificRunId) {
      slipQuery = slipQuery.eq("payroll_run_id", specificRunId);
    } else {
      slipQuery = slipQuery.order("created_at", { ascending: false });
    }

    const { data: latestSlip } = await slipQuery.limit(1).maybeSingle();

    if (!latestSlip) {
      const demo = buildDemoRenderData();
      const fileName = `payslip_example_${Date.now()}.png`;
      const { publicUrl } = await renderPayslipPng(demo, fileName);
      return {
        ok: true,
        url: publicUrl,
        downloadUrl: publicUrl,
        label: `Example Payslip — ${demo.periodLabel}`,
        employeeName: `${emp.first_name} ${emp.last_name}`,
        netPay: demo.netPay,
        periodLabel: demo.periodLabel,
        isDemo: true,
      };
    }

    const renderData = await buildPayslipRenderData(latestSlip.id);
    if (!renderData) {
      return { ok: false, error: "Could not load payslip data." };
    }

    const safeName = `${emp.last_name}_${emp.first_name}_${latestSlip.id}`
      .replace(/[^A-Za-z0-9_-]/g, "_")
      .toLowerCase();
    const fileName = `${safeName}_${Date.now()}.png`;

    const { publicUrl } = await renderPayslipPng(renderData, fileName);

    return {
      ok: true,
      url: publicUrl,
      downloadUrl: publicUrl,
      label: `${emp.first_name} ${emp.last_name} — ${renderData.periodLabel}`,
      employeeName: `${emp.first_name} ${emp.last_name}`,
      netPay: renderData.netPay,
      periodLabel: renderData.periodLabel,
      isDemo: false,
    };
  } catch (err: any) {
    console.error("[generatePayslipImage] error:", err);
    return {
      ok: false,
      error: err?.message || "Payslip generation failed.",
    };
  }
}
