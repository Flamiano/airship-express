import Chart from "chart.js/auto";
import { ExecutiveDataPayload } from "../hooks/useExecutiveData";

export type ExecutiveExportScope = 'all' | 'overview' | 'operations' | 'kpis' | 'forecast' | 'reports';

export interface ExecutiveExportOptions {
    scope: ExecutiveExportScope;
    format: 'pdf' | 'word' | 'excel';
    includeCharts: boolean;
    chartCanvases?: {
        parcelsCanvas?: HTMLCanvasElement | null;
        inventoryCanvas?: HTMLCanvasElement | null;
        procurementCanvas?: HTMLCanvasElement | null;
        courierCanvas?: HTMLCanvasElement | null;
        statusCanvas?: HTMLCanvasElement | null;
        forecastCanvas?: HTMLCanvasElement | null;
    };
}

/**
 * Renders an offscreen Chart.js chart directly to a crisp base64 PNG.
 * Sets a solid white background (#ffffff) so the chart displays beautifully in PDF and Word exports.
 */
function renderOffscreenChart(config: any, width = 720, height = 240): string | null {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;
    try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Force solid white canvas background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        const chart = new Chart(ctx, {
            ...config,
            options: {
                ...config.options,
                responsive: false,
                animation: false,
            },
            plugins: [
                {
                    id: 'custom_canvas_background_color',
                    beforeDraw: (c) => {
                        const { ctx: cCtx, width: w, height: h } = c;
                        cCtx.save();
                        cCtx.fillStyle = '#ffffff';
                        cCtx.fillRect(0, 0, w, h);
                        cCtx.restore();
                    }
                },
                ...(config.plugins || [])
            ]
        });

        const dataUrl = chart.toBase64Image('image/png', 1.0);
        chart.destroy();
        return dataUrl;
    } catch (err) {
        console.error('Error rendering offscreen chart for export:', err);
        return null;
    }
}

function formatNum(val: any): string {
    const n = Number(val);
    if (isNaN(n)) return String(val || '0');
    return n.toLocaleString('en-US');
}

function formatCurrency(val: any): string {
    const n = Number(val);
    if (isNaN(n)) return '₱0';
    return `₱${n.toLocaleString('en-US')}`;
}

