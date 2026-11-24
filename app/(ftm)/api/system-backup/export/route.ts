import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { authenticateFtmRequest } from "../../../lib/server/ftmRequestAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKUP_TABLES = [
  "_migrations", "alerts", "alert_history", "ai_conversations", "ai_messages", "bookings", "cost_entries", "couriers",
  "dispatches", "driver_assignments", "driver_performance", "driver_push_tokens", "driver_tracking", "drivers", "expenses",
  "fuel_logs", "incident_reports", "locations", "maintenance_history", "mobile_device_tracking", "notifications",
  "optimized_routes", "parcels", "inventory_items", "parcels_for_pickup", "pickup_events", "role_change_audit", "route_plan_bookings",
  "route_plan_parcels", "route_plans", "tracking_history", "trip_statistics", "trip_stops", "trips", "users", "vehicles",
  "vehicle_documents", "vehicle_gps_tracking",
];

async function readAllRows(supabase: SupabaseClient, table: string) {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from(table).select("*").range(offset, offset + 999);
    if (error) {
      if (/relation .* does not exist|could not find the table/i.test(error.message || "")) return { rows: [], skipped: true };
      return { rows: [], skipped: true };
    }
    const page = Array.isArray(data) ? data : [];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return { rows, skipped: false };
}

function toPlainText(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(toPlainText).join(", ");
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([key, nested]) => `${key}: ${toPlainText(nested)}`).join("\n");
  const text = String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (auth.context.user.role !== "admin") return NextResponse.json({ message: "You do not have permission to export a system backup." }, { status: 403 });

  const supabase = auth.context.serviceClient;
  const tables: Record<string, Record<string, unknown>[]> = {};
  const tableStatus: Record<string, string> = {};
  try {
    for (const table of BACKUP_TABLES) {
      const result = await readAllRows(supabase, table);
      if (!result.skipped) {
        tables[table] = result.rows;
        tableStatus[table] = "Included";
      }
    }

    const exportedAt = new Date();
    const workbook = XLSX.utils.book_new();
    const summaryRows = [
      ["Airship Express | FTM Supabase Backup", "", ""],
      ["Exported at", exportedAt.toLocaleString(), ""],
      ["Format", "Excel workbook with plain-text table values", ""],
      ["Included tables", String(Object.keys(tables).length), ""],
      [],
      ["Table", "Rows", "Status"],
      ...Object.entries(tables).map(([table, rows]) => [table, String(rows.length), tableStatus[table]]),
    ];
    const summary = XLSX.utils.aoa_to_sheet(summaryRows);
    summary["!cols"] = [{ wch: 34 }, { wch: 42 }, { wch: 30 }];
    summary["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
    XLSX.utils.book_append_sheet(workbook, summary, "Backup Summary");

    for (const [table, rows] of Object.entries(tables)) {
      const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
      const headers = columns.length ? columns : ["message"];
      const sheetRows = [
        [`${table} | ${rows.length} records`],
        ["Status", tableStatus[table], `Exported ${exportedAt.toLocaleString()}`],
        [],
        headers,
        ...(rows.length ? rows.map((row) => columns.map((column) => toPlainText(row[column]))) : [["No rows found in this table."]]),
      ];
      const sheet = XLSX.utils.aoa_to_sheet(sheetRows);
      const columnCount = Math.max(columns.length, 1);
      sheet["!cols"] = headers.map((column) => ({ wch: Math.min(42, Math.max(16, column.length + 3)) }));
      sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columnCount - 1 } }];
      sheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: 3, c: columnCount - 1 } }) };
      XLSX.utils.book_append_sheet(workbook, sheet, table.slice(0, 31));
    }

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="airship-express-supabase-backup-${exportedAt.toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Supabase backup export failed:", error);
    return NextResponse.json({ message: "The system backup could not be created." }, { status: 500 });
  }
}