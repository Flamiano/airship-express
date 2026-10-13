/**
 * Forecast Export Utilities for Airship Express
 * Supports PDF (high-fidelity print-to-PDF), Word (.doc HTML format with MSO tags),
 * and Excel (.xls formatted spreadsheet / .csv) with optional embedded chart snapshots.
 */

export interface ForecastExportOptions {
    format: 'pdf' | 'word' | 'excel';
    includeCharts: boolean;
    chartCanvases?: {
        demandChart?: HTMLCanvasElement | null;
        consumptionChart?: HTMLCanvasElement | null;
    };
}

export interface DemandForecastExportData {
    timestamp: string;
    historical_period_days: number;
    horizon_days: number;
    summary: {
        total_items: number;
        items_forecasted: number;
        total_predicted_demand: number;
        potential_shortages: number;
        critical_count: number;
        low_stock_count: number;
        normal_count: number;
        average_accuracy: number | null;
        accuracy_label: string;
    };
    items: Array<{
        item_code: string;
        item_name: string;
        category: string;
        unit: string;
        current_stock: number;
        available_stock: number;
        forecast_demand: number;
        expected_incoming: number;
        projected_stock: number;
        minimum_stock: number;
        risk_level: string;
        recommended_action: string;
        model_used: string;
        confidence: string;
    }>;
    ai_insights?: {
        summary: string;
        critical_shortages?: string[];
        trend_observations?: string[];
        procurement_actions?: string[];
    };
    consumption_analysis?: {
        top_consumed_items?: Array<{
            item_code: string;
            item_name: string;
            total_quantity: number;
            unit: string;
        }>;
        department_breakdown?: Array<{
            department: string;
            total_quantity: number;
        }>;
    };
}

export async function exportForecastReport(
    data: DemandForecastExportData | any,
    options: ForecastExportOptions
): Promise<void> {
    const format = options.format;

    if (format === 'excel') {
        exportToExcel(data);
    } else if (format === 'word') {
        exportToWord(data, options);
    } else {
        exportToPdf(data, options);
    }
}

