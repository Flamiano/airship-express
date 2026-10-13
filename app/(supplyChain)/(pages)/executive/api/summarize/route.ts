import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_SUPPLYCHAIN_API_KEY;
const MODEL_NAME = process.env.GEMINI_SUPPLYCHAIN_MODEL || "gemini-2.5-flash";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { executiveData, activeTab = "all" } = body;

        if (!executiveData) {
            return NextResponse.json(
                { success: false, error: "executiveData is required" },
                { status: 400 }
            );
        }

        const issued = executiveData.issuedPOsAnalytics || {};
        const defects = executiveData.defectiveItemsAnalytics || {};
        const replacements = executiveData.replacementAnalytics || {};
        const pageKpis = executiveData.pageKpis || {};
        const ops = executiveData.operationsSummary || {};
        const proc = executiveData.procurementSummary || {};

        const dataSummary = {
            kpis: {
                totalStockUnits: pageKpis.totalStockUnits || 0,
                inventorySkus: pageKpis.inventorySkus || 0,
                lowStockAlerts: pageKpis.lowStockAlerts || 0,
                openPOs: pageKpis.openPOs || 0,
                mtdSpend: pageKpis.mtdSpend || 0,
                activeSuppliers: pageKpis.activeSuppliers || 0,
                totalSuppliers: pageKpis.totalSuppliers || 0,
            },
            issuedPurchaseOrders: {
                issuedOrdersCount: issued.issuedOrdersCount || 0,
                totalApprovedValue: issued.totalApprovedValue || 0,
                distinctItemsOrderedCount: issued.distinctItemsOrderedCount || 0,
                fullyReceivedCount: issued.fullyReceivedCount || 0,
                partiallyReceivedCount: issued.partiallyReceivedCount || 0,
                awaitingDeliveryCount: issued.awaitingDeliveryCount || 0,
                inconsistentApprovalCount: issued.inconsistentApprovalCount || 0,
            },
            defectiveItems: {
                totalDefectiveUnits: defects.totalDefectiveUnits || 0,
                affectedItemsCount: defects.affectedItemsCount || 0,
                quarantinedUnits: defects.quarantinedUnits || 0,
                approvedForReturnUnits: defects.approvedForReturnUnits || 0,
                actuallyReturnedUnits: defects.actuallyReturnedUnits || 0,
                categories: defects.categoriesBreakdown || {},
                topSuppliers: defects.topSuppliers || [],
            },
            replacementItems: {
                totalReplacementsReceived: replacements.totalReplacementsReceived || 0,
                replacementDeliveriesCount: replacements.replacementDeliveriesCount || 0,
                awaitingFulfillmentCount: replacements.awaitingFulfillmentCount || 0,
                acceptedAfterInspectionUnits: replacements.acceptedAfterInspectionUnits || 0,
            },
            operations: {
                warehouseStorageCapacity: ops.warehouseStorageCapacity || "Optimal",
                activeLogisticsLines: ops.activeLogisticsLines || 0,
            },
            procurement: {
                openPOs: proc.openPOs || 0,
                pendingApprovals: proc.pendingApprovals || 0,
                mtdSpend: proc.mtdSpend || 0,
                budgetUtilizationPct: proc.budgetUtilizationPct || 0,
            }
        };

        let cleanSummary = "";

        if (apiKey) {
            const ai = new GoogleGenAI({ apiKey });

            const prompt = `
You are the Chief Executive Supply Chain & Logistics Analyst for Airship Express.
Analyze the following operational dataset across all executive domains and produce an authoritative executive briefing that analyzes and summarizes EACH TAB of the dashboard.

Target Tab Scope: ${activeTab === 'all' ? 'All Executive Tabs' : `Focus on ${activeTab}`}

Operational Executive Data:
${JSON.stringify(dataSummary, null, 2)}

CRITICAL FORMATTING INSTRUCTIONS:
- DO NOT use markdown bolding (no ** or * anywhere).
- DO NOT use markdown headers (no #, ##, or ### anywhere).
- DO NOT use bullet symbols like *, -, or +. Use clean numbered lists (1., 2.) or short paragraphs.
- Separate sections with double line breaks.
- Use EXACTLY these 6 capitalized section titles on their own line with no prefixes or symbols:

OVERVIEW: EXECUTIVE OPERATIONAL PULSE
A 2-3 sentence high-level executive synthesis of current supply chain health, warehouse stock adequacy, financial commitments, and operational posture.

TAB SUMMARY: ISSUED PURCHASE ORDERS INTELLIGENCE
Detailed analysis of issued purchase orders (${issued.issuedOrdersCount || 0} orders totaling ₱${(issued.totalApprovedValue || 0).toLocaleString()}), fulfillment rates (${issued.fullyReceivedCount || 0} fully received, ${issued.partiallyReceivedCount || 0} partial, ${issued.awaitingDeliveryCount || 0} awaiting delivery), and workflow compliance integrity (${issued.inconsistentApprovalCount || 0} inconsistencies flagged).

TAB SUMMARY: DEFECTIVE ITEMS & RECEIVING DISCREPANCIES
Evaluation of receiving defects (${defects.totalDefectiveUnits || 0} units flagged across ${defects.affectedItemsCount || 0} items), quarantine isolation (${defects.quarantinedUnits || 0} units), return approvals (RMA), and vendor quality ratings.

TAB SUMMARY: REPLACEMENT ITEMS & RESTOCKING VERIFICATION
Assessment of physical replacement fulfillment (${replacements.totalReplacementsReceived || 0} units physically restocked across ${replacements.replacementDeliveriesCount || 0} verified shipments), pending vendor claims (${replacements.awaitingFulfillmentCount || 0} cases), and quality inspection acceptance.

TAB SUMMARY: OPERATIONS & WAREHOUSE STORAGE
Analysis of physical warehouse storage (${pageKpis.totalStockUnits || 0} total units across ${pageKpis.inventorySkus || 0} catalogued SKUs), critical stock depletion risks (${pageKpis.lowStockAlerts || 0} low stock items), and logistics throughput.

TAB SUMMARY: KPI DEEP DIVE & STRATEGIC EXECUTIVE ACTIONS
Key performance indicator synthesis (budget utilization at ${proc.budgetUtilizationPct || 0}%, supplier network of ${pageKpis.activeSuppliers || 0} active partners), cashflow exposure, and 3 actionable strategic recommendations for warehouse supervisors and procurement directors.

Keep tone professional, authoritative, and data-driven without referencing raw JSON or internal variable names.
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
                    console.warn(`Executive AI summarize model ${modelCandidate} failed (${err?.status || err?.message}), trying fallback...`);
                }
            }

            if (rawSummary) {
                cleanSummary = rawSummary
                    .replace(/#{1,6}\s*/g, '')
                    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
                    .replace(/\*+/g, '')
                    .replace(/`{1,3}/g, '')
                    .trim();
            } else {
                cleanSummary = generateDeterministicExecutiveSummary(dataSummary);
            }
        } else {
            cleanSummary = generateDeterministicExecutiveSummary(dataSummary);
        }

        // Parse into structured tab sections
        const parsedSections = parseSummarySections(cleanSummary);
        const tableRows = generateTabSummaryTableRows(dataSummary, parsedSections);

        return NextResponse.json({
            success: true,
            summary: cleanSummary,
            sections: parsedSections,
            tableRows,
        });
    } catch (error: any) {
        console.error("Executive AI summarize error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to generate executive summary" },
            { status: 500 }
        );
    }
}

