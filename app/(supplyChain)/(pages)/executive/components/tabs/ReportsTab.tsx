'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Calendar,
    Lock,
    ShieldCheck,
    Search,
    ArrowRight,
    RefreshCw,
    Box,
    Truck,
    AlertOctagon,
    ShoppingCart,
    Users,
    FileSpreadsheet,
    DollarSign,
    ShieldAlert,
    Loader2,
} from 'lucide-react';
import { ExecutiveDataPayload } from '../../hooks/useExecutiveData';
import { ExecutiveVerificationModal } from '../modals/ExecutiveVerificationModal';
import { ReportDetailView } from '../reports/ReportDetailView';
import { user } from '../../../../lib/services/Class/user';

const DEFAULT_REPORT_CATEGORIES = [
    {
        id: 'inventory',
        title: 'Inventory Report',
        description: 'Usable stock balances, valuation, and stock health thresholds.',
        badge: 'Operational',
        indicators: [
            'Tracked Inventory Items',
            'Usable Stock Balance',
            'Inventory Valuation',
            'Low-Stock Threshold Alerts',
            'Out-of-Stock SKUs',
            'Quarantined Defective Stock',
        ],
        periodNote: 'Live Catalog Cutoff',
    },
    {
        id: 'stock-movements',
        title: 'Stock Movement Report',
        description: 'Inbound receipts, outbound issuance, adjustments, and supplier returns.',
        badge: 'Logistics',
        indicators: [
            'Total Movement Transactions',
            'Stock Received Units',
            'Stock Issued Units',
            'Cycle Count Adjustments',
            'Recorded Supplier Returns',
        ],
        periodNote: 'Monthly Ledger',
    },
    {
        id: 'defectives-replacements',
        title: 'Defective Items and Replacements Report',
        description: 'Damaged shipments, supplier replacement claims, and fulfillment status.',
        badge: 'Quality Assurance',
        indicators: [
            'Warehouse Damage Incidents',
            'Affected Defective Units',
            'Replacements Received & Restocked',
            'Outstanding Replacement Claims',
            'Unresolved Defect Investigations',
        ],
        periodNote: 'Monthly Quality Audit',
    },
    {
        id: 'procurement',
        title: 'Procurement Report',
        description: 'Purchase requests, departmental requisitions, and sourcing status.',
        badge: 'Procurement',
        indicators: [
            'Total Purchase Requests',
            'Estimated Requisition Budget',
            'Approved Requisitions',
            'Pending Executive Approvals',
            'Vendor Sourcing & RFQ Status',
        ],
        periodNote: 'Requisition Ledger',
    },
    {
        id: 'suppliers',
        title: 'Supplier Performance Report',
        description: 'Active vendor engagement, procurement spend, and defect incidence.',
        badge: 'Vendor Management',
        indicators: [
            'Registered Supplier Directory',
            'Suppliers with Active Monthly Orders',
            'Suppliers with Defect / Quality Claims',
            'Vendor Reliability Indicators',
        ],
        periodNote: 'Monthly Partner Review',
    },
    {
        id: 'purchase-orders',
        title: 'Purchase Order Report',
        description: 'Issued purchase orders and delivery fulfillment stages.',
        badge: 'Purchasing',
        indicators: [
            'Total Issued Purchase Orders',
            'Orders Awaiting Delivery',
            'Partially Received Orders',
            'Fully Received / Fulfilled POs',
            'Cancelled / Voided Orders',
        ],
        periodNote: 'Purchase Order Log',
    },
    {
        id: 'po-financial',
        title: 'Purchase Order Financial Report',
        description: 'Gross commitments, disbursements, tax, discounts, and accounts payable.',
        badge: 'Financial Audit',
        indicators: [
            'Total Issued Commitments',
            'Approved Capital Commitments',
            'Recorded Disbursed Payments',
            'Outstanding Accounts Payable',
            'Negotiated Discounts Savings',
            'Applicable VAT & Freight Charges',
        ],
        periodNote: 'Fiscal Disbursement Audit',
    },
    {
        id: 'confidential-sc',
        title: 'Supply Chain Confidential Report',
        description: 'Operational variances, unusual adjustments, disputes, and access audit anomalies.',
        badge: 'Confidential Internal Audit',
        indicators: [
            'Warehouse Stock Variances',
            'Unusual / Forced Inventory Adjustments',
            'Active Vendor RMA Disputes',
            'Security & Access Governance Alerts',
        ],
        periodNote: 'Confidential Internal Review',
    },
];

interface ReportsTabProps {
    data: ExecutiveDataPayload;
    onOpenModal?: (reportType: string) => void;
}

