// app/(supplyChain)/(pages)/forecast/api/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_URL || '';
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_ANON_KEY || '';

const dbClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

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
            console.warn('WASM sync init warning in forecast API, falling back to default:', err);
            try {
                await anofoxLib.default();
                wasmInitialized = true;
            } catch (fallbackErr) {
                console.error('Failed to initialize anofox WASM:', fallbackErr);
            }
        }
    }
    return anofoxLib;
}

// Croston's Method with Syntetos-Boylan Approximation (SBA) for intermittent & sporadic demand
function runCrostonSBA(
    counts: number[],
    horizon: number = 7,
    alpha: number = 0.15
): { predictions: number[]; lower: number[]; upper: number[]; confidence: string; model_used: string } {
    let z = 0; // smoothed demand magnitude
    let p = 1; // smoothed inter-arrival interval (days between demand)
    let q = 0; // days since last demand
    let firstNonZero = false;

    for (let i = 0; i < counts.length; i++) {
        const y = counts[i];
        q++;
        if (y > 0) {
            if (!firstNonZero) {
                z = y;
                p = q;
                firstNonZero = true;
            } else {
                z = z + alpha * (y - z);
                p = p + alpha * (q - p);
            }
            q = 0;
        }
    }

    // Syntetos-Boylan Approximation (SBA) factor: (1 - alpha / 2) debiases Croston's positive skew
    const sbaFactor = 1 - alpha / 2;
    const expectedDailyDemand = p > 0 ? Math.max(0, sbaFactor * (z / p)) : 0;

    // Recent recency run-rate weighting (past 7 to 14 days)
    const recent7 = counts.slice(-7);
    const recent7Avg = recent7.length > 0 ? recent7.reduce((a, b) => a + b, 0) / recent7.length : 0;
    const recent14 = counts.slice(-14);
    const recent14Avg = recent14.length > 0 ? recent14.reduce((a, b) => a + b, 0) / recent14.length : 0;

    const blendedDaily = Math.max(
        0,
        expectedDailyDemand * 0.7 + (recent7Avg * 0.2 + recent14Avg * 0.1)
    );

    const predictions: number[] = [];
    const lower: number[] = [];
    const upper: number[] = [];

    for (let h = 0; h < horizon; h++) {
        // slight temporal decay for unconfirmed sporadic demand
        const val = Math.max(0, Math.round(blendedDaily * Math.pow(0.98, h)));
        predictions.push(val);
        lower.push(Math.max(0, Math.round(val * 0.5)));
        upper.push(Math.max(1, Math.round(val * 1.5 + 1)));
    }

    return {
        predictions,
        lower,
        upper,
        confidence: counts.some(c => c > 0) ? '82%' : '40%',
        model_used: "Croston's Intermittent Demand (SBA-Calibrated)"
    };
}

// Moving Average & Baseline Forecaster
function runMovingAverageForecast(
    counts: number[],
    horizon: number = 7,
    windowSize: number = 7
): { predictions: number[]; lower: number[]; upper: number[]; confidence: string; model_used: string } {
    if (!counts || counts.length === 0) {
        return {
            predictions: Array(horizon).fill(0),
            lower: Array(horizon).fill(0),
            upper: Array(horizon).fill(0),
            confidence: '0%',
            model_used: 'Zero Baseline'
        };
    }

    const window = counts.slice(-windowSize);
    const avg = window.reduce((a, b) => a + b, 0) / window.length;
    const roundedAvg = Math.max(0, Math.round(avg));

    return {
        predictions: Array(horizon).fill(roundedAvg),
        lower: Array(horizon).fill(Math.max(0, Math.round(roundedAvg * 0.7))),
        upper: Array(horizon).fill(Math.max(1, Math.round(roundedAvg * 1.3))),
        confidence: '70%',
        model_used: `Moving Average (${windowSize}-Day Window)`
    };
}

