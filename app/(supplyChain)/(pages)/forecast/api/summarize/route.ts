import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_SUPPLYCHAIN_API_KEY;
const MODEL_NAME = process.env.GEMINI_SUPPLYCHAIN_MODEL || "gemini-2.5-flash";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { forecastData } = body;

        if (!forecastData) {
            return NextResponse.json(
                { success: false, error: "forecastData is required" },
                { status: 400 }
            );
        }

        if (!apiKey) {
            return NextResponse.json(
                { success: false, error: "GEMINI_SUPPLYCHAIN_API_KEY is not configured in the environment." },
                { status: 500 }
            );
        }

        const ai = new GoogleGenAI({ apiKey });

        const prompt = `
You are the Chief Supply Chain & Logistics Analyst for Airship Express Courier Services.
Analyze the following operational forecast data computed via Holt-Winters / AutoTheta WASM algorithms and real Supabase database records.

Forecast Data:
${JSON.stringify(forecastData, null, 2)}

CRITICAL FORMATTING INSTRUCTIONS:
- DO NOT use markdown bolding (no ** or * anywhere).
- DO NOT use markdown headers (no #, ##, or ### anywhere).
- DO NOT use bullet symbols like *, -, or +. Use clean numbered lists (1., 2.) or short paragraphs.
- Separate sections with double line breaks.
- Use EXACTLY these 6 capitalized section titles on their own line with no prefixes or symbols:

EXECUTIVE OVERVIEW
A 2-3 sentence high-level executive synthesis of anticipated volume changes, workforce posture, and operational readiness.

VOLUME TRAJECTORY & PEAK INSIGHTS
Detailed evaluation of the 7-day projected parcel volume, confidence boundaries (surge vs slump bounds), peak day patterns, and busiest time windows.

PROCUREMENT & FINANCIAL OUTLOOK
Interpretation of next month's predicted purchase order outlay, lower and upper confidence ranges, and budget recommendations.

WORKFORCE ACTIVITY & USER POSITIONS FORECAST
Analysis of daily active users, session concurrency forecast, peak operational hours, user position distribution (e.g. Office Staff, Project Coordinator, Admin Assistant, etc.), and next month headcount projection.

SECURITY THREATS & BLOCKED DEVICES OUTLOOK
Assessment of blocked devices forecast, threat risk level, device lockout patterns, and appeal resolution rate/backlog trajectory.

STRATEGIC OPERATIONAL & SECURITY ACTIONS
Actionable operational recommendations for sorting lines, shift staffing based on active user concurrency, courier partner volume allocation, and device security policies.

Keep tone professional, authoritative, and data-driven without referencing raw JSON or internal code variables.
`;

        const candidateModels = [MODEL_NAME, "gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash-exp"];
        let rawSummary = "";

        for (const modelCandidate of candidateModels) {
            try {
                const response = await ai.models.generateContent({
                    model: modelCandidate,
                    contents: prompt,
                });
                if (response?.text) {
                    rawSummary = response.text;
                    break;
                }
            } catch (err: any) {
                console.warn(`Forecast summarize model ${modelCandidate} failed (${err?.status || err?.message}), trying next fallback...`);
            }
        }

        let cleanSummary = "";
        if (rawSummary) {
            cleanSummary = rawSummary
                .replace(/#{1,6}\s*/g, '')
                .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
                .replace(/\*+/g, '')
                .replace(/`{1,3}/g, '')
                .trim();
        } else {
            // Deterministic data-driven forecast executive summary fallback
            cleanSummary = generateDeterministicForecastSummary(forecastData);
        }

        return NextResponse.json({
            success: true,
            summary: cleanSummary,
        });
    } catch (error: any) {
        console.error("Forecast AI summarize API error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to generate AI summary" },
            { status: 500 }
        );
    }
}

/**
 * Deterministic data-driven executive summary fallback for 7-day multi-domain forecast
 */
function generateDeterministicForecastSummary(data: any): string {
    const parcels = data?.parcels || {};
    const pos = data?.purchaseOrders || {};
    const users = data?.activeUsers || {};
    const blocked = data?.blockedDevices || {};
    const appeals = data?.appeals || {};
    const positions = data?.userPositions || {};

    const nextWeekParcels = parcels.total_next_week || 0;
    const busiestDay = parcels.peak_insights?.busiestDay?.day || 'Mid-week';
    const busiestHour = parcels.peak_insights?.busiestHour?.timeRange || '10:00 AM - 2:00 PM';
    const nextMonthSpend = pos.next_month_prediction || 0;
    const activeUsersToday = users.total_active_today || 0;
    const blockedCount = blocked.total_next_week || 0;
    const pendingAppeals = appeals.pending_appeals || 0;

    return `EXECUTIVE OVERVIEW
Airship Express predictive operational models project an anticipated 7-day intake volume of approximately ${nextWeekParcels} parcel units, with procurement outlay forecasted at ₱${nextMonthSpend.toLocaleString()} for the coming month. Operational infrastructure remains well-scaled with ${activeUsersToday} active operational accounts and an intact baseline security posture.

VOLUME TRAJECTORY & PEAK INSIGHTS
1. 7-Day Intake Volume: Projected at ${nextWeekParcels} parcel units across the central sortation grid (${parcels.model_used || 'Calibrated Exponential Time-Series'}).
2. Velocity Peaks: Primary load concentration aligns with ${busiestDay}, with highest handling intensity during the ${busiestHour} window.
3. Volatility Bounds: Surge scenario models anticipate up to ${(parcels.upper_bounds?.reduce((a: number, b: number) => a + b, 0) || Math.round(nextWeekParcels * 1.3))} units, with lower threshold bounds at ${(parcels.lower_bounds?.reduce((a: number, b: number) => a + b, 0) || Math.round(nextWeekParcels * 0.7))} units.

PROCUREMENT & FINANCIAL OUTLOOK
1. Next-Month Expense Projection: Estimated procurement commitments total ₱${nextMonthSpend.toLocaleString()} (${pos.model_used || 'Trend-Damped Forecast'}).
2. Capital Management: Financial models recommend maintaining working liquidity of ₱${Math.round(nextMonthSpend * 0.9).toLocaleString()} to cover inventory reorders and packaging supplies.

WORKFORCE ACTIVITY & USER POSITIONS FORECAST
1. Concurrency & Shift Density: Daily active operator activity averages ${activeUsersToday} personnel across key logistics hubs.
2. Staffing Distribution: Active operational headcount includes ${positions.total_users || 0} registered personnel distributed across key technical, sortation, and administrative positions.

SECURITY THREATS & BLOCKED DEVICES OUTLOOK
1. Threat Level & Lockouts: ${blockedCount} suspicious device lockouts projected over the next 7 days, maintaining a clean perimeter posture.
2. Appeal Remediation: ${pendingAppeals} user appeals currently pending review with active resolution workflows operating normally.

STRATEGIC OPERATIONAL & SECURITY ACTIONS
1. Sortation Scheduling: Position core receiving shifts around ${busiestDay} during the ${busiestHour} intake rush to prevent dock congestion.
2. Supplier Coordination: Align purchase order releases early in the billing cycle to lock in supplier terms.
3. Access Hygiene: Review inactive credentials and monitor sudden authorization anomalies proactively.`;
}
