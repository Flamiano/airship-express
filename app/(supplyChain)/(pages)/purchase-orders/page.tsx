// app/(supplyChain)/(pages)/purchase-orders/page.tsx
"use client";
// imports
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Chart from "chart.js/auto";
import { supabase } from "@/app/(supplyChain)/lib/services/client/supabase";
import { toast } from "sonner";
import { useDebounce } from "@/app/(supplyChain)/hooks/useDebounce";
import { useConfirm } from "@/app/(supplyChain)/components/ui/ConfirmModal";
import { CardsSkeleton, ChartSkeleton, TableSkeleton } from "@/app/(supplyChain)/components/ui/SkeletonLoader";
import { Pagination } from "@/app/(supplyChain)/components/global/pagination";
import { SessionGuard } from "@/app/(supplyChain)/components/server/SessionGuard";
import { TableContentLoader } from "@/app/(supplyChain)/components/global/Loader";
import Cards from "@/app/(supplyChain)/components/global/Cards";
import dynamic from "next/dynamic";
import { createPurchaseRequest } from "@/app/(supplyChain)/(pages)/procurement/utils/procurementApi";
import AiQuestions from "@/app/(supplyChain)/components/global/AiQuestions";
import { user } from "@/app/(supplyChain)/lib/services/Class/user";
import { buildEmailTemplate } from "@/app/(supplyChain)/(pages)/procurement/api/send-email/template";
import {
    VerificationJob,
    ReceiptQueueItem,
    getPoRateLimit,
    setPoRateLimit,
    clearPoRateLimit,
    MAX_MISMATCH_ATTEMPTS,
} from "@/app/(supplyChain)/components/modals/UploadReceiptModal";
import { uploadReceiptAndVerifyAction } from "@/app/(supplyChain)/(pages)/purchase-orders/server/actions/ocr-verify";
import { ReceiptProcessingIndicator } from "@/app/(supplyChain)/components/global/ReceiptProcessingIndicator";
import { CrudActionButton } from "@/app/(supplyChain)/components/ui/CrudActionButton";
import { AppButton } from "@/app/(supplyChain)/components/ui/AppButton";
import { FileText, MoreHorizontal, Receipt } from "lucide-react";
import type { ViewDocumentData } from "@/app/(supplyChain)/components/modals/DocumentViewerModal";
import { StatusBadge, getPOStatusTone } from "@/app/(supplyChain)/components/ui/StatusBadge";
import Portal from "@/app/(supplyChain)/components/client/Portal";

