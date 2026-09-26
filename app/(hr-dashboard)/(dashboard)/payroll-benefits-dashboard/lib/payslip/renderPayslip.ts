import "server-only";
import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";

export type PayslipRenderData = {
  companyName: string;
  companyAddress: string;
  logoPath: string;
  periodLabel: string;
  employee: {
    email: string;
    name: string;
    position: string;
    idNumber: string;
    cutOff: string;
    dailyRate: number | null;
  };
  earnings: {
    totalPay: number;
    daysWorked: number;
    overtime: number;
    regularHoliday: number;
    specialHoliday: number;
    incentives: number;
    load: number;
    transpo: number;
    miscellaneous: number;
    gas: number;
    adjustment: number;
  };
  deductions: {
    sss: number;
    pagibig: number;
    philhealth: number;
    sssLoan: number;
    pagibigLoan: number;
    cashAdvanceBalance: number;
    tardiness: number;
    penalty: number;
    employeeSavings: number;
    excess: number;
  };
  grossTotal: number;
  totalDeduction: number;
  netPay: number;
};

function peso(n: number | null | undefined): string {
  if (n === null || n === undefined) return "0.00";
  return Number(n).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapeHtml(input: string | null | undefined): string {
  if (input === null || input === undefined) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveLogoFileUrl(logoPath: string): string | null {
  const publicDir = path.join(process.cwd(), "public");

  const candidates = [
    logoPath,
    "images/logo-remove-bg.png",
    "images/logo.png",
    "images/logo-airship.png",
    "images/airship-logo.png",
    "images/airship-express-logo.png",
    "logo-remove-bg.png",
    "logo.png",
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const cleaned = candidate.replace(/^\/+/, "").replace(/^public\//, "");
    const absolute = path.join(publicDir, cleaned);
    if (existsSync(absolute)) {
      return `file://${absolute.replace(/\\/g, "/")}`;
    }
  }

  return null;
}

function buildLogoBlock(logoFileUrl: string | null): string {
  if (!logoFileUrl) {
    return `<div class="logo-fallback">AE</div>`;
  }
  return `<img src="${logoFileUrl}" alt="Airship Express" />`;
}

export function buildPayslipHtml(data: PayslipRenderData): string {
  const logoFileUrl = resolveLogoFileUrl(data.logoPath);
  const logoBlock = buildLogoBlock(logoFileUrl);
  const monthHeader = data.periodLabel.split(" ")[0].toUpperCase();

  return `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(data.periodLabel)} Payslip</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; color: #1c1b1f; background: #ffffff; }
  .sheet { width: 190mm; margin: 0 auto; }

  .header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 16px;
  }
  .header img { height: 62px; object-fit: contain; }
  .header .logo-fallback {
    width: 62px;
    height: 62px;
    border-radius: 8px;
    background: #e5167e;
    color: #ffffff;
    font-weight: 700;
    font-size: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    letter-spacing: 1px;
  }
  .header .titles h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: #1c1b1f;
  }
  .header .titles p {
    margin: 4px 0 0;
    font-size: 11px;
    color: #6b6b76;
  }

  .banner {
    background: #d9a8c2;
    border: 2px solid #8f3b68;
    text-align: center;
    padding: 8px 0;
    font-weight: 700;
    font-size: 15px;
    letter-spacing: 1px;
    color: #4a1f37;
    margin-bottom: 0;
    font-style: italic;
  }

  table.layout { width: 100%; border-collapse: collapse; }
  table.layout > tbody > tr > td { vertical-align: top; padding: 0; }
  .col-left { width: 55%; border-right: 3px solid #8f3b68; }
  .col-right { width: 45%; }

  table.info { width: 100%; border-collapse: collapse; }
  table.info td {
    border: 1px solid #8f3b68;
    padding: 5px 8px;
    font-size: 11px;
    vertical-align: middle;
  }
  .label {
    background: #f7eef3;
    font-weight: 600;
    width: 38%;
    color: #4a1f37;
    text-transform: uppercase;
  }
  .value { color: #1c1b1f; }
  .money {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .section-band {
    background: #d9a8c2;
    text-align: center;
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 1px;
    color: #4a1f37;
    padding: 5px 0;
    border: 1px solid #8f3b68;
    border-top: none;
    text-transform: uppercase;
  }

  .total-band {
    background: #d9a8c2;
    font-weight: 700;
    color: #4a1f37;
    font-size: 12px;
    letter-spacing: 0.5px;
  }
  .total-band td {
    border: 1px solid #8f3b68;
    padding: 6px 8px;
  }

  .net-label {
    background: #d9a8c2;
    font-weight: 700;
    text-align: center;
    font-size: 14px;
    letter-spacing: 2px;
    color: #4a1f37;
    border: 1px solid #8f3b68;
    border-bottom: none;
    padding: 8px 0;
    text-transform: uppercase;
  }
  .net-value {
    border: 1px solid #8f3b68;
    padding: 12px;
    font-size: 22px;
    font-weight: 700;
    text-align: center;
    color: #0b8f6b;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.5px;
  }

  .footer-note {
    margin-top: 10px;
    font-size: 9px;
    color: #8a8a93;
    text-align: center;
    letter-spacing: 0.3px;
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      ${logoBlock}
      <div class="titles">
        <h1>R.E.T AIRSHIP COURIER SERVICES</h1>
        <p>352 Escolta St., Tomas Pinpin, Binondo, Manila.</p>
      </div>
    </div>

    <div class="banner">
      PAYSLIP FOR THE MONTH OF ${escapeHtml(data.periodLabel.toUpperCase())}
    </div>

    <table class="layout">
      <tbody>
        <tr>
          <td class="col-left">
            <table class="info">
              <tr>
                <td class="label">Email Address</td>
                <td class="value" colspan="2">${escapeHtml(
                  data.employee.email
                )}</td>
              </tr>
              <tr>
                <td class="label">Name</td>
                <td class="value" colspan="2">${escapeHtml(
                  data.employee.name
                )}</td>
              </tr>
              <tr>
                <td class="label">Position</td>
                <td class="value" colspan="2">${escapeHtml(
                  data.employee.position
                )}</td>
              </tr>
            </table>

            <div class="section-band">Earnings</div>
            <table class="info">
              <tr><td class="label">Total Pay</td><td class="value money" colspan="2">${peso(
                data.earnings.totalPay
              )}</td></tr>
              <tr><td class="label">Days Worked</td><td class="value money" colspan="2">${
                data.earnings.daysWorked
              }</td></tr>
              <tr><td class="label">Overtime</td><td class="value money" colspan="2">${peso(
                data.earnings.overtime
              )}</td></tr>
              <tr><td class="label">Regular Holiday</td><td class="value money" colspan="2">${peso(
                data.earnings.regularHoliday
              )}</td></tr>
              <tr><td class="label">Special Holiday</td><td class="value money" colspan="2">${peso(
                data.earnings.specialHoliday
              )}</td></tr>
              <tr><td class="label">Incentives</td><td class="value money" colspan="2">${peso(
                data.earnings.incentives
              )}</td></tr>
            </table>

            <div class="section-band">Allowances</div>
            <table class="info">
              <tr><td class="label">Load</td><td class="value money" colspan="2">${peso(
                data.earnings.load
              )}</td></tr>
              <tr><td class="label">Transpo</td><td class="value money" colspan="2">${peso(
                data.earnings.transpo
              )}</td></tr>
              <tr><td class="label">Miscellaneous</td><td class="value money" colspan="2">${peso(
                data.earnings.miscellaneous
              )}</td></tr>
              <tr><td class="label">Gas</td><td class="value money" colspan="2">${peso(
                data.earnings.gas
              )}</td></tr>
              <tr><td class="label">Adjustment</td><td class="value money" colspan="2">${peso(
                data.earnings.adjustment
              )}</td></tr>
            </table>
          </td>

          <td class="col-right">
            <table class="info">
              <tr>
                <td class="label" style="width:45%">Month of ${monthHeader}</td>
                <td class="value"></td>
              </tr>
              <tr>
                <td class="label">Cut Off Period</td>
                <td class="value">${escapeHtml(data.employee.cutOff)}</td>
              </tr>
              <tr>
                <td class="label">Daily Rate</td>
                <td class="value money">${
                  data.employee.dailyRate !== null
                    ? peso(data.employee.dailyRate)
                    : "-"
                }</td>
              </tr>
            </table>

            <div class="section-band">Deduction</div>
            <table class="info">
              <tr><td class="label" style="width:55%">SSS</td><td class="value money">${peso(
                data.deductions.sss
              )}</td></tr>
              <tr><td class="label">Pag-IBIG</td><td class="value money">${peso(
                data.deductions.pagibig
              )}</td></tr>
              <tr><td class="label">PhilHealth</td><td class="value money">${peso(
                data.deductions.philhealth
              )}</td></tr>
            </table>

            <div class="section-band">Loans</div>
            <table class="info">
              <tr><td class="label" style="width:55%">SSS Loan</td><td class="value money">${peso(
                data.deductions.sssLoan
              )}</td></tr>
              <tr><td class="label">Pag-IBIG Loan</td><td class="value money">${peso(
                data.deductions.pagibigLoan
              )}</td></tr>
              <tr><td class="label">Cash Advance Balance</td><td class="value money">${peso(
                data.deductions.cashAdvanceBalance
              )}</td></tr>
            </table>

            <div class="section-band">Other Deduction</div>
            <table class="info">
              <tr><td class="label" style="width:55%">Tardiness</td><td class="value money">${peso(
                data.deductions.tardiness
              )}</td></tr>
              <tr><td class="label">Penalty Deduction</td><td class="value money">${peso(
                data.deductions.penalty
              )}</td></tr>
              <tr><td class="label">Employee's Savings</td><td class="value money">${peso(
                data.deductions.employeeSavings
              )}</td></tr>
              <tr><td class="label">Excess</td><td class="value money">${peso(
                data.deductions.excess
              )}</td></tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="col-left total-band" style="border-left:1px solid #8f3b68;border-right:3px solid #8f3b68;border-bottom:1px solid #8f3b68;padding:0">
            <table style="width:100%;border-collapse:collapse">
              <tr>
                <td style="padding:7px 8px;font-size:12px;width:40%;border-right:1px solid #8f3b68;text-transform:uppercase">Gross Total</td>
                <td style="padding:7px 8px;font-size:13px;text-align:right;font-variant-numeric:tabular-nums;font-weight:700">${peso(
                  data.grossTotal
                )}</td>
              </tr>
            </table>
          </td>
          <td class="col-right total-band" style="border-right:1px solid #8f3b68;border-bottom:1px solid #8f3b68;padding:0">
            <table style="width:100%;border-collapse:collapse">
              <tr>
                <td style="padding:7px 8px;font-size:12px;width:55%;border-right:1px solid #8f3b68;text-transform:uppercase">Total Deduction</td>
                <td style="padding:7px 8px;font-size:13px;text-align:right;font-variant-numeric:tabular-nums;font-weight:700">${peso(
                  data.totalDeduction
                )}</td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td colspan="2" style="padding:0">
            <div class="net-label">Net Pay</div>
            <div class="net-value">₱ ${peso(data.netPay)}</div>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="footer-note">
      Generated by R.E.T Airship Courier Services payroll system.
    </div>
  </div>
</body>
</html>
  `.trim();
}

export async function renderPayslipPng(
  data: PayslipRenderData,
  outputFileName: string
): Promise<{ publicUrl: string; absolutePath: string }> {
  const html = buildPayslipHtml(data);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--font-render-hinting=none",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: 794,
      height: 1123,
      deviceScaleFactor: 2,
    });
    await page.setContent(html, { waitUntil: "networkidle0" });

    const outDir = path.join(process.cwd(), "public", "generated-payslips");
    await fs.mkdir(outDir, { recursive: true });

    const absolutePath = path.join(outDir, outputFileName);
    await page.screenshot({
      path: absolutePath,
      fullPage: true,
      type: "png",
      omitBackground: false,
    });

    return {
      publicUrl: `/generated-payslips/${outputFileName}`,
      absolutePath,
    };
  } finally {
    await browser.close();
  }
}
