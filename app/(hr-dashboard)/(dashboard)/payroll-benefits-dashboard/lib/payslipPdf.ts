import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type PayslipPdfData = {
  companyName: string;
  companyAddress: string;
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

function clean(text: string): string {
  return String(text || "")
    .replace(/₱/g, "PHP ")
    .replace(/[^\x20-\x7E]/g, "");
}

export async function buildPayslipPdf(
  data: PayslipPdfData,
  password: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Payslip - ${data.periodLabel}`);
  pdfDoc.setAuthor("R.E.T Airship Courier Services");
  pdfDoc.setSubject("Payslip");

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdfDoc.embedFont(StandardFonts.Courier);

  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();

  const pink = rgb(0.85, 0.66, 0.76);
  const pinkLight = rgb(0.97, 0.93, 0.95);
  const purpleDark = rgb(0.29, 0.12, 0.22);
  const ink = rgb(0.11, 0.11, 0.12);
  const muted = rgb(0.42, 0.42, 0.46);
  const green = rgb(0.04, 0.56, 0.42);

  let y = height - 50;

  page.drawRectangle({
    x: 40,
    y: y - 30,
    width: width - 80,
    height: 40,
    color: rgb(0.9, 0.09, 0.49),
  });
  page.drawText("AE", {
    x: 50,
    y: y - 20,
    size: 20,
    font: bold,
    color: rgb(1, 1, 1),
  });

  page.drawText(clean("R.E.T AIRSHIP COURIER SERVICES"), {
    x: 90,
    y: y - 8,
    size: 13,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(clean("352 Escolta St., Tomas Pinpin, Binondo, Manila."), {
    x: 90,
    y: y - 22,
    size: 8,
    font,
    color: rgb(1, 1, 1),
  });

  y -= 55;

  page.drawRectangle({
    x: 40,
    y: y - 4,
    width: width - 80,
    height: 22,
    color: pink,
  });
  page.drawText(
    clean(`PAYSLIP FOR THE MONTH OF ${data.periodLabel.toUpperCase()}`),
    {
      x: 50,
      y: y + 2,
      size: 10,
      font: bold,
      color: purpleDark,
    }
  );

  y -= 30;

  const colLeft = 40;
  const colRight = width / 2 + 10;
  const colWidth = width / 2 - 50;

  const drawRow = (
    x: number,
    yy: number,
    w: number,
    label: string,
    value: string,
    align: "left" | "right" = "left",
    isHeader = false
  ) => {
    page.drawRectangle({
      x,
      y: yy - 4,
      width: w,
      height: 18,
      color: isHeader ? pink : pinkLight,
      borderColor: purpleDark,
      borderWidth: 0.5,
    });
    page.drawText(clean(label), {
      x: x + 6,
      y: yy + 1,
      size: 8,
      font: bold,
      color: purpleDark,
    });
    const text = clean(value);
    const textWidth = font.widthOfTextAtSize(text, 8);
    page.drawText(text, {
      x: align === "right" ? x + w - textWidth - 6 : x + w * 0.55,
      y: yy + 1,
      size: 8,
      font,
      color: ink,
    });
  };

  drawRow(colLeft, y, colWidth, "EMAIL ADDRESS", data.employee.email);
  drawRow(colLeft, y - 18, colWidth, "NAME", data.employee.name);
  drawRow(colLeft, y - 36, colWidth, "POSITION", data.employee.position);
  drawRow(colLeft, y - 54, colWidth, "EMPLOYEE ID", data.employee.idNumber);

  drawRow(
    colRight,
    y,
    colWidth,
    "MONTH OF",
    data.periodLabel.split(" ")[0].toUpperCase()
  );
  drawRow(colRight, y - 18, colWidth, "CUT OFF PERIOD", data.employee.cutOff);
  drawRow(
    colRight,
    y - 36,
    colWidth,
    "DAILY RATE",
    data.employee.dailyRate ? peso(data.employee.dailyRate) : "-",
    "right"
  );

  y -= 80;

  drawRow(colLeft, y, colWidth, "EARNINGS", "", "left", true);
  drawRow(colRight, y, colWidth, "DEDUCTION", "", "left", true);

  const leftRows = [
    ["Total Pay", peso(data.earnings.totalPay)],
    ["Days Worked", String(data.earnings.daysWorked)],
    ["Overtime", peso(data.earnings.overtime)],
    ["Regular Holiday", peso(data.earnings.regularHoliday)],
    ["Special Holiday", peso(data.earnings.specialHoliday)],
    ["Incentives", peso(data.earnings.incentives)],
  ];
  const rightRows = [
    ["SSS", peso(data.deductions.sss)],
    ["Pag-IBIG", peso(data.deductions.pagibig)],
    ["PhilHealth", peso(data.deductions.philhealth)],
  ];

  let ly = y - 18;
  for (const [label, value] of leftRows) {
    drawRow(colLeft, ly, colWidth, label, value, "right");
    ly -= 18;
  }

  let ry = y - 18;
  for (const [label, value] of rightRows) {
    drawRow(colRight, ry, colWidth, label, value, "right");
    ry -= 18;
  }

  const leftY2 = Math.min(ly, y - 18 - rightRows.length * 18);

  drawRow(colLeft, leftY2, colWidth, "ALLOWANCES", "", "left", true);
  const allowanceRows = [
    ["Load", peso(data.earnings.load)],
    ["Transpo", peso(data.earnings.transpo)],
    ["Miscellaneous", peso(data.earnings.miscellaneous)],
    ["Gas", peso(data.earnings.gas)],
    ["Adjustment", peso(data.earnings.adjustment)],
  ];
  let lay = leftY2 - 18;
  for (const [label, value] of allowanceRows) {
    drawRow(colLeft, lay, colWidth, label, value, "right");
    lay -= 18;
  }

  drawRow(colRight, ry, colWidth, "LOANS", "", "left", true);
  const loanRows = [
    ["SSS Loan", peso(data.deductions.sssLoan)],
    ["Pag-IBIG Loan", peso(data.deductions.pagibigLoan)],
    ["Cash Advance", peso(data.deductions.cashAdvanceBalance)],
  ];
  let loy = ry - 18;
  for (const [label, value] of loanRows) {
    drawRow(colRight, loy, colWidth, label, value, "right");
    loy -= 18;
  }

  drawRow(colRight, loy, colWidth, "OTHER DEDUCTION", "", "left", true);
  const otherRows = [
    ["Tardiness", peso(data.deductions.tardiness)],
    ["Penalty", peso(data.deductions.penalty)],
    ["Employee's Savings", peso(data.deductions.employeeSavings)],
    ["Excess", peso(data.deductions.excess)],
  ];
  let oy = loy - 18;
  for (const [label, value] of otherRows) {
    drawRow(colRight, oy, colWidth, label, value, "right");
    oy -= 18;
  }

  const bottomY = Math.min(lay, oy) - 10;

  drawRow(
    colLeft,
    bottomY,
    colWidth,
    "GROSS TOTAL",
    peso(data.grossTotal),
    "right",
    true
  );
  drawRow(
    colRight,
    bottomY,
    colWidth,
    "TOTAL DEDUCTION",
    peso(data.totalDeduction),
    "right",
    true
  );

  const netY = bottomY - 30;
  page.drawRectangle({
    x: colLeft,
    y: netY - 20,
    width: width - 80,
    height: 30,
    color: pink,
    borderColor: purpleDark,
    borderWidth: 0.5,
  });
  page.drawText("NET PAY", {
    x: colLeft + 20,
    y: netY - 10,
    size: 12,
    font: bold,
    color: purpleDark,
  });
  const netText = `PHP ${peso(data.netPay)}`;
  const netWidth = mono.widthOfTextAtSize(netText, 16);
  page.drawText(netText, {
    x: width - 40 - netWidth - 20,
    y: netY - 12,
    size: 16,
    font: mono,
    color: green,
  });

  page.drawText(
    clean("Generated by R.E.T Airship Courier Services payroll system."),
    {
      x: 40,
      y: 30,
      size: 7,
      font,
      color: muted,
    }
  );

  const bytes = await pdfDoc.save({
    userPassword: password,
    ownerPassword: password,
    permissions: {
      printing: "highResolution",
      modifying: false,
      copying: false,
      annotating: false,
      fillingForms: false,
      contentAccessibility: true,
      documentAssembly: false,
    },
  } as any);

  return bytes;
}