// dynamic modal imports to reduce initial bundle size
const PurchaseOrderModal = dynamic(
    () => import("@/app/(supplyChain)/components/modals/PurchaseOrderModal").then(m => m.PurchaseOrderModal),
    { ssr: false }
);
const ApprovedRequestsModal = dynamic(
    () => import("@/app/(supplyChain)/components/modals/ApprovedRequestsModal").then(m => m.ApprovedRequestsModal),
    { ssr: false }
);
const PurchaseRequestModal = dynamic(
    () => import("@/app/(supplyChain)/components/modals/PurchaseRequestModal").then(m => m.PurchaseRequestModal),
    { ssr: false }
);
const ChartDetailModal = dynamic(
    () => import("@/app/(supplyChain)/components/modals/ChartDetailModal").then(m => m.ChartDetailModal),
    { ssr: false }
);
const DocumentViewerModal = dynamic(
    () => import("@/app/(supplyChain)/components/modals/DocumentViewerModal"),
    { ssr: false }
);
const UploadReceiptModal = dynamic(
    () => import("@/app/(supplyChain)/components/modals/UploadReceiptModal").then(m => m.UploadReceiptModal),
    { ssr: false }
);
const DigitalReceiptModal = dynamic(
    () => import("@/app/(supplyChain)/components/modals/DigitalReceiptModal").then(m => m.DigitalReceiptModal),
    { ssr: false }
);
// types
interface PurchaseOrder {
    id: string;
    po_number: string;
    request_id: string;
    supplier_id: string;
    supplier_name: string;
    total_amount: number;
    status: string;
    delivery_date: string;
    notes: string;
    items: any[];
    paid: boolean;
    created_at?: string;
    updated_at?: string;
    verification?: {
        id: string;
        purchase_order_id: string;
        match_result: 'pending' | 'matched' | 'mismatched' | 'forced';
        uploaded_file_url?: string;
        compared_fields?: any;
        extracted_json?: any;
        created_at: string;
    } | null;
    document?: {
        id: string;
        title: string;
        file_name: string;
        storage_path: string;
        file_type: string;
        notes?: string;
        uploaded_by?: string;
    } | null;
}
interface Supplier {
    id: string;
    name: string;
    category: string;
    contact_person: string;
    phone: string;
    email: string;
    location: string;
    products: string | null;
    notes: string | null;
    is_active: boolean;
}
// utilities
const formatCurrency = (amount: number) => `₱${amount.toLocaleString()}`;
// empty state
function EmptyState({ title, description, icon = "fas fa-file-invoice", actionText, onAction, onClearSearch, isFilterActive = false, badgeCount }: {
    title?: string;
    description?: string;
    icon?: string;
    actionText?: string;
    onAction?: () => void;
    onClearSearch?: () => void;
    isFilterActive?: boolean;
    badgeCount?: number;
}) {
    const displayTitle = title || (isFilterActive ? "No Purchase Orders Found" : "No Purchase Orders Yet");
    const displayDescription = description || (isFilterActive
        ? "Try adjusting your search terms or filter criteria to find what you're looking for."
        : "Create purchase requests or generate purchase orders to start managing your procurement.");
    return (<div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 rounded-3xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] flex items-center justify-center mb-3.5 text-pink-500 dark:text-pink-400 transition-transform duration-300 hover:scale-105">
            <i className={`${icon} text-2xl`} />
        </div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
            {displayTitle}
        </h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mb-5 leading-relaxed">
            {displayDescription}
        </p>
        <div className="flex items-center gap-3">
            {actionText && onAction && (<button onClick={onAction} className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-b from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 border border-pink-400/80 shadow-[0_3px_10px_rgba(236,72,153,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)] rounded-2xl transition-all flex items-center gap-2 cursor-pointer active:scale-95">
                <i className="fas fa-plus text-[10px]" />
                <span>{actionText}</span>
                {typeof badgeCount === 'number' && badgeCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black text-pink-700 dark:text-pink-300 bg-white dark:bg-[#181924] border border-pink-200 dark:border-pink-800/80 rounded-full shadow-xs animate-pulse">
                        {badgeCount}
                    </span>
                )}
            </button>)}
            {isFilterActive && onClearSearch && (<button onClick={onClearSearch} className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-[#f0f3f8] dark:bg-[#1d1e28] hover:bg-white dark:hover:bg-slate-800 border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] rounded-2xl transition-all cursor-pointer active:scale-95">
                Clear Filters
            </button>)}
        </div>
    </div>);
}
// component
export default function PurchaseOrders() {
    const searchParams = useSearchParams();
    const { confirm } = useConfirm();
    const poChartRef = useRef<HTMLCanvasElement>(null);
    const poChartInstance = useRef<Chart | null>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const hasLoadedOnceRef = useRef(false);
    const [pendingRowId, setPendingRowId] = useState<string | null>(null);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [allOrders, setAllOrders] = useState<PurchaseOrder[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const initialSearch = searchParams?.get('search') || "";
    const initialStatus = searchParams?.get('status') || "all";
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const debouncedSearch = useDebounce(searchTerm, 300);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);
    const [totalItems, setTotalItems] = useState(0);
    const [activeStatusFilter, setActiveStatusFilter] = useState<string>(initialStatus);
    const [isPurchaseOrderModalOpen, setIsPurchaseOrderModalOpen] = useState(false);
    const [isApprovedRequestsModalOpen, setIsApprovedRequestsModalOpen] = useState(false);
    const [isPurchaseRequestModalOpen, setIsPurchaseRequestModalOpen] = useState(false);
    const [selectedRequestForPO, setSelectedRequestForPO] = useState<any>(null);
    const [approvedRequestsCount, setApprovedRequestsCount] = useState<number>(0);
    const [digitalReceiptPO, setDigitalReceiptPO] = useState<any | null>(null);
    const [isDigitalReceiptModalOpen, setIsDigitalReceiptModalOpen] = useState(false);

    const fetchApprovedRequestsCount = useCallback(async () => {
        try {
            const { data: requestsData, error: reqError } = await supabase
                .from('purchase_requests')
                .select('id')
                .in('status', ['Approved', 'Completed']);

            if (reqError) throw reqError;

            const { data: poData, error: poError } = await supabase
                .from('purchase_orders')
                .select('request_id');

            if (poError) throw poError;

            const existingPoRequestIds = new Set((poData || []).map((po: any) => po.request_id));
            const available = (requestsData || []).filter((req: any) => !existingPoRequestIds.has(req.id));
            setApprovedRequestsCount(available.length);
        } catch (err) {
            console.error('Error fetching approved requests count:', err);
        }
    }, []);

    // bulk actions
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isSelectAll, setIsSelectAll] = useState(false);
    // action modal
    const [actionModalOrder, setActionModalOrder] = useState<PurchaseOrder | null>(null);
    const [actionEmailMode, setActionEmailMode] = useState<'standard' | 'ai'>('standard');
    const [actionModalAiMessage, setActionModalAiMessage] = useState('');
    const [isGeneratingActionAI, setIsGeneratingActionAI] = useState(false);
    const [actionSupplierEmail, setActionSupplierEmail] = useState('');
    const [isSendingActionComm, setIsSendingActionComm] = useState(false);
    // ocr states
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [receiptModalPO, setReceiptModalPO] = useState<PurchaseOrder | null>(null);
    const [receiptVerificationId, setReceiptVerificationId] = useState<string | null>(null);
    const [activeVerificationJob, setActiveVerificationJob] = useState<VerificationJob | null>(null);
    const [viewingDocData, setViewingDocData] = useState<ViewDocumentData | null>(null);
    const [isDocViewerOpen, setIsDocViewerOpen] = useState(false);
    // tracking POs currently being verified for receipt matching
    const [verifyingPoIds, setVerifyingPoIds] = useState<Set<string>>(new Set());
    // OCR Verification Queue
    const [receiptQueue, setReceiptQueue] = useState<ReceiptQueueItem[]>([]);
    const isProcessingQueueRef = useRef(false);

    const handleStartVerification = useCallback((poId: string) => {
        setVerifyingPoIds((prev) => {
            const next = new Set(prev);
            next.add(poId);
            return next;
        });
    }, []);

    const handleEndVerification = useCallback((poId: string) => {
        setVerifyingPoIds((prev) => {
            const next = new Set(prev);
            next.delete(poId);
            return next;
        });
    }, []);

    const handleEnqueueVerification = useCallback(({ po, file, base64Data }: { po: any; file: File; base64Data: string }) => {
        const newItem: ReceiptQueueItem = {
            id: `queue_${po.id}_${Date.now()}`,
            poId: po.id,
            poNumber: po.po_number,
            supplierName: po.supplier_name,
            totalAmount: po.total_amount,
            file,
            fileName: file.name,
            fileBase64: base64Data,
            fileType: file.type,
            fileSize: file.size,
            status: 'queued',
            addedAt: Date.now(),
        };

        setReceiptQueue(prev => [...prev, newItem]);
        setVerifyingPoIds(prev => new Set(prev).add(po.id));

        const pendingCount = receiptQueue.filter(q => q.status === 'queued' || q.status === 'processing').length;
        if (pendingCount > 0) {
            toast.info(`Receipt for PO #${po.po_number} added to queue (${pendingCount + 1} waiting). You can upload other receipts!`);
        } else {
            toast.success(`Receipt for PO #${po.po_number} added to queue and started processing!`);
        }
    }, [receiptQueue]);

    const handleOpenQueueItem = useCallback((poId?: string) => {
        if (!poId) return;
        const target = purchaseOrders.find(p => p.id === poId) || allOrders.find(p => p.id === poId);
        if (!target) return;

        const queueItem = receiptQueue.find(q => q.poId === poId);
        if (queueItem?.status === 'matched' || target.paid || target.verification?.match_result === 'matched') {
            setViewingDocData({
                id: target.document?.id || target.verification?.id || queueItem?.verificationId,
                title: target.document?.title || `Receipt - PO #${target.po_number}`,
                fileName: target.document?.file_name || queueItem?.fileName || `receipt_${target.po_number}.png`,
                fileUrl: target.verification?.uploaded_file_url,
                storagePath: target.document?.storage_path,
                fileType: target.document?.file_type,
                poNumber: target.po_number,
                supplierName: target.supplier_name,
                verifiedStatus: 'matched',
                totalAmount: target.total_amount,
                notes: target.document?.notes || 'Verified via Gemini OCR (Matched)',
                uploadedBy: target.document?.uploaded_by,
            });
            setIsDocViewerOpen(true);
        } else {
            setReceiptModalPO(target);
            setReceiptVerificationId(target.verification?.id || queueItem?.verificationId || null);
            setIsReceiptModalOpen(true);
        }
    }, [purchaseOrders, allOrders, receiptQueue]);
    const ACTIVE_OCR_STORAGE_KEY = 'supplychain_active_verification_job';
    // load job
    useEffect(() => {
        try {
            const saved = localStorage.getItem(ACTIVE_OCR_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                setActiveVerificationJob(parsed);
            }
        }
        catch (e) {
            console.error('Failed to load saved verification job', e);
        }
    }, []);
    const updateActiveVerificationJob = useCallback((job: VerificationJob | null) => {
        setActiveVerificationJob(job);
        try {
            if (job) {
                localStorage.setItem(ACTIVE_OCR_STORAGE_KEY, JSON.stringify(job));
            }
            else {
                localStorage.removeItem(ACTIVE_OCR_STORAGE_KEY);
            }
        }
        catch (e) {
            console.error('Failed to persist verification job', e);
        }
    }, []);
    const handledDeepLinkRef = useRef<string | null>(null);
    // deep linking
    useEffect(() => {
        const poParam = searchParams.get('po_id');
        const verificationParam = searchParams.get('verification');
        if (!poParam && !verificationParam)
            return;
        const deepLinkKey = `${poParam || ''}_${verificationParam || ''}`;
        if (handledDeepLinkRef.current === deepLinkKey)
            return;
        const combinedList = [...purchaseOrders, ...allOrders];
        if (combinedList.length === 0)
            return;
        handledDeepLinkRef.current = deepLinkKey;
        if (poParam) {
            const target = combinedList.find(p => p.id === poParam);
            if (target) {
                // handle verified status
                if (target.verification?.match_result === 'matched' ||
                    target.verification?.match_result === 'forced' ||
                    target.paid ||
                    target.document) {
                    setViewingDocData({
                        id: target.document?.id || target.verification?.id,
                        title: target.document?.title || `Receipt - PO #${target.po_number}`,
                        fileName: target.document?.file_name || `receipt_${target.po_number}.png`,
                        fileUrl: target.verification?.uploaded_file_url,
                        storagePath: target.document?.storage_path,
                        fileType: target.document?.file_type,
                        poNumber: target.po_number,
                        supplierName: target.supplier_name,
                        verifiedStatus: target.verification?.match_result || (target.paid ? 'matched' : null),
                        totalAmount: target.total_amount,
                        notes: target.document?.notes || (target.verification?.match_result === 'matched' ? 'OCR Verified Matched' : undefined),
                        uploadedBy: target.document?.uploaded_by,
                    });
                    setIsDocViewerOpen(true);
                }
                else if (target.verification?.match_result === 'mismatched' || verificationParam) {
                    // mismatch modal
                    setReceiptModalPO(target);
                    setReceiptVerificationId(target.verification?.id || verificationParam || null);
                    setIsReceiptModalOpen(true);
                }
                else {
                    // upload required
                    setReceiptModalPO(target);
                    setReceiptVerificationId(null);
                    setIsReceiptModalOpen(true);
                }
            }
        }
        else if (verificationParam) {
            setReceiptVerificationId(verificationParam);
            const target = combinedList.find(p => p.verification?.id === verificationParam) || combinedList[0];
            if (target) {
                setReceiptModalPO(target);
            }
            setIsReceiptModalOpen(true);
        }
    }, [searchParams, purchaseOrders, allOrders]);
    // fetch supplier and load cached AI message
    useEffect(() => {
        if (actionModalOrder) {
            const cacheKey = `po_ai_compose_${actionModalOrder.id || actionModalOrder.po_number}`;
            const cachedAi = typeof window !== 'undefined' ? localStorage.getItem(cacheKey) : null;
            if (cachedAi) {
                setActionModalAiMessage(cachedAi);
                setActionEmailMode('ai');
            } else {
                setActionModalAiMessage('');
                setActionEmailMode('standard');
            }
            setActionSupplierEmail('');
            const fetchSupplierDetails = async () => {
                try {
                    let supplierId = actionModalOrder.supplier_id;
                    if (!supplierId && actionModalOrder.supplier_name) {
                        const { data } = await supabase
                            .from('suppliers')
                            .select('id, email')
                            .eq('name', actionModalOrder.supplier_name)
                            .maybeSingle();
                        if (data) {
                            setActionSupplierEmail(data.email || '');
                        }
                        return;
                    }
                    if (supplierId) {
                        const { data, error } = await supabase
                            .from('suppliers')
                            .select('email')
                            .eq('id', supplierId)
                            .maybeSingle();
                        if (!error && data) {
                            setActionSupplierEmail(data.email || '');
                        }
                    }
                }
                catch (err) {
                    console.error('Error fetching supplier details for action modal:', err);
                }
            };
            fetchSupplierDetails();
        }
    }, [actionModalOrder]);
    const [chartDetailModal, setChartDetailModal] = useState<{
        isOpen: boolean;
        month: string;
        monthIndex: number;
        orders: PurchaseOrder[];
        totalAmount: number;
    }>({
        isOpen: false,
        month: '',
        monthIndex: -1,
        orders: [],
        totalAmount: 0,
    });
    const currentUserRole = user.getRole();
    const rawRole = (currentUserRole || '').toLowerCase().trim();
    const isAdmin = ['admin', 'super_admin', 'superadmin'].includes(rawRole);
    const canUpdateStatus = ['admin', 'super_admin', 'superadmin', 'manager', 'executive'].includes(rawRole);
    const userRole = currentUserRole;
    const scrollToTable = useCallback(() => {
        if (tableContainerRef.current) {
            const targetElement = document.getElementById(tableContainerRef.current.id);
            if (targetElement) {
                const offset = 80;
                const elementPosition = targetElement.getBoundingClientRect().top;
                window.scrollTo({
                    top: elementPosition + window.pageYOffset - offset,
                    behavior: 'smooth'
                });
            }
        }
    }, []);
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setItemsPerPage(10);
            }
            else {
                setItemsPerPage(15);
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const fetchDataRef = useRef<(opts?: { silent?: boolean; refreshAll?: boolean }) => Promise<void>>(() => Promise.resolve());

    // 1. Fetch overview data: all orders (for top cards & chart) + suppliers
    const fetchOverviewData = useCallback(async (opts?: { silent?: boolean }) => {
        try {
            // fetch lightweight stats dataset without loading heavy all-documents payload
            const { data: allOrdersData, error: allOrdersError } = await supabase
                .from('purchase_orders')
                .select('id, po_number, status, total_amount, paid, created_at')
                .order('created_at', { ascending: false });

            if (!allOrdersError && allOrdersData) {
                let enrichedAll = allOrdersData as PurchaseOrder[];
                if (enrichedAll.length > 0) {
                    try {
                        const allIds = enrichedAll.map(o => o.id);
                        // Only fetch verifications with matched/forced to verify paid state for stats
                        const { data: allVerifs } = await supabase
                            .from('document_verifications')
                            .select('id, purchase_order_id, match_result')
                            .in('purchase_order_id', allIds)
                            .in('match_result', ['matched', 'forced']);

                        const allVerifMap: Record<string, any> = {};
                        (allVerifs || []).forEach((v: any) => {
                            if (!allVerifMap[v.purchase_order_id]) {
                                allVerifMap[v.purchase_order_id] = v;
                            }
                        });

                        enrichedAll = enrichedAll.map(o => {
                            const v = allVerifMap[o.id] || null;
                            const isPaid = o.paid === true || v?.match_result === 'matched' || v?.match_result === 'forced';
                            return {
                                ...o,
                                paid: isPaid,
                                verification: v,
                            };
                        });
                    }
                    catch (e) {
                        console.warn('Could not enrich allOrders with verification data:', e);
                    }
                }
                setAllOrders(enrichedAll);

                // auto-sync job
                try {
                    const saved = localStorage.getItem(ACTIVE_OCR_STORAGE_KEY);
                    if (saved) {
                        const parsed: VerificationJob = JSON.parse(saved);
                        if (parsed && parsed.status === 'processing') {
                            const matchedPO = enrichedAll.find(o => o.id === parsed.poId);
                            if (matchedPO) {
                                if (matchedPO.verification?.match_result === 'matched' || matchedPO.paid) {
                                    updateActiveVerificationJob({
                                        ...parsed,
                                        status: 'matched',
                                        verificationId: matchedPO.verification?.id || parsed.verificationId,
                                    });
                                }
                                else if (matchedPO.verification?.match_result === 'mismatched') {
                                    updateActiveVerificationJob({
                                        ...parsed,
                                        status: 'mismatched',
                                        verificationId: matchedPO.verification?.id || parsed.verificationId,
                                    });
                                }
                                else if (matchedPO.verification?.match_result === 'forced') {
                                    updateActiveVerificationJob({
                                        ...parsed,
                                        status: 'forced',
                                        verificationId: matchedPO.verification?.id || parsed.verificationId,
                                    });
                                }
                                else if (parsed.timestamp && Date.now() - parsed.timestamp > 3 * 60 * 1000) {
                                    updateActiveVerificationJob(null);
                                }
                            }
                        }
                    }
                }
                catch (syncErr) {
                    console.error('Error syncing active verification job:', syncErr);
                }
            }

            // fetch active suppliers
            const { data: suppliersData, error: suppliersError } = await supabase
                .from('suppliers')
                .select('*')
                .eq('is_active', true)
                .order('name');
            if (!suppliersError && suppliersData) {
                setSuppliers(suppliersData);
            }

            // fetch available approved requests count for the button badge
            await fetchApprovedRequestsCount();
        } catch (err) {
            console.error('Error fetching overview data:', err);
        }
    }, [fetchApprovedRequestsCount]);

    // 2. Fetch paginated table data (only 15 rows for current view)
    const fetchPaginatedOrders = useCallback(async (opts?: { silent?: boolean }) => {
        const silent = opts?.silent ?? false;
        try {
            if (!silent && !hasLoadedOnceRef.current) {
                setLoading(true);
            }
            else if (!silent) {
                setIsRefreshing(true);
            }

            let query = supabase
                .from('purchase_orders')
                .select('*', { count: 'exact' });

            if (activeStatusFilter !== 'all') {
                query = query.eq('status', activeStatusFilter);
            }

            if (debouncedSearch) {
                query = query.or(`po_number.ilike.%${debouncedSearch}%,supplier_name.ilike.%${debouncedSearch}%`);
            }

            const from = (currentPage - 1) * itemsPerPage;
            const to = from + itemsPerPage - 1;

            const { data: orders, count: totalCount, error: ordersError } = await query
                .range(from, to)
                .order('created_at', { ascending: false });

            if (ordersError) {
                if (ordersError.code === 'PGRST103') {
                    setPurchaseOrders([]);
                    setTotalItems(0);
                } else {
                    throw ordersError;
                }
            } else {
                let enrichedOrders = orders || [];
                if (enrichedOrders.length > 0) {
                    try {
                        const orderIds = enrichedOrders.map(o => o.id);
                        const { data: verifs } = await supabase
                            .from('document_verifications')
                            .select('id, purchase_order_id, match_result, uploaded_file_url, compared_fields, extracted_json, created_at')
                            .in('purchase_order_id', orderIds)
                            .order('created_at', { ascending: false });

                        const verifMap: Record<string, any> = {};
                        (verifs || []).forEach((v: any) => {
                            if (!verifMap[v.purchase_order_id]) {
                                verifMap[v.purchase_order_id] = v;
                            }
                        });

                        const { data: linkedDocs } = await supabase
                            .from('documents')
                            .select('id, title, file_name, storage_path, file_type, notes, uploaded_by, purchase_id')
                            .in('purchase_id', orderIds)
                            .order('created_at', { ascending: false });

                        const docMap: Record<string, any> = {};
                        (linkedDocs || []).forEach((d: any) => {
                            if (d.purchase_id && !docMap[d.purchase_id]) {
                                docMap[d.purchase_id] = d;
                            }
                        });

                        enrichedOrders = enrichedOrders.map(o => {
                            const v = verifMap[o.id] || null;
                            const isPaid = o.paid === true || v?.match_result === 'matched' || v?.match_result === 'forced';
                            return {
                                ...o,
                                paid: isPaid,
                                verification: v,
                                document: docMap[o.id] || null,
                            };
                        });
                    } catch (vErr) {
                        console.warn('Could not load verifications or documents for orders:', vErr);
                    }
                }
                setPurchaseOrders(enrichedOrders);
                setTotalItems(totalCount || 0);
            }
        } catch (error) {
            console.error('Error fetching paginated purchase orders:', error);
            toast.error('Failed to load purchase orders');
        } finally {
            hasLoadedOnceRef.current = true;
            if (!silent) {
                setLoading(false);
                setIsRefreshing(false);
            }
        }
    }, [currentPage, itemsPerPage, debouncedSearch, activeStatusFilter]);

    // Combined fetch
    const fetchData = useCallback(async (opts?: { silent?: boolean; refreshAll?: boolean }) => {
        await Promise.all([
            fetchPaginatedOrders(opts),
            fetchOverviewData(opts),
        ]);
    }, [fetchPaginatedOrders, fetchOverviewData]);

    fetchDataRef.current = fetchData;

    // Fetch paginated table whenever pagination, search, or status filter changes
    useEffect(() => {
        fetchPaginatedOrders();
    }, [fetchPaginatedOrders]);

    // Fetch overview statistics and suppliers once on mount
    useEffect(() => {
        fetchOverviewData();
    }, [fetchOverviewData]);

    // Stable realtime subscription: listens to changes on purchase_orders and purchase_requests in realtime
    useEffect(() => {
        fetchApprovedRequestsCount();
        const realtimeChannel = supabase
            .channel('purchase_orders_realtime_channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () => {
                fetchDataRef.current({ silent: true, refreshAll: true });
                fetchApprovedRequestsCount();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_requests' }, () => {
                fetchApprovedRequestsCount();
            })
            .subscribe();
        return () => {
            realtimeChannel.unsubscribe();
        };
    }, [fetchApprovedRequestsCount]);

    // Receipt OCR background queue processor
    useEffect(() => {
        const processQueue = async () => {
            if (isProcessingQueueRef.current) return;

            const nextItem = receiptQueue.find(item => item.status === 'queued');
            if (!nextItem) return;

            isProcessingQueueRef.current = true;

            // Mark item as processing
            setReceiptQueue(prev => prev.map(item => item.id === nextItem.id ? { ...item, status: 'processing' } : item));
            setVerifyingPoIds(prev => new Set(prev).add(nextItem.poId));

            try {
                const res = await uploadReceiptAndVerifyAction({
                    po_id: nextItem.poId,
                    fileBase64: nextItem.fileBase64,
                    fileName: nextItem.fileName,
                    fileType: nextItem.fileType,
                    fileSize: nextItem.fileSize,
                    userId: user.getUserId() || undefined,
                    userRole: user.getRole(),
                    userName: user.getName() || 'Procurement Officer',
                    userEmail: user.getEmail() || 'procurement@airshipexpress.com',
                });

                if (res.success) {
                    const matchResult = res.matchResult as 'matched' | 'mismatched';
                    setReceiptQueue(prev => prev.map(item => item.id === nextItem.id ? {
                        ...item,
                        status: matchResult,
                        verificationId: res.verificationId,
                        comparedFields: res.comparedFields,
                        extractedJson: res.extractedJson,
                    } : item));

                    if (matchResult === 'matched') {
                        clearPoRateLimit(nextItem.poId);
                        toast.success(`PO #${nextItem.poNumber}: Receipt matched! Saved to Documents & marked Paid.`);
                    } else {
                        const rate = getPoRateLimit(nextItem.poId);
                        const newCount = (rate.count || 0) + 1;
                        if (newCount >= MAX_MISMATCH_ATTEMPTS) {
                            setPoRateLimit(nextItem.poId, { count: newCount, lockedUntil: Date.now() + 120_000 });
                            toast.error(`PO #${nextItem.poNumber}: 3 mismatches reached. Upload locked for 2 mins.`);
                        } else {
                            setPoRateLimit(nextItem.poId, { count: newCount, lockedUntil: null });
                            toast.warning(`PO #${nextItem.poNumber}: Receipt mismatch (${newCount}/${MAX_MISMATCH_ATTEMPTS}). Review differences.`);
                        }
                    }
                } else {
                    setReceiptQueue(prev => prev.map(item => item.id === nextItem.id ? {
                        ...item,
                        status: 'error',
                        error: res.error || 'Verification failed',
                    } : item));
                    toast.error(`PO #${nextItem.poNumber}: Verification failed - ${res.error || 'Error'}`);
                }
            } catch (err: any) {
                console.error('Queue execution error:', err);
                setReceiptQueue(prev => prev.map(item => item.id === nextItem.id ? {
                    ...item,
                    status: 'error',
                    error: err?.message || 'Verification error',
                } : item));
                toast.error(`PO #${nextItem.poNumber}: Error - ${err?.message || 'Verification failed'}`);
            } finally {
                setVerifyingPoIds(prev => {
                    const next = new Set(prev);
                    next.delete(nextItem.poId);
                    return next;
                });
                isProcessingQueueRef.current = false;
                fetchDataRef.current({ silent: true, refreshAll: true });
            }
        };

        processQueue();
    }, [receiptQueue]);
    // crud operations
    const handleOrderCreated = useCallback(async (orderData: any) => {
        try {
            if (orderData.request_id) {
                const { error: reqError } = await supabase
                    .from('purchase_requests')
                    .update({ status: "Approved", updated_at: new Date().toISOString() })
                    .eq('id', orderData.request_id);
                if (reqError) {
                    console.warn("Could not update purchase request status:", reqError);
                }
            }

            const sanitizedItems = (orderData.items && orderData.items.length > 0
                ? orderData.items
                : [{
                    name: orderData.notes || "Purchase Order Item",
                    item_name: orderData.notes || "Purchase Order Item",
                    quantity: 1,
                    unit_price: Number(orderData.total_amount) || 0,
                    total: Number(orderData.total_amount) || 0,
                }]
            ).map((item: any) => {
                const itemName = item.item_name || item.name || item.description || "Purchase Order Item";
                const quantity = Math.max(1, Number(item.quantity) || 1);
                const unit_price = Number(item.unit_price ?? item.price ?? 0);
                const total = item.total ? Number(item.total) : Number((quantity * unit_price).toFixed(2));
                return {
                    ...item,
                    name: itemName,
                    item_name: itemName,
                    quantity,
                    unit_price,
                    total,
                };
            });

            const initialStatus = orderData.status || 'Draft';

            const { data: insertedPO, error: orderError } = await supabase
                .from('purchase_orders')
                .insert({
                    po_number: orderData.po_number,
                    request_id: orderData.request_id,
                    supplier_id: orderData.supplier_id,
                    supplier_name: orderData.supplier_name,
                    total_amount: orderData.total_amount,
                    status: initialStatus,
                    delivery_date: orderData.delivery_date,
                    notes: orderData.notes || '',
                    items: sanitizedItems,
                    paid: false,
                })
                .select()
                .single();

            if (orderError) throw orderError;

            const newPoRecord = insertedPO || {
                ...orderData,
                items: sanitizedItems,
                id: Date.now().toString(),
                paid: false,
                status: initialStatus,
                created_at: new Date().toISOString(),
            };

            // Auto-create digital receipt in documents tracking
            try {
                await supabase.from('documents').insert({
                    title: `Digital Receipt - PO #${orderData.po_number}`,
                    file_name: `digital_receipt_${orderData.po_number}.pdf`,
                    file_type: 'receipt',
                    purchase_id: newPoRecord.id,
                    notes: 'Official Digital Receipt generated at PO creation',
                    uploaded_by: user.getName() || 'System',
                });
            } catch (docErr) {
                console.warn('Could not record digital receipt document:', docErr);
            }

            setPurchaseOrders(prev => [newPoRecord, ...prev]);
            setAllOrders(prev => [newPoRecord, ...prev]);
            setTotalItems(prev => prev + 1);
            fetchApprovedRequestsCount();
            toast.success("Purchase Order created successfully!");
            setIsPurchaseOrderModalOpen(false);
            setSelectedRequestForPO(null);

            // Pop up digital printable receipt modal
            setDigitalReceiptPO(newPoRecord);
            setIsDigitalReceiptModalOpen(true);
        }
        catch (error) {
            console.error('Error creating purchase order:', error);
            toast.error('Failed to create purchase order');
        }
    }, [fetchApprovedRequestsCount]);
    const handleRequestSubmitted = async (newRequest: any) => {
        try {
            const createPayload = {
                type: newRequest.type || "New Request",
                description: newRequest.description || "",
                requested_by: newRequest.requested_by,
                department: newRequest.department || "Fleet",
                supplier_id: newRequest.supplier_id,
                supplier_name: newRequest.supplier_name,
                amount: newRequest.amount || 0,
                priority: newRequest.priority || "Normal",
                status: newRequest.status || "Pending",
                date: newRequest.date || new Date().toISOString().split("T")[0],
                items: newRequest.items || [],
                reason: newRequest.reason,
            };
            await createPurchaseRequest(createPayload);
            fetchApprovedRequestsCount();
            toast.success("Purchase request submitted successfully!");
            setIsPurchaseRequestModalOpen(false);
        }
        catch (error) {
            console.error('Error submitting purchase request:', error);
            toast.error('Failed to submit purchase request');
        }
    };
    const handleDeleteOrder = async (id: string) => {
        const confirmed = await confirm({
            title: "Delete Purchase Order",
            message: "Are you sure you want to delete this purchase order? This action cannot be undone.",
            confirmText: "Delete",
            cancelText: "Cancel",
            confirmVariant: "danger",
        });
        if (!confirmed)
            return;
        setPendingRowId(id);
        try {
            const { error } = await supabase
                .from('purchase_orders')
                .delete()
                .eq('id', id);
            if (error)
                throw error;
            setPurchaseOrders(prev => prev.filter(po => po.id !== id));
            setAllOrders(prev => prev.filter(po => po.id !== id));
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            setTotalItems(prev => Math.max(0, prev - 1));
            setActionModalOrder(null);
            toast.success("Purchase order deleted successfully");
        }
        catch (error) {
            console.error('Error deleting purchase order:', error);
            toast.error('Failed to delete purchase order');
        }
        finally {
            setPendingRowId(null);
        }
    };
    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) {
            toast.warning("Please select at least one purchase order to delete");
            return;
        }
        const confirmed = await confirm({
            title: "Delete Selected Purchase Orders",
            message: `Are you sure you want to delete ${selectedIds.size} selected purchase order(s)? This action cannot be undone.`,
            confirmText: `Delete ${selectedIds.size}`,
            cancelText: "Cancel",
            confirmVariant: "danger",
        });
        if (!confirmed)
            return;
        setPendingRowId("bulk");
        try {
            const idsToDelete = Array.from(selectedIds);
            const { error } = await supabase
                .from('purchase_orders')
                .delete()
                .in('id', idsToDelete);
            if (error)
                throw error;
            setPurchaseOrders(prev => prev.filter(po => !selectedIds.has(po.id)));
            setAllOrders(prev => prev.filter(po => !selectedIds.has(po.id)));
            setTotalItems(prev => Math.max(0, prev - idsToDelete.length));
            setSelectedIds(new Set());
            setIsSelectAll(false);
            toast.success(`Successfully deleted ${idsToDelete.length} purchase order(s)`);
        }
        catch (error) {
            console.error('Error deleting purchase orders:', error);
            toast.error('Failed to delete selected purchase orders');
        }
        finally {
            setPendingRowId(null);
        }
    };
    const handleBulkUpdateStatus = async (newStatus: string) => {
        if (!canUpdateStatus) {
            toast.error("Permission denied: Only Managers, Executives, and Admins can update purchase order status.");
            return;
        }
        if (newStatus === 'Confirmed' && !isAdmin) {
            toast.error("Permission denied: Only Administrators can set the 'Confirmed' status of purchase orders.");
            return;
        }
        if (selectedIds.size === 0) {
            toast.warning("Please select at least one purchase order");
            return;
        }
        const confirmed = await confirm({
            title: `Confirm Bulk Status Change`,
            message: `Are you sure you want to change the status of ${selectedIds.size} selected purchase order(s) to "${newStatus}"?`,
            confirmText: `Update to ${newStatus}`,
            cancelText: "Cancel",
            confirmVariant: newStatus === 'Cancelled' ? "danger" : "info",
        });
        if (!confirmed)
            return;
        setPendingRowId("bulk");
        try {
            const idsToUpdate = Array.from(selectedIds);
            const { error } = await supabase
                .from('purchase_orders')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .in('id', idsToUpdate);
            if (error)
                throw error;
            setPurchaseOrders(prev => prev.map(po => selectedIds.has(po.id) ? { ...po, status: newStatus } : po));
            setAllOrders(prev => prev.map(po => selectedIds.has(po.id) ? { ...po, status: newStatus } : po));
            setSelectedIds(new Set());
            setIsSelectAll(false);
            toast.success(`Updated ${idsToUpdate.length} order(s) to ${newStatus}`);
        }
        catch (error) {
            console.error('Error updating purchase orders status in bulk:', error);
            toast.error('Failed to update purchase orders status');
        }
        finally {
            setPendingRowId(null);
        }
    };

    const handleSelectAll = () => {
        if (isSelectAll) {
            setSelectedIds(new Set());
            setIsSelectAll(false);
        }
        else {
            const allIds = filteredOrders.map((o: PurchaseOrder) => o.id);
            setSelectedIds(new Set(allIds));
            setIsSelectAll(true);
        }
    };
    const handleSelectOne = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        }
        else {
            next.add(id);
        }
        setSelectedIds(next);
        setIsSelectAll(filteredOrders.length > 0 && filteredOrders.every((o: PurchaseOrder) => next.has(o.id)));
    };
    const handleUpdateStatus = async (id: string, newStatus: string, options?: {
        skipConfirm?: boolean;
    }) => {
        if (!canUpdateStatus) {
            toast.error("Permission denied: Only Managers, Executives, and Admins can update purchase order status.");
            return;
        }
        const targetOrder = purchaseOrders.find(p => p.id === id) || allOrders.find(p => p.id === id) || (actionModalOrder?.id === id ? actionModalOrder : null);
        const currentStatus = targetOrder?.status || 'Draft';
        if (currentStatus === newStatus)
            return;
        // admin check
        if ((newStatus === 'Confirmed' || currentStatus === 'Confirmed') && !isAdmin) {
            toast.error("Permission denied: Only Administrators can set or modify the 'Confirmed' status of a purchase order.");
            return;
        }
        if (!options?.skipConfirm) {
            const confirmed = await confirm({
                title: `Confirm Status Change`,
                message: `Are you sure you want to change the status of PO #${targetOrder?.po_number || id} from "${currentStatus}" to "${newStatus}"?`,
                confirmText: `Change to ${newStatus}`,
                cancelText: "Cancel",
                confirmVariant: newStatus === 'Cancelled' ? "danger" : "info",
            });
            if (!confirmed)
                return;
        }
        setPendingRowId(id);
        try {
            const { error } = await supabase
                .from('purchase_orders')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', id);
            if (error)
                throw error;
            setPurchaseOrders(prev => prev.map(po => po.id === id ? { ...po, status: newStatus } : po));
            setAllOrders(prev => prev.map(po => po.id === id ? { ...po, status: newStatus } : po));
            if (actionModalOrder && actionModalOrder.id === id) {
                setActionModalOrder(prev => prev ? { ...prev, status: newStatus } : null);
            }
            toast.success(`PO #${targetOrder?.po_number || id} status updated to ${newStatus}`);
        }
        catch (error) {
            console.error('Error updating PO status:', error);
            toast.error('Failed to update PO status');
        }
        finally {
            setPendingRowId(null);
        }
    };
    const handleTogglePaid = async (id: string, currentPaid: boolean, poNumber?: string, status?: string) => {
        if (currentPaid) {
            toast.info(`Purchase order #${poNumber || id} is already paid & verified via receipt.`);
            return;
        }
        if (status === 'Delivered') {
            const target = purchaseOrders.find(p => p.id === id);
            if (target) {
                setReceiptModalPO(target);
                setReceiptVerificationId(null);
                setIsReceiptModalOpen(true);
            }
            else {
                toast.error('Could not find order details');
            }
        }
        else {
            toast.warning(`Cannot verify payment for PO #${poNumber || id} until status is Delivered (currently ${status || 'Draft'}).`);
        }
    };
    const getActionModalFullMessage = () => {
        if (!actionModalOrder) return '';
        const APP_URL = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
        const CONFIRM_PATH = process.env.NEXT_PUBLIC_CONFIRM_PATH || '/procurement/confirm';
        const confirmLink = `${APP_URL}${CONFIRM_PATH}?po=${actionModalOrder.po_number}`;

        if (actionEmailMode === 'ai' && actionModalAiMessage) {
            return `${actionModalAiMessage}\n\n---\n\n📋 **Confirm this order:** ${confirmLink}\n\nPlease click the link above to confirm this purchase order.`;
        }
        return `Hello ${actionModalOrder.supplier_name},\n\nPlease review Purchase Order #${actionModalOrder.po_number} for total of ₱${actionModalOrder.total_amount?.toLocaleString()}.\nConfirm this order: ${confirmLink}`;
    };
    const handleGenerateActionAIMessage = async () => {
        if (!actionModalOrder)
            return;
        setIsGeneratingActionAI(true);
        try {
            const formattedItems = (actionModalOrder.items || []).map((item: any) => ({
                name: item.name || item.item_name || "Item",
                quantity: Number(item.quantity) || 1,
                unit_price: Number(item.unit_price) || 0,
                total: (Number(item.quantity) || 1) * (Number(item.unit_price) || 0),
            }));
            const response = await fetch('/procurement/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    supplier_name: actionModalOrder.supplier_name,
                    items: formattedItems,
                    total_amount: actionModalOrder.total_amount,
                    delivery_date: actionModalOrder.delivery_date,
                    po_number: actionModalOrder.po_number,
                    notes: actionModalOrder.notes,
                    sender_name: user.getName(),
                    sender_position: user.getRole(),
                }),
            });
            const data = await response.json();
            if (data.success) {
                setActionModalAiMessage(data.message);
                setActionEmailMode('ai');
                const cacheKey = `po_ai_compose_${actionModalOrder.id || actionModalOrder.po_number}`;
                if (typeof window !== 'undefined') {
                    localStorage.setItem(cacheKey, data.message);
                }
                toast.success('AI message generated and saved to cache!');
            }
            else {
                toast.error('Failed to generate AI message');
            }
        }
        catch (error) {
            console.error('Error generating AI message for PO:', error);
            toast.error('Failed to generate AI message');
        }
        finally {
            setIsGeneratingActionAI(false);
        }
    };
    const handleActionEmail = async () => {
        if (!actionModalOrder)
            return;
        if (isSendingActionComm)
            return;
        const emailTo = (actionSupplierEmail || '').trim();
        if (!emailTo) {
            toast.warning('No email found for this supplier. Please configure their email first.');
            return;
        }
        const toastId = toast.loading(`Sending email to ${emailTo}...`, {
            duration: Infinity,
            position: 'top-center',
        });
        setIsSendingActionComm(true);
        try {
            const formattedItems = (actionModalOrder.items || []).map((item: any) => ({
                name: item.name || item.item_name || "Item",
                quantity: Number(item.quantity) || 1,
                unit_price: Number(item.unit_price) || 0,
                total: (Number(item.quantity) || 1) * (Number(item.unit_price) || 0),
            }));
            const confirmLink = `${window.location.origin}/procurement/confirm?po=${actionModalOrder.po_number}`;
            const fullMessage = getActionModalFullMessage();

            const activeCustomText = (actionEmailMode === 'ai' && actionModalAiMessage.trim()) ? actionModalAiMessage.trim() : undefined;

            const emailHtml = buildEmailTemplate({
                poNumber: actionModalOrder.po_number,
                supplierName: actionModalOrder.supplier_name,
                items: formattedItems,
                totalAmount: actionModalOrder.total_amount,
                deliveryDate: actionModalOrder.delivery_date || 'TBD',
                notes: actionModalOrder.notes || '',
                confirmLink: confirmLink,
                customBodyText: activeCustomText,
                senderName: user.getName(),
                senderPosition: user.getRole(),
                senderEmail: process.env.EMAIL_SUPPLYCHAIN_USER || '',
            });
            const response = await fetch('/procurement/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: emailTo,
                    subject: `Purchase Order ${actionModalOrder.po_number} - ${actionModalOrder.supplier_name}`,
                    html: emailHtml,
                    text: fullMessage,
                    po_number: actionModalOrder.po_number,
                    supplier_name: actionModalOrder.supplier_name,
                }),
            });
            const data = await response.json();
            if (data.success) {
                // update status
                await handleUpdateStatus(actionModalOrder.id, 'Sent', { skipConfirm: true });
                toast.success(`Email sent to ${emailTo} and status updated to Sent!`, {
                    id: toastId,
                    duration: 6000,
                });
                try {
                    await navigator.clipboard.writeText(fullMessage);
                }
                catch (clipError) {
                    console.warn('Could not copy to clipboard:', clipError);
                }
            }
            else {
                throw new Error(data.error || 'Failed to send email');
            }
        }
        catch (error: any) {
            console.error('Error sending email from manage modal:', error);
            toast.error(error.message || 'Failed to send email. Please try again.', {
                id: toastId,
                duration: 8000,
            });
        }
        finally {
            setIsSendingActionComm(false);
        }
    };
    const handleActionCopyOnly = async () => {
        if (!actionModalAiMessage) {
            toast.warning('Please generate an AI message first');
            return;
        }
        const fullMessage = getActionModalFullMessage();
        try {
            await navigator.clipboard.writeText(fullMessage);
            toast.success('Message copied to clipboard!');
        }
        catch (error) {
            console.error('Failed to copy message:', error);
            toast.error('Failed to copy message');
        }
    };
    // charts
    const datasetOrders = useMemo(() => allOrders.length > 0 ? allOrders : purchaseOrders, [allOrders, purchaseOrders]);
    useEffect(() => {
        if (loading)
            return;
        let isMounted = true;
        let animationFrameId: number;
        const createChart = () => {
            if (!isMounted)
                return;
            const canvas = poChartRef.current;
            if (!canvas)
                return;
            const ctx = canvas.getContext('2d');
            if (!ctx)
                return;
            if (poChartInstance.current) {
                poChartInstance.current.destroy();
                poChartInstance.current = null;
            }
            if (!Chart || datasetOrders.length === 0)
                return;
            const statusData: Record<string, number> = {};
            const statusOrders: Record<string, PurchaseOrder[]> = {
                'Draft': [],
                'Sent': [],
                'Confirmed': [],
                'Delivered': [],
                'Cancelled': []
            };
            datasetOrders.forEach(order => {
                statusData[order.status] = (statusData[order.status] || 0) + 1;
                if (statusOrders[order.status]) {
                    statusOrders[order.status].push(order);
                }
            });
            // init statuses
            const allStatuses = ['Draft', 'Sent', 'Confirmed', 'Delivered', 'Cancelled'];
            allStatuses.forEach(status => {
                if (!statusData[status])
                    statusData[status] = 0;
            });
            const sortedLabels = allStatuses.filter(st => (statusData[st] || 0) > 0 || allStatuses.indexOf(st) < 5);
            const sortedData = sortedLabels.map(label => statusData[label] || 0);
            // color mapping
            const colorMap: Record<string, string> = {
                'Draft': '#64748B', // Slate
                'Sent': '#6366F1', // Indigo
                'Confirmed': '#8B5CF6', // Violet / Purple
                'Delivered': '#EC4899', // Vibrant Pink
                'Cancelled': '#E11D48' // Rose
            };
            const backgroundColor = sortedLabels.map((label: string) => colorMap[label] || '#94A3B8');
            poChartInstance.current = new Chart(ctx, {
                type: "doughnut",
                data: {
                    labels: sortedLabels,
                    datasets: [{
                        data: sortedData,
                        backgroundColor: backgroundColor,
                        borderWidth: 2,
                        borderColor: "#ffffff",
                        hoverOffset: 8,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: "65%",
                    plugins: {
                        legend: {
                            position: "right",
                            labels: {
                                boxWidth: 10,
                                boxHeight: 10,
                                usePointStyle: true,
                                font: { size: 10, weight: 500 },
                                padding: 10,
                                color: "#64748b",
                            },
                        },
                        tooltip: {
                            backgroundColor: "#1e293b",
                            titleColor: "#f1f5f9",
                            bodyColor: "#cbd5e1",
                            borderColor: "#334155",
                            borderWidth: 1,
                            padding: 12,
                            cornerRadius: 8,
                            callbacks: {
                                label: function (context: any) {
                                    const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                                    const count = context.parsed;
                                    const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
                                    return ` ${context.label}: ${count} (${percentage}%)`;
                                }
                            }
                        }
                    },
                    onClick: (event: any, elements: any) => {
                        if (elements.length > 0) {
                            const element = elements[0];
                            const statusIndex = element.index;
                            const statusLabel = sortedLabels[statusIndex];
                            const orders = statusOrders[statusLabel] || [];
                            const totalAmount = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
                            if (orders.length > 0) {
                                setChartDetailModal({
                                    isOpen: true,
                                    month: `${statusLabel} Status`,
                                    monthIndex: statusIndex,
                                    orders: orders,
                                    totalAmount: totalAmount,
                                });
                            }
                        }
                    },
                },
            });
        };
        // wait for render
        animationFrameId = requestAnimationFrame(() => {
            setTimeout(createChart, 100);
        });
        return () => {
            isMounted = false;
            cancelAnimationFrame(animationFrameId);
            if (poChartInstance.current) {
                poChartInstance.current.destroy();
                poChartInstance.current = null;
            }
        };
    }, [datasetOrders, loading]);
    // saved/cache filtering
    const filteredOrders = useMemo(() => {
        const query = (debouncedSearch || '').toLowerCase().trim();
        return purchaseOrders.filter((order) => {
            const matchesStatus = activeStatusFilter === 'all' || order.status === activeStatusFilter;
            if (!matchesStatus) return false;
            if (!query) return true;
            return (order.po_number || '').toLowerCase().includes(query) ||
                (order.supplier_name || '').toLowerCase().includes(query);
        });
    }, [purchaseOrders, activeStatusFilter, debouncedSearch]);

    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages && page !== currentPage) {
            setCurrentPage(page);
            setSelectedIds(new Set());
            setIsSelectAll(false);
            setTimeout(scrollToTable, 100);
        }
    };

    // saved/cache stats calculation in a single high-performance pass
    const { totalOrders, pendingConfirmation, inTransit, completed, totalSpend } = useMemo(() => {
        const source = allOrders.length > 0 ? allOrders : purchaseOrders;
        let pending = 0;
        let transit = 0;
        let done = 0;
        let spend = 0;

        for (let i = 0; i < source.length; i++) {
            const o = source[i];
            if (o.status === 'Sent' || o.status === 'Draft') pending++;
            else if (o.status === 'Confirmed') transit++;
            else if (o.status === 'Delivered') done++;

            if (o.paid === true) {
                spend += Number(o.total_amount) || 0;
            }
        }

        return {
            totalOrders: source.length,
            pendingConfirmation: pending,
            inTransit: transit,
            completed: done,
            totalSpend: spend,
        };
    }, [allOrders, purchaseOrders]);
    // create po handler
    const handleOpenApprovedRequests = () => {
        setIsApprovedRequestsModalOpen(true);
    };
    const handleSelectRequestForPO = (req: any) => {
        setSelectedRequestForPO(req);
        setIsApprovedRequestsModalOpen(false);
        setIsPurchaseOrderModalOpen(true);
    };
    return (<SessionGuard requiredRole={['Admin', 'Manager', 'Executive']}>
        <div className="p-6 space-y-6 fade-in bgCard">
            {/* header */}
            <div className="flex items-start justify-between gap-4 flex-wrap border-b border-slate-200/80 dark:border-white/10 pb-5 transition-colors">
                <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[#ffe6f0] border border-pink-300/90 dark:bg-[#341427] dark:border-[#67224c] flex items-center justify-center text-pink-600 dark:text-pink-300 text-xl shadow-[inset_0_1px_0_#ffffff,0_2px_6px_rgba(244,63,94,0.14)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_6px_rgba(0,0,0,0.6)] shrink-0 mt-0.5 transition-colors">
                        <i className="fa-solid fa-file-invoice-dollar" />
                    </div>

                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight transition-colors">
                            Purchase Orders
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 transition-colors">
                            Manage approved purchase orders, supplier orders, and delivery tracking.
                        </p>
                        <div className="inline-flex items-center gap-2 mt-2 px-3.5 py-1.5 rounded-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)] transition-all">
                            <span className="w-2 h-2 rounded-full bg-pink-500 shadow-xs shadow-pink-500/50" />
                            <i className="fas fa-user-tag text-[11px] text-pink-500 dark:text-pink-400" />
                            <span className="font-medium text-slate-500 dark:text-slate-400">Role:</span>
                            <span className="font-bold text-slate-800 dark:text-slate-100 capitalize">
                                {userRole}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                    <AppButton type="button" variant="neutral" size="md" onClick={() => setIsPurchaseRequestModalOpen(true)}>
                        <i className="fas fa-plus text-pink-500 dark:text-pink-400 text-xs" />
                        <span>Make Purchase Request</span>
                    </AppButton>
                    <AppButton type="button" variant="primary" size="md" onClick={handleOpenApprovedRequests}>
                        <i className="fas fa-clipboard-check text-xs" />
                        <span>Create PO from Request</span>
                        {approvedRequestsCount > 0 && (
                            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-black leading-none text-pink-700 dark:text-pink-300 bg-white dark:bg-[#181924] border border-pink-200 dark:border-pink-800/80 rounded-full shadow-xs animate-pulse ml-0.5">
                                {approvedRequestsCount}
                            </span>
                        )}
                    </AppButton>
                </div>
            </div>

            {/* ai questions */}
            <AiQuestions title="AI Suggested Questions" subtitle="Click to ask" questions={[
                {
                    question: "PO summary",
                    color: "bg-pink-500"
                },
                {
                    question: "Top suppliers by spend?",
                    color: "bg-amber-500"
                },
                {
                    question: "Delayed purchase orders?",
                    color: "bg-blue-500"
                },
                {
                    question: "Payment status breakdown?",
                    color: "bg-emerald-500"
                }
            ]} />

            {/* stats */}
            {loading ? (<CardsSkeleton count={4} className="grid-cols-2 lg:grid-cols-4" />) : (<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Cards frontIcon="fa-solid fa-file-invoice" header="Total POs" data={String(totalOrders)} arrow="fa-solid fa-arrow-up" description="All orders" backBg="bg-ink dark:bg-ink/90" backHeader="Overview" headerTextColor="text-muted dark:text-white/80" backDescription={`Total Purchase Orders: ${totalOrders}\nPending: ${pendingConfirmation}\nCompleted: ${completed}`} tooltip="View all POs" tooltipLink="/purchase-orders" frontTextColor="text-pink-500 dark:text-pink-400" descriptionTextColor="text-slate-500 dark:text-slate-400" />

                <Cards frontIcon="fa-solid fa-clock" header="Pending" data={String(pendingConfirmation)} arrow="fa-solid fa-hourglass-half" description="Awaiting confirmation" backBg="bg-ink dark:bg-ink/90" backHeader="Pending Orders" headerTextColor="text-muted dark:text-white/80" backDescription={`Pending: ${pendingConfirmation}\n${pendingConfirmation > 0 ? 'Awaiting supplier confirmation' : 'No pending orders'}`} tooltip="View pending orders" tooltipLink="/purchase-orders?status=Sent" badge={pendingConfirmation > 0 ? `${pendingConfirmation} waiting` : undefined} frontTextColor="text-amber-500 dark:text-amber-400" descriptionTextColor="text-slate-500 dark:text-slate-400" />

                <Cards frontIcon="fa-solid fa-circle-check" header="Completed" data={String(completed)} arrow="fa-solid fa-check-double" description="Delivered" backBg="bg-ink dark:bg-ink/90" backHeader="Completed" headerTextColor="text-muted dark:text-white/80" backDescription={`Completed: ${completed}\n${completed > 0 ? 'Orders successfully delivered' : 'No completed orders'}`} tooltip="View completed orders" tooltipLink="/purchase-orders?status=Delivered" frontTextColor="text-emerald-500 dark:text-emerald-400" descriptionTextColor="text-slate-500 dark:text-slate-400" />

                <Cards frontIcon="fa-solid fa-coins" header="Total Spend" data={`₱${totalSpend.toLocaleString()}`} arrow="fa-solid fa-chart-line" description="Paid orders" backBg="bg-ink dark:bg-ink/90" backHeader="Financial Summary" headerTextColor="text-muted dark:text-white/80" backDescription={`Total Spend: ₱${totalSpend.toLocaleString()}\n${purchaseOrders.filter(o => o.paid).length} paid orders\n${totalSpend > 0 ? 'Tracking procurement costs' : 'No paid orders yet'}`} tooltip="View financial details" frontTextColor="text-blue-500 dark:text-blue-400" descriptionTextColor="text-slate-500 dark:text-slate-400" />
            </div>)}

            {/* charts */}
            {loading ? (<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartSkeleton type="doughnut" badgeIcon="fas fa-chart-pie" title="PO Status Categories" subtitle="Distribution by order status" />
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between animate-pulse">
                    <div className="flex items-center justify-between mb-3">
                        <div className="space-y-1">
                            <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
                            <div className="h-3 w-44 bg-slate-200/70 dark:bg-slate-800/70 rounded" />
                        </div>
                        <div className="w-8 h-8 rounded-xl bg-pink-50 dark:bg-pink-950/40 border border-pink-100 dark:border-pink-900/30" />
                    </div>
                    <div className="space-y-2.5">
                        {[1, 2, 3].map((n) => (<div key={n} className="flex items-center gap-3 p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                            <div className="w-5 h-5 rounded-full bg-pink-100/60 dark:bg-pink-950/60" />
                            <div className="flex-1 space-y-1.5">
                                <div className="h-3.5 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
                                <div className="h-3 w-40 bg-slate-200/70 dark:bg-slate-800/70 rounded" />
                            </div>
                        </div>))}
                    </div>
                </div>
            </div>) : (<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* po status */}
                <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] flex flex-col justify-between transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-sm text-slate-900 dark:text-white">PO Status Categories</h3>
                                <div className="relative group">
                                    <button type="button" className="w-4 h-4 rounded-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[10px] font-bold inline-flex items-center justify-center hover:text-pink-500 dark:hover:text-pink-400 transition-colors cursor-help shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3)]" aria-label="Information">
                                        <i className="fas fa-info text-[9px]" />
                                    </button>
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-3.5 bg-slate-900 text-slate-200 text-xs rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-20 pointer-events-none border border-slate-700/60">
                                        <p className="font-semibold text-white mb-1.5 flex items-center gap-1.5 text-xs">
                                            <i className="fas fa-chart-pie text-pink-400 text-xs" /> Status Metrics
                                        </p>
                                        <p className="text-[11px] text-slate-300 leading-relaxed">Distribution of purchase orders across lifecycle stages.</p>
                                        <p className="mt-2 text-pink-300 text-[10px] font-medium flex items-center gap-1.5 border-t border-slate-800 pt-1.5">
                                            <i className="fas fa-mouse-pointer text-[9px] text-pink-400" /> Click slice to view detailed orders
                                        </p>
                                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-900 border-r border-b border-slate-700/60" />
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Distribution by order status</p>
                        </div>
                        <div className="w-8 h-8 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] text-pink-500 dark:text-pink-400 flex items-center justify-center">
                            <i className="fas fa-chart-pie text-xs" />
                        </div>
                    </div>

                    <div className="h-60 relative w-full flex items-center justify-center">
                        {datasetOrders.length === 0 ? (<div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-6 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] flex items-center justify-center text-pink-500 dark:text-pink-400 mb-3">
                                <i className="fas fa-chart-pie text-base" />
                            </div>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">No order data available</span>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Status metrics will display once orders are created</span>
                        </div>) : (<canvas ref={poChartRef} className="w-full h-full max-h-60 cursor-pointer" />)}
                    </div>
                </div>

                {/* activity */}
                <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] flex flex-col transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Recent Activity</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Latest purchase order actions</p>
                        </div>
                        <div className="w-8 h-8 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] text-pink-500 dark:text-pink-400 flex items-center justify-center">
                            <i className="fas fa-clock text-xs" />
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        {[0, 1, 2].map((index) => {
                            const order = allOrders[index];
                            const slotNumber = index + 1;
                            if (order) {
                                return (<div key={order.id} className="flex items-start gap-3 p-3 bg-[#ebf0f7] dark:bg-[#14151c] rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] transition-all">
                                    <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-xl bg-gradient-to-b from-pink-500 to-pink-600 text-white text-[11px] font-bold mt-0.5 border border-pink-400/80 shadow-[0_2px_6px_rgba(236,72,153,0.3)]">
                                        {slotNumber}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                                                {order.po_number}
                                            </span>
                                            <StatusBadge tone={getPOStatusTone(order.status)} dot size="xs">
                                                {order.status}
                                            </StatusBadge>
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto">
                                                {order.delivery_date || 'No date'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between mt-1 text-xs">
                                            <span className="text-slate-600 dark:text-slate-400 truncate font-medium">
                                                {order.supplier_name}
                                            </span>
                                            <span className="font-bold text-slate-900 dark:text-white shrink-0 ml-2">
                                                ₱{order.total_amount.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>);
                            }
                            return (<div key={`empty-slot-${index}`} className="flex items-center gap-3 p-3 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-[#ebf0f7]/40 dark:bg-[#14151c]/40 text-slate-400 dark:text-slate-500">
                                <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] text-slate-400 dark:text-slate-500 text-[10px] font-bold border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.2)]">
                                    {slotNumber}
                                </div>
                                <div className="flex items-center justify-between w-full text-xs">
                                    <span className="font-medium text-slate-400 dark:text-slate-500 italic">No recent activity</span>
                                    <span className="text-[11px] text-slate-300 dark:text-slate-600 font-mono">—</span>
                                </div>
                            </div>);
                        })}
                    </div>
                </div>
            </div>)}

            {/* table (Neumorphic Card Container) */}
            {loading ? (<TableSkeleton rows={itemsPerPage} hasFilter hasSearch hasPagination columns={[
                { type: 'checkbox', width: 'w-10' },
                { header: 'PO Number', type: 'mono' },
                { header: 'Supplier', type: 'avatar-text', subtext: false },
                { header: 'Total Amount', type: 'currency' },
                { header: 'Delivery Date', type: 'date' },
                { header: 'Status', type: 'badge' },
                { header: 'Payment', type: 'badge' },
                { header: 'Actions', type: 'actions', align: 'right', width: 'w-[150px]' },
            ]} />) : (<div ref={tableContainerRef} id="purchase-orders-table" className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] overflow-hidden relative flex flex-col">
                {isRefreshing && <TableContentLoader />}

                {/* filter bar */}
                <div className="flex-shrink-0 pb-4 mb-3 border-b border-slate-200/60 dark:border-slate-800/80 transition-all">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="font-bold text-slate-900 dark:text-white text-sm mr-2 flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] text-pink-500 dark:text-pink-400 flex items-center justify-center">
                                <i className="fas fa-list text-xs" />
                            </div>
                            <span>Purchase Orders</span>
                            {isRefreshing && (<i className="fas fa-circle-notch fa-spin text-pink-400 text-xs" title="Refreshing..." />)}
                        </div>

                        <div className="relative flex-1 min-w-[200px] max-w-xs">
                            <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none" />
                            <input className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2 pl-9 pr-8 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-pink-500 transition-all" placeholder="Search by PO # or supplier..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>

                        {/* status filter tabs */}
                        <div className="w-full xl:w-auto max-w-full overflow-x-auto pb-1 xl:pb-0 scroll-smooth touch-pan-x">
                            <div className="inline-flex items-center gap-1 bg-[#ebf0f7] dark:bg-[#14151c] p-1 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] min-w-max">
                                {[
                                    { key: "all", label: "All", count: totalOrders },
                                    { key: "Draft", label: "Draft", count: allOrders.filter(o => o.status === 'Draft').length },
                                    { key: "Sent", label: "Sent", count: allOrders.filter(o => o.status === 'Sent').length },
                                    { key: "Confirmed", label: "Confirmed", count: allOrders.filter(o => o.status === 'Confirmed').length },
                                    { key: "Delivered", label: "Delivered", count: allOrders.filter(o => o.status === 'Delivered').length },
                                    { key: "Cancelled", label: "Cancelled", count: allOrders.filter(o => o.status === 'Cancelled').length },
                                ].map((tab) => {
                                    const isActive = activeStatusFilter === tab.key;
                                    return (<button key={tab.key} className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 active:scale-95 ${isActive
                                        ? "bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-900 dark:text-white border border-white/70 dark:border-[#2a2b38] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)]"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"}`} onClick={() => {
                                            setActiveStatusFilter(tab.key);
                                            setCurrentPage(1);
                                        }}>
                                        <span>{tab.label}</span>
                                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-colors ${isActive
                                            ? "bg-pink-50 dark:bg-pink-950/60 text-pink-600 dark:text-pink-300 border border-pink-200/80 dark:border-pink-900/40"
                                            : "bg-slate-300/50 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>
                                            {tab.count}
                                        </span>
                                    </button>);
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* bulk toolbar */}
                {selectedIds.size > 0 && (<div className="px-4 py-2.5 mb-3 bg-[#ebf0f7] dark:bg-[#14151c] rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center gap-2.5">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-xl bg-gradient-to-b from-pink-500 to-pink-600 text-white font-bold text-xs border border-pink-400/80 shadow-[0_2px_6px_rgba(236,72,153,0.3)]">
                            {selectedIds.size}
                        </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {selectedIds.size} purchase order{selectedIds.size > 1 ? 's' : ''} selected
                        </span>
                        <button type="button" onClick={() => {
                            setSelectedIds(new Set());
                            setIsSelectAll(false);
                        }} className="text-[11px] text-slate-500 hover:text-pink-600 dark:hover:text-pink-400 underline font-medium cursor-pointer ml-1">
                            Deselect all
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* bulk status dropdown */}
                        <div className="flex items-center gap-2 bg-white dark:bg-[#1a1b26] rounded-xl px-3 py-1.5 border border-slate-200/90 dark:border-slate-700/80 shadow-[2px_2px_5px_rgba(166,175,195,0.25),-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-none transition-all">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                                <i className="fas fa-tasks text-pink-500 text-[10px]" />
                                Status:
                            </span>
                            <select
                                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer pr-1 transition-colors"
                                defaultValue=""
                                onChange={(e) => {
                                    if (e.target.value) {
                                        handleBulkUpdateStatus(e.target.value);
                                        e.target.value = "";
                                    }
                                }}
                                disabled={pendingRowId === "bulk"}
                            >
                                <option value="" disabled className="bg-white dark:bg-[#1e202e] text-slate-400 dark:text-slate-500 font-normal">
                                    Change Status...
                                </option>
                                <option value="Draft" className="bg-white dark:bg-[#1e202e] text-slate-800 dark:text-slate-100 font-semibold py-1">
                                    Draft
                                </option>
                                <option value="Sent" className="bg-white dark:bg-[#1e202e] text-slate-800 dark:text-slate-100 font-semibold py-1">
                                    Sent
                                </option>
                                <option value="Confirmed" className="bg-white dark:bg-[#1e202e] text-slate-800 dark:text-slate-100 font-semibold py-1">
                                    Confirmed
                                </option>
                                <option value="Delivered" className="bg-white dark:bg-[#1e202e] text-slate-800 dark:text-slate-100 font-semibold py-1">
                                    Delivered
                                </option>
                                <option value="Cancelled" className="bg-white dark:bg-[#1e202e] text-rose-600 dark:text-rose-400 font-semibold py-1">
                                    Cancelled
                                </option>
                            </select>
                        </div>

                        {/* bulk delete */}
                        <button
                            type="button"
                            onClick={handleBulkDelete}
                            disabled={pendingRowId === "bulk"}
                            className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-[2px_2px_5px_rgba(166,175,195,0.25),-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-none active:scale-95"
                            title="Delete selected orders"
                        >
                            <i className="fas fa-trash-alt text-rose-600 dark:text-rose-400 text-[11px]" />
                            <span>Delete</span>
                        </button>
                    </div>
                </div>)}

                {/* body */}
                <div className="flex-1 overflow-y-auto max-h-[500px] relative">
                    <div className="transition-opacity duration-200">
                        <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-[#ebf0f7]/40 dark:bg-[#14151c]/40 shadow-[inset_1.5px_1.5px_4px_rgba(166,175,195,0.25)]">
                            <table className="table-pro w-full border-collapse text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-[#e4ebf5] dark:bg-[#14151c] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                                        <th className="w-10 py-3 px-4 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-pink-600 focus:ring-pink-500/20 focus:ring-2 transition-all cursor-pointer accent-pink-600" checked={isSelectAll && selectedIds.size > 0} onChange={handleSelectAll} disabled={filteredOrders.length === 0} title={filteredOrders.length === 0 ? "No orders to select" : "Select all purchase orders"} />
                                                {selectedIds.size > 0 && (<span className="text-[10px] bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 font-bold px-1.5 py-0.2 rounded-full border border-pink-200/60 dark:border-pink-900/40">
                                                    {selectedIds.size}
                                                </span>)}
                                            </div>
                                        </th>
                                        <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">PO #</th>
                                        <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Supplier</th>
                                        <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Items</th>
                                        <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400 text-right">Amount</th>
                                        <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Delivery Date</th>
                                        <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Status</th>
                                        <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Payment</th>
                                        <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400 text-center">OCR Result</th>
                                        <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400 text-right! w-[130px] min-w-[130px]">Actions</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                    {filteredOrders.length === 0 ? (<tr>
                                        <td colSpan={10} className="py-12">
                                            <EmptyState title="No purchase orders found" description={activeStatusFilter !== 'all'
                                                ? `There are no orders with status "${activeStatusFilter}".`
                                                : "Select an approved purchase request to generate a purchase order."} icon="fas fa-file-invoice" actionText="Create PO from Request" badgeCount={approvedRequestsCount} onAction={handleOpenApprovedRequests} />
                                        </td>
                                    </tr>) : (filteredOrders.map((order: PurchaseOrder) => {
                                        const isRowVerifying = verifyingPoIds.has(order.id);
                                        const rowBusy = pendingRowId === order.id || isRowVerifying;
                                        const isSelected = selectedIds.has(order.id);
                                        return (<tr key={order.id} onClick={() => !rowBusy && setActionModalOrder(order)} className={`group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${rowBusy ? "opacity-60 cursor-not-allowed" : "cursor-pointer"} ${isSelected ? "bg-pink-50/30 dark:bg-pink-950/20" : "bg-transparent"}`}>
                                            <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                <input type="checkbox" disabled={rowBusy} className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-pink-600 focus:ring-pink-500/20 focus:ring-2 transition-all cursor-pointer accent-pink-600 disabled:opacity-50" checked={isSelected} onChange={() => handleSelectOne(order.id)} />
                                            </td>
                                            <td data-label="PO #" className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                                                {order.po_number}
                                            </td>
                                            <td data-label="Supplier" className="py-3.5 px-4">
                                                <div className="font-medium text-slate-800 dark:text-slate-200">
                                                    {order.supplier_name}
                                                </div>
                                            </td>
                                            <td data-label="Items" className="py-3.5 px-4">
                                                <span className="text-slate-600 dark:text-slate-400 truncate max-w-[150px] block" title={order.items?.length ? order.items.map((i: any) => i.name).join(', ') : ''}>
                                                    {order.items?.length ? order.items.map((i: any) => i.name).join(', ') : 'N/A'}
                                                </span>
                                            </td>
                                            <td data-label="Amount" className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white tracking-tight whitespace-nowrap">
                                                ₱{order.total_amount.toLocaleString()}
                                            </td>
                                            <td data-label="Delivery Date" className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                                                {order.delivery_date || 'TBD'}
                                            </td>
                                            <td data-label="Status" className="py-3.5 px-4 whitespace-nowrap">
                                                <StatusBadge tone={getPOStatusTone(order.status)} dot size="xs">
                                                    {order.status}
                                                </StatusBadge>
                                            </td>
                                            <td data-label="Payment" className="py-3.5 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                {isRowVerifying ? (
                                                    <StatusBadge tone="indigo" icon="fas fa-spinner fa-spin" size="xs" disabled title="Verifying receipt for this order...">
                                                        Verifying...
                                                    </StatusBadge>
                                                ) : (order.paid || order.verification?.match_result === 'matched' || order.verification?.match_result === 'forced') ? (
                                                    <StatusBadge tone="emerald" icon="fas fa-check-circle" size="xs" title="Payment verified via receipt" onClick={() => handleTogglePaid(order.id, true, order.po_number, order.status)} disabled={rowBusy}>
                                                        Paid ✓
                                                    </StatusBadge>
                                                ) : order.status === 'Delivered' ? (
                                                    <StatusBadge tone="pink" icon="fas fa-receipt" size="xs" interactive title="PO Delivered: Click to upload receipt & verify payment" onClick={() => handleTogglePaid(order.id, order.paid, order.po_number, order.status)} disabled={rowBusy}>
                                                        Upload Receipt
                                                    </StatusBadge>
                                                ) : (
                                                    <StatusBadge tone="neutral" icon="fas fa-lock" size="xs" disabled title={`Locked: Order must be Delivered before receipt verification (currently ${order.status})`}>
                                                        Unpaid
                                                    </StatusBadge>
                                                )}
                                            </td>
                                            <td data-label="OCR Result" className="py-3.5 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                {isRowVerifying ? (
                                                    <StatusBadge tone="indigo" icon="fas fa-spinner fa-spin" size="xs" interactive title="Checking receipt match... Click to reopen modal" onClick={() => {
                                                        setReceiptModalPO(order);
                                                        setIsReceiptModalOpen(true);
                                                    }}>
                                                        Checking Match...
                                                    </StatusBadge>
                                                ) : order.verification?.match_result === 'matched' ? (<StatusBadge tone="emerald" icon="fas fa-check-circle" size="xs" interactive title="Receipt verified. Click to view document." onClick={() => {
                                                    setViewingDocData({
                                                        id: order.document?.id || order.verification?.id,
                                                        title: order.document?.title || `Receipt - PO #${order.po_number}`,
                                                        fileName: order.document?.file_name || `receipt_${order.po_number}.png`,
                                                        fileUrl: order.verification?.uploaded_file_url,
                                                        storagePath: order.document?.storage_path,
                                                        fileType: order.document?.file_type,
                                                        poNumber: order.po_number,
                                                        supplierName: order.supplier_name,
                                                        verifiedStatus: 'matched',
                                                        totalAmount: order.total_amount,
                                                        notes: order.document?.notes || 'Verified via Gemini OCR (Matched)',
                                                        uploadedBy: order.document?.uploaded_by,
                                                    });
                                                    setIsDocViewerOpen(true);
                                                }}>
                                                    Matched ✓
                                                </StatusBadge>) : order.verification?.match_result === 'mismatched' ? (<StatusBadge tone="amber" icon="fas fa-exclamation-triangle" size="xs" interactive title="Receipt mismatch detected. Click to review differences or force insert." onClick={() => {
                                                    setReceiptModalPO(order);
                                                    setReceiptVerificationId(order.verification?.id || null);
                                                    setIsReceiptModalOpen(true);
                                                }}>
                                                    Mismatch ⚠
                                                </StatusBadge>) : order.verification?.match_result === 'forced' ? (<StatusBadge tone="blue" icon="fas fa-shield-alt" size="xs" interactive title="Admin forced override. Click to view document." onClick={() => {
                                                    setViewingDocData({
                                                        id: order.document?.id || order.verification?.id,
                                                        title: order.document?.title || `Receipt (Forced) - PO #${order.po_number}`,
                                                        fileName: order.document?.file_name || `receipt_${order.po_number}.png`,
                                                        fileUrl: order.verification?.uploaded_file_url,
                                                        storagePath: order.document?.storage_path,
                                                        fileType: order.document?.file_type,
                                                        poNumber: order.po_number,
                                                        supplierName: order.supplier_name,
                                                        verifiedStatus: 'forced',
                                                        totalAmount: order.total_amount,
                                                        notes: order.document?.notes || 'Admin Forced Override',
                                                        uploadedBy: order.document?.uploaded_by,
                                                    });
                                                    setIsDocViewerOpen(true);
                                                }}>
                                                    Forced ✓
                                                </StatusBadge>) : order.verification?.match_result === 'pending' ? (<StatusBadge tone="indigo" icon="fas fa-spinner fa-spin" size="xs" interactive title="Receipt verification is processing..." onClick={() => {
                                                    setReceiptModalPO(order);
                                                    setReceiptVerificationId(order.verification?.id || null);
                                                    setIsReceiptModalOpen(true);
                                                }}>
                                                    Processing...
                                                </StatusBadge>) : order.paid ? (<StatusBadge tone="emerald" icon="fas fa-check" size="xs">
                                                    Paid
                                                </StatusBadge>) : order.status === 'Delivered' ? (<StatusBadge tone="pink" icon="fas fa-arrow-up-from-bracket" size="xs" interactive title="Click to upload receipt for OCR verification" onClick={() => {
                                                    setReceiptModalPO(order);
                                                    setReceiptVerificationId(null);
                                                    setIsReceiptModalOpen(true);
                                                }}>
                                                    Upload
                                                </StatusBadge>) : (<span className="text-slate-400 dark:text-slate-600 text-xs font-medium italic">—</span>)}
                                            </td>
                                            <td data-label="Actions" className="py-3.5 px-4 text-right whitespace-nowrap w-[130px] min-w-[130px]" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-2.5">
                                                    {rowBusy && (<svg className="w-4 h-4 animate-spin text-slate-400 dark:text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                    </svg>)}

                                                    {/* digital receipt */}
                                                    <CrudActionButton
                                                        action="custom"
                                                        label="Receipt"
                                                        icon={Receipt}
                                                        disabled={rowBusy}
                                                        ariaLabel="View & Print Digital Receipt"
                                                        title="View & Print Digital Receipt"
                                                        onClick={() => {
                                                            setDigitalReceiptPO(order);
                                                            setIsDigitalReceiptModalOpen(true);
                                                        }}
                                                    />

                                                    {/* view doc */}
                                                    {(order.verification?.uploaded_file_url || order.document?.storage_path) && (<CrudActionButton action="custom" label="Doc" icon={FileText} disabled={rowBusy} ariaLabel="View Receipt Document" title="View Receipt Document" onClick={() => {
                                                        setViewingDocData({
                                                            id: order.document?.id || order.verification?.id,
                                                            title: order.document?.title || `Receipt - PO #${order.po_number}`,
                                                            fileName: order.document?.file_name || `receipt_${order.po_number}.png`,
                                                            fileUrl: order.verification?.uploaded_file_url,
                                                            storagePath: order.document?.storage_path,
                                                            fileType: order.document?.file_type,
                                                            poNumber: order.po_number,
                                                            supplierName: order.supplier_name,
                                                            verifiedStatus: order.verification?.match_result,
                                                            totalAmount: order.total_amount,
                                                            notes: order.document?.notes || (order.verification?.match_result === 'matched' ? 'OCR Verified Matched' : undefined),
                                                            uploadedBy: order.document?.uploaded_by,
                                                        });
                                                        setIsDocViewerOpen(true);
                                                    }} />)}

                                                    {/* manage order */}
                                                    <CrudActionButton action="custom" label="Manage" icon={MoreHorizontal} disabled={rowBusy} ariaLabel="Manage Purchase Order" title="Manage Purchase Order" onClick={() => setActionModalOrder(order)} />
                                                </div>
                                            </td>
                                        </tr>);
                                    }))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* pagination */}
                <div className="flex-shrink-0 pagination-container-class flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-1">
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">
                            Showing <span className="font-semibold text-slate-800 dark:text-white">
                                {totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
                            </span> to{' '}
                            <span className="font-semibold text-slate-800 dark:text-white">
                                {Math.min(currentPage * itemsPerPage, totalItems)}
                            </span> of{' '}
                            <span className="font-semibold text-slate-800 dark:text-white">{totalItems}</span> orders
                        </span>

                        {selectedIds.size > 0 && (<div className="flex items-center gap-2 pl-3 border-l border-slate-200/60 dark:border-slate-800 animate-in fade-in duration-150">
                            <span className="px-2.5 py-1 rounded-xl bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 font-bold border border-pink-200/80 dark:border-pink-900/40 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.2)]">
                                {selectedIds.size} selected
                            </span>

                            <button type="button" onClick={handleBulkDelete} disabled={pendingRowId === "bulk"} className="px-3 py-1.5 text-xs font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 rounded-2xl border border-rose-200/70 dark:border-rose-800/50 shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95">
                                {pendingRowId === "bulk" ? (<i className="fas fa-spinner fa-spin text-xs" />) : (<i className="fas fa-trash-alt text-xs" />)}
                                <span>Delete Selected</span>
                            </button>

                            <button type="button" onClick={() => {
                                setSelectedIds(new Set());
                                setIsSelectAll(false);
                            }} className="w-7 h-7 rounded-xl bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center border border-white/70 dark:border-[#2a2b38] shadow-[2px_2px_4px_rgba(166,175,195,0.3),-2px_-2px_4px_rgba(255,255,255,0.9)] transition-all cursor-pointer active:scale-95" title="Clear selection" aria-label="Clear selection">
                                <i className="fas fa-times text-xs" />
                            </button>
                        </div>)}
                    </div>

                    <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
                </div>
            </div>)}

            {/* selection modal */}
            <ApprovedRequestsModal isOpen={isApprovedRequestsModalOpen} onClose={() => setIsApprovedRequestsModalOpen(false)} onSelectRequest={handleSelectRequestForPO} />

            {/* po modal */}
            <PurchaseOrderModal isOpen={isPurchaseOrderModalOpen} onClose={() => {
                setIsPurchaseOrderModalOpen(false);
                setSelectedRequestForPO(null);
            }} request={selectedRequestForPO} suppliers={suppliers} onOrderCreated={handleOrderCreated} />
            {/* pr modal */}
            <PurchaseRequestModal isOpen={isPurchaseRequestModalOpen} onClose={() => setIsPurchaseRequestModalOpen(false)} suppliers={suppliers} role={userRole} onRequestSubmitted={handleRequestSubmitted} />

            {/* chart detail */}
            <ChartDetailModal isOpen={chartDetailModal.isOpen} onClose={() => setChartDetailModal(prev => ({ ...prev, isOpen: false }))} month={chartDetailModal.month} monthIndex={chartDetailModal.monthIndex} orders={chartDetailModal.orders} totalAmount={chartDetailModal.totalAmount} />

            {/* manage po */}
            {actionModalOrder && (
                <Portal>
                    <div className="fixed inset-0 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md flex items-center justify-center z-[99999] p-4 animate-in fade-in duration-200" onClick={() => setActionModalOrder(null)}>
                        <div className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-[12px_12px_36px_rgba(166,175,195,0.45),-12px_-12px_36px_rgba(255,255,255,0.95)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.8),-4px_-4px_12px_rgba(255,255,255,0.03)] border border-white/90 dark:border-white/[0.08] overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>

                            {/* header */}
                            <div className="px-6 py-4.5 border-b border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] text-pink-500 dark:text-pink-400 flex items-center justify-center text-lg shrink-0">
                                        <i className="fas fa-file-invoice" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                                                Manage Order
                                            </h2>
                                            <span className="font-mono text-xs font-bold text-pink-600 dark:text-pink-400 bg-[#ebf0f7] dark:bg-[#14151e] px-2 py-0.5 rounded-lg border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                                {actionModalOrder.po_number}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                            {actionModalOrder.supplier_name} • <span className="font-bold text-slate-800 dark:text-slate-200">₱{actionModalOrder.total_amount.toLocaleString()}</span>
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    disabled={isSendingActionComm}
                                    onClick={() => setActionModalOrder(null)}
                                    className="w-8 h-8 rounded-xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                                    aria-label="Close modal"
                                >
                                    <i className="fas fa-times text-xs" />
                                </button>
                            </div>

                            {/* content body */}
                            <div className="p-6 space-y-5 overflow-y-auto flex-1">
                                {/* quick overview card */}
                                <div className="bg-[#ebf0f7] dark:bg-[#14151e] rounded-2xl p-4 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <span className="text-[10px] uppercase font-extrabold text-slate-400 dark:text-slate-500 tracking-wider">
                                                Current Status
                                            </span>
                                            <div className="mt-1.5 flex items-center gap-1.5">
                                                <StatusBadge tone={getPOStatusTone(actionModalOrder.status)} dot size="xs">
                                                    {actionModalOrder.status}
                                                </StatusBadge>
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-[10px] uppercase font-extrabold text-slate-400 dark:text-slate-500 tracking-wider">
                                                Payment Status
                                            </span>
                                            <div className="mt-1.5 flex items-center gap-1.5">
                                                {(actionModalOrder.paid || actionModalOrder.verification?.match_result === 'matched' || actionModalOrder.verification?.match_result === 'forced') ? (
                                                    <StatusBadge tone="purple" icon="fas fa-check-circle" size="xs">
                                                        Paid ✓
                                                    </StatusBadge>
                                                ) : (
                                                    <StatusBadge tone="amber" icon="fas fa-hourglass-half" size="xs">
                                                        Unpaid
                                                    </StatusBadge>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* items preview if available */}
                                    {actionModalOrder.items && actionModalOrder.items.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-white/[0.04]">
                                            <span className="text-[10px] uppercase font-extrabold text-slate-400 dark:text-slate-500 tracking-wider block mb-1">
                                                Order Items ({actionModalOrder.items.length})
                                            </span>
                                            <div className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate" title={actionModalOrder.items.map((i: any) => `${i.name || i.item_name} (x${i.quantity || 1})`).join(', ')}>
                                                {actionModalOrder.items.map((i: any) => i.name || i.item_name).join(', ')}
                                            </div>
                                        </div>
                                    )}

                                    {/* ocr verification CTA */}
                                    {!(actionModalOrder.paid || actionModalOrder.verification?.match_result === 'matched' || actionModalOrder.verification?.match_result === 'forced') && actionModalOrder.status === 'Delivered' && (
                                        <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-white/[0.04]">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setReceiptModalPO(actionModalOrder);
                                                    setReceiptVerificationId(null);
                                                    setIsReceiptModalOpen(true);
                                                    setActionModalOrder(null);
                                                }}
                                                className="w-full px-4 py-2 text-xs font-bold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 bg-[#f0f3f8] dark:bg-[#1a1b26] rounded-xl shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.03)] border border-pink-200/80 dark:border-pink-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                                            >
                                                <i className="fas fa-receipt text-xs" />
                                                <span>Upload Receipt & Verify Payment (OCR)</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* send options (for draft orders) */}
                                {actionModalOrder.status === 'Draft' && (
                                    <div className="bg-[#ebf0f7] dark:bg-[#14151e] rounded-2xl p-4 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-lg bg-pink-50 dark:bg-pink-950/50 border border-pink-200/60 dark:border-pink-900/40 flex items-center justify-center text-pink-500 dark:text-pink-400 text-[10px]">
                                                    <i className="fas fa-paper-plane" />
                                                </span>
                                                <div>
                                                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-none">
                                                        Send PO to Supplier
                                                    </h3>
                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">
                                                        Select template mode & dispatch via Gmail
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Minimalist Mode Indicator Pill */}
                                            <div>
                                                {actionEmailMode === 'ai' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/40">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                        <span>AI Content Active</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                        <span>Standard Template</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Minimalist Mode Switcher Tabs */}
                                        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200/60 dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
                                            <button
                                                type="button"
                                                onClick={() => setActionEmailMode('standard')}
                                                className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                                    actionEmailMode === 'standard'
                                                        ? 'bg-white dark:bg-[#1c1e2b] text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700'
                                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                                }`}
                                            >
                                                <span>Standard</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setActionEmailMode('ai');
                                                    if (!actionModalAiMessage && !isGeneratingActionAI) {
                                                        handleGenerateActionAIMessage();
                                                    }
                                                }}
                                                className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                                    actionEmailMode === 'ai'
                                                        ? 'bg-white dark:bg-[#1c1e2b] text-indigo-600 dark:text-indigo-400 shadow-xs border border-indigo-200 dark:border-indigo-800/40'
                                                        : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                                                }`}
                                            >
                                                <span>AI Compose</span>
                                            </button>
                                        </div>

                                        {/* Content Preview & AI Compose */}
                                        {actionEmailMode === 'standard' ? (
                                            <div className="bg-[#e9eef6] dark:bg-[#13141d] rounded-xl p-3.5 border border-white/60 dark:border-white/[0.04] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] text-xs text-slate-700 dark:text-slate-300">
                                                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                                                    "Hello <strong>{actionModalOrder.supplier_name}</strong>, please review and accept this official purchase order for the listed items. Confirm availability at your earliest convenience."
                                                </p>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1 font-medium">
                                                    <i className="fas fa-check-circle text-emerald-500 text-[9px]" />
                                                    Includes minimalist breakdown table & confirmation link.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="bg-[#e9eef6] dark:bg-[#13141d] rounded-xl p-3.5 border border-indigo-100/80 dark:border-indigo-900/40 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                                                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-300/60 dark:border-white/[0.06]">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                                                            <i className="fas fa-robot text-[9px]" /> AI Explanation
                                                        </span>
                                                        {actionModalAiMessage && (
                                                            <span className="text-[9px] text-slate-400 dark:text-slate-500">
                                                                (Saved in storage)
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={handleGenerateActionAIMessage}
                                                            disabled={isGeneratingActionAI || isSendingActionComm}
                                                            className="px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-[#1c1e2b] rounded-lg border border-indigo-200 dark:border-indigo-800/40 cursor-pointer disabled:opacity-50"
                                                        >
                                                            {isGeneratingActionAI ? <i className="fas fa-spinner fa-spin mr-1" /> : <i className="fas fa-arrows-rotate mr-1" />}
                                                            {isGeneratingActionAI ? 'Generating...' : 'Regenerate'}
                                                        </button>
                                                        {actionModalAiMessage && (
                                                            <button
                                                                type="button"
                                                                onClick={handleActionCopyOnly}
                                                                disabled={isSendingActionComm}
                                                                className="w-5 h-5 rounded-md bg-white dark:bg-[#1c1e2b] text-slate-600 dark:text-slate-300 flex items-center justify-center border border-slate-200 dark:border-slate-800 cursor-pointer"
                                                                title="Copy"
                                                            >
                                                                <i className="fas fa-copy text-[9px]" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {isGeneratingActionAI ? (
                                                    <div className="flex items-center justify-center h-16 text-indigo-600 dark:text-indigo-400 gap-1.5 font-semibold text-xs">
                                                        <i className="fas fa-spinner fa-spin" />
                                                        <span>Drafting tailored supplier message...</span>
                                                    </div>
                                                ) : actionModalAiMessage ? (
                                                    <div className="space-y-1.5">
                                                        <textarea
                                                            value={actionModalAiMessage}
                                                            onChange={(e) => {
                                                                setActionModalAiMessage(e.target.value);
                                                                const cacheKey = `po_ai_compose_${actionModalOrder.id || actionModalOrder.po_number}`;
                                                                if (typeof window !== 'undefined') {
                                                                    localStorage.setItem(cacheKey, e.target.value);
                                                                }
                                                            }}
                                                            rows={4}
                                                            className="w-full bg-white dark:bg-[#181924] p-2.5 rounded-lg border border-indigo-200/80 dark:border-indigo-800/50 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 font-sans transition-all resize-y leading-relaxed"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-3">
                                                        <p className="text-slate-400 dark:text-slate-500 italic text-[11px] mb-1">
                                                            Click AI Compose to generate custom notes.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* supplier contact & buttons */}
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
                                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                                {actionSupplierEmail ? (
                                                    <span className="truncate block font-medium" title={actionSupplierEmail}>
                                                        <i className="fas fa-envelope text-pink-500 mr-1.5" />
                                                        {actionSupplierEmail}
                                                    </span>
                                                ) : (
                                                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                                                        <i className="fas fa-exclamation-triangle mr-1.5" />
                                                        No supplier email configured
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 justify-end">
                                                <button
                                                    type="button"
                                                    onClick={handleActionEmail}
                                                    title="Send Email via Gmail"
                                                    disabled={isSendingActionComm || !actionSupplierEmail}
                                                    className="px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-b from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 border border-pink-400/80 rounded-xl shadow-[0_2px_8px_rgba(236,72,153,0.35)] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                                                >
                                                    {isSendingActionComm ? (
                                                        <i className="fas fa-spinner fa-spin text-white" />
                                                    ) : (
                                                        <i className="fas fa-paper-plane text-white text-[11px]" />
                                                    )}
                                                    <span>{isSendingActionComm ? 'Sending...' : 'Send via Gmail'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Digital Receipt Print Quick Button */}
                                <div className="pt-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDigitalReceiptPO(actionModalOrder);
                                            setIsDigitalReceiptModalOpen(true);
                                        }}
                                        className="w-full py-2 px-4 text-xs font-bold text-slate-700 dark:text-slate-200 bg-[#f0f3f8] dark:bg-[#1a1b26] hover:text-pink-600 dark:hover:text-pink-400 border border-white/80 dark:border-[#2a2b38] rounded-xl shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                                    >
                                        <i className="fas fa-receipt text-pink-500 dark:text-pink-400 text-xs" />
                                        <span>View & Print Official Digital Receipt</span>
                                    </button>
                                </div>

                                {/* status transition section */}
                                <div className={`space-y-2.5 transition-opacity duration-200 ${isSendingActionComm ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                                            <i className="fas fa-arrows-rotate text-pink-500 text-[11px]" />
                                            Update Order Status
                                        </label>
                                        {isSendingActionComm ? (
                                            <span className="text-[10px] font-bold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/40 px-2 py-0.5 rounded-md border border-pink-200 dark:border-pink-800/40 flex items-center gap-1">
                                                <i className="fas fa-spinner fa-spin text-[9px]" /> Disabled while sending...
                                            </span>
                                        ) : !canUpdateStatus ? (
                                            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800/40 flex items-center gap-1">
                                                <i className="fas fa-lock text-[9px]" /> Managers & Admins Only
                                            </span>
                                        ) : !isAdmin ? (
                                            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                                Confirmed requires Admin
                                            </span>
                                        ) : null}
                                    </div>

                                    <div className="grid grid-cols-1 gap-2">
                                        {['Draft', 'Sent', 'Confirmed', 'Delivered', 'Cancelled'].map((status) => {
                                            const isCurrent = actionModalOrder.status === status;
                                            const requiresAdmin = status === 'Confirmed' || actionModalOrder.status === 'Confirmed';
                                            const isRestricted = !canUpdateStatus || (requiresAdmin && !isAdmin);
                                            const isDisabled = pendingRowId === actionModalOrder.id || isCurrent || isRestricted || isSendingActionComm;

                                            const getDotColor = () => {
                                                switch (status) {
                                                    case 'Draft': return 'bg-slate-400 dark:bg-slate-500';
                                                    case 'Sent': return 'bg-indigo-500 dark:bg-indigo-400';
                                                    case 'Confirmed': return 'bg-purple-500 dark:bg-purple-400';
                                                    case 'Delivered': return 'bg-emerald-500 dark:text-emerald-400';
                                                    case 'Cancelled': return 'bg-rose-500 dark:bg-rose-400';
                                                    default: return 'bg-slate-400';
                                                }
                                            };

                                            return (
                                                <button
                                                    key={status}
                                                    type="button"
                                                    disabled={isDisabled}
                                                    onClick={() => handleUpdateStatus(actionModalOrder.id, status)}
                                                    title={isSendingActionComm
                                                        ? "Status updates are disabled while sending communication"
                                                        : isCurrent
                                                            ? `Current status is ${status}`
                                                            : isRestricted
                                                                ? requiresAdmin && !isAdmin
                                                                    ? "Admin Only: Only Administrators can set or modify Confirmed status"
                                                                    : "Only Managers, Executives, and Admins can update status"
                                                                : `Click to change status to ${status}`}
                                                    className={`w-full px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all flex items-center justify-between border ${isCurrent
                                                        ? 'bg-[#e2e8f0]/80 dark:bg-[#101118] border-pink-400/60 dark:border-pink-500/50 shadow-[inset_2px_2px_4px_rgba(166,175,195,0.4)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] cursor-default'
                                                        : isRestricted
                                                            ? 'bg-[#ebf0f7]/50 dark:bg-[#14151e]/50 border-slate-200/40 dark:border-slate-800/40 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.15)]'
                                                            : 'bg-[#f0f3f8] dark:bg-[#1a1b26] border-white/80 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.03)] hover:border-pink-300 dark:hover:border-pink-500/40 hover:text-pink-600 dark:hover:text-pink-400 text-slate-700 dark:text-slate-200 active:scale-[0.98] cursor-pointer'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <span className={`w-2.5 h-2.5 rounded-full ${getDotColor()} ${isCurrent ? 'ring-2 ring-pink-500/40 shadow-xs' : ''}`} />
                                                        <span className="font-bold">{status}</span>
                                                    </div>

                                                    {isCurrent ? (
                                                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200/80 dark:border-pink-900/40 tracking-wider">
                                                            Current ✓
                                                        </span>
                                                    ) : isRestricted ? (
                                                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                                            <i className="fas fa-lock text-[9px]" /> {requiresAdmin && !isAdmin ? 'Admin' : 'Locked'}
                                                        </span>
                                                    ) : (
                                                        <i className="fas fa-chevron-right text-[10px] opacity-40 group-hover:opacity-100 transition-opacity" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* delete purchase order button */}
                                <div className="pt-2">
                                    <button
                                        type="button"
                                        disabled={pendingRowId === actionModalOrder.id || isSendingActionComm}
                                        onClick={() => handleDeleteOrder(actionModalOrder.id)}
                                        className="w-full py-2.5 px-4 text-xs font-bold text-rose-600 dark:text-rose-400 bg-[#ebf0f7] dark:bg-[#14151e] hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/40 rounded-2xl shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.03)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                                    >
                                        {pendingRowId === actionModalOrder.id ? (
                                            <i className="fas fa-spinner fa-spin text-xs" />
                                        ) : (
                                            <i className="fas fa-trash-alt text-xs" />
                                        )}
                                        <span>Delete Purchase Order</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}

            {/* digital receipt modal */}
            <DigitalReceiptModal
                isOpen={isDigitalReceiptModalOpen}
                onClose={() => {
                    setIsDigitalReceiptModalOpen(false);
                    setDigitalReceiptPO(null);
                }}
                order={digitalReceiptPO}
            />

            {/* ocr modal */}
            {isReceiptModalOpen && receiptModalPO && (<UploadReceiptModal
                isOpen={isReceiptModalOpen}
                onClose={() => setIsReceiptModalOpen(false)}
                po={receiptModalPO}
                initialVerificationId={receiptVerificationId}
                isQueuedOrVerifying={verifyingPoIds.has(receiptModalPO.id)}
                onStartVerification={handleStartVerification}
                onEndVerification={handleEndVerification}
                onQueueVerification={handleEnqueueVerification}
                onMinimize={(job) => {
                    updateActiveVerificationJob(job);
                    setIsReceiptModalOpen(false);
                }}
                onSuccess={() => {
                    fetchData({ silent: true });
                }}
            />)}

            {/* verification indicator */}
            <ReceiptProcessingIndicator
                job={activeVerificationJob}
                queue={receiptQueue}
                onClick={handleOpenQueueItem}
                onDismiss={() => {
                    setActiveVerificationJob(null);
                    setReceiptQueue([]);
                }}
                onClearCompleted={() => {
                    setReceiptQueue(prev => prev.filter(q => q.status === 'queued' || q.status === 'processing'));
                }}
            />

            {/* doc viewer */}
            <DocumentViewerModal isOpen={isDocViewerOpen} onClose={() => {
                setIsDocViewerOpen(false);
                setViewingDocData(null);
            }} data={viewingDocData} />
        </div>
    </SessionGuard>);
}
