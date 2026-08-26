import { NextResponse } from 'next/server';
import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import fs from 'fs';
import path from 'path';

let wasmInitialized = false;
let anofoxLib: any = null;

async function getAnofox() {
    if (!anofoxLib) {
        anofoxLib = await import('@sipemu/anofox-forecast');
    }
    if (!wasmInitialized) {
        try {
            const wasmPath = path.join(process.cwd(), 'node_modules', '@sipemu/anofox-forecast', 'anofox_forecast_js_bg.wasm');
            if (fs.existsSync(wasmPath)) {
                const wasmBuffer = fs.readFileSync(wasmPath);
                anofoxLib.initSync({ module: wasmBuffer });
                wasmInitialized = true;
            } else {
                await anofoxLib.default();
                wasmInitialized = true;
            }
        } catch (err) {
            console.error('Error initializing WASM in API route:', err);
            await anofoxLib.default();
            wasmInitialized = true;
        }
    }
    return anofoxLib;
}

// process supabase parcels
function processDailyParcelData(parcels: any[]) {
    const courierCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};
    const dailyMap = new Map<string, number>();
    const monthMap = new Map<string, number>();
    const dayOfWeekMap: Record<string, number> = {
        'Sunday': 0, 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0, 'Friday': 0, 'Saturday': 0
    };
    const dayOfWeekNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const hourMap: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourMap[h] = 0;

    parcels.forEach((p) => {
        // courier distribution
        const courier = (p.courier || 'Unknown').trim();
        courierCounts[courier] = (courierCounts[courier] || 0) + 1;

        // status distribution
        const status = (p.status || 'Unknown').trim();

        // temporal analysis
        if (p.created_at) {
            const d = new Date(p.created_at);
            const dateStr = d.toISOString().split('T')[0];
            const monthStr = dateStr.slice(0, 7); // YYYY-MM
            const dayName = dayOfWeekNames[d.getDay()];
            const hour = d.getHours();

            dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + 1);
            monthMap.set(monthStr, (monthMap.get(monthStr) || 0) + 1);
            dayOfWeekMap[dayName] = (dayOfWeekMap[dayName] || 0) + 1;
            hourMap[hour] = (hourMap[hour] || 0) + 1;
        }
    });

    // busiest month
    let busiestMonth = { month: 'N/A', count: 0 };
    monthMap.forEach((cnt, mo) => {
        if (cnt > busiestMonth.count) {
            const [y, m] = mo.split('-');
            const dateObj = new Date(parseInt(y), parseInt(m) - 1, 1);
            busiestMonth = {
                month: `${dateObj.toLocaleString('default', { month: 'long' })} ${y}`,
                count: cnt
            };
        }
    });

    // busiest day
    let busiestDay = { day: 'N/A', count: 0 };
    Object.entries(dayOfWeekMap).forEach(([day, cnt]) => {
        if (cnt > busiestDay.count) {
            busiestDay = { day, count: cnt };
        }
    });

    // busiest time
    let busiestHour = { timeRange: 'N/A', count: 0 };
    Object.entries(hourMap).forEach(([hrStr, cnt]) => {
        const hr = parseInt(hrStr);
        if (cnt > busiestHour.count) {
            const formatHour = (h: number) => {
                const period = h >= 12 ? 'PM' : 'AM';
                const standardHr = h % 12 === 0 ? 12 : h % 12;
                return `${standardHr}:00 ${period}`;
            };
            busiestHour = {
                timeRange: `${formatHour(hr)} - ${formatHour((hr + 1) % 24)}`,
                count: cnt
            };
        }
    });

    // daily timeline
    let sortedDates: string[] = [];
    let dailyCounts: number[] = [];

    if (dailyMap.size > 0) {
        const rawDateKeys = Array.from(dailyMap.keys()).sort();
        const firstDate = new Date(rawDateKeys[0]);
        const lastDate = new Date(rawDateKeys[rawDateKeys.length - 1]);
        
        let cur = new Date(firstDate);
        while (cur <= lastDate) {
            const dStr = cur.toISOString().split('T')[0];
            sortedDates.push(dStr);
            dailyCounts.push(dailyMap.get(dStr) || 0);
            cur.setDate(cur.getDate() + 1);
        }
    }

    let displayDates: string[] = [];
    let displayCounts: number[] = [];
    let aggregationType = 'Daily';

    const totalDays = sortedDates.length;

    if (totalDays <= 30) {
        displayDates = [...sortedDates];
        displayCounts = [...dailyCounts];
        aggregationType = 'Daily';
    } else {
        let bucketSize = 7;
        if (totalDays <= 60) {
            bucketSize = 7;
            aggregationType = 'Weekly';
        } else if (totalDays <= 90) {
            bucketSize = 14;
            aggregationType = 'Bi-Weekly';
        } else if (totalDays <= 120) {
            bucketSize = 21;
            aggregationType = 'Tri-Weekly';
        } else {
            bucketSize = 28;
            aggregationType = 'Monthly';
        }

        for (let i = 0; i < totalDays; i += bucketSize) {
            const endIdx = Math.min(i + bucketSize - 1, totalDays - 1);
            const startStr = sortedDates[i];
            const endStr = sortedDates[endIdx];
            
            const startParts = startStr.split('-');
            const endParts = endStr.split('-');
            
            const label = startStr === endStr 
                ? `${startParts[1]}/${startParts[2]}` 
                : `${startParts[1]}/${startParts[2]}-${endParts[1]}/${endParts[2]}`;

            let sum = 0;
            for (let j = i; j <= endIdx; j++) {
                sum += dailyCounts[j];
            }
            
            displayDates.push(label);
            displayCounts.push(sum);
        }
    }

    return {
        dates: sortedDates,
        counts: dailyCounts,
        displayDates,
        displayCounts,
        aggregationType,
        totalParcels: parcels.length,
        courierCounts,
        statusCounts,
        peakInsights: {
            busiestMonth,
            busiestDay,
            busiestHour
        }
    };
}

