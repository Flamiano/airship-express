/**
 * Forecast Export Utilities for Airship Express
 * Supports PDF (high-fidelity print-to-PDF), Word (.doc HTML format with MSO tags),
 * and Excel (.xls formatted spreadsheet / .csv) with optional embedded chart snapshots.
 */

export interface ForecastExportOptions {
    format: 'pdf' | 'word' | 'excel';
    includeCharts: boolean;
    chartCanvases?: {
        parcelChart?: HTMLCanvasElement | null;
        expenseChart?: HTMLCanvasElement | null;
        courierChart?: HTMLCanvasElement | null;
    };
}

export interface ForecastReportData {
    raw_db_stats: {
        total_parcels_in_db: number;
        total_pos_in_db: number;
        total_paid_pos_in_db?: number;
        courier_breakdown: Record<string, number>;
        status_breakdown: Record<string, number>;
    };
    parcel_7_day: {
        predictions: number[];
        confidence_interval: {
            lower: number[];
            upper: number[];
        };
        total_next_week: number;
        confidence: string;
        model_used?: string;
        engine?: string;
        explanation?: string;
        dates: string[];
        previous_week_evaluation?: {
            has_evaluation: boolean;
            date_range: string;
            actual_volume: number;
            predicted_volume: number;
            met_percentage: number;
            accuracy_percentage: number;
            status: string;
            status_tone: string;
            summary: string;
        };
        historical: {
            dates: string[];
            counts: number[];
            display_dates?: string[];
            display_counts?: number[];
            aggregation_type?: string;
            total_actual: number;
        };
        peak_insights?: {
            busiestMonth: { month: string; count: number };
            busiestDay: { day: string; count: number };
            busiestHour: { timeRange: string; count: number };
        };
    };
    expense_next_month: {
        prediction: number;
        confidence_interval: {
            lower: number;
            upper: number;
        };
        confidence: string;
        model_used?: string;
        engine?: string;
        explanation?: string;
        historical: {
            months: string[];
            amounts: number[];
            total_actual: number;
        };
    };
    timestamp?: string;
}

import Chart from "chart.js/auto";

// Safely capture canvas snapshot as PNG data URL
function captureCanvasImage(canvas: HTMLCanvasElement | null | undefined): string | null {
    if (!canvas) return null;
    try {
        const url = canvas.toDataURL('image/png', 1.0);
        if (!url || url === 'data:,' || url.length < 50) return null;
        return url;
    } catch (e) {
        console.warn('Could not capture canvas snapshot:', e);
        return null;
    }
}

/**
 * Renders an offscreen Chart.js chart directly to a crisp base64 PNG.
 * Sets a solid white background (#ffffff) so the chart displays beautifully in PDF and Word exports.
 */
function renderForecastOffscreenChart(config: any, width = 720, height = 240): string | null {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;
    try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

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
                    id: 'custom_canvas_bg',
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

        const url = chart.toBase64Image('image/png', 1.0);
        chart.destroy();
        return url;
    } catch (e) {
        console.error('Error generating offscreen forecast chart:', e);
        return null;
    }
}

// Format numbers nicely
function formatNumber(num: number | undefined | null): string {
    if (num === undefined || num === null || isNaN(num)) return '0';
    return Number(num).toLocaleString('en-US');
}

function formatCurrency(num: number | undefined | null): string {
    if (num === undefined || num === null || isNaN(num)) return '₱0';
    return `₱${Number(num).toLocaleString('en-US')}`;
}

/**
 * Main export function coordinating PDF, Word, and Excel generation
 */