function exportToExcel(data: DemandForecastExportData | any) {
    const rows: string[][] = [];

    // Header metadata
    rows.push(['AIRSHIP EXPRESS - AI DEMAND FORECAST & INVENTORY INTELLIGENCE REPORT']);
    rows.push([`Generated At: ${data.timestamp ? new Date(data.timestamp).toLocaleString() : new Date().toLocaleString()}`]);
    rows.push([`Historical Window: ${data.historical_period_days || 30} Days`, `Forecast Horizon: ${data.horizon_days || 7} Days`]);
    rows.push([]);

    // KPI Summary
    rows.push(['SUMMARY KEY PERFORMANCE INDICATORS']);
    rows.push(['Items in Catalog', String(data.summary?.total_items || data.items?.length || 0)]);
    rows.push(['Items Forecasted', String(data.summary?.items_forecasted || 0)]);
    rows.push(['Total Forecast Demand', String(data.summary?.total_predicted_demand || 0)]);
    rows.push(['Potential Shortages', String(data.summary?.potential_shortages || 0)]);
    rows.push(['Critical Shortage Deficit (< 0)', String(data.summary?.critical_count || 0)]);
    rows.push(['Low Stock Risk (<= Buffer)', String(data.summary?.low_stock_count || 0)]);
    rows.push(['Holdout Accuracy', String(data.summary?.accuracy_label || 'N/A')]);
    rows.push([]);

    // Main Demand Table
    rows.push([
        'Item Code',
        'Item Name',
        'Category',
        'Unit',
        'Available Stock',
        'Forecast Demand',
        'Expected Incoming',
        'Projected Stock (Est.)',
        'Minimum Stock',
        'Risk Level',
        'Recommended Action',
        'Model Used',
        'Model Confidence'
    ]);

    const items = data.items || [];
    items.forEach((item: any) => {
        rows.push([
            item.item_code || '',
            item.item_name || '',
            item.category || '',
            item.unit || '',
            String(item.available_stock ?? item.current_stock ?? 0),
            String(item.forecast_demand ?? 0),
            String(item.expected_incoming ?? 0),
            String(item.projected_stock ?? 0),
            String(item.minimum_stock ?? 0),
            item.risk_level || 'Normal',
            item.recommended_action || '',
            item.model_used || 'Standard',
            item.confidence || 'N/A'
        ]);
    });

    // CSV formatting
    const csvContent = rows
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Demand_Forecast_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function exportToWord(data: DemandForecastExportData | any, options: ForecastExportOptions) {
    const items = data.items || [];
    const dateFormatted = data.timestamp ? new Date(data.timestamp).toLocaleDateString() : new Date().toLocaleDateString();

    let chartHtml = '';
    if (options.includeCharts && options.chartCanvases?.demandChart) {
        try {
            const dataUrl = options.chartCanvases.demandChart.toDataURL('image/png');
            chartHtml = `<div style="text-align:center; margin: 20px 0;"><img src="${dataUrl}" style="max-width: 650px; border: 1px solid #ccc; border-radius: 8px;" alt="Demand Forecast Chart" /></div>`;
        } catch (e) {
            console.warn('Could not snapshot demand chart for Word export:', e);
        }
    }

    const itemsRows = items.map((i: any) => `
        <tr>
            <td style="border: 1px solid #ddd; padding: 6px;"><b>${i.item_code}</b></td>
            <td style="border: 1px solid #ddd; padding: 6px;">${i.item_name}</td>
            <td style="border: 1px solid #ddd; padding: 6px;">${i.category}</td>
            <td style="border: 1px solid #ddd; padding: 6px; text-align: right;">${i.available_stock} ${i.unit}</td>
            <td style="border: 1px solid #ddd; padding: 6px; text-align: right; color: #b45309; font-weight: bold;">${i.forecast_demand} ${i.unit}</td>
            <td style="border: 1px solid #ddd; padding: 6px; text-align: right; color: #0284c7;">+${i.expected_incoming}</td>
            <td style="border: 1px solid #ddd; padding: 6px; text-align: right; font-weight: bold; color: ${i.risk_level === 'Critical' ? '#dc2626' : i.risk_level === 'Low Stock Risk' ? '#d97706' : '#16a34a'};">${i.projected_stock}</td>
            <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">
                <span style="display:inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; background: ${i.risk_level === 'Critical' ? '#fee2e2; color: #b91c1c' : i.risk_level === 'Low Stock Risk' ? '#fef3c7; color: #b45309' : '#dcfce7; color: #15803d'};">
                    ${i.risk_level}
                </span>
            </td>
            <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px;">${i.recommended_action}</td>
        </tr>
    `).join('');

    const html = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <title>Airship Express Forecast Report</title>
            <style>
                body { font-family: Calibri, Arial, sans-serif; line-height: 1.4; color: #1e293b; padding: 20px; }
                h1 { color: #0f172a; margin-bottom: 4px; }
                .sub { color: #64748b; font-size: 13px; margin-bottom: 20px; }
                .kpi-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
                .kpi-table td { border: 1px solid #cbd5e1; padding: 10px; text-align: center; background: #f8fafc; }
                .kpi-val { font-size: 20px; font-weight: bold; color: #0f172a; }
                .kpi-lbl { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; }
                .sec-title { font-size: 15px; font-weight: bold; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; margin: 24px 0 12px; }
                table.data { width: 100%; border-collapse: collapse; font-size: 12px; }
                table.data th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-weight: bold; }
            </style>
        </head>
        <body>
            <h1>Airship Express — Inventory Demand Forecast Report</h1>
            <div class="sub">Generated: ${dateFormatted} | Window: ${data.historical_period_days || 30} Days | Horizon: ${data.horizon_days || 7} Days</div>

            <table class="kpi-table">
                <tr>
                    <td><div class="kpi-val">${data.summary?.items_forecasted || items.length}</div><div class="kpi-lbl">Items Forecasted</div></td>
                    <td><div class="kpi-val">${data.summary?.total_predicted_demand || 0}</div><div class="kpi-lbl">Total Predicted Demand</div></td>
                    <td><div class="kpi-val" style="color: #dc2626;">${data.summary?.potential_shortages || 0}</div><div class="kpi-lbl">Potential Shortages</div></td>
                    <td><div class="kpi-val">${data.summary?.average_accuracy ? data.summary.average_accuracy + '%' : 'N/A'}</div><div class="kpi-lbl">Holdout Accuracy</div></td>
                </tr>
            </table>

            ${data.ai_insights?.summary ? `
                <div class="sec-title">Executive AI Insights</div>
                <div style="background: #f8fafc; border-left: 4px solid #6366f1; padding: 12px; border-radius: 4px; font-size: 13px; line-height: 1.5;">
                    <p style="margin-top:0;">${data.ai_insights.summary}</p>
                    ${data.ai_insights.procurement_actions?.length ? `
                        <b>Recommended Procurement Directives:</b>
                        <ul>${data.ai_insights.procurement_actions.map((a: string) => `<li>${a}</li>`).join('')}</ul>
                    ` : ''}
                </div>
            ` : ''}

            ${chartHtml}

            <div class="sec-title">Item-Level Demand Predictions & Stock Projections</div>
            <table class="data">
                <thead>
                    <tr>
                        <th>Code</th>
                        <th>Item</th>
                        <th>Category</th>
                        <th>Avail. Stock</th>
                        <th>Demand</th>
                        <th>Incoming</th>
                        <th>Projected</th>
                        <th>Risk</th>
                        <th>Recommendation</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsRows}
                </tbody>
            </table>
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Demand_Forecast_Report_${new Date().toISOString().slice(0, 10)}.doc`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function exportToPdf(data: DemandForecastExportData | any, options: ForecastExportOptions) {
    // High-fidelity printable window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Please allow popups to generate the printable PDF report.');
        return;
    }

    const items = data.items || [];
    const dateFormatted = data.timestamp ? new Date(data.timestamp).toLocaleString() : new Date().toLocaleString();

    let chartImg = '';
    if (options.includeCharts && options.chartCanvases?.demandChart) {
        try {
            const dataUrl = options.chartCanvases.demandChart.toDataURL('image/png');
            chartImg = `<div style="text-align: center; margin: 16px 0;"><img src="${dataUrl}" style="max-width: 100%; border: 1px solid #cbd5e1; border-radius: 8px;" /></div>`;
        } catch (e) {
            console.warn('Chart toDataURL failed:', e);
        }
    }

    const rows = items.map((i: any) => `
        <tr>
            <td style="font-weight: 600; font-family: monospace;">${i.item_code}</td>
            <td>${i.item_name}</td>
            <td>${i.category}</td>
            <td style="text-align: right;">${i.available_stock} ${i.unit}</td>
            <td style="text-align: right; font-weight: bold; color: #b45309;">${i.forecast_demand} ${i.unit}</td>
            <td style="text-align: right; color: #0284c7;">+${i.expected_incoming}</td>
            <td style="text-align: right; font-weight: bold; color: ${i.risk_level === 'Critical' ? '#dc2626' : i.risk_level === 'Low Stock Risk' ? '#d97706' : '#16a34a'};">${i.projected_stock}</td>
            <td style="text-align: center;">
                <span class="badge ${i.risk_level === 'Critical' ? 'badge-critical' : i.risk_level === 'Low Stock Risk' ? 'badge-low' : 'badge-normal'}">
                    ${i.risk_level}
                </span>
            </td>
            <td style="font-size: 11px;">${i.recommended_action}</td>
        </tr>
    `).join('');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Demand Forecast Report - Airship Express</title>
            <style>
                @page { size: A4 landscape; margin: 12mm; }
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 12px; font-size: 12px; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; }
                .logo { font-size: 20px; font-weight: 800; color: #0f172a; }
                .meta { text-align: right; color: #64748b; font-size: 11px; }
                .kpis { display: flex; gap: 12px; margin-bottom: 16px; }
                .kpi-card { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; background: #f8fafc; text-align: center; }
                .kpi-num { font-size: 20px; font-weight: 700; color: #0f172a; }
                .kpi-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-top: 2px; }
                .ai-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #16a34a; border-radius: 6px; padding: 10px; margin-bottom: 16px; font-size: 11px; line-height: 1.5; }
                table { width: 100%; border-collapse: collapse; font-size: 11px; }
                th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; font-weight: 600; }
                td { border: 1px solid #e2e8f0; padding: 5px 8px; }
                .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; }
                .badge-critical { background: #fee2e2; color: #991b1b; }
                .badge-low { background: #fef3c7; color: #92400e; }
                .badge-normal { background: #dcfce7; color: #166534; }
                @media print {
                    .no-print { display: none !important; }
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="no-print" style="margin-bottom: 16px; display: flex; justify-content: flex-end; gap: 8px;">
                <button onclick="window.print()" style="padding: 8px 16px; background: #0f172a; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">Print / Save as PDF</button>
                <button onclick="window.close()" style="padding: 8px 16px; background: #e2e8f0; color: #0f172a; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">Close</button>
            </div>

            <div class="header">
                <div>
                    <div class="logo">AIRSHIP EXPRESS — INVENTORY DEMAND FORECAST</div>
                    <div style="color: #64748b; font-size: 12px; margin-top: 2px;">AI-Powered Supply Chain Intelligence & Risk Projection</div>
                </div>
                <div class="meta">
                    <div><b>Date:</b> ${dateFormatted}</div>
                    <div><b>Period:</b> Last ${data.historical_period_days || 30} Days</div>
                    <div><b>Horizon:</b> Next ${data.horizon_days || 7} Days</div>
                </div>
            </div>

            <div class="kpis">
                <div class="kpi-card">
                    <div class="kpi-num">${data.summary?.items_forecasted || items.length}</div>
                    <div class="kpi-label">Items Forecasted</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-num">${data.summary?.total_predicted_demand || 0}</div>
                    <div class="kpi-label">Total Forecast Demand</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-num" style="color: #dc2626;">${data.summary?.potential_shortages || 0}</div>
                    <div class="kpi-label">Potential Shortages</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-num">${data.summary?.average_accuracy ? data.summary.average_accuracy + '%' : 'N/A'}</div>
                    <div class="kpi-label">Holdout Accuracy</div>
                </div>
            </div>

            ${data.ai_insights?.summary ? `
                <div class="ai-box">
                    <b>Executive Intelligence Summary:</b>
                    <p style="margin: 4px 0 0;">${data.ai_insights.summary}</p>
                </div>
            ` : ''}

            ${chartImg}

            <div style="font-size: 13px; font-weight: bold; margin-bottom: 8px;">Detailed Item Projections & Recommendations</div>
            <table>
                <thead>
                    <tr>
                        <th>Item Code</th>
                        <th>Item Name</th>
                        <th>Category</th>
                        <th style="text-align: right;">Available</th>
                        <th style="text-align: right;">Forecast</th>
                        <th style="text-align: right;">Incoming</th>
                        <th style="text-align: right;">Projected (Est.)</th>
                        <th style="text-align: center;">Risk Level</th>
                        <th>Recommended Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>

            <div style="margin-top: 20px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px;">
                CONFIDENTIAL — FOR AIRSHIP EXPRESS INTERNAL SUPPLY CHAIN OPERATIONS ONLY. Projected stock levels are estimates based on historical consumption velocity and scheduled purchase order receipts.
            </div>
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();
}