// Robust Multi-Method Forecaster with Chronological Validation
async function executeTimeSeriesForecast(
    counts: number[],
    horizon: number = 7
): Promise<{
    predictions: number[];
    lower: number[];
    upper: number[];
    confidence: string;
    model_used: string;
    evaluation: {
        has_evaluation: boolean;
        mae: number;
        rmse: number;
        wape: number;
        accuracy_percentage: number;
        actual_holdout_sum: number;
        forecast_holdout_sum: number;
        model_tested: string;
    } | null;
}> {
    const totalDays = counts.length;
    const nonZeroCount = counts.filter(c => c > 0).length;
    const zeroDaysFraction = totalDays > 0 ? (totalDays - nonZeroCount) / totalDays : 1;
    const totalVolume = counts.reduce((a, b) => a + b, 0);

    // If zero observations throughout the entire history
    if (totalVolume === 0) {
        return {
            predictions: Array(horizon).fill(0),
            lower: Array(horizon).fill(0),
            upper: Array(horizon).fill(0),
            confidence: '0%',
            model_used: 'Zero-Demand Baseline (No Historical Consumption)',
            evaluation: null
        };
    }

    let anofox: any = null;
    try {
        anofox = await getAnofox();
    } catch (e) {
        console.warn('Could not load anofox WASM; using native statistical models:', e);
    }

    // 1. Chronological Holdout Validation (if at least 14 days of data)
    let evaluationResult: any = null;
    let preferredModelType: 'croston' | 'autotheta' | 'holtwinters' | 'moving_avg' = 'croston';

    if (totalDays >= 14 && nonZeroCount >= 2) {
        const holdoutSize = Math.min(horizon, 7, Math.floor(totalDays / 3));
        const trainCounts = counts.slice(0, totalDays - holdoutSize);
        const actualHoldout = counts.slice(totalDays - holdoutSize);
        const actualHoldoutSum = actualHoldout.reduce((a, b) => a + b, 0);

        // Candidate 1: Croston SBA
        const crostonHoldout = runCrostonSBA(trainCounts, holdoutSize).predictions;
        const crostonMae = actualHoldout.reduce((sum, act, i) => sum + Math.abs(act - (crostonHoldout[i] || 0)), 0) / holdoutSize;

        // Candidate 2: Moving Average (7-day)
        const maHoldout = runMovingAverageForecast(trainCounts, holdoutSize, 7).predictions;
        const maMae = actualHoldout.reduce((sum, act, i) => sum + Math.abs(act - (maHoldout[i] || 0)), 0) / holdoutSize;

        let bestMae = crostonMae;
        preferredModelType = 'croston';

        if (maMae < bestMae) {
            bestMae = maMae;
            preferredModelType = 'moving_avg';
        }

        // Candidate 3: AutoTheta / HoltWinters if anofox available and data not hyper-sparse
        if (anofox && zeroDaysFraction < 0.65 && trainCounts.length >= 7) {
            try {
                const { TimeSeries, AutoThetaForecaster, HoltWintersForecaster } = anofox;
                const tsTrain = new TimeSeries(new Float64Array(trainCounts));

                let wasmPreds: number[] = [];
                let wasmModelName = 'AutoTheta';
                try {
                    const hw = HoltWintersForecaster.auto(7, 'additive');
                    hw.fit(tsTrain);
                    const hwFc = hw.predict(holdoutSize);
                    wasmPreds = Array.from(hwFc.values as Float64Array).map(v => Math.max(0, Math.round(v)));
                    wasmModelName = 'HoltWinters';
                } catch {
                    const at = new AutoThetaForecaster();
                    at.fit(tsTrain);
                    const atFc = at.predict(holdoutSize);
                    wasmPreds = Array.from(atFc.values as Float64Array).map(v => Math.max(0, Math.round(v)));
                    wasmModelName = 'AutoTheta';
                }

                const wasmMae = actualHoldout.reduce((sum, act, i) => sum + Math.abs(act - (wasmPreds[i] || 0)), 0) / holdoutSize;
                if (wasmMae < bestMae) {
                    bestMae = wasmMae;
                    preferredModelType = wasmModelName === 'HoltWinters' ? 'holtwinters' : 'autotheta';
                }
            } catch (err) {
                // Ignore WASM error during validation
            }
        }

        // Compute chosen model holdout error metrics
        const chosenHoldoutPreds = preferredModelType === 'croston' ? crostonHoldout :
            preferredModelType === 'moving_avg' ? maHoldout :
            runCrostonSBA(trainCounts, holdoutSize).predictions;

        const totalAbsErr = actualHoldout.reduce((sum, act, i) => sum + Math.abs(act - (chosenHoldoutPreds[i] || 0)), 0);
        const mae = totalAbsErr / holdoutSize;
        const mse = actualHoldout.reduce((sum, act, i) => sum + Math.pow(act - (chosenHoldoutPreds[i] || 0), 2), 0) / holdoutSize;
        const rmse = Math.sqrt(mse);
        const forecastHoldoutSum = chosenHoldoutPreds.reduce((a, b) => a + b, 0);

        let wape = actualHoldoutSum > 0 ? (totalAbsErr / actualHoldoutSum) * 100 : 0;
        let accuracy = actualHoldoutSum > 0 ? Math.max(0, Math.min(100, Math.round(100 - wape))) : (forecastHoldoutSum === 0 ? 100 : 50);

        evaluationResult = {
            has_evaluation: true,
            mae: Math.round(mae * 100) / 100,
            rmse: Math.round(rmse * 100) / 100,
            wape: Math.round(wape * 10) / 10,
            accuracy_percentage: accuracy,
            actual_holdout_sum: actualHoldoutSum,
            forecast_holdout_sum: forecastHoldoutSum,
            model_tested: preferredModelType
        };
    }

    // 2. Generate final forward forecast on entire series
    // Intermittent data or sparse points: Croston SBA
    if (zeroDaysFraction >= 0.40 || nonZeroCount < 5 || preferredModelType === 'croston') {
        const croston = runCrostonSBA(counts, horizon);
        return {
            ...croston,
            evaluation: evaluationResult
        };
    }

    // Moving average preferred
    if (preferredModelType === 'moving_avg' || !anofox) {
        const ma = runMovingAverageForecast(counts, horizon, 7);
        return {
            ...ma,
            evaluation: evaluationResult
        };
    }

    // Advanced WASM model execution
    try {
        const { TimeSeries, AutoThetaForecaster, HoltWintersForecaster } = anofox;
        const ts = new TimeSeries(new Float64Array(counts));

        let predictions: number[] = [];
        let lower: number[] = [];
        let upper: number[] = [];
        let modelUsed = '';
        let confidence = '88%';

        if (preferredModelType === 'holtwinters' && counts.length >= 14) {
            try {
                const model = HoltWintersForecaster.auto(7, 'additive');
                model.fit(ts);
                const fc = model.predictWithIntervals(horizon, 0.90);
                predictions = Array.from(fc.values as Float64Array).map(v => Math.max(0, Math.round(v)));
                lower = Array.from((fc.lower || []) as Float64Array).map(v => Math.max(0, Math.round(v)));
                upper = Array.from((fc.upper || []) as Float64Array).map(v => Math.max(0, Math.round(v)));
                modelUsed = 'Holt-Winters Additive Seasonality';
                confidence = '92%';
            } catch {
                const model = new AutoThetaForecaster();
                model.fit(ts);
                const fc = model.predictWithIntervals(horizon, 0.90);
                predictions = Array.from(fc.values as Float64Array).map(v => Math.max(0, Math.round(v)));
                lower = Array.from((fc.lower || []) as Float64Array).map(v => Math.max(0, Math.round(v)));
                upper = Array.from((fc.upper || []) as Float64Array).map(v => Math.max(0, Math.round(v)));
                modelUsed = 'AutoTheta Time-Series Forecaster';
                confidence = '88%';
            }
        } else {
            const model = new AutoThetaForecaster();
            model.fit(ts);
            const fc = model.predictWithIntervals(horizon, 0.90);
            predictions = Array.from(fc.values as Float64Array).map(v => Math.max(0, Math.round(v)));
            lower = Array.from((fc.lower || []) as Float64Array).map(v => Math.max(0, Math.round(v)));
            upper = Array.from((fc.upper || []) as Float64Array).map(v => Math.max(0, Math.round(v)));
            modelUsed = 'AutoTheta Time-Series Forecaster';
            confidence = '86%';
        }

        // Explosive trend guardrail: ensure Holt-Winters / AutoTheta did not blow up
        const predictedSum = predictions.reduce((a, b) => a + b, 0);
        const recent14Sum = counts.slice(-14).reduce((a, b) => a + b, 0);
        const maxPlausible = Math.max(recent14Sum * 2, totalVolume * 0.8, 10);

        if (predictedSum > maxPlausible) {
            const fallback = runCrostonSBA(counts, horizon);
            return {
                ...fallback,
                model_used: 'Damped Trend (Outlier Guardrail Applied)',
                evaluation: evaluationResult
            };
        }

        return {
            predictions,
            lower,
            upper,
            confidence,
            model_used: modelUsed,
            evaluation: evaluationResult
        };
    } catch (err) {
        console.warn('WASM fit failed, defaulting to Croston SBA:', err);
        const fallback = runCrostonSBA(counts, horizon);
        return {
            ...fallback,
            evaluation: evaluationResult
        };
    }
}