export async function exportForecastReport(
    data: ForecastReportData,
    options: ForecastExportOptions
): Promise<void> {
    const { format, includeCharts, chartCanvases } = options;

    let parcelImg: string | null = null;
    let expenseImg: string | null = null;
    let courierImg: string | null = null;

    if (includeCharts) {
        if (chartCanvases) {
            parcelImg = captureCanvasImage(chartCanvases.parcelChart);
            expenseImg = captureCanvasImage(chartCanvases.expenseChart);
            courierImg = captureCanvasImage(chartCanvases.courierChart);
        }

        // Guaranteed fallback: If canvas wasn't available or rendered blank, generate offscreen
        if (!parcelImg) {
            const histCounts = data.parcel_7_day?.historical?.counts || [];
            const histLabels = (data.parcel_7_day?.historical?.display_dates || data.parcel_7_day?.historical?.dates || []).map(d => {
                if (d.includes('-') && !d.includes('/')) {
                    const p = d.split('-');
                    return p.length === 3 ? `${p[1]}/${p[2]}` : d;
                }
                return d;
            });
            const fcDates = data.parcel_7_day?.dates || [];
            const fcValues = data.parcel_7_day?.predictions || [];
            const fcLabels = fcDates.map((d, i) => `D+${i + 1}`);
            const allLabels = [...histLabels, ...fcLabels];
            const actualSeries = [...histCounts, ...Array(fcValues.length).fill(null)];
            const lastVal = histCounts.length > 0 ? histCounts[histCounts.length - 1] : 0;
            const forecastSeries = [...Array(Math.max(0, histCounts.length - 1)).fill(null), lastVal, ...fcValues];

            parcelImg = renderForecastOffscreenChart({
                type: 'line',
                data: {
                    labels: allLabels.length > 0 ? allLabels : ['D+1', 'D+2', 'D+3', 'D+4', 'D+5', 'D+6', 'D+7'],
                    datasets: [
                        {
                            label: 'Historical Actuals',
                            data: actualSeries,
                            borderColor: '#4f46e5',
                            backgroundColor: 'rgba(79, 70, 229, 0.08)',
                            fill: true,
                            tension: 0.3,
                            borderWidth: 2.5,
                            pointRadius: 3,
                        },
                        {
                            label: '7-Day Prediction',
                            data: forecastSeries,
                            borderColor: '#db2777',
                            borderDash: [5, 5],
                            backgroundColor: 'rgba(219, 39, 119, 0.08)',
                            fill: true,
                            tension: 0.3,
                            borderWidth: 2.5,
                            pointRadius: 4,
                        }
                    ]
                },
                options: {
                    plugins: {
                        legend: { position: 'top', labels: { boxWidth: 12, font: { weight: 'bold', size: 10 }, color: '#1e293b' } },
                        title: { display: true, text: 'Historical Volume vs. 7-Day Holt-Winters Seasonality Forecast', font: { size: 12, weight: 'bold' }, color: '#0f172a' }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#475569', font: { weight: 'bold', size: 9 } } },
                        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { color: '#475569', font: { weight: 'bold', size: 9 } } }
                    }
                }
            });
        }

        if (!expenseImg) {
            const months = data.expense_next_month?.historical?.months || [];
            const amounts = data.expense_next_month?.historical?.amounts || [];
            const nextPred = data.expense_next_month?.prediction || 0;
            expenseImg = renderForecastOffscreenChart({
                type: 'bar',
                data: {
                    labels: [...months, 'Next Month (Forecast)'],
                    datasets: [{
                        label: 'Expenditure (PHP)',
                        data: [...amounts, nextPred],
                        backgroundColor: [...amounts.map(() => '#0284c7'), '#10b981'],
                        borderRadius: 6,
                    }]
                },
                options: {
                    plugins: {
                        legend: { display: false },
                        title: { display: true, text: 'Monthly Paid PO Spend vs. Next Month Budget Projection', font: { size: 12, weight: 'bold' }, color: '#0f172a' }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#475569', font: { weight: 'bold', size: 9 } } },
                        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { color: '#475569', font: { weight: 'bold', size: 9 } } }
                    }
                }
            });
        }

        if (!courierImg) {
            const courierEntries = Object.entries(data.raw_db_stats?.courier_breakdown || {}).sort((a, b) => b[1] - a[1]);
            courierImg = renderForecastOffscreenChart({
                type: 'bar',
                data: {
                    labels: courierEntries.length > 0 ? courierEntries.map(c => c[0]) : ['No Couriers'],
                    datasets: [{
                        label: 'Parcels Handled',
                        data: courierEntries.length > 0 ? courierEntries.map(c => c[1]) : [0],
                        backgroundColor: ['#4f46e5', '#db2777', '#10b981', '#f59e0b', '#8b5cf6'],
                        borderRadius: 6,
                    }]
                },
                options: {
                    plugins: {
                        legend: { display: false },
                        title: { display: true, text: 'Courier Partner Volume Distribution', font: { size: 12, weight: 'bold' }, color: '#0f172a' }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#475569', font: { weight: 'bold', size: 9 } } },
                        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { color: '#475569', font: { weight: 'bold', size: 9 } } }
                    }
                }
            });
        }
    }

    switch (format) {
        case 'pdf':
            exportToPdf(data, includeCharts, { parcelImg, expenseImg, courierImg });
            break;
        case 'word':
            exportToWord(data, includeCharts, { parcelImg, expenseImg, courierImg });
            break;
        case 'excel':
            exportToExcel(data, includeCharts);
            break;
    }
}

/**
 * PDF EXPORT
 * Uses a dedicated, beautifully styled print window allowing direct Save as PDF
 */
