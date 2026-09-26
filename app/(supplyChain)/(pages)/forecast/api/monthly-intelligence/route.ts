import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/services/client/supabase";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_SUPPLYCHAIN_API_KEY;
const MODEL_NAME = process.env.GEMINI_SUPPLYCHAIN_MODEL || "gemini-2.5-flash";

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Format a 24-hour integer into a 12-hour AM/PM label
 */
function formatHourRange(h: number): string {
    const formatH = (hour: number) => {
        const period = hour >= 12 ? "PM" : "AM";
        const standard = hour % 12 === 0 ? 12 : hour % 12;
        return `${standard}:00 ${period}`;
    };
    return `${formatH(h)} - ${formatH((h + 1) % 24)}`;
}

/**
 * GET Handler: Returns all available historical and current months discovered in DB
 */
export async function GET() {
    try {
        // Query recent parcels and purchase orders to discover active months
        const [{ data: parcelDates }, { data: poDates }] = await Promise.all([
            supabase
                .from("parcels")
                .select("created_at")
                .order("created_at", { ascending: false })
                .limit(2000),
            supabase
                .from("purchase_orders")
                .select("created_at")
                .order("created_at", { ascending: false })
                .limit(500),
        ]);

        const monthMap = new Map<string, { parcels: number; pos: number }>();

        (parcelDates || []).forEach((p: any) => {
            if (p.created_at) {
                const ym = p.created_at.slice(0, 7);
                const current = monthMap.get(ym) || { parcels: 0, pos: 0 };
                current.parcels += 1;
                monthMap.set(ym, current);
            }
        });

        (poDates || []).forEach((po: any) => {
            if (po.created_at) {
                const ym = po.created_at.slice(0, 7);
                const current = monthMap.get(ym) || { parcels: 0, pos: 0 };
                current.pos += 1;
                monthMap.set(ym, current);
            }
        });

        // Always ensure current month and previous 5 months are present even if empty
        const now = new Date();
        for (let i = 0; i < 6; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            if (!monthMap.has(ym)) {
                monthMap.set(ym, { parcels: 0, pos: 0 });
            }
        }

        const sortedMonths = Array.from(monthMap.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([ym, stats]) => {
                const [yStr, mStr] = ym.split("-");
                const mIdx = parseInt(mStr, 10) - 1;
                const label = `${MONTH_NAMES[mIdx] || mStr} ${yStr}`;
                return {
                    value: ym,
                    label,
                    year: parseInt(yStr, 10),
                    monthIndex: mIdx,
                    monthName: MONTH_NAMES[mIdx] || mStr,
                    parcelCount: stats.parcels,
                    poCount: stats.pos,
                };
            });

        return NextResponse.json({
            success: true,
            months: sortedMonths,
        });
    } catch (error: any) {
        console.error("Error fetching available forecast months:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to fetch months" },
            { status: 500 }
        );
    }
}

