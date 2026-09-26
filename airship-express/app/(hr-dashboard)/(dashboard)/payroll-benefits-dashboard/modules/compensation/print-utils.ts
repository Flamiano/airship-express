"use client";

export interface PrintColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  format?: (value: any, row: any) => string;
}

export interface PrintMeta {
  companyName?: string;
  companyAddress?: string;
  reportTitle: string;
  reportSubtitle?: string;
  filters?: Record<string, string | number | null | undefined>;
  logoPath?: string;
}

const peso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export const printFormatters = {
  peso,
  number: (n: number) => Number(n || 0).toLocaleString(),
  date: (value: string | null | undefined) => {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return value;
    }
  },
  text: (value: any) => (value == null ? "—" : String(value)),
  capitalize: (value: any) =>
    value == null
      ? "—"
      : String(value)
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
};

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function toDataUri(path: string): Promise<string> {
  if (typeof window === "undefined") return "";
  const origin = window.location.origin;
  const url = path.startsWith("http") ? path : `${origin}${path}`;

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = (e) => reject(e);
      el.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || 200;
    canvas.height = img.naturalHeight || 100;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } catch (err) {
    console.error("canvas logo failed:", err);
  }

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return "";
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error("fetch logo failed:", err);
    return "";
  }
}

export function buildPrintHtml(
  meta: PrintMeta,
  columns: PrintColumn[],
  rows: any[]
): string {
  const logoPath = meta.logoPath || "/images/logo-remove-bg.png";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const logoUrl = logoPath.startsWith("http")
    ? logoPath
    : `${origin}${logoPath}`;

  const now = new Date();
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const filterRows = meta.filters
    ? Object.entries(meta.filters)
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(
          ([k, v]) =>
            `<div class="filter-item"><span class="filter-key">${escapeHtml(
              k
            )}</span><span class="filter-val">${escapeHtml(
              String(v)
            )}</span></div>`
        )
        .join("")
    : "";

  const thead = columns
    .map(
      (c) =>
        `<th class="align-${c.align || "left"}">${escapeHtml(c.label)}</th>`
    )
    .join("");

  const tbody = rows
    .map((row) => {
      const cells = columns
        .map((c) => {
          const raw = row[c.key];
          const value = c.format
            ? c.format(raw, row)
            : printFormatters.text(raw);
          return `<td class="align-${c.align || "left"}">${escapeHtml(
            value
          )}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(meta.reportTitle)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
    @page { size: A4 landscape; margin: 12mm 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111; background: #fff; font-size: 11px; }
    .page { padding: 0; }
    .header { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-bottom: 12px; border-bottom: 2px solid #111; }
    .brand { display: flex; align-items: center; gap: 14px; min-width: 0; }
    .brand img { height: 56px; width: auto; object-fit: contain; }
    .brand-text { min-width: 0; }
    .brand-name { font-size: 18px; font-weight: 700; letter-spacing: -0.2px; }
    .brand-address { font-size: 10px; color: #555; margin-top: 2px; }
    .doc-meta { text-align: right; font-size: 10px; color: #444; line-height: 1.5; }
    .doc-meta .doc-type { font-size: 12px; font-weight: 600; color: #111; letter-spacing: 0.6px; text-transform: uppercase; }
    .title-block { margin-top: 14px; }
    .title { font-size: 16px; font-weight: 700; letter-spacing: -0.2px; }
    .subtitle { font-size: 11px; color: #666; margin-top: 3px; }
    .filters { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 10px; padding: 8px 10px; background: #f5f5f7; border-radius: 6px; border: 1px solid #e5e5e8; }
    .filter-item { font-size: 10px; }
    .filter-key { color: #666; text-transform: uppercase; letter-spacing: 0.4px; margin-right: 4px; }
    .filter-val { color: #111; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 10.5px; }
    thead th { background: #111; color: #fff; font-weight: 600; padding: 8px 10px; text-align: left; letter-spacing: 0.3px; text-transform: uppercase; font-size: 9.5px; border: 1px solid #111; }
    tbody td { padding: 7px 10px; border-bottom: 1px solid #e5e5e8; vertical-align: top; }
    tbody tr:nth-child(even) td { background: #fafafa; }
    tbody tr:last-child td { border-bottom: 1px solid #111; }
    .align-left { text-align: left; }
    .align-right { text-align: right; }
    .align-center { text-align: center; }
    .footer { margin-top: 16px; padding-top: 10px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; align-items: flex-end; font-size: 9.5px; color: #666; }
    .signatures { display: flex; gap: 40px; margin-top: 20px; font-size: 10px; }
    .sig-block { min-width: 180px; }
    .sig-line { border-top: 1px solid #333; padding-top: 4px; margin-top: 32px; }
    .sig-label { font-size: 9.5px; color: #555; text-transform: uppercase; letter-spacing: 0.4px; }
    .record-count { font-size: 10px; color: #555; }
</style>
</head>
<body>
<div class="page">
    <div class="header">
        <div class="brand">
            <img src="${logoUrl}" alt="Airship Express" />
            <div class="brand-text">
                <div class="brand-name">${escapeHtml(
                  meta.companyName || "Airship Express"
                )}</div>
                <div class="brand-address">${escapeHtml(
                  meta.companyAddress || "Binondo, Manila, Philippines"
                )}</div>
            </div>
        </div>
        <div class="doc-meta">
            <div class="doc-type">${escapeHtml(meta.reportTitle)}</div>
            <div>Printed on ${escapeHtml(dateStr)}</div>
            <div>at ${escapeHtml(timeStr)}</div>
        </div>
    </div>

    <div class="title-block">
        <div class="title">${escapeHtml(meta.reportTitle)}</div>
        ${
          meta.reportSubtitle
            ? `<div class="subtitle">${escapeHtml(meta.reportSubtitle)}</div>`
            : ""
        }
    </div>

    ${filterRows ? `<div class="filters">${filterRows}</div>` : ""}

    <table>
        <thead><tr>${thead}</tr></thead>
        <tbody>${tbody}</tbody>
    </table>

    <div class="signatures">
        <div class="sig-block">
            <div class="sig-line"></div>
            <div class="sig-label">Prepared by</div>
        </div>
        <div class="sig-block">
            <div class="sig-line"></div>
            <div class="sig-label">Reviewed by</div>
        </div>
        <div class="sig-block">
            <div class="sig-line"></div>
            <div class="sig-label">Approved by</div>
        </div>
    </div>

    <div class="footer">
        <div class="record-count">Total records: ${rows.length}</div>
        <div>Airship Express — Payroll &amp; Benefits Dashboard</div>
    </div>
</div>
</body>
</html>`;
}

export function printTable(
  meta: PrintMeta,
  columns: PrintColumn[],
  rows: any[]
) {
  const html = buildPrintHtml(meta, columns, rows);
  const win = window.open("", "_blank", "width=1200,height=800");
  if (!win) {
    alert("Please allow pop-ups to print this report.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();

  const triggerPrint = () => {
    try {
      win.focus();
      win.print();
    } catch (err) {
      console.error("print error:", err);
    }
  };

  if (win.document.readyState === "complete") {
    setTimeout(triggerPrint, 250);
  } else {
    win.addEventListener("load", () => setTimeout(triggerPrint, 250));
  }
}

export async function exportExcel(
  filename: string,
  columns: PrintColumn[],
  rows: any[],
  meta?: Partial<PrintMeta>
): Promise<void> {
  const XLSX = await import("xlsx-js-style");

  const companyName = meta?.companyName || "Airship Express";
  const companyAddress = meta?.companyAddress || "Binondo, Manila, Philippines";
  const reportTitle = meta?.reportTitle || "Report";
  const reportSubtitle = meta?.reportSubtitle || "";
  const filters = meta?.filters
    ? Object.entries(meta.filters).filter(
        ([, v]) => v !== null && v !== undefined && v !== ""
      )
    : [];

  const logoDataUri = await toDataUri(
    meta?.logoPath || "/images/logo-remove-bg.png"
  );

  const now = new Date();
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const colCount = columns.length;
  const wsData: any[][] = [];

  wsData.push(new Array(colCount).fill(""));
  wsData.push(new Array(colCount).fill(""));
  wsData.push(new Array(colCount).fill(""));

  const companyRowIdx = wsData.length;
  const companyRow = new Array(colCount).fill("");
  companyRow[0] = companyName;
  wsData.push(companyRow);

  const addressRowIdx = wsData.length;
  const addressRow = new Array(colCount).fill("");
  addressRow[0] = companyAddress;
  wsData.push(addressRow);

  wsData.push(new Array(colCount).fill(""));

  const titleRowIdx = wsData.length;
  const titleRow = new Array(colCount).fill("");
  titleRow[0] = reportTitle;
  wsData.push(titleRow);

  const subtitleRowIdx = wsData.length;
  const subtitleRow = new Array(colCount).fill("");
  subtitleRow[0] = reportSubtitle;
  wsData.push(subtitleRow);

  const printedRowIdx = wsData.length;
  const printedRow = new Array(colCount).fill("");
  printedRow[colCount - 1] = `Printed on ${dateStr} at ${timeStr}`;
  wsData.push(printedRow);

  wsData.push(new Array(colCount).fill(""));

  if (filters.length > 0) {
    const filterRow = new Array(colCount).fill("");
    filters.forEach(([k, v], i) => {
      if (i < colCount) {
        filterRow[i] = `${k}: ${v}`;
      }
    });
    wsData.push(filterRow);
    wsData.push(new Array(colCount).fill(""));
  }

  const headerRowIdx = wsData.length;
  wsData.push(columns.map((c) => c.label));

  const firstDataRowIdx = wsData.length;
  rows.forEach((row) => {
    const cells = columns.map((c) => {
      const raw = row[c.key];
      return c.format ? c.format(raw, row) : printFormatters.text(raw);
    });
    wsData.push(cells);
  });

  const lastDataRowIdx = wsData.length - 1;

  wsData.push(new Array(colCount).fill(""));
  wsData.push(new Array(colCount).fill(""));

  const preparedRowIdx = wsData.length;
  const preparedRow = new Array(colCount).fill("");
  preparedRow[0] = "Prepared by";
  if (colCount >= 2) preparedRow[Math.floor(colCount / 2)] = "Reviewed by";
  if (colCount >= 3) preparedRow[colCount - 1] = "Approved by";
  wsData.push(preparedRow);

  wsData.push(new Array(colCount).fill(""));
  wsData.push(new Array(colCount).fill(""));

  const footerRowIdx = wsData.length;
  const footerRow = new Array(colCount).fill("");
  footerRow[0] = `Total records: ${rows.length}`;
  footerRow[colCount - 1] = `${companyName} — Payroll & Benefits Dashboard`;
  wsData.push(footerRow);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");

  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: "s", v: "" };
      const cell = ws[addr];

      cell.s = {
        font: { name: "Calibri", sz: 11, color: { rgb: "111827" } },
        alignment: { vertical: "middle", horizontal: "left", wrapText: true },
        border: {},
        fill: { patternType: "none" },
      };

      if (r === companyRowIdx) {
        cell.s = {
          font: {
            name: "Calibri",
            sz: 18,
            bold: true,
            color: { rgb: "111827" },
          },
          alignment: { vertical: "middle", horizontal: "left" },
        };
      } else if (r === addressRowIdx) {
        cell.s = {
          font: { name: "Calibri", sz: 10, color: { rgb: "6B7280" } },
          alignment: { vertical: "middle", horizontal: "left" },
        };
      } else if (r === titleRowIdx) {
        cell.s = {
          font: {
            name: "Calibri",
            sz: 14,
            bold: true,
            color: { rgb: "111827" },
          },
          alignment: { vertical: "middle", horizontal: "left" },
        };
      } else if (r === subtitleRowIdx) {
        cell.s = {
          font: {
            name: "Calibri",
            sz: 10,
            italic: true,
            color: { rgb: "6B7280" },
          },
          alignment: { vertical: "middle", horizontal: "left" },
        };
      } else if (r === printedRowIdx) {
        cell.s = {
          font: { name: "Calibri", sz: 9, color: { rgb: "6B7280" } },
          alignment: { vertical: "middle", horizontal: "right" },
        };
      } else if (r === headerRowIdx) {
        cell.s = {
          font: {
            name: "Calibri",
            sz: 10,
            bold: true,
            color: { rgb: "FFFFFF" },
          },
          fill: { patternType: "solid", fgColor: { rgb: "111827" } },
          alignment: {
            vertical: "middle",
            horizontal: columns[c].align || "left",
            wrapText: true,
          },
          border: {
            top: { style: "thin", color: { rgb: "111827" } },
            bottom: { style: "thin", color: { rgb: "111827" } },
            left: { style: "thin", color: { rgb: "111827" } },
            right: { style: "thin", color: { rgb: "111827" } },
          },
        };
      } else if (r >= firstDataRowIdx && r <= lastDataRowIdx) {
        const isAlt = (r - firstDataRowIdx) % 2 === 1;
        cell.s = {
          font: { name: "Calibri", sz: 10, color: { rgb: "111827" } },
          fill: isAlt
            ? { patternType: "solid", fgColor: { rgb: "F8FAFC" } }
            : { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
          alignment: {
            vertical: "middle",
            horizontal: columns[c].align || "left",
            wrapText: false,
          },
          border: {
            top: { style: "thin", color: { rgb: "E5E7EB" } },
            bottom: { style: "thin", color: { rgb: "E5E7EB" } },
            left: { style: "thin", color: { rgb: "E5E7EB" } },
            right: { style: "thin", color: { rgb: "E5E7EB" } },
          },
        };
      } else if (r === preparedRowIdx) {
        cell.s = {
          font: {
            name: "Calibri",
            sz: 9,
            bold: true,
            color: { rgb: "374151" },
          },
          alignment: {
            vertical: "middle",
            horizontal: "center",
            wrapText: true,
          },
          border: {
            top: { style: "medium", color: { rgb: "374151" } },
          },
        };
      } else if (r === footerRowIdx) {
        cell.s = {
          font: { name: "Calibri", sz: 9, color: { rgb: "9CA3AF" } },
          alignment: { vertical: "middle", horizontal: "left" },
        };
      } else if (r > titleRowIdx && r < headerRowIdx) {
        cell.s = {
          font: { name: "Calibri", sz: 10, color: { rgb: "374151" } },
          fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } },
          alignment: { vertical: "middle", horizontal: "left" },
          border: {
            top: { style: "thin", color: { rgb: "E5E7EB" } },
            bottom: { style: "thin", color: { rgb: "E5E7EB" } },
            left: { style: "thin", color: { rgb: "E5E7EB" } },
            right: { style: "thin", color: { rgb: "E5E7EB" } },
          },
        };
      }
    }
  }

  const columnWidths = columns.map((col, i) => {
    let max = col.label.length;
    rows.forEach((row) => {
      const raw = row[col.key];
      const value = col.format
        ? col.format(raw, row)
        : printFormatters.text(raw);
      const len = String(value).length;
      if (len > max) max = len;
    });
    return { wch: Math.min(Math.max(max + 4, 14), 40) };
  });
  ws["!cols"] = columnWidths;

  const merges: any[] = [];
  if (colCount > 1) {
    merges.push({
      s: { r: titleRowIdx, c: 0 },
      e: { r: titleRowIdx, c: colCount - 1 },
    });
    merges.push({
      s: { r: subtitleRowIdx, c: 0 },
      e: { r: subtitleRowIdx, c: colCount - 1 },
    });
    merges.push({
      s: { r: printedRowIdx, c: 0 },
      e: { r: printedRowIdx, c: colCount - 1 },
    });
    merges.push({
      s: { r: footerRowIdx, c: 0 },
      e: { r: footerRowIdx, c: colCount - 1 },
    });
    merges.push({
      s: { r: companyRowIdx, c: 0 },
      e: { r: companyRowIdx, c: colCount - 2 },
    });
    merges.push({
      s: { r: addressRowIdx, c: 0 },
      e: { r: addressRowIdx, c: colCount - 2 },
    });
  }
  ws["!merges"] = merges;

  ws["!rows"] = wsData.map((_, idx) => {
    if (idx === companyRowIdx) return { hpt: 26 };
    if (idx === addressRowIdx) return { hpt: 16 };
    if (idx === titleRowIdx) return { hpt: 22 };
    if (idx === subtitleRowIdx) return { hpt: 16 };
    if (idx === headerRowIdx) return { hpt: 28 };
    if (idx >= firstDataRowIdx && idx <= lastDataRowIdx) return { hpt: 22 };
    if (idx === preparedRowIdx) return { hpt: 40 };
    return { hpt: 14 };
  });

  ws["!margins"] = {
    left: 0.4,
    right: 0.4,
    top: 0.5,
    bottom: 0.5,
    header: 0.3,
    footer: 0.3,
  };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, reportTitle.slice(0, 30) || "Report");

  const wsConfig = wb.Workbook?.Sheets?.[0] || {};
  wsConfig.Hidden = 0;
  if (!wb.Workbook) wb.Workbook = { Sheets: [wsConfig] };

  if (logoDataUri) {
    try {
      const match = logoDataUri.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        if (!ws["!images"]) ws["!images"] = [];
        ws["!images"].push({
          name: "airship-logo.png",
          data: logoDataUri,
          opts: {
            base64: true,
            type: match[1] as any,
          },
          positioning: {
            t: "twoCell",
            from: {
              col: Math.max(colCount - 2, 0),
              row: companyRowIdx,
              colOff: 0,
              rowOff: 0,
            },
            to: {
              col: colCount,
              row: addressRowIdx + 1,
              colOff: 0,
              rowOff: 0,
            },
          },
        });
      }
    } catch (err) {
      console.error("attach logo failed:", err);
    }
  }

  XLSX.writeFile(
    wb,
    filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`
  );
}