function exportToPdf(
    data: ForecastReportData,
    includeCharts: boolean,
    images: { parcelImg: string | null; expenseImg: string | null; courierImg: string | null }
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

    const courierList = Object.entries(data.raw_db_stats.courier_breakdown || {}).sort(
        (a, b) => b[1] - a[1]
    );
    const totalCourierParcels = courierList.reduce((sum, [, c]) => sum + c, 0) || 1;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const logoSrc = origin ? `${origin}/images/logo-remove-bg.png` : '/images/logo-remove-bg.png';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Airship Express - Forecast Intelligence Report (${reportDate})</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 14mm 14mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.45;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .header {
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 12px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand-title {
      font-size: 18px;
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
      margin-top: 2px;
    }
    .meta-box {
      text-align: right;
      font-size: 9.5px;
      color: #64748b;
    }
    .grid-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .kpi-card {
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      border-radius: 8px;
      padding: 8px 10px;
    }
    .kpi-label {
      font-size: 8.5px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 3px;
    }
    .kpi-val {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
    }
    .kpi-val.pink { color: #db2777; }
    .kpi-val.emerald { color: #059669; }
    .kpi-sub {
      font-size: 8.5px;
      color: #64748b;
      margin-top: 2px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-top: 14px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
    }
    .insights-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .insight-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 10px;
      background: #ffffff;
    }
    .table-custom {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
      margin-bottom: 14px;
    }
    .table-custom th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 8px;
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
      text-align: left;
    }
    .table-custom td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
      color: #334155;
    }
    .table-custom tr:nth-child(even) {
      background: #f8fafc;
    }
    .chart-container {
      margin-top: 8px;
      margin-bottom: 14px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px;
      background: #ffffff;
      page-break-inside: avoid;
    }
    .chart-img {
      width: 100%;
      max-height: 220px;
      object-fit: contain;
      display: block;
      margin: 0 auto;
    }
    .chart-caption {
      font-size: 9px;
      color: #64748b;
      font-weight: 600;
      margin-top: 4px;
      text-align: center;
    }
    .footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      font-size: 8.5px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      margin-top: 16px;
    }
    @media print {
      body { margin: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="width: 48px; height: 48px; border-radius: 12px; background: #ffffff; padding: 2px; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <img src="${logoSrc}" alt="Airship Express Logo" style="width: 100%; height: 100%; object-fit: contain;" />
      </div>
      <div>
        <div class="brand-title">AIRSHIP <span style="color: #db2777;">EXPRESS</span> LOGISTICS</div>
        <div class="brand-subtitle">Operational Forecast Intelligence Report (${includeCharts ? 'Charts & Tables' : 'Text & Tables Only'})</div>
      </div>
    </div>
    <div class="meta-box">
      <div><strong>Generated:</strong> ${reportDate}, ${reportTime}</div>
      <div><strong>Engine:</strong> ${data.parcel_7_day.engine || 'WASM Forecaster'}</div>
      <div><strong>Confidence Envelope:</strong> ${data.parcel_7_day.confidence || '95%'} CI</div>
    </div>
  </div>

  <div class="grid-4">
    <div class="kpi-card">
      <div class="kpi-label">7-Day Projected Intake</div>
      <div class="kpi-val pink">${formatNumber(data.parcel_7_day.total_next_week)} units</div>
      <div class="kpi-sub">${data.parcel_7_day.confidence || '95%'} Confidence</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Next Month PO Outlay</div>
      <div class="kpi-val emerald">${formatCurrency(data.expense_next_month.prediction)}</div>
      <div class="kpi-sub">${formatCurrency(data.expense_next_month.confidence_interval.lower)} - ${formatCurrency(data.expense_next_month.confidence_interval.upper)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Database Intake Records</div>
      <div class="kpi-val">${formatNumber(data.raw_db_stats.total_parcels_in_db)} parcels</div>
      <div class="kpi-sub">Across ${data.parcel_7_day.historical.dates.length} days</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Top Courier Partner</div>
      <div class="kpi-val" style="font-size: 13px;">${courierList[0]?.[0] || 'N/A'}</div>
      <div class="kpi-sub">${formatNumber(courierList[0]?.[1] || 0)} parcels handled</div>
    </div>
  </div>

  <div class="section-title">
    <span>OPERATIONAL PEAK INSIGHTS</span>
  </div>
  <div class="insights-grid">
    <div class="insight-card">
      <div class="kpi-label">Busiest Month</div>
      <div style="font-weight: 700; font-size: 12px; color: #0f172a;">${data.parcel_7_day.peak_insights?.busiestMonth?.month || 'N/A'}</div>
      <div class="kpi-sub">${formatNumber(data.parcel_7_day.peak_insights?.busiestMonth?.count || 0)} parcels recorded</div>
    </div>
    <div class="insight-card">
      <div class="kpi-label">Peak Incoming Day</div>
      <div style="font-weight: 700; font-size: 12px; color: #0f172a;">${data.parcel_7_day.peak_insights?.busiestDay?.day || 'N/A'}</div>
      <div class="kpi-sub">${formatNumber(data.parcel_7_day.peak_insights?.busiestDay?.count || 0)} parcels peak</div>
    </div>
    <div class="insight-card">
      <div class="kpi-label">Busiest Time Window</div>
      <div style="font-weight: 700; font-size: 12px; color: #0f172a;">${data.parcel_7_day.peak_insights?.busiestHour?.timeRange || 'N/A'}</div>
      <div class="kpi-sub">${formatNumber(data.parcel_7_day.peak_insights?.busiestHour?.count || 0)} scans peak</div>
    </div>
  </div>

  ${includeCharts && images.parcelImg ? `
  <div class="chart-container">
    <img class="chart-img" src="${images.parcelImg}" alt="7-Day Parcel Forecast Chart" />
    <div class="chart-caption">Figure 1.1: Historical Parcel Volume vs. 7-Day Holt-Winters Seasonality Forecast</div>
  </div>` : ''}

  <div class="section-title">
    <span>DAY-BY-DAY 7-DAY PARCEL PROJECTIONS</span>
    <span style="font-size: 9px; font-weight: normal; color: #64748b;">Algorithm: ${data.parcel_7_day.model_used || 'Holt-Winters'}</span>
  </div>
  <table class="table-custom">
    <thead>
      <tr>
        <th style="width: 15%;">Forecast Day</th>
        <th style="width: 25%;">Projected Date</th>
        <th style="width: 20%; text-align: center;">Lower ${data.parcel_7_day.confidence} Bound</th>
        <th style="width: 20%; text-align: right;">Predicted Volume</th>
        <th style="width: 20%; text-align: center;">Upper ${data.parcel_7_day.confidence} Bound</th>
      </tr>
    </thead>
    <tbody>
      ${data.parcel_7_day.dates.map((dateStr, i) => {
        const d = new Date(dateStr);
        const dayName = isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { weekday: 'short' });
        const pred = data.parcel_7_day.predictions[i] || 0;
        const low = data.parcel_7_day.confidence_interval.lower[i] || 0;
        const high = data.parcel_7_day.confidence_interval.upper[i] || 0;
        return `<tr>
          <td><strong>Day +${i + 1}</strong></td>
          <td>${dayName ? `${dayName}, ` : ''}${dateStr}</td>
          <td style="text-align: center; color: #64748b;">${formatNumber(low)}</td>
          <td style="text-align: right; font-weight: 700; color: #db2777;">${formatNumber(pred)} units</td>
          <td style="text-align: center; color: #64748b;">${formatNumber(high)}</td>
        </tr>`;
    }).join('')}
    </tbody>
  </table>

  ${includeCharts && images.expenseImg ? `
  <div class="chart-container">
    <img class="chart-img" src="${images.expenseImg}" alt="Monthly PO Outlay Forecast Chart" />
    <div class="chart-caption">Figure 1.2: Monthly Paid PO Historical Outlay vs. AutoTheta Budget Projection</div>
  </div>` : ''}

  <div class="section-title">
    <span>PROCUREMENT OUTLAY & BUDGET PROJECTIONS</span>
    <span style="font-size: 9px; font-weight: normal; color: #64748b;">Model: ${data.expense_next_month.model_used || 'AutoTheta'}</span>
  </div>
  <table class="table-custom">
    <thead>
      <tr>
        <th style="width: 35%;">Period / Billing Cycle</th>
        <th style="width: 35%;">Classification</th>
        <th style="width: 30%; text-align: right;">Expenditure Amount</th>
      </tr>
    </thead>
    <tbody>
      ${data.expense_next_month.historical.months.map((m, i) => {
        const amt = data.expense_next_month.historical.amounts[i] || 0;
        return `<tr>
          <td>${m}</td>
          <td><span style="background: #e0f2fe; color: #0284c7; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 8px;">Actual Paid POs</span></td>
          <td style="text-align: right; font-weight: 600;">${formatCurrency(amt)}</td>
        </tr>`;
    }).join('')}
      <tr style="background: #ecfdf5; font-weight: 700;">
        <td style="color: #059669;">Next Month (Projected Horizon)</td>
        <td><span style="background: #d1fae5; color: #059669; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 8px;">WASM Forecast</span></td>
        <td style="text-align: right; color: #059669; font-size: 11px;">${formatCurrency(data.expense_next_month.prediction)}</td>
      </tr>
    </tbody>
  </table>

  ${includeCharts && images.courierImg ? `
  <div class="chart-container">
    <img class="chart-img" src="${images.courierImg}" alt="Courier Distribution Pie Chart" />
    <div class="chart-caption">Figure 1.3: Courier Partner Volume Allocation & Market Share</div>
  </div>` : ''}

  <div class="section-title">
    <span>COURIER PARTNER VOLUME ALLOCATION</span>
  </div>
  <table class="table-custom">
    <thead>
      <tr>
        <th style="width: 45%;">Courier Partner</th>
        <th style="width: 30%; text-align: right;">Parcels Dispatched</th>
        <th style="width: 25%; text-align: right;">Market Share (%)</th>
      </tr>
    </thead>
    <tbody>
      ${courierList.map(([name, count]) => {
        const pct = ((count / totalCourierParcels) * 100).toFixed(1);
        return `<tr>
          <td><strong>${name}</strong></td>
          <td style="text-align: right;">${formatNumber(count)}</td>
          <td style="text-align: right; color: #64748b;">${pct}%</td>
        </tr>`;
    }).join('')}
    </tbody>
  </table>

  <div class="footer">
    <div>CONFIDENTIAL - AIRSHIP EXPRESS INTERNAL LOGISTICS INTELLIGENCE</div>
    <div>Page 1 of 1 · Generated automatically via Supabase & WASM Engine</div>
  </div>
</body>
</html>`;

    // Use in-page hidden iframe to trigger the native Print / Save as PDF overlay directly
    // This avoids opening and stranding the user on an empty about:blank browser tab!
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
        if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
        }
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
        } catch (err) {
            console.error('Print iframe error:', err);
        } finally {
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            }, 1500);
        }
    };

    // Guarantee that all images (logo & embedded chart snapshots) are fully loaded and decoded before print dialog
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
 * Produces a Word-compliant HTML document with standard MSO tags and embedded images
 */
function exportToWord(
    data: ForecastReportData,
    includeCharts: boolean,
    images: { parcelImg: string | null; expenseImg: string | null; courierImg: string | null }
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

    const courierList = Object.entries(data.raw_db_stats.courier_breakdown || {}).sort(
        (a, b) => b[1] - a[1]
    );
    const totalCourierParcels = courierList.reduce((sum, [, c]) => sum + c, 0) || 1;

    const htmlContent = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>Airship Express Forecast Report</title>
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
    body {
      font-family: Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #0f172a;
    }
    h1 {
      font-size: 16pt;
      color: #0f172a;
      margin-bottom: 2pt;
    }
    .subtitle {
      font-size: 10pt;
      color: #e11d48;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 12pt;
    }
    .meta {
      font-size: 8.5pt;
      color: #64748b;
      margin-bottom: 14pt;
    }
    h2 {
      font-size: 12pt;
      color: #0f172a;
      border-bottom: 1.5pt solid #cbd5e1;
      padding-bottom: 3pt;
      margin-top: 14pt;
      margin-bottom: 6pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12pt;
      font-size: 9.5pt;
    }
    th {
      background-color: #f1f5f9;
      border: 1pt solid #cbd5e1;
      padding: 6pt;
      text-align: left;
      font-weight: bold;
      color: #1e293b;
    }
    td {
      border: 1pt solid #cbd5e1;
      padding: 5pt 6pt;
      color: #334155;
    }
    .kpi-table th {
      background-color: #f8fafc;
      font-size: 8.5pt;
      text-transform: uppercase;
      color: #64748b;
    }
    .kpi-table td {
      font-size: 13pt;
      font-weight: bold;
      color: #0f172a;
    }
    .chart-box {
      text-align: center;
      margin: 10pt 0 14pt 0;
    }
    .chart-box img {
      width: 580pt;
      max-width: 100%;
      height: auto;
    }
    .caption {
      font-size: 8.5pt;
      color: #64748b;
      margin-top: 3pt;
      font-style: italic;
    }
    .highlight {
      color: #db2777;
      font-weight: bold;
    }
    .highlight-green {
      color: #059669;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <table style="width: 100%; border: none; margin-bottom: 8pt;">
    <tr>
      <td style="width: 50pt; border: none; vertical-align: middle; padding: 0;">
        <img src="/images/logo-remove-bg.png" alt="Airship Logo" style="width: 44pt; height: 44pt;" />
      </td>
      <td style="border: none; vertical-align: middle; padding-left: 10pt;">
        <h1 style="margin: 0; font-size: 16pt; color: #0f172a;">AIRSHIP <span style="color: #db2777;">EXPRESS</span> LOGISTICS</h1>
        <div class="subtitle" style="margin: 0; color: #e11d48; font-weight: bold; font-size: 10pt; text-transform: uppercase;">
          Operational Forecast Intelligence Report (${includeCharts ? 'With Embedded Charts' : 'Text & Tables Only'})
        </div>
      </td>
    </tr>
  </table>
  
  <div class="meta">
    <strong>Report Date:</strong> ${reportDate}, ${reportTime} |
    <strong>Forecasting Core:</strong> ${data.parcel_7_day.engine || 'Rust/WASM'} |
    <strong>Confidence Level:</strong> ${data.parcel_7_day.confidence || '95%'} CI
  </div>

  <h2>Key Performance Indicators</h2>
  <table class="kpi-table">
    <tr>
      <th style="width: 25%;">7-Day Projected Intake</th>
      <th style="width: 25%;">Next Month PO Outlay</th>
      <th style="width: 25%;">Database Parcels</th>
      <th style="width: 25%;">Top Courier</th>
    </tr>
    <tr>
      <td class="highlight">${formatNumber(data.parcel_7_day.total_next_week)} units</td>
      <td class="highlight-green">${formatCurrency(data.expense_next_month.prediction)}</td>
      <td>${formatNumber(data.raw_db_stats.total_parcels_in_db)} units</td>
      <td>${courierList[0]?.[0] || 'N/A'}</td>
    </tr>
  </table>

  <h2>Operational Peak Insights</h2>
  <table>
    <tr>
      <th style="width: 33%;">Busiest Month</th>
      <th style="width: 33%;">Peak Incoming Day</th>
      <th style="width: 34%;">Busiest Time Window</th>
    </tr>
    <tr>
      <td><strong>${data.parcel_7_day.peak_insights?.busiestMonth?.month || 'N/A'}</strong><br><span style="font-size: 8.5pt; color: #64748b;">${formatNumber(data.parcel_7_day.peak_insights?.busiestMonth?.count || 0)} parcels</span></td>
      <td><strong>${data.parcel_7_day.peak_insights?.busiestDay?.day || 'N/A'}</strong><br><span style="font-size: 8.5pt; color: #64748b;">${formatNumber(data.parcel_7_day.peak_insights?.busiestDay?.count || 0)} parcels</span></td>
      <td><strong>${data.parcel_7_day.peak_insights?.busiestHour?.timeRange || 'N/A'}</strong><br><span style="font-size: 8.5pt; color: #64748b;">${formatNumber(data.parcel_7_day.peak_insights?.busiestHour?.count || 0)} scans</span></td>
    </tr>
  </table>

  ${includeCharts && images.parcelImg ? `
  <div class="chart-box">
    <img src="${images.parcelImg}" alt="7-Day Parcel Forecast Chart" />
    <div class="caption">Figure 1.1: 7-Day Parcel Intake Trajectory & 95% Confidence Interval</div>
  </div>` : ''}

  <h2>Day-by-Day 7-Day Parcel Forecast (Model: ${data.parcel_7_day.model_used || 'Holt-Winters'})</h2>
  <table>
    <tr>
      <th style="width: 20%;">Horizon</th>
      <th style="width: 25%;">Projected Date</th>
      <th style="width: 18%; text-align: center;">Lower Bound</th>
      <th style="width: 19%; text-align: right;">Predicted Volume</th>
      <th style="width: 18%; text-align: center;">Upper Bound</th>
    </tr>
    ${data.parcel_7_day.dates.map((dateStr, i) => {
        const d = new Date(dateStr);
        const dayName = isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { weekday: 'short' });
        const pred = data.parcel_7_day.predictions[i] || 0;
        const low = data.parcel_7_day.confidence_interval.lower[i] || 0;
        const high = data.parcel_7_day.confidence_interval.upper[i] || 0;
        return `<tr>
        <td><strong>Day +${i + 1}</strong></td>
        <td>${dayName ? `${dayName}, ` : ''}${dateStr}</td>
        <td style="text-align: center;">${formatNumber(low)}</td>
        <td style="text-align: right;" class="highlight">${formatNumber(pred)} units</td>
        <td style="text-align: center;">${formatNumber(high)}</td>
      </tr>`;
    }).join('')}
  </table>

  ${includeCharts && images.expenseImg ? `
  <div class="chart-box">
    <img src="${images.expenseImg}" alt="Monthly PO Outlay Forecast Chart" />
    <div class="caption">Figure 1.2: Monthly Paid PO Outlay vs. Forecast Horizon</div>
  </div>` : ''}

  <h2>Procurement Outlay & Budget Projections (Model: ${data.expense_next_month.model_used || 'AutoTheta'})</h2>
  <table>
    <tr>
      <th style="width: 35%;">Period</th>
      <th style="width: 35%;">Classification</th>
      <th style="width: 30%; text-align: right;">Amount (₱)</th>
    </tr>
    ${data.expense_next_month.historical.months.map((m, i) => {
        const amt = data.expense_next_month.historical.amounts[i] || 0;
        return `<tr>
        <td>${m}</td>
        <td>Actual Confirmed/Delivered Paid POs</td>
        <td style="text-align: right;">${formatCurrency(amt)}</td>
      </tr>`;
    }).join('')}
    <tr style="background-color: #ecfdf5; font-weight: bold;">
      <td style="color: #059669;">Next Month (Projected)</td>
      <td style="color: #059669;">WASM Projected Budget</td>
      <td style="text-align: right; color: #059669;">${formatCurrency(data.expense_next_month.prediction)}</td>
    </tr>
  </table>

  ${includeCharts && images.courierImg ? `
  <div class="chart-box">
    <img src="${images.courierImg}" alt="Courier Distribution Pie Chart" />
    <div class="caption">Figure 1.3: Courier Partner Dispatch Volume Share</div>
  </div>` : ''}

  <h2>Courier Volume Breakdown</h2>
  <table>
    <tr>
      <th style="width: 50%;">Courier Partner</th>
      <th style="width: 25%; text-align: right;">Total Dispatched</th>
      <th style="width: 25%; text-align: right;">Share (%)</th>
    </tr>
    ${courierList.map(([name, count]) => {
        const pct = ((count / totalCourierParcels) * 100).toFixed(1);
        return `<tr>
        <td><strong>${name}</strong></td>
        <td style="text-align: right;">${formatNumber(count)}</td>
        <td style="text-align: right;">${pct}%</td>
      </tr>`;
    }).join('')}
  </table>

  <p style="font-size: 8pt; color: #94a3b8; margin-top: 20pt; border-top: 1pt solid #cbd5e1; padding-top: 4pt;">
    Airship Express Logistics · Operational Intelligence Report · Generated on ${reportDate}
  </p>
</body>
</html>`;

    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `airship-forecast-report-${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * EXCEL (.xls) EXPORT
 * Generates an Excel-compatible formatted spreadsheet with distinct sections & styled table cells
 */
function exportToExcel(data: ForecastReportData, _includeCharts: boolean) {
    const reportDate = new Date().toISOString().slice(0, 10);
    const courierList = Object.entries(data.raw_db_stats.courier_breakdown || {}).sort(
        (a, b) => b[1] - a[1]
    );
    const totalCourierParcels = courierList.reduce((sum, [, c]) => sum + c, 0) || 1;

    const excelHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>Forecast Projections</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
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
      <td colspan="5" class="title">AIRSHIP EXPRESS - OPERATIONAL FORECAST INTELLIGENCE REPORT</td>
    </tr>
    <tr>
      <td colspan="5" class="subtitle">Generated on ${reportDate} | Core: ${data.parcel_7_day.engine || 'WASM'}</td>
    </tr>
    <tr><td></td></tr>

    <!-- SUMMARY SECTION -->
    <tr>
      <td colspan="5" class="section-cell">1. EXECUTIVE SUMMARY & KEY PERFORMANCE INDICATORS</td>
    </tr>
    <tr>
      <td class="header-cell">7-Day Projected Parcel Volume</td>
      <td class="header-cell">Next Month PO Outlay (PHP)</td>
      <td class="header-cell">Sampling Parcels</td>
      <td class="header-cell">Top Courier Partner</td>
      <td class="header-cell">Confidence Interval</td>
    </tr>
    <tr>
      <td class="data-cell pink-cell">${data.parcel_7_day.total_next_week}</td>
      <td class="data-cell green-cell">${data.expense_next_month.prediction}</td>
      <td class="data-cell">${data.raw_db_stats.total_parcels_in_db}</td>
      <td class="data-cell">${courierList[0]?.[0] || 'N/A'}</td>
      <td class="data-cell">${data.parcel_7_day.confidence || '95%'}</td>
    </tr>
    <tr><td></td></tr>

    <!-- PEAK INSIGHTS -->
    <tr>
      <td colspan="5" class="section-cell">2. OPERATIONAL PEAK TRAFFIC INSIGHTS</td>
    </tr>
    <tr>
      <td class="header-cell">Busiest Calendar Month</td>
      <td class="header-cell">Parcels Recorded</td>
      <td class="header-cell">Peak Incoming Day of Week</td>
      <td class="header-cell">Busiest 1-Hour Time Window</td>
      <td class="header-cell">Peak Window Scan Count</td>
    </tr>
    <tr>
      <td class="data-cell">${data.parcel_7_day.peak_insights?.busiestMonth?.month || 'N/A'}</td>
      <td class="data-cell">${data.parcel_7_day.peak_insights?.busiestMonth?.count || 0}</td>
      <td class="data-cell">${data.parcel_7_day.peak_insights?.busiestDay?.day || 'N/A'}</td>
      <td class="data-cell">${data.parcel_7_day.peak_insights?.busiestHour?.timeRange || 'N/A'}</td>
      <td class="data-cell">${data.parcel_7_day.peak_insights?.busiestHour?.count || 0}</td>
    </tr>
    <tr><td></td></tr>

    <!-- 7-DAY PARCEL FORECAST -->
    <tr>
      <td colspan="5" class="section-cell">3. 7-DAY PARCEL INTAKE PREDICTION BREAKDOWN (${data.parcel_7_day.model_used || 'Holt-Winters'})</td>
    </tr>
    <tr>
      <th class="header-cell">Forecast Horizon</th>
      <th class="header-cell">Projected Date</th>
      <th class="header-cell">Lower 95% Bound</th>
      <th class="header-cell">Predicted Parcel Count</th>
      <th class="header-cell">Upper 95% Bound</th>
    </tr>
    ${data.parcel_7_day.dates.map((dateStr, i) => {
        const d = new Date(dateStr);
        const dayName = isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { weekday: 'short' });
        const pred = data.parcel_7_day.predictions[i] || 0;
        const low = data.parcel_7_day.confidence_interval.lower[i] || 0;
        const high = data.parcel_7_day.confidence_interval.upper[i] || 0;
        return `<tr>
        <td class="data-cell">Day +${i + 1}</td>
        <td class="data-cell">${dayName ? `${dayName}, ` : ''}${dateStr}</td>
        <td class="data-cell" style="text-align: right;">${low}</td>
        <td class="data-cell pink-cell" style="text-align: right;">${pred}</td>
        <td class="data-cell" style="text-align: right;">${high}</td>
      </tr>`;
    }).join('')}
    <tr><td></td></tr>

    <!-- PROCUREMENT EXPENSES -->
    <tr>
      <td colspan="5" class="section-cell">4. MONTHLY PROCUREMENT EXPENSE & BUDGET FORECAST (${data.expense_next_month.model_used || 'AutoTheta'})</td>
    </tr>
    <tr>
      <th class="header-cell" colspan="2">Period / Month</th>
      <th class="header-cell">Classification</th>
      <th class="header-cell" colspan="2">Expenditure Amount (PHP)</th>
    </tr>
    ${data.expense_next_month.historical.months.map((m, i) => {
        const amt = data.expense_next_month.historical.amounts[i] || 0;
        return `<tr>
        <td class="data-cell" colspan="2">${m}</td>
        <td class="data-cell">Actual Paid POs (Confirmed/Delivered)</td>
        <td class="data-cell" colspan="2" style="text-align: right;">${amt}</td>
      </tr>`;
    }).join('')}
    <tr style="background-color: #ecfdf5;">
      <td class="data-cell green-cell" colspan="2">Next Month (Projected)</td>
      <td class="data-cell green-cell">WASM Trend Forecast Budget</td>
      <td class="data-cell green-cell" colspan="2" style="text-align: right;">${data.expense_next_month.prediction}</td>
    </tr>
    <tr><td></td></tr>

    <!-- COURIER PARTNERS -->
    <tr>
      <td colspan="5" class="section-cell">5. COURIER PARTNER DISPATCH ALLOCATION</td>
    </tr>
    <tr>
      <th class="header-cell" colspan="2">Courier Partner</th>
      <th class="header-cell" colspan="2">Dispatched Parcels</th>
      <th class="header-cell">Market Share (%)</th>
    </tr>
    ${courierList.map(([name, count]) => {
        const pct = ((count / totalCourierParcels) * 100).toFixed(1);
        return `<tr>
        <td class="data-cell" colspan="2">${name}</td>
        <td class="data-cell" colspan="2" style="text-align: right;">${count}</td>
        <td class="data-cell" style="text-align: right;">${pct}%</td>
      </tr>`;
    }).join('')}
  </table>
</body>
</html>`;

    const blob = new Blob(['\ufeff' + excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `airship-forecast-report-${reportDate}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
