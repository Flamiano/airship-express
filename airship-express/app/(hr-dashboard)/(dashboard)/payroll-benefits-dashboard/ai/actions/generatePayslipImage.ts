import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import type { FoundEmployee } from "./findEmployeeByName";

function esc(value: any) {
  return String(value ?? "").replace(
    /[&<>]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string)
  );
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export async function generatePayslipImage(employee: FoundEmployee) {
  const [{ data: payrollInfo }, { data: latestRun }] = await Promise.all([
    supabaseAdmin
      .from("hr4_employee_payroll_info")
      .select("*")
      .eq("employee_id", employee.id)
      .maybeSingle(),
    supabaseAdmin
      .from("hr4_payroll_runs")
      .select("*")
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const position = employee.raw.position || employee.raw.job_title || "";
  const email = employee.raw.email || employee.raw.work_email || "";

  const periodLabel = latestRun
    ? `${new Date(latestRun.period_start).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      })}-${new Date(latestRun.period_end).toLocaleDateString("en-US", {
        day: "numeric",
        year: "numeric",
      })}`
    : "Current Period";

  const dailyRate = payrollInfo?.daily_rate ?? null;
  const grossTotal = payrollInfo?.gross_pay ?? null;
  const netPay = payrollInfo?.net_pay ?? null;
  const sssDeduction = payrollInfo?.sss_deduction ?? null;
  const philhealthDeduction = payrollInfo?.philhealth_deduction ?? null;
  const pagibigDeduction = payrollInfo?.pagibig_deduction ?? null;
  const totalDeduction = payrollInfo?.total_deduction ?? null;
  const daysWorked = payrollInfo?.days_worked ?? "";

  const leftRow = (label: string, value: string, y: number) => `
    <text x="24" y="${y}" font-family="Arial, sans-serif" font-size="13" font-weight="600" fill="#1a1a1a">${esc(
    label
  )}</text>
    <text x="230" y="${y}" font-family="Arial, sans-serif" font-size="13" fill="#1a1a1a">${esc(
    value
  )}</text>`;

  const rightRow = (label: string, value: string, y: number) => `
    <text x="634" y="${y}" font-family="Arial, sans-serif" font-size="13" font-weight="600" fill="#1a1a1a">${esc(
    label
  )}</text>
    <text x="900" y="${y}" font-family="Arial, sans-serif" font-size="13" fill="#1a1a1a">${esc(
    value
  )}</text>`;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1220" height="1000" viewBox="0 0 1220 1000">
  <rect width="1220" height="1000" fill="#faf9f7" />
  <text x="24" y="66" font-family="Arial, sans-serif" font-size="34" font-weight="900" fill="#111">R.E.T AIRSHIP COURIER SERVICES</text>
  <text x="24" y="94" font-family="Arial, sans-serif" font-size="17" fill="#333">352 Escolta St., Tomas Pinpin, Binondo, Manila.</text>

  <rect x="10" y="120" width="1200" height="60" fill="#c98ab8" />
  <text x="610" y="158" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="800" font-style="italic" fill="#1a1a1a">PAYSLIP FOR THE PERIOD OF ${esc(
    periodLabel
  ).toUpperCase()}</text>

  <rect x="10" y="180" width="1200" height="800" fill="#ffffff" stroke="#d9c3d3" />
  <line x1="610" y1="180" x2="610" y2="980" stroke="#c98ab8" stroke-width="10" />

  ${leftRow("EMAIL ADDRESS", email, 225)}
  ${leftRow("NAME", esc(employee.displayName).toUpperCase(), 265)}
  ${leftRow("POSITION", String(position).toUpperCase(), 305)}
  ${rightRow("CUT OFF PERIOD", `PERIOD ${periodLabel.toUpperCase()}`, 265)}
  ${rightRow("DAILY RATE", dailyRate !== null ? money(dailyRate) : "-", 305)}

  <rect x="20" y="325" width="580" height="32" fill="#c98ab8" />
  <text x="310" y="347" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="800" fill="#1a1a1a">EARNINGS</text>
  <rect x="620" y="325" width="580" height="32" fill="#c98ab8" />
  <text x="910" y="347" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="800" fill="#1a1a1a">DEDUCTION</text>

  ${leftRow("TOTAL PAY", grossTotal !== null ? money(grossTotal) : "", 385)}
  ${leftRow("DAYS WORKED", String(daysWorked), 415)}
  ${leftRow("OVERTIME", "", 445)}
  ${leftRow("REGULAR HOLIDAY", "", 475)}
  ${leftRow("SPECIAL HOLIDAY", "", 505)}
  ${leftRow("INCENTIVES", "", 535)}

  ${rightRow("SSS", sssDeduction !== null ? money(sssDeduction) : "", 385)}
  ${rightRow(
    "PAG-IBIG",
    pagibigDeduction !== null ? money(pagibigDeduction) : "",
    415
  )}
  ${rightRow(
    "PHILHEALTH",
    philhealthDeduction !== null ? money(philhealthDeduction) : "",
    445
  )}

  <rect x="620" y="465" width="580" height="32" fill="#c98ab8" />
  <text x="910" y="487" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="800" fill="#1a1a1a">LOANS</text>
  ${rightRow("SSS LOAN", "0.00", 522)}
  ${rightRow("PAG-IBIG LOAN", "0.00", 552)}
  ${rightRow("CASH ADVANCE BALANCE", "", 582)}

  <rect x="20" y="560" width="580" height="32" fill="#c98ab8" />
  <text x="310" y="582" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="800" fill="#1a1a1a">ALLOWANCES</text>
  ${leftRow("LOAD", "0.00", 615)}
  ${leftRow("TRANSPO", "0.00", 645)}
  ${leftRow("MISCELLANEOUS", "0.00", 675)}
  ${leftRow("GAS", "0.00", 705)}
  ${leftRow("ADJUSTMENT", "", 735)}

  <rect x="620" y="605" width="580" height="32" fill="#c98ab8" />
  <text x="910" y="627" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="800" fill="#1a1a1a">OTHER DEDUCTION</text>
  ${rightRow("TARDINESS", "", 660)}
  ${rightRow("PENALTY DEDUCTION", "", 690)}
  ${rightRow("EMPLOYEE'S SAVINGS", "0.00", 720)}
  ${rightRow("EXCESS", "", 750)}

  <rect x="20" y="790" width="580" height="38" fill="#c98ab8" />
  <text x="38" y="815" font-family="Arial, sans-serif" font-size="15" font-weight="800" fill="#1a1a1a">GROSS TOTAL</text>
  <text x="580" y="815" text-anchor="end" font-family="Arial, sans-serif" font-size="15" fill="#1a1a1a">${
    grossTotal !== null ? money(grossTotal) : ""
  }</text>

  <rect x="620" y="790" width="580" height="38" fill="#c98ab8" />
  <text x="638" y="815" font-family="Arial, sans-serif" font-size="15" font-weight="800" fill="#1a1a1a">TOTAL DEDUCTION</text>
  <text x="1180" y="815" text-anchor="end" font-family="Arial, sans-serif" font-size="15" fill="#1a1a1a">${
    totalDeduction !== null ? money(totalDeduction) : ""
  }</text>

  <rect x="20" y="833" width="1180" height="44" fill="#c98ab8" />
  <text x="610" y="862" text-anchor="middle" font-family="Arial, sans-serif" font-size="19" font-weight="900" fill="#1a1a1a">NET PAY: ${
    netPay !== null ? "₱" + money(netPay) : ""
  }</text>
</svg>`.trim();

  const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString(
    "base64"
  )}`;

  return { svgDataUrl, employeeFullName: employee.displayName, periodLabel };
}