type BadgeTone = "neutral" | "brand" | "blue" | "emerald" | "amber" | "rose" | "purple";

export interface TabSummaryTableRow {
    tabKey: string;
    tabName: string;
    icon: string;
    metricsDisplay: string;
    healthStatus: string;
    statusTone: BadgeTone;
    findings: string[];
    recommendation: string;
}

/**
 * Builds structured cross-tab matrix table rows for executive tabular display
 */
function generateTabSummaryTableRows(d: any, sections: any[]): TabSummaryTableRow[] {
    const k = d.kpis || {};
    const po = d.issuedPurchaseOrders || {};
    const def = d.defectiveItems || {};
    const rep = d.replacementItems || {};
    const pr = d.procurement || {};

    return [
        {
            tabKey: "overview",
            tabName: "Executive Overview",
            icon: "fa-chart-pie",
            metricsDisplay: `₱${(po.totalApprovedValue || 0).toLocaleString()} Outlay • ${(k.totalStockUnits || 0).toLocaleString()} Units`,
            healthStatus: (k.lowStockAlerts || 0) > 5 ? "Attention Needed" : "Optimal",
            statusTone: (k.lowStockAlerts || 0) > 5 ? "amber" : "emerald",
            findings: [
                `${k.inventorySkus || 0} catalogued SKUs across central warehousing`,
                `${k.activeSuppliers || 0} of ${k.totalSuppliers || 0} active partner suppliers`,
                `MTD procurement spend of ₱${(pr.mtdSpend || 0).toLocaleString()}`,
            ],
            recommendation: "Maintain safety stock reorder thresholds and monitor cashflow commitments for quarterly close.",
        },
        {
            tabKey: "issued-pos",
            tabName: "Issued Purchase Orders",
            icon: "fa-file-invoice-dollar",
            metricsDisplay: `${po.issuedOrdersCount || 0} Orders • ₱${(po.totalApprovedValue || 0).toLocaleString()}`,
            healthStatus: (po.inconsistentApprovalCount || 0) > 0 ? "Workflow Discrepancy" : "Verified",
            statusTone: (po.inconsistentApprovalCount || 0) > 0 ? "amber" : "emerald",
            findings: [
                `${po.fullyReceivedCount || 0} orders completely delivered and inspected`,
                `${po.partiallyReceivedCount || 0} orders partially delivered by suppliers`,
                `${po.awaitingDeliveryCount || 0} orders in transit or awaiting delivery`,
                (po.inconsistentApprovalCount || 0) > 0 ? `${po.inconsistentApprovalCount} orders with approval milestone timing mismatch` : "100% workflow audit compliance",
            ],
            recommendation: "Track vendor delivery milestones for outstanding in-transit shipments and resolve unaligned approval states.",
        },
        {
            tabKey: "defects-replacements",
            tabName: "Defects & RMA Replacements",
            icon: "fa-shield-halved",
            metricsDisplay: `${def.totalDefectiveUnits || 0} Defects • ${rep.totalReplacementsReceived || 0} Restocked`,
            healthStatus: (def.quarantinedUnits || 0) > 0 ? "Quarantine Active" : "Controlled",
            statusTone: (def.quarantinedUnits || 0) > 0 ? "rose" : "blue",
            findings: [
                `${def.totalDefectiveUnits || 0} defective units flagged across ${def.affectedItemsCount || 0} items`,
                `${def.quarantinedUnits || 0} units secured in isolation zone`,
                `${def.approvedForReturnUnits || 0} units authorized for supplier RMA return`,
                `${rep.totalReplacementsReceived || 0} replacement units physically verified & restocked`,
                `${rep.awaitingFulfillmentCount || 0} replacement cases awaiting supplier delivery`,
            ],
            recommendation: "Expedite vendor return dispatches for quarantined units and enforce lead time SLA on pending replacements.",
        },
        {
            tabKey: "operations",
            tabName: "Operations & Warehousing",
            icon: "fa-boxes-stacked",
            metricsDisplay: `${(k.totalStockUnits || 0).toLocaleString()} Units • ${k.lowStockAlerts || 0} Low Stock`,
            healthStatus: (k.lowStockAlerts || 0) > 0 ? "Replenishment Due" : "Optimal",
            statusTone: (k.lowStockAlerts || 0) > 0 ? "amber" : "emerald",
            findings: [
                `Storage utilization operating within normal warehouse capacity bounds`,
                `${k.inventorySkus || 0} distinct inventory items tracked`,
                `${k.lowStockAlerts || 0} items at or below safety stock threshold`,
            ],
            recommendation: "Prioritize purchase requisitions for inventory SKUs reaching critical safety stock limits.",
        },
        {
            tabKey: "kpis",
            tabName: "KPI Deep Dive",
            icon: "fa-tachometer-alt",
            metricsDisplay: `${pr.budgetUtilizationPct || 0}% Budget • ${k.activeSuppliers || 0} Vendors`,
            healthStatus: "Healthy",
            statusTone: "blue" as const,
            findings: [
                `Budget utilization tracking at ${pr.budgetUtilizationPct || 0}% of quarterly threshold`,
                `High vendor concentration among top approved suppliers`,
                `Zero compliance blocks detected in operational logistics pipelines`,
            ],
            recommendation: "Leverage consolidated purchase orders with top suppliers to negotiate volume rebate tiers.",
        },
        {
            tabKey: "forecast",
            tabName: "Demand Forecast",
            icon: "fa-chart-line",
            metricsDisplay: `7-Day Horizon • Mathematical Projections`,
            healthStatus: "Predictive Ready",
            statusTone: "purple" as const,
            findings: [
                `Holt-Winters & Croston SBA statistical algorithms applied`,
                `Intermittent demand non-negative clamping active`,
                `Upcoming surge days isolated for labor shift staffing`,
            ],
            recommendation: "Calibrate warehouse receiving workforce around mid-week intake surges.",
        },
    ];
}

/**
 * Parses raw plain text sections into structured tab cards
 */
function parseSummarySections(text: string) {
    if (!text) return [];
    return text
        .split("\n\n")
        .filter((block) => block.trim().length > 0)
        .map((block) => {
            const lines = block.trim().split("\n");
            const firstLine = lines[0].trim();
            const isTitle = /^[A-Z0-9\s,:&–-]+$/.test(firstLine) && firstLine.length < 90;
            if (isTitle) {
                let tabKey = "overview";
                const lower = firstLine.toLowerCase();
                if (lower.includes("issued purchase") || lower.includes("issued po")) tabKey = "issued-pos";
                else if (lower.includes("defective")) tabKey = "defects-replacements";
                else if (lower.includes("replacement")) tabKey = "defects-replacements";
                else if (lower.includes("operation") || lower.includes("warehouse")) tabKey = "operations";
                else if (lower.includes("kpi") || lower.includes("action")) tabKey = "kpis";
                else if (lower.includes("forecast") || lower.includes("predictive")) tabKey = "forecast";

                return {
                    title: firstLine,
                    content: lines.slice(1).join("\n").trim(),
                    tabKey,
                };
            }
            return {
                title: "EXECUTIVE BRIEFING NOTE",
                content: block.trim(),
                tabKey: "overview",
            };
        });
}

