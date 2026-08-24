// app/(supplyChain)/(pages)/purchase-orders/page.tsx

"use client";

// ============================================================
// 1. IMPORTS
// ============================================================
import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Chart from "chart.js/auto";
import { supabase } from "@/app/(supplyChain)/lib/services/client/supabase";
import { toast } from "sonner";
import { useDebounce } from "@/app/(supplyChain)/hooks/useDebounce";
import { useConfirm } from "@/app/(supplyChain)/components/ui/ConfirmModal";
import { sanitizeText, sanitizeNumber } from "@/app/(supplyChain)/components/global/sanitize";
import { PageSkeleton } from "@/app/(supplyChain)/components/ui/SkeletonLoader";
import { Pagination } from "@/app/(supplyChain)/components/global/pagination";
import { SessionGuard } from "@/app/(supplyChain)/components/server/SessionGuard";
import { TableContentLoader } from "@/app/(supplyChain)/components/global/Loader";
import Cards from "@/app/(supplyChain)/components/global/Cards";
import { PurchaseOrderModal } from "@/app/(supplyChain)/components/modals/PurchaseOrderModal";
import { ApprovedRequestsModal } from "@/app/(supplyChain)/components/modals/ApprovedRequestsModal";
import { PurchaseRequestModal } from "@/app/(supplyChain)/components/modals/PurchaseRequestModal";
import { ChartDetailModal } from "@/app/(supplyChain)/components/modals/ChartDetailModal";
import { createPurchaseRequest } from "@/app/(supplyChain)/(pages)/procurement/utils/procurementApi";
import AiQuestions from "@/app/(supplyChain)/components/global/AiQuestions";
import { user } from "@/app/(supplyChain)/lib/services/Class/user";
import { buildEmailTemplate } from "@/app/(supplyChain)/(pages)/procurement/api/send-email/template";
import { UploadReceiptModal, VerificationJob } from "@/app/(supplyChain)/components/modals/UploadReceiptModal";
import { ReceiptProcessingIndicator } from "@/app/(supplyChain)/components/global/ReceiptProcessingIndicator";
import { CrudActionButton } from "@/app/(supplyChain)/components/ui/CrudActionButton";
import { AppButton } from "@/app/(supplyChain)/components/ui/AppButton";
import { FileText, MoreHorizontal } from "lucide-react";
import DocumentViewerModal, { ViewDocumentData } from "@/app/(supplyChain)/components/modals/DocumentViewerModal";
import { StatusBadge, getPOStatusTone } from "@/app/(supplyChain)/components/ui/StatusBadge";

// ============================================================
// 2. TYPES & INTERFACES
// ============================================================
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

// ============================================================
// 3. UTILITY FUNCTIONS
// ============================================================
const formatCurrency = (amount: number) => `₱${amount.toLocaleString()}`;



// ============================================================
// 4. EMPTY STATE COMPONENT
// ============================================================
function EmptyState({
    title,
    description,
    icon = "fas fa-file-invoice",
    actionText,
    onAction,
    onClearSearch,
    isFilterActive = false,
}: {
    title?: string;
    description?: string;
    icon?: string;
    actionText?: string;
    onAction?: () => void;
    onClearSearch?: () => void;
    isFilterActive?: boolean;
}) {
    const displayTitle = title || (isFilterActive ? "No Purchase Orders Found" : "No Purchase Orders Yet");
    const displayDescription = description || (
        isFilterActive
            ? "Try adjusting your search terms or filter criteria to find what you're looking for."
            : "Create purchase requests or generate purchase orders to start managing your procurement."
    );

    return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-pink-50 dark:bg-pink-950/40 flex items-center justify-center mb-4 text-pink-600 dark:text-pink-400">
                <i className={`${icon} text-2xl`} />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
                {displayTitle}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                {displayDescription}
            </p>
            <div className="flex items-center gap-3">
                {actionText && onAction && (
                    <button
                        onClick={onAction}
                        className="px-4 py-2 text-xs font-semibold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/40 hover:bg-pink-100 dark:hover:bg-pink-900/50 border border-pink-200 dark:border-pink-800/40 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                    >
                        <i className="fas fa-plus text-[10px]" />
                        <span>{actionText}</span>
                    </button>
                )}
                {isFilterActive && onClearSearch && (
                    <button
                        onClick={onClearSearch}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all"
                    >
                        Clear Filters
                    </button>
                )}
            </div>
        </div>
    );
}

