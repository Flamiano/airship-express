const express = require('express');
const ExcelJS = require('exceljs');
const { getServiceSupabase, getParcelsSupabase } = require('../config/db');

const router = express.Router();

// Keep this allowlist explicit so a backup cannot accidentally expose Supabase
// internals or tables belonging to another application in the same project.
const BACKUP_TABLES = [
  '_migrations',
  'alerts',
  'alert_history',
  'ai_conversations',
  'ai_messages',
  'bookings',
  'cost_entries',
  'couriers',
  'dispatches',
  'driver_assignments',
  'driver_performance',
  'driver_push_tokens',
  'driver_tracking',
  'drivers',
  'expenses',
  'fuel_logs',
  'incident_reports',
  'locations',
  'maintenance_history',
  'mobile_device_tracking',
  'notifications',
  'optimized_routes',
  'parcels',
  'parcels_for_pickup',
  'pickup_events',
  'role_change_audit',
  'route_plan_bookings',
  'route_plan_parcels',
  'route_plans',
  'tracking_history',
  'trip_statistics',
  'trip_stops',
  'trips',
  'users',
  'vehicles',
  'vehicle_documents',
  'vehicle_gps_tracking',
];

const PARCEL_BACKUP_TABLES = ['parcels'];

async function readAllRows(supabase, table) {
  const pageSize = 1000;
  const rows = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(offset, offset + pageSize - 1);

    if (error) {
      if (/relation .* does not exist|could not find the table/i.test(error.message || '')) {
        return { rows: [], skipped: true, reason: 'Table is not available in the current Supabase schema.' };
      }
      return { rows: [], skipped: true, reason: error.message || 'Supabase did not return this table.' };
    }

    const page = Array.isArray(data) ? data : [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return { rows, skipped: false };
}

function toPlainText(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(toPlainText).join(', ');
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, nestedValue]) => `${key}: ${toPlainText(nestedValue)}`)
      .join('\n');
  }

  const text = String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function styleHeader(row) {
  row.height = 26;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBE185D' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF9F1239' } } };
  });
}

function styleDataRows(worksheet, startRow) {
  for (let rowNumber = startRow; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    row.height = 22;
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
      if (rowNumber % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
  }
}

router.get('/export', async (req, res) => {
  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ message: 'Supabase backup service is not configured.' });

  try {
    const tables = {};
    const tableStatus = {};

    for (const table of BACKUP_TABLES) {
      const result = await readAllRows(supabase, table);
      if (!result.skipped) {
        tables[table] = result.rows;
        tableStatus[table] = 'Included';
      }
    }

    const parcelConfigured = Boolean(
      (process.env.FTM_PARCELS_SUPABASE_URL || process.env.PARCELS_SUPABASE_URL || process.env.NEXT_PUBLIC_FTM_PARCEL_SUPABASE_URL)
      && (process.env.FTM_PARCELS_SUPABASE_SERVICE_ROLE_KEY || process.env.FTM_PARCELS_SUPABASE_ANON_KEY || process.env.PARCELS_SUPABASE_SERVICE_ROLE_KEY || process.env.PARCELS_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_FTM_PARCEL_SUPABASE_ANON_KEY)
    );
    const parcelSupabase = parcelConfigured ? getParcelsSupabase() : null;
    if (parcelSupabase) {
      for (const table of PARCEL_BACKUP_TABLES) {
        const workbookTable = `parcel_${table}`;
        const result = await readAllRows(parcelSupabase, table);
        if (!result.skipped) {
          tables[workbookTable] = result.rows;
          tableStatus[workbookTable] = 'Included from parcel Supabase';
        }
      }
    }

    const exportedAt = new Date();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Airship Express';
    workbook.created = exportedAt;
    workbook.modified = exportedAt;

    const summarySheet = workbook.addWorksheet('Backup Summary', {
      views: [{ state: 'frozen', ySplit: 6 }],
    });
    summarySheet.mergeCells('A1:C1');
    summarySheet.getCell('A1').value = 'Airship Express | FTM and Parcel Supabase Backup';
    summarySheet.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 16 };
    summarySheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF831843' } };
    summarySheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
    summarySheet.getRow(1).height = 34;
    summarySheet.addRow(['Exported at', exportedAt.toLocaleString(), '']);
    summarySheet.addRow(['Format', 'Excel workbook with plain-text table values', '']);
    summarySheet.addRow(['Included tables', String(Object.keys(tables).length), '']);
    summarySheet.addRow([]);
    summarySheet.addRow(['Table', 'Rows', 'Status']);
    styleHeader(summarySheet.getRow(6));
    for (const [table, rows] of Object.entries(tables)) summarySheet.addRow([table, String(rows.length), tableStatus[table]]);
    styleDataRows(summarySheet, 7);
    summarySheet.columns = [{ width: 34 }, { width: 42 }, { width: 30 }];

    for (const [table, rows] of Object.entries(tables)) {
      const worksheet = workbook.addWorksheet(table.slice(0, 31), {
        views: [{ state: 'frozen', ySplit: 4 }],
      });
      const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
      worksheet.mergeCells(1, 1, 1, Math.max(keys.length, 1));
      worksheet.getCell(1, 1).value = `${table} | ${rows.length} records`;
      worksheet.getCell(1, 1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
      worksheet.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF831843' } };
      worksheet.getCell(1, 1).alignment = { vertical: 'middle', horizontal: 'left' };
      worksheet.getRow(1).height = 30;
      worksheet.addRow(['Status', tableStatus[table], `Exported ${exportedAt.toLocaleString()}`]);
      worksheet.addRow([]);
      worksheet.addRow(keys.length > 0 ? keys : ['message']);
      styleHeader(worksheet.getRow(4));
      if (rows.length === 0) {
        worksheet.addRow([tableStatus[table] === 'Included' ? 'No rows found in this table.' : `No rows exported: ${tableStatus[table]}`]);
      } else {
        for (const row of rows) worksheet.addRow(keys.map((key) => toPlainText(row[key])));
      }
      styleDataRows(worksheet, 5);
      worksheet.columns = (keys.length > 0 ? keys : ['message']).map((key) => ({
        key,
        width: Math.min(42, Math.max(16, key.length + 3)),
      }));
      worksheet.autoFilter = { from: 'A4', to: `${worksheet.getColumn(keys.length || 1).letter}4` };
    }

    const workbookBuffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="airship-express-supabase-backup-${exportedAt.toISOString().slice(0, 10)}.xlsx"`);
    return res.send(workbookBuffer);
  } catch (error) {
    console.error('Supabase backup export failed:', error);
    return res.status(500).json({ message: 'The system backup could not be created.' });
  }
});

module.exports = router;