// app/(supplyChain)/(pages)/purchase-orders/page.tsx
"use client";
// imports
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Chart from "chart.js/auto";
import { supabase } from "../../lib/services/client/supabase";
import { toast } from "sonner";
import { useDebounce } from "../../hooks/useDebounce";
import { useConfirm } from "../../components/ui/ConfirmModal";
import { CardsSkeleton, ChartSkeleton, TableSkeleton } from "../../components/ui/SkeletonLoader";
import { Pagination } from "../../components/global/pagination";
import { SessionGuard } from "../../components/server/SessionGuard";
import { TableContentLoader } from "../../components/global/Loader";
import Cards from "../../components/global/Cards";
import dynamic from "next/dynamic";
import AiQuestions from "../../components/global/AiQuestions";
import { user } from "../../lib/services/Class/user";
import { buildEmailTemplate } from "../procurement/api/send-email/template";
import {
    VerificationJob,
    ReceiptQueueItem,
    getPoRateLimit,
    setPoRateLimit,
    clearPoRateLimit,
    MAX_MISMATCH_ATTEMPTS,
} from "../../components/modals/UploadReceiptModal";
import { uploadReceiptAndVerifyAction } from "./server/actions/ocr-verify";
import { processDeliveredPurchaseOrdersAction } from "./server/actions/delivery-inventory";
import { ReceiptProcessingIndicator } from "../../components/global/ReceiptProcessingIndicator";
import { CrudActionButton } from "../../components/ui/CrudActionButton";
import { AppButton } from "../../components/ui/AppButton";
import { FileText, MoreHorizontal, Receipt, Eye } from "lucide-react";
import type { ViewDocumentData } from "../../components/modals/DocumentViewerModal";
import { StatusBadge, getPOStatusTone } from "../../components/ui/StatusBadge";
import Portal from "../../components/client/Portal";

// dynamic modal imports to reduce initial bundle size
const PurchaseOrderModal = dynamic(
    () => import("../../components/modals/PurchaseOrderModal").then(m => m.PurchaseOrderModal),
    { ssr: false }
);
const ChartDetailModal = dynamic(
    () => import("../../components/modals/ChartDetailModal").then(m => m.ChartDetailModal),
    { ssr: false }
);
const DocumentViewerModal = dynamic(
    () => import("../../components/modals/DocumentViewerModal"),
    { ssr: false }
);
const UploadReceiptModal = dynamic(
    () => import("../../components/modals/UploadReceiptModal").then(m => m.UploadReceiptModal),
    { ssr: false }
);
const DigitalReceiptModal = dynamic(
    () => import("../../components/modals/DigitalReceiptModal").then(m => m.DigitalReceiptModal),
    { ssr: false }
);
// types
interface PurchaseOrder {
    id: string;
    po_number: string;
    request_id: string;
    supplier_id: string;
    supplier_name: string;
    supplier_location?: string;
    supplier_address?: string;
    category?: string | null;
    subtotal?: number;
    discount?: number;
    shipping_fee?: number;
    tax_rate?: number;
    tax_amount?: number;
    total_amount: number;
    status: string;
    delivery_date: string;
    delivery_location?: string;
    payment_terms?: string;
    payment_method?: string;
    terms_and_conditions?: string;
    notes: string;
    items: any[];
    paid: boolean;
    admin_approval?: string;
    admin_approved_at?: string;
    admin_approved_by?: string;
    financial_approval?: string;
    financial_approved_at?: string;
    financial_approved_by?: string;
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
    const [actionModalTab, setActionModalTab] = useState<'details' | 'manage'>('details');

    const openOrderModal = (order: PurchaseOrder, tab: 'details' | 'manage' = 'details') => {
        setActionModalTab(tab);
        setActionModalOrder(order);
    };

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
            const cachedAi = typeof window !== 'undefined' ? (sessionStorage.getItem(cacheKey) || localStorage.getItem(cacheKey)) : null;
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
    const isExecutive = ['executive'].includes(rawRole);
    const canUpdateStatus = ['admin', 'super_admin', 'superadmin', 'purchase officer', 'purchase_officer', 'executive'].includes(rawRole);
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
                            .from('supplier_documents')
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
            const subtotal = Number(orderData.subtotal || orderData.total_amount || 0);
            const discount = Number(orderData.discount || 0);
            const shippingFee = Number(orderData.shipping_fee || 0);
            const taxRate = Number(orderData.tax_rate || 0);
            const taxAmount = Number(orderData.tax_amount || 0);