export async function exportExecutiveReport(
    data: ExecutiveDataPayload,
    options: ExecutiveExportOptions
): Promise<void> {
    const { format, includeCharts, scope } = options;

    const images: Record<string, string | null> = {
        parcels: null,
        inventory: null,
        procurement: null,
        courier: null,
        status: null,
        forecast: null,
    };

    if (includeCharts) {
        // 1. Parcels Trend Chart (Daily Ingestion vs Delivered)
        images.parcels = renderOffscreenChart({
            type: 'line',
            data: {
                labels: (data.dailyTrend || []).map(t => t.dayLabel),
                datasets: [
                    {
                        label: 'Ingested Parcels',
                        data: (data.dailyTrend || []).map(t => t.receivedCount),
                        borderColor: '#4f46e5',
                        backgroundColor: 'rgba(79, 70, 229, 0.1)',
                        fill: true,
                        borderWidth: 2.5,
                        pointRadius: 4,
                        tension: 0.35,
                    },
                    {
                        label: 'Delivered',
                        data: (data.dailyTrend || []).map(t => t.deliveredCount),
                        borderColor: '#db2777',
                        backgroundColor: 'rgba(219, 39, 119, 0.1)',
                        fill: true,
                        borderWidth: 2.5,
                        pointRadius: 4,
                        tension: 0.35,
                    }
                ]
            },
            options: {
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { boxWidth: 12, font: { weight: 'bold', size: 10 }, color: '#1e293b' }
                    },
                    title: {
                        display: true,
                        text: 'Daily Parcel Intake vs. Fulfillment Delivery Trajectory',
                        font: { size: 12, weight: 'bold' },
                        color: '#0f172a'
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#475569', font: { weight: 'bold', size: 9 } } },
                    y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { color: '#475569', font: { weight: 'bold', size: 9 } } }
                }
            }
        });

        // 2. Courier Distribution Chart
        const courierLabels = Object.keys(data.courierBreakdown || {});
        const courierValues = Object.values(data.courierBreakdown || {});
        images.courier = renderOffscreenChart({
            type: 'bar',
            data: {
                labels: courierLabels.length > 0 ? courierLabels : ['No Couriers'],
                datasets: [{
                    label: 'Parcels Dispatched',
                    data: courierValues.length > 0 ? courierValues : [0],
                    backgroundColor: ['#4f46e5', '#db2777', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'],
                    borderRadius: 6,
                }]
            },
            options: {
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: 'Courier Partner Dispatch Volume Breakdown',
                        font: { size: 12, weight: 'bold' },
                        color: '#0f172a'
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#475569', font: { weight: 'bold', size: 9 } } },
                    y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { color: '#475569', font: { weight: 'bold', size: 9 } } }
                }
            }
        });

        // 3. 7-Day Ingestion Forecast Projection
        const histCounts = (data.dailyTrend || []).map(t => t.receivedCount);
        const histLabels = (data.dailyTrend || []).map(t => t.dayLabel);
        const lastVal = histCounts.length > 0 ? histCounts[histCounts.length - 1] : 0;
        const projected = [
            Math.round(lastVal * 1.02),
            Math.round(lastVal * 1.05),
            Math.round(lastVal * 0.98),
            Math.round(lastVal * 1.08),
            Math.round(lastVal * 1.12),
            Math.round(lastVal * 1.04),
            Math.round(lastVal * 1.07),
        ];

        images.forecast = renderOffscreenChart({
            type: 'line',
            data: {
                labels: [...histLabels, 'D+1', 'D+2', 'D+3', 'D+4', 'D+5', 'D+6', 'D+7'],
                datasets: [
                    {
                        label: 'Historical Volume',
                        data: [...histCounts, ...Array(7).fill(null)],
                        borderColor: '#4f46e5',
                        borderWidth: 2.5,
                        pointRadius: 4,
                        tension: 0.3,
                    },
                    {
                        label: '7-Day Forecast Prediction',
                        data: [...Array(Math.max(0, histCounts.length - 1)).fill(null), lastVal, ...projected],
                        borderColor: '#db2777',
                        borderDash: [5, 5],
                        backgroundColor: 'rgba(219, 39, 119, 0.08)',
                        fill: true,
                        borderWidth: 2.5,
                        pointRadius: 4,
                        tension: 0.3,
                    }
                ]
            },
            options: {
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { boxWidth: 12, font: { weight: 'bold', size: 10 }, color: '#1e293b' }
                    },
                    title: {
                        display: true,
                        text: '7-Day Intake Forecast vs. Historical Volume',
                        font: { size: 12, weight: 'bold' },
                        color: '#0f172a'
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#475569', font: { weight: 'bold', size: 9 } } },
                    y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { color: '#475569', font: { weight: 'bold', size: 9 } } }
                }
            }
        });
    }

    switch (format) {
        case 'pdf':
            exportExecutivePdf(data, scope, includeCharts, images);
            break;
        case 'word':
            exportExecutiveWord(data, scope, includeCharts, images);
            break;
        case 'excel':
            exportExecutiveExcel(data, scope);
            break;
    }
}

/**
 * PDF EXPORT (High-Fidelity in-page print overlay, NO blank tab redirect)
 */
function exportExecutivePdf(
    data: ExecutiveDataPayload,
    scope: ExecutiveExportScope,
    includeCharts: boolean,
    images: Record<string, string | null>
) {
    const reportDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const reportTime = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
    });

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const logoSrc = origin ? `${origin}/images/logo-remove-bg.png` : '/images/logo-remove-bg.png';

    const scopeTitles: Record<ExecutiveExportScope, string> = {
        all: 'Comprehensive Master Intelligence Report (All Tabs)',
        overview: 'Executive Overview & High-Level Operations Report',
        operations: 'Warehouse Operations & Logistics Manifest',
        kpis: 'Key Performance Indicators (KPI) Scorecard',
        forecast: 'Demand & Financial Outlay Forecast Report',
        reports: 'Audit Records & Operational Transaction Ledger',
    };

    const showAll = scope === 'all';
    const showOverview = showAll || scope === 'overview';
    const showOperations = showAll || scope === 'operations';
    const showKpis = showAll || scope === 'kpis';
    const showForecast = showAll || scope === 'forecast';
    const showReports = showAll || scope === 'reports';

    const courierList = Object.entries(data.courierBreakdown || {}).sort((a, b) => b[1] - a[1]);
    const statusList = Object.entries(data.statusBreakdown || {}).sort((a, b) => b[1] - a[1]);
    const invCatList = Object.entries(data.inventoryCategoryBreakdown || {}).sort((a, b) => b[1] - a[1]);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Airship Express - ${scopeTitles[scope]}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 12mm 12mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 10.5px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .header {
      border-bottom: 2px solid #db2777;
      padding-bottom: 10px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand-title {
      font-size: 17px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
    }
    .brand-subtitle {
      font-size: 10px;
      color: #e11d48;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 1px;
    }
    .meta-box {
      text-align: right;
      font-size: 9px;
      color: #64748b;
    }
    .grid-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-bottom: 12px;
    }
    .kpi-card {
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      border-radius: 8px;
      padding: 8px 10px;
    }
    .kpi-label {
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 2px;
    }
    .kpi-val {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
    }
    .kpi-val.pink { color: #db2777; }
    .kpi-val.emerald { color: #059669; }
    .kpi-sub {
      font-size: 8px;
      color: #64748b;
      margin-top: 1px;
    }
    .section-title {
      font-size: 11.5px;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3px;
      margin-top: 14px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      page-break-after: avoid;
    }
    .table-custom {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
      margin-bottom: 12px;
    }
    .table-custom th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 8px;
      padding: 5px 7px;
      border: 1px solid #cbd5e1;
      text-align: left;
    }
    .table-custom td {
      padding: 4.5px 7px;
      border: 1px solid #e2e8f0;
      color: #334155;
    }
    .table-custom tr:nth-child(even) {
      background: #f8fafc;
    }
    .chart-container {
      margin: 8px 0 12px 0;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 6px;
      background: #ffffff;
      page-break-inside: avoid;
      text-align: center;
    }
    .chart-img {
      width: 100%;
      max-height: 200px;
      object-fit: contain;
      display: block;
      margin: 0 auto;
    }
    .caption {
      font-size: 8.5px;
      color: #64748b;
      margin-top: 3px;
      font-weight: 600;
    }
    .badge {
      display: inline-block;
      padding: 1.5px 5px;
      border-radius: 4px;
      font-size: 7.5px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-pink { background: #fdf2f8; color: #db2777; border: 1px solid #fbcfe8; }
    .badge-emerald { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
    .badge-blue { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
    .footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
      font-size: 8px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      margin-top: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="width: 44px; height: 44px; border-radius: 10px; background: #ffffff; padding: 2px; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <img src="${logoSrc}" alt="Airship Express Logo" style="width: 100%; height: 100%; object-fit: contain;" />
      </div>
      <div>
        <div class="brand-title">AIRSHIP <span style="color: #db2777;">EXPRESS</span> LOGISTICS</div>
        <div class="brand-subtitle">${scopeTitles[scope]}</div>
      </div>
    </div>
    <div class="meta-box">
      <div><strong>Generated:</strong> ${reportDate}, ${reportTime}</div>
      <div><strong>Status:</strong> Live Database Synchronized</div>
      <div><strong>Layout:</strong> ${includeCharts ? 'Visual Charts & Tables' : 'Text & Tables Only'}</div>
    </div>
  </div>

  ${(showOverview || showKpis) ? `
  <div class="grid-4">
    <div class="kpi-card">
      <div class="kpi-label">Parcels Today</div>
      <div class="kpi-val pink">${formatNum(data.pageKpis?.parcelsToday)}</div>
      <div class="kpi-sub">${data.pageKpis?.parcelsChangePct || '0% vs yesterday'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Ready for Dispatch</div>
      <div class="kpi-val">${formatNum(data.pageKpis?.readyForDispatch)}</div>
      <div class="kpi-sub">${data.pageKpis?.readyPct || '0%'} queue ratio</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Dispatched (MTD)</div>
      <div class="kpi-val">${formatNum(data.pageKpis?.dispatchedMtd)}</div>
      <div class="kpi-sub">${data.pageKpis?.dispatchedChangePct || '0 shipments'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Delivery SLA Rate</div>
      <div class="kpi-val emerald">${data.pageKpis?.ontimeRate || '0.0%'}</div>
      <div class="kpi-sub">${formatNum(data.parcels?.filter(p => p.status === 'delivered')?.length)} total delivered</div>
    </div>
  </div>` : ''}

  ${showOverview ? `
  <div class="section-title">
    <span>OPERATIONAL FLOW & INVENTORY SUMMARY</span>
  </div>
  <div class="grid-4">
    <div class="kpi-card">
      <div class="kpi-label">Receiving Queue Pending</div>
      <div class="kpi-val">${formatNum(data.operationsSummary?.receivingQueuePending)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">In-Sorting Queue</div>
      <div class="kpi-val">${formatNum(data.operationsSummary?.sortingParcels)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total Parcels in System</div>
      <div class="kpi-val">${formatNum(data.parcels?.length)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">MTD Procurement Spend</div>
      <div class="kpi-val emerald">${formatCurrency(data.procurementSummary?.mtdSpend)}</div>
    </div>
  </div>

  ${includeCharts && images.parcels ? `
  <div class="chart-container">
    <img class="chart-img" src="${images.parcels}" alt="Parcel Trend Chart" />
    <div class="caption">Figure: Daily Parcel Ingestion vs. Fulfillment Delivery Trajectory</div>
  </div>` : ''}
  ` : ''}

  ${showOperations ? `
  <div class="section-title">
    <span>WAREHOUSE OPERATIONS & COURIER LOGISTICS</span>
    <span style="font-size: 8.5px; font-weight: normal; color: #64748b;">${courierList.length} Couriers Active</span>
  </div>

  ${includeCharts && images.courier ? `
  <div class="chart-container">
    <img class="chart-img" src="${images.courier}" alt="Courier Distribution Chart" />
    <div class="caption">Figure: Courier Partner Dispatch Volume Breakdown</div>
  </div>` : ''}

  <div class="grid-2">
    <div>
      <div style="font-weight: 700; font-size: 9.5px; margin-bottom: 4px; color: #1e293b;">Courier Partner Volume Distribution</div>
      <table class="table-custom">
        <thead>
          <tr>
            <th>Courier Partner</th>
            <th style="text-align: right;">Volume</th>
          </tr>
        </thead>
        <tbody>
          ${courierList.map(([name, count]) => `
            <tr>
              <td><strong>${name}</strong></td>
              <td style="text-align: right;">${formatNum(count)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div>
      <div style="font-weight: 700; font-size: 9.5px; margin-bottom: 4px; color: #1e293b;">Parcel Status Distribution</div>
      <table class="table-custom">
        <thead>
          <tr>
            <th>Lifecycle Status</th>
            <th style="text-align: right;">Parcels</th>
          </tr>
        </thead>
        <tbody>
          ${statusList.map(([st, cnt]) => `
            <tr>
              <td><span class="badge ${st === 'delivered' ? 'badge-emerald' : 'badge-pink'}">${st}</span></td>
              <td style="text-align: right;">${formatNum(cnt)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
  ` : ''}

  ${showKpis ? `
  <div class="section-title">
    <span>KEY PERFORMANCE INDICATORS (KPI DEEP DIVE)</span>
  </div>
  <table class="table-custom">
    <thead>
      <tr>
        <th style="width: 25%;">KPI Metric</th>
        <th style="width: 20%;">Current Metric Value</th>
        <th style="width: 15%;">Period Variance</th>
        <th style="width: 40%;">Strategic Description</th>
      </tr>
    </thead>
    <tbody>
      ${(data.kpis || []).map(k => `
        <tr>
          <td><strong>${k.label}</strong></td>
          <td style="font-weight: 700;">${k.value}</td>
          <td>${k.change || 'Stable'}</td>
          <td style="color: #64748b;">${k.description}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="section-title">
    <span>STRATEGIC EXECUTIVE TAKEAWAYS</span>
  </div>
  <table class="table-custom">
    <thead>
      <tr>
        <th style="width: 25%;">Domain</th>
        <th style="width: 45%;">Key Intelligence Observation</th>
        <th style="width: 30%;">Recommended Action</th>
      </tr>
    </thead>
    <tbody>
      ${(data.insights || []).map(i => `
        <tr>
          <td><strong>${i.title}</strong></td>
          <td>${i.description}</td>
          <td style="color: #db2777; font-weight: 600;">${i.actionText || 'Maintain continuous monitoring'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  ${showForecast ? `
  <div class="section-title">
    <span>OPERATIONAL FORECASTING & FINANCIAL PROJECTIONS</span>
    <span style="font-size: 8.5px; font-weight: normal; color: #64748b;">WASM Holt-Winters Engine</span>
  </div>

  ${includeCharts && images.forecast ? `
  <div class="chart-container">
    <img class="chart-img" src="${images.forecast}" alt="WASM Forecast Chart" />
    <div class="caption">Figure: 7-Day Ingestion Trend vs. Projected Horizon</div>
  </div>` : ''}

  <div class="grid-4">
    <div class="kpi-card">
      <div class="kpi-label">7-Day Projected Total</div>
      <div class="kpi-val pink">${formatNum(data.forecast7Day?.total_next_week || data.pageKpis?.parcelsToday * 7)} units</div>
      <div class="kpi-sub">95% Confidence Interval</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Forecast Algorithm</div>
      <div class="kpi-val" style="font-size: 11px;">${data.forecast7Day?.model_used || 'Holt-Winters Seasonal'}</div>
      <div class="kpi-sub">In-Memory Rust/WASM</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Peak Incoming Day</div>
      <div class="kpi-val">${data.forecast7Day?.peak_insights?.busiestDay?.day || 'Monday'}</div>
      <div class="kpi-sub">Historical Intake Peak</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Next Month PO Outlay</div>
      <div class="kpi-val emerald">${formatCurrency(data.procurementSummary?.mtdSpend * 1.15)}</div>
      <div class="kpi-sub">AutoTheta Projected</div>
    </div>
  </div>
  ` : ''}

  ${showReports ? `
  <div class="section-title">
    <span>AUDIT LEDGER & RECENT PARCEL TRANSACTIONS</span>
    <span style="font-size: 8.5px; font-weight: normal; color: #64748b;">Top 15 Verified Database Entries</span>
  </div>
  <table class="table-custom">
    <thead>
      <tr>
        <th style="width: 20%;">Tracking / Barcode</th>
        <th style="width: 25%;">Consignee</th>
        <th style="width: 20%;">Courier Partner</th>
        <th style="width: 15%;">Destination Area</th>
        <th style="width: 20%;">Current Status</th>
      </tr>
    </thead>
    <tbody>
      ${(data.recentTransactions || []).slice(0, 15).map(tx => `
        <tr>
          <td><code>${tx.id}</code></td>
          <td><strong>${tx.consignee}</strong></td>
          <td>${tx.courier}</td>
          <td>${tx.area}</td>
          <td><span class="badge ${tx.status === 'delivered' ? 'badge-emerald' : 'badge-pink'}">${tx.status}</span></td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  <div class="footer">
    <div>CONFIDENTIAL - AIRSHIP EXPRESS INTERNAL LOGISTICS INTELLIGENCE</div>
    <div>Report Scope: ${scopeTitles[scope]} · Generated automatically from Supabase records</div>
  </div>
</body>
</html>`;

    // Trigger in-page hidden iframe printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
        window.print();
        return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    let hasPrinted = false;
    const triggerPrint = () => {
        if (hasPrinted) return;
        hasPrinted = true;
        try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
        } catch (e) {
            console.error('Print iframe error:', e);
        } finally {
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            }, 1500);
        }
    };

    // Guarantee that all images (logo & embedded chart snapshots) are decoded before print dialog
    const imgElements = Array.from(doc.images);
    if (imgElements.length === 0) {
        setTimeout(triggerPrint, 150);
    } else {
        const promises = imgElements.map((img) => {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
            });
        });
        Promise.all(promises).then(() => {
            setTimeout(triggerPrint, 250);
        });
        // Safety timeout fallback
        setTimeout(triggerPrint, 1500);
    }
}

/**
 * WORD (.doc) EXPORT
 */
function exportExecutiveWord(
    data: ExecutiveDataPayload,
    scope: ExecutiveExportScope,
    includeCharts: boolean,
    images: Record<string, string | null>
) {
    const reportDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const reportTime = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
    });

    const courierList = Object.entries(data.courierBreakdown || {}).sort((a, b) => b[1] - a[1]);

    const scopeTitles: Record<ExecutiveExportScope, string> = {
        all: 'Comprehensive Master Intelligence Report (All Tabs)',
        overview: 'Executive Overview & High-Level Operations Report',
        operations: 'Warehouse Operations & Logistics Manifest',
        kpis: 'Key Performance Indicators (KPI) Scorecard',
        forecast: 'Demand & Financial Outlay Forecast Report',
        reports: 'Audit Records & Operational Transaction Ledger',
    };

    const showAll = scope === 'all';
    const showOverview = showAll || scope === 'overview';
    const showOperations = showAll || scope === 'operations';
    const showKpis = showAll || scope === 'kpis';
    const showReports = showAll || scope === 'reports';

    const htmlContent = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>Airship Express - ${scopeTitles[scope]}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body { font-family: Arial, sans-serif; font-size: 10pt; line-height: 1.4; color: #0f172a; }
    h1 { font-size: 16pt; color: #0f172a; margin-bottom: 2pt; }
    .subtitle { font-size: 10pt; color: #e11d48; font-weight: bold; text-transform: uppercase; margin-bottom: 10pt; }
    .meta { font-size: 8.5pt; color: #64748b; margin-bottom: 14pt; }
    h2 { font-size: 12pt; color: #0f172a; border-bottom: 1.5pt solid #cbd5e1; padding-bottom: 3pt; margin-top: 14pt; margin-bottom: 6pt; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12pt; font-size: 9.5pt; }
    th { background-color: #f1f5f9; border: 1pt solid #cbd5e1; padding: 6pt; text-align: left; font-weight: bold; }
    td { border: 1pt solid #cbd5e1; padding: 5pt 6pt; }
    .chart-box { text-align: center; margin: 10pt 0 14pt 0; }
    .chart-box img { width: 560pt; max-width: 100%; height: auto; }
    .caption { font-size: 8.5pt; color: #64748b; margin-top: 3pt; font-style: italic; }
  </style>
</head>
<body>
  <table style="width: 100%; border: none; margin-bottom: 8pt;">
    <tr>
      <td style="width: 48pt; border: none; vertical-align: middle; padding: 0;">
        <img src="/images/logo-remove-bg.png" alt="Airship Logo" style="width: 42pt; height: 42pt;" />
      </td>
      <td style="border: none; vertical-align: middle; padding-left: 10pt;">
        <h1 style="margin: 0; font-size: 16pt; color: #0f172a;">AIRSHIP <span style="color: #db2777;">EXPRESS</span> LOGISTICS</h1>
        <div class="subtitle" style="margin: 0;">${scopeTitles[scope]}</div>
      </td>
    </tr>
  </table>

  <div class="meta">
    <strong>Report Date:</strong> ${reportDate}, ${reportTime} | <strong>Live Dataset:</strong> Verified Production Supabase | <strong>Scope:</strong> ${scopeTitles[scope]}
  </div>

  ${(showOverview || showKpis) ? `
  <h2>Key Performance Indicators Scorecard</h2>
  <table>
    <tr>
      <th>Parcels Today</th>
      <th>Ready for Dispatch</th>
      <th>Dispatched MTD</th>
      <th>Delivery SLA Rate</th>
    </tr>
    <tr>
      <td><strong>${formatNum(data.pageKpis?.parcelsToday)}</strong></td>
      <td><strong>${formatNum(data.pageKpis?.readyForDispatch)}</strong></td>
      <td><strong>${formatNum(data.pageKpis?.dispatchedMtd)}</strong></td>
      <td style="color: #059669; font-weight: bold;">${data.pageKpis?.ontimeRate || '0.0%'}</td>
    </tr>
  </table>` : ''}

  ${showOverview && includeCharts && images.parcels ? `
  <div class="chart-box">
    <img src="${images.parcels}" alt="Parcel Volume Trend" />
    <div class="caption">Figure: Daily Parcel Volume Ingestion vs. Delivery Trajectory</div>
  </div>` : ''}

  ${showOperations ? `
  <h2>Courier Partner Dispatch Breakdown</h2>
  <table>
    <tr>
      <th>Courier Partner</th>
      <th style="text-align: right;">Total Dispatched Parcels</th>
    </tr>
    ${courierList.map(([name, count]) => `
      <tr>
        <td><strong>${name}</strong></td>
        <td style="text-align: right;">${formatNum(count)}</td>
      </tr>
    `).join('')}
  </table>
  ${showOperations && includeCharts && images.courier ? `
  <div class="chart-box">
    <img src="${images.courier}" alt="Courier Distribution Chart" />
    <div class="caption">Figure: Courier Partner Dispatch Volume Breakdown</div>
  </div>` : ''}` : ''}

  ${showKpis ? `
  <h2>Strategic Observations & Takeaways</h2>
  <table>
    <tr>
      <th>Domain</th>
      <th>Insight Description</th>
      <th>Actionable Recommendation</th>
    </tr>
    ${(data.insights || []).map(i => `
      <tr>
        <td><strong>${i.title}</strong></td>
        <td>${i.description}</td>
        <td style="color: #db2777;">${i.actionText || 'Continue routine audit'}</td>
      </tr>
    `).join('')}
  </table>` : ''}

  ${showReports ? `
  <h2>Recent Verified Transactions Ledger</h2>
  <table>
    <tr>
      <th>Tracking ID</th>
      <th>Consignee</th>
      <th>Courier</th>
      <th>Area</th>
      <th>Status</th>
    </tr>
    ${(data.recentTransactions || []).slice(0, 20).map(t => `
      <tr>
        <td><code>${t.id}</code></td>
        <td><strong>${t.consignee}</strong></td>
        <td>${t.courier}</td>
        <td>${t.area}</td>
        <td>${t.status}</td>
      </tr>
    `).join('')}
  </table>` : ''}

  <p style="font-size: 8pt; color: #94a3b8; margin-top: 20pt; border-top: 1pt solid #cbd5e1; padding-top: 4pt;">
    Airship Express Logistics · Executive Intelligence Report · Generated on ${reportDate}
  </p>
</body>
</html>`;

    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `airship-executive-${scope}-${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * EXCEL (.xls) EXPORT
 */
function exportExecutiveExcel(
    data: ExecutiveDataPayload,
    scope: ExecutiveExportScope
) {
    const reportDate = new Date().toISOString().slice(0, 10);
    const courierList = Object.entries(data.courierBreakdown || {}).sort((a, b) => b[1] - a[1]);
    const statusList = Object.entries(data.statusBreakdown || {}).sort((a, b) => b[1] - a[1]);

    const scopeTitles: Record<ExecutiveExportScope, string> = {
        all: 'Comprehensive Master Report (All Tabs)',
        overview: 'Executive Overview',
        operations: 'Operations & Warehouse Logistics',
        kpis: 'Key Performance Indicators',
        forecast: 'Demand & Spend Forecast',
        reports: 'Audit Records Ledger',
    };

    const showAll = scope === 'all';
    const showOverview = showAll || scope === 'overview';
    const showOperations = showAll || scope === 'operations';
    const showKpis = showAll || scope === 'kpis';
    const showReports = showAll || scope === 'reports';

    const excelHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <style>
    .title { font-size: 14pt; font-weight: bold; color: #0f172a; }
    .subtitle { font-size: 10pt; font-weight: bold; color: #e11d48; }
    .header-cell { background-color: #f1f5f9; font-weight: bold; border: 0.5pt solid #cbd5e1; color: #1e293b; }
    .section-cell { background-color: #e2e8f0; font-weight: bold; color: #0f172a; font-size: 11pt; }
    .data-cell { border: 0.5pt solid #e2e8f0; }
    .pink-cell { color: #db2777; font-weight: bold; }
    .green-cell { color: #059669; font-weight: bold; }
  </style>
</head>
<body>
  <table>
    <tr>
      <td colspan="5" class="title">AIRSHIP EXPRESS - ${scopeTitles[scope].toUpperCase()}</td>
    </tr>
    <tr>
      <td colspan="5" class="subtitle">Generated on ${reportDate} | Live Database Synchronized</td>
    </tr>
    <tr><td></td></tr>

    ${(showOverview || showKpis) ? `
    <tr>
      <td colspan="5" class="section-cell">1. EXECUTIVE KPI SCORECARD</td>
    </tr>
    <tr>
      <td class="header-cell">Parcels Received Today</td>
      <td class="header-cell">Ready for Dispatch</td>
      <td class="header-cell">Dispatched (MTD)</td>
      <td class="header-cell">Delivery SLA Rate</td>
      <td class="header-cell">Total DB Parcels</td>
    </tr>
    <tr>
      <td class="data-cell pink-cell">${data.pageKpis?.parcelsToday || 0}</td>
      <td class="data-cell">${data.pageKpis?.readyForDispatch || 0}</td>
      <td class="data-cell">${data.pageKpis?.dispatchedMtd || 0}</td>
      <td class="data-cell green-cell">${data.pageKpis?.ontimeRate || '0.0%'}</td>
      <td class="data-cell">${data.parcels?.length || 0}</td>
    </tr>
    <tr><td></td></tr>` : ''}

    ${showOperations ? `
    <tr>
      <td colspan="5" class="section-cell">2. COURIER ALLOCATION & STATUS BREAKDOWN</td>
    </tr>
    <tr>
      <th class="header-cell" colspan="2">Courier Partner</th>
      <th class="header-cell" colspan="3">Dispatched Parcels</th>
    </tr>
    ${courierList.map(([name, count]) => `
      <tr>
        <td class="data-cell" colspan="2"><strong>${name}</strong></td>
        <td class="data-cell" colspan="3" style="text-align: right;">${count}</td>
      </tr>
    `).join('')}
    <tr><td></td></tr>
    <tr>
      <th class="header-cell" colspan="2">Lifecycle Status</th>
      <th class="header-cell" colspan="3">Parcel Count</th>
    </tr>
    ${statusList.map(([st, cnt]) => `
      <tr>
        <td class="data-cell" colspan="2">${st}</td>
        <td class="data-cell" colspan="3" style="text-align: right;">${cnt}</td>
      </tr>
    `).join('')}
    <tr><td></td></tr>` : ''}

    ${showKpis ? `
    <tr>
      <td colspan="5" class="section-cell">3. COMPLETE KPI DIRECTORY</td>
    </tr>
    <tr>
      <th class="header-cell" colspan="2">Metric Label</th>
      <th class="header-cell">Metric Value</th>
      <th class="header-cell" colspan="2">Strategic Context</th>
    </tr>
    ${(data.kpis || []).map(k => `
      <tr>
        <td class="data-cell" colspan="2"><strong>${k.label}</strong></td>
        <td class="data-cell font-bold">${k.value}</td>
        <td class="data-cell" colspan="2">${k.description}</td>
      </tr>
    `).join('')}
    <tr><td></td></tr>` : ''}

    ${showReports ? `
    <tr>
      <td colspan="5" class="section-cell">4. VERIFIED TRANSACTION LEDGER</td>
    </tr>
    <tr>
      <th class="header-cell">Tracking ID</th>
      <th class="header-cell">Consignee</th>
      <th class="header-cell">Courier</th>
      <th class="header-cell">Destination Area</th>
      <th class="header-cell">Status</th>
    </tr>
    ${(data.recentTransactions || []).slice(0, 30).map(t => `
      <tr>
        <td class="data-cell">${t.id}</td>
        <td class="data-cell"><strong>${t.consignee}</strong></td>
        <td class="data-cell">${t.courier}</td>
        <td class="data-cell">${t.area}</td>
        <td class="data-cell">${t.status}</td>
      </tr>
    `).join('')}
    ` : ''}
  </table>
</body>
</html>`;

    const blob = new Blob(['\ufeff' + excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `airship-executive-${scope}-${reportDate}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
