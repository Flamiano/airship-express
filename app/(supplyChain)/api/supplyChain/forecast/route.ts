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

// Process STRICTLY from real supabase parcels table
function processDailyParcelData(parcels: any[]) {
    const courierCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};
    const dailyMap = new Map<string, number>();

    parcels.forEach((p) => {
        // 1. Courier distribution (for Pie Chart)
        const courier = (p.courier || 'Unknown').trim();
        courierCounts[courier] = (courierCounts[courier] || 0) + 1;

        // 2. Status distribution
        const status = (p.status || 'Unknown').trim();
        statusCounts[status] = (statusCounts[status] || 0) + 1;

        // 3. Daily grouping
        if (p.created_at) {
            const date = new Date(p.created_at).toISOString().split('T')[0];
            dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
        }
    });

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

    return {
        dates: sortedDates,
        counts: dailyCounts,
        totalParcels: parcels.length,
        courierCounts,
        statusCounts
    };
}

// Process purchase orders strictly from supabase
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

        // 1. Fetch strictly from Supabase Database
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
        const paidExpenseList = expenseList.filter(po => po.paid === true);
        const actualExpensesToUse = paidExpenseList.length > 0 ? paidExpenseList : expenseList;

        // 2. Aggregate raw database records
        const parcelAgg = processDailyParcelData(parcelList);
        const expenseAgg = processMonthlyExpenseData(actualExpensesToUse);

        // 3. Load @sipemu/anofox-forecast
        const anofox = await getAnofox();
        const { TimeSeries, HoltWintersForecaster, AutoThetaForecaster, NaiveForecaster, SESForecaster } = anofox;

        // 4. Forecast Parcels (Next 7 Days with 95% CI)
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

        // Generate the next 7 future dates
        const lastDateStr = parcelAgg.dates[parcelAgg.dates.length - 1] || new Date().toISOString().split('T')[0];
        const next7Days: string[] = [];
        const baseDate = new Date(lastDateStr);
        for (let i = 1; i <= 7; i++) {
            const nextD = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000);
            next7Days.push(nextD.toISOString().split('T')[0]);
        }

        const totalNextWeek = parcelPredictions.reduce((a: number, b: number) => a + b, 0);

        // 5. Forecast Monthly Expense (Next Month with 90% CI)
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

        return NextResponse.json({
            success: true,
            raw_db_stats: {
                total_parcels_in_db: parcelAgg.totalParcels,
                total_pos_in_db: expenseList.length,
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
                confidence: "95%",
                dates: next7Days,
                historical: {
                    dates: parcelAgg.dates,
                    counts: parcelAgg.counts,
                    total_actual: parcelAgg.totalParcels
                }
            },
            expense_next_month: {
                prediction: expensePrediction,
                confidence_interval: {
                    lower: expenseLower,
                    upper: expenseUpper
                },
                confidence: "90%",
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