            const { data: insertedPO, error: orderError } = await supabase
                .from('purchase_orders')
                .insert({
                    po_number: orderData.po_number,
                    request_id: orderData.request_id,
                    supplier_id: orderData.supplier_id,
                    suppliers_qoutation_bid: orderData.suppliers_qoutation_bid || orderData.quotation_id || null,
                    supplier_name: orderData.supplier_name,
                    subtotal: subtotal,
                    discount: discount,
                    shipping_fee: shippingFee,
                    tax_rate: taxRate,
                    tax_amount: taxAmount,
                    total_amount: orderData.total_amount,
                    status: initialStatus,
                    delivery_date: orderData.delivery_date,
                    delivery_location: orderData.delivery_location || "352 Escolta St, Binondo, Manila, 1006 Metro Manila(Airship Express)",
                    payment_terms: orderData.payment_terms || "Net 30 Days (Standard B2B)",
                    terms_and_conditions: orderData.terms_and_conditions || "1. All goods supplied are guaranteed brand new and authentic.\n2. Official BIR Invoice and Receipt must be provided upon delivery.\n3. Defective items will be replaced free of charge within 48 hours.",
                    notes: orderData.notes || '',
                    items: sanitizedItems,
                    paid: false,
                    fully_received: false,
                    admin_approval: orderData.admin_approval || 'Approved',
                    financial_approval: orderData.financial_approval || 'Pending',
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

            // Auto-create digital receipt in supplier_documents tracking
            try {
                let poSupplierId: number = Number(orderData.supplier_id) || 1;
                if (!poSupplierId && suppliers?.length > 0) {
                    const foundSup = suppliers.find((s: any) => s.name?.toLowerCase() === orderData.supplier_name?.toLowerCase());
                    if (foundSup?.id) poSupplierId = Number(foundSup.id) || 1;
                }
                await supabase.from('supplier_documents').insert({
                    supplier_id: poSupplierId,
                    supplier: orderData.supplier_name || null,
                    po_number: orderData.po_number || null,
                    document_type: 'Digital Receipt',
                    title: `Digital Receipt - PO #${orderData.po_number}`,
                    file_name: `digital_receipt_${orderData.po_number}.pdf`,
                    storage_path: `documents/digital_receipt_${orderData.po_number}.pdf`,
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
    const handleDeleteOrder = async (id: string) => {
        const targetOrder = purchaseOrders.find(p => p.id === id) || allOrders.find(p => p.id === id) || (actionModalOrder?.id === id ? actionModalOrder : null);
        const orderStatusLower = (targetOrder?.status || '').toLowerCase();
        if (['sent', 'confirmed', 'delivered', 'completed'].includes(orderStatusLower)) {
            toast.error(`Cannot delete PO #${targetOrder?.po_number || id} because its status is "${targetOrder?.status}". Orders in Sent, Confirmed, or Delivered status are locked and cannot be deleted.`);
            return;
        }

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

        const selectedOrders = datasetOrders.filter(po => selectedIds.has(po.id));
        const lockedOrders = selectedOrders.filter(po => ['sent', 'confirmed', 'delivered', 'completed'].includes((po.status || '').toLowerCase()));
        const eligibleOrders = selectedOrders.filter(po => !['sent', 'confirmed', 'delivered', 'completed'].includes((po.status || '').toLowerCase()));

        if (eligibleOrders.length === 0) {
            toast.error("Cannot delete selected purchase orders: All selected orders are in Sent, Confirmed, or Delivered status and are permanently locked.");
            return;
        }

        if (lockedOrders.length > 0) {
            const confirmedSkip = await confirm({
                title: "Locked Orders Detected",
                message: `${lockedOrders.length} selected purchase order(s) are in Sent, Confirmed, or Delivered status and cannot be deleted. Do you want to proceed with deleting only the ${eligibleOrders.length} Draft order(s)?`,
                confirmText: `Delete ${eligibleOrders.length} Eligible`,
                cancelText: "Cancel",
                confirmVariant: "danger",
            });
            if (!confirmedSkip) return;
        } else {
            const confirmed = await confirm({
                title: "Delete Selected Purchase Orders",
                message: `Are you sure you want to delete ${eligibleOrders.length} selected purchase order(s)? This action cannot be undone.`,
                confirmText: `Delete ${eligibleOrders.length}`,
                cancelText: "Cancel",
                confirmVariant: "danger",
            });
            if (!confirmed)
                return;
        }

        setPendingRowId("bulk");
        try {
            const idsToDelete = eligibleOrders.map(po => po.id);
            const { error } = await supabase
                .from('purchase_orders')
                .delete()
                .in('id', idsToDelete);
            if (error)
                throw error;
            setPurchaseOrders(prev => prev.filter(po => !idsToDelete.includes(po.id)));
            setAllOrders(prev => prev.filter(po => !idsToDelete.includes(po.id)));
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
            toast.error("Permission denied: Only Purchase Officers, Executives, and Admins can update purchase order status.");
            return;
        }
        if (newStatus === 'Confirmed' && !isAdmin && !isExecutive) {
            toast.error("Permission denied: Only Administrators and Executives can set the 'Confirmed' status of purchase orders.");
            return;
        }
        if (selectedIds.size === 0) {
            toast.warning("Please select at least one purchase order");
            return;
        }
        if (newStatus === 'Cancelled') {
            const hasDelivered = Array.from(selectedIds).some(id => {
                const po = purchaseOrders.find(p => p.id === id) || allOrders.find(p => p.id === id);
                const s = (po?.status || '').toLowerCase();
                return s === 'delivered' || s === 'completed';
            });
            if (hasDelivered) {
                toast.warning("Cannot cancel purchase orders that have already been delivered.");
                return;
            }
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
            if (newStatus === 'Delivered' || newStatus === 'Completed') {
                const deliveryRes = await processDeliveredPurchaseOrdersAction(idsToUpdate, {
                    name: user.getName() || 'Warehouse Staff',
                    role: user.getRole(),
                    id: user.getId() || undefined,
                });

                if (!deliveryRes.success) {
                    throw new Error(deliveryRes.error || 'Failed to process inventory stock-in for delivered orders');
                }

                setPurchaseOrders(prev => prev.map(po => selectedIds.has(po.id) ? { ...po, status: newStatus, fully_received: true } : po));
                setAllOrders(prev => prev.map(po => selectedIds.has(po.id) ? { ...po, status: newStatus, fully_received: true } : po));
                setSelectedIds(new Set());
                setIsSelectAll(false);

                const { totalUpdated, totalCreated } = deliveryRes.summary;
                toast.success(`Updated ${idsToUpdate.length} order(s) to ${newStatus}! Inventory updated (${totalUpdated} stock updated, ${totalCreated} new items created) & stock movements recorded.`);
            } else {
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
        }
        catch (error: any) {
            console.error('Error updating purchase orders status in bulk:', error);
            toast.error(error?.message || 'Failed to update purchase orders status');
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
            toast.error("Permission denied: Only Purchase Officers, Executives, and Admins can update purchase order status.");
            return;
        }
        const targetOrder = purchaseOrders.find(p => p.id === id) || allOrders.find(p => p.id === id) || (actionModalOrder?.id === id ? actionModalOrder : null);
        const currentStatus = targetOrder?.status || 'Draft';
        if (currentStatus === newStatus)
            return;

        const STATUS_ORDER = ['Draft', 'Sent', 'Confirmed', 'Delivered', 'Completed'];
        const currentIndex = STATUS_ORDER.indexOf(currentStatus);
        const targetIndex = STATUS_ORDER.indexOf(newStatus);

        if (currentIndex !== -1 && targetIndex !== -1 && targetIndex < currentIndex) {
            toast.warning(`Cannot revert order status from "${currentStatus}" back to "${newStatus}".`);
            return;
        }

        if (newStatus === 'Cancelled' && (currentStatus.toLowerCase() === 'delivered' || currentStatus.toLowerCase() === 'completed')) {
            toast.warning(`Cannot cancel purchase order #${targetOrder?.po_number || id} because it has already been delivered.`);
            return;
        }

        // admin / exec check: Setting Confirmed status requires Admin or Executive
        if (newStatus === 'Confirmed' && !isAdmin && !isExecutive) {
            toast.error("Permission denied: Only Administrators and Executives can set the 'Confirmed' status of a purchase order.");
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
            if (newStatus === 'Delivered' || (newStatus === 'Completed' && !(targetOrder as any)?.fully_received)) {
                const deliveryRes = await processDeliveredPurchaseOrdersAction([id], {
                    name: user.getName() || 'Warehouse Staff',
                    role: user.getRole(),
                    id: user.getId() || undefined,
                });

                if (!deliveryRes.success) {
                    throw new Error(deliveryRes.error || deliveryRes.results[0]?.error || 'Failed to update inventory for delivered order');
                }

                const poRes = deliveryRes.results[0];
                const parts: string[] = [];
                if (poRes?.updatedCount) parts.push(`${poRes.updatedCount} stock updated`);
                if (poRes?.createdCount) parts.push(`${poRes.createdCount} new item(s) created`);
                const summaryInfo = parts.length > 0 ? ` (${parts.join(', ')})` : '';

                setPurchaseOrders(prev => prev.map(po => po.id === id ? { ...po, status: newStatus, fully_received: true } : po));
                setAllOrders(prev => prev.map(po => po.id === id ? { ...po, status: newStatus, fully_received: true } : po));
                if (actionModalOrder && actionModalOrder.id === id) {
                    setActionModalOrder(prev => prev ? { ...prev, status: newStatus, fully_received: true } : null);
                }
                toast.success(`PO #${targetOrder?.po_number || id} marked ${newStatus}! Inventory & stock movements updated${summaryInfo}`);
            } else {
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
        }
        catch (error: any) {
            console.error('Error updating PO status:', error);
            toast.error(error?.message || 'Failed to update PO status');
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
        const APP_URL = process.env.NEXT_PUBLIC_SUPPLYCHAIN_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
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
                    sessionStorage.setItem(cacheKey, data.message);
                    try { localStorage.removeItem(cacheKey); } catch {}
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

        let timerId: NodeJS.Timeout;
        let retryCount = 0;

        const createChart = () => {
            const canvas = poChartRef.current;
            if (!canvas) {
                if (retryCount < 5) {
                    retryCount++;
                    timerId = setTimeout(createChart, 80);
                }
                return;
            }

            // Ensure any existing chart instance on this canvas is cleanly destroyed
            const existingChart = Chart.getChart(canvas);
            if (existingChart) {
                existingChart.destroy();
            }
            if (poChartInstance.current) {
                poChartInstance.current.destroy();
                poChartInstance.current = null;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx)
                return;
            if (!Chart || datasetOrders.length === 0)
                return;

            const normalizeStatus = (rawStatus?: string): string => {
                if (!rawStatus) return 'Draft';
                const s = rawStatus.trim().toLowerCase();
                if (s === 'draft') return 'Draft';
                if (s === 'sent') return 'Sent';
                if (s === 'confirmed') return 'Confirmed';
                if (s === 'delivered') return 'Delivered';
                if (s === 'cancelled' || s === 'canceled') return 'Cancelled';
                if (s === 'rejected') return 'Rejected';
                if (s === 'pending') return 'Sent';
                if (s === 'approved') return 'Confirmed';
                return rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
            };

            const statusData: Record<string, number> = {
                'Draft': 0,
                'Sent': 0,
                'Confirmed': 0,
                'Delivered': 0,
                'Cancelled': 0,
                'Rejected': 0,
            };
            const statusOrders: Record<string, PurchaseOrder[]> = {
                'Draft': [],
                'Sent': [],
                'Confirmed': [],
                'Delivered': [],
                'Cancelled': [],
                'Rejected': [],
            };

            datasetOrders.forEach(order => {
                const normalized = normalizeStatus(order.status);
                statusData[normalized] = (statusData[normalized] || 0) + 1;
                if (!statusOrders[normalized]) {
                    statusOrders[normalized] = [];
                }
                statusOrders[normalized].push(order);
            });

            const standardStatuses = ['Draft', 'Sent', 'Confirmed', 'Delivered', 'Cancelled', 'Rejected'];
            const allKeys = Array.from(new Set([...standardStatuses, ...Object.keys(statusData)]));
            const hasAnyData = Object.values(statusData).some(count => count > 0);
            const sortedLabels = hasAnyData
                ? allKeys.filter(key => (statusData[key] || 0) > 0)
                : standardStatuses;

            const sortedData = sortedLabels.map(label => statusData[label] || 0);

            // color mapping
            const colorMap: Record<string, string> = {
                'Draft': '#64748B',      // Slate
                'Sent': '#6366F1',       // Indigo
                'Confirmed': '#8B5CF6',  // Violet / Purple
                'Delivered': '#EC4899',  // Vibrant Pink
                'Cancelled': '#F43F5E',  // Rose
                'Rejected': '#E11D48',   // Deep Rose / Red
                'Pending': '#F59E0B',    // Amber
                'Approved': '#10B981'    // Emerald
            };
            const backgroundColor = sortedLabels.map((label: string) => colorMap[label] || '#94A3B8');

            try {
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
                                        const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
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
            } catch (chartErr) {
                console.error("Error creating PO status doughnut chart:", chartErr);
            }
        };

        timerId = setTimeout(createChart, 60);

        return () => {
            clearTimeout(timerId);
            if (poChartRef.current) {
                const existing = Chart.getChart(poChartRef.current);
                if (existing) existing.destroy();
            }
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
    return (<SessionGuard requiredRole={['Superadmin', 'Admin', 'Purchase Officer']}>
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
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedRequestForPO(null);
                            setIsPurchaseOrderModalOpen(true);
                        }}
                        className="px-4 py-2.5 rounded-2xl text-xs font-bold text-white bg-gradient-to-b from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 border border-pink-400/80 shadow-[0_4px_14px_rgba(236,72,153,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)] flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
                    >
                        <i className="fas fa-plus text-[11px]" />
                        <span>Create Purchase Order</span>
                    </button>
                </div>
            </div>

            {/* ai questions */}
            <AiQuestions title="AI Suggested Questions" subtitle="Click to ask" questions={[
                {
                    question: "PO summary",
                },
                {
                    question: "Top suppliers by spend?",
                },
                {
                    question: "Delayed purchase orders?"
                },
                {
                    question: "Payment status breakdown?"
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
                        </div>) : (<div className="w-full h-full relative">
                            <canvas ref={poChartRef} className="w-full h-full cursor-pointer" />
                        </div>)}
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
                                        <td colSpan={10} className="block w-full md:table-cell py-12">
                                            <EmptyState
                                                title={activeStatusFilter !== 'all' || debouncedSearch ? "No Purchase Orders Found" : "No Purchase Orders Yet"}
                                                description={activeStatusFilter !== 'all'
                                                    ? `There are no orders with status "${activeStatusFilter}".`
                                                    : debouncedSearch
                                                        ? "Try adjusting your search terms or filter criteria."
                                                        : "Create purchase orders to start managing supplier procurements and deliveries."}
                                                icon="fas fa-file-invoice"
                                                actionText={activeStatusFilter === 'all' && !debouncedSearch ? "Create Purchase Order" : undefined}
                                                onAction={activeStatusFilter === 'all' && !debouncedSearch ? () => {
                                                    setSelectedRequestForPO(null);
                                                    setIsPurchaseOrderModalOpen(true);
                                                } : undefined}
                                                isFilterActive={activeStatusFilter !== 'all' || !!debouncedSearch}
                                                onClearSearch={() => {
                                                    setSearchTerm('');
                                                    setActiveStatusFilter('all');
                                                }}
                                            />
                                        </td>
                                    </tr>) : (filteredOrders.map((order: PurchaseOrder) => {
                                        const isRowVerifying = verifyingPoIds.has(order.id);
                                        const rowBusy = pendingRowId === order.id || isRowVerifying;
                                        const isSelected = selectedIds.has(order.id);
                                        return (<tr key={order.id} onClick={() => !rowBusy && openOrderModal(order, 'details')} className={`group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${rowBusy ? "opacity-60 cursor-not-allowed" : "cursor-pointer"} ${isSelected ? "bg-pink-50/30 dark:bg-pink-950/20" : "bg-transparent"}`}>
                                            <td data-label="Select" className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
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

                                                    {/* view order details */}
                                                    <CrudActionButton
                                                        action="custom"
                                                        label="View"
                                                        icon={Eye}
                                                        disabled={rowBusy}
                                                        ariaLabel="View Purchase Order Details"
                                                        title="View Purchase Order Details"
                                                        onClick={() => openOrderModal(order, 'details')}
                                                    />

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
                                                    <CrudActionButton action="custom" label="Manage" icon={MoreHorizontal} disabled={rowBusy} ariaLabel="Manage Purchase Order" title="Manage Purchase Order" onClick={() => openOrderModal(order, 'manage')} />
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

            {/* po modal */}
            <PurchaseOrderModal isOpen={isPurchaseOrderModalOpen} onClose={() => {
                setIsPurchaseOrderModalOpen(false);
                setSelectedRequestForPO(null);
            }} request={selectedRequestForPO} suppliers={suppliers} onOrderCreated={handleOrderCreated} />

            {/* chart detail */}
            <ChartDetailModal isOpen={chartDetailModal.isOpen} onClose={() => setChartDetailModal(prev => ({ ...prev, isOpen: false }))} month={chartDetailModal.month} monthIndex={chartDetailModal.monthIndex} orders={chartDetailModal.orders} totalAmount={chartDetailModal.totalAmount} />

            {/* Purchase Order Details Modal */}
            {actionModalOrder && (
                <Portal>
                    <div className="fixed inset-0 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md flex items-center justify-center z-[99999] p-3 sm:p-4 animate-in fade-in duration-200" onClick={() => setActionModalOrder(null)}>
                        <div className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-[12px_12px_36px_rgba(166,175,195,0.45),-12px_-12px_36px_rgba(255,255,255,0.95)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.8),-4px_-4px_12px_rgba(255,255,255,0.03)] border border-white/90 dark:border-white/[0.08] overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>

                            {/* Header */}
                            <div className="px-6 py-4 border-b border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/30">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-11 h-11 rounded-2xl bg-pink-600 border border-pink-400/80 text-white flex items-center justify-center text-lg shrink-0 shadow-[3px_3px_7px_rgba(219,39,119,0.35),inset_0_1px_1.5px_rgba(255,255,255,0.4)]">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                                                Purchase Order Details
                                            </h2>
                                            <span className="font-mono text-xs font-bold text-pink-600 dark:text-pink-400 bg-[#ebf0f7] dark:bg-[#14151e] px-2.5 py-0.5 rounded-full border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                                #{actionModalOrder.po_number}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                            {actionModalOrder.supplier_name} • <span className="font-bold text-slate-800 dark:text-slate-200">₱{Number(actionModalOrder.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDigitalReceiptPO(actionModalOrder);
                                            setIsDigitalReceiptModalOpen(true);
                                        }}
                                        className="hidden sm:inline-flex px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-[#ebf0f7] hover:bg-[#e4ebf5] dark:bg-[#1e1f2c] dark:hover:bg-[#252738] border border-white/80 dark:border-white/[0.08] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                                        title="View & Print Digital Receipt"
                                    >
                                        <Receipt className="h-3.5 w-3.5 text-pink-500" />
                                        <span>Digital Receipt</span>
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isSendingActionComm}
                                        onClick={() => setActionModalOrder(null)}
                                        className="w-8 h-8 rounded-full bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                                        aria-label="Close modal"
                                    >
                                        <i className="fas fa-times text-xs" />
                                    </button>
                                </div>
                            </div>

                            {/* Segmented Tabs Bar */}
                            <div className="px-6 pt-3 pb-0 bg-slate-100/60 dark:bg-slate-900/40 border-b border-slate-200/70 dark:border-slate-800 flex gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setActionModalTab('details')}
                                    className={`px-4 py-2 text-xs font-bold rounded-t-xl border-t border-x transition-all flex items-center gap-2 cursor-pointer ${
                                        actionModalTab === 'details'
                                            ? 'bg-[#f0f3f8] dark:bg-[#161722] text-pink-600 dark:text-pink-400 border-white/90 dark:border-white/[0.08] border-b-transparent shadow-[0_-2px_6px_rgba(166,175,195,0.2)]'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border-transparent'
                                    }`}
                                >
                                    <i className="fas fa-file-lines text-xs" />
                                    <span>Overview & Line Items</span>
                                    {actionModalOrder.items && actionModalOrder.items.length > 0 && (
                                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-pink-100 dark:bg-pink-950/80 text-pink-700 dark:text-pink-300 font-mono">
                                            {actionModalOrder.items.length}
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActionModalTab('manage')}
                                    className={`px-4 py-2 text-xs font-bold rounded-t-xl border-t border-x transition-all flex items-center gap-2 cursor-pointer ${
                                        actionModalTab === 'manage'
                                            ? 'bg-[#f0f3f8] dark:bg-[#161722] text-pink-600 dark:text-pink-400 border-white/90 dark:border-white/[0.08] border-b-transparent shadow-[0_-2px_6px_rgba(166,175,195,0.2)]'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border-transparent'
                                    }`}
                                >
                                    <i className="fas fa-sliders text-xs" />
                                    <span>Status & Management</span>
                                    <StatusBadge tone={getPOStatusTone(actionModalOrder.status)} size="xs">
                                        {actionModalOrder.status}
                                    </StatusBadge>
                                </button>
                            </div>

                            {/* Content Body */}
                            <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
                                {actionModalTab === 'details' ? (
                                    <>
                                        {/* 4 Summary Metric Cards */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)]">
                                                <span className="text-[10px] uppercase font-extrabold text-slate-400 dark:text-slate-500 block tracking-wider">Total Amount</span>
                                                <span className="text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5 block">
                                                    ₱{Number(actionModalOrder.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)]">
                                                <span className="text-[10px] uppercase font-extrabold text-slate-400 dark:text-slate-500 block tracking-wider">Due / Delivery</span>
                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                                                    {actionModalOrder.delivery_date ? new Date(actionModalOrder.delivery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Standard Schedule'}
                                                </span>
                                            </div>
                                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)]">
                                                <span className="text-[10px] uppercase font-extrabold text-slate-400 dark:text-slate-500 block tracking-wider mb-1">Status</span>
                                                <StatusBadge tone={getPOStatusTone(actionModalOrder.status)} size="xs">
                                                    {actionModalOrder.status}
                                                </StatusBadge>
                                            </div>
                                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)]">
                                                <span className="text-[10px] uppercase font-extrabold text-slate-400 dark:text-slate-500 block tracking-wider mb-1">Payment</span>
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

                                        {/* Entity Information (Buyer & Supplier Panels) */}
                                        {(() => {
                                            const matchedSupplier = suppliers.find(
                                                s => s.id === actionModalOrder.supplier_id || s.name?.toLowerCase() === actionModalOrder.supplier_name?.toLowerCase()
                                            );
                                            const supplierLocation = actionModalOrder.supplier_location || matchedSupplier?.location || actionModalOrder.supplier_address || 'On File / Registered Supplier Facility';
                                            const isFinancialApproved = (actionModalOrder.financial_approval === 'Approved' || actionModalOrder.admin_approval === 'Approved') &&
                                                                        actionModalOrder.financial_approval !== 'Pending' &&
                                                                        actionModalOrder.admin_approval !== 'Pending';
                                            const approvalDateStr = actionModalOrder.financial_approved_at
                                                ? new Date(actionModalOrder.financial_approved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                : actionModalOrder.admin_approved_at
                                                    ? new Date(actionModalOrder.admin_approved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                    : actionModalOrder.created_at
                                                        ? new Date(actionModalOrder.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                        : '—';

                                            return (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                                    {/* Buyer (Issuer) Card */}
                                                    <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)]">
                                                        <div className="flex items-center gap-2 mb-1.5 text-pink-600 dark:text-pink-400">
                                                            <i className="fas fa-building text-xs" />
                                                            <span className="text-[10px] font-extrabold uppercase tracking-wider">Buyer (Issuer)</span>
                                                        </div>
                                                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                                                            Airship Express Logistics Corp.
                                                        </p>
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                            Procurement & Supply Chain Division
                                                        </p>
                                                        <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                                                            <i className="fas fa-map-marker-alt text-pink-500 mt-0.5 text-[10px] shrink-0" />
                                                            <span className="leading-tight">
                                                                <strong className="text-slate-700 dark:text-slate-300">Location:</strong> {actionModalOrder.delivery_location || '352 Escolta St, Binondo, Manila, 1006 Metro Manila (Airship Express Central Hub)'}
                                                            </span>
                                                        </div>
                                                        <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                                            <span>Authorized Signatory:</span>
                                                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">{(actionModalOrder as any).created_by || 'Authorized Officer'}</span>
                                                        </div>
                                                    </div>

                                                    {/* Supplier / Vendor Card */}
                                                    <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)]">
                                                        <div className="flex items-center gap-2 mb-1.5 text-pink-600 dark:text-pink-400">
                                                            <i className="fas fa-truck text-xs" />
                                                            <span className="text-[10px] font-extrabold uppercase tracking-wider">Supplier / Vendor</span>
                                                        </div>
                                                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                                            {actionModalOrder.supplier_name}
                                                        </p>
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate font-mono">
                                                            {actionSupplierEmail || (actionModalOrder as any).supplier_email || 'Verified Partner'}
                                                        </p>
                                                        <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                                                            <i className="fas fa-map-marker-alt text-pink-500 mt-0.5 text-[10px] shrink-0" />
                                                            <span className="leading-tight truncate" title={supplierLocation}>
                                                                <strong className="text-slate-700 dark:text-slate-300">Location:</strong> {supplierLocation}
                                                            </span>
                                                        </div>
                                                        <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                                            <span>Issue Date:</span>
                                                            {isFinancialApproved ? (
                                                                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                                                    <i className="fas fa-calendar-check text-[10px] text-emerald-500" />
                                                                    {approvalDateStr}
                                                                </span>
                                                            ) : (
                                                                <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-950/40 px-2 py-0.5 rounded-full text-[10px] border border-amber-300 dark:border-amber-700/60 flex items-center gap-1">
                                                                    <i className="fas fa-hourglass-half text-[9px]" />
                                                                    Pending
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Full Itemized Line Items Table */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                                    <i className="fas fa-boxes-stacked text-pink-500" />
                                                    <span>Purchased Line Items</span>
                                                </div>
                                                <span className="text-xs font-bold text-pink-600 dark:text-pink-400 px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/80 border border-pink-200 dark:border-pink-900/50">
                                                    {Array.isArray(actionModalOrder.items) && actionModalOrder.items.length > 0 ? actionModalOrder.items.length : 1} {Array.isArray(actionModalOrder.items) && actionModalOrder.items.length === 1 ? 'item' : 'items'}
                                                </span>
                                            </div>

                                            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-[#ebf0f7] dark:bg-[#13141c] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)]">
                                                <table className="w-full text-left text-xs border-collapse">
                                                    <thead>
                                                        <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-white/[0.02] text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                            <th className="py-2.5 px-3.5 w-12 text-center">#</th>
                                                            <th className="py-2.5 px-3.5">Item Description</th>
                                                            <th className="py-2.5 px-3.5 text-center w-20">Qty</th>
                                                            <th className="py-2.5 px-3.5 text-right w-28">Unit Price</th>
                                                            <th className="py-2.5 px-3.5 text-right w-32">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300 font-medium">
                                                        {Array.isArray(actionModalOrder.items) && actionModalOrder.items.length > 0 ? (
                                                            actionModalOrder.items.map((it: any, idx: number) => {
                                                                const qty = Number(it.quantity) || 1;
                                                                const price = Number(it.unit_price ?? it.price ?? 0);
                                                                const lineTotal = it.total ? Number(it.total) : (it.total_price ? Number(it.total_price) : qty * price);

                                                                return (
                                                                    <tr key={idx} className="hover:bg-white/40 dark:hover:bg-white/[0.02] transition-colors">
                                                                        <td className="py-2.5 px-3.5 text-center text-slate-400 font-mono text-xs">
                                                                            {idx + 1}
                                                                        </td>
                                                                        <td className="py-2.5 px-3.5 font-bold text-slate-900 dark:text-white">
                                                                            {it.name || it.item_name || it.description || 'Purchased Item'}
                                                                        </td>
                                                                        <td className="py-2.5 px-3.5 text-center">
                                                                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-white/70 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-white/60 dark:border-white/[0.04]">
                                                                                {qty}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-2.5 px-3.5 text-right font-mono text-slate-600 dark:text-slate-400">
                                                                            ₱{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        </td>
                                                                        <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                                                                            ₱{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })
                                                        ) : (
                                                            <tr>
                                                                <td className="py-2.5 px-3.5 text-center text-slate-400 font-mono text-xs">1</td>
                                                                <td className="py-2.5 px-3.5 font-bold text-slate-900 dark:text-white">
                                                                    {actionModalOrder.notes || 'Requisition Order Package'}
                                                                </td>
                                                                <td className="py-2.5 px-3.5 text-center font-mono text-xs">1</td>
                                                                <td className="py-2.5 px-3.5 text-right font-mono">
                                                                    ₱{Number(actionModalOrder.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </td>
                                                                <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                                                                    ₱{Number(actionModalOrder.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                    <tfoot>
                                                        {(actionModalOrder.subtotal !== undefined || actionModalOrder.discount || actionModalOrder.shipping_fee || actionModalOrder.tax_amount) ? (
                                                            <>
                                                                <tr className="border-t border-slate-200/80 dark:border-slate-800 bg-white/30 dark:bg-white/[0.01]">
                                                                    <td colSpan={3} className="py-1.5 px-3.5 text-xs text-slate-500 font-medium">Subtotal</td>
                                                                    <td colSpan={2} className="py-1.5 px-3.5 text-right font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                                        ₱{Number(actionModalOrder.subtotal ?? actionModalOrder.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </td>
                                                                </tr>
                                                                {Number(actionModalOrder.discount || 0) > 0 && (
                                                                    <tr className="border-t border-slate-200/40 dark:border-slate-800/40 bg-white/30 dark:bg-white/[0.01]">
                                                                        <td colSpan={3} className="py-1.5 px-3.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">Discount</td>
                                                                        <td colSpan={2} className="py-1.5 px-3.5 text-right font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                                                            -₱{Number(actionModalOrder.discount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                                {Number(actionModalOrder.shipping_fee || 0) > 0 && (
                                                                    <tr className="border-t border-slate-200/40 dark:border-slate-800/40 bg-white/30 dark:bg-white/[0.01]">
                                                                        <td colSpan={3} className="py-1.5 px-3.5 text-xs text-slate-500 font-medium">Shipping Fee</td>
                                                                        <td colSpan={2} className="py-1.5 px-3.5 text-right font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                                            +₱{Number(actionModalOrder.shipping_fee).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                                {Number(actionModalOrder.tax_amount || 0) > 0 && (
                                                                    <tr className="border-t border-slate-200/40 dark:border-slate-800/40 bg-white/30 dark:bg-white/[0.01]">
                                                                        <td colSpan={3} className="py-1.5 px-3.5 text-xs text-slate-500 font-medium">VAT ({actionModalOrder.tax_rate ?? 12}%)</td>
                                                                        <td colSpan={2} className="py-1.5 px-3.5 text-right font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                                            +₱{Number(actionModalOrder.tax_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                                <tr className="border-t-2 border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-white/[0.02]">
                                                                    <td colSpan={3} className="py-2.5 px-3.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                                                                        Total Order Value
                                                                    </td>
                                                                    <td colSpan={2} className="py-2.5 px-3.5 text-right font-mono text-base font-black text-pink-600 dark:text-pink-400">
                                                                        ₱{Number(actionModalOrder.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </td>
                                                                </tr>
                                                            </>
                                                        ) : (
                                                            <tr className="border-t-2 border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-white/[0.01]">
                                                                <td colSpan={3} className="py-2.5 px-3.5 text-xs font-bold text-slate-500 uppercase">
                                                                    Total Order Value
                                                                </td>
                                                                <td colSpan={2} className="py-2.5 px-3.5 text-right font-mono text-base font-black text-pink-600 dark:text-pink-400">
                                                                    ₱{Number(actionModalOrder.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tfoot>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Commercial Logistics & Payment Terms Panel */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-1">
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                                    Payment Terms & Method
                                                </span>
                                                <p className="font-bold text-slate-900 dark:text-white">
                                                    {actionModalOrder.payment_terms || 'Net 30 Days (Standard B2B)'}
                                                </p>
                                            </div>

                                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-1">
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                                    Procurement Category
                                                </span>
                                                <p className="font-bold text-slate-900 dark:text-white">
                                                    {actionModalOrder.category || (actionModalOrder as any).items?.[0]?.category || 'General Procurement'}
                                                </p>
                                            </div>

                                            <div className="sm:col-span-2 md:col-span-1 p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-1">
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                                    Delivery Location / Hub
                                                </span>
                                                <p className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-2" title={actionModalOrder.delivery_location || 'Airship Express Hub'}>
                                                    {actionModalOrder.delivery_location || '352 Escolta St, Binondo, Manila, 1006 Metro Manila(Airship Express)'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Terms & Conditions Box */}
                                        {actionModalOrder.terms_and_conditions && (
                                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] text-xs space-y-1.5">
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                                    Governing Terms & Conditions
                                                </span>
                                                <p className="font-mono text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                                    {actionModalOrder.terms_and_conditions}
                                                </p>
                                            </div>
                                        )}

                                        {/* Requisition Notes Box */}
                                        {actionModalOrder.notes && (
                                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#13141c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] text-xs space-y-1.5">
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                                    Requisition Notes & Instructions
                                                </span>
                                                <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                                    {actionModalOrder.notes}
                                                </p>
                                            </div>
                                        )}

                                        {/* Action Buttons Toolbar */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDigitalReceiptPO(actionModalOrder);
                                                    setIsDigitalReceiptModalOpen(true);
                                                }}
                                                className="py-2.5 px-4 text-xs font-bold text-white bg-pink-600 hover:bg-pink-500 border border-pink-400/80 rounded-xl shadow-[3px_3px_7px_rgba(219,39,119,0.35),inset_0_1px_1.5px_rgba(255,255,255,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                                            >
                                                <Receipt className="h-4 w-4" />
                                                <span>View & Print Official Digital Receipt</span>
                                            </button>

                                            {(actionModalOrder.verification?.uploaded_file_url || actionModalOrder.document?.storage_path) ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setViewingDocData({
                                                            id: actionModalOrder.document?.id || actionModalOrder.verification?.id,
                                                            title: actionModalOrder.document?.title || `Receipt - PO #${actionModalOrder.po_number}`,
                                                            fileName: actionModalOrder.document?.file_name || `receipt_${actionModalOrder.po_number}.png`,
                                                            fileUrl: actionModalOrder.verification?.uploaded_file_url,
                                                            storagePath: actionModalOrder.document?.storage_path,
                                                            fileType: actionModalOrder.document?.file_type,
                                                            poNumber: actionModalOrder.po_number,
                                                            supplierName: actionModalOrder.supplier_name,
                                                            verifiedStatus: actionModalOrder.verification?.match_result,
                                                            totalAmount: actionModalOrder.total_amount,
                                                            notes: actionModalOrder.document?.notes || (actionModalOrder.verification?.match_result === 'matched' ? 'OCR Verified Matched' : undefined),
                                                            uploadedBy: actionModalOrder.document?.uploaded_by,
                                                        });
                                                        setIsDocViewerOpen(true);
                                                    }}
                                                    className="py-2.5 px-4 text-xs font-bold text-slate-700 dark:text-slate-200 bg-[#ebf0f7] dark:bg-[#1a1b26] hover:text-pink-600 dark:hover:text-pink-400 border border-white/80 dark:border-[#2a2b38] rounded-xl shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                                                >
                                                    <FileText className="h-4 w-4 text-pink-500" />
                                                    <span>View Verified Receipt Doc</span>
                                                </button>
                                            ) : actionModalOrder.status === 'Delivered' && !(actionModalOrder.paid || actionModalOrder.verification?.match_result === 'matched') ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setReceiptModalPO(actionModalOrder);
                                                        setReceiptVerificationId(null);
                                                        setIsReceiptModalOpen(true);
                                                        setActionModalOrder(null);
                                                    }}
                                                    className="py-2.5 px-4 text-xs font-bold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 bg-[#ebf0f7] dark:bg-[#1a1b26] border border-pink-200/80 dark:border-pink-900/40 rounded-xl shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                                                >
                                                    <i className="fas fa-upload text-pink-500" />
                                                    <span>Upload Receipt & Verify (OCR)</span>
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setActionModalTab('manage')}
                                                    className="py-2.5 px-4 text-xs font-bold text-slate-700 dark:text-slate-200 bg-[#ebf0f7] dark:bg-[#1a1b26] hover:text-pink-600 dark:hover:text-pink-400 border border-white/80 dark:border-[#2a2b38] rounded-xl shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                                                >
                                                    <i className="fas fa-sliders text-pink-500" />
                                                    <span>Manage Status & Dispatch</span>
                                                </button>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* Send options (for draft orders) */}
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

                                                {actionEmailMode === 'standard' ? (
                                                    <div className="bg-[#e9eef6] dark:bg-[#13141d] rounded-xl p-3.5 border border-white/60 dark:border-white/[0.04] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] text-xs text-slate-700 dark:text-slate-300">
                                                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                                                            "Hello <strong>{actionModalOrder.supplier_name}</strong>, please review and accept this official purchase order for the listed items. Confirm availability at your earliest convenience."
                                                        </p>
                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1 font-medium">
                                                            <i className="fas fa-check-circle text-emerald-500 text-[9px]" />
                                                            Includes line items breakdown & confirmation link.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="bg-[#e9eef6] dark:bg-[#13141d] rounded-xl p-3.5 border border-indigo-100/80 dark:border-indigo-900/40 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                                                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-300/60 dark:border-white/[0.06]">
                                                            <span className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                                                                <i className="fas fa-robot text-[9px]" /> AI Explanation
                                                            </span>
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
                                                                            sessionStorage.setItem(cacheKey, e.target.value);
                                                                            try { localStorage.removeItem(cacheKey); } catch {}
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

                                        {/* Status transition section */}
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
                                                        <i className="fas fa-lock text-[9px]" /> Purchase Officers, Execs & Admins Only
                                                    </span>
                                                ) : null}
                                            </div>

                                            <div className="grid grid-cols-1 gap-2">
                                                {['Delivered', 'Cancelled'].map((status) => {
                                                    const isCurrent = actionModalOrder.status === status;
                                                    const isOrderCancelled = actionModalOrder.status === 'Cancelled';
                                                    const isRestricted = !canUpdateStatus;
                                                    const isOrderDelivered = ['delivered', 'completed'].includes((actionModalOrder.status || '').toLowerCase());
                                                    const isCancelDisabledAfterDelivered = status === 'Cancelled' && isOrderDelivered;
                                                    const isDisabled = pendingRowId === actionModalOrder.id || isCurrent || isRestricted || isSendingActionComm || isOrderCancelled || isCancelDisabledAfterDelivered;

                                                    const getStatusIcon = () => {
                                                        switch (status) {
                                                            case 'Delivered': return 'fa-truck-ramp-box';
                                                            case 'Cancelled': return 'fa-ban';
                                                            default: return 'fa-tag';
                                                        }
                                                    };

                                                    const getStatusSubtitle = () => {
                                                        switch (status) {
                                                            case 'Delivered': return 'Mark items received at facility';
                                                            case 'Cancelled':
                                                                if (isCancelDisabledAfterDelivered) return 'Cannot cancel delivered purchase order';
                                                                return 'Void / Cancel purchase order';
                                                            default: return '';
                                                        }
                                                    };

                                                    const getIconStyle = () => {
                                                        if (isCurrent) {
                                                            return 'bg-pink-500/15 text-pink-600 dark:text-pink-400 border border-pink-500/30 shadow-xs';
                                                        }
                                                        switch (status) {
                                                            case 'Delivered': return 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
                                                            case 'Cancelled': return 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20';
                                                            default: return 'bg-slate-200 dark:bg-slate-800 text-slate-500';
                                                        }
                                                    };

                                                    return (
                                                        <button
                                                            key={status}
                                                            type="button"
                                                            disabled={isDisabled}
                                                            onClick={() => handleUpdateStatus(actionModalOrder.id, status)}
                                                            className={`group w-full px-3.5 py-2.5 rounded-2xl text-xs transition-all flex items-center justify-between border ${isCurrent
                                                                ? 'bg-[#e2e8f0]/80 dark:bg-[#101118] border-pink-400/60 dark:border-pink-500/50 shadow-[inset_2px_2px_4px_rgba(166,175,195,0.4)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] cursor-default'
                                                                : isRestricted || isOrderCancelled || isCancelDisabledAfterDelivered
                                                                    ? 'bg-[#ebf0f7]/50 dark:bg-[#14151e]/50 border-slate-200/40 dark:border-slate-800/40 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.15)]'
                                                                    : 'bg-[#f0f3f8] dark:bg-[#1a1b26] border-white/80 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.03)] hover:border-pink-300 dark:hover:border-pink-500/40 hover:text-pink-600 dark:hover:text-pink-400 text-slate-700 dark:text-slate-200 active:scale-[0.98] cursor-pointer'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-3 text-left">
                                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${getIconStyle()}`}>
                                                                    <i className={`fas ${getStatusIcon()} text-xs`} />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold text-slate-800 dark:text-slate-100 text-xs leading-tight">{status}</span>
                                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal leading-tight mt-0.5">{getStatusSubtitle()}</span>
                                                                </div>
                                                            </div>

                                                            {isCurrent ? (
                                                                <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-xl bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-300/80 dark:border-pink-900/50 tracking-wider shadow-xs">
                                                                    Current ✓
                                                                </span>
                                                            ) : isRestricted ? (
                                                                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                                                    <i className="fas fa-lock text-[9px]" /> Locked
                                                                </span>
                                                            ) : isOrderCancelled ? (
                                                                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                                                    <i className="fas fa-ban text-[9px]" /> Voided
                                                                </span>
                                                            ) : isCancelDisabledAfterDelivered ? (
                                                                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                                                    <i className="fas fa-lock text-[9px]" /> Delivered
                                                                </span>
                                                            ) : (
                                                                <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 group-hover:text-pink-600 dark:group-hover:text-pink-400 group-hover:translate-x-0.5 transition-all">
                                                                    <span>Apply</span>
                                                                    <i className="fas fa-chevron-right text-[9px]" />
                                                                </div>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Delete purchase order button */}
                                        {(() => {
                                            const isPOLocked = ['sent', 'confirmed', 'delivered', 'completed'].includes((actionModalOrder.status || '').toLowerCase());
                                            return (
                                                <div className="pt-2">
                                                    <button
                                                        type="button"
                                                        disabled={pendingRowId === actionModalOrder.id || isSendingActionComm || isPOLocked}
                                                        onClick={() => handleDeleteOrder(actionModalOrder.id)}
                                                        title={isPOLocked ? `This order is in "${actionModalOrder.status}" status and is permanently locked against deletion.` : "Delete Purchase Order"}
                                                        className={`w-full py-2.5 px-4 text-xs font-bold rounded-2xl transition-all flex items-center justify-center gap-2 border ${
                                                            isPOLocked
                                                                ? 'bg-[#ebf0f7]/50 dark:bg-[#14151e]/50 border-slate-200/40 dark:border-slate-800/40 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.15)]'
                                                                : 'text-rose-600 dark:text-rose-400 bg-[#ebf0f7] dark:bg-[#14151e] hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200/70 dark:border-rose-900/40 shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.03)] cursor-pointer active:scale-95'
                                                        }`}
                                                    >
                                                        {pendingRowId === actionModalOrder.id ? (
                                                            <i className="fas fa-spinner fa-spin text-xs" />
                                                        ) : isPOLocked ? (
                                                            <i className="fas fa-lock text-xs" />
                                                        ) : (
                                                            <i className="fas fa-trash-alt text-xs" />
                                                        )}
                                                        <span>{isPOLocked ? `Order Locked (${actionModalOrder.status})` : 'Delete Purchase Order'}</span>
                                                    </button>
                                                </div>
                                            );
                                        })()}
                                    </>
                                )}
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

            {/* chart detail modal */}
            <ChartDetailModal
                isOpen={chartDetailModal.isOpen}
                onClose={() => setChartDetailModal(prev => ({ ...prev, isOpen: false }))}
                month={chartDetailModal.month}
                monthIndex={chartDetailModal.monthIndex}
                orders={chartDetailModal.orders}
                totalAmount={chartDetailModal.totalAmount}
            />
        </div>
    </SessionGuard>);
}