// ============================================================
// 5. MAIN PURCHASE ORDERS COMPONENT
// ============================================================
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

    // Selection & Bulk actions
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isSelectAll, setIsSelectAll] = useState(false);

    // Manage PO Action Modal (Status & Delete & Communication)
    const [actionModalOrder, setActionModalOrder] = useState<PurchaseOrder | null>(null);
    const [actionModalAiMessage, setActionModalAiMessage] = useState('');
    const [isGeneratingActionAI, setIsGeneratingActionAI] = useState(false);
    const [actionSupplierEmail, setActionSupplierEmail] = useState('');
    const [actionSupplierMessenger, setActionSupplierMessenger] = useState('');
    const [isSendingActionComm, setIsSendingActionComm] = useState(false);

    // Phase 4: OCR Receipt Verification Modal & Minimized Indicator states
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [receiptModalPO, setReceiptModalPO] = useState<PurchaseOrder | null>(null);
    const [receiptVerificationId, setReceiptVerificationId] = useState<string | null>(null);
    const [activeVerificationJob, setActiveVerificationJob] = useState<VerificationJob | null>(null);
    const [viewingDocData, setViewingDocData] = useState<ViewDocumentData | null>(null);
    const [isDocViewerOpen, setIsDocViewerOpen] = useState(false);
    const ACTIVE_OCR_STORAGE_KEY = 'supplychain_active_verification_job';

    // Load active verification job from localStorage on initial render
    useEffect(() => {
        try {
            const saved = localStorage.getItem(ACTIVE_OCR_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                setActiveVerificationJob(parsed);
            }
        } catch (e) {
            console.error('Failed to load saved verification job', e);
        }
    }, []);

    const updateActiveVerificationJob = useCallback((job: VerificationJob | null) => {
        setActiveVerificationJob(job);
        try {
            if (job) {
                localStorage.setItem(ACTIVE_OCR_STORAGE_KEY, JSON.stringify(job));
            } else {
                localStorage.removeItem(ACTIVE_OCR_STORAGE_KEY);
            }
        } catch (e) {
            console.error('Failed to persist verification job', e);
        }
    }, []);

    const handledDeepLinkRef = useRef<string | null>(null);

    // Deep link detection for ?po_id= and ?verification=
    useEffect(() => {
        const poParam = searchParams.get('po_id');
        const verificationParam = searchParams.get('verification');
        if (!poParam && !verificationParam) return;

        const deepLinkKey = `${poParam || ''}_${verificationParam || ''}`;
        if (handledDeepLinkRef.current === deepLinkKey) return;

        const combinedList = [...purchaseOrders, ...allOrders];
        if (combinedList.length === 0) return;

        handledDeepLinkRef.current = deepLinkKey;

        if (poParam) {
            const target = combinedList.find(p => p.id === poParam);
            if (target) {
                // If PO is already verified/matched, forced, paid, or has an approved document:
                if (
                    target.verification?.match_result === 'matched' ||
                    target.verification?.match_result === 'forced' ||
                    target.paid ||
                    target.document
                ) {
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
                } else if (target.verification?.match_result === 'mismatched' || verificationParam) {
                    // Open OCR mismatch review modal
                    setReceiptModalPO(target);
                    setReceiptVerificationId(target.verification?.id || verificationParam || null);
                    setIsReceiptModalOpen(true);
                } else {
                    // Fresh upload required
                    setReceiptModalPO(target);
                    setReceiptVerificationId(null);
                    setIsReceiptModalOpen(true);
                }
            }
        } else if (verificationParam) {
            setReceiptVerificationId(verificationParam);
            const target = combinedList.find(p => p.verification?.id === verificationParam) || combinedList[0];
            if (target) {
                setReceiptModalPO(target);
            }
            setIsReceiptModalOpen(true);
        }
    }, [searchParams, purchaseOrders, allOrders]);

    // Fetch supplier info & reset communication states when actionModalOrder changes
    useEffect(() => {
        if (actionModalOrder) {
            setActionModalAiMessage('');
            setActionSupplierEmail('');
            setActionSupplierMessenger('');

            const fetchSupplierDetails = async () => {
                try {
                    let supplierId = actionModalOrder.supplier_id;
                    if (!supplierId && actionModalOrder.supplier_name) {
                        const { data } = await supabase
                            .from('suppliers')
                            .select('id, email, fb_link')
                            .eq('name', actionModalOrder.supplier_name)
                            .maybeSingle();
                        if (data) {
                            setActionSupplierEmail(data.email || '');
                            setActionSupplierMessenger(data.fb_link || '');
                        }
                        return;
                    }

                    if (supplierId) {
                        const { data, error } = await supabase
                            .from('suppliers')
                            .select('email, fb_link')
                            .eq('id', supplierId)
                            .maybeSingle();

                        if (!error && data) {
                            setActionSupplierEmail(data.email || '');
                            setActionSupplierMessenger(data.fb_link || '');
                        }
                    }
                } catch (err) {
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
            } else {
                setItemsPerPage(15);
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // ============================================================
    // FETCH DATA
    // ============================================================
    const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
        const silent = opts?.silent ?? false;

        try {
            if (!silent && !hasLoadedOnceRef.current) {
                setLoading(true);
            } else if (!silent) {
                setIsRefreshing(true);
            }

            // Build query
            let query = supabase
                .from('purchase_orders')
                .select('*', { count: 'exact' });

            // Apply status filter
            if (activeStatusFilter !== 'all') {
                query = query.eq('status', activeStatusFilter);
            }

            // Apply search filter
            if (debouncedSearch) {
                query = query.or(
                    `po_number.ilike.%${debouncedSearch}%,` +
                    `supplier_name.ilike.%${debouncedSearch}%`
                );
            }

            // Get total count
            const { count: totalCount, error: countError } = await query;
            if (countError) throw countError;

            // Apply pagination
            const from = (currentPage - 1) * itemsPerPage;
            const to = from + itemsPerPage - 1;

            // Fetch paginated orders
            let ordersQuery = query.range(from, to).order('created_at', { ascending: false });
            const { data: orders, error: ordersError } = await ordersQuery;

            if (ordersError) {
                if (ordersError.code === 'PGRST103') {
                    setPurchaseOrders([]);
                    setTotalItems(totalCount || 0);
                } else {
                    throw ordersError;
                }
            } else {
                let enrichedOrders = orders || [];
                if (enrichedOrders.length > 0) {
                    try {
                        const orderIds = enrichedOrders.map(o => o.id);
                        
                        // 1. Fetch document_verifications
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

                        // 2. Fetch linked records in documents table
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

                        enrichedOrders = enrichedOrders.map(o => ({
                            ...o,
                            verification: verifMap[o.id] || null,
                            document: docMap[o.id] || null,
                        }));
                    } catch (vErr) {
                        console.warn('Could not load verifications or documents for orders:', vErr);
                    }
                }
                setPurchaseOrders(enrichedOrders);
                setTotalItems(totalCount || 0);
            }

            // Also fetch all purchase orders for stats, chart distribution & recent activity
            const { data: allOrdersData, error: allOrdersError } = await supabase
                .from('purchase_orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (!allOrdersError && allOrdersData) {
                let enrichedAll = allOrdersData;
                if (enrichedAll.length > 0) {
                    try {
                        const allIds = enrichedAll.map(o => o.id);
                        const { data: allVerifs } = await supabase
                            .from('document_verifications')
                            .select('id, purchase_order_id, match_result, uploaded_file_url, compared_fields, extracted_json, created_at')
                            .in('purchase_order_id', allIds)
                            .order('created_at', { ascending: false });

                        const allVerifMap: Record<string, any> = {};
                        (allVerifs || []).forEach((v: any) => {
                            if (!allVerifMap[v.purchase_order_id]) {
                                allVerifMap[v.purchase_order_id] = v;
                            }
                        });

                        const { data: allDocs } = await supabase
                            .from('documents')
                            .select('id, title, file_name, storage_path, file_type, notes, uploaded_by, purchase_id')
                            .in('purchase_id', allIds)
                            .order('created_at', { ascending: false });

                        const allDocMap: Record<string, any> = {};
                        (allDocs || []).forEach((d: any) => {
                            if (d.purchase_id && !allDocMap[d.purchase_id]) {
                                allDocMap[d.purchase_id] = d;
                            }
                        });

                        enrichedAll = enrichedAll.map(o => ({
                            ...o,
                            verification: allVerifMap[o.id] || null,
                            document: allDocMap[o.id] || null,
                        }));
                    } catch (e) {
                        console.warn('Could not enrich allOrders with verification/document data:', e);
                    }
                }
                setAllOrders(enrichedAll);

                // Auto-sync persistent activeVerificationJob if it was stuck in 'processing'
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
                                } else if (matchedPO.verification?.match_result === 'mismatched') {
                                    updateActiveVerificationJob({
                                        ...parsed,
                                        status: 'mismatched',
                                        verificationId: matchedPO.verification?.id || parsed.verificationId,
                                    });
                                } else if (matchedPO.verification?.match_result === 'forced') {
                                    updateActiveVerificationJob({
                                        ...parsed,
                                        status: 'forced',
                                        verificationId: matchedPO.verification?.id || parsed.verificationId,
                                    });
                                } else if (parsed.timestamp && Date.now() - parsed.timestamp > 3 * 60 * 1000) {
                                    // Job expired after 3 minutes
                                    updateActiveVerificationJob(null);
                                }
                            }
                        }
                    }
                } catch (syncErr) {
                    console.error('Error syncing active verification job:', syncErr);
                }
            }

            // Fetch suppliers
            const { data: suppliersData, error: suppliersError } = await supabase
                .from('suppliers')
                .select('*')
                .eq('is_active', true)
                .order('name');

            if (!suppliersError) {
                setSuppliers(suppliersData || []);
            }

        } catch (error) {
            console.error('Error fetching purchase orders:', error);
            toast.error('Failed to load purchase orders');
        } finally {
            hasLoadedOnceRef.current = true;
            if (!silent) {
                setLoading(false);
                setIsRefreshing(false);
            }
        }
    }, [currentPage, itemsPerPage, debouncedSearch, activeStatusFilter]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Realtime subscriptions
    useEffect(() => {
        const ordersSubscription = supabase
            .channel('purchase_orders_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () => {
                fetchData({ silent: true });
            })
            .subscribe();

        return () => {
            ordersSubscription.unsubscribe();
        };
    }, [fetchData]);

    // ============================================================
    // CRUD OPERATIONS
    // ============================================================
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

            const { error: orderError } = await supabase
                .from('purchase_orders')
                .insert({
                    po_number: orderData.po_number,
                    request_id: orderData.request_id,
                    supplier_id: orderData.supplier_id,
                    supplier_name: orderData.supplier_name,
                    total_amount: orderData.total_amount,
                    status: orderData.status || 'Draft',
                    delivery_date: orderData.delivery_date,
                    notes: orderData.notes || '',
                    items: orderData.items || [],
                    paid: false,
                });

            if (orderError) throw orderError;

            setPurchaseOrders(prev => [{ ...orderData, id: Date.now().toString(), paid: false, status: orderData.status || 'Draft' }, ...prev]);
            setTotalItems(prev => prev + 1);
            toast.success("Purchase Order created successfully!");
            setIsPurchaseOrderModalOpen(false);
            setSelectedRequestForPO(null);
        } catch (error) {
            console.error('Error creating purchase order:', error);
            toast.error('Failed to create purchase order');
        }
    }, []);

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
            toast.success("Purchase request submitted successfully!");
            setIsPurchaseRequestModalOpen(false);
        } catch (error) {
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

        if (!confirmed) return;

        setPendingRowId(id);
        try {
            const { error } = await supabase
                .from('purchase_orders')
                .delete()
                .eq('id', id);

            if (error) throw error;

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
        } catch (error) {
            console.error('Error deleting purchase order:', error);
            toast.error('Failed to delete purchase order');
        } finally {
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

        if (!confirmed) return;

        setPendingRowId("bulk");
        try {
            const idsToDelete = Array.from(selectedIds);
            const { error } = await supabase
                .from('purchase_orders')
                .delete()
                .in('id', idsToDelete);

            if (error) throw error;

            setPurchaseOrders(prev => prev.filter(po => !selectedIds.has(po.id)));
            setAllOrders(prev => prev.filter(po => !selectedIds.has(po.id)));
            setTotalItems(prev => Math.max(0, prev - idsToDelete.length));
            setSelectedIds(new Set());
            setIsSelectAll(false);
            toast.success(`Successfully deleted ${idsToDelete.length} purchase order(s)`);
        } catch (error) {
            console.error('Error deleting purchase orders:', error);
            toast.error('Failed to delete selected purchase orders');
        } finally {
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

        if (!confirmed) return;

        setPendingRowId("bulk");
        try {
            const idsToUpdate = Array.from(selectedIds);
            const { error } = await supabase
                .from('purchase_orders')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .in('id', idsToUpdate);

            if (error) throw error;

            setPurchaseOrders(prev => prev.map(po =>
                selectedIds.has(po.id) ? { ...po, status: newStatus } : po
            ));
            setAllOrders(prev => prev.map(po =>
                selectedIds.has(po.id) ? { ...po, status: newStatus } : po
            ));
            setSelectedIds(new Set());
            setIsSelectAll(false);
            toast.success(`Updated ${idsToUpdate.length} order(s) to ${newStatus}`);
        } catch (error) {
            console.error('Error updating purchase orders status in bulk:', error);
            toast.error('Failed to update purchase orders status');
        } finally {
            setPendingRowId(null);
        }
    };

    const handleBulkUpdatePaid = async (paidState: boolean) => {
        if (selectedIds.size === 0) {
            toast.warning("Please select at least one purchase order");
            return;
        }

        // If trying to mark as Paid, only allow orders with Confirmed or Delivered status
        if (paidState) {
            const selectedOrders = datasetOrders.filter(po => selectedIds.has(po.id));
            const invalidOrders = selectedOrders.filter(po => po.status === 'Draft' || po.status === 'Sent');
            if (invalidOrders.length > 0) {
                toast.warning(`Cannot mark ${invalidOrders.length} order(s) as Paid while status is Draft or Sent. Status must be Confirmed or Delivered.`);
                return;
            }
        }

        const actionName = paidState ? "Paid" : "Unpaid";
        const confirmed = await confirm({
            title: `Mark Orders as ${actionName}`,
            message: `Are you sure you want to mark ${selectedIds.size} selected purchase order(s) as ${actionName}?`,
            confirmText: `Mark as ${actionName}`,
            cancelText: "Cancel",
            confirmVariant: paidState ? "success" : "warning",
        });

        if (!confirmed) return;

        setPendingRowId("bulk");
        try {
            const idsToUpdate = Array.from(selectedIds);
            const { error } = await supabase
                .from('purchase_orders')
                .update({ paid: paidState, updated_at: new Date().toISOString() })
                .in('id', idsToUpdate);

            if (error) throw error;

            setPurchaseOrders(prev => prev.map(po =>
                selectedIds.has(po.id) ? { ...po, paid: paidState } : po
            ));
            setAllOrders(prev => prev.map(po =>
                selectedIds.has(po.id) ? { ...po, paid: paidState } : po
            ));
            setSelectedIds(new Set());
            setIsSelectAll(false);
            toast.success(`Marked ${idsToUpdate.length} order(s) as ${actionName}`);
        } catch (error) {
            console.error('Error updating purchase orders payment status in bulk:', error);
            toast.error('Failed to update payment status');
        } finally {
            setPendingRowId(null);
        }
    };

    const handleSelectAll = () => {
        if (isSelectAll) {
            setSelectedIds(new Set());
            setIsSelectAll(false);
        } else {
            const allIds = filteredOrders.map(o => o.id);
            setSelectedIds(new Set(allIds));
            setIsSelectAll(true);
        }
    };

    const handleSelectOne = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
        setIsSelectAll(filteredOrders.length > 0 && filteredOrders.every(o => next.has(o.id)));
    };

    const handleUpdateStatus = async (id: string, newStatus: string, options?: { skipConfirm?: boolean }) => {
        if (!canUpdateStatus) {
            toast.error("Permission denied: Only Managers, Executives, and Admins can update purchase order status.");
            return;
        }

        const targetOrder = purchaseOrders.find(p => p.id === id) || allOrders.find(p => p.id === id) || (actionModalOrder?.id === id ? actionModalOrder : null);
        const currentStatus = targetOrder?.status || 'Draft';

        if (currentStatus === newStatus) return;

        // Changing to or from Confirmed requires Admin
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

            if (!confirmed) return;
        }

        setPendingRowId(id);
        try {
            const { error } = await supabase
                .from('purchase_orders')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;

            setPurchaseOrders(prev => prev.map(po =>
                po.id === id ? { ...po, status: newStatus } : po
            ));
            setAllOrders(prev => prev.map(po =>
                po.id === id ? { ...po, status: newStatus } : po
            ));

            if (actionModalOrder && actionModalOrder.id === id) {
                setActionModalOrder(prev => prev ? { ...prev, status: newStatus } : null);
            }

            toast.success(`PO #${targetOrder?.po_number || id} status updated to ${newStatus}`);
        } catch (error) {
            console.error('Error updating PO status:', error);
            toast.error('Failed to update PO status');
        } finally {
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
            } else {
                toast.error('Could not find order details');
            }
        } else {
            toast.warning(`Cannot verify payment for PO #${poNumber || id} until status is Delivered (currently ${status || 'Draft'}).`);
        }
    };

    const getActionModalFullMessage = () => {
        if (!actionModalAiMessage || !actionModalOrder) return '';
        const APP_URL = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
        const CONFIRM_PATH = process.env.NEXT_PUBLIC_CONFIRM_PATH || '/procurement/confirm';

        const confirmLink = `${APP_URL}${CONFIRM_PATH}?po=${actionModalOrder.po_number}`;
        return `${actionModalAiMessage}\n\n---\n\n📋 **Confirm this order:** ${confirmLink}\n\nPlease click the link above to confirm this purchase order.`;
    };

    const handleGenerateActionAIMessage = async () => {
        if (!actionModalOrder) return;

        setIsGeneratingActionAI(true);
        try {
            const formattedItems = (actionModalOrder.items || []).map((item: any) => ({
                name: item.name || "Item",
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
                toast.success('AI message generated!');
            } else {
                toast.error('Failed to generate AI message');
            }
        } catch (error) {
            console.error('Error generating AI message for PO:', error);
            toast.error('Failed to generate AI message');
        } finally {
            setIsGeneratingActionAI(false);
        }
    };

    const handleActionEmail = async () => {
        if (!actionModalOrder) return;
        if (!actionModalAiMessage) {
            toast.warning('Please generate an AI message first');
            return;
        }

        if (isSendingActionComm) return;

        const emailTo = actionSupplierEmail || '';
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
                name: item.name || "Item",
                quantity: Number(item.quantity) || 1,
                unit_price: Number(item.unit_price) || 0,
                total: (Number(item.quantity) || 1) * (Number(item.unit_price) || 0),
            }));

            const confirmLink = `${window.location.origin}/procurement/confirm?po=${actionModalOrder.po_number}`;
            const fullMessage = getActionModalFullMessage();

            const emailHtml = buildEmailTemplate({
                poNumber: actionModalOrder.po_number,
                supplierName: actionModalOrder.supplier_name,
                items: formattedItems,
                totalAmount: actionModalOrder.total_amount,
                deliveryDate: actionModalOrder.delivery_date || 'TBD',
                notes: actionModalOrder.notes || '',
                confirmLink: confirmLink,
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
                // Update status from Draft to Sent in database
                await handleUpdateStatus(actionModalOrder.id, 'Sent', { skipConfirm: true });

                toast.success(`Email sent to ${emailTo} and status updated to Sent!`, {
                    id: toastId,
                    duration: 6000,
                });

                try {
                    await navigator.clipboard.writeText(fullMessage);
                } catch (clipError) {
                    console.warn('Could not copy to clipboard:', clipError);
                }
            } else {
                throw new Error(data.error || 'Failed to send email');
            }
        } catch (error: any) {
            console.error('Error sending email from manage modal:', error);
            toast.error(error.message || 'Failed to send email. Please try again.', {
                id: toastId,
                duration: 8000,
            });
        } finally {
            setIsSendingActionComm(false);
        }
    };

    const handleActionMessenger = async () => {
        if (!actionModalOrder) return;
        if (!actionModalAiMessage) {
            toast.warning('Please generate an AI message first');
            return;
        }

        if (isSendingActionComm) return;

        const toastId = toast.loading('Preparing Messenger message...', {
            duration: Infinity,
            position: 'top-center',
        });

        setIsSendingActionComm(true);

        try {
            const confirmLink = `${window.location.origin}/procurement/confirm?po=${actionModalOrder.po_number}`;
            const message = `${actionModalAiMessage}\n\n---\nConfirm this order: ${confirmLink}`;

            try {
                await navigator.clipboard.writeText(message);
            } catch (clipError) {
                console.warn('Could not copy to clipboard:', clipError);
            }

            // Update status from Draft to Sent
            await handleUpdateStatus(actionModalOrder.id, 'Sent', { skipConfirm: true });

            if (actionSupplierMessenger) {
                window.open(actionSupplierMessenger, '_blank');
                toast.success(`Messenger opened and status updated to Sent!`, {
                    id: toastId,
                    duration: 5000,
                });
            } else {
                const messengerUrl = `https://m.me/?text=${encodeURIComponent(message)}`;
                window.open(messengerUrl, '_blank');
                toast.success('Message copied to clipboard, Messenger opened and status updated to Sent!', {
                    id: toastId,
                    duration: 5000,
                });
            }
        } catch (error) {
            console.error('Error sending messenger from manage modal:', error);
            toast.error('Failed to prepare Messenger. Please try again.', {
                id: toastId,
                duration: 8000,
            });
        } finally {
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
        } catch (error) {
            console.error('Failed to copy message:', error);
            toast.error('Failed to copy message');
        }
    };

    // ============================================================
    // CHARTS - Using colors from Supplier page
    // ============================================================
    const datasetOrders = allOrders.length > 0 ? allOrders : purchaseOrders;

    useEffect(() => {
        if (loading) return;

        let isMounted = true;
        let animationFrameId: number;

        const createChart = () => {
            if (!isMounted) return;

            const canvas = poChartRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            if (poChartInstance.current) {
                poChartInstance.current.destroy();
                poChartInstance.current = null;
            }

            if (!Chart || datasetOrders.length === 0) return;

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

            // Ensure all statuses are represented
            const allStatuses = ['Draft', 'Sent', 'Confirmed', 'Delivered', 'Cancelled'];
            allStatuses.forEach(status => {
                if (!statusData[status]) statusData[status] = 0;
            });

            const sortedLabels = allStatuses.filter(st => (statusData[st] || 0) > 0 || allStatuses.indexOf(st) < 5);
            const sortedData = sortedLabels.map(label => statusData[label] || 0);

            // Status color mapping matching Supplier Categories palette
            const colorMap: Record<string, string> = {
                'Draft': '#64748B',      // Slate
                'Sent': '#6366F1',       // Indigo
                'Confirmed': '#8B5CF6',  // Violet / Purple
                'Delivered': '#EC4899',  // Vibrant Pink
                'Cancelled': '#E11D48'   // Rose
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

        // Render once canvas is mounted and layout ready
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

    // ============================================================
    // FILTERING & PAGINATION
    // ============================================================
    const filteredOrders = purchaseOrders.filter((order) => {
        const matchesStatus = activeStatusFilter === 'all' || order.status === activeStatusFilter;
        const matchesSearch = (order.po_number || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            (order.supplier_name || '').toLowerCase().includes(debouncedSearch.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages && page !== currentPage) {
            setCurrentPage(page);
            setSelectedIds(new Set());
            setIsSelectAll(false);
            setTimeout(scrollToTable, 100);
        }
    };

    // Calculate stats using full dataset
    const statsSource = allOrders.length > 0 ? allOrders : purchaseOrders;
    const totalOrders = statsSource.length;
    const pendingConfirmation = statsSource.filter(o => o.status === 'Sent' || o.status === 'Draft').length;
    const inTransit = statsSource.filter(o => o.status === 'Confirmed').length;
    const completed = statsSource.filter(o => o.status === 'Delivered').length;
    const totalSpend = statsSource
        .filter(o => o.paid === true)
        .reduce((sum, o) => sum + (o.total_amount || 0), 0);

    // ============================================================
    // HANDLE CREATE PO FROM APPROVED REQUEST
    // ============================================================
    const handleOpenApprovedRequests = () => {
        setIsApprovedRequestsModalOpen(true);
    };

    const handleSelectRequestForPO = (req: any) => {
        setSelectedRequestForPO(req);
        setIsApprovedRequestsModalOpen(false);
        setIsPurchaseOrderModalOpen(true);
    };

    if (loading) return <PageSkeleton />;

    return (
        <SessionGuard requiredRole={['Admin', 'Employee', 'Executive']}>
            <div className="p-6 space-y-6 fade-in bgCard">
                {/* Header */}
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

                            <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)] transition-all">
                                <span className="w-2 h-2 rounded-full bg-pink-500 shadow-xs shadow-pink-500/50" />
                                <i className="fas fa-user-tag text-[11px] text-slate-400 dark:text-slate-500" />
                                <span>Role:</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize">
                                    {userRole}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="md"
                            onClick={() => setIsPurchaseRequestModalOpen(true)}
                        >
                            <i className="fas fa-plus text-pink-500 dark:text-pink-400 text-xs" />
                            <span>Make Purchase Request</span>
                        </AppButton>
                        <AppButton
                            type="button"
                            variant="primary"
                            size="md"
                            onClick={handleOpenApprovedRequests}
                        >
                            <i className="fas fa-clipboard-check text-xs" />
                            <span>Create PO from Request</span>
                        </AppButton>
                    </div>
                </div>

                {/* AI Suggested Questions */}
                <AiQuestions
                    title="AI Suggested Questions"
                    subtitle="Click to ask"
                    questions={[
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
                    ]}
                />

                {/* Stats Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Cards
                        frontIcon="fa-solid fa-file-invoice"
                        header="Total POs"
                        data={String(totalOrders)}
                        arrow="fa-solid fa-arrow-up"
                        description="All orders"
                        backBg="bg-ink dark:bg-ink/90"
                        backHeader="Overview"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription={`Total Purchase Orders: ${totalOrders}\nPending: ${pendingConfirmation}\nCompleted: ${completed}`}
                        tooltip="View all POs"
                        tooltipLink="/purchase-orders"
                        frontTextColor="text-pink-500 dark:text-pink-400"
                        descriptionTextColor="text-emerald-600 dark:text-emerald-400"
                    />

                    <Cards
                        frontIcon="fa-solid fa-clock"
                        header="Pending"
                        data={String(pendingConfirmation)}
                        arrow="fa-solid fa-hourglass-half"
                        description="Awaiting confirmation"
                        backBg="bg-ink dark:bg-ink/90"
                        backHeader="Pending Orders"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription={`Pending: ${pendingConfirmation}\n${pendingConfirmation > 0 ? 'Awaiting supplier confirmation' : 'No pending orders'}`}
                        tooltip="View pending orders"
                        tooltipLink="/purchase-orders?status=Sent"
                        badge={pendingConfirmation > 0 ? `${pendingConfirmation} waiting` : undefined}
                        frontTextColor="text-amber-500 dark:text-amber-400"
                        descriptionTextColor="text-amber-600 dark:text-amber-400"
                    />

                    <Cards
                        frontIcon="fa-solid fa-circle-check"
                        header="Completed"
                        data={String(completed)}
                        arrow="fa-solid fa-check-double"
                        description="Delivered"
                        backBg="bg-ink dark:bg-ink/90"
                        backHeader="Completed"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription={`Completed: ${completed}\n${completed > 0 ? 'Orders successfully delivered' : 'No completed orders'}`}
                        tooltip="View completed orders"
                        tooltipLink="/purchase-orders?status=Delivered"
                        frontTextColor="text-emerald-500 dark:text-emerald-400"
                        descriptionTextColor="text-emerald-600 dark:text-emerald-400"
                    />

                    <Cards
                        frontIcon="fa-solid fa-coins"
                        header="Total Spend"
                        data={`₱${totalSpend.toLocaleString()}`}
                        arrow="fa-solid fa-chart-line"
                        description="Paid orders"
                        backBg="bg-ink dark:bg-ink/90"
                        backHeader="Financial Summary"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription={`Total Spend: ₱${totalSpend.toLocaleString()}\n${purchaseOrders.filter(o => o.paid).length} paid orders\n${totalSpend > 0 ? 'Tracking procurement costs' : 'No paid orders yet'}`}
                        tooltip="View financial details"
                        frontTextColor="text-blue-500 dark:text-blue-400"
                        descriptionTextColor="text-blue-600 dark:text-blue-400"
                    />
                </div>

                {/* Charts & Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* PO Status Categories Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between transition-all">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">PO Status Categories</h3>
                                    <div className="relative group">
                                        <button
                                            type="button"
                                            className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-[10px] font-bold inline-flex items-center justify-center hover:text-pink-500 dark:hover:text-pink-400 transition-colors cursor-help"
                                            aria-label="Information"
                                        >
                                            <i className="fas fa-info text-[9px]" />
                                        </button>
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-3.5 bg-slate-900 text-slate-200 text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-20 pointer-events-none border border-slate-700/60">
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
                            <div className="w-8 h-8 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 flex items-center justify-center border border-pink-100 dark:border-pink-900/30">
                                <i className="fas fa-chart-pie text-xs" />
                            </div>
                        </div>

                        <div className="h-60 relative w-full flex items-center justify-center">
                            {datasetOrders.length === 0 ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-6 text-center">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3 border border-slate-200/60 dark:border-slate-700/50">
                                        <i className="fas fa-chart-pie text-base" />
                                    </div>
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">No order data available</span>
                                    <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Status metrics will display once orders are created</span>
                                </div>
                            ) : (
                                <canvas ref={poChartRef} className="w-full h-full max-h-60 cursor-pointer" />
                            )}
                        </div>
                    </div>

                    {/* Recent Activity Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col transition-all">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Recent Activity</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Latest purchase order actions</p>
                            </div>
                            <div className="w-8 h-8 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 flex items-center justify-center border border-pink-100 dark:border-pink-900/30">
                                <i className="fas fa-clock text-xs" />
                            </div>
                        </div>

                        <div className="space-y-2.5">
                            {[0, 1, 2].map((index) => {
                                const order = allOrders[index];
                                const slotNumber = index + 1;

                                if (order) {
                                    return (
                                        <div key={order.id} className="flex items-start gap-3 p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700/80 transition-all">
                                            <div className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 text-[10px] font-bold mt-0.5 border border-pink-200/60 dark:border-pink-900/40">
                                                {slotNumber}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                        {order.po_number}
                                                    </span>
                                                    <StatusBadge
                                                        tone={getPOStatusTone(order.status)}
                                                        dot
                                                        size="xs"
                                                    >
                                                        {order.status}
                                                    </StatusBadge>
                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto">
                                                        {order.delivery_date || 'No date'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between mt-1 text-xs">
                                                    <span className="text-slate-600 dark:text-slate-400 truncate">
                                                        {order.supplier_name}
                                                    </span>
                                                    <span className="font-semibold text-slate-900 dark:text-white shrink-0 ml-2">
                                                        ₱{order.total_amount.toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div
                                        key={`empty-slot-${index}`}
                                        className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-slate-200/80 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 text-slate-400 dark:text-slate-500"
                                    >
                                        <div className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-[10px] font-semibold border border-slate-200 dark:border-slate-700/60">
                                            {slotNumber}
                                        </div>
                                        <div className="flex items-center justify-between w-full text-xs">
                                            <span className="font-medium text-slate-400 dark:text-slate-500 italic">No recent activity</span>
                                            <span className="text-[11px] text-slate-300 dark:text-slate-600 font-mono">—</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div
                    ref={tableContainerRef}
                    id="purchase-orders-table"
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden relative flex flex-col"
                >
                    {isRefreshing && <TableContentLoader />}

                    {/* Filter Bar */}
                    <div className="flex-shrink-0 p-4 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/60 backdrop-blur-xl transition-all">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="font-semibold text-slate-900 dark:text-white text-sm mr-2 flex items-center gap-2">
                                <i className="fas fa-list text-pink-500 dark:text-pink-400" />
                                <span>Purchase Orders</span>
                                {isRefreshing && (
                                    <i className="fas fa-circle-notch fa-spin text-pink-400 text-xs" title="Refreshing..." />
                                )}
                            </div>

                            <div className="relative flex-1 min-w-[200px] max-w-xs">
                                <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none" />
                                <input
                                    className="w-full bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 pl-8 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-pink-500 dark:focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 dark:focus:ring-pink-500/30 transition-all shadow-2xs"
                                    placeholder="Search by PO # or supplier..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-1 bg-slate-200/60 dark:bg-slate-800/70 p-1 rounded-xl border border-transparent dark:border-white/5">
                                {[
                                    { key: "all", label: "All", count: totalOrders },
                                    { key: "Draft", label: "Draft", count: allOrders.filter(o => o.status === 'Draft').length },
                                    { key: "Sent", label: "Sent", count: allOrders.filter(o => o.status === 'Sent').length },
                                    { key: "Confirmed", label: "Confirmed", count: allOrders.filter(o => o.status === 'Confirmed').length },
                                    { key: "Delivered", label: "Delivered", count: allOrders.filter(o => o.status === 'Delivered').length },
                                    { key: "Cancelled", label: "Cancelled", count: allOrders.filter(o => o.status === 'Cancelled').length },
                                ].map((tab) => {
                                    const isActive = activeStatusFilter === tab.key;
                                    return (
                                        <button
                                            key={tab.key}
                                            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${isActive
                                                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs dark:shadow-black/20"
                                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-700/40"
                                                }`}
                                            onClick={() => {
                                                setActiveStatusFilter(tab.key);
                                                setCurrentPage(1);
                                            }}
                                        >
                                            <span>{tab.label}</span>
                                            <span
                                                className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${isActive
                                                    ? "bg-slate-100 dark:bg-slate-600 text-slate-800 dark:text-slate-100"
                                                    : "bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                                    }`}
                                            >
                                                {tab.count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Bulk Action Toolbar */}
                    {selectedIds.size > 0 && (
                        <div className="px-4 py-2.5 bg-pink-50/90 dark:bg-pink-950/40 border-b border-pink-100 dark:border-pink-900/30 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="flex items-center gap-2.5">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-pink-500 text-white font-bold text-xs shadow-2xs">
                                    {selectedIds.size}
                                </span>
                                <span className="text-xs font-semibold text-pink-950 dark:text-pink-200">
                                    {selectedIds.size} purchase order{selectedIds.size > 1 ? 's' : ''} selected
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedIds(new Set());
                                        setIsSelectAll(false);
                                    }}
                                    className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-pink-600 dark:hover:text-pink-300 underline font-medium cursor-pointer ml-1"
                                >
                                    Deselect all
                                </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                {/* Bulk Status Dropdown */}
                                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 rounded-xl px-2.5 py-1 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
                                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Status:</span>
                                    <select
                                        className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
                                        defaultValue=""
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                handleBulkUpdateStatus(e.target.value);
                                                e.target.value = "";
                                            }
                                        }}
                                        disabled={pendingRowId === "bulk"}
                                    >
                                        <option value="" disabled>Change Status...</option>
                                        <option value="Draft">Draft</option>
                                        <option value="Sent">Sent</option>
                                        <option value="Confirmed">Confirmed</option>
                                        <option value="Delivered">Delivered</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>
                                </div>

                                {/* Bulk Mark Paid */}
                                <button
                                    type="button"
                                    onClick={() => handleBulkUpdatePaid(true)}
                                    disabled={pendingRowId === "bulk"}
                                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                                    title="Mark all selected orders as Paid"
                                >
                                    <i className="fas fa-check-circle text-emerald-600 dark:text-emerald-400 text-[11px]" />
                                    <span>Mark Paid</span>
                                </button>

                                {/* Bulk Mark Unpaid */}
                                <button
                                    type="button"
                                    onClick={() => handleBulkUpdatePaid(false)}
                                    disabled={pendingRowId === "bulk"}
                                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                                    title="Mark all selected orders as Unpaid"
                                >
                                    <i className="fas fa-hourglass-half text-amber-600 dark:text-amber-400 text-[11px]" />
                                    <span>Mark Unpaid</span>
                                </button>

                                {/* Bulk Delete */}
                                <button
                                    type="button"
                                    onClick={handleBulkDelete}
                                    disabled={pendingRowId === "bulk"}
                                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                                    title="Delete selected orders"
                                >
                                    <i className="fas fa-trash-alt text-rose-600 dark:text-rose-400 text-[11px]" />
                                    <span>Delete</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Table Body */}
                    <div className="flex-1 overflow-y-auto max-h-[500px] relative">
                        <div className="transition-opacity duration-200">
                            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                                <table className="table-pro w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80">
                                            <th className="w-10 py-3 px-4 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-pink-600 focus:ring-pink-500/20 focus:ring-2 transition-all cursor-pointer accent-pink-600"
                                                        checked={isSelectAll && selectedIds.size > 0}
                                                        onChange={handleSelectAll}
                                                        disabled={filteredOrders.length === 0}
                                                        title={filteredOrders.length === 0 ? "No orders to select" : "Select all purchase orders"}
                                                    />
                                                    {selectedIds.size > 0 && (
                                                        <span className="text-[10px] bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 font-bold px-1.5 py-0.2 rounded-full border border-pink-200/60 dark:border-pink-900/40">
                                                            {selectedIds.size}
                                                        </span>
                                                    )}
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
                                        {filteredOrders.length === 0 ? (
                                            <tr>
                                                <td colSpan={10} className="py-12">
                                                    <EmptyState
                                                        title="No purchase orders found"
                                                        description={
                                                            activeStatusFilter !== 'all'
                                                                ? `There are no orders with status "${activeStatusFilter}".`
                                                                : "Select an approved purchase request to generate a purchase order."
                                                        }
                                                        icon="fas fa-file-invoice"
                                                        actionText="Create PO from Request"
                                                        onAction={handleOpenApprovedRequests}
                                                    />
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredOrders.map((order) => {
                                                const rowBusy = pendingRowId === order.id;
                                                const isSelected = selectedIds.has(order.id);
                                                const statusOptions = ['Draft', 'Sent', 'Confirmed', 'Delivered', 'Cancelled'];

                                                return (
                                                    <tr
                                                        key={order.id}
                                                        className={`group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${rowBusy ? "opacity-50 pointer-events-none" : isSelected ? "bg-pink-50/30 dark:bg-pink-950/20" : "bg-transparent"}`}
                                                    >
                                                        <td className="py-3.5 px-4 text-center">
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-pink-600 focus:ring-pink-500/20 focus:ring-2 transition-all cursor-pointer accent-pink-600"
                                                                checked={isSelected}
                                                                onChange={() => handleSelectOne(order.id)}
                                                            />
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
                                                            <StatusBadge
                                                                tone={getPOStatusTone(order.status)}
                                                                dot
                                                                size="xs"
                                                            >
                                                                {order.status}
                                                            </StatusBadge>
                                                        </td>
                                                        <td data-label="Payment" className="py-3.5 px-4 whitespace-nowrap">
                                                            {order.paid ? (
                                                                <StatusBadge
                                                                    tone="purple"
                                                                    icon="fas fa-check-circle"
                                                                    size="xs"
                                                                    title="Payment verified via receipt"
                                                                    onClick={() => handleTogglePaid(order.id, order.paid, order.po_number, order.status)}
                                                                    disabled={rowBusy}
                                                                >
                                                                    Paid ✓
                                                                </StatusBadge>
                                                            ) : order.status === 'Delivered' ? (
                                                                <StatusBadge
                                                                    tone="pink"
                                                                    icon="fas fa-receipt"
                                                                    size="xs"
                                                                    interactive
                                                                    title="PO Delivered: Click to upload receipt & verify payment"
                                                                    onClick={() => handleTogglePaid(order.id, order.paid, order.po_number, order.status)}
                                                                    disabled={rowBusy}
                                                                >
                                                                    Upload Receipt
                                                                </StatusBadge>
                                                            ) : (
                                                                <StatusBadge
                                                                    tone="neutral"
                                                                    icon="fas fa-lock"
                                                                    size="xs"
                                                                    disabled
                                                                    title={`Locked: Order must be Delivered before receipt verification (currently ${order.status})`}
                                                                >
                                                                    Unpaid
                                                                </StatusBadge>
                                                            )}
                                                        </td>
                                                        <td data-label="OCR Result" className="py-3.5 px-4 text-center whitespace-nowrap">
                                                            {order.verification?.match_result === 'matched' ? (
                                                                <StatusBadge
                                                                    tone="pink"
                                                                    icon="fas fa-check-circle"
                                                                    size="xs"
                                                                    interactive
                                                                    title="Receipt verified. Click to view document."
                                                                    onClick={() => {
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
                                                                    }}
                                                                >
                                                                    Matched ✓
                                                                </StatusBadge>
                                                            ) : order.verification?.match_result === 'mismatched' ? (
                                                                <StatusBadge
                                                                    tone="amber"
                                                                    icon="fas fa-exclamation-triangle"
                                                                    size="xs"
                                                                    interactive
                                                                    title="Receipt mismatch detected. Click to review differences or force insert."
                                                                    onClick={() => {
                                                                        setReceiptModalPO(order);
                                                                        setReceiptVerificationId(order.verification?.id || null);
                                                                        setIsReceiptModalOpen(true);
                                                                    }}
                                                                >
                                                                    Mismatch ⚠
                                                                </StatusBadge>
                                                            ) : order.verification?.match_result === 'forced' ? (
                                                                <StatusBadge
                                                                    tone="indigo"
                                                                    icon="fas fa-shield-alt"
                                                                    size="xs"
                                                                    interactive
                                                                    title="Admin forced override. Click to view document."
                                                                    onClick={() => {
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
                                                                    }}
                                                                >
                                                                    Forced ✓
                                                                </StatusBadge>
                                                            ) : order.verification?.match_result === 'pending' ? (
                                                                <StatusBadge
                                                                    tone="indigo"
                                                                    icon="fas fa-spinner fa-spin"
                                                                    size="xs"
                                                                    interactive
                                                                    title="Receipt verification is processing..."
                                                                    onClick={() => {
                                                                        setReceiptModalPO(order);
                                                                        setReceiptVerificationId(order.verification?.id || null);
                                                                        setIsReceiptModalOpen(true);
                                                                    }}
                                                                >
                                                                    Processing...
                                                                </StatusBadge>
                                                            ) : order.paid ? (
                                                                <StatusBadge
                                                                    tone="purple"
                                                                    icon="fas fa-check"
                                                                    size="xs"
                                                                >
                                                                    Paid
                                                                </StatusBadge>
                                                            ) : order.status === 'Delivered' ? (
                                                                <StatusBadge
                                                                    tone="pink"
                                                                    icon="fas fa-arrow-up-from-bracket"
                                                                    size="xs"
                                                                    interactive
                                                                    title="Click to upload receipt for OCR verification"
                                                                    onClick={() => {
                                                                        setReceiptModalPO(order);
                                                                        setReceiptVerificationId(null);
                                                                        setIsReceiptModalOpen(true);
                                                                    }}
                                                                >
                                                                    Upload
                                                                </StatusBadge>
                                                            ) : (
                                                                <span className="text-slate-400 dark:text-slate-600 text-xs font-medium italic">—</span>
                                                            )}
                                                        </td>
                                                        <td data-label="Actions" className="py-3.5 px-4 text-right whitespace-nowrap w-[130px] min-w-[130px]">
                                                            <div className="flex items-center justify-end gap-2.5">
                                                                {rowBusy && (
                                                                    <svg className="w-4 h-4 animate-spin text-slate-400 dark:text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24">
                                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                                    </svg>
                                                                )}

                                                                {/* View Document Button */}
                                                                {(order.verification?.uploaded_file_url || order.document?.storage_path) && (
                                                                    <CrudActionButton
                                                                        action="custom"
                                                                        label="Doc"
                                                                        icon={FileText}
                                                                        disabled={rowBusy}
                                                                        ariaLabel="View Receipt Document"
                                                                        title="View Receipt Document"
                                                                        onClick={() => {
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
                                                                        }}
                                                                    />
                                                                )}

                                                                {/* Manage Order Modal Trigger Button */}
                                                                <CrudActionButton
                                                                    action="custom"
                                                                    label="Manage"
                                                                    icon={MoreHorizontal}
                                                                    disabled={rowBusy}
                                                                    ariaLabel="Manage Purchase Order"
                                                                    title="Manage Purchase Order"
                                                                    onClick={() => setActionModalOrder(order)}
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Pagination */}
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

                            {selectedIds.size > 0 && (
                                <div className="flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-white/10 animate-in fade-in duration-150">
                                    <span className="px-2.5 py-1 rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 font-bold border border-pink-200/60 dark:border-pink-800/40 shadow-2xs">
                                        {selectedIds.size} selected
                                    </span>

                                    <button
                                        type="button"
                                        onClick={handleBulkDelete}
                                        disabled={pendingRowId === "bulk"}
                                        className="px-3 py-1.5 text-xs font-semibold bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 rounded-xl border border-red-200/60 dark:border-red-800/40 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                                    >
                                        {pendingRowId === "bulk" ? (
                                            <i className="fas fa-spinner fa-spin text-xs" />
                                        ) : (
                                            <i className="fas fa-trash-alt text-xs" />
                                        )}
                                        <span>Delete Selected</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedIds(new Set());
                                            setIsSelectAll(false);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
                                        title="Clear selection"
                                        aria-label="Clear selection"
                                    >
                                        <i className="fas fa-times text-xs" />
                                    </button>
                                </div>
                            )}
                        </div>

                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={handlePageChange}
                        />
                    </div>
                </div>

                {/* Approved Requests Selection Modal */}
                <ApprovedRequestsModal
                    isOpen={isApprovedRequestsModalOpen}
                    onClose={() => setIsApprovedRequestsModalOpen(false)}
                    onSelectRequest={handleSelectRequestForPO}
                />

                {/* Purchase Order Modal - Shared modal with Procurement */}
                <PurchaseOrderModal
                    isOpen={isPurchaseOrderModalOpen}
                    onClose={() => {
                        setIsPurchaseOrderModalOpen(false);
                        setSelectedRequestForPO(null);
                    }}
                    request={selectedRequestForPO}
                    suppliers={suppliers}
                    onOrderCreated={handleOrderCreated}
                />

                {/* Make Purchase Request Modal */}
                <PurchaseRequestModal
                    isOpen={isPurchaseRequestModalOpen}
                    onClose={() => setIsPurchaseRequestModalOpen(false)}
                    suppliers={suppliers}
                    role={userRole}
                    onRequestSubmitted={handleRequestSubmitted}
                />

                {/* Chart Detail Modal */}
                <ChartDetailModal
                    isOpen={chartDetailModal.isOpen}
                    onClose={() => setChartDetailModal(prev => ({ ...prev, isOpen: false }))}
                    month={chartDetailModal.month}
                    monthIndex={chartDetailModal.monthIndex}
                    orders={chartDetailModal.orders}
                    totalAmount={chartDetailModal.totalAmount}
                />

                {/* Manage Purchase Order Modal */}
                {actionModalOrder && (
                    <div
                        className="fixed inset-0 bg-slate-950/60 dark:bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
                        onClick={() => setActionModalOrder(null)}
                    >
                        <div
                            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl dark:shadow-2xl dark:shadow-black/70 w-full max-w-md border border-slate-200/80 dark:border-slate-800 overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-pink-50 dark:bg-pink-950/40 border border-pink-200/50 dark:border-pink-800/40 flex items-center justify-center text-pink-600 dark:text-pink-400">
                                        <i className="fas fa-file-invoice text-base" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                                            Manage Order {actionModalOrder.po_number}
                                        </h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {actionModalOrder.supplier_name} • ₱{actionModalOrder.total_amount.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <AppButton
                                    type="button"
                                    variant="neutral"
                                    size="icon-sm"
                                    onClick={() => setActionModalOrder(null)}
                                    aria-label="Close modal"
                                >
                                    <i className="fas fa-times text-xs" />
                                </AppButton>
                            </div>

                            {/* Modal Content */}
                            <div className="p-6 space-y-5">
                                {/* Order Quick Info */}
                                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Current Status</span>
                                        <div className="mt-1">
                                            <StatusBadge
                                                tone={getPOStatusTone(actionModalOrder.status)}
                                                dot
                                                size="xs"
                                            >
                                                {actionModalOrder.status}
                                            </StatusBadge>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Payment Status</span>
                                        <div className="mt-1 flex items-center justify-between">
                                            {actionModalOrder.paid ? (
                                                <StatusBadge tone="purple" icon="fas fa-check-circle" size="xs">
                                                    Paid ✓
                                                </StatusBadge>
                                            ) : (
                                                <StatusBadge tone="amber" icon="fas fa-hourglass-half" size="xs">
                                                    Unpaid
                                                </StatusBadge>
                                            )}
                                        </div>
                                        {!actionModalOrder.paid && actionModalOrder.status === 'Delivered' && (
                                            <AppButton
                                                type="button"
                                                variant="primary"
                                                size="sm"
                                                onClick={() => {
                                                    setReceiptModalPO(actionModalOrder);
                                                    setReceiptVerificationId(null);
                                                    setIsReceiptModalOpen(true);
                                                    setActionModalOrder(null);
                                                }}
                                                className="mt-2 w-full"
                                            >
                                                <i className="fas fa-receipt text-xs" />
                                                <span>Verify Receipt (OCR)</span>
                                            </AppButton>
                                        )}
                                    </div>
                                </div>

                                {/* Send via Email & Messenger (Shown when status is Draft) */}
                                {actionModalOrder.status === 'Draft' && (
                                    <div className="bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-slate-50 dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-slate-900 border border-indigo-100 dark:border-indigo-800/30 rounded-xl p-4 shadow-xs space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-300">
                                                <div>
                                                    <h3 className="text-xs font-bold leading-none">
                                                        Send PO to Supplier
                                                    </h3>
                                                    <span className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80 mt-0.5 block">
                                                        Send via Email or Messenger (sets status to Sent)
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={handleGenerateActionAIMessage}
                                                    disabled={isGeneratingActionAI || isSendingActionComm}
                                                    className="px-2 py-1 text-[11px] font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-900/50 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                                >
                                                    {isGeneratingActionAI ? (
                                                        <i className="fas fa-spinner fa-spin text-[10px]" />
                                                    ) : (
                                                        <i className="fas fa-wand-magic-sparkles text-[10px]" />
                                                    )}
                                                    <span>{isGeneratingActionAI ? 'Generating...' : 'Generate with AI'}</span>
                                                </button>
                                                {actionModalAiMessage && (
                                                    <button
                                                        type="button"
                                                        onClick={handleActionCopyOnly}
                                                        disabled={isSendingActionComm}
                                                        className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                                        title="Copy Message"
                                                    >
                                                        <i className="fas fa-copy text-[10px]" />
                                                        <span>Copy</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* AI Message Preview */}
                                        <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl p-3 border border-indigo-100/80 dark:border-indigo-800/20 text-xs text-slate-800 dark:text-slate-200 leading-relaxed shadow-2xs min-h-[70px] max-h-[140px] overflow-y-auto">
                                            {isGeneratingActionAI ? (
                                                <div className="flex items-center justify-center h-16">
                                                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs">
                                                        <i className="fas fa-spinner fa-spin" />
                                                        <span>Generating message...</span>
                                                    </div>
                                                </div>
                                            ) : actionModalAiMessage ? (
                                                <div>
                                                    <p className="whitespace-pre-wrap">{actionModalAiMessage}</p>
                                                    <div className="mt-2 pt-2 border-t border-indigo-100 dark:border-indigo-800/30">
                                                        <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                                                            📋 Confirmation link is automatically attached
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-slate-400 dark:text-slate-500 italic text-center py-3">
                                                    Click "Generate with AI" to create a supplier message
                                                </p>
                                            )}
                                        </div>

                                        {/* Supplier Contact Info & Send Buttons */}
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
                                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                                {actionSupplierEmail ? (
                                                    <span className="truncate block" title={actionSupplierEmail}>
                                                        <i className="fas fa-envelope text-blue-500 mr-1" />
                                                        {actionSupplierEmail}
                                                    </span>
                                                ) : (
                                                    <span className="text-amber-600 dark:text-amber-400">
                                                        <i className="fas fa-exclamation-triangle mr-1" />
                                                        No email configured
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1.5 justify-end">
                                                <button
                                                    type="button"
                                                    onClick={handleActionEmail}
                                                    title="Send Email via Gmail"
                                                    disabled={!actionModalAiMessage || isSendingActionComm || !actionSupplierEmail}
                                                    className="px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/50 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                                                >
                                                    {isSendingActionComm ? (
                                                        <i className="fas fa-spinner fa-spin text-blue-500" />
                                                    ) : (
                                                        <i className="fas fa-envelope text-blue-500 dark:text-blue-400 text-[11px]" />
                                                    )}
                                                    <span>{isSendingActionComm ? 'Sending...' : 'Email'}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleActionMessenger}
                                                    title="Send via Messenger"
                                                    disabled={!actionModalAiMessage || isSendingActionComm}
                                                    className="px-3 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-200 dark:border-sky-800/50 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                                                >
                                                    {isSendingActionComm ? (
                                                        <i className="fas fa-spinner fa-spin text-sky-500" />
                                                    ) : (
                                                        <i className="fab fa-facebook-messenger text-sky-500 dark:text-sky-400 text-[11px]" />
                                                    )}
                                                    <span>Messenger</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Status Options */}
                                <div>
                                    <div className="flex items-center justify-between mb-2.5">
                                        <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                                            Update Order Status
                                        </label>
                                        {!canUpdateStatus ? (
                                            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800/40 flex items-center gap-1">
                                                <i className="fas fa-lock text-[9px]" /> Managers, Execs & Admins Only
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
                                            const isDisabled = pendingRowId === actionModalOrder.id || isCurrent || isRestricted;

                                            // Solid background styles
                                            const getSolidButtonStyles = () => {
                                                if (isCurrent) {
                                                    switch (status) {
                                                        case 'Draft': return "bg-slate-700 text-white border-slate-800 shadow-sm ring-2 ring-slate-400/50 cursor-default";
                                                        case 'Sent': return "bg-blue-600 text-white border-blue-700 shadow-sm ring-2 ring-blue-400/50 cursor-default";
                                                        case 'Confirmed': return "bg-indigo-600 text-white border-indigo-700 shadow-sm ring-2 ring-indigo-400/50 cursor-default";
                                                        case 'Delivered': return "bg-emerald-600 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-400/50 cursor-default";
                                                        case 'Cancelled': return "bg-rose-600 text-white border-rose-700 shadow-sm ring-2 ring-rose-400/50 cursor-default";
                                                        default: return "bg-slate-700 text-white border-slate-800 shadow-sm cursor-default";
                                                    }
                                                }

                                                if (isRestricted) {
                                                    return "bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-60";
                                                }

                                                // Available status buttons (solid vibrant style on interaction)
                                                switch (status) {
                                                    case 'Draft': return "bg-slate-100 hover:bg-slate-700 text-slate-800 hover:text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 shadow-2xs hover:shadow-sm cursor-pointer";
                                                    case 'Sent': return "bg-blue-50 hover:bg-blue-600 text-blue-800 hover:text-white dark:bg-blue-950/40 dark:hover:bg-blue-600 dark:text-blue-200 border-blue-200 dark:border-blue-800/40 shadow-2xs hover:shadow-sm cursor-pointer";
                                                    case 'Confirmed': return "bg-indigo-50 hover:bg-indigo-600 text-indigo-800 hover:text-white dark:bg-indigo-950/40 dark:hover:bg-indigo-600 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800/40 shadow-2xs hover:shadow-sm cursor-pointer";
                                                    case 'Delivered': return "bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white dark:bg-emerald-950/40 dark:hover:bg-emerald-600 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/40 shadow-2xs hover:shadow-sm cursor-pointer";
                                                    case 'Cancelled': return "bg-rose-50 hover:bg-rose-600 text-rose-800 hover:text-white dark:bg-rose-950/40 dark:hover:bg-rose-600 dark:text-rose-200 border-rose-200 dark:border-rose-800/40 shadow-2xs hover:shadow-sm cursor-pointer";
                                                    default: return "bg-slate-100 hover:bg-slate-700 text-slate-800 hover:text-white border-slate-200 cursor-pointer";
                                                }
                                            };

                                            return (
                                                <button
                                                    key={status}
                                                    type="button"
                                                    disabled={isDisabled}
                                                    onClick={() => handleUpdateStatus(actionModalOrder.id, status)}
                                                    title={
                                                        isCurrent
                                                            ? `Current status is ${status}`
                                                            : isRestricted
                                                                ? requiresAdmin && !isAdmin
                                                                    ? "Admin Only: Only Administrators can set or modify Confirmed status"
                                                                    : "Only Managers, Executives, and Admins can update status"
                                                                : `Click to change status to ${status}`
                                                    }
                                                    className={`w-full px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between border ${getSolidButtonStyles()}`}
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <span className={`w-2.5 h-2.5 rounded-full ${
                                                            isCurrent 
                                                                ? 'bg-white shadow-xs' 
                                                                : status === 'Draft' ? 'bg-slate-400 dark:bg-slate-500'
                                                                : status === 'Sent' ? 'bg-indigo-500 dark:bg-indigo-400'
                                                                : status === 'Confirmed' ? 'bg-purple-500 dark:bg-purple-400'
                                                                : status === 'Delivered' ? 'bg-pink-500 dark:bg-pink-400'
                                                                : status === 'Cancelled' ? 'bg-rose-500 dark:bg-rose-400'
                                                                : 'bg-slate-400'
                                                        }`} />
                                                        <span className="font-bold">{status}</span>
                                                    </div>
                                                    {isCurrent ? (
                                                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-white/25 text-white tracking-wider">
                                                            Current ✓
                                                        </span>
                                                    ) : isRestricted ? (
                                                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                                            <i className="fas fa-lock text-[9px]" /> {requiresAdmin && !isAdmin ? 'Admin' : 'Locked'}
                                                        </span>
                                                    ) : (
                                                        <i className="fas fa-arrow-right text-[10px] opacity-60" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Danger Zone: Delete Button */}
                                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                                    <AppButton
                                        type="button"
                                        variant="danger"
                                        size="md"
                                        disabled={pendingRowId === actionModalOrder.id}
                                        onClick={() => handleDeleteOrder(actionModalOrder.id)}
                                        className="w-full"
                                    >
                                        <i className="fas fa-trash-alt" />
                                        <span>Delete Purchase Order</span>
                                    </AppButton>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Phase 4: OCR Receipt Verification Modal */}
                {isReceiptModalOpen && receiptModalPO && (
                    <UploadReceiptModal
                        isOpen={isReceiptModalOpen}
                        onClose={() => setIsReceiptModalOpen(false)}
                        po={receiptModalPO}
                        initialVerificationId={receiptVerificationId}
                        onMinimize={(job) => {
                            updateActiveVerificationJob(job);
                            setIsReceiptModalOpen(false);
                        }}
                        onSuccess={() => {
                            fetchData({ silent: true });
                        }}
                    />
                )}

                {/* Phase 4: Minimized Persistent Verification Indicator */}
                <ReceiptProcessingIndicator
                    job={activeVerificationJob}
                    onClick={() => {
                        if (activeVerificationJob) {
                            const target = purchaseOrders.find(p => p.id === activeVerificationJob.poId) || {
                                id: activeVerificationJob.poId,
                                po_number: activeVerificationJob.poNumber,
                                supplier_name: 'Supplier',
                                total_amount: 0,
                            } as any;
                            setReceiptModalPO(target);
                            setReceiptVerificationId(activeVerificationJob.verificationId);
                            setIsReceiptModalOpen(true);
                        }
                    }}
                    onDismiss={() => updateActiveVerificationJob(null)}
                />

                {/* On-Demand Lazy Document Viewer Modal */}
                <DocumentViewerModal
                    isOpen={isDocViewerOpen}
                    onClose={() => {
                        setIsDocViewerOpen(false);
                        setViewingDocData(null);
                    }}
                    data={viewingDocData}
                />
            </div>
        </SessionGuard>
    );
}