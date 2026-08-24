"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ExecutiveChartModal, { ExecutiveChartModalProps } from "@/app/(supplyChain)/components/modals/ExecutiveChartModal";
import OverviewTab from "./tabs/OverviewTab";
import OperationsTab from "./tabs/OperationsTab";
import KpisTab from "./tabs/KpisTab";
import InsightsTab from "./tabs/InsightsTab";
import ForecastTab from "./tabs/ForecastTab";
import ReportsTab from "./tabs/ReportsTab";
import { downloadCSV } from "../lib/exportUtils";
import { ExecutiveDataPayload } from "../hooks/useExecutiveData";

export type TabType = 'overview' | 'operations' | 'kpis' | 'insights' | 'forecast' | 'reports';

interface ExecutiveChartsProps {
    data: ExecutiveDataPayload;
}

export default function ExecutiveCharts({ data }: ExecutiveChartsProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [activeChartModal, setActiveChartModal] = useState<Omit<ExecutiveChartModalProps, 'isOpen' | 'onClose'> | null>(null);

    // Sync tab state with URL query param
    useEffect(() => {
        const tabParam = searchParams.get('tab') as TabType;
        if (tabParam && ['overview', 'operations', 'kpis', 'insights', 'forecast', 'reports'].includes(tabParam)) {
            setActiveTab(tabParam);
        }
    }, [searchParams]);

    const handleTabChange = useCallback((tab: TabType) => {
        if (tab === activeTab) return;
        setActiveTab(tab);
        router.push(`?tab=${tab}`, { scroll: false });
    }, [activeTab, router]);

    // Handle opening modals with prefilled report content & CSV download action
    const openReportModal = useCallback((reportType: string) => {
        const { parcels, inventory, purchaseOrders, procurement, documents, couriers, suppliers, pageKpis } = data;

        if (reportType === 'executive') {
            const totalStock = inventory.reduce((acc, i) => acc + (Number(i.current_stock) || 0), 0);
            const totalSpent = purchaseOrders.reduce((acc, po) => acc + (Number(po.total_amount) || 0), 0);
            const fulfillmentRate = pageKpis.ontimeRate;

            setActiveChartModal({
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
            });
        } else if (reportType === 'parcels') {
            const deliveredCount = parcels.filter(p => p.status === 'delivered').length;
            const rate = pageKpis.ontimeRate;

            setActiveChartModal({
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
            });
        } else if (reportType === 'couriers') {
            const courierCounts = data.courierBreakdown;
            const courierItems = Object.entries(courierCounts).map(([name, count]) => ({
                title: name,
                subtitle: `Courier logistics partner handling active parcel assignments`,
                value: `${count} parcels`,
                icon: "fa-truck",
                badge: "Active Carrier",
                badgeColor: "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300",
                category: "courier",
            }));

            setActiveChartModal({
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
            });
        } else if (reportType === 'inventory') {
            setActiveChartModal({
                title: "Inventory & Stock Audit Report",
                subtitle: "Stock levels, threshold alerts & SKU distribution",
                icon: "fa-warehouse",
                iconColor: "text-amber-600 dark:text-amber-400",
                iconBg: "bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/30",
                description: "Complete inventory catalog audit listing current stock, minimum safety limits, and replenishment statuses.",
                metrics: [
                    { label: "Total SKUs", value: inventory.length, sublabel: "Catalogued", color: "text-amber-600 dark:text-amber-400" },
                    { label: "Low Stock Items", value: inventory.filter(i => i.current_stock <= i.minimum_stock).length, sublabel: "Restock required", color: "text-rose-600 dark:text-rose-400" },
                ],
                items: inventory.map((item) => ({
                    title: item.item_name || 'Inventory SKU',
                    subtitle: `SKU Code: ${item.item_code || 'N/A'} | Category: ${item.category || 'General'} | Stock: ${item.current_stock || 0} / Min: ${item.minimum_stock || 0}`,
                    value: `${item.current_stock || 0} units`,
                    icon: "fa-boxes-stacked",
                    badge: item.current_stock <= item.minimum_stock ? 'Low Stock' : 'In Stock',
                    badgeColor: item.current_stock <= item.minimum_stock ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700",
                })),
                onDownload: () => {
                    const headers = ["Item Name", "Category", "Current Stock", "Min Stock", "Status"];
                    const rows = inventory.map(i => [i.item_name, i.category, i.current_stock, i.minimum_stock, i.status]);
                    downloadCSV("Inventory_Stock_Audit", [], ["Low stock items flagged for replenishment."], headers, rows);
                },
                downloadLabel: "Download Inventory CSV",
                viewAllLink: "/inventory",
                viewAllLabel: "Open Inventory Module"
            });
        } else if (reportType === 'procurement') {
            setActiveChartModal({
                title: "Procurement & Spend Audit",
                subtitle: "Purchase orders & requisition tracking",
                icon: "fa-shopping-cart",
                iconColor: "text-purple-600 dark:text-purple-400",
                iconBg: "bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-900/30",
                description: "Full purchase request log, department budgets, and vendor purchase commitments.",
                metrics: [
                    { label: "Pending PRs", value: procurement.filter(pr => pr.status === 'Pending').length, sublabel: "Awaiting approval", color: "text-purple-600 dark:text-purple-400" },
                    { label: "Total PO Spend", value: `₱${data.procurementSummary.mtdSpend.toLocaleString()}`, sublabel: "MTD committed", color: "text-emerald-600 dark:text-emerald-400" },
                ],
                items: purchaseOrders.map(po => ({
                    title: `PO #${po.po_number || po.id}`,
                    subtitle: `Supplier: ${po.supplier_name || 'Vendor'} | Total: ₱${(po.total_amount || 0).toLocaleString()} | Created: ${po.created_at ? new Date(po.created_at).toLocaleDateString() : 'Recent'}`,
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
            });
        } else if (reportType === 'documents') {
            setActiveChartModal({
                title: "Document Archive & Compliance",
                subtitle: "Digital compliance records, receipts & invoices",
                icon: "fa-folder-open",
                iconColor: "text-cyan-600 dark:text-cyan-400",
                iconBg: "bg-cyan-50 dark:bg-cyan-950/40 border-cyan-100 dark:border-cyan-900/30",
                description: "Archived compliance files, PO receipts, and vendor invoices logged in the database.",
                metrics: [
                    { label: "Total Documents", value: documents.length, sublabel: "Logged", color: "text-cyan-600 dark:text-cyan-400" },
                    { label: "Document Types", value: Object.keys(data.documentTypeBreakdown).length, sublabel: "Categories", color: "text-indigo-600 dark:text-indigo-400" },
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
            });
        } else if (reportType === 'suppliers') {
            setActiveChartModal({
                title: "Supplier Partner Registry",
                subtitle: "Approved vendor directory and classification",
                icon: "fa-building",
                iconColor: "text-purple-600 dark:text-purple-400",
                iconBg: "bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-900/30",
                description: "Directory of active and verified vendor suppliers supplying inventory and linehaul services.",
                metrics: [
                    { label: "Total Suppliers", value: suppliers.length, sublabel: "Registered", color: "text-purple-600 dark:text-purple-400" },
                    { label: "Categories", value: Object.keys(data.supplierCategoryBreakdown).length, sublabel: "Vendor sectors", color: "text-emerald-600 dark:text-emerald-400" },
                ],
                items: suppliers.map(s => ({
                    title: s.name || `Supplier #${s.id}`,
                    subtitle: `Category: ${s.category || 'General'} | Location: ${s.location || 'Local Vendor'}`,
                    value: s.is_active ? 'ACTIVE' : 'INACTIVE',
                    icon: "fa-building",
                    badge: s.category || 'Vendor',
                    badgeColor: "bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300",
                })),
                viewAllLink: "/suppliers",
                viewAllLabel: "Open Suppliers Directory"
            });
        } else if (reportType === 'forecast') {
            setActiveChartModal({
                title: "7-Day WASM Predictive Parcel Forecast",
                subtitle: "Statistical time-series volume projections",
                icon: "fa-chart-line",
                iconColor: "text-pink-600 dark:text-pink-400",
                iconBg: "bg-pink-50 dark:bg-pink-950/40 border-pink-100 dark:border-pink-900/30",
                description: "Time-series parcel intake projections generated using the @sipemu/anofox-forecast Rust/WASM engine based on historical database records.",
                metrics: [
                    { label: "7-Day Historical", value: data.dailyTrend.reduce((sum, d) => sum + d.receivedCount, 0), sublabel: "Actual parcels", color: "text-pink-600 dark:text-pink-400" },
                    { label: "Fulfillment Rate", value: pageKpis.ontimeRate, sublabel: "Current SLA", color: "text-emerald-600 dark:text-emerald-400" },
                ],
                items: data.dailyTrend.map(d => ({
                    title: `Date: ${d.dayLabel} (${d.dateStr})`,
                    subtitle: `Recorded intake: ${d.receivedCount} parcels | Delivered: ${d.deliveredCount} parcels`,
                    value: `${d.receivedCount} parcels`,
                    icon: "fa-calendar-day",
                    badge: "Recorded",
                    badgeColor: "bg-pink-100 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300",
                })),
                viewAllLink: "/forecast",
                viewAllLabel: "Open Forecasting Engine"
            });
        }
    }, [data]);

    const tabs: { key: TabType; label: string; icon: string }[] = [
        { key: 'overview', label: 'Overview', icon: 'fa-chart-pie' },
        { key: 'operations', label: 'Operations', icon: 'fa-truck' },
        { key: 'kpis', label: 'KPI Deep Dive', icon: 'fa-tachometer-alt' },
        { key: 'insights', label: 'AI Insights', icon: 'fa-lightbulb' },
        { key: 'forecast', label: 'Forecast', icon: 'fa-chart-line' },
        { key: 'reports', label: 'Reports', icon: 'fa-file-csv' },
    ];

    return (
        <div className="space-y-6">
            {/* Tab Navigation Navigation Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200/80 dark:border-slate-800 no-scrollbar">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => handleTabChange(tab.key)}
                            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                isActive
                                    ? 'bg-pink-600 text-white shadow-md shadow-pink-500/20'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                            }`}
                        >
                            <i className={`fas ${tab.icon} text-xs`} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Render Tab Sub-components */}
            {activeTab === 'overview' && (
                <OverviewTab data={data} onOpenModal={openReportModal} />
            )}

            {activeTab === 'operations' && (
                <OperationsTab data={data} onOpenModal={openReportModal} />
            )}

            {activeTab === 'kpis' && (
                <KpisTab data={data} onOpenModal={openReportModal} />
            )}

            {activeTab === 'insights' && (
                <InsightsTab data={data} onOpenModal={openReportModal} />
            )}

            {activeTab === 'forecast' && (
                <ForecastTab data={data} onOpenModal={openReportModal} />
            )}

            {activeTab === 'reports' && (
                <ReportsTab data={data} onOpenModal={openReportModal} />
            )}

            {/* Interactive Chart Modal */}
            {activeChartModal && (
                <ExecutiveChartModal
                    isOpen={!!activeChartModal}
                    onClose={() => setActiveChartModal(null)}
                    {...activeChartModal}
                />
            )}
        </div>
    );
}