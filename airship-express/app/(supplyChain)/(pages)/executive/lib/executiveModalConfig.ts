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
        const fulfillmentRate = pageKpis.ontimeRate || "0.0%";

        return {
            title: "Executive Summary Report",
            subtitle: "Holistic overview of operations, inventory & procurement",
            icon: "fa-file-alt",
            iconColor: "text-pink-600 dark:text-pink-400",
            iconBg: "bg-pink-50 dark:bg-pink-950/40 border-pink-100 dark:border-pink-900/30",
            description: "Aggregated high-level snapshot of supply chain activity, document logs, inventory capacity, and total procurement commitments.",
            metrics: [
                { label: "Total Parcels", value: parcels.length, sublabel: `${fulfillmentRate} delivered`, color: "text-pink-600 dark:text-pink-400" },
                { label: "Total Stock Units", value: totalStock.toLocaleString(), sublabel: `${inventory.length} SKUs`, color: "text-emerald-600 dark:text-emerald-400" },
                { label: "PO Commitment", value: `₱${totalSpent.toLocaleString()}`, sublabel: `${purchaseOrders.length} active orders`, color: "text-purple-600 dark:text-purple-400" },
            ],
            listHeader: "Executive Snapshot Summary",
            items: [
                { title: "Parcels Logged", subtitle: `Active supply chain shipments (${fulfillmentRate} delivered)`, value: `${parcels.length} records`, icon: "fa-box", badge: "Live Operations", badgeColor: "bg-pink-100 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300", category: "operations" },
                { title: "Inventory SKUs", subtitle: `Unique items across all classifications`, value: `${inventory.length} SKUs`, icon: "fa-warehouse", badge: "Catalogued", badgeColor: "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300", category: "warehouse" },
                { title: "Purchase Orders", subtitle: `Vendor commitments and active supply contracts`, value: `${purchaseOrders.length} orders`, icon: "fa-file-invoice-dollar", badge: `₱${totalSpent.toLocaleString()}`, badgeColor: "bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300", category: "procurement" },
                { title: "Documents Tracked", subtitle: `Archived digital compliance logs`, value: `${documents.length} docs`, icon: "fa-folder-open", badge: "Compliant", badgeColor: "bg-cyan-100 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300", category: "compliance" },
            ],
            onDownload: () => {
                const headers = ["Domain Sector", "KPI Metric", "Recorded Value", "Operational Status", "Audited Timestamp"];
                const rows = [
                    ["Logistics", "Total Parcels", parcels.length, "Active", new Date().toISOString()],
                    ["Warehouse", "Total SKUs", inventory.length, "Catalogued", new Date().toISOString()],
                    ["Procurement", "Purchase Orders Issued", purchaseOrders.length, "Issued/Pending", new Date().toISOString()],
                    ["Compliance", "Archived Documents", documents.length, "Compliant", new Date().toISOString()]
                ];
                downloadCSV("Executive_Summary_Intelligence_Report", [], ["Logistics operational summary."], headers, rows);
            },
            downloadLabel: "Download Executive Insights (CSV)",
            viewAllLink: "/executive",
            viewAllLabel: "Open Executive Hub"
        };
    }

    if (reportType === 'parcels') {
        const deliveredCount = parcels.filter(p => p.status === 'delivered').length;
        const rate = pageKpis.ontimeRate || "0.0%";

        return {
            title: "Parcel Performance & Manifest Audit",
            subtitle: "Tracking parcel barcode, courier handoff, destination & verification status",
            icon: "fa-box",
            iconColor: "text-blue-600 dark:text-blue-400",
            iconBg: "bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/30",
            description: "Detailed analysis of incoming cargo volume, fulfillment timeline, clearance bottlenecks, and courier handoffs formatted like the inventory parcels manifest.",
            metrics: [
                { label: "Total Parcels", value: parcels.length, sublabel: "Database Records", color: "text-blue-600 dark:text-blue-400" },
                { label: "Delivered", value: deliveredCount, sublabel: "Completed SLA", color: "text-emerald-600 dark:text-emerald-400" },
                { label: "Fulfillment Rate", value: rate, sublabel: "Target >80%", color: "text-purple-600 dark:text-purple-400" },
            ],
            listHeader: "Manifest Parcels List (Warehousing/Inventory Format)",
            items: parcels.map((p, idx) => ({
                title: `Tracking #${p.tracking_number || p.barcode || `AX-PARCEL-${p.id || idx + 1}`}`,
                subtitle: `Consignee: ${p.destination || p.sender_name || 'N/A'} | Courier: ${p.courier || 'Airship Express'} | Region: ${p.region || p.city || 'Central Hub'} | Scanned: ${p.created_at ? new Date(p.created_at).toLocaleString('sv-SE').slice(0, 16) : 'Recent'}`,
                value: (p.status || 'RECEIVED').replace(/_/g, ' ').toUpperCase(),
                icon: "fa-barcode",
                badge: p.status || 'Received',
                badgeColor: p.status === 'delivered' ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300" : p.status === 'sorting' ? "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300" : "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300",
                category: p.status || 'received',
            })),
            onDownload: () => {
                const headers = ["Tracking Number", "Barcode", "Courier", "Destination", "Status", "Date Created"];
                const rows = parcels.map(p => [p.tracking_number || 'N/A', p.barcode || 'N/A', p.courier || 'Airship Express', p.destination || 'N/A', p.status || 'Received', p.created_at || 'N/A']);
                downloadCSV("Parcel_Performance_Report", [], ["Courier clearance throughput."], headers, rows);
            },
            downloadLabel: "Download Parcel Manifest (CSV)",
            viewAllLink: "/warehousing?tab=incoming",
            viewAllLabel: "Open Warehousing Module"
        };
    }

    if (reportType === 'couriers') {
        const courierCounts = data.courierBreakdown || {};
        const courierItems = Object.entries(courierCounts).map(([name, count]) => ({
            title: name,
            subtitle: `Courier logistics partner handling active parcel assignments`,
            value: `${count} parcels`,
            icon: "fa-truck",
            badge: "Active Carrier",
            badgeColor: "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300",
            category: "courier",
        }));

        return {
            title: "Courier Partner Distribution",
            subtitle: "Parcels handled by registered courier partners",
            icon: "fa-truck",
            iconColor: "text-indigo-600 dark:text-indigo-400",
            iconBg: "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900/30",
            description: "Volume distribution across third-party linehaul partners and local couriers.",
            metrics: [
                { label: "Active Carriers", value: Object.keys(courierCounts).length, sublabel: "Registered partners", color: "text-indigo-600 dark:text-indigo-400" },
                { label: "Total Handled", value: parcels.length, sublabel: "Shipments assigned", color: "text-pink-600 dark:text-pink-400" },
            ],
            listHeader: "Courier Breakdown Manifest",
            items: courierItems,
            viewAllLink: "/couriers",
            viewAllLabel: "Open Couriers Hub"
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
        return {
            title: "Procurement & Spend Audit",
            subtitle: "Purchase orders & requisition tracking",
            icon: "fa-shopping-cart",
            iconColor: "text-purple-600 dark:text-purple-400",
            iconBg: "bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-900/30",
            description: "Full purchase request log, department budgets, and vendor purchase commitments.",
            metrics: [
                { label: "Pending PRs", value: procurement.filter(pr => pr.status === 'Pending').length, sublabel: "Awaiting approval", color: "text-purple-600 dark:text-purple-400" },
                { label: "Total PO Spend", value: `₱${mtdSpend.toLocaleString()}`, sublabel: "MTD committed", color: "text-emerald-600 dark:text-emerald-400" },
            ],
            items: purchaseOrders.map(po => ({
                title: `PO #${po.po_number || po.id}`,
                subtitle: `Supplier: ${po.supplier_name || 'Vendor'} | Total: ₱${(Number(po.total_amount) || 0).toLocaleString()} | Created: ${po.created_at ? new Date(po.created_at).toLocaleDateString() : 'Recent'}`,
                value: (po.status || 'Pending').toUpperCase(),
                icon: "fa-file-invoice",
                badge: po.status || 'Pending',
                badgeColor: "bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300",
            })),
            onDownload: () => {
                const headers = ["PO Number", "Supplier", "Total Amount", "Status", "Date"];
                const rows = purchaseOrders.map(p => [p.po_number || p.id, p.supplier_name, p.total_amount, p.status, p.created_at]);
                downloadCSV("Procurement_Spend_Report", [], ["Active PO commitments tracked."], headers, rows);
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
            const compStr = isToday ? ` | Predicted for today: ${predForToday} parcels (Comparing Actual vs Predicted)` : "";

            return {
                title: `Date: ${dateStr} (${label}${isToday ? ' - Today' : ''})`,
                subtitle: `Actual Supabase Data: ${actualVal} parcels recorded${compStr}`,
                value: isToday ? `Actual: ${actualVal} (Fcst: ${predForToday})` : `${actualVal} parcels (Actual)`,
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
                subtitle: `WASM Model Prediction: ${predVal} parcels | Actual Data: Pending arrival of ${dateStr} (Will display actual recorded when date comes)`,
                value: `${predVal} parcels (Predicted)`,
                icon: "fa-chart-line",
                badge: isTomorrow ? `Tomorrow Fcst: ${predVal}` : `Projected: ${predVal}`,
                badgeColor: "bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300",
                category: "predicted",
            };
        });

        const totalHistorical = histCounts.reduce((a, b) => a + b, 0);
        const totalProjected = fcValues.reduce((a, b) => a + Math.round(b), 0);

        return {
            title: "7-Day WASM Predictive vs Actual Parcel Forecast",
            subtitle: "Comparison of actual recorded database intake vs predicted WASM projections",
            icon: "fa-chart-line",
            iconColor: "text-pink-600 dark:text-pink-400",
            iconBg: "bg-pink-50 dark:bg-pink-950/40 border-pink-100 dark:border-pink-900/30",
            description: "Executes Holt-Winters & AutoTheta forecasting algorithms over historical database records using the @sipemu/anofox-forecast Rust/WASM engine. Shows actual recorded intake alongside projected future volumes. When future dates arrive, actual recorded data automatically populates to compare against predictions.",
            metrics: [
                { label: "Historical Actual", value: `${totalHistorical} parcels`, sublabel: `Past ${histDates.length} days recorded`, color: "text-blue-600 dark:text-blue-400" },
                { label: "Projected Next 7 Days", value: `${totalProjected} parcels`, sublabel: `WASM prediction total`, color: "text-pink-600 dark:text-pink-400" },
                { label: "Confidence Level", value: confidence, sublabel: modelUsed, color: "text-emerald-600 dark:text-emerald-400" },
            ],
            listHeader: "Forecast Manifest: Actual Database Intake & WASM Predictions",
            items: [...historicalList, ...predictedList],
            onDownload: () => {
                const headers = ["Date", "Type", "Recorded / Predicted Count", "Status Notes"];
                const rows = [
                    ...histDates.map((d, i) => [d, "Actual", histCounts[i] ?? 0, "Recorded in parcels table"]),
                    ...fcDates.map((d, i) => [d, "Predicted (WASM)", Math.round(fcValues[i] ?? 0), "Holt-Winters projection"])
                ];
                downloadCSV("WASM_Parcel_Forecast_Actual_vs_Predicted", [], ["7-Day forecast vs actual database intake."], headers, rows);
            },
            downloadLabel: "Download Forecast & Actuals (CSV)",
            viewAllLink: "/forecast",
            viewAllLabel: "Open Forecasting Engine"
        };
    }

    return null;
}
