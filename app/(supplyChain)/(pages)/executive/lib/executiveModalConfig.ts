import { ExecutiveChartModalProps } from "../../../components/modals/ExecutiveChartModal";
import { ExecutiveDataPayload } from "../hooks/useExecutiveData";
import { downloadCSV } from "./exportUtils";

export type ModalConfig = Omit<ExecutiveChartModalProps, 'isOpen' | 'onClose'>;

export function buildExecutiveModalConfig(
    reportType: string,
    data: ExecutiveDataPayload,
    extraData?: any
): ModalConfig | null {
    const parcels = data.parcels || [];
    const inventory = data.inventory || [];
    const purchaseOrders = data.purchaseOrders || [];
    const procurement = data.procurement || [];
    const documents = data.documents || [];
    const suppliers = data.suppliers || [];
    const pageKpis = data.pageKpis || { ontimeRate: "0.0%" };

    if (reportType === 'executive') {
        const totalStock = inventory.reduce((acc, i) => acc + (Number(i.current_stock) || 0), 0);
        const totalSpent = purchaseOrders.reduce((acc, po) => acc + (Number(po.total_amount) || 0), 0);
        const activeSuppliersCount = suppliers.filter(s => (s.status || '').toLowerCase() === 'active').length;

        const totalPrAmount = procurement.reduce((acc, pr) => acc + (Number(pr.amount) || 0), 0);
        const pendingPrCount = procurement.filter(pr => (pr.status || '').toLowerCase() === 'pending').length;

        return {
            title: "Executive Summary Report",
            subtitle: "Holistic overview of warehousing, inventory, suppliers & procurement",
            icon: "fa-file-alt",
            iconColor: "text-pink-600 dark:text-pink-400",
            iconBg: "bg-pink-50 dark:bg-pink-950/40 border-pink-100 dark:border-pink-900/30",
            description: "Aggregated high-level snapshot of warehouse inventory capacity, supplier partner registry, and total procurement commitments.",
            metrics: [
                { label: "Total Stock Units", value: totalStock.toLocaleString(), sublabel: `${inventory.length} SKUs`, color: "text-emerald-600 dark:text-emerald-400" },
                { label: "Approved Suppliers", value: suppliers.length, sublabel: `${activeSuppliersCount} active partners`, color: "text-blue-600 dark:text-blue-400" },
                { label: "PR Requisitions", value: `₱${totalPrAmount.toLocaleString()}`, sublabel: `${procurement.length} requests (${pendingPrCount} pending)`, color: "text-purple-600 dark:text-purple-400" },
                { label: "PO Spend", value: `₱${totalSpent.toLocaleString()}`, sublabel: `${purchaseOrders.length} active orders`, color: "text-indigo-600 dark:text-indigo-400" },
            ],
            listHeader: "Executive Snapshot Summary",
            items: [
                { title: "Warehouse Stock", subtitle: `Active inventory stock across warehouse racks`, value: `${totalStock.toLocaleString()} units`, icon: "fa-boxes-stacked", badge: "In Storage", badgeColor: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300", category: "warehouse" },
                { title: "Inventory SKUs", subtitle: `Unique catalogued items across all classifications`, value: `${inventory.length} SKUs`, icon: "fa-warehouse", badge: "Catalogued", badgeColor: "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300", category: "warehouse" },
                { title: "Approved Suppliers", subtitle: `Active vendor partner relationships in registry`, value: `${suppliers.length} vendors`, icon: "fa-handshake", badge: "Verified", badgeColor: "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300", category: "suppliers" },
                { title: "Purchase Requisitions", subtitle: `Requisition pipeline (${pendingPrCount} awaiting approval, ${procurement.length - pendingPrCount} approved)`, value: `${procurement.length} PRs`, icon: "fa-clipboard-list", badge: `₱${totalPrAmount.toLocaleString()}`, badgeColor: "bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300", category: "procurement" },
                { title: "Purchase Orders", subtitle: `Vendor commitments and active supply contracts`, value: `${purchaseOrders.length} orders`, icon: "fa-file-invoice-dollar", badge: `₱${totalSpent.toLocaleString()}`, badgeColor: "bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300", category: "procurement" },
                { title: "Documents Tracked", subtitle: `Archived digital compliance logs`, value: `${documents.length} docs`, icon: "fa-folder-open", badge: "Compliant", badgeColor: "bg-cyan-100 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300", category: "compliance" },
            ],
            onDownload: () => {
                const headers = ["Domain Sector", "KPI Metric", "Recorded Value", "Operational Status", "Audited Timestamp"];
                const rows = [
                    ["Warehouse", "Total Stock Units", totalStock, "In Storage", new Date().toISOString()],
                    ["Warehouse", "Total SKUs", inventory.length, "Catalogued", new Date().toISOString()],
                    ["Suppliers", "Registered Vendors", suppliers.length, `${activeSuppliersCount} Active`, new Date().toISOString()],
                    ["Procurement", "Purchase Requests", procurement.length, `${pendingPrCount} Pending / ${procurement.length - pendingPrCount} Approved`, new Date().toISOString()],
                    ["Procurement", "Purchase Orders Issued", purchaseOrders.length, "Issued/Pending", new Date().toISOString()],
                    ["Compliance", "Archived Documents", documents.length, "Compliant", new Date().toISOString()]
                ];
                downloadCSV("Executive_Summary_Intelligence_Report", [], ["Supply chain warehousing and procurement summary."], headers, rows);
            },
            downloadLabel: "Download Executive Insights (CSV)",
            viewAllLink: "/executive",
            viewAllLabel: "Open Executive Hub"
        };
    }

    if (reportType === 'parcels' || reportType === 'warehouse') {
        const totalStock = inventory.reduce((acc, i) => acc + (Number(i.current_stock) || 0), 0);
        const lowStockCount = inventory.filter(i => (Number(i.current_stock) || 0) <= (Number(i.minimum_stock) || 0)).length;

        return {
            title: "Warehouse Inbound & Storage Manifest",
            subtitle: "Tracking warehouse storage bins, stock health & item allocations",
            icon: "fa-boxes-stacked",
            iconColor: "text-blue-600 dark:text-blue-400",
            iconBg: "bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/30",
            description: "Detailed analysis of warehouse stock units, category classifications, storage bin allocation, and replenishment thresholds.",
            metrics: [
                { label: "Total Stock Units", value: totalStock.toLocaleString(), sublabel: "Units in Storage", color: "text-blue-600 dark:text-blue-400" },
                { label: "Catalogued SKUs", value: inventory.length, sublabel: "Active Items", color: "text-emerald-600 dark:text-emerald-400" },
                { label: "Low Stock Alerts", value: lowStockCount, sublabel: "Requires Restock", color: "text-rose-600 dark:text-rose-400" },
            ],
            listHeader: "Warehouse Inventory Items & Storage Bins",
            maxDisplayCount: 10,
            items: inventory.map((i, idx) => {
                const cur = Number(i.current_stock) || 0;
                const min = Number(i.minimum_stock) || 0;
                const isLow = cur <= min;
                return {
                    title: i.item_name || `Item #${i.id || idx + 1}`,
                    subtitle: `SKU: ${i.item_code || 'N/A'} | Category: ${i.category || 'General'} | Bin: ${i.storage_location || 'Main Storage'}`,
                    value: `${cur} units`,
                    icon: "fa-boxes-stacked",
                    badge: isLow ? 'Low Stock' : 'In Stock',
                    badgeColor: isLow
                        ? "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300"
                        : "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300",
                    category: i.category || 'warehouse',
                };
            }),
            onDownload: () => {
                const headers = ["Item Name", "SKU Code", "Category", "Current Stock", "Min Stock", "Location"];
                const rows = inventory.map(i => [i.item_name || 'N/A', i.item_code || 'N/A', i.category || 'General', i.current_stock || 0, i.minimum_stock || 0, i.storage_location || 'Main Rack']);
                downloadCSV("Warehouse_Stock_Manifest", [], ["Warehouse inbound storage inventory audit."], headers, rows);
            },
            downloadLabel: "Download Warehouse Manifest (CSV)",
            viewAllLink: "/warehousing",
            viewAllLabel: "Open Warehousing Module"
        };
    }

    if (reportType === 'inventory') {
        return {
            title: "Inventory & Stock Audit Report",
            subtitle: "Stock levels, threshold alerts & SKU distribution",
            icon: "fa-warehouse",
            iconColor: "text-amber-600 dark:text-amber-400",
            iconBg: "bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/30",
            description: "Complete inventory catalog audit listing current stock, minimum safety limits, and replenishment statuses.",
            metrics: [
                { label: "Total SKUs", value: inventory.length, sublabel: "Catalogued", color: "text-amber-600 dark:text-amber-400" },
                { label: "Low Stock Items", value: inventory.filter(i => (Number(i.current_stock) || 0) <= (Number(i.minimum_stock) || 0)).length, sublabel: "Restock required", color: "text-rose-600 dark:text-rose-400" },
            ],
            items: inventory.map((item) => {
                const cur = Number(item.current_stock) || 0;
                const min = Number(item.minimum_stock) || 0;
                const isLow = cur <= min;
                return {
                    title: item.item_name || 'Inventory SKU',
                    subtitle: `SKU Code: ${item.item_code || 'N/A'} | Category: ${item.category || 'General'} | Stock: ${cur} / Min: ${min}`,
                    value: `${cur} units`,
                    icon: "fa-boxes-stacked",
                    badge: isLow ? 'Low Stock' : 'In Stock',
                    badgeColor: isLow ? "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-900/40" : "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-900/40",
                };
            }),
            onDownload: () => {
                const headers = ["Item Name", "Category", "Current Stock", "Min Stock", "Status"];
                const rows = inventory.map(i => [i.item_name, i.category, i.current_stock, i.minimum_stock, i.status]);
                downloadCSV("Inventory_Stock_Audit", [], ["Low stock items flagged for replenishment."], headers, rows);
            },
            downloadLabel: "Download Inventory CSV",
            viewAllLink: "/inventory",
            viewAllLabel: "Open Inventory Module"
        };
    }

    if (reportType === 'procurement') {
        const mtdSpend = Number(data.procurementSummary?.mtdSpend) || 0;
        const totalPrAmount = procurement.reduce((sum, pr) => sum + (Number(pr.amount) || 0), 0);
        const pendingPRs = procurement.filter(pr => (pr.status || '').toLowerCase() === 'pending');
        const approvedPRs = procurement.filter(pr => {
            const st = (pr.status || '').toLowerCase();
            return st === 'approved' || st === 'completed';
        });

        // 1. Map purchase requests (Requisitions)
        const prItems = procurement.map(pr => {
            const amountNum = Number(pr.amount) || 0;
            const statusLower = (pr.status || 'pending').toLowerCase();
            const isApproved = statusLower === 'approved' || statusLower === 'completed';
            const isPending = statusLower === 'pending';
            const isRejected = statusLower === 'rejected' || statusLower === 'cancelled';

            const badgeColor = isApproved
                ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                : isPending
                    ? "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300"
                    : isRejected
                        ? "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300"
                        : "bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300";

            const requester = pr.requested_by ? ` | By: ${pr.requested_by}` : '';
            const supplier = pr.supplier_name ? ` | Vendor: ${pr.supplier_name}` : '';
            const dateStr = pr.date || (pr.created_at ? new Date(pr.created_at).toLocaleDateString() : 'Recent');

            return {
                title: `PR #${pr.request_number || pr.id.slice(0, 12)}`,
                subtitle: `Dept: ${pr.department || 'General'}${requester}${supplier} | Date: ${dateStr}`,
                value: `₱${amountNum.toLocaleString()}`,
                icon: "fa-clipboard-list",
                badge: pr.status || 'Pending',
                badgeColor,
                category: isPending ? 'pending' : isApproved ? 'approved' : 'requisition',
                tags: [pr.status || 'Pending', pr.department || 'General', 'Requisition', isPending ? 'pending' : 'approved'],
            };
        });

        // 2. Map purchase orders (Orders)
        const poItems = purchaseOrders.map(po => ({
            title: `PO #${po.po_number || po.id.slice(0, 12)}`,
            subtitle: `Supplier: ${po.supplier_name || 'Vendor'} | Total: ₱${(Number(po.total_amount) || 0).toLocaleString()} | Created: ${po.created_at ? new Date(po.created_at).toLocaleDateString() : 'Recent'}`,
            value: `₱${(Number(po.total_amount) || 0).toLocaleString()}`,
            icon: "fa-file-invoice-dollar",
            badge: po.status || 'Issued',
            badgeColor: "bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300",
            category: "purchase order",
            tags: [po.status || 'Issued', 'Purchase Order', 'order'],
        }));

        const allItems = [...prItems, ...poItems];

        const customFilters = [
            { label: "All Records", value: "all", count: allItems.length },
            { label: "Pending PRs", value: "pending", count: pendingPRs.length },
            { label: "Approved PRs", value: "approved", count: approvedPRs.length },
            ...(purchaseOrders.length > 0 ? [{ label: "Purchase Orders", value: "purchase order", count: purchaseOrders.length }] : [])
        ];

        return {
            title: "Procurement & Spend Audit",
            subtitle: "Purchase orders & requisition tracking",
            icon: "fa-shopping-cart",
            iconColor: "text-purple-600 dark:text-purple-400",
            iconBg: "bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-900/30",
            description: "Full purchase request log, department budgets, and vendor purchase commitments.",
            metrics: [
                { label: "Pending PRs", value: pendingPRs.length, sublabel: "Awaiting approval", color: "text-amber-600 dark:text-amber-400" },
                { label: "Approved PRs", value: approvedPRs.length, sublabel: "Verified requisitions", color: "text-emerald-600 dark:text-emerald-400" },
                { label: "Total Requisitions", value: `₱${totalPrAmount.toLocaleString()}`, sublabel: `${procurement.length} requests`, color: "text-purple-600 dark:text-purple-400" },
                { label: "Total PO Spend", value: `₱${mtdSpend.toLocaleString()}`, sublabel: `${purchaseOrders.length} active POs`, color: "text-indigo-600 dark:text-indigo-400" },
            ],
            items: allItems,
            filters: customFilters,
            onDownload: () => {
                const headers = ["Record Type", "Reference Number", "Department", "Supplier / Vendor", "Amount (₱)", "Status", "Date"];
                const prRows = procurement.map(p => [
                    "Purchase Request",
                    p.request_number || p.id,
                    p.department || 'N/A',
                    p.supplier_name || 'N/A',
                    p.amount || 0,
                    p.status || 'Pending',
                    p.date || p.created_at || 'Recent'
                ]);
                const poRows = purchaseOrders.map(p => [
                    "Purchase Order",
                    p.po_number || p.id,
                    "General Procurement",
                    p.supplier_name || 'Vendor',
                    p.total_amount || 0,
                    p.status || 'Issued',
                    p.created_at || 'Recent'
                ]);
                const rows = [...prRows, ...poRows];
                downloadCSV("Procurement_Spend_Audit_Report", [], ["Active PRs and PO commitments tracked."], headers, rows);
            },
            downloadLabel: "Download Procurement CSV",
            viewAllLink: "/procurement",
            viewAllLabel: "Open Procurement Module"
        };
    }

    if (reportType === 'documents') {
        const typeCount = Object.keys(data.documentTypeBreakdown || {}).length;
        return {
            title: "Document Archive & Compliance",
            subtitle: "Digital compliance records, receipts & invoices",
            icon: "fa-folder-open",
            iconColor: "text-cyan-600 dark:text-cyan-400",
            iconBg: "bg-cyan-50 dark:bg-cyan-950/40 border-cyan-100 dark:border-cyan-900/30",
            description: "Archived compliance files, PO receipts, and vendor invoices logged in the database.",
            metrics: [
                { label: "Total Documents", value: documents.length, sublabel: "Logged", color: "text-cyan-600 dark:text-cyan-400" },
                { label: "Document Types", value: typeCount, sublabel: "Categories", color: "text-indigo-600 dark:text-indigo-400" },
            ],
            items: documents.map(d => ({
                title: d.title || `Document #${d.id}`,
                subtitle: `Type: ${d.document_type || d.category || 'General'} | Uploaded: ${d.created_at ? new Date(d.created_at).toLocaleDateString() : 'Recent'}`,
                value: (d.file_type || 'PDF').toUpperCase(),
                icon: "fa-file-alt",
                badge: d.category || 'Compliance',
                badgeColor: "bg-cyan-100 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300",
            })),
            viewAllLink: "/documents",
            viewAllLabel: "Open Documents Vault"
        };
    }

    if (reportType === 'suppliers') {
        const catCount = Object.keys(data.supplierCategoryBreakdown || {}).length;
        return {
            title: "Supplier Partner Registry",
            subtitle: "Approved vendor directory and classification",
            icon: "fa-building",
            iconColor: "text-purple-600 dark:text-purple-400",
            iconBg: "bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-900/30",
            description: "Directory of active and verified vendor suppliers supplying inventory and linehaul services.",
            metrics: [
                { label: "Total Suppliers", value: suppliers.length, sublabel: "Registered", color: "text-purple-600 dark:text-purple-400" },
                { label: "Categories", value: catCount, sublabel: "Vendor sectors", color: "text-emerald-600 dark:text-emerald-400" },
            ],
            items: suppliers.map(s => ({
                title: s.name || `Supplier #${s.id}`,
                subtitle: `Category: ${s.category || 'General'} | Location: ${s.location || 'Local Vendor'}`,
                value: (s.status || 'Active').toUpperCase(),
                icon: "fa-truck-field",
                badge: s.status || 'Active',
                badgeColor: s.status === 'Active' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700",
            })),
            viewAllLink: "/suppliers",
            viewAllLabel: "Open Suppliers Directory"
        };
    }

    if (reportType === 'forecast') {
        const p7 = extraData?.parcel_7_day || (data as any)?.forecast7Day || {};
        const histDates: string[] = p7?.historical?.display_dates || p7?.historical_dates || data.dailyTrend.map(t => t.dayLabel);
        const histCounts: number[] = p7?.historical?.display_counts || p7?.historical_counts || data.dailyTrend.map(t => t.receivedCount);
        const histDisplay: string[] = p7?.historical?.display_dates || p7?.historical_display || histDates;
        const fcDates: string[] = p7?.dates || [];
        const fcValues: number[] = p7?.predictions || p7?.values || [];
        const confidence = p7?.confidence || "90%";
        const modelUsed = p7?.model_used || "AutoTheta Time-Series WASM";

        const historicalList = histDates.map((dateStr, idx) => {
            const actualVal = histCounts[idx] ?? 0;
            const label = histDisplay[idx] || dateStr;
            const isToday = idx === histDates.length - 1;
            const predForToday = fcValues.length > 0 ? Math.round(fcValues[0]) : actualVal;
            const compStr = isToday ? ` | Predicted for today: ${predForToday} units (Comparing Actual vs Predicted)` : "";

            return {
                title: `Date: ${dateStr} (${label}${isToday ? ' - Today' : ''})`,
                subtitle: `Actual Warehouse Inbound: ${actualVal} units recorded${compStr}`,
                value: isToday ? `Actual: ${actualVal} (Fcst: ${predForToday})` : `${actualVal} units (Actual)`,
                icon: "fa-calendar-check",
                badge: isToday ? "Today (Actual)" : "Actual Recorded",
                badgeColor: isToday ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300" : "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300",
                category: "actual",
            };
        });

        const predictedList = fcDates.map((dateStr, idx) => {
            const predVal = Math.round(fcValues[idx] ?? 0);
            const dayOffset = idx + 1;
            const isTomorrow = idx === 0;

            return {
                title: `Date: ${dateStr} (${isTomorrow ? 'Tomorrow - Day +1' : `Day +${dayOffset}`})`,
                subtitle: `WASM Model Prediction: ${predVal} units | Actual Data: Pending arrival of ${dateStr} (Will display actual recorded when date comes)`,
                value: `${predVal} units (Predicted)`,
                icon: "fa-chart-line",
                badge: isTomorrow ? `Tomorrow Fcst: ${predVal}` : `Projected: ${predVal}`,
                badgeColor: "bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300",
                category: "predicted",
            };
        });

        const totalHistorical = histCounts.reduce((a, b) => a + b, 0);
        const totalProjected = fcValues.reduce((a, b) => a + Math.round(b), 0);

        return {
            title: "7-Day WASM Predictive vs Actual Warehouse Inbound Forecast",
            subtitle: "Comparison of actual recorded warehouse intake vs predicted WASM projections",
            icon: "fa-chart-line",
            iconColor: "text-pink-600 dark:text-pink-400",
            iconBg: "bg-pink-50 dark:bg-pink-950/40 border-pink-100 dark:border-pink-900/30",
            description: "Executes Holt-Winters & AutoTheta forecasting algorithms over historical warehouse intake records using the @sipemu/anofox-forecast Rust/WASM engine. Shows actual recorded inbound alongside projected future volumes. When future dates arrive, actual recorded data automatically populates to compare against predictions.",
            metrics: [
                { label: "Historical Actual", value: `${totalHistorical} units`, sublabel: `Past ${histDates.length} days recorded`, color: "text-blue-600 dark:text-blue-400" },
                { label: "Projected Next 7 Days", value: `${totalProjected} units`, sublabel: `WASM prediction total`, color: "text-pink-600 dark:text-pink-400" },
                { label: "Confidence Level", value: confidence, sublabel: modelUsed, color: "text-emerald-600 dark:text-emerald-400" },
            ],
            listHeader: "Forecast Manifest: Actual Warehouse Intake & WASM Predictions",
            items: [...historicalList, ...predictedList],
            onDownload: () => {
                const headers = ["Date", "Type", "Recorded / Predicted Count", "Status Notes"];
                const rows = [
                    ...histDates.map((d, i) => [d, "Actual", histCounts[i] ?? 0, "Recorded in warehouse intake"]),
                    ...fcDates.map((d, i) => [d, "Predicted (WASM)", Math.round(fcValues[i] ?? 0), "Holt-Winters projection"])
                ];
                downloadCSV("WASM_Warehouse_Inbound_Forecast", [], ["7-Day forecast vs actual database intake."], headers, rows);
            },
            downloadLabel: "Download Forecast & Actuals (CSV)",
            viewAllLink: "/forecast",
            viewAllLabel: "Open Forecasting Engine"
        };
    }

    return null;
}
