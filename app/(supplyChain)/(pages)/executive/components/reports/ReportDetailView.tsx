'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
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
    FileText,
    Receipt,
    X,
    ChevronDown,
    Eye,
    FileSpreadsheet,
    Building2,
    Truck,
    CreditCard,
    DollarSign,
    Box,
    Clock,
    Tag,
} from 'lucide-react';
import Portal from '../../../../components/client/Portal';
import { DigitalReceiptModal } from '../../../../components/modals/DigitalReceiptModal';
import { toast } from 'sonner';

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

    // Export dropdown state
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);

    // Digital receipt modal state (for PO Financial and Purchase Orders)
    const [selectedReceiptPo, setSelectedReceiptPo] = useState<any>(null);

    // Record inspector modal state (to view any row details)
    const [inspectingRecord, setInspectingRecord] = useState<any>(null);

    const {
        title,
        summary,
        periodLabel,
        kpis = [],
        records = [],
        metadata = {},
    } = reportData || {};

    const category = metadata.category || '';

    // Close export dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
                setIsExportMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Close modal on Escape key press
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (selectedReceiptPo) {
                    setSelectedReceiptPo(null);
                } else if (inspectingRecord) {
                    setInspectingRecord(null);
                } else {
                    onBack();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedReceiptPo, inspectingRecord, onBack]);

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

    // 1. Export as CSV
    const handleExportCSV = () => {
        setIsExportMenuOpen(false);
        if (!records.length) {
            toast.error('No records available to export');
            return;
        }

        const cols = getCategoryColumns(category);
        const csvRows: string[] = [
            `"${title || 'Executive Confidential Report'}"`,
            `"Reporting Period: ${periodLabel || ''}"`,
            `"Generated: ${metadata.generatedAt || new Date().toISOString()}"`,
            `"Authorized Executive: ${metadata.authorizedExecutive || 'Executive'}"`,
            '',
            cols.map((c) => `"${c.label.toUpperCase()}"`).join(','),
        ];

        for (const row of filteredRecords) {
            const values = cols.map((c) => {
                const val = c.value(row);
                return `"${String(val).replace(/"/g, '""')}"`;
            });
            csvRows.push(values.join(','));
        }

        const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvRows.join('\n'));
        const link = document.createElement('a');
        link.setAttribute('href', csvContent);
        link.setAttribute(
            'download',
            `${category || 'report'}_${metadata.year || '2026'}_${String(metadata.month || '01').padStart(2, '0')}.csv`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('CSV report downloaded successfully');
    };

    // 2. Export as PDF
    const handleExportPDF = async () => {
        setIsExportMenuOpen(false);
        if (!records.length) {
            toast.error('No records available to export');
            return;
        }

        const toastId = toast.loading('Generating executive PDF report...');
        try {
            const { default: jsPDF } = await import('jspdf');
            const autotableModule = await import('jspdf-autotable');
            const autoTable = autotableModule.autoTable || (autotableModule.default as any)?.autoTable || autotableModule.default;

            const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 36;
            let cursorY = 30;

            // Brand & Document Header
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(15);
            doc.setTextColor(15, 23, 42);
            doc.text(title || 'Confidential Executive Report', margin, cursorY + 12);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(`Airship Express · Supply Chain & Procurement Operations · ${periodLabel || 'Monthly'}`, margin, cursorY + 24);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(219, 39, 119);
            doc.text('CONFIDENTIAL EXECUTIVE AUDIT', pageWidth - margin, cursorY + 12, { align: 'right' });

            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(`Authorized: ${metadata.authorizedExecutive || 'Executive'} · ${new Date().toLocaleDateString()}`, pageWidth - margin, cursorY + 24, { align: 'right' });

            cursorY += 34;

            // Separator line
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(1);
            doc.line(margin, cursorY, pageWidth - margin, cursorY);
            cursorY += 12;

            // Summary Box
            if (summary) {
                doc.setFillColor(248, 250, 252);
                doc.setDrawColor(226, 232, 240);
                const sumLines = doc.splitTextToSize(summary, pageWidth - margin * 2 - 20);
                const sumH = Math.min(40, sumLines.length * 9 + 10);
                doc.roundedRect(margin, cursorY, pageWidth - margin * 2, sumH, 4, 4, 'FD');
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.5);
                doc.setTextColor(71, 85, 105);
                doc.text(sumLines.slice(0, 3), margin + 10, cursorY + 11);
                cursorY += sumH + 10;
            }

            // Table Data
            const cols = getCategoryColumns(category);
            const head = [cols.map((c) => c.label)];
            const body = filteredRecords.map((r) => cols.map((c) => c.value(r)));

            autoTable(doc, {
                startY: cursorY,
                head,
                body,
                margin: { left: margin, right: margin },
                theme: 'grid',
                headStyles: {
                    fillColor: [219, 39, 119],
                    textColor: [255, 255, 255],
                    font: 'helvetica',
                    fontStyle: 'bold',
                    fontSize: 7.5,
                    cellPadding: 4,
                },
                styles: {
                    font: 'helvetica',
                    fontSize: 7,
                    cellPadding: 4,
                    textColor: [30, 41, 59],
                    lineColor: [226, 232, 240],
                    lineWidth: 0.5,
                    overflow: 'linebreak',
                },
                alternateRowStyles: {
                    fillColor: [248, 250, 252],
                },
            });

            // Pagination Footer
            const pageCount = doc.getNumberOfPages();
            for (let p = 1; p <= pageCount; p++) {
                doc.setPage(p);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.5);
                doc.setTextColor(148, 163, 184);
                doc.text('Airship Express · Official Confidential Executive Report', margin, pageHeight - 16);
                doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin, pageHeight - 16, { align: 'right' });
            }

            const cleanCat = (category || 'report').replace(/[^a-zA-Z0-9_-]/g, '_');
            doc.save(`${cleanCat}_report_${metadata.year || '2026'}_${metadata.month || '01'}.pdf`);
            toast.success('Executive PDF report downloaded successfully', { id: toastId });
        } catch (err: any) {
            console.error('PDF export error:', err);
            toast.error('Failed to export PDF: ' + (err?.message || 'Error generating PDF'), { id: toastId });
        }
    };

    // 3. Export as Word (.doc)
    const handleExportWord = () => {
        setIsExportMenuOpen(false);
        if (!records.length) {
            toast.error('No records available to export');
            return;
        }

        const toastId = toast.loading('Generating Word document...');
        try {
            const cols = getCategoryColumns(category);
            const tableHeaderHtml = cols
                .map(
                    (c) =>
                        `<th style="background-color: #db2777; color: #ffffff; padding: 7px 8px; border: 1px solid #cbd5e1; font-size: 8.5pt; text-align: left;">${c.label}</th>`
                )
                .join('');

            const tableRowsHtml = filteredRecords
                .map((row, idx) => {
                    const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                    const cells = cols
                        .map((c) => {
                            const val = c.value(row);
                            return `<td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-size: 8pt; color: #1e293b;">${val}</td>`;
                        })
                        .join('');
                    return `<tr style="background-color: ${bg};">${cells}</tr>`;
                })
                .join('');

            const wordHtml = `
                <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
                <head>
                    <meta charset="utf-8">
                    <title>${title || 'Executive Report'}</title>
                    <!--[if gte mso 9]>
                    <xml>
                        <w:WordDocument>
                            <w:View>Print</w:View>
                            <w:Zoom>100</w:Zoom>
                            <w:DoNotOptimizeForBrowser/>
                        </w:WordDocument>
                    </xml>
                    <![endif]-->
                    <style>
                        body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; margin: 24px; color: #0f172a; }
                        h1 { color: #0f172a; font-size: 16pt; margin-bottom: 3px; }
                        .subtitle { color: #64748b; font-size: 9pt; margin-bottom: 14px; }
                        .badge { color: #db2777; font-weight: bold; font-size: 8.5pt; text-transform: uppercase; }
                        .summary-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; font-size: 8.5pt; color: #334155; margin-bottom: 16px; }
                        table { border-collapse: collapse; width: 100%; margin-top: 10px; }
                        .footer { margin-top: 24px; font-size: 8pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 6px; }
                    </style>
                </head>
                <body>
                    <h1>${title}</h1>
                    <div class="subtitle">
                        Airship Express Logistics Corp. · Supply Chain & Procurement Management · <strong>${periodLabel}</strong><br/>
                        <span class="badge">CONFIDENTIAL EXECUTIVE REPORT</span> | Authorized: ${metadata.authorizedExecutive || 'Executive'} | Generated: ${new Date().toLocaleString()}
                    </div>
                    ${summary ? `<div class="summary-box">${summary}</div>` : ''}
                    <table>
                        <thead><tr>${tableHeaderHtml}</tr></thead>
                        <tbody>${tableRowsHtml}</tbody>
                    </table>
                    <div class="footer">
                        Airship Express Confidential Report · Generated by Executive Reporting Center · Valid for authorized internal review only.
                    </div>
                </body>
                </html>
            `;

            const blob = new Blob(['\ufeff', wordHtml], { type: 'application/msword' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${category || 'report'}_${metadata.year || '2026'}_${metadata.month || '01'}.doc`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success('Word report document downloaded successfully', { id: toastId });
        } catch (err: any) {
            toast.error('Failed to export Word: ' + (err?.message || 'Error generating document'), { id: toastId });
        }
    };

    // Print Report
    const handlePrint = () => {
        window.print();
    };

    return (
        <Portal>
            <div
                className="fixed inset-0 bg-slate-950/75 dark:bg-black/85 backdrop-blur-md flex items-center justify-center z-[9999] p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
                onClick={onBack}
            >
                {/* Modal Container */}
                <div
                    className="bg-[#f0f3f8] dark:bg-[#191a24] rounded-3xl max-w-7xl w-full my-auto border border-slate-200/80 dark:border-[#2c2d3c] shadow-2xl overflow-hidden flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Modal Header */}
                    <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/50 shrink-0">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={onBack}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#ebf0f7] dark:bg-[#1f202e] text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 hover:text-pink-600 dark:hover:text-pink-400 shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] transition-all cursor-pointer active:scale-95"
                                title="Close modal and return to Report Center"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                <span>Overview</span>
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

                        {/* Top Action Buttons (Refresh, Print, Export Dropdown, Close) */}
                        <div className="flex items-center gap-2">
                            {/* Refresh */}
                            <button
                                type="button"
                                onClick={onRefresh}
                                disabled={isLoading}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-[#ebf0f7] dark:bg-[#1f202e] border border-slate-200/80 dark:border-slate-700 hover:text-pink-600 shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] transition-all cursor-pointer disabled:opacity-50"
                                title="Refresh report records"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-pink-500' : ''}`} />
                                <span className="hidden sm:inline">Refresh</span>
                            </button>

                            {/* Print */}
                            <button
                                type="button"
                                onClick={handlePrint}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-[#ebf0f7] dark:bg-[#1f202e] border border-slate-200/80 dark:border-slate-700 hover:text-slate-900 shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] transition-all cursor-pointer"
                                title="Print report"
                            >
                                <Printer className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Print</span>
                            </button>

                            {/* Export Dropdown Menu (PDF, Word, CSV) */}
                            <div className="relative" ref={exportMenuRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-[#EC4899] hover:bg-[#db2777] shadow-[2px_2px_6px_rgba(236,72,153,0.4)] transition-all cursor-pointer active:scale-95"
                                    title="Export report in PDF, Word, or CSV"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Export</span>
                                    <ChevronDown className={`w-3 h-3 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isExportMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white dark:bg-[#1a1b26] border border-slate-200/90 dark:border-slate-800 shadow-xl z-[999999] py-1.5 animate-in fade-in zoom-in-95 duration-150">
                                        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            Choose Export Format
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleExportPDF}
                                            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-pink-50 dark:hover:bg-pink-950/40 hover:text-pink-600 dark:hover:text-pink-400 flex items-center gap-2.5 transition-colors cursor-pointer"
                                        >
                                            <FileText className="w-4 h-4 text-rose-500" />
                                            <div>
                                                <div className="font-bold">PDF Document</div>
                                                <span className="text-[10px] text-slate-400 font-normal">.pdf formatted file</span>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleExportWord}
                                            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-pink-50 dark:hover:bg-pink-950/40 hover:text-pink-600 dark:hover:text-pink-400 flex items-center gap-2.5 transition-colors cursor-pointer border-t border-slate-100 dark:border-slate-800/80"
                                        >
                                            <FileText className="w-4 h-4 text-blue-500" />
                                            <div>
                                                <div className="font-bold">Word Document</div>
                                                <span className="text-[10px] text-slate-400 font-normal">.doc Microsoft Word file</span>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleExportCSV}
                                            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-pink-50 dark:hover:bg-pink-950/40 hover:text-pink-600 dark:hover:text-pink-400 flex items-center gap-2.5 transition-colors cursor-pointer border-t border-slate-100 dark:border-slate-800/80"
                                        >
                                            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                                            <div>
                                                <div className="font-bold">CSV Spreadsheet</div>
                                                <span className="text-[10px] text-slate-400 font-normal">.csv data table</span>
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Close Button */}
                            <button
                                type="button"
                                onClick={onBack}
                                className="w-8 h-8 rounded-full bg-[#ebf0f7] dark:bg-[#14151c] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-center transition-all cursor-pointer ml-1 active:scale-95"
                                aria-label="Close modal"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Modal Scrollable Body */}
                    <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
                        {/* Report Header Information */}
                        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                                            {title}
                                        </h1>
                                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 uppercase tracking-wider">
                                            Highly Confidential
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                        <Calendar className="w-3.5 h-3.5 text-pink-500" />
                                        <span>
                                            Reporting Window:{' '}
                                            <strong className="text-slate-700 dark:text-slate-300">{periodLabel}</strong>
                                        </span>
                                    </div>
                                </div>

                                <div className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                                    Audit Timestamp:{' '}
                                    {metadata.generatedAt
                                        ? new Date(metadata.generatedAt).toLocaleString()
                                        : 'Live Database Cutoff'}
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
                                            } shadow-xs flex flex-col justify-between`}
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
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
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
                                        placeholder="Search records, SKU, supplier, PO..."
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
                                        aria-label="Rows per page"
                                    >
                                        <option value={10}>10 / page</option>
                                        <option value={15}>15 / page</option>
                                        <option value={25}>25 / page</option>
                                        <option value={50}>50 / page</option>
                                    </select>
                                </div>
                            </div>

                            {/* Table Rendering */}
                            <div className="overflow-x-auto">
                                {paginatedRecords.length === 0 ? (
                                    <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                        <p className="text-xs font-semibold">
                                            No records found for the selected reporting month
                                        </p>
                                        <p className="text-[11px] mt-0.5">
                                            Try searching with a different keyword or review earlier months.
                                        </p>
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
                                                <tr
                                                    key={row.id || i}
                                                    onClick={() => setInspectingRecord(row)}
                                                    className="hover:bg-pink-50/30 dark:hover:bg-pink-950/10 transition-colors cursor-pointer"
                                                    title="Click to view full record details"
                                                >
                                                    {renderTableRowCells(
                                                        category,
                                                        row,
                                                        (poRow) => setSelectedReceiptPo(poRow),
                                                        (rec) => setInspectingRecord(rec)
                                                    )}
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
                                            className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                                            aria-label="Previous page"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                                            aria-label="Next page"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="px-6 py-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
                        <span className="text-xs text-slate-400 font-medium">
                            Press <kbd className="px-2 py-0.5 rounded-lg bg-white dark:bg-[#14151c] font-mono text-[10px] border border-slate-200 dark:border-slate-700 shadow-xs">Esc</kbd> to close
                        </span>
                        <button
                            type="button"
                            onClick={onBack}
                            className="px-5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-[#ebf0f7] dark:bg-[#1f202e] hover:bg-[#e2e8f0] dark:hover:bg-[#282a3a] border border-slate-200/80 dark:border-slate-700 shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] transition-all cursor-pointer active:scale-95"
                        >
                            Close Report
                        </button>
                    </div>
                </div>
            </div>

            {/* Official Digital Receipt Modal (For PO Financial / Purchase Orders) */}
            {selectedReceiptPo && (
                <DigitalReceiptModal
                    isOpen={!!selectedReceiptPo}
                    onClose={() => setSelectedReceiptPo(null)}
                    order={selectedReceiptPo}
                    purchaseOrder={selectedReceiptPo}
                />
            )}

            {/* Record Inspector Modal (To view details of any selected table row) */}
            {inspectingRecord && (
                <Portal>
                    <div
                        className="fixed inset-0 bg-slate-950/75 dark:bg-black/85 backdrop-blur-sm flex items-center justify-center z-[100000] p-4 animate-in fade-in duration-150"
                        onClick={() => setInspectingRecord(null)}
                    >
                        <div
                            className="bg-white dark:bg-[#191a24] rounded-3xl max-w-2xl w-full p-6 border border-slate-200/80 dark:border-[#2c2d3c] shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-pink-100 dark:bg-pink-950/60 text-pink-600 flex items-center justify-center font-bold">
                                        <FileText className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                            Record Audit Inspector
                                        </h3>
                                        <p className="text-[11px] text-slate-400">
                                            {title}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setInspectingRecord(null)}
                                    className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Field values grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                {Object.entries(inspectingRecord)
                                    .filter(([k]) => k !== 'items' && k !== 'notes' && typeof inspectingRecord[k] !== 'object')
                                    .map(([key, val]) => (
                                        <div key={key} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                                {key.replace(/_/g, ' ')}
                                            </span>
                                            <span className="font-semibold text-slate-800 dark:text-slate-200 break-all">
                                                {String(val ?? '—')}
                                            </span>
                                        </div>
                                    ))}
                            </div>

                            {/* Notes if available */}
                            {inspectingRecord.notes && (
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                        Audit / Transaction Notes
                                    </span>
                                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                                        {inspectingRecord.notes}
                                    </p>
                                </div>
                            )}

                            {/* Receipt Button if this record is a Purchase Order */}
                            <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                                {inspectingRecord.po_number ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const rec = inspectingRecord;
                                            setInspectingRecord(null);
                                            setSelectedReceiptPo(rec);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-pink-600 hover:bg-pink-500 shadow-sm transition-all cursor-pointer"
                                    >
                                        <Receipt className="w-4 h-4" />
                                        <span>View Digital Receipt</span>
                                    </button>
                                ) : <div />}

                                <button
                                    type="button"
                                    onClick={() => setInspectingRecord(null)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}
        </Portal>
    );
};

// Helper: Column Specifications for Export
function getCategoryColumns(category: string) {
    const formatCurrency = (val: number) =>
        `PHP ${(Number(val) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    switch (category) {
        case 'inventory':
            return [
                { label: 'SKU', value: (r: any) => r.sku || '—' },
                { label: 'Item Name', value: (r: any) => r.name || '—' },
                { label: 'Category', value: (r: any) => r.category || '—' },
                { label: 'Stock Level', value: (r: any) => String(r.stock_level ?? 0) },
                { label: 'Min Level', value: (r: any) => String(r.minimum_level ?? 0) },
                { label: 'Unit Price', value: (r: any) => formatCurrency(r.unit_price) },
                { label: 'Valuation', value: (r: any) => formatCurrency(r.valuation) },
                { label: 'Damaged', value: (r: any) => String(r.damaged_quarantine ?? 0) },
                { label: 'Status', value: (r: any) => r.status || '—' },
            ];
        case 'stock-movements':
            return [
                { label: 'Date', value: (r: any) => (r.date ? new Date(r.date).toLocaleDateString() : '—') },
                { label: 'Item Name', value: (r: any) => r.item_name || '—' },
                { label: 'SKU', value: (r: any) => r.sku || '—' },
                { label: 'Movement', value: (r: any) => r.movement_type || '—' },
                { label: 'Quantity', value: (r: any) => String(r.quantity ?? 0) },
                { label: 'Ref Type', value: (r: any) => r.reference_type || '—' },
                { label: 'Ref ID', value: (r: any) => r.reference_id || '—' },
                { label: 'Notes', value: (r: any) => r.notes || '—' },
            ];
        case 'defectives-replacements':
            return [
                { label: 'Type', value: (r: any) => r.type || '—' },
                { label: 'Code', value: (r: any) => r.incident_code || '—' },
                { label: 'Date', value: (r: any) => (r.date ? new Date(r.date).toLocaleDateString() : '—') },
                { label: 'Item / Reason', value: (r: any) => `${r.item_name || ''} - ${r.reason || ''}` },
                { label: 'Supplier', value: (r: any) => r.supplier_name || '—' },
                { label: 'Quantity', value: (r: any) => `${r.quantity ?? 0} units` },
                { label: 'Severity', value: (r: any) => r.severity || '—' },
                { label: 'Status', value: (r: any) => r.status || '—' },
            ];
        case 'procurement':
            return [
                { label: 'PR Number', value: (r: any) => r.pr_number || '—' },
                { label: 'Date', value: (r: any) => (r.request_date ? new Date(r.request_date).toLocaleDateString() : '—') },
                { label: 'Department', value: (r: any) => r.department || '—' },
                { label: 'Priority', value: (r: any) => r.priority || '—' },
                { label: 'Requested By', value: (r: any) => r.requested_by || '—' },
                { label: 'Estimated Total', value: (r: any) => formatCurrency(r.estimated_total) },
                { label: 'Status', value: (r: any) => r.status || '—' },
            ];
        case 'suppliers':
            return [
                { label: 'Supplier', value: (r: any) => r.company_name || '—' },
                { label: 'Category', value: (r: any) => r.category || '—' },
                { label: 'Monthly POs', value: (r: any) => String(r.monthly_po_count ?? 0) },
                { label: 'Monthly Spend', value: (r: any) => formatCurrency(r.monthly_spend) },
                { label: 'Defect Incidents', value: (r: any) => String(r.defect_incidents ?? 0) },
                { label: 'Damaged Units', value: (r: any) => String(r.damaged_units ?? 0) },
                { label: 'Contact', value: (r: any) => r.contact_person || '—' },
                { label: 'Status', value: (r: any) => r.status || '—' },
            ];
        case 'purchase-orders':
            return [
                { label: 'PO Number', value: (r: any) => r.po_number || '—' },
                { label: 'Date', value: (r: any) => (r.order_date ? new Date(r.order_date).toLocaleDateString() : '—') },
                { label: 'Supplier', value: (r: any) => r.supplier_name || '—' },
                { label: 'Total Amount', value: (r: any) => formatCurrency(r.total_amount) },
                { label: 'Delivery Date', value: (r: any) => (r.delivery_date ? new Date(r.delivery_date).toLocaleDateString() : '—') },
                { label: 'Approval', value: (r: any) => r.financial_approval || '—' },
                { label: 'Fulfillment', value: (r: any) => r.status || '—' },
                { label: 'Settlement', value: (r: any) => (r.paid ? 'Settled (Paid)' : 'Unsettled') },
            ];
        case 'po-financial':
            return [
                { label: 'PO Number', value: (r: any) => r.po_number || '—' },
                { label: 'Date', value: (r: any) => (r.order_date ? new Date(r.order_date).toLocaleDateString() : '—') },
                { label: 'Supplier', value: (r: any) => r.supplier_name || '—' },
                { label: 'Subtotal', value: (r: any) => formatCurrency(r.subtotal) },
                { label: 'Discount', value: (r: any) => (r.discount_amount > 0 ? `-${formatCurrency(r.discount_amount)}` : 'PHP 0.00') },
                { label: 'VAT', value: (r: any) => formatCurrency(r.tax_amount) },
                { label: 'Freight', value: (r: any) => formatCurrency(r.shipping_amount) },
                { label: 'Grand Total', value: (r: any) => formatCurrency(r.total_amount) },
                { label: 'Approval', value: (r: any) => r.financial_approval || '—' },
                { label: 'Payment Status', value: (r: any) => r.payment_status || '—' },
            ];
        case 'confidential-sc':
        default:
            return [
                { label: 'ID', value: (r: any) => r.id || '—' },
                { label: 'Category', value: (r: any) => r.category || '—' },
                { label: 'Date', value: (r: any) => (r.date ? new Date(r.date).toLocaleDateString() : '—') },
                { label: 'Entity', value: (r: any) => r.entity || '—' },
                { label: 'Impact', value: (r: any) => r.impact || '—' },
                { label: 'Details', value: (r: any) => r.details || '—' },
                { label: 'Status', value: (r: any) => r.status || '—' },
            ];
    }
}

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
                    {th('Action')}
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
                    {th('Action')}
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
                    {th('Action')}
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
                    {th('Action')}
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
                    {th('Action')}
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
                    {th('Receipt')}
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
                    {th('Receipt')}
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
                    {th('Action')}
                </>
            );
    }
}

// Helper: Table Row Cells per Category
function renderTableRowCells(
    category: string,
    row: any,
    onViewReceipt: (row: any) => void,
    onViewRecord: (row: any) => void
) {
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
                    {td(
                        row.damaged_quarantine > 0 ? (
                            <span className="text-rose-600 font-bold">{row.damaged_quarantine}</span>
                        ) : (
                            '0'
                        )
                    )}
                    {td(
                        <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                isOut
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                    : isLow
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            }`}
                        >
                            {row.status}
                        </span>
                    )}
                    {td(
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onViewRecord(row);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                        >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                        </button>
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
                        <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                isIn
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : isOut
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                    : 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                            }`}
                        >
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
                    {td(
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onViewRecord(row);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                        >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                        </button>
                    )}
                </>
            );
        }

        case 'defectives-replacements': {
            return (
                <>
                    {td(
                        <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                row.type === 'Damage Incident'
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                            }`}
                        >
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
                    {td(
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onViewRecord(row);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                        >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                        </button>
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
                        <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                row.priority === 'Urgent'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                        >
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
                    {td(
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onViewRecord(row);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                        >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                        </button>
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
                    {td(
                        row.defect_incidents > 0 ? (
                            <span className="text-amber-600 font-bold">{row.defect_incidents} incidents</span>
                        ) : (
                            '0'
                        )
                    )}
                    {td(row.damaged_units > 0 ? `${row.damaged_units} units` : '0')}
                    {td(row.contact_person)}
                    {td(
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            {row.status}
                        </span>
                    )}
                    {td(
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onViewRecord(row);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                        >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                        </button>
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
                        <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                row.financial_approval === 'Approved'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}
                        >
                            {row.financial_approval}
                        </span>
                    )}
                    {td(
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {row.status}
                        </span>
                    )}
                    {td(
                        <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                row.paid
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                            }`}
                        >
                            {row.paid ? 'Settled (Paid)' : 'Unsettled'}
                        </span>
                    )}
                    {td(
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onViewReceipt(row);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-pink-600 hover:bg-pink-500 shadow-[2px_2px_5px_rgba(219,39,119,0.35)] transition-all cursor-pointer active:scale-95"
                            title="View official digital receipt"
                        >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>Receipt</span>
                        </button>
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
                    {td(
                        row.discount_amount > 0 ? (
                            <span className="text-emerald-600 font-semibold">-{formatCurrency(row.discount_amount)}</span>
                        ) : (
                            '₱0.00'
                        )
                    )}
                    {td(formatCurrency(row.tax_amount))}
                    {td(formatCurrency(row.shipping_amount))}
                    {td(formatCurrency(row.total_amount), 'font-bold text-slate-900 dark:text-white')}
                    {td(
                        <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                row.financial_approval === 'Approved'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}
                        >
                            {row.financial_approval}
                        </span>
                    )}
                    {td(
                        <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                row.paid
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                            }`}
                        >
                            {row.payment_status}
                        </span>
                    )}
                    {td(
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onViewReceipt(row);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-pink-600 hover:bg-pink-500 shadow-[2px_2px_5px_rgba(219,39,119,0.35)] transition-all cursor-pointer active:scale-95"
                            title="View official digital procurement receipt"
                        >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>Receipt</span>
                        </button>
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
                    {td(
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onViewRecord(row);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                        >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                        </button>
                    )}
                </>
            );
        }
    }
}