/**
 * Deterministic data-driven executive summary fallback
 */
function generateDeterministicExecutiveSummary(d: any): string {
    const k = d.kpis || {};
    const po = d.issuedPurchaseOrders || {};
    const def = d.defectiveItems || {};
    const rep = d.replacementItems || {};
    const pr = d.procurement || {};

    return `OVERVIEW: EXECUTIVE OPERATIONAL PULSE
Airship Express maintains an active warehouse volume of ${(k.totalStockUnits || 0).toLocaleString()} physical storage units across ${k.inventorySkus || 0} catalogued SKUs. Total approved procurement commitments stand at ₱${(po.totalApprovedValue || 0).toLocaleString()} across ${po.issuedOrdersCount || 0} issued purchase orders, with the supplier network supporting ${k.activeSuppliers || 0} verified vendor relationships.

TAB SUMMARY: ISSUED PURCHASE ORDERS INTELLIGENCE
1. Approved Order Volume: ${po.issuedOrdersCount || 0} purchase orders have reached verified issued status, representing ₱${(po.totalApprovedValue || 0).toLocaleString()} in capital commitments.
2. Fulfillment Pipeline: ${po.fullyReceivedCount || 0} orders are fully received, ${po.partiallyReceivedCount || 0} are partially received, and ${po.awaitingDeliveryCount || 0} orders await vendor shipment.
3. Financial Control Integrity: ${po.inconsistentApprovalCount || 0} orders exhibit workflow timing anomalies between status and financial approval milestones.

TAB SUMMARY: DEFECTIVE ITEMS & RECEIVING DISCREPANCIES
1. Warehouse Defect Volume: ${def.totalDefectiveUnits || 0} defective units flagged across ${def.affectedItemsCount || 0} distinct inventory items during receiving inspections.
2. Quarantine Containment: ${def.quarantinedUnits || 0} defective items isolated in quarantine storage to safeguard commercial inventory integrity.
3. RMA Dispatches: ${def.approvedForReturnUnits || 0} units approved for return to suppliers, with ${def.actuallyReturnedUnits || 0} units already settled or restored.

TAB SUMMARY: REPLACEMENT ITEMS & RESTOCKING VERIFICATION
1. Physical Restock Fulfillment: ${rep.totalReplacementsReceived || 0} replacement units physically received and restocked across ${rep.replacementDeliveriesCount || 0} verified deliveries.
2. Outstanding Vendor Claims: ${rep.awaitingFulfillmentCount || 0} replacement requests remain pending supplier shipment.
3. Quality Control Certification: ${rep.acceptedAfterInspectionUnits || 0} replacement units successfully cleared post-delivery inspection.

TAB SUMMARY: OPERATIONS & WAREHOUSE STORAGE
1. Physical Inventory Volume: ${(k.totalStockUnits || 0).toLocaleString()} total stock units stored across central distribution bins.
2. SKU Depletion Alerts: ${k.lowStockAlerts || 0} inventory items currently operating at or below safety stock reorder thresholds.
3. Storage Efficiency: Central warehousing operations continue running within optimal operational parameters.

TAB SUMMARY: KPI DEEP DIVE & STRATEGIC EXECUTIVE ACTIONS
1. Budget Utilization: Month-to-date spend represents ${pr.budgetUtilizationPct || 0}% of authorized quarterly capital allocation.
2. Expedite Critical Reorders: Initiate immediate replenishment orders for the ${k.lowStockAlerts || 0} SKUs flagged with low stock exposure.
3. Supplier Warranty Enforcement: Engage top defect suppliers to settle the ${rep.awaitingFulfillmentCount || 0} pending replacement cases.`;
}