export default function ReportsTab({ data }: ReportsTabProps) {
    // Current date default
    const now = new Date();
    const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);

    // Overview state
    const [overviewData, setOverviewData] = useState<any>(null);
    const [isOverviewLoading, setIsOverviewLoading] = useState<boolean>(true);
    const [overviewError, setOverviewError] = useState<string | null>(null);
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');

    // Debounce search query by 300ms
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    // Verification state
    const [verificationToken, setVerificationToken] = useState<string | null>(null);
    const [isVerifyModalOpen, setIsVerifyModalOpen] = useState<boolean>(false);
    const [pendingCategory, setPendingCategory] = useState<any>(null);

    // Active detail view state
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [detailReportData, setDetailReportData] = useState<any>(null);
    const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);

    // Helper: get current user session token
    const getSessionToken = () => {
        return (
            user.getSessionToken() ||
            (typeof window !== 'undefined'
                ? localStorage.getItem('session_token') || localStorage.getItem('sc_session_token')
                : '') ||
            ''
        );
    };

    // 1. Fetch Overview Structure
    const fetchOverview = useCallback(async () => {
        setIsOverviewLoading(true);
        setOverviewError(null);
        try {
            const token = getSessionToken();
            const res = await fetch(
                `/api/executive/reports/overview?year=${selectedYear}&month=${selectedMonth}`,
                {
                    headers: {
                        'x-session-token': token,
                    },
                }
            );

            const json = await res.json();
            if (!res.ok || !json.success) {
                setOverviewError(json.error || 'Failed to load report overview.');
                return;
            }

            setOverviewData(json);
        } catch (err: any) {
            setOverviewError('Network error loading monthly report summary.');
        } finally {
            setIsOverviewLoading(false);
        }
    }, [selectedYear, selectedMonth]);

    useEffect(() => {
        fetchOverview();
    }, [fetchOverview]);

    // 2. Fetch Detailed Report Data (Triggered only after verification)
    const fetchDetailReport = useCallback(
        async (catId: string, customToken?: string) => {
            const tokenToUse = customToken || verificationToken;
            if (!tokenToUse) {
                // Must verify password first
                return;
            }

            setIsDetailLoading(true);
            try {
                const sessionToken = getSessionToken();
                const res = await fetch(
                    `/api/executive/reports/detail?category=${catId}&year=${selectedYear}&month=${selectedMonth}`,
                    {
                        headers: {
                            'x-session-token': sessionToken,
                            'x-executive-verification': tokenToUse,
                        },
                    }
                );

                const json = await res.json();
                if (!res.ok || !json.success) {
                    if (json.needsVerification || res.status === 403) {
                        // Verification expired or missing -> trigger modal
                        setVerificationToken(null);
                        setPendingCategory(overviewData?.categories?.find((c: any) => c.id === catId));
                        setIsVerifyModalOpen(true);
                        setActiveCategory(null);
                        return;
                    }
                    alert(json.error || 'Failed to fetch confidential report data.');
                    return;
                }

                setDetailReportData(json.report);
                setActiveCategory(catId);
            } catch (err) {
                alert('Network error retrieving detailed report.');
            } finally {
                setIsDetailLoading(false);
            }
        },
        [selectedYear, selectedMonth, verificationToken, overviewData]
    );

    // If month changes while viewing a detailed report, refresh it
    useEffect(() => {
        if (activeCategory && verificationToken) {
            fetchDetailReport(activeCategory);
        }
    }, [selectedYear, selectedMonth]);

    // 3. Handle Click on Report Card or "Open Report" button:
    // ALWAYS prompts for Executive password verification before releasing report data
    const handleOpenReportClick = (categoryItem: any) => {
        setPendingCategory(categoryItem);
        setIsVerifyModalOpen(true);
    };

    // 4. Handle Successful Verification Callback
    const handleVerificationSuccess = (token: string) => {
        setVerificationToken(token);
        setIsVerifyModalOpen(false);

        if (pendingCategory) {
            fetchDetailReport(pendingCategory.id, token);
        }
    };

    // 5. Handle Returning Back to Overview: clear token so next open prompts for password again
    const handleBackToOverview = () => {
        setActiveCategory(null);
        setDetailReportData(null);
        setPendingCategory(null);
        setVerificationToken(null);
    };

    // Category icon mapper
    const getCategoryIcon = (id: string) => {
        switch (id) {
            case 'inventory':
                return <Box className="w-5 h-5 text-amber-500" />;
            case 'stock-movements':
                return <Truck className="w-5 h-5 text-blue-500" />;
            case 'defectives-replacements':
                return <AlertOctagon className="w-5 h-5 text-rose-500" />;
            case 'procurement':
                return <ShoppingCart className="w-5 h-5 text-purple-500" />;
            case 'suppliers':
                return <Users className="w-5 h-5 text-emerald-500" />;
            case 'purchase-orders':
                return <FileSpreadsheet className="w-5 h-5 text-indigo-500" />;
            case 'po-financial':
                return <span className="w-5 h-5 flex items-center justify-center font-black text-pink-500 text-lg leading-none select-none">₱</span>;
            case 'confidential-sc':
            default:
                return <ShieldAlert className="w-5 h-5 text-rose-600" />;
        }
    };

    // Filter categories for display (using live overview or robust fallback categories)
    const rawCategories = (overviewData?.categories && overviewData.categories.length > 0)
        ? overviewData.categories
        : DEFAULT_REPORT_CATEGORIES;

    const displayedCategories = rawCategories.filter((cat: any) => {
        if (categoryFilter !== 'ALL' && cat.badge !== categoryFilter) {
            return false;
        }
        if (debouncedSearchQuery.trim()) {
            const query = debouncedSearchQuery.toLowerCase().trim();
            const matchesTitle = cat.title.toLowerCase().includes(query);
            const matchesDesc = cat.description.toLowerCase().includes(query);
            const matchesBadge = cat.badge.toLowerCase().includes(query);
            const matchesIndicators = cat.indicators?.some((ind: string) => ind.toLowerCase().includes(query));
            return matchesTitle || matchesDesc || matchesBadge || matchesIndicators;
        }
        return true;
    });

    const monthOptions = [
        { num: 1, name: 'January' },
        { num: 2, name: 'February' },
        { num: 3, name: 'March' },
        { num: 4, name: 'April' },
        { num: 5, name: 'May' },
        { num: 6, name: 'June' },
        { num: 7, name: 'July' },
        { num: 8, name: 'August' },
        { num: 9, name: 'September' },
        { num: 10, name: 'October' },
        { num: 11, name: 'November' },
        { num: 12, name: 'December' },
    ];


    // OVERVIEW VIEW: Render Month Selector & Summary Cards
    return (
        <div className="space-y-5">
            {/* 1. Header Banner & Monthly Selector */}
            <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03)] space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Title & Description */}
                    <div className="flex items-start gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-400 text-white flex items-center justify-center shadow-[0_2px_10px_rgba(236,72,153,0.35)] shrink-0">
                            <Lock className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                                    Confidential Monthly Supply Chain Report Center
                                </h1>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 dark:bg-pink-950/60 text-[#EC4899] dark:text-pink-300 border border-pink-200 dark:border-pink-900/40">
                                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                                    Executive Classified
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Centralized monthly reporting center. Detailed figures, stock movements, and financial statements are released only after Executive password verification.
                            </p>
                        </div>
                    </div>

                    {/* Month & Year Selectors */}
                    <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white dark:bg-[#14151c] border border-slate-200/80 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]">
                            <Calendar className="w-3.5 h-3.5 text-pink-500" />
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                                aria-label="Select reporting month"
                            >
                                {monthOptions.map((m) => (
                                    <option key={m.num} value={m.num} className="dark:bg-slate-900">
                                        {m.name}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer border-l border-slate-200 dark:border-slate-700 pl-1.5"
                                aria-label="Select reporting year"
                            >
                                {[2024, 2025, 2026, 2027].map((yr) => (
                                    <option key={yr} value={yr} className="dark:bg-slate-900">
                                        {yr}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="button"
                            onClick={() => fetchOverview()}
                            disabled={isOverviewLoading}
                            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 bg-white dark:bg-[#14151c] border border-slate-200/80 dark:border-slate-800 hover:text-pink-600 shadow-sm transition-all disabled:opacity-50"
                            title="Refresh month data"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isOverviewLoading ? 'animate-spin text-pink-500' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Reporting Period Label & Category Summary Badge */}
                <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-400 dark:text-slate-500 font-medium">Reporting Window:</span>
                        <strong className="text-slate-800 dark:text-slate-200 font-mono text-[11px]">
                            {overviewData?.period?.periodLabel || `Month ${selectedMonth}, ${selectedYear} (Asia/Manila)`}
                        </strong>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-[#ebf0f7] dark:bg-[#14151c] text-pink-700 dark:text-pink-300 border border-slate-200/60 dark:border-slate-800">
                            {overviewData?.totalCategories || 8} Categories Available
                        </span>
                        {verificationToken && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                                <ShieldCheck className="w-3 h-3" />
                                Verified Session Active
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search report categories..."
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-pink-500 shadow-sm"
                    />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    {['ALL', 'Operational', 'Logistics', 'Quality Assurance', 'Procurement', 'Financial Audit', 'Confidential Internal Audit'].map(
                        (badge) => (
                            <button
                                key={badge}
                                type="button"
                                onClick={() => setCategoryFilter(badge)}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer ${
                                    categoryFilter === badge
                                        ? 'bg-[#EC4899] text-white shadow-sm'
                                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                {badge === 'ALL' ? 'All Categories' : badge}
                            </button>
                        )
                    )}
                </div>
            </div>

            {overviewError && (
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                    <p><span className="font-bold">Offline Notice:</span> Showing standard category scope. {overviewError}</p>
                </div>
            )}

            {/* 4. Category Cards Grid (Metadata & Scope Only — No Raw Data Revealed) */}
            {displayedCategories.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {displayedCategories.map((card: any) => (
                        <div
                            key={card.id}
                            onClick={() => handleOpenReportClick(card)}
                            className="p-5 rounded-2xl bg-[#f0f3f8] dark:bg-[#1c1d28] border border-white/80 dark:border-[#2c2d3c] shadow-[5px_5px_14px_rgba(166,175,195,0.35),-5px_-5px_14px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.85)] dark:shadow-[6px_6px_18px_rgba(0,0,0,0.6),-4px_-4px_14px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:shadow-[1px_1px_4px_rgba(166,175,195,0.5),-1px_-1px_4px_rgba(255,255,255,0.95)] hover:border-pink-300 dark:hover:border-pink-500/50 transition-all flex flex-col justify-between group space-y-4 cursor-pointer"
                        >
                            <div className="space-y-3">
                                {/* Card Header */}
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                                        {getCategoryIcon(card.id)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400 block truncate">
                                            {card.badge}
                                        </span>
                                        <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate mt-0.5">
                                            {card.title}
                                        </h2>
                                    </div>
                                </div>

                                {/* Short Scope Description */}
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                                    {card.description}
                                </p>

                                {/* Protected Data Banner */}
                                <div className="p-2.5 rounded-xl bg-white dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.2)] dark:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.4)] flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                                        <Lock className="w-3.5 h-3.5 text-pink-500" />
                                        <span>Figures Classified</span>
                                    </div>
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/60 px-2 py-0.5 rounded-full border border-pink-200 dark:border-pink-900/50">
                                        Protected
                                    </span>
                                </div>

                                {/* Scope of Covered Metrics */}
                                <div className="pt-1 space-y-1.5">
                                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                        Covered Metrics:
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {card.indicators?.map((ind: string, idx: number) => (
                                            <span
                                                key={idx}
                                                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50"
                                            >
                                                <span className="w-1 h-1 rounded-full bg-pink-500 shrink-0" />
                                                <span className="truncate max-w-[130px]">{ind}</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Card Footer: Protected Open Action */}
                            <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between">
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate mr-2">
                                    {card.periodNote}
                                </span>

                                <button
                                    type="button"
                                    onClick={() => handleOpenReportClick(card)}
                                    disabled={isDetailLoading}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-[#EC4899] hover:bg-[#db2777] active:scale-95 shadow-[0_2px_6px_rgba(236,72,153,0.35)] transition-all cursor-pointer group/btn shrink-0"
                                >
                                    <span>Open Report</span>
                                    <ArrowRight className="w-3 h-3 group-hover/btn:translate-x-0.5 transition-transform" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="py-16 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-2">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No report categories match &ldquo;{debouncedSearchQuery}&rdquo;</p>
                    <p className="text-xs text-slate-400">Try searching for keywords like inventory, procurement, defectives, or suppliers.</p>
                    <button
                        type="button"
                        onClick={() => { setSearchQuery(''); setCategoryFilter('ALL'); }}
                        className="mt-2 px-3 py-1 text-xs font-semibold text-pink-600 dark:text-pink-400 underline cursor-pointer"
                    >
                        Clear search & filters
                    </button>
                </div>
            )}

            {/* 5. Executive Verification Password Modal */}
            <ExecutiveVerificationModal
                isOpen={isVerifyModalOpen}
                onClose={() => {
                    setIsVerifyModalOpen(false);
                    setPendingCategory(null);
                }}
                reportTitle={pendingCategory?.title || 'Confidential Report'}
                onSuccess={handleVerificationSuccess}
            />

            {/* 6. Detailed Confidential Report Table Modal (Viewable after password verification) */}
            {activeCategory && detailReportData && (
                <ReportDetailView
                    reportData={detailReportData}
                    onBack={handleBackToOverview}
                    onRefresh={() => fetchDetailReport(activeCategory)}
                    isLoading={isDetailLoading}
                />
            )}
        </div>
    );
}
