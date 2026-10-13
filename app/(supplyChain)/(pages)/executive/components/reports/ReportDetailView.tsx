'use client';

import React, { useState, useMemo } from 'react';
import {
    ArrowLeft,
    Download,
    Printer,
    RefreshCw,
    Search,
    ShieldCheck,
    AlertCircle,
    Calendar,
    ChevronLeft,
    ChevronRight,
    SlidersHorizontal,
    FileText,
} from 'lucide-react';

interface ReportDetailViewProps {
    reportData: any;
    onBack: () => void;
    onRefresh: () => void;
    isLoading: boolean;
}

export const ReportDetailView: React.FC<ReportDetailViewProps> = ({
    reportData,
    onBack,
    onRefresh,
    isLoading,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(15);
    const [sortField, setSortField] = useState<string>('');
    const [sortAsc, setSortAsc] = useState<boolean>(true);

    const {
        title,
        summary,
        periodLabel,
        kpis = [],
        records = [],
        metadata = {},
    } = reportData || {};

    const category = metadata.category || '';

    // Filter records
    const filteredRecords = useMemo(() => {
        let list = [...records];

        if (statusFilter !== 'ALL') {
            list = list.filter((r) => {
                const st = String(r.status || r.payment_status || r.financial_approval || '').toUpperCase();
                return st.includes(statusFilter.toUpperCase());
            });
        }

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            list = list.filter((r) => {
                return Object.values(r).some((val) =>
                    String(val || '').toLowerCase().includes(term)
                );
            });
        }

        if (sortField) {
            list.sort((a, b) => {
                const valA = a[sortField];
                const valB = b[sortField];
                if (typeof valA === 'number' && typeof valB === 'number') {
                    return sortAsc ? valA - valB : valB - valA;
                }
                const strA = String(valA || '').toLowerCase();
                const strB = String(valB || '').toLowerCase();
                return sortAsc ? strA.localeCompare(strB) : strB.localeCompare(strA);
            });
        }

        return list;
    }, [records, searchTerm, statusFilter, sortField, sortAsc]);

    // Pagination
    const totalPages = Math.ceil(filteredRecords.length / rowsPerPage) || 1;
    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredRecords.slice(start, start + rowsPerPage);
    }, [filteredRecords, currentPage, rowsPerPage]);

    // Handle column sorting toggle
    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortField(field);
            setSortAsc(true);
        }
    };

    // CSV Export
    const handleExportCSV = () => {
        if (!records.length) return;

        const headers = Object.keys(records[0]).filter((k) => k !== 'id');
        const csvRows: string[] = [
            `"${title || 'Executive Confidential Report'}"`,
            `"Reporting Period: ${periodLabel || ''}"`,
            `"Generated: ${metadata.generatedAt || new Date().toISOString()}"`,
            `"Authorized Executive: ${metadata.authorizedExecutive || 'Executive'}"`,
            '',
            headers.map((h) => `"${h.replace(/_/g, ' ').toUpperCase()}"`).join(','),
        ];

        for (const row of records) {
            const values = headers.map((h) => {
                const val = row[h];
                if (val === null || val === undefined) return '""';
                if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
                return `"${String(val).replace(/"/g, '""')}"`;
            });
            csvRows.push(values.join(','));
        }

        const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvRows.join('\n'));
        const link = document.createElement('a');
        link.setAttribute('href', csvContent);
        link.setAttribute(
            'download',
            `${category}_report_${metadata.year || '2026'}_${String(metadata.month || '01').padStart(2, '0')}.csv`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Print Report
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-5 animate-in fade-in duration-200">
            {/* Top Navigation & Verification Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[6px_6px_16px_rgba(166,175,195,0.4),-6px_-6px_16px_rgba(255,255,255,0.95)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.7),-4px_-4px_14px_rgba(255,255,255,0.03)]">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onBack}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#e8edf4] dark:bg-[#1f202e] text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 hover:text-pink-600 dark:hover:text-pink-400 hover:border-pink-300 dark:hover:border-pink-800 shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_7px_rgba(0,0,0,0.5)] transition-all cursor-pointer"
                        aria-label="Back to Report Center"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>All Reports</span>
                    </button>

                    <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />

                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 dark:bg-pink-950/60 text-[#EC4899] dark:text-pink-300 border border-pink-200 dark:border-pink-900/50">
                            <ShieldCheck className="w-3 h-3 text-emerald-500" />
                            Executive Verified
                        </span>
                        <span className="hidden sm:inline-block text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            Authorized: {metadata.authorizedExecutive || 'Executive'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-[#e8edf4] dark:bg-[#1f202e] border border-slate-200/80 dark:border-slate-800 hover:text-pink-600 dark:hover:text-pink-400 shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] transition-all cursor-pointer disabled:opacity-50"
                        title="Refresh report records"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-pink-500' : ''}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>

                    <button
                        type="button"
                        onClick={handlePrint}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-[#e8edf4] dark:bg-[#1f202e] border border-slate-200/80 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] transition-all cursor-pointer"
                        title="Print this confidential report"
                    >
                        <Printer className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Print</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleExportCSV}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-[#EC4899] hover:bg-[#db2777] shadow-[2px_2px_6px_rgba(236,72,153,0.4)] transition-all cursor-pointer active:scale-95"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>

            {/* Report Header Information */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                                {title}
                            </h1>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 uppercase tracking-wider">
                                Highly Confidential
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-pink-500" />
                            <span>Reporting Window: <strong className="text-slate-700 dark:text-slate-300">{periodLabel}</strong></span>
                        </div>
                    </div>

                    <div className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                        Audit Timestamp: {metadata.generatedAt ? new Date(metadata.generatedAt).toLocaleString() : 'Live'}
                    </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
                    {summary}
                </p>
            </div>

            {/* KPI Cards Grid */}
            {kpis.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {kpis.map((kpi: any, idx: number) => {
                        const isWarning = kpi.status === 'warning';
                        const isDanger = kpi.status === 'danger';
                        const isGood = kpi.status === 'good';

                        return (
                            <div
                                key={idx}
                                className={`p-3.5 rounded-2xl border transition-all ${
                                    isDanger
                                        ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40'
                                        : isWarning
                                        ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40'
                                        : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
                                } shadow-sm flex flex-col justify-between`}
                            >
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                    {kpi.label}
                                </span>
                                <div className="my-1.5">
                                    <span
                                        className={`text-lg font-black tracking-tight ${
                                            isDanger
                                                ? 'text-rose-600 dark:text-rose-400'
                                                : isWarning
                                                ? 'text-amber-600 dark:text-amber-400'
                                                : isGood
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : 'text-slate-900 dark:text-white'
                                        }`}
                                    >
                                        {kpi.value}
                                    </span>
                                </div>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                    {kpi.note || 'Monthly figure'}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Detailed Table Section */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
                {/* Table Control Bar */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Search records, SKU, supplier..."
                            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-pink-500"
                        />
                    </div>

                    <div className="flex items-center gap-2.5">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            Showing {filteredRecords.length} records
                        </span>
                        <div className="h-3 w-px bg-slate-200 dark:bg-slate-700" />
                        <select
                            value={rowsPerPage}
                            onChange={(e) => {
                                setRowsPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="px-2.5 py-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
                        >
                            <option value={10}>10 / page</option>
                            <option value={15}>15 / page</option>
                            <option value={25}>25 / page</option>
                            <option value={50}>50 / page</option>
                        </select>
                    </div>
                </div>

                {/* Table Rendering Based on Category */}
                <div className="overflow-x-auto">
                    {paginatedRecords.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                            <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            <p className="text-xs font-semibold">No records found for the selected reporting month</p>
                            <p className="text-[11px] mt-0.5">Try searching with a different keyword or review earlier months.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50/75 dark:bg-slate-800/50 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    {renderTableHeaders(category, handleSort, sortField, sortAsc)}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-200">
                                {paginatedRecords.map((row: any, i: number) => (
                                    <tr key={row.id || i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                        {renderTableRowCells(category, row)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Table Pagination Bar */}
                {totalPages > 1 && (
                    <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <div>
                            Page {currentPage} of {totalPages}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                                aria-label="Previous page"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                                aria-label="Next page"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Helper: Table Headers per Category
function renderTableHeaders(
    category: string,
    onSort: (field: string) => void,
    sortField: string,
    sortAsc: boolean
) {
    const th = (label: string, field?: string) => (
        <th
            className={`py-3 px-3.5 whitespace-nowrap ${field ? 'cursor-pointer hover:text-slate-900 dark:hover:text-white' : ''}`}
            onClick={() => field && onSort(field)}
        >
            <div className="flex items-center gap-1">
                <span>{label}</span>
                {field && sortField === field && (
                    <span className="text-pink-500">{sortAsc ? '▲' : '▼'}</span>
                )}
            </div>
        </th>
    );

    switch (category) {
        case 'inventory':
            return (
                <>
                    {th('SKU', 'sku')}
                    {th('Item Name', 'name')}
                    {th('Category', 'category')}
                    {th('Usable Stock', 'stock_level')}
                    {th('Min Threshold', 'minimum_level')}
                    {th('Unit Price (₱)', 'unit_price')}
                    {th('Valuation (₱)', 'valuation')}
                    {th('Quarantine / Defective', 'damaged_quarantine')}
                    {th('Stock Status', 'status')}
                </>
            );
        case 'stock-movements':
            return (
                <>
                    {th('Date / Time', 'date')}
                    {th('Item Name', 'item_name')}
                    {th('Movement Type', 'movement_type')}
                    {th('Quantity', 'quantity')}
                    {th('Reference Type', 'reference_type')}
                    {th('Reference ID', 'reference_id')}
                    {th('Notes / Justification')}
                </>
            );
        case 'defectives-replacements':
            return (
                <>
                    {th('Record Type', 'type')}
                    {th('Code / Ref', 'incident_code')}
                    {th('Date', 'date')}
                    {th('Item / Reason', 'item_name')}
                    {th('Supplier', 'supplier_name')}
                    {th('Quantity', 'quantity')}
                    {th('Severity / Receiving', 'severity')}
                    {th('Resolution Status', 'status')}
                </>
            );
        case 'procurement':
            return (
                <>
                    {th('PR Number', 'pr_number')}
                    {th('Date', 'request_date')}
                    {th('Department', 'department')}
                    {th('Priority', 'priority')}
                    {th('Requested By', 'requested_by')}
                    {th('Estimated Total (₱)', 'estimated_total')}
                    {th('Status', 'status')}
                </>
            );
        case 'suppliers':
            return (
                <>
                    {th('Supplier / Company', 'company_name')}
                    {th('Category', 'category')}
                    {th('Monthly POs', 'monthly_po_count')}
                    {th('Monthly Spend (₱)', 'monthly_spend')}
                    {th('Defect Incidents', 'defect_incidents')}
                    {th('Damaged Units', 'damaged_units')}
                    {th('Contact Lead', 'contact_person')}
                    {th('Status', 'status')}
                </>
            );
        case 'purchase-orders':
            return (
                <>
                    {th('PO Number', 'po_number')}
                    {th('Order Date', 'order_date')}
                    {th('Supplier', 'supplier_name')}
                    {th('Total Amount (₱)', 'total_amount')}
                    {th('Expected Delivery', 'delivery_date')}
                    {th('Financial Approval', 'financial_approval')}
                    {th('Fulfillment Status', 'status')}
                    {th('Settlement', 'paid')}
                </>
            );
        case 'po-financial':
            return (
                <>
                    {th('PO Number', 'po_number')}
                    {th('Order Date', 'order_date')}
                    {th('Supplier', 'supplier_name')}
                    {th('Subtotal (₱)', 'subtotal')}
                    {th('Discount (₱)', 'discount_amount')}
                    {th('VAT / Tax (₱)', 'tax_amount')}
                    {th('Freight (₱)', 'shipping_amount')}
                    {th('Gross Commitment (₱)', 'total_amount')}
                    {th('Financial Approval', 'financial_approval')}
                    {th('Settlement Status', 'payment_status')}
                </>
            );
        case 'confidential-sc':
        default:
            return (
                <>
                    {th('Identifier', 'id')}
                    {th('Audit Category', 'category')}
                    {th('Event Date', 'date')}
                    {th('Entity Involved', 'entity')}
                    {th('Operational Impact', 'impact')}
                    {th('Audit Details', 'details')}
                    {th('Governance Status', 'status')}
                </>
            );
    }
}

// Helper: Table Row Cells per Category
function renderTableRowCells(category: string, row: any) {
    const td = (content: React.ReactNode, extraClass?: string) => (
        <td className={`py-3 px-3.5 whitespace-nowrap ${extraClass || ''}`}>
            {content}
        </td>
    );

    const formatCurrency = (val: number) =>
        `₱${(Number(val) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    switch (category) {
        case 'inventory': {
            const isLow = row.status === 'Low Stock';
            const isOut = row.status === 'Out of Stock';
            return (
                <>
                    {td(<span className="font-mono text-[11px] text-slate-500">{row.sku}</span>)}
                    {td(<span className="font-semibold text-slate-900 dark:text-white">{row.name}</span>)}
                    {td(row.category)}
                    {td(row.stock_level.toLocaleString(), 'font-semibold')}
                    {td(row.minimum_level.toLocaleString())}
                    {td(formatCurrency(row.unit_price))}
                    {td(formatCurrency(row.valuation), 'font-bold text-slate-900 dark:text-white')}
                    {td(row.damaged_quarantine > 0 ? (
                        <span className="text-rose-600 font-bold">{row.damaged_quarantine}</span>
                    ) : '0')}
                    {td(
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isOut
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                : isLow
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        }`}>
                            {row.status}
                        </span>
                    )}
                </>
            );
        }

        case 'stock-movements': {
            const type = (row.movement_type || '').toLowerCase();
            const isIn = type.includes('in') || type.includes('receive');
            const isOut = type.includes('out') || type.includes('issue');
            return (
                <>
                    {td(row.date ? new Date(row.date).toLocaleDateString() : '—', 'font-mono text-[11px]')}
                    {td(
                        <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{row.item_name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{row.sku}</p>
                        </div>
                    )}
                    {td(
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isIn ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' :
                            isOut ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' :
                            'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                        }`}>
                            {row.movement_type}
                        </span>
                    )}
                    {td(
                        <span className={`font-bold ${isIn ? 'text-emerald-600' : isOut ? 'text-blue-600' : 'text-purple-600'}`}>
                            {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
                        </span>
                    )}
                    {td(row.reference_type)}
                    {td(<span className="font-mono text-[11px]">{row.reference_id}</span>)}
                    {td(<span className="max-w-xs truncate block text-slate-500" title={row.notes}>{row.notes}</span>)}
                </>
            );
        }

        case 'defectives-replacements': {
            return (
                <>
                    {td(
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            row.type === 'Damage Incident' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' :
                            'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                        }`}>
                            {row.type}
                        </span>
                    )}
                    {td(<span className="font-mono text-[11px]">{row.incident_code}</span>)}
                    {td(row.date ? new Date(row.date).toLocaleDateString() : '—', 'font-mono text-[11px]')}
                    {td(
                        <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{row.item_name}</p>
                            <p className="text-[10px] text-slate-400">{row.reason}</p>
                        </div>
                    )}
                    {td(row.supplier_name)}
                    {td(<span className="font-bold text-rose-600">{row.quantity} units</span>)}
                    {td(row.severity)}
                    {td(
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {row.status}
                        </span>
                    )}
                </>
            );
        }

        case 'procurement': {
            return (
                <>
                    {td(<span className="font-mono font-bold text-pink-600 dark:text-pink-400">{row.pr_number}</span>)}
                    {td(row.request_date ? new Date(row.request_date).toLocaleDateString() : '—', 'font-mono text-[11px]')}
                    {td(row.department)}
                    {td(
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            row.priority === 'Urgent' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                            {row.priority}
                        </span>
                    )}
                    {td(row.requested_by)}
                    {td(formatCurrency(row.estimated_total), 'font-bold')}
                    {td(
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                            {row.status}
                        </span>
                    )}
                </>
            );
        }

        case 'suppliers': {
            return (
                <>
                    {td(<span className="font-bold text-slate-900 dark:text-white">{row.company_name}</span>)}
                    {td(row.category)}
                    {td(<span className="font-bold">{row.monthly_po_count}</span>)}
                    {td(formatCurrency(row.monthly_spend), 'font-bold')}
                    {td(row.defect_incidents > 0 ? (
                        <span className="text-amber-600 font-bold">{row.defect_incidents} incidents</span>
                    ) : '0')}
                    {td(row.damaged_units > 0 ? `${row.damaged_units} units` : '0')}
                    {td(row.contact_person)}
                    {td(
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            {row.status}
                        </span>
                    )}
                </>
            );
        }

        case 'purchase-orders': {
            return (
                <>
                    {td(<span className="font-mono font-bold text-pink-600 dark:text-pink-400">{row.po_number}</span>)}
                    {td(row.order_date ? new Date(row.order_date).toLocaleDateString() : '—', 'font-mono text-[11px]')}
                    {td(row.supplier_name)}
                    {td(formatCurrency(row.total_amount), 'font-bold text-slate-900 dark:text-white')}
                    {td(row.delivery_date ? new Date(row.delivery_date).toLocaleDateString() : '—')}
                    {td(
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            row.financial_approval === 'Approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' :
                            'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}>
                            {row.financial_approval}
                        </span>
                    )}
                    {td(
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {row.status}
                        </span>
                    )}
                    {td(
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            row.paid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' :
                            'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}>
                            {row.paid ? 'Settled (Paid)' : 'Unsettled'}
                        </span>
                    )}
                </>
            );
        }

        case 'po-financial': {
            return (
                <>
                    {td(<span className="font-mono font-bold text-pink-600 dark:text-pink-400">{row.po_number}</span>)}
                    {td(row.order_date ? new Date(row.order_date).toLocaleDateString() : '—', 'font-mono text-[11px]')}
                    {td(row.supplier_name)}
                    {td(formatCurrency(row.subtotal))}
                    {td(row.discount_amount > 0 ? (
                        <span className="text-emerald-600 font-semibold">-{formatCurrency(row.discount_amount)}</span>
                    ) : '₱0.00')}
                    {td(formatCurrency(row.tax_amount))}
                    {td(formatCurrency(row.shipping_amount))}
                    {td(formatCurrency(row.total_amount), 'font-bold text-slate-900 dark:text-white')}
                    {td(
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            row.financial_approval === 'Approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' :
                            'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}>
                            {row.financial_approval}
                        </span>
                    )}
                    {td(
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            row.paid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' :
                            'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}>
                            {row.payment_status}
                        </span>
                    )}
                </>
            );
        }

        case 'confidential-sc':
        default: {
            return (
                <>
                    {td(<span className="font-mono font-bold text-slate-500">{row.id}</span>)}
                    {td(
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                            {row.category}
                        </span>
                    )}
                    {td(row.date ? new Date(row.date).toLocaleDateString() : '—', 'font-mono text-[11px]')}
                    {td(<span className="font-semibold text-slate-900 dark:text-white">{row.entity}</span>)}
                    {td(<span className="font-bold text-pink-600 dark:text-pink-400">{row.impact}</span>)}
                    {td(<span className="max-w-xs truncate block text-slate-500" title={row.details}>{row.details}</span>)}
                    {td(
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                            {row.status}
                        </span>
                    )}
                </>
            );
        }
    }
}
