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
- Use EXACTLY these 4 capitalized section titles on their own line with no prefixes or symbols:

EXECUTIVE OVERVIEW
A 2-3 sentence high-level executive synthesis of anticipated volume changes and overall operational readiness.

VOLUME TRAJECTORY & PEAK INSIGHTS
Detailed evaluation of the 7-day projected parcel volume, confidence boundaries (surge vs slump bounds), peak day patterns, and busiest time windows.

PROCUREMENT & FINANCIAL OUTLOOK
Interpretation of next month's predicted purchase order outlay, lower and upper confidence ranges, and budget recommendations.

STRATEGIC COURIER & DISPATCH ACTIONS
Actionable operational recommendations for sorting lines, dedicated staging areas, courier partner volume allocation, and shift staffing.

Keep tone professional, authoritative, and data-driven without referencing raw JSON or internal code variables.
`;

        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
        });

        let rawSummary = response.text || "No summary generated.";

        const cleanSummary = rawSummary
            .replace(/#{1,6}\s*/g, '')
            .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
            .replace(/\*+/g, '')
            .replace(/`{1,3}/g, '')
            .trim();

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