/**
 * POST Handler: Aggregates system-wide data for a chosen month and runs Gemini AI Forecasting
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { month, userQuery, scope } = body;

        if (!month || typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) {
            return NextResponse.json(
                { success: false, error: "Invalid month format. Expected YYYY-MM (e.g. 2026-07)" },
                { status: 400 }
            );
        }

        const [yearStr, monthNumStr] = month.split("-");
        const year = parseInt(yearStr, 10);
        const monthNum = parseInt(monthNumStr, 10); // 1-12
        const monthIndex = monthNum - 1;
        const monthName = `${MONTH_NAMES[monthIndex] || monthNumStr} ${year}`;

        // Date bounds (UTC)
        const startDate = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0)).toISOString();
        const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999)).toISOString();

        // 1. Fetch data across all system pages from Supabase
        const [
            parcelsRes,
            posRes,
            inventoryRes,
            docsRes,
            archivedParcelsRes,
            archivedPosRes,
            archivedDocsRes,
            userActivityRes,
            blockedDevicesRes,
            sessionsRes,
            usersRes,
            appealsRes
        ] = await Promise.all([
            // Parcels
            supabase
                .from("parcels")
                .select("id, barcode, tracking_number, courier, status, created_at")
                .gte("created_at", startDate)
                .lte("created_at", lastDay)
                .order("created_at", { ascending: true }),

            // Purchase Orders
            supabase
                .from("purchase_orders")
                .select("id, po_number, supplier_name, total_amount, paid, is_paid, status, created_at")
                .gte("created_at", startDate)
                .lte("created_at", lastDay)
                .order("created_at", { ascending: true }),

            // Inventory Items
            supabase
                .from("inventory_items")
                .select("id, item_code, item_name, category, current_stock, minimum_stock, unit, purchase_price, storage_location, supplier, status, updated_at, created_at")
                .eq("is_active", true),

            // Documents
            supabase
                .from("documents")
                .select("id, title, file_name, file_type, category, created_at, file_size")
                .gte("created_at", startDate)
                .lte("created_at", lastDay)
                .order("created_at", { ascending: false }),

            // Archived / Trash Parcels
            supabase
                .from("archived_parcels")
                .select("id, barcode, courier, deleted_at, deletion_reason, deleted_by")
                .gte("deleted_at", startDate)
                .lte("deleted_at", lastDay),

            // Archived Purchase Orders
            supabase
                .from("archived_purchase_orders")
                .select("id, po_number, supplier_name, total_amount, deleted_at, deletion_reason")
                .gte("deleted_at", startDate)
                .lte("deleted_at", lastDay),

            // Archived Documents
            supabase
                .from("archived_documents")
                .select("id, title, category, deleted_at, deletion_reason")
                .gte("deleted_at", startDate)
                .lte("deleted_at", lastDay),

            // User Activity
            supabase
                .from("user_activity")
                .select("id, user_id, action, details, created_at, users(display_name, email)")
                .gte("created_at", startDate)
                .lte("created_at", lastDay)
                .order("created_at", { ascending: false })
                .limit(300),

            // Blocked Devices
            supabase
                .from("blocked_devices")
                .select("id, device_name, user_agent, ip_address, reason, status, blocked_at, created_at")
                .gte("created_at", startDate)
                .lte("created_at", lastDay),

            // Sessions
            supabase
                .from("sessions")
                .select("id, user_id, is_active, created_at, user_agent")
                .gte("created_at", startDate)
                .lte("created_at", lastDay),

            // Users
            supabase
                .from("users")
                .select("id, display_name, email, role, position, department, status, created_at"),

            // Appeals
            supabase
                .from("appeals")
                .select("id, user_name, user_email, user_role, status, appeal_message, created_at")
                .gte("created_at", startDate)
                .lte("created_at", lastDay),
        ]);

        const parcels = parcelsRes.data || [];
        const purchaseOrders = posRes.data || [];
        const inventoryItems = inventoryRes.data || [];
        const documents = docsRes.data || [];
        const archivedParcels = archivedParcelsRes.data || [];
        const archivedPos = archivedPosRes.data || [];
        const archivedDocs = archivedDocsRes.data || [];
        const userActivities = userActivityRes.data || [];
        const blockedDevices = blockedDevicesRes.data || [];
        const sessions = sessionsRes.data || [];
        const users = usersRes.data || [];
        const appeals = appealsRes.data || [];

        // 2. Compute Parcels Intelligence
        const dailyCountsMap = new Map<string, number>();
        const dayOfWeekMap: Record<string, number> = {
            Sunday: 0, Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0,
        };
        const hourMap: Record<number, number> = {};
        for (let h = 0; h < 24; h++) hourMap[h] = 0;

        const courierCounts: Record<string, number> = {};
        const parcelStatusCounts: Record<string, number> = {};

        parcels.forEach((p: any) => {
            const courier = (p.courier || "Unknown").trim();
            courierCounts[courier] = (courierCounts[courier] || 0) + 1;

            const status = (p.status || "Unknown").trim();
            parcelStatusCounts[status] = (parcelStatusCounts[status] || 0) + 1;

            if (p.created_at) {
                const d = new Date(p.created_at);
                const dateKey = d.toISOString().split("T")[0];
                dailyCountsMap.set(dateKey, (dailyCountsMap.get(dateKey) || 0) + 1);

                const dayName = DAY_NAMES[d.getUTCDay()];
                dayOfWeekMap[dayName] = (dayOfWeekMap[dayName] || 0) + 1;

                const hour = d.getUTCHours();
                hourMap[hour] = (hourMap[hour] || 0) + 1;
            }
        });

        // Find peak day
        let peakDay = { date: "N/A", count: 0 };
        dailyCountsMap.forEach((cnt, dt) => {
            if (cnt > peakDay.count) {
                peakDay = { date: dt, count: cnt };
            }
        });

        // Busiest day of week
        let busiestDayOfWeek = { day: "N/A", count: 0 };
        Object.entries(dayOfWeekMap).forEach(([dName, cnt]) => {
            if (cnt > busiestDayOfWeek.count) {
                busiestDayOfWeek = { day: dName, count: cnt };
            }
        });

        // Busiest hour window
        let busiestHourWindow = { timeRange: "N/A", count: 0 };
        Object.entries(hourMap).forEach(([hrStr, cnt]) => {
            const hr = parseInt(hrStr, 10);
            if (cnt > busiestHourWindow.count) {
                busiestHourWindow = {
                    timeRange: formatHourRange(hr),
                    count: cnt,
                };
            }
        });

        // 3. Compute Purchase Orders & Procurement Intelligence
        let totalSpend = 0;
        let paidCount = 0;
        let unpaidCount = 0;
        const poStatusCounts: Record<string, number> = {};
        const supplierSpendMap: Record<string, { total: number; count: number }> = {};
        let largestPO = { po_number: "N/A", supplier_name: "N/A", total_amount: 0 };

        purchaseOrders.forEach((po: any) => {
            const amount = Number(po.total_amount) || 0;
            totalSpend += amount;

            const isPaid = Boolean(po.paid || po.is_paid || (po.status && po.status.toLowerCase() === "paid"));
            if (isPaid) paidCount++;
            else unpaidCount++;

            const status = (po.status || "Pending").trim();
            poStatusCounts[status] = (poStatusCounts[status] || 0) + 1;

            const supplier = (po.supplier_name || "General Supplier").trim();
            if (!supplierSpendMap[supplier]) {
                supplierSpendMap[supplier] = { total: 0, count: 0 };
            }
            supplierSpendMap[supplier].total += amount;
            supplierSpendMap[supplier].count += 1;

            if (amount > largestPO.total_amount) {
                largestPO = {
                    po_number: po.po_number || `PO-${po.id}`,
                    supplier_name: supplier,
                    total_amount: amount,
                };
            }
        });

        const topSuppliers = Object.entries(supplierSpendMap)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        // 4. Compute Equipment & Inventory Stock Velocity
        const fastDepletingEquipment: any[] = [];
        const untouchedStagnantGoods: any[] = [];
        const longTermStorageItems: any[] = [];

        const categoryCounts: Record<string, number> = {};

        inventoryItems.forEach((item: any) => {
            const curStock = Number(item.current_stock) || 0;
            const minStock = Number(item.minimum_stock) || 0;
            const price = Number(item.purchase_price) || 0;
            const category = item.category || "General";
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;

            const isLowOrOut = item.status === "low-stock" || item.status === "out-of-stock" || curStock <= minStock;

            // Fast-depleting equipment / critical stock
            if (isLowOrOut) {
                const depletionRatio = minStock > 0 ? (curStock / minStock) : (curStock === 0 ? 0 : 1);
                fastDepletingEquipment.push({
                    id: item.id,
                    item_code: item.item_code,
                    item_name: item.item_name,
                    category: item.category,
                    current_stock: curStock,
                    minimum_stock: minStock,
                    unit: item.unit || "pcs",
                    status: curStock === 0 ? "Out of Stock" : "Low Stock",
                    storage_location: item.storage_location || "Standard Bay",
                    supplier: item.supplier || "N/A",
                    depletionRatio,
                    riskLevel: curStock === 0 ? "Critical" : (curStock <= minStock * 0.5 ? "High" : "Moderate"),
                });
            } else if (curStock > minStock * 2 && curStock >= 50) {
                // Untouched / excess stagnant stock
                untouchedStagnantGoods.push({
                    id: item.id,
                    item_code: item.item_code,
                    item_name: item.item_name,
                    category: item.category,
                    current_stock: curStock,
                    minimum_stock: minStock,
                    unit: item.unit || "pcs",
                    holdingValue: curStock * price,
                    storage_location: item.storage_location || "Standard Bay",
                    status: "Stagnant / Excess",
                });
            }

            // Long-term stored goods (aging or designated storage rack)
            if (item.storage_location && (item.storage_location.toLowerCase().includes("long") || item.storage_location.toLowerCase().includes("rack") || item.storage_location.toLowerCase().includes("deep"))) {
                longTermStorageItems.push({
                    id: item.id,
                    item_code: item.item_code,
                    item_name: item.item_name,
                    category: item.category,
                    current_stock: curStock,
                    storage_location: item.storage_location,
                });
            }
        });

        // Sort fast depleting by depletion urgency
        fastDepletingEquipment.sort((a, b) => a.depletionRatio - b.depletionRatio);
        untouchedStagnantGoods.sort((a, b) => b.holdingValue - a.holdingValue);

        // 5. Compute Documents Flow
        const docCategoryCounts: Record<string, number> = {};
        documents.forEach((d: any) => {
            const cat = d.category || "General";
            docCategoryCounts[cat] = (docCategoryCounts[cat] || 0) + 1;
        });

        // 6. Compute Trash & Archival Volume
        const totalTrashItems = archivedParcels.length + archivedPos.length + archivedDocs.length;
        const trashBreakdown = {
            parcels: archivedParcels.length,
            purchase_orders: archivedPos.length,
            documents: archivedDocs.length,
            total: totalTrashItems,
        };

        // 7. Compute User Activities & Workload Operations
        const userActivityCounts: Record<string, number> = {};
        const actionTypeCounts: Record<string, number> = {};

        userActivities.forEach((act: any) => {
            const userName = act.users?.display_name || act.users?.email || act.user_id || "System User";
            userActivityCounts[userName] = (userActivityCounts[userName] || 0) + 1;

            const action = act.action || "general_activity";
            actionTypeCounts[action] = (actionTypeCounts[action] || 0) + 1;
        });

        const topActiveUsers = Object.entries(userActivityCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // 8. Predictive Estimations for Next Cycle
        const estimatedDailyParcelAverage = parcels.length > 0 ? (parcels.length / Math.max(1, dailyCountsMap.size)) : 0;
        const projectedNextMonthParcelVolume = Math.round(estimatedDailyParcelAverage * 30 * 1.08); // 8% seasonal expansion
        const projectedNextMonthProcurementSpend = totalSpend > 0 ? Math.round(totalSpend * 1.05) : 0;

        // Structured metrics response
        const structuredMetrics = {
            month,
            monthName,
            parcels: {
                total: parcels.length,
                peakDay,
                busiestDayOfWeek,
                busiestHourWindow,
                courierCounts,
                statusCounts: parcelStatusCounts,
                projectedNextMonthVolume: projectedNextMonthParcelVolume,
            },
            purchaseOrders: {
                totalPOs: purchaseOrders.length,
                totalSpend,
                paidCount,
                unpaidCount,
                poStatusCounts,
                topSuppliers,
                largestPO,
                projectedNextMonthSpend: projectedNextMonthProcurementSpend,
            },
            inventoryVelocity: {
                totalInventoryItems: inventoryItems.length,
                fastDepletingCount: fastDepletingEquipment.length,
                fastDepleting: fastDepletingEquipment.slice(0, 10),
                untouchedCount: untouchedStagnantGoods.length,
                untouched: untouchedStagnantGoods.slice(0, 8),
                longTermCount: longTermStorageItems.length,
                longTerm: longTermStorageItems.slice(0, 8),
                categoryCounts,
            },
            documents: {
                total: documents.length,
                categoryCounts: docCategoryCounts,
            },
            trashArchival: trashBreakdown,
            userActivity: {
                totalLogs: userActivities.length,
                topActiveUsers,
                actionTypes: actionTypeCounts,
            },
        };

        // 9. Call Gemini AI for Predictive Operational Narrative
        let cleanAiSummary = "No AI summary available.";

        if (apiKey) {
            const ai = new GoogleGenAI({ apiKey });

            const hasSpecificQuery = Boolean(userQuery && userQuery.trim().length > 0);

            const prompt = hasSpecificQuery
                ? `
You are the Chief Supply Chain & Predictive Intelligence Officer for Airship Express Courier Services.
The executive user is specifically asking you about ${monthName}:
"${userQuery}"
Scope Filter: ${scope || "All System Modules"}

Here is the full actual operational dataset for ${monthName}:
${JSON.stringify(structuredMetrics, null, 2)}

CRITICAL INSTRUCTIONS:
- You must DIRECTLY, SPECIFICALLY, and THOROUGHLY answer the user's inquiry: "${userQuery}".
- Focus directly on the exact metrics, equipment items, stock quantities, courier counts, dates, supplier spend, documents, or trash records they asked about.
- DO NOT give generic or evasive responses. Cite the exact data points and numbers from the dataset above.
- If asked about equipment stock velocity, name the exact fast-depleting equipment items, their current stock vs minimum stock, and risk level.
- If asked about peak day or volume, give the exact peak date, day of week, and busiest hour range.
- DO NOT use markdown bolding (no ** or * anywhere).
- DO NOT use markdown headers (no #, ##, or ### anywhere).
- DO NOT use bullet symbols (*, -, +). Use clean numbered lists (1., 2.) or short readable paragraphs.
- Organize your response using EXACTLY these capitalized section titles separated by double line breaks:

DIRECT ANSWER & TARGETED FINDINGS
Direct, thorough answer answering "${userQuery}" with specific metrics, item names, and factual analysis.

DETAILED DATA BREAKDOWN & OPERATIONAL EVIDENCE
In-depth data evidence, calculations, stock counts, financial figures, and patterns relevant to this inquiry.

PREDICTIVE IMPACT & STRATEGIC RECOMMENDATIONS
Future operational forecasts, stockout projections, risk mitigations, and immediate action items based on this analysis.
`
                : `
You are the Chief Supply Chain & Predictive Intelligence Officer for Airship Express Courier Services.
Analyze the following operational metrics for ${monthName} collected from all system pages (Parcels & Warehousing, Procurement & Purchase Orders, Inventory & Equipment Stock Velocity, Documents, Trash/Archival, and User Operations).

Operational Data for ${monthName}:
${JSON.stringify(structuredMetrics, null, 2)}

CRITICAL FORMATTING INSTRUCTIONS:
- DO NOT use markdown bolding (no ** or * anywhere).
- DO NOT use markdown headers (no #, ##, or ### anywhere).
- DO NOT use bullet symbols (*, -, +). Use clean numbered lists (1., 2.) or concise readable paragraphs.
- Keep tone authoritative, data-driven, and forward-looking with concrete numbers from the data.
- Organize the output with EXACTLY these capitalized section titles separated by double line breaks:

EXECUTIVE MONTHLY SYNTHESIS & PREDICTIVE OVERVIEW
A 2-3 sentence high-level executive synthesis of the month's overall operational health, parcel velocity, procurement outlay, and forecast trajectory.

PARCEL INTAKE, PEAK VELOCITY & LOGISTICS TRAJECTORY
Detailed evaluation of parcel volume (${parcels.length} total), the peak volume day (${peakDay.date} with ${peakDay.count} parcels), busiest day of week (${busiestDayOfWeek.day}), peak hour window (${busiestHourWindow.timeRange}), courier market share distribution, and 7-day future volume outlook.

PROCUREMENT OUTLAY & SPEND FORECAST
Evaluation of purchase orders (${purchaseOrders.length} orders totaling ₱${totalSpend.toLocaleString()}), paid vs unpaid payment ratios, supplier concentrations, largest expenditures, and next-month estimated cashflow requirements.

EQUIPMENT STOCK VELOCITY, FAST-DEPLETION & STAGNANT ASSETS
In-depth analysis of fast-depleting equipment and low-stock risks (items requiring immediate replenishment), untouched/stagnant goods tying up working capital, and long-term stored inventory. Highlight specific items by name and stock numbers.

SYSTEM OPERATIONS: DOCUMENTS, TRASH ARCHIVAL & USER ACTIVITY
Analysis of document uploads (${documents.length} filed), trash/archival deletions (${totalTrashItems} total deleted across parcels, POs, and docs), and user activity logs (${userActivities.length} actions, top operators and scanner workload distribution).

STRATEGIC ACTIONS & PREDICTIVE MITIGATION ROADMAP
Actionable operational recommendations for sorting lines, preventive equipment reordering, supplier negotiations, and waste reduction.
`;

            const candidateModels = [MODEL_NAME, "gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash-exp"];
            let rawText = "";

            for (const modelCandidate of candidateModels) {
                try {
                    const response = await ai.models.generateContent({
                        model: modelCandidate,
                        contents: prompt,
                    });
                    if (response?.text) {
                        rawText = response.text;
                        break;
                    }
                } catch (geminiErr: any) {
                    console.warn(`Gemini model ${modelCandidate} failed (${geminiErr?.status || geminiErr?.message}), trying fallback...`);
                }
            }

            if (rawText) {
                cleanAiSummary = rawText
                    .replace(/#{1,6}\s*/g, "")
                    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
                    .replace(/\*+/g, "")
                    .replace(/`{1,3}/g, "")
                    .trim();
            } else {
                // Deterministic executive synthesis fallback when Gemini is temporarily unavailable (e.g. 503 high demand)
                cleanAiSummary = generateDeterministicMonthlySynthesis(monthName, structuredMetrics);
            }
        } else {
            cleanAiSummary = generateDeterministicMonthlySynthesis(monthName, structuredMetrics);
        }

        return NextResponse.json({
            success: true,
            month,
            monthName,
            metrics: structuredMetrics,
            aiSummary: cleanAiSummary,
        });
    } catch (error: any) {
        console.error("Monthly intelligence API error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to process monthly intelligence" },
            { status: 500 }
        );
    }
}

/**
 * Deterministic data-driven executive synthesis fallback for when AI upstream is temporarily unavailable
 */
function generateDeterministicMonthlySynthesis(monthName: string, metrics: any): string {
    const p = metrics.parcels || {};
    const po = metrics.procurement || {};
    const eq = metrics.equipment || {};
    const ops = metrics.systemOperations || {};

    const topCourier = p.courierDistribution?.[0] ? `${p.courierDistribution[0].name} (${p.courierDistribution[0].share})` : 'Standard Logistics';
    const topSupplier = po.topSuppliers?.[0] ? `${po.topSuppliers[0].supplier} (₱${po.topSuppliers[0].amount.toLocaleString()})` : 'General Procurement';

    return `EXECUTIVE MONTHLY SYNTHESIS & PREDICTIVE OVERVIEW
During ${monthName}, Airship Express logged ${p.totalIntake || 0} parcels alongside ₱${(po.totalExpenditure || 0).toLocaleString()} in capital procurement commitments across ${po.totalPurchaseOrders || 0} purchase orders. Operational throughput reflects ${p.totalIntake > 0 ? 'active sorting runs and steady hub logistics' : 'quiescent baseline intake'} with warehouse operations focused on asset stabilization and inventory maintenance.

PARCEL INTAKE, PEAK VELOCITY & LOGISTICS TRAJECTORY
1. Total Monthly Intake: ${p.totalIntake || 0} registered parcels handled through the central sorting grid.
2. Velocity Peaks: The highest daily intake occurred on ${p.peakDay?.date || 'N/A'} with ${p.peakDay?.count || 0} units, while the busiest recurring day of the week was ${p.busiestDayOfWeek?.day || 'N/A'}.
3. Operational Window: Primary intake density clustered between ${p.busiestHourWindow?.timeRange || 'standard operating hours'}.
4. Courier Distribution: Primary logistics carrier volume was led by ${topCourier}.

PROCUREMENT OUTLAY & SPEND FORECAST
1. Total Procurement Outlay: ₱${(po.totalExpenditure || 0).toLocaleString()} across ${po.totalPurchaseOrders || 0} verified purchase orders.
2. Settlement Distribution: ₱${(po.paidAmount || 0).toLocaleString()} fulfilled against ₱${(po.unpaidAmount || 0).toLocaleString()} in pending liabilities (${po.paymentFulfillmentRate || '0%'} settlement efficiency).
3. Primary Vendor Commitment: Top vendor concentration was directed to ${topSupplier}.
4. Cashflow Outlook: Estimated next-month inventory replenishment requires maintaining a reserve buffer of approximately ₱${Math.round((po.totalExpenditure || 0) * 0.85).toLocaleString()}.

EQUIPMENT STOCK VELOCITY, FAST-DEPLETION & STAGNANT ASSETS
1. Critical Stock Replenishment: ${eq.fastDepleting?.length || 0} items identified with accelerating drawdown rates.
2. Low Stock Exposure: ${eq.lowStockAlerts?.length || 0} equipment SKUs currently operating beneath safety stock buffers.
3. Capital Tied in Stagnant Assets: ${eq.stagnantItems?.length || 0} untouched SKUs identified in reserve storage, representing potential working capital release through reassignment.

SYSTEM OPERATIONS: DOCUMENTS, TRASH ARCHIVAL & USER ACTIVITY
1. Regulatory & Compliance Filing: ${ops.documentsFiled || 0} compliance and manifest documents securely archived.
2. Archival Hygiene: ${ops.trashDeletions?.total || 0} records purged or soft-deleted (${ops.trashDeletions?.parcels || 0} parcels, ${ops.trashDeletions?.purchaseOrders || 0} POs, ${ops.trashDeletions?.documents || 0} documents).
3. User & Operator Workload: ${ops.userActionsLogged || 0} operational actions recorded across active personnel.

STRATEGIC ACTIONS & PREDICTIVE MITIGATION ROADMAP
1. Sortation Line Optimization: Calibrate personnel shift schedules to accommodate the ${p.busiestDayOfWeek?.day || 'primary'} peak window (${p.busiestHourWindow?.timeRange || 'regular shifts'}).
2. Preventive Inventory Replenishment: Expedite purchase requests for the ${eq.lowStockAlerts?.length || 0} inventory items nearing stockout thresholds.
3. Supplier Credit Terms: Consolidate orders with key partners to maximize volume discounts and streamline outstanding payable settlements.`;
}