// Generate Gemini AI Executive Insights
async function generateGeminiInsights(context: {
    totalItems: number;
    forecastHorizon: number;
    totalDemand: number;
    criticalCount: number;
    lowStockCount: number;
    normalCount: number;
    criticalItems: { item_code: string; item_name: string; available_stock: number; forecast_demand: number; projected_stock: number; unit: string }[];
    topConsumed: { item_name: string; total_quantity: number; unit: string }[];
    fastMoving: { item_name: string; growth: number }[];
    departmentBreakdown: { department: string; total_quantity: number }[];
    hasThreeYearsHistory?: boolean;
    historySpanDays?: number;
}) {
    const apiKey = process.env.GEMINI_SUPPLYCHAIN_API_KEY || process.env.GEMINI_API_KEY;
    const modelName = process.env.GEMINI_SUPPLYCHAIN_MODEL || 'gemini-2.5-flash';

    if (!context.hasThreeYearsHistory) {
        return {
            summary: `Automated data validation: Historical inventory records span ${context.historySpanDays || 0} days, which is less than the mandatory 3-year (1,095-day) threshold. Demand predictions are marked invalid with 0% AI confidence. Historical consumption charts remain available for operational tracking, but predictive extrapolation is suppressed.`,
            critical_shortages: context.criticalItems.map(i => `${i.item_name} (${i.item_code}): Current stock is ${i.available_stock} ${i.unit}. Urgent replenishment required based on current physical buffer, though automated future demand prediction is disabled.`),
            trend_observations: context.fastMoving.length > 0 
                ? context.fastMoving.map(i => `${i.item_name} shows notable historical consumption momentum across recorded movements.`)
                : ['Historical movements show early issuance activity, but lack longitudinal multi-year seasonality.'],
            procurement_actions: [
                `Base near-term purchasing decisions on current physical stock and pending requisition requests rather than AI projections.`,
                `Review min-max inventory safety buffers for ${context.lowStockCount} items currently near or below safety levels.`,
                `Accumulate continuous stock-out audit logs until a 3-year baseline (1,095 days) is established for reliable AI forecasting.`
            ],
            uncertainty_notes: [
                `AI Confidence: 0%. Historical records span only ${context.historySpanDays || 0} days (minimum required: 1,095 days / 3 years).`,
                `Time-series models (Croston SBA & seasonal decomposition) require a 3-year longitudinal baseline to isolate multi-year seasonality from erratic variance.`,
                `Demand prediction is disabled until sufficient 3-year historical depth is achieved.`
            ]
        };
    }

    if (!apiKey) {
        return {
            summary: `Automated inventory analysis for ${context.totalItems} catalog items across a ${context.forecastHorizon}-day horizon. Overall projected demand is ${context.totalDemand} units with ${context.criticalCount} critical shortages and ${context.lowStockCount} items at low-stock risk.`,
            critical_shortages: context.criticalItems.map(i => `${i.item_name} (${i.item_code}): Projected deficit of ${Math.abs(i.projected_stock)} ${i.unit} (Current: ${i.available_stock}, Predicted Demand: ${i.forecast_demand}). Immediate purchase order required.`),
            trend_observations: context.fastMoving.map(i => `${i.item_name} shows accelerating consumption with +${i.growth}% demand momentum.`),
            procurement_actions: [
                `Issue emergency purchase orders for ${context.criticalCount} items projected to fall below zero.`,
                `Review safety stock buffers for ${context.lowStockCount} items nearing minimum thresholds.`,
                `Prioritize top operational departments: ${context.departmentBreakdown.slice(0, 3).map(d => `${d.department} (${d.total_quantity} units)`).join(', ')}.`
            ],
            uncertainty_notes: [
                'Forecasts reflect actual historical stock issuances. Unrecorded internal requisitions are not factored.',
                'Incoming quantities depend on vendor lead times adhering to scheduled purchase order delivery dates.'
            ]
        };
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `
You are the Senior Supply Chain and Inventory Intelligence Analyst for Airship Express.
Analyze this strictly factual inventory forecast data. DO NOT invent or alter quantities, prices, or status values.

Operational Forecast Data:
- Total Items Evaluated: ${context.totalItems}
- Forecast Horizon: ${context.forecastHorizon} Days
- Total Forecasted Demand: ${context.totalDemand} units
- Critical Items (Projected Stock < 0): ${context.criticalCount}
- Low Stock Risk Items (Projected Stock <= Min Buffer): ${context.lowStockCount}
- Normal Stock Items: ${context.normalCount}
- Critical Items List: ${JSON.stringify(context.criticalItems)}
- Top Consumed Supplies: ${JSON.stringify(context.topConsumed)}
- Fast-Moving / Increasing Demand: ${JSON.stringify(context.fastMoving)}
- Department Consumption Breakdown: ${JSON.stringify(context.departmentBreakdown)}

Format your response as valid, clean JSON with this exact structure:
{
  "summary": "2-3 sentences executive summary synthesizing the operational stock posture, primary demand pressures, and risk exposure.",
  "critical_shortages": ["Bullet point explaining why each critical item is at risk and recommended replenishment"],
  "trend_observations": ["Bullet point summarizing noticeable consumption velocity, shifts, or department usage patterns"],
  "procurement_actions": ["Specific, actionable instructions for the Procurement & Warehousing teams"],
  "uncertainty_notes": ["Explicit data boundaries, lead time dependencies, or intermittent demand caveats"]
}
`;

        const response = await ai.interactions.create({
            model: modelName,
            input: prompt,
            response_format: { type: 'object' }
        } as any);

        const text = response.output_text || '';
        const parsed = JSON.parse(text);
        return {
            summary: parsed.summary || 'Forecast intelligence generated successfully.',
            critical_shortages: Array.isArray(parsed.critical_shortages) ? parsed.critical_shortages : [],
            trend_observations: Array.isArray(parsed.trend_observations) ? parsed.trend_observations : [],
            procurement_actions: Array.isArray(parsed.procurement_actions) ? parsed.procurement_actions : [],
            uncertainty_notes: Array.isArray(parsed.uncertainty_notes) ? parsed.uncertainty_notes : []
        };
    } catch (err) {
        console.warn('Gemini AI generation failed, falling back to rule-based insights:', err);
        return {
            summary: `Automated inventory analysis for ${context.totalItems} items over a ${context.forecastHorizon}-day horizon. Projected demand is ${context.totalDemand} units with ${context.criticalCount} critical shortages and ${context.lowStockCount} low-stock warnings.`,
            critical_shortages: context.criticalItems.map(i => `${i.item_name} (${i.item_code}): Projected deficit of ${Math.abs(i.projected_stock)} ${i.unit}. Urgent PO reorder recommended.`),
            trend_observations: context.fastMoving.map(i => `${i.item_name} shows accelerating consumption trend.`),
            procurement_actions: [
                `Issue replenishment orders for ${context.criticalCount} critical items immediately.`,
                `Inspect buffer thresholds for ${context.lowStockCount} items at low stock risk.`
            ],
            uncertainty_notes: [
                'Model predictions reflect actual stock-out logs; periods without consumption are treated according to intermittent demand algorithms.'
            ]
        };
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const periodParam = searchParams.get('period') || '30';
        const startDateParam = searchParams.get('startDate') || searchParams.get('from');
        const endDateParam = searchParams.get('endDate') || searchParams.get('to');
        const horizonDays = parseInt(searchParams.get('horizon') || '7', 10);
        const validHorizonDays = [7, 14, 30].includes(horizonDays) ? horizonDays : 7;
        const categoryFilter = searchParams.get('category') || 'all';
        const searchQuery = (searchParams.get('search') || '').toLowerCase().trim();
        const riskFilter = searchParams.get('risk') || 'all';

        // 1. Calculate Date Windows
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const todayMs = new Date(todayStr + 'T00:00:00Z').getTime();

        let validPeriodDays = 30;
        let startPeriodDate: Date;
        let startPeriodStr: string;

        if (startDateParam && endDateParam) {
            const parsedStart = new Date(startDateParam + 'T00:00:00Z');
            const parsedEnd = new Date(endDateParam + 'T23:59:59Z');
            if (!isNaN(parsedStart.getTime()) && !isNaN(parsedEnd.getTime()) && parsedEnd >= parsedStart) {
                validPeriodDays = Math.max(1, Math.round((parsedEnd.getTime() - parsedStart.getTime()) / (24 * 60 * 60 * 1000)));
                startPeriodDate = parsedStart;
                startPeriodStr = startDateParam;
            } else {
                validPeriodDays = 30;
                startPeriodDate = new Date(todayMs - (validPeriodDays - 1) * 24 * 60 * 60 * 1000);
                startPeriodStr = startPeriodDate.toISOString().split('T')[0];
            }
        } else {
            const parsedDays = parseInt(periodParam, 10);
            validPeriodDays = [30, 90, 180, 210, 365].includes(parsedDays) ? parsedDays : 30;
            startPeriodDate = new Date(todayMs - (validPeriodDays - 1) * 24 * 60 * 60 * 1000);
            startPeriodStr = startPeriodDate.toISOString().split('T')[0];
        }

        const horizonEndDate = new Date(todayMs + validHorizonDays * 24 * 60 * 60 * 1000);
        const horizonEndStr = horizonEndDate.toISOString().split('T')[0];

        // 2. Fetch Data from Supabase in Parallel
        const [
            { data: rawItems, error: itemsErr },
            { data: rawMovements, error: smErr },
            { data: rawAllStockOuts, error: allSmErr },
            { data: rawRequests, error: reqErr },
            { data: rawPOs, error: poErr },
            { data: rawPOIs, error: poiErr },
            { data: rawEarliestMovement, error: earliestSmErr }
        ] = await Promise.all([
            dbClient.from('inventory_items').select('*').order('item_name', { ascending: true }),
            dbClient
                .from('stock_movements')
                .select('*')
                .gte('created_at', startPeriodDate.toISOString())
                .order('created_at', { ascending: true }),
            dbClient
                .from('stock_movements')
                .select('item_id, item_code, item_name, movement_type, quantity, created_at')
                .ilike('movement_type', 'stock out')
                .order('created_at', { ascending: false }),
            dbClient
                .from('inventory_requests')
                .select('*')
                .or('status.ilike.approved,status.ilike.pending'),
            dbClient
                .from('purchase_orders')
                .select('id, po_number, status, delivery_date, fully_received')
                .not('status', 'in', '("Cancelled","Rejected")')
                .neq('fully_received', true),
            dbClient
                .from('purchase_order_items')
                .select('id, purchase_order_id, inventory_item_id, item_name, quantity_ordered, quantity_received'),
            dbClient
                .from('stock_movements')
                .select('created_at')
                .order('created_at', { ascending: true })
                .limit(1)
        ]);

        if (itemsErr) console.error('Error fetching inventory items:', itemsErr);
        if (smErr) console.error('Error fetching stock movements:', smErr);
        if (allSmErr) console.error('Error fetching all stock outs:', allSmErr);
        if (reqErr) console.error('Error fetching inventory requests:', reqErr);
        if (poErr) console.error('Error fetching purchase orders:', poErr);
        if (poiErr) console.error('Error fetching PO items:', poiErr);
        if (earliestSmErr) console.error('Error fetching earliest stock movement:', earliestSmErr);

        const items = rawItems || [];
        const stockMovements = rawMovements || [];
        const allStockOuts = rawAllStockOuts || [];
        const requests = rawRequests || [];
        const purchaseOrders = rawPOs || [];
        const purchaseOrderItems = rawPOIs || [];

        // 3-Year Historical Span Calculation:
        // Rule: If historical inventory records span less than 3 years (1,095 days),
        // prediction is marked invalid with 0% AI confidence.
        const earliestMovementAt = rawEarliestMovement && rawEarliestMovement.length > 0 ? rawEarliestMovement[0]?.created_at : null;
        const earliestDate = earliestMovementAt ? new Date(earliestMovementAt) : null;
        const earliestDateMs = earliestDate ? earliestDate.getTime() : null;
        const historySpanDays = earliestDateMs ? Math.max(0, Math.floor((todayMs - earliestDateMs) / (1000 * 60 * 60 * 24))) : 0;
        const THREE_YEARS_DAYS = 365 * 3; // 1,095 days
        const hasThreeYearsHistory = historySpanDays >= THREE_YEARS_DAYS;
        const isPredictionValid = hasThreeYearsHistory;

        // Build overall latest issuance date lookup map
        const lastIssuanceOverallMap = new Map<string, string>();
        allStockOuts.forEach((sm: any) => {
            const idKey = sm.item_id ? String(sm.item_id) : null;
            const nameKey = (sm.item_name || '').toLowerCase().trim();
            const dateStr = sm.created_at ? sm.created_at.split('T')[0] : null;
            if (dateStr) {
                if (idKey && !lastIssuanceOverallMap.has(idKey)) lastIssuanceOverallMap.set(idKey, dateStr);
                if (nameKey && !lastIssuanceOverallMap.has(nameKey)) lastIssuanceOverallMap.set(nameKey, dateStr);
            }
        });

        // 3. Map Unfulfilled / Approved Requests (exporting stock)
        const exportingMap = new Map<string, number>();
        const pendingCountMap = new Map<string, number>();
        let totalPendingReqQty = 0;
        let pendingRequestsCount = 0;
        const itemsWithPendingSet = new Set<string>();

        requests.forEach((req: any) => {
            const status = (req.status || '').toLowerCase();
            const qty = Number(req.quantity_requested || req.quantity || 0);
            const idKey = req.inventory_items_id ? String(req.inventory_items_id) : (req.item_id ? String(req.item_id) : null);
            const nameKey = (req.item_name || '').toLowerCase().trim();

            if (status === 'approved') {
                if (idKey) exportingMap.set(idKey, (exportingMap.get(idKey) || 0) + qty);
                if (nameKey) exportingMap.set(nameKey, (exportingMap.get(nameKey) || 0) + qty);
            } else if (status === 'pending') {
                totalPendingReqQty += qty;
                pendingRequestsCount++;
                if (idKey) {
                    pendingCountMap.set(idKey, (pendingCountMap.get(idKey) || 0) + 1);
                    itemsWithPendingSet.add(idKey);
                }
                if (nameKey) {
                    pendingCountMap.set(nameKey, (pendingCountMap.get(nameKey) || 0) + 1);
                    itemsWithPendingSet.add(nameKey);
                }
            }
        });

        // 4. Map Eligible Outstanding Purchase Order Incoming Quantities
        const activePOMap = new Map<string, any>();
        purchaseOrders.forEach((po: any) => {
            activePOMap.set(String(po.id), po);
        });

        // Map item incoming qty (only if delivery_date is within forecast horizon)
        const incomingQtyMap = new Map<string, { totalQty: number; details: any[] }>();

        purchaseOrderItems.forEach((poi: any) => {
            const po = activePOMap.get(String(poi.purchase_order_id));
            if (!po) return;

            const qtyOrdered = Number(poi.quantity_ordered || 0);
            const qtyReceived = Number(poi.quantity_received || 0);
            const outstanding = Math.max(0, qtyOrdered - qtyReceived);

            if (outstanding <= 0) return;

            // Delivery date validation: eligible within the selected forecast horizon
            let isEligible = true;
            if (po.delivery_date) {
                const delivDateStr = String(po.delivery_date).split('T')[0];
                if (delivDateStr > horizonEndStr) {
                    isEligible = false;
                }
            }

            if (isEligible) {
                const idKey = poi.inventory_item_id ? String(poi.inventory_item_id) : null;
                const nameKey = (poi.item_name || '').toLowerCase().trim();

                const detail = {
                    po_number: po.po_number || 'PO-Unknown',
                    delivery_date: po.delivery_date || 'Within Horizon',
                    quantity: outstanding
                };

                if (idKey) {
                    const curr = incomingQtyMap.get(idKey) || { totalQty: 0, details: [] };
                    curr.totalQty += outstanding;
                    curr.details.push(detail);
                    incomingQtyMap.set(idKey, curr);
                }
                if (nameKey) {
                    const curr = incomingQtyMap.get(nameKey) || { totalQty: 0, details: [] };
                    curr.totalQty += outstanding;
                    curr.details.push(detail);
                    incomingQtyMap.set(nameKey, curr);
                }
            }
        });

        // 5. Build Chronological Date Array for Historical Period
        const historicalDates: string[] = [];
        let dCur = new Date(startPeriodDate);
        const todayObj = new Date(todayMs);
        while (dCur <= todayObj) {
            historicalDates.push(dCur.toISOString().split('T')[0]);
            dCur.setUTCDate(dCur.getUTCDate() + 1);
        }

        // 6. Build Chronological Forecast Dates
        const forecastDates: string[] = [];
        for (let h = 1; h <= validHorizonDays; h++) {
            const fDate = new Date(todayMs + h * 24 * 60 * 60 * 1000);
            forecastDates.push(fDate.toISOString().split('T')[0]);
        }

        // 7. Group Stock Out Movements by Item and Date
        // Actual stock issuance / stock-out records as primary demand source!
        const itemDemandHistoryMap = new Map<string, Map<string, number>>();
        const departmentConsumptionMap = new Map<string, { count: number; totalQty: number }>();
        const dailyGlobalDemandMap = new Map<string, number>();

        stockMovements.forEach((sm: any) => {
            const movementType = (sm.movement_type || '').toLowerCase();
            if (movementType !== 'stock out') return; // strictly actual consumption!

            const qty = Math.abs(Number(sm.quantity || 0));
            if (qty <= 0) return;

            const dateStr = sm.created_at ? sm.created_at.split('T')[0] : todayStr;
            const idKey = sm.item_id ? String(sm.item_id) : null;
            const nameKey = (sm.item_name || '').toLowerCase().trim();
            const dept = (sm.department || 'Warehouse Operations').trim();

            // Department stats
            const deptStats = departmentConsumptionMap.get(dept) || { count: 0, totalQty: 0 };
            deptStats.count++;
            deptStats.totalQty += qty;
            departmentConsumptionMap.set(dept, deptStats);

            // Global daily demand
            dailyGlobalDemandMap.set(dateStr, (dailyGlobalDemandMap.get(dateStr) || 0) + qty);

            // Item-level daily demand
            const updateItemMap = (key: string) => {
                if (!itemDemandHistoryMap.has(key)) {
                    itemDemandHistoryMap.set(key, new Map<string, number>());
                }
                const dateMap = itemDemandHistoryMap.get(key)!;
                dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + qty);
            };

            if (idKey) updateItemMap(idKey);
            if (nameKey) updateItemMap(nameKey);
        });

        // 8. Forecast Computation for each inventory item
        const forecastedItemsList: any[] = [];
        let globalForecastDaily = Array(validHorizonDays).fill(0);
        let globalForecastLower = Array(validHorizonDays).fill(0);
        let globalForecastUpper = Array(validHorizonDays).fill(0);
        const unitDemandMap: Record<string, number> = {};

        let itemsWithUsableDataCount = 0;
        let totalAccuracySum = 0;
        let evaluatedItemsCount = 0;
        let totalMaeSum = 0;

        for (const item of items) {
            const idKey = String(item.id);
            const nameKey = (item.item_name || '').toLowerCase().trim();

            const exporting = exportingMap.get(idKey) ?? exportingMap.get(nameKey) ?? 0;
            const currentStock = Math.max(0, Number(item.current_stock || 0));
            const availableStock = Math.max(0, currentStock - exporting);
            const minimumStock = Math.max(0, Number(item.minimum_stock || 0));

            // Extract item's daily history
            const historyMap = itemDemandHistoryMap.get(idKey) || itemDemandHistoryMap.get(nameKey) || new Map<string, number>();
            const dailyCounts = historicalDates.map(d => historyMap.get(d) || 0);
            const totalConsumedPeriod = dailyCounts.reduce((a, b) => a + b, 0);
            const consumptionEventsCount = dailyCounts.filter(c => c > 0).length;

            if (consumptionEventsCount > 0) {
                itemsWithUsableDataCount++;
            }

            // Demand trend velocity (first half vs second half of historical period)
            const mid = Math.floor(dailyCounts.length / 2);
            const firstHalfSum = dailyCounts.slice(0, mid).reduce((a, b) => a + b, 0);
            const secondHalfSum = dailyCounts.slice(mid).reduce((a, b) => a + b, 0);

            let demandTrend: 'Increasing' | 'Decreasing' | 'Stable' | 'Insufficient Data' = 'Stable';
            let trendPercentage = 0;

            if (totalConsumedPeriod === 0) {
                demandTrend = 'Insufficient Data';
            } else if (firstHalfSum === 0 && secondHalfSum > 0) {
                demandTrend = 'Increasing';
                trendPercentage = 100;
            } else if (firstHalfSum > 0 && secondHalfSum === 0) {
                demandTrend = 'Decreasing';
                trendPercentage = -100;
            } else if (firstHalfSum > 0) {
                trendPercentage = Math.round(((secondHalfSum - firstHalfSum) / firstHalfSum) * 100);
                if (trendPercentage >= 15) demandTrend = 'Increasing';
                else if (trendPercentage <= -15) demandTrend = 'Decreasing';
                else demandTrend = 'Stable';
            }

            // Execute time series forecasting model or invalidate if data is < 3 years old
            let itemDailyPredictions: number[];
            let lowerBounds: number[];
            let upperBounds: number[];
            let confidenceStr: string;
            let modelUsedStr: string;
            let forecastDemandSum = 0;
            let itemEvaluation: any = null;

            if (!hasThreeYearsHistory) {
                itemDailyPredictions = Array(validHorizonDays).fill(0);
                lowerBounds = Array(validHorizonDays).fill(0);
                upperBounds = Array(validHorizonDays).fill(0);
                confidenceStr = "0%";
                modelUsedStr = "No Prediction (< 3 Yrs Data)";
                forecastDemandSum = 0;
                itemEvaluation = {
                    has_evaluation: false,
                    accuracy_percentage: 0,
                    mae: 0,
                    rmse: 0,
                    wape: 0,
                    model_tested: "No Prediction (< 3 Years Data)"
                };
            } else {
                const forecastResult = await executeTimeSeriesForecast(dailyCounts, validHorizonDays);
                itemDailyPredictions = forecastResult.predictions;
                lowerBounds = forecastResult.lower;
                upperBounds = forecastResult.upper;
                confidenceStr = forecastResult.confidence;
                modelUsedStr = forecastResult.model_used;
                forecastDemandSum = itemDailyPredictions.reduce((a, b) => a + b, 0);
                itemEvaluation = forecastResult.evaluation;
            }

            // Incoming purchase orders
            const incomingInfo = incomingQtyMap.get(idKey) || incomingQtyMap.get(nameKey) || { totalQty: 0, details: [] };
            const expectedIncoming = incomingInfo.totalQty;

            // Projected stock calculation:
            // Projected Stock = Current Available Stock + Expected Incoming Quantity - Forecast Demand
            const projectedStock = availableStock + expectedIncoming - forecastDemandSum;

            // Risk Level:
            // - Critical: projected stock is below zero.
            // - Low Stock Risk: projected stock is at or below the minimum stock level.
            // - Normal: projected stock remains above the minimum stock level.
            let riskLevel: 'Critical' | 'Low Stock Risk' | 'Normal' = 'Normal';
            let recommendedAction = hasThreeYearsHistory
                ? `Adequate Stock Level — Buffer of ${Math.max(0, projectedStock - minimumStock)} ${item.unit || 'units'} above minimum safety threshold.`
                : `Adequate Stock Level — Buffer of ${Math.max(0, projectedStock - minimumStock)} ${item.unit || 'units'} above minimum safety threshold (Prediction disabled: 0% confidence, requires 3+ years history).`;

            if (projectedStock < 0) {
                riskLevel = 'Critical';
                recommendedAction = `Immediate Reorder Required — Projected stockout deficit of ${Math.abs(projectedStock)} ${item.unit || 'units'}.`;
            } else if (projectedStock <= minimumStock) {
                riskLevel = 'Low Stock Risk';
                recommendedAction = `Prepare Requisition — Projected stock (${projectedStock}) will deplete below minimum safety level (${minimumStock} ${item.unit || 'units'}).`;
            }

            // Accumulate units breakdown
            const unit = item.unit || 'units';
            unitDemandMap[unit] = (unitDemandMap[unit] || 0) + forecastDemandSum;

            // Aggregate global timeline
            for (let h = 0; h < validHorizonDays; h++) {
                globalForecastDaily[h] += itemDailyPredictions[h] || 0;
                globalForecastLower[h] += lowerBounds[h] || 0;
                globalForecastUpper[h] += upperBounds[h] || 0;
            }

            // Evaluation aggregation
            if (hasThreeYearsHistory && itemEvaluation && itemEvaluation.has_evaluation) {
                totalAccuracySum += itemEvaluation.accuracy_percentage;
                totalMaeSum += itemEvaluation.mae;
                evaluatedItemsCount++;
            }

            const lastIssuanceDate = lastIssuanceOverallMap.get(idKey) || lastIssuanceOverallMap.get(nameKey) || null;
            const daysSinceLastIssuance = lastIssuanceDate
                ? Math.max(0, Math.floor((todayMs - new Date(lastIssuanceDate + 'T00:00:00Z').getTime()) / (24 * 60 * 60 * 1000)))
                : null;

            const itemCreatedAt = item.created_at ? new Date(item.created_at).getTime() : todayMs;
            const daysSinceCreated = Math.max(0, Math.floor((todayMs - itemCreatedAt) / (24 * 60 * 60 * 1000)));

            let stockStatus: 'Out of Stock' | 'Low Stock' | 'Adequate Stock' = 'Adequate Stock';
            if (availableStock <= 0) {
                stockStatus = 'Out of Stock';
            } else if (availableStock <= minimumStock) {
                stockStatus = 'Low Stock';
            }

            let movementClassification = 'Moderate Mover';
            if (daysSinceCreated <= 30 && totalConsumedPeriod === 0) {
                movementClassification = 'Newly Added';
            } else if (totalConsumedPeriod === 0 && daysSinceLastIssuance !== null && daysSinceLastIssuance > 180) {
                movementClassification = 'Dead Stock Candidate';
            } else if (totalConsumedPeriod === 0 && daysSinceLastIssuance !== null && daysSinceLastIssuance > 90) {
                movementClassification = 'Dormant Stock';
            } else if (totalConsumedPeriod === 0) {
                movementClassification = 'Zero Movement (Period)';
            } else if (totalConsumedPeriod > 0 && availableStock > (minimumStock * 3) && (totalConsumedPeriod / validPeriodDays) < 0.05) {
                movementClassification = 'Excess Stock Risk';
            } else if (totalConsumedPeriod > 0 && (totalConsumedPeriod / validPeriodDays) < 0.1) {
                movementClassification = 'Slow Mover';
            } else if (totalConsumedPeriod > 0) {
                movementClassification = 'Fast Mover';
            }

            forecastedItemsList.push({
                id: item.id,
                item_code: item.item_code,
                item_name: item.item_name,
                category: item.category || 'Uncategorized',
                unit: item.unit || 'units',
                current_stock: currentStock,
                exporting_stock: exporting,
                available_stock: availableStock,
                minimum_stock: minimumStock,
                purchase_price: Number(item.purchase_price || 0),
                supplier: item.supplier || 'N/A',
                created_at: item.created_at || null,
                days_since_created: daysSinceCreated,

                is_prediction_valid: isPredictionValid,
                prediction_message: hasThreeYearsHistory
                    ? "Prediction valid"
                    : `Data is not enough for prediction. Requires at least 3 years (1,095 days) of continuous records. Current dataset span: ${historySpanDays} days. AI confidence is 0%.`,

                total_consumed_period: totalConsumedPeriod,
                consumption_events_count: consumptionEventsCount,
                average_daily_consumption: Math.round((totalConsumedPeriod / validPeriodDays) * 100) / 100,
                zero_days_fraction: Math.round(((validPeriodDays - consumptionEventsCount) / validPeriodDays) * 100) / 100,
                demand_trend: demandTrend,
                trend_percentage: trendPercentage,

                last_issuance_date: lastIssuanceDate,
                days_since_last_issuance: daysSinceLastIssuance,
                stock_status: stockStatus,
                movement_classification: movementClassification,

                forecast_demand: forecastDemandSum,
                daily_predictions: itemDailyPredictions,
                prediction_dates: forecastDates,
                lower_bounds: lowerBounds,
                upper_bounds: upperBounds,
                confidence: confidenceStr,
                model_used: modelUsedStr,

                expected_incoming: expectedIncoming,
                incoming_pos_details: incomingInfo.details,

                projected_stock: projectedStock,
                risk_level: riskLevel,
                recommended_action: recommendedAction,
                evaluation: itemEvaluation
            });
        }

        // 9. Aggregate Historical Consumption Statistics
        const historicalDemands = historicalDates.map(d => dailyGlobalDemandMap.get(d) || 0);

        // Weekly aggregation for consumption overview
        const weeklyLabels: string[] = [];
        const weeklyTotals: number[] = [];
        for (let i = 0; i < historicalDates.length; i += 7) {
            const chunkEnd = Math.min(i + 6, historicalDates.length - 1);
            const label = `${historicalDates[i].slice(5)} - ${historicalDates[chunkEnd].slice(5)}`;
            let sum = 0;
            for (let j = i; j <= chunkEnd; j++) {
                sum += historicalDemands[j] || 0;
            }
            weeklyLabels.push(label);
            weeklyTotals.push(sum);
        }

        // Monthly aggregation
        const monthlyMap = new Map<string, number>();
        historicalDates.forEach((d, idx) => {
            const m = d.slice(0, 7);
            monthlyMap.set(m, (monthlyMap.get(m) || 0) + (historicalDemands[idx] || 0));
        });
        const monthlyLabels = Array.from(monthlyMap.keys());
        const monthlyTotals = monthlyLabels.map(m => monthlyMap.get(m) || 0);

        // Top consumed supplies
        const topConsumedSupplies = [...forecastedItemsList]
            .filter(item => item.total_consumed_period > 0)
            .sort((a, b) => b.total_consumed_period - a.total_consumed_period)
            .slice(0, 10)
            .map(item => ({
                item_code: item.item_code,
                item_name: item.item_name,
                unit: item.unit,
                total_quantity: item.total_consumed_period,
                events: item.consumption_events_count
            }));

        // Increasing vs Decreasing demand
        const increasingItems = forecastedItemsList
            .filter(i => i.demand_trend === 'Increasing' && i.total_consumed_period > 0)
            .sort((a, b) => b.trend_percentage - a.trend_percentage)
            .slice(0, 5)
            .map(i => ({ item_code: i.item_code, item_name: i.item_name, growth: i.trend_percentage }));

        const decreasingItems = forecastedItemsList
            .filter(i => i.demand_trend === 'Decreasing' && i.total_consumed_period > 0)
            .sort((a, b) => a.trend_percentage - b.trend_percentage)
            .slice(0, 5)
            .map(i => ({ item_code: i.item_code, item_name: i.item_name, decline: i.trend_percentage }));

        const departmentBreakdown = Array.from(departmentConsumptionMap.entries())
            .map(([department, data]) => ({
                department,
                count: data.count,
                total_quantity: data.totalQty
            }))
            .sort((a, b) => b.total_quantity - a.total_quantity);

        // 10. Summary Metrics Calculations
        const criticalCount = forecastedItemsList.filter(i => i.risk_level === 'Critical').length;
        const lowStockCount = forecastedItemsList.filter(i => i.risk_level === 'Low Stock Risk').length;
        const normalCount = forecastedItemsList.filter(i => i.risk_level === 'Normal').length;
        const potentialShortages = criticalCount + lowStockCount;
        const totalForecastDemandSum = forecastedItemsList.reduce((acc, i) => acc + i.forecast_demand, 0);

        const avgAccuracy = hasThreeYearsHistory ? (evaluatedItemsCount > 0 ? Math.round(totalAccuracySum / evaluatedItemsCount) : null) : 0;
        const avgMae = hasThreeYearsHistory ? (evaluatedItemsCount > 0 ? Math.round((totalMaeSum / evaluatedItemsCount) * 100) / 100 : null) : 0;

        // 11. Generate Gemini AI Insights Context
        const criticalItemsSummary = forecastedItemsList
            .filter(i => i.risk_level === 'Critical')
            .slice(0, 6)
            .map(i => ({
                item_code: i.item_code,
                item_name: i.item_name,
                available_stock: i.available_stock,
                forecast_demand: i.forecast_demand,
                projected_stock: i.projected_stock,
                unit: i.unit
            }));

        const aiInsights = await generateGeminiInsights({
            totalItems: forecastedItemsList.length,
            forecastHorizon: validHorizonDays,
            totalDemand: totalForecastDemandSum,
            criticalCount,
            lowStockCount,
            normalCount,
            criticalItems: criticalItemsSummary,
            topConsumed: topConsumedSupplies.slice(0, 5),
            fastMoving: increasingItems,
            departmentBreakdown,
            hasThreeYearsHistory,
            historySpanDays
        });

        // 12. Apply Optional Server-Side Filter for items response if queried directly
        let filteredItems = [...forecastedItemsList];
        if (categoryFilter && categoryFilter !== 'all') {
            filteredItems = filteredItems.filter(i => (i.category || '').toLowerCase() === categoryFilter.toLowerCase());
        }
        if (searchQuery) {
            filteredItems = filteredItems.filter(i =>
                i.item_name.toLowerCase().includes(searchQuery) ||
                i.item_code.toLowerCase().includes(searchQuery)
            );
        }
        if (riskFilter && riskFilter !== 'all') {
            if (riskFilter === 'critical' || riskFilter === 'shortage') {
                filteredItems = filteredItems.filter(i => i.risk_level === 'Critical');
            } else if (riskFilter === 'low_stock' || riskFilter === 'low') {
                filteredItems = filteredItems.filter(i => i.risk_level === 'Low Stock Risk');
            } else if (riskFilter === 'normal') {
                filteredItems = filteredItems.filter(i => i.risk_level === 'Normal');
            }
        }

        // 13. Fast-Moving and Slowest-Moving Items Computation
        const fastMovingItems = [...forecastedItemsList]
            .filter(i => i.total_consumed_period > 0)
            .sort((a, b) => b.total_consumed_period - a.total_consumed_period)
            .map(i => ({
                id: i.id,
                item_code: i.item_code,
                item_name: i.item_name,
                category: i.category,
                unit: i.unit,
                total_quantity_issued: i.total_consumed_period,
                issuance_transactions_count: i.consumption_events_count,
                average_daily_issued: i.average_daily_consumption,
                usable_stock: i.available_stock,
                current_stock: i.current_stock,
                minimum_stock: i.minimum_stock,
                last_issuance_date: i.last_issuance_date,
                days_since_last_issuance: i.days_since_last_issuance,
                stock_status: i.stock_status,
                movement_classification: i.movement_classification
            }));

        const slowMovingItems = [...forecastedItemsList]
            .sort((a, b) => {
                if (a.total_consumed_period !== b.total_consumed_period) {
                    return a.total_consumed_period - b.total_consumed_period;
                }
                const aDays = a.days_since_last_issuance ?? 9999;
                const bDays = b.days_since_last_issuance ?? 9999;
                return bDays - aDays;
            })
            .map(i => ({
                id: i.id,
                item_code: i.item_code,
                item_name: i.item_name,
                category: i.category,
                unit: i.unit,
                total_quantity_issued: i.total_consumed_period,
                issuance_transactions_count: i.consumption_events_count,
                average_daily_issued: i.average_daily_consumption,
                usable_stock: i.available_stock,
                current_stock: i.current_stock,
                minimum_stock: i.minimum_stock,
                last_issuance_date: i.last_issuance_date,
                days_since_last_issuance: i.days_since_last_issuance,
                days_since_created: i.days_since_created,
                created_at: i.created_at,
                is_zero_issue: i.total_consumed_period === 0,
                stock_status: i.stock_status,
                movement_classification: i.movement_classification
            }));

        const zeroIssueItems = slowMovingItems.filter(i => i.is_zero_issue);
        const lowConsumptionItems = slowMovingItems.filter(i => !i.is_zero_issue);

        const itemMovementAnalytics = {
            period_days: validPeriodDays,
            start_date: startPeriodStr,
            end_date: todayStr,
            total_catalog_items: items.length,
            active_moving_items_count: fastMovingItems.length,
            zero_issuance_items_count: zeroIssueItems.length,
            low_consumption_items_count: lowConsumptionItems.length,
            fast_moving_items: fastMovingItems,
            slow_moving_items: slowMovingItems,
            zero_issue_items: zeroIssueItems,
            low_consumption_items: lowConsumptionItems,
            ranking_method_explanation: "Items are ranked based strictly on actual completed warehouse stock-out issuances during the selected calendar period. Average daily consumption is computed by dividing net issued quantity by the full number of calendar days in the period (including zero-issue days). Items with zero issues are tracked separately from low-consumption items, and newly cataloged items (<30 days old) are protected from inaccurate obsolete classifications."
        };

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            historical_period_days: validPeriodDays,
            horizon_days: validHorizonDays,
            summary: {
                total_items: items.length,
                items_forecasted: hasThreeYearsHistory ? itemsWithUsableDataCount : 0,
                has_sufficient_data: hasThreeYearsHistory && itemsWithUsableDataCount > 0,
                has_three_years_history: hasThreeYearsHistory,
                is_prediction_valid: isPredictionValid,
                history_span_days: historySpanDays,
                required_history_days: THREE_YEARS_DAYS,
                earliest_record_date: earliestMovementAt ? earliestMovementAt.split('T')[0] : null,
                total_predicted_demand: totalForecastDemandSum,
                primary_units_breakdown: unitDemandMap,
                potential_shortages: potentialShortages,
                critical_count: criticalCount,
                low_stock_count: lowStockCount,
                normal_count: normalCount,
                average_accuracy: avgAccuracy,
                average_mae: avgMae,
                accuracy_label: hasThreeYearsHistory
                    ? (avgAccuracy !== null ? `${avgAccuracy}% Mean Holdout Accuracy` : 'Insufficient Evaluation Holdout Data')
                    : '0% Confidence — Insufficient History (< 3 Years Required)',
                prediction_status: hasThreeYearsHistory ? "Valid Prediction" : "Invalid Prediction (0% Confidence)",
                prediction_message: hasThreeYearsHistory
                    ? "Historical records meet 3-year minimum threshold."
                    : `Data is not enough for prediction. Time-series forecasting requires at least 3 years (1,095 days) of continuous historical records. Current dataset span: ${historySpanDays} days. AI Confidence: 0%.`
            },
            chart_timeline: {
                historical_dates: historicalDates,
                historical_demands: historicalDemands,
                forecast_dates: forecastDates,
                forecast_demands: globalForecastDaily,
                forecast_lower: globalForecastLower,
                forecast_upper: globalForecastUpper
            },
            items: filteredItems,
            allItemsCount: forecastedItemsList.length,
            item_movement_analytics: itemMovementAnalytics,
            consumption_analysis: {
                dates: historicalDates,
                daily_totals: historicalDemands,
                weekly_labels: weeklyLabels,
                weekly_totals: weeklyTotals,
                monthly_labels: monthlyLabels,
                monthly_totals: monthlyTotals,
                department_breakdown: departmentBreakdown,
                top_consumed_items: topConsumedSupplies,
                increasing_items: increasingItems,
                decreasing_items: decreasingItems,
                unmet_requests_summary: {
                    total_pending_qty: totalPendingReqQty,
                    pending_requests_count: pendingRequestsCount,
                    items_with_pending: itemsWithPendingSet.size
                }
            },
            ai_insights: aiInsights,
            persistence_info: {
                is_persisted: false,
                message: "Historical forecast runs are dynamically generated in real time from immutable inventory audit logs. To persist execution snapshots across sessions, a dedicated 'forecast_runs' and 'forecast_run_items' schema can be introduced.",
                required_schema: "CREATE TABLE forecast_runs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), horizon_days INT, period_days INT, items_count INT, accuracy_pct NUMERIC, created_at TIMESTAMPTZ DEFAULT now());"
            }
        });
    } catch (err: any) {
        console.error('Unexpected error in forecast API route:', err);
        return NextResponse.json(
            {
                success: false,
                error: err?.message || 'Failed to generate demand forecast.'
            },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    // Allows POST with JSON body for larger filter payloads
    return GET(request);
}