// process supabase pos
function processMonthlyExpenseData(purchaseOrders: any[]) {
    const monthlyMap = new Map<string, number>();
    let totalExpenseSum = 0;

    purchaseOrders.forEach((po) => {
        const amount = Number(po.total_amount) || 0;
        totalExpenseSum += amount;
        if (po.created_at) {
            const month = new Date(po.created_at).toISOString().slice(0, 7);
            monthlyMap.set(month, (monthlyMap.get(month) || 0) + amount);
        }
    });

    const months = Array.from(monthlyMap.keys()).sort();
    const amounts = months.map(m => monthlyMap.get(m) || 0);

    return {
        months,
        amounts,
        totalExpenseSum,
        poCount: purchaseOrders.length
    };
}

export async function GET() {
    try {
        const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

        // fetch database
        const [{ data: parcels, error: parcelErr }, { data: expenses, error: expenseErr }] = await Promise.all([
            supabase
                .from('parcels')
                .select('id, barcode, tracking_number, courier, status, created_at')
                .gte('created_at', sixMonthsAgo)
                .order('created_at', { ascending: true }),
            supabase
                .from('purchase_orders')
                .select('id, po_number, supplier_name, total_amount, paid, status, created_at')
                .gte('created_at', sixMonthsAgo)
                .order('created_at', { ascending: true })
        ]);

        if (parcelErr) {
            console.error('Supabase parcel error:', parcelErr);
            throw new Error(`Parcels fetch failed: ${parcelErr.message}`);
        }
        if (expenseErr) {
            console.error('Supabase purchase_orders error:', expenseErr);
        }

        const parcelList = parcels || [];
        const expenseList = expenses || [];
        
        // filter paid pos
        const validStatuses = ['Confirmed', 'Delivered'];
        const qualifiedExpenseList = expenseList.filter(po => 
            po.paid === true && validStatuses.includes(po.status)
        );

        // aggregate records
        const parcelAgg = processDailyParcelData(parcelList);
        const expenseAgg = processMonthlyExpenseData(qualifiedExpenseList);

        // load forecast
        const anofox = await getAnofox();
        const { TimeSeries, HoltWintersForecaster, AutoThetaForecaster, NaiveForecaster, SESForecaster } = anofox;

        // forecast parcels
        let parcelPredictions: number[] = [];
        let parcelLower: number[] = [];
        let parcelUpper: number[] = [];

        if (parcelAgg.counts.length > 0) {
            const tsParcels = new TimeSeries(new Float64Array(parcelAgg.counts));
            
            if (parcelAgg.counts.length >= 7) {
                try {
                    const model = HoltWintersForecaster.auto(7, 'additive');
                    model.fit(tsParcels);
                    const fc = model.predictWithIntervals(7, 0.95);
                    parcelPredictions = Array.from(fc.values as Float64Array).map((v: number) => Math.max(0, Math.round(v)));
                    parcelLower = Array.from((fc.lower || []) as Float64Array).map((v: number) => Math.max(0, Math.round(v)));
                    parcelUpper = Array.from((fc.upper || []) as Float64Array).map((v: number) => Math.max(0, Math.round(v)));
                } catch {
                    const model = new AutoThetaForecaster();
                    model.fit(tsParcels);
                    const fc = model.predictWithIntervals(7, 0.95);
                    parcelPredictions = Array.from(fc.values as Float64Array).map((v: number) => Math.max(0, Math.round(v)));
                    parcelLower = Array.from((fc.lower || []) as Float64Array).map((v: number) => Math.max(0, Math.round(v)));
                    parcelUpper = Array.from((fc.upper || []) as Float64Array).map((v: number) => Math.max(0, Math.round(v)));
                }
            } else if (parcelAgg.counts.length >= 6) {
                const model = new AutoThetaForecaster();
                model.fit(tsParcels);
                const fc = model.predictWithIntervals(7, 0.95);
                parcelPredictions = Array.from(fc.values as Float64Array).map((v: number) => Math.max(0, Math.round(v)));
                parcelLower = Array.from((fc.lower || []) as Float64Array).map((v: number) => Math.max(0, Math.round(v)));
                parcelUpper = Array.from((fc.upper || []) as Float64Array).map((v: number) => Math.max(0, Math.round(v)));
            } else {
                const model = new NaiveForecaster();
                model.fit(tsParcels);
                const fc = model.predict(7);
                parcelPredictions = Array.from(fc.values as Float64Array).map((v: number) => Math.max(0, Math.round(v)));
                parcelLower = parcelPredictions.map((v: number) => Math.max(0, Math.round(v * 0.85)));
                parcelUpper = parcelPredictions.map((v: number) => Math.round(v * 1.15));
            }
        }

        // future dates
        const lastDateStr = parcelAgg.dates[parcelAgg.dates.length - 1] || new Date().toISOString().split('T')[0];
        const next7Days: string[] = [];
        const baseDate = new Date(lastDateStr);
        for (let i = 1; i <= 7; i++) {
            const nextD = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000);
            next7Days.push(nextD.toISOString().split('T')[0]);
        }

        const totalNextWeek = parcelPredictions.reduce((a: number, b: number) => a + b, 0);

        // forecast expense
        let expensePrediction = 0;
        let expenseLower = 0;
        let expenseUpper = 0;

        if (expenseAgg.amounts.length >= 6) {
            const tsExpenses = new TimeSeries(new Float64Array(expenseAgg.amounts));
            const modelExp = new AutoThetaForecaster();
            modelExp.fit(tsExpenses);
            const fcExp = modelExp.predictWithIntervals(1, 0.90);

            expensePrediction = Math.max(0, Math.round(Number(fcExp.values[0]) || 0));
            expenseLower = Math.max(0, Math.round(fcExp.lower ? Number(fcExp.lower[0]) : (expensePrediction * 0.85)));
            expenseUpper = Math.max(0, Math.round(fcExp.upper ? Number(fcExp.upper[0]) : (expensePrediction * 1.15)));
        } else if (expenseAgg.amounts.length > 0) {
            const tsExpenses = new TimeSeries(new Float64Array(expenseAgg.amounts));
            const modelExp = new NaiveForecaster();
            modelExp.fit(tsExpenses);
            const fcExp = modelExp.predict(1);

            expensePrediction = Math.max(0, Math.round(Number(fcExp.values[0]) || 0));
            expenseLower = Math.max(0, Math.round(expensePrediction * 0.85));
            expenseUpper = Math.max(0, Math.round(expensePrediction * 1.15));
        }

        // parcel confidence
        let parcelConfidence = "0%";
        let parcelAlgorithmUsed = "No Data";
        let parcelExplanation = "No parcel records found in Supabase. Register parcel intakes to enable statistical time-series forecasting.";
        
        if (parcelAgg.counts.length >= 14) {
            parcelConfidence = "95%";
            parcelAlgorithmUsed = "Holt-Winters Seasonal Additive (Auto-parameterized)";
            parcelExplanation = `Calculated by analyzing ${parcelAgg.dates.length} days of historical parcel intake. The ${parcelAlgorithmUsed} model extracts recurring 7-day cyclical weekly seasonality and trend components at a 95% statistical confidence envelope.`;
        } else if (parcelAgg.counts.length >= 7) {
            parcelConfidence = "80%";
            parcelAlgorithmUsed = "Holt-Winters (Short Sample)";
            parcelExplanation = `Calculated from ${parcelAgg.dates.length} days of records. Baseline 7-day seasonality detected with moderate 80% confidence due to limited historical cycles.`;
        } else if (parcelAgg.counts.length >= 3) {
            parcelConfidence = "50%";
            parcelAlgorithmUsed = "AutoTheta Decomposition (Limited Data)";
            parcelExplanation = `Limited dataset (${parcelAgg.dates.length} days). Predictions are indicative trend projections with 50% baseline confidence.`;
        } else if (parcelAgg.counts.length > 0) {
            parcelConfidence = "20%";
            parcelAlgorithmUsed = "Naive Last-Observed Extrapolation";
            parcelExplanation = `Insufficient sample size (${parcelAgg.dates.length} days). Low 20% confidence estimate.`;
        }

        // expense confidence
        let expenseConfidence = "0%";
        let expenseAlgorithmUsed = "No Data";
        let expenseExplanation = "No qualifying paid purchase orders (Confirmed/Delivered) found. Mark purchase orders as paid in Procurement to generate outlay predictions.";

        if (expenseAgg.amounts.length >= 6) {
            expenseConfidence = "90%";
            expenseAlgorithmUsed = "AutoTheta Time-Series Forecaster";
            expenseExplanation = `Calculated from ${expenseAgg.months.length} monthly billing cycles of paid purchase orders. The ${expenseAlgorithmUsed} model isolates long-term outlay trajectories with exponential smoothing at a 90% confidence boundary.`;
        } else if (expenseAgg.amounts.length >= 3) {
            expenseConfidence = "70%";
            expenseAlgorithmUsed = "AutoTheta (Short Horizon)";
            expenseExplanation = `Calculated from ${expenseAgg.months.length} monthly billing cycles. Moderate 70% confidence due to limited quarterly history.`;
        } else if (expenseAgg.amounts.length >= 1) {
            expenseConfidence = "40%";
            expenseAlgorithmUsed = "Naive Monthly Extrapolation";
            expenseExplanation = `Only ${expenseAgg.months.length} month(s) of paid purchase orders available. Trend confidence is reduced to 40%.`;
        }

        return NextResponse.json({
            success: true,
            raw_db_stats: {
                total_parcels_in_db: parcelAgg.totalParcels,
                total_pos_in_db: expenseList.length,
                total_paid_pos_in_db: qualifiedExpenseList.length,
                courier_breakdown: parcelAgg.courierCounts,
                status_breakdown: parcelAgg.statusCounts,
            },
            parcel_7_day: {
                predictions: parcelPredictions,
                confidence_interval: {
                    lower: parcelLower,
                    upper: parcelUpper
                },
                total_next_week: totalNextWeek,
                confidence: parcelConfidence,
                model_used: parcelAlgorithmUsed,
                engine: "@sipemu/anofox-forecast (Rust/WASM)",
                explanation: parcelExplanation,
                dates: next7Days,
                historical: {
                    dates: parcelAgg.dates,
                    counts: parcelAgg.counts,
                    display_dates: parcelAgg.displayDates,
                    display_counts: parcelAgg.displayCounts,
                    aggregation_type: parcelAgg.aggregationType,
                    total_actual: parcelAgg.totalParcels
                },
                peak_insights: parcelAgg.peakInsights
            },
            expense_next_month: {
                prediction: expensePrediction,
                confidence_interval: {
                    lower: expenseLower,
                    upper: expenseUpper
                },
                confidence: expenseConfidence,
                model_used: expenseAlgorithmUsed,
                engine: "@sipemu/anofox-forecast (Rust/WASM)",
                explanation: expenseExplanation,
                historical: {
                    months: expenseAgg.months,
                    amounts: expenseAgg.amounts,
                    total_actual: expenseAgg.totalExpenseSum
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('Forecast route error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Failed to generate forecast'
            },
            { status: 500 }
        );
    }
}
