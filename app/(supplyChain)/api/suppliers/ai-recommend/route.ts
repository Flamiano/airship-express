import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export interface QuotationInput {
    id: number;
    supplier_name: string;
    unit_price: number;
    total_amount: number;
    availability: string;
    lead_time_days: string;
    services_offered?: string[];
    notes?: string;
    distance_km?: number;
    contact_phone?: string;
    contact_email?: string;
}

export interface AIRecommendationResult {
    winnerId: number;
    winnerName: string;
    winnerTotalAmount: number;
    winnerScore: number;
    summary: string;
    rankings: {
        id: number;
        supplier_name: string;
        rank: number;
        overallScore: number;
        priceScore: number;
        speedScore: number;
        servicesScore: number;
        logisticsScore: number;
        priceDeltaVsLowest: number;
        priceDeltaPercentage: number;
        strengths: string[];
        considerations: string[];
        recommendationVerdict: string;
    }[];
    metrics: {
        totalQuotes: number;
        lowestPrice: number;
        highestPrice: number;
        averagePrice: number;
        fastestLeadTimeDays: string;
        inStockCount: number;
        potentialSavings: number;
    };
    aiExecutiveBrief: string;
}

// Deterministic multi-criteria scoring algorithm (AHP / Weighted Utility)
function computeDeterministicEvaluation(
    reqInfo: {
        requestNumber: string;
        itemName: string;
        quantity: number;
        unit: string;
        department?: string;
    },
    quotes: QuotationInput[]
): AIRecommendationResult {
    if (!quotes || quotes.length === 0) {
        throw new Error("No quotations provided for evaluation.");
    }

    const prices = quotes.map((q) => Number(q.total_amount || 0));
    const lowestPrice = Math.min(...prices);
    const highestPrice = Math.max(...prices);
    const averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const potentialSavings = highestPrice - lowestPrice;

    // Parse lead time in days to number approximation
    const parseDays = (leadStr: string): number => {
        if (!leadStr) return 5;
        const matches = leadStr.match(/\d+/g);
        if (!matches) {
            if (leadStr.toLowerCase().includes("same") || leadStr.toLowerCase().includes("immediate")) return 1;
            return 5;
        }
        const nums = matches.map(Number);
        return nums.reduce((a, b) => a + b, 0) / nums.length;
    };

    const leadTimes = quotes.map((q) => parseDays(q.lead_time_days));
    const minLeadTime = Math.min(...leadTimes);

    let inStockCount = 0;

    const scoredRankings = quotes.map((quote) => {
        const totalAmt = Number(quote.total_amount || 0);
        const leadDays = parseDays(quote.lead_time_days);
        const avail = (quote.availability || "").toLowerCase();
        const services = Array.isArray(quote.services_offered) ? quote.services_offered : [];
        const distance = quote.distance_km || 5;

        // 1. Price Score (40 points max)
        // Ratio of lowest price vs quote price
        const priceRatio = totalAmt > 0 ? lowestPrice / totalAmt : 1;
        const priceScore = Math.min(40, Math.round(priceRatio * 40));

        // 2. Speed & Lead Time Score (25 points max)
        let speedScore = 15;
        if (leadDays <= 1) speedScore = 25;
        else if (leadDays <= 3) speedScore = 22;
        else if (leadDays <= 5) speedScore = 18;
        else if (leadDays <= 7) speedScore = 14;
        else speedScore = 10;

        if (avail.includes("immediate") || avail.includes("in stock")) {
            speedScore = Math.min(25, speedScore + 3);
            inStockCount++;
        }

        // 3. Value-Added Services Score (20 points max)
        let servicesScore = 5;
        const serviceBonus = services.length * 4;
        servicesScore = Math.min(20, servicesScore + serviceBonus);

        // 4. Logistics & Proximity Score (15 points max)
        let logisticsScore = 10;
        if (distance <= 3) logisticsScore = 15;
        else if (distance <= 8) logisticsScore = 13;
        else if (distance <= 15) logisticsScore = 11;
        else logisticsScore = 8;

        const overallScore = Math.min(100, priceScore + speedScore + servicesScore + logisticsScore);

        // Price comparison
        const priceDeltaVsLowest = totalAmt - lowestPrice;
        const priceDeltaPercentage = lowestPrice > 0 ? Math.round(((totalAmt - lowestPrice) / lowestPrice) * 100) : 0;

        // Strengths analysis
        const strengths: string[] = [];
        if (totalAmt === lowestPrice) {
            strengths.push("Lowest Quotation Price (Best Market Rate)");
        } else if (priceDeltaPercentage <= 10) {
            strengths.push("Highly Competitive Pricing (within 10% of lowest)");
        }

        if (leadDays <= minLeadTime) {
            strengths.push(`Fastest Delivery Lead Time (${quote.lead_time_days || "1-2"} days)`);
        }

        if (avail.includes("stock") || avail.includes("immediate")) {
            strengths.push("Immediate Stock Availability (Zero Indent Delay)");
        }

        if (services.length > 0) {
            strengths.push(`Bundled ${services.length} Value-Added Services (${services.slice(0, 2).join(", ")})`);
        }

        if (distance <= 5) {
            strengths.push(`Proximity Advantage (${distance.toFixed(1)} km from Airship HQ)`);
        }

        // Considerations / Trade-offs
        const considerations: string[] = [];
        if (totalAmt > lowestPrice) {
            considerations.push(`Premium of +₱${priceDeltaVsLowest.toLocaleString()} (+${priceDeltaPercentage}%) compared to lowest bid`);
        }
        if (leadDays > 5) {
            considerations.push(`Extended delivery turnaround (${quote.lead_time_days} days)`);
        }
        if (!avail.includes("stock") && !avail.includes("immediate")) {
            considerations.push("Subject to supplier stock confirmation");
        }
        if (services.length === 0) {
            considerations.push("No bundled after-sales or free delivery services declared");
        }

        let verdict = "Viable Option";
        if (overallScore >= 90) verdict = "Highly Recommended (Top Pick)";
        else if (overallScore >= 80) verdict = "Strong Contender";
        else if (overallScore >= 70) verdict = "Acceptable Standard Offer";
        else verdict = "Higher Cost / Slower Lead Time";

        return {
            id: quote.id,
            supplier_name: quote.supplier_name,
            rank: 0,
            overallScore,
            priceScore,
            speedScore,
            servicesScore,
            logisticsScore,
            priceDeltaVsLowest,
            priceDeltaPercentage,
            strengths,
            considerations,
            recommendationVerdict: verdict,
        };
    });

    // Sort descending by overall score, tie-breaker lowest price
    scoredRankings.sort((a, b) => {
        if (b.overallScore !== a.overallScore) {
            return b.overallScore - a.overallScore;
        }
        const quoteA = quotes.find((q) => q.id === a.id);
        const quoteB = quotes.find((q) => q.id === b.id);
        return Number(quoteA?.total_amount || 0) - Number(quoteB?.total_amount || 0);
    });

    // Assign rank positions
    scoredRankings.forEach((item, index) => {
        item.rank = index + 1;
    });

    const winner = scoredRankings[0];
    const winnerQuote = quotes.find((q) => q.id === winner.id);
    const winnerTotalAmount = Number(winnerQuote?.total_amount || 0);

    // Generate executive summary narrative
    const fastestQuote = quotes.reduce((prev, curr) => (parseDays(curr.lead_time_days) < parseDays(prev.lead_time_days) ? curr : prev), quotes[0]);
    const isWinnerLowestPrice = winnerTotalAmount === lowestPrice;

    let brief = `AI Evaluation recommends **${winner.supplier_name}** as the optimal procurement choice for **${reqInfo.itemName}** (${reqInfo.quantity} ${reqInfo.unit}). `;
    
    if (isWinnerLowestPrice) {
        brief += `They achieved the highest composite score of **${winner.overallScore}/100** by offering the absolute lowest quotation price of **₱${winnerTotalAmount.toLocaleString()}**, with **${winnerQuote?.lead_time_days || "prompt"}** delivery turnaround and verified stock availability.`;
    } else {
        brief += `They achieved the top composite score of **${winner.overallScore}/100** due to superior turnaround speed (${winnerQuote?.lead_time_days} days) and comprehensive value-added service coverage, providing the strongest total cost-to-value ratio.`;
    }

    if (potentialSavings > 0) {
        brief += ` Selecting this offer yields up to **₱${potentialSavings.toLocaleString()}** in procurement cost efficiency versus alternative market proposals.`;
    }

    return {
        winnerId: winner.id,
        winnerName: winner.supplier_name,
        winnerTotalAmount,
        winnerScore: winner.overallScore,
        summary: brief,
        rankings: scoredRankings,
        metrics: {
            totalQuotes: quotes.length,
            lowestPrice,
            highestPrice,
            averagePrice,
            fastestLeadTimeDays: fastestQuote?.lead_time_days || "1-2 days",
            inStockCount,
            potentialSavings,
        },
        aiExecutiveBrief: brief,
    };
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { requestInfo, quotations } = body;

        if (!quotations || !Array.isArray(quotations) || quotations.length === 0) {
            return NextResponse.json(
                { success: false, error: "Please provide valid quotations to evaluate." },
                { status: 400 }
            );
        }

        const deterministicResult = computeDeterministicEvaluation(
            requestInfo || {
                requestNumber: "REQ-GENERAL",
                itemName: "Requested Goods",
                quantity: 1,
                unit: "units",
            },
            quotations
        );

        // If Gemini API Key is available, enhance the executive narrative dynamically
        const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (geminiApiKey) {
            try {
                const aiClient = new GoogleGenAI({ apiKey: geminiApiKey });
                const prompt = `You are a Chief Procurement Officer at Airship Express Logistics.
Evaluate the following submitted supplier quotations for purchase requisition #${requestInfo?.requestNumber || "PR"} (${requestInfo?.quantity || 1} ${requestInfo?.unit || "units"} of ${requestInfo?.itemName || "Goods"}).

Suppliers and Quotes:
${JSON.stringify(
    quotations.map((q: QuotationInput) => ({
        supplier: q.supplier_name,
        unit_price: `₱${q.unit_price}`,
        total_amount: `₱${q.total_amount}`,
        availability: q.availability,
        lead_time: `${q.lead_time_days} days`,
        services: q.services_offered,
        distance_km: `${q.distance_km || 5} km`,
        notes: q.notes,
    })),
    null,
    2
)}

Provide a concise, professional 2-3 sentence executive recommendation explaining who offers the best value, highlighting price, lead time, and value-added services. Keep tone authoritative, objective, and procurement-focused.`;

                const response = await aiClient.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: prompt,
                });

                if (response.text) {
                    deterministicResult.aiExecutiveBrief = response.text.trim();
                    deterministicResult.summary = response.text.trim();
                }
            } catch (llmError) {
                console.warn("LLM enhancement failed, using deterministic AI brief:", llmError);
            }
        }

        return NextResponse.json({
            success: true,
            data: deterministicResult,
        });
    } catch (err: any) {
        console.error("AI Recommendation API error:", err);
        return NextResponse.json(
            { success: false, error: err?.message || "Failed to generate AI quotation recommendation." },
            { status: 500 }
        );
    }
}
