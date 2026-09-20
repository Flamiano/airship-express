'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SessionGuard } from '@/app/(supplyChain)/components/server/SessionGuard';
import { DocumentsTab } from '@/app/(supplyChain)/(pages)/trash/components/DocumentsTab';
import { PurchaseOrdersTab } from '@/app/(supplyChain)/(pages)/trash/components/PurchaseOrdersTab';
import { SuppliersTab } from '@/app/(supplyChain)/(pages)/trash/components/SuppliersTab';
import { ParcelsTab } from '@/app/(supplyChain)/(pages)/trash/components/ParcelsTab';
import { trashCache } from '@/app/(supplyChain)/(pages)/trash/utils/trashCache';
import { AppButton } from '@/app/(supplyChain)/components/ui/AppButton';
import UnauthorizedEmptyState, { useUserRole } from '@/app/(supplyChain)/components/global/UnauthorizedEmptyState';

type ArchiveTab = 'documents' | 'purchase_orders' | 'suppliers' | 'parcels';

const DEFAULT_TAB: ArchiveTab = 'documents';
const VALID_TABS: ArchiveTab[] = ['documents', 'purchase_orders', 'suppliers', 'parcels'];

export default function ArchivePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { role: userRole, isPrivileged, isLoaded } = useUserRole();

    const isOperator = userRole?.toLowerCase() === 'operator';
    const isEmployee = userRole?.toLowerCase() === 'employee';

    const canAccessDocuments = isPrivileged || isEmployee;
    const canAccessPurchaseOrders = isPrivileged;
    const canAccessSuppliers = isPrivileged;
    const canAccessParcels = isPrivileged || isOperator;

    const getDefaultTabForRole = useCallback((role: string): ArchiveTab => {
        const norm = (role || '').trim().toLowerCase();
        if (norm === 'operator') return 'parcels';
        return 'documents';
    }, []);

    const tabFromUrl = searchParams.get('tab') as ArchiveTab;
    const isValidTab = tabFromUrl && VALID_TABS.includes(tabFromUrl);
    const initialDefaultTab = getDefaultTabForRole(userRole);
    const [activeTab, setActiveTab] = useState<ArchiveTab>(isValidTab ? tabFromUrl : initialDefaultTab);
    const [visitedTabs, setVisitedTabs] = useState<Set<ArchiveTab>>(new Set([isValidTab ? tabFromUrl : initialDefaultTab]));
    const [isRefreshing, setIsRefreshing] = useState(false);

    // update tab
    const updateTab = useCallback((tab: ArchiveTab) => {
        setActiveTab(tab);
        setVisitedTabs(prev => {
            if (prev.has(tab)) return prev;
            const next = new Set(prev);
            next.add(tab);
            return next;
        });

        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        router.push(`?${params.toString()}`, { scroll: false });
    }, [router, searchParams]);

    // sync active tab
    useEffect(() => {
        const tab = searchParams.get('tab') as ArchiveTab;
        if (tab && VALID_TABS.includes(tab)) {
            setActiveTab(tab);
            setVisitedTabs(prev => {
                if (prev.has(tab)) return prev;
                const next = new Set(prev);
                next.add(tab);
                return next;
            });
        } else if (!tab && isLoaded) {
            const defTab = getDefaultTabForRole(userRole);
            setActiveTab(defTab);
            setVisitedTabs(prev => {
                const next = new Set(prev);
                next.add(defTab);
                return next;
            });
            const params = new URLSearchParams(searchParams.toString());
            params.set('tab', defTab);
            router.replace(`?${params.toString()}`, { scroll: false });
        }
    }, [searchParams, router, isLoaded, userRole, getDefaultTabForRole]);

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        trashCache.forceRefresh(activeTab);
        setTimeout(() => {
            setIsRefreshing(false);
        }, 600);
    }, [activeTab]);

    // tab config
    const tabs = [
        { key: 'documents' as const, label: 'Documents', icon: 'fa-file-alt', restricted: !canAccessDocuments },
        { key: 'purchase_orders' as const, label: 'Purchase Orders', icon: 'fa-file-invoice', restricted: !canAccessPurchaseOrders },
        { key: 'suppliers' as const, label: 'Suppliers', icon: 'fa-handshake', restricted: !canAccessSuppliers },
        { key: 'parcels' as const, label: 'Parcels', icon: 'fa-boxes', restricted: !canAccessParcels },
    ];

    return (
        <SessionGuard requiredRole={['Admin', 'Manager', 'Employee', 'Executive', 'Operator']}>
            <div className="p-6 space-y-6 animate-in fade-in duration-300 bgCard">
                {/* header */}
                <div className="flex items-center justify-between gap-4 flex-wrap border-b border-slate-200/80 dark:border-slate-800 pb-5">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-[#ffe6f0] border border-pink-300/90 dark:bg-[#341427] dark:border-[#67224c] flex items-center justify-center text-pink-600 dark:text-pink-300 text-xl shadow-[inset_0_1px_0_#ffffff,0_2px_6px_rgba(244,63,94,0.14)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_6px_rgba(0,0,0,0.6)] shrink-0">
                            <i className="fa-solid fa-trash-can-arrow-up"></i>
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                                Trash Management
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                View, restore, or permanently remove deleted records
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <AppButton
                            variant="neutral"
                            size="sm"
                            pill
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="cursor-pointer"
                        >
                            <i className={`fas fa-rotate text-xs mr-1.5 ${isRefreshing ? 'fa-spin text-pink-500' : 'text-slate-500 dark:text-slate-400'}`}></i>
                            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                        </AppButton>
                    </div>
                </div>

                {/* 10-day auto-purge retention notice banner */}
                <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-300/40 dark:border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 shadow-sm">
                    <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/30 dark:border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                            <i className="fa-solid fa-clock-rotate-left text-sm" />
                        </span>
                        <div>
                            <p className="font-bold text-slate-900 dark:text-white">
                                10-Day Auto-Purge Policy Active
                            </p>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300">
                                Archived items in trash are automatically and permanently deleted 10 days after deletion.
                            </p>
                        </div>
                    </div>
                    <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-[11px] font-bold border border-amber-300/80 dark:border-amber-700/60 shrink-0">
                        <i className="fa-solid fa-clock text-[10px]" />
                        Auto-deletes after 10 days
                    </span>
                </div>

                {/* tabs */}
                <div className="w-full max-w-full overflow-x-auto pb-1 scroll-smooth touch-pan-x">
                    <div className="inline-flex items-center gap-1.5 bg-[#ebf0f7]/95 dark:bg-[#14151c]/95 p-1.5 rounded-full border border-slate-200/50 dark:border-slate-800/60 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.4),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] min-w-max">
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => updateTab(tab.key)}
                                    className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer active:scale-95 ${
                                        isActive
                                            ? 'bg-gradient-to-b from-pink-500 to-pink-600 text-white border border-pink-400/80 dark:border-pink-500/80 shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)] font-bold'
                                            : 'bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-700 dark:text-slate-200 border border-white/70 dark:border-[#2a2b38] hover:bg-[#e8edf5] dark:hover:bg-[#232533] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)]'
                                    }`}
                                >
                                    <i
                                        className={`fas ${tab.icon} text-xs transition-colors duration-200 ${
                                            isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'
                                        }`}
                                    ></i>
                                    <span>{tab.label}</span>
                                    {tab.restricted && isLoaded && (
                                        <i className={`fas fa-lock text-[10px] ${isActive ? 'text-white/80' : 'text-pink-500/80 dark:text-pink-400/80'}`} title="Restricted access" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* content with keep-alive and smooth fade-in */}
                <div className="relative min-h-[400px]">
                    {visitedTabs.has('documents') && (
                        <div className={activeTab === 'documents' ? 'block animate-in fade-in-50 duration-200' : 'hidden'}>
                            {isLoaded && !canAccessDocuments ? (
                                <UnauthorizedEmptyState
                                    title="Documents Trash Restricted"
                                    description="You do not have permission to view or manage deleted documents. This section is restricted to Admin, Manager, Executive, and Employee personnel only."
                                    currentRole={userRole}
                                    requiredRoles={['Admin', 'Manager', 'Executive', 'Employee']}
                                />
                            ) : (
                                <DocumentsTab />
                            )}
                        </div>
                    )}
                    {visitedTabs.has('purchase_orders') && (
                        <div className={activeTab === 'purchase_orders' ? 'block animate-in fade-in-50 duration-200' : 'hidden'}>
                            {isLoaded && !canAccessPurchaseOrders ? (
                                <UnauthorizedEmptyState
                                    title="Purchase Orders Trash Restricted"
                                    description="You do not have permission to view or manage deleted purchase orders. This section is restricted to Admin, Manager, and Executive personnel only."
                                    currentRole={userRole}
                                    requiredRoles={['Admin', 'Manager', 'Executive']}
                                />
                            ) : (
                                <PurchaseOrdersTab />
                            )}
                        </div>
                    )}
                    {visitedTabs.has('suppliers') && (
                        <div className={activeTab === 'suppliers' ? 'block animate-in fade-in-50 duration-200' : 'hidden'}>
                            {isLoaded && !canAccessSuppliers ? (
                                <UnauthorizedEmptyState
                                    title="Suppliers Trash Restricted"
                                    description="You do not have permission to view or manage deleted suppliers. This section is restricted to Admin, Manager, and Executive personnel only."
                                    currentRole={userRole}
                                    requiredRoles={['Admin', 'Manager', 'Executive']}
                                />
                            ) : (
                                <SuppliersTab />
                            )}
                        </div>
                    )}
                    {visitedTabs.has('parcels') && (
                        <div className={activeTab === 'parcels' ? 'block animate-in fade-in-50 duration-200' : 'hidden'}>
                            {isLoaded && !canAccessParcels ? (
                                <UnauthorizedEmptyState
                                    title="Parcels Trash Restricted"
                                    description="You do not have permission to view or manage deleted parcels. This section is restricted to Admin, Manager, Executive, and Operator personnel only."
                                    currentRole={userRole}
                                    requiredRoles={['Admin', 'Manager', 'Executive', 'Operator']}
                                />
                            ) : (
                                <ParcelsTab />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </SessionGuard>
    );
}