// custom hook encapsulating document management state, database queries, bulk actions, and realtime sync
'use client';

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/services/client/supabase";
import { toast } from "sonner";
import { useDebounce } from "../../../hooks/useDebounce";
import { useConfirm } from "../../../components/ui/ConfirmModal";
import { Document, Supplier, DEFAULT_USER } from "../types";
import { user } from "../../../lib/services/Class/user";
import { revokeCachedFilePreviewUrl, clearAllCachedFilePreviewUrls } from "../components/modals/SelectedFilesGridModal";
import { findSimilarExtractedDocument } from "../utils/textSimilarity";

const isValidUUID = (str: any): boolean => {
    return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

export function useDocuments() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialSearch = searchParams?.get('search') || "";
    const { confirm } = useConfirm();

    const [documents, setDocuments] = useState<Document[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState(initialSearch);

    // clean address bar query if search param is present
    useEffect(() => {
        const querySearch = searchParams?.get('search');
        if (querySearch) {
            setSearchTerm(querySearch);
            if (typeof window !== 'undefined') {
                window.history.replaceState(null, '', window.location.pathname);
            }
        }
    }, [searchParams]);

    const [typeFilter, setTypeFilter] = useState("");
    const [extensionFilter, setExtensionFilter] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [supplierFilter, setSupplierFilter] = useState("");
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [galleryViewMode, setGalleryViewMode] = useState<'grid' | 'list' | 'table'>('grid');
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
    const [attachTargetDoc, setAttachTargetDoc] = useState<Document | null>(null);
    const [ocrWarning, setOcrWarning] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [editingDoc, setEditingDoc] = useState<Document | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [editPreviewUrl, setEditPreviewUrl] = useState<string | null>(null);
    const [editPreviewLoading, setEditPreviewLoading] = useState(false);
    const [userName, setUserName] = useState<string>(DEFAULT_USER.name);
    const [userEmail, setUserEmail] = useState<string>(DEFAULT_USER.email);
    const [userRole, setUserRole] = useState<string>("");
    const [userSessionId, setUserSessionId] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [archiveCount, setArchiveCount] = useState(0);

    const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
    const [isDownloading, setIsDownloading] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const debouncedSearch = useDebounce(searchTerm, 300);
    const itemsPerPage = 50;

    const [totalFiles, setTotalFiles] = useState(0);
    const [totalPhotos, setTotalPhotos] = useState(0);
    const [totalDocuments, setTotalDocuments] = useState(0);
    const [purchaseOrders, setPurchaseOrders] = useState<Array<{ id: string; po_number: string; supplier_id?: number | null; supplier_name?: string }>>([]);

    const openAttachModal = useCallback((doc: Document) => {
        setAttachTargetDoc(doc);
        setIsAttachModalOpen(true);
    }, []);

    // fetch current user
    const getCurrentUser = useCallback(async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
                setUserId(authUser.id);
                const { data: userData, error } = await supabase
                    .from('users')
                    .select('display_name, email, role, session_id')
                    .eq('id', authUser.id)
                    .single();

                if (error) {
                    console.error('Error fetching user from users table:', error);
                    setUserEmail(authUser.email || DEFAULT_USER.email);
                    setUserName(authUser.user_metadata?.full_name || authUser.email || DEFAULT_USER.name);
                } else if (userData) {
                    setUserEmail(userData.email || DEFAULT_USER.email);
                    setUserName(userData.display_name || userData.email || DEFAULT_USER.name);
                    setUserRole(userData.role || '');
                    setUserSessionId(userData.session_id || null);
                    if (userData.role) {
                        user.updateUser({ role: userData.role });
                    }
                }
            } else {
                setUserId(null);
                setUserName(DEFAULT_USER.name);
                setUserEmail(DEFAULT_USER.email);
                setUserRole('');
                setUserSessionId(null);
            }
        } catch (error) {
            console.error('Error getting user:', error);
            setUserId(null);
            setUserName(DEFAULT_USER.name);
            setUserEmail(DEFAULT_USER.email);
            setUserRole('');
            setUserSessionId(null);
        }
    }, []);

    // fetch documents with filters and pagination
    const fetchDocuments = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) {
                setLoading(true);
            } else {
                setRefreshing(true);
            }

            let query = supabase
                .from('supplier_documents')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false });

            if (debouncedSearch) {
                query = query.or(
                    `title.ilike.%${debouncedSearch}%,file_name.ilike.%${debouncedSearch}%,po_number.ilike.%${debouncedSearch}%`
                );
            }

            if (typeFilter) {
                query = query.eq('document_type', typeFilter);
            }

            if (extensionFilter) {
                if (extensionFilter === "jpg") {
                    query = query.or('file_name.ilike.%.jpg,file_name.ilike.%.jpeg,file_type.ilike.%jpeg%');
                } else if (extensionFilter === "png") {
                    query = query.or('file_name.ilike.%.png,file_type.ilike.%png%');
                } else if (extensionFilter === "pdf") {
                    query = query.or('file_name.ilike.%.pdf,file_type.ilike.%pdf%');
                } else if (extensionFilter === "word") {
                    query = query.or('file_name.ilike.%.docx,file_name.ilike.%.doc,file_type.ilike.%word%,file_type.ilike.%officedocument%');
                } else if (extensionFilter === "excel") {
                    query = query.or('file_name.ilike.%.xlsx,file_name.ilike.%.xls,file_type.ilike.%sheet%,file_type.ilike.%excel%');
                }
            }

            if (categoryFilter) {
                query = query.eq('category', categoryFilter);
            }

            if (supplierFilter) {
                query = query.eq('supplier', supplierFilter);
            }

            if (dateFrom) {
                query = query.gte('created_at', dateFrom);
            }
            if (dateTo) {
                query = query.lte('created_at', dateTo);
            }

            const from = (currentPage - 1) * itemsPerPage;
            const to = from + itemsPerPage - 1;
            query = query.range(from, to);

            const { data, error, count } = await query;

            if (error) throw error;

            const rawDocs = data || [];

            // resolve user names for uploaded_by, user_id, and force_inserted_by
            const userLookupIds = rawDocs
                .map((d: any) => d.uploaded_by || d.user_id)
                .filter((id: string | null): id is string => Boolean(id) && isValidUUID(id));
            const forcedIds = rawDocs
                .map((d: any) => d.force_inserted_by)
                .filter((id: string | null): id is string => Boolean(id) && isValidUUID(id));

            const allUserIds = Array.from(new Set([...userLookupIds, ...forcedIds]));
            let userMap: Record<string, string> = {};
            if (allUserIds.length > 0) {
                try {
                    const { data: usersData } = await supabase
                        .from('users')
                        .select('id, display_name, email')
                        .in('id', allUserIds);
                    if (usersData) {
                        usersData.forEach((u: any) => {
                            userMap[u.id] = u.display_name || u.email || 'User';
                        });
                    }
                } catch (userErr) {
                    console.warn('Could not load user names:', userErr);
                }
            }

            // resolve linked purchase orders
            const purchaseIds = rawDocs
                .map((d: any) => d.purchase_id)
                .filter((id: string | null): id is string => Boolean(id));

            let poMap: Record<string, any> = {};
            if (purchaseIds.length > 0) {
                try {
                    const { data: pos } = await supabase
                        .from('purchase_orders')
                        .select('id, po_number, supplier_name, status, total_amount')
                        .in('id', Array.from(new Set(purchaseIds)));
                    if (pos) {
                        pos.forEach((p: any) => {
                            poMap[p.id] = p;
                        });
                    }
                } catch (poErr) {
                    console.warn('Could not load linked purchase orders:', poErr);
                }
            }

            const enrichedDocs = rawDocs.map((d: any) => {
                let displayName = 'System User';
                if (d.uploaded_by) {
                    displayName = isValidUUID(d.uploaded_by) ? (userMap[d.uploaded_by] || 'User') : d.uploaded_by;
                } else if (d.user_id && isValidUUID(d.user_id)) {
                    displayName = userMap[d.user_id] || 'User';
                }

                return {
                    ...d,
                    uploaded_by: displayName,
                    purchase_orders: d.purchase_id ? (poMap[d.purchase_id] || null) : null,
                    force_user_name: d.force_inserted_by ? (userMap[d.force_inserted_by] || 'Authorized Administrator') : null,
                };
            });

            setDocuments(enrichedDocs);
            setTotalItems(count || 0);
            setTotalPages(Math.ceil((count || 0) / itemsPerPage));

            const currentIds = new Set((enrichedDocs).map(d => d.id));
            setSelectedDocIds(prev => new Set([...prev].filter(id => currentIds.has(id))));
        } catch (error) {
            console.error('Error fetching documents:', error);
            toast.error('Failed to load documents');
        } finally {
            if (showLoading) {
                setLoading(false);
            } else {
                setRefreshing(false);
            }
        }
    }, [debouncedSearch, typeFilter, extensionFilter, categoryFilter, supplierFilter, dateFrom, dateTo, currentPage]);


    // fetch archive count
    const fetchArchiveCount = useCallback(async () => {
        try {
            const { count, error } = await supabase
                .from('documents_archive')
                .select('*', { count: 'exact', head: true });

            if (error) throw error;
            setArchiveCount(count || 0);
        } catch (error) {
            console.error('Error fetching archive count:', error);
        }
    }, []);

    // fetch summary statistics
    const fetchStatistics = useCallback(async () => {
        try {
            const { count: totalCount, error: totalError } = await supabase
                .from('supplier_documents')
                .select('*', { count: 'exact', head: true });

            if (totalError) throw totalError;
            setTotalFiles(totalCount || 0);

            const { count: photosCount, error: photosError } = await supabase
                .from('supplier_documents')
                .select('*', { count: 'exact', head: true })
                .eq('category', 'photos');

            if (photosError) throw photosError;
            setTotalPhotos(photosCount || 0);

            setTotalDocuments((totalCount || 0) - (photosCount || 0));
        } catch (error) {
            console.error('Error fetching statistics:', error);
        }
    }, []);

    // select supplier and update filter/URL
    const handleSelectSupplier = useCallback((supplier: Supplier | null) => {
        setSelectedSupplier(supplier);
        if (supplier && supplier.id !== 0 && supplier.name !== 'All Suppliers') {
            setSupplierFilter(supplier.name);
        } else {
            setSupplierFilter('');
        }
        setCurrentPage(1);
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            if (supplier && supplier.id !== 0 && supplier.name !== 'All Suppliers') {
                url.searchParams.set('supplier', supplier.name);
            } else {
                url.searchParams.delete('supplier');
            }
            window.history.replaceState(null, '', url.pathname + (url.search ? url.search : ''));
        }
    }, []);

    // fetch suppliers with document and photo statistics
    const fetchSuppliers = useCallback(async () => {
        try {
            const { data: suppliersData, error: supError } = await supabase
                .from('suppliers')
                .select('*')
                .eq('is_active', true)
                .order('name');

            if (supError) throw supError;

            // Fetch aggregate document stats for each supplier from supplier_documents
            const { data: docsData, error: docsError } = await supabase
                .from('supplier_documents')
                .select('supplier_id, supplier, category, file_size, created_at');

            const statsMap = new Map<string, {
                docCount: number;
                photoCount: number;
                totalFiles: number;
                totalSize: number;
                latestUpload: string | null;
            }>();

            if (!docsError && docsData) {
                docsData.forEach((d: any) => {
                    const idKey = d.supplier_id ? String(d.supplier_id) : '';
                    const nameKey = d.supplier ? String(d.supplier).toLowerCase().trim() : '';

                    [idKey, nameKey].forEach(k => {
                        if (!k) return;
                        if (!statsMap.has(k)) {
                            statsMap.set(k, {
                                docCount: 0,
                                photoCount: 0,
                                totalFiles: 0,
                                totalSize: 0,
                                latestUpload: null,
                            });
                        }
                    });

                    const targetStat = (idKey && statsMap.get(idKey)) || (nameKey && statsMap.get(nameKey));
                    if (targetStat) {
                        targetStat.totalFiles += 1;
                        if (d.category === 'photos') {
                            targetStat.photoCount += 1;
                        } else {
                            targetStat.docCount += 1;
                        }
                        targetStat.totalSize += (d.file_size || 0);
                        if (d.created_at) {
                            if (!targetStat.latestUpload || new Date(d.created_at) > new Date(targetStat.latestUpload)) {
                                targetStat.latestUpload = d.created_at;
                            }
                        }
                    }
                });
            }

            const enrichedSuppliers: Supplier[] = (suppliersData || []).map((s: any) => {
                const stat = statsMap.get(String(s.id)) || statsMap.get((s.name || '').toLowerCase().trim());
                return {
                    ...s,
                    document_count: stat ? stat.docCount : 0,
                    photo_count: stat ? stat.photoCount : 0,
                    total_files: stat ? stat.totalFiles : 0,
                    total_size: stat ? stat.totalSize : 0,
                    latest_upload: stat ? stat.latestUpload : null,
                };
            });

            setSuppliers(enrichedSuppliers);

            // check if URL has supplier param to auto-select on mount
            if (typeof window !== 'undefined') {
                const searchParams = new URLSearchParams(window.location.search);
                const supplierParam = searchParams.get('supplier');
                if (supplierParam) {
                    const matched = enrichedSuppliers.find(
                        (s) => s.name.toLowerCase() === supplierParam.toLowerCase()
                    );
                    if (matched) {
                        setSelectedSupplier(matched);
                        setSupplierFilter(matched.name);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching suppliers:', error);
        }
    }, []);

    // fetch active purchase orders
    const fetchPurchaseOrders = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('purchase_orders')
                .select('id, po_number, supplier_id, supplier_name')
                .order('po_number', { ascending: false });

            if (!error && data) {
                setPurchaseOrders(data);
            }
        } catch (err) {
            console.warn('Error fetching purchase orders:', err);
        }
    }, []);


    // download single file
    const downloadFile = useCallback(async (doc: Document) => {
        try {
            const toastId = toast.loading('Downloading file...');

            const { data: { publicUrl } } = supabase.storage
                .from('documents')
                .getPublicUrl(doc.storage_path);

            const response = await fetch(publicUrl);
            const blob = await response.blob();

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = doc.file_name || `${doc.title}.${doc.file_type.split('/').pop() || 'pdf'}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            toast.success('File downloaded successfully!', { id: toastId });
        } catch (error) {
            console.error('Download error:', error);
            toast.error('Failed to download file');
        }
    }, []);

    // delete single document
    const handleDelete = useCallback(async (doc: Document) => {
        const confirmed = await confirm({
            title: 'Delete Document',
            message: `Are you sure you want to delete "${doc.title}"? This action cannot be undone.`,
            confirmText: 'Delete',
            confirmVariant: 'danger'
        });

        if (!confirmed) return;

        const toastId = toast.loading('Deleting document...');

        try {
            const deletedBy = userName || DEFAULT_USER.name;

            const { error } = await supabase
                .from('supplier_documents')
                .delete()
                .eq('id', doc.id);

            if (error) throw error;

            setSelectedDocIds(prev => {
                const updated = new Set(prev);
                updated.delete(doc.id);
                return updated;
            });

            toast.success('Document deleted and archived successfully', { id: toastId });

            await fetchArchiveCount();
            await fetchDocuments(false);
            await fetchStatistics();
        } catch (error) {
            console.error('Delete error:', error);
            toast.error('Failed to delete document', { id: toastId });
        }
    }, [userName, fetchArchiveCount, fetchDocuments, fetchStatistics, confirm]);

    // download multiple selected files
    const downloadSelectedFiles = useCallback(async () => {
        if (selectedDocIds.size === 0) {
            toast.warning('Please select files to download');
            return;
        }

        const selectedDocs = documents.filter(doc => selectedDocIds.has(doc.id));
        if (selectedDocs.length === 0) {
            toast.warning('Selected files not found');
            return;
        }

        setIsDownloading(true);
        const toastId = toast.loading(`Downloading ${selectedDocs.length} file(s)...`);

        try {
            let successCount = 0;
            let failCount = 0;

            for (const doc of selectedDocs) {
                try {
                    const { data: { publicUrl } } = supabase.storage
                        .from('documents')
                        .getPublicUrl(doc.storage_path);

                    const response = await fetch(publicUrl);
                    const blob = await response.blob();

                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = doc.file_name || `${doc.title}.${doc.file_type.split('/').pop() || 'pdf'}`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);

                    successCount++;
                    await new Promise(resolve => setTimeout(resolve, 200));
                } catch (error) {
                    console.error(`Error downloading ${doc.title}:`, error);
                    failCount++;
                }
            }

            if (successCount > 0 && failCount === 0) {
                toast.success(`Successfully downloaded ${successCount} file(s)!`, { id: toastId });
            } else if (successCount > 0 && failCount > 0) {
                toast.warning(`Downloaded ${successCount} file(s), ${failCount} failed`, { id: toastId });
            } else {
                toast.error('Failed to download files', { id: toastId });
            }

            setSelectedDocIds(new Set());
        } catch (error) {
            console.error('Bulk download error:', error);
            toast.error('Failed to download files', { id: toastId });
        } finally {
            setIsDownloading(false);
        }
    }, [selectedDocIds, documents]);

    // delete multiple selected documents
    const deleteSelectedDocuments = useCallback(async () => {
        if (selectedDocIds.size === 0) {
            toast.warning('Please select files to delete');
            return;
        }

        const selectedDocs = documents.filter(doc => selectedDocIds.has(doc.id));
        if (selectedDocs.length === 0) {
            toast.warning('Selected files not found');
            return;
        }

        const confirmed = await confirm({
            title: `Delete ${selectedDocs.length} Documents`,
            message: `Are you sure you want to permanently delete ${selectedDocs.length} selected document(s)? This action cannot be undone.`,
            confirmText: 'Delete All',
            confirmVariant: 'danger'
        });

        if (!confirmed) return;

        setIsBulkDeleting(true);
        const toastId = toast.loading(`Deleting ${selectedDocs.length} document(s)...`);

        try {
            let successCount = 0;
            let failCount = 0;

            for (const doc of selectedDocs) {
                try {
                    const deletedBy = userName || DEFAULT_USER.name;

                    await supabase.storage.from('documents').remove([doc.storage_path]);

                    const { error } = await supabase
                        .from('supplier_documents')
                        .delete()
                        .eq('id', doc.id);

                    if (error) {
                        console.error('Delete error for', doc.title, error);
                        failCount++;
                        continue;
                    }

                    successCount++;
                } catch (error) {
                    console.error(`Error deleting ${doc.title}:`, error);
                    failCount++;
                }
            }

            if (successCount > 0 && failCount === 0) {
                toast.success(`Successfully deleted ${successCount} document(s)!`, { id: toastId });
            } else if (successCount > 0 && failCount > 0) {
                toast.warning(`Deleted ${successCount} document(s), ${failCount} failed`, { id: toastId });
            } else {
                toast.error('Failed to delete documents', { id: toastId });
            }

            setSelectedDocIds(new Set());
            await fetchArchiveCount();
            await fetchDocuments(false);
            await fetchStatistics();
        } catch (error) {
            console.error('Bulk delete error:', error);
            toast.error('Failed to delete documents', { id: toastId });
        } finally {
            setIsBulkDeleting(false);
        }
    }, [selectedDocIds, documents, userName, fetchArchiveCount, fetchDocuments, fetchStatistics, confirm]);

    // Periodic check to notify creators of pending documents (every 5 mins for testing)
    const triggerPendingNotifications = useCallback(async () => {
        try {
            await fetch('/api/supplyChain/documents/pending-notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ intervalMs: 5 * 60 * 1000 }),
            });
        } catch (err) {
            console.warn('Pending document notification check failed:', err);
        }
    }, []);

    // Background OCR runner that processes uploaded files asynchronously without blocking the user
    const runBackgroundOcr = async (
        items: Array<{
            docId: string;
            file: File;
            initialPoNumber: string | null;
            initialPrice: string | null;
            initialSupplier: string | null;
            resolvedSupplierId: number | null;
        }>
    ) => {
        for (const item of items) {
            try {
                // Convert file to base64
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve, reject) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                });
                reader.readAsDataURL(item.file);
                const fileBase64 = await base64Promise;

                const ocrRes = await fetch('/ai/api/verify-document-ocr', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fileBase64,
                        fileName: item.file.name,
                        fileSize: item.file.size,
                        fileType: item.file.type,
                        userRole: userRole,
                        userName: userName || DEFAULT_USER.name,
                        excludeDocId: item.docId,
                    }),
                });

                if (!ocrRes.ok) {
                    console.warn(`[Background OCR] HTTP error ${ocrRes.status} for ${item.file.name}`);
                    continue;
                }

                const ocrData = await ocrRes.json();
                if (ocrData?.success) {
                    const extractedRecord = ocrData.extracted || {
                        text: ocrData.extracted_text || null,
                        description: ocrData.photo_description || ocrData.summary || null,
                        visual_objects: ocrData.visual_objects || [],
                        vendor_name: ocrData.extracted_supplier || item.initialSupplier || null,
                        po_number: ocrData.extracted_po_number || item.initialPoNumber || null,
                        price: ocrData.extracted_price || item.initialPrice || null,
                        summary: ocrData.summary || null,
                        document_type: ocrData.detected_type || null,
                        category: ocrData.detected_category || null,
                        confidence_score: ocrData.confidence_score || 90,
                        extracted_at: new Date().toISOString(),
                        status: 'completed',
                    };

                    const updatePayload: any = {
                        extracted_text: ocrData.extracted_text || ocrData.extracted?.text || null,
                        extracted_data: ocrData.extracted || null,
                        extracted: extractedRecord,
                        updated_at: new Date().toISOString(),
                    };

                    if (!item.initialPoNumber && ocrData.extracted_po_number) {
                        updatePayload.po_number = ocrData.extracted_po_number;
                    }
                    if (!item.initialPrice && ocrData.extracted_price) {
                        updatePayload.Price = ocrData.extracted_price;
                    }
                    if (!item.initialSupplier && ocrData.extracted_supplier) {
                        updatePayload.supplier = ocrData.extracted_supplier;
                        const matched = suppliers.find(s => s.name.toLowerCase() === ocrData.extracted_supplier.toLowerCase());
                        if (matched) {
                            updatePayload.supplier_id = matched.id;
                        }
                    }

                    await supabase
                        .from('supplier_documents')
                        .update(updatePayload)
                        .eq('id', item.docId);

                    toast.success(`AI OCR completed for "${item.file.name}"`, {
                        duration: 3500,
                    });

                    await fetchDocuments(false);
                }
            } catch (ocrErr) {
                console.warn(`[Background OCR] error for ${item.file.name}:`, ocrErr);
            }
        }
    };

    // handle upload submission with background OCR and fileless option
    const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (isUploading) {
            toast.warning('An upload is currently in progress. Please wait.');
            return;
        }

        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);

        const isPendingFile = formData.get('isPendingFile') === 'on' || selectedFiles.length === 0;
        const title = (formData.get('title') as string) || '';
        const documentType = (formData.get('documentType') as string) || 'Other';
        const category = (formData.get('category') as string) || 'documents';
        const supplier = (formData.get('supplier') as string) || null;
        const poNumber = (formData.get('poNumber') as string) || null;
        const parcelBatch = (formData.get('parcelBatch') as string) || null;
        const uploadedBy = (formData.get('uploadedBy') as string) || userName || DEFAULT_USER.name;
        const notes = (formData.get('notes') as string) || null;
        const price = (formData.get('price') as string) || null;
        const preExtractedJson = (formData.get('preExtractedData') as string) || '';
        let parsedPreExtracted: any = null;
        if (preExtractedJson) {
            try {
                parsedPreExtracted = JSON.parse(preExtractedJson);
            } catch {}
        }

        let currentUserId = userId;
        if (!currentUserId) {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            currentUserId = authUser?.id || null;
        }

        const effectiveUploaderUuid = isValidUUID(currentUserId)
            ? currentUserId
            : (isValidUUID(uploadedBy) ? uploadedBy : null);
        const effectiveUserId = isValidUUID(currentUserId) ? currentUserId : null;
        const effectiveSessionId = isValidUUID(userSessionId) ? userSessionId : null;

        const isPrivileged = ['Executive', 'Admin'].includes(userRole);

        // Path 1: Create record without file
        if (isPendingFile) {
            if (!title.trim()) {
                toast.warning('Please enter a document title for the record.');
                return;
            }

            setIsUploading(true);
            const toastId = toast.loading('Creating document record...');

            try {
                let resolvedSupplierId: number | null = null;
                if (supplier && suppliers.length > 0) {
                    const matched = suppliers.find(s => s.name.toLowerCase() === supplier.toLowerCase());
                    if (matched) resolvedSupplierId = matched.id;
                } else if (selectedSupplier && selectedSupplier.id !== 0) {
                    resolvedSupplierId = selectedSupplier.id;
                }

                const insertData: any = {
                    title: title.trim(),
                    file_name: 'Pending Attachment',
                    file_size: 0,
                    file_type: 'pending',
                    storage_path: '',
                    category: category,
                    document_type: documentType,
                    supplier_id: resolvedSupplierId,
                    supplier: supplier || (resolvedSupplierId ? suppliers.find(s => s.id === resolvedSupplierId)?.name : null) || null,
                    po_number: poNumber,
                    parcel_batch: parcelBatch,
                    uploaded_by: effectiveUploaderUuid,
                    notes: notes,
                    Price: price,
                    version: 1,
                    user_id: effectiveUserId,
                    session_id: effectiveSessionId,
                    role: userRole || null,
                };

                const { data: insertedDoc, error: insertError } = await supabase
                    .from('supplier_documents')
                    .insert(insertData)
                    .select()
                    .single();

                if (insertError) throw insertError;

                // Insert immediate notification in notifications table for the uploader only
                try {
                    const notifData: any = {
                        creator_name: uploadedBy || userName || DEFAULT_USER.name,
                        creator_email: userEmail || DEFAULT_USER.email,
                        title: `Missing File: "${title.trim()}"`,
                        message: `Document "${title.trim()}" (Ref: ${(insertedDoc?.id || '').substring(0, 8)}) was created without an attachment. Please attach the required file.`,
                        type: 'alert',
                        link: '/documents',
                        role: userRole || 'User',
                        reference_type: 'document_pending',
                        reference_id: insertedDoc?.id || null,
                        is_read: false,
                    };

                    if (effectiveUserId) {
                        notifData.user_id = effectiveUserId;
                    }

                    const { error: notifInsertError } = await supabase
                        .from('notifications')
                        .insert(notifData);

                    if (notifInsertError && notifData.user_id) {
                        console.warn('FK constraint failed on notification user_id, retrying without user_id:', notifInsertError.message);
                        delete notifData.user_id;
                        await supabase.from('notifications').insert(notifData);
                    }
                } catch (notifErr) {
                    console.error('Failed to create pending document notification:', notifErr);
                }

                toast.success('Document record created! You can attach a file later.', { id: toastId });
                setIsUploadModalOpen(false);
                setSelectedFiles([]);
                setOcrWarning(null);

                await fetchStatistics();
                await fetchDocuments(false);
            } catch (error: any) {
                console.error('Error creating fileless document:', error);
                toast.error(error.message || 'Failed to create document record', { id: toastId });
            } finally {
                setIsUploading(false);
            }
            return;
        }

        // Path 2: Upload with attached file(s) and trigger AI OCR in the background
        setIsUploading(true);
        setUploadProgress(0);
        const totalFiles = selectedFiles.length;
        const toastId = toast.loading(`Uploading 1 of ${totalFiles} file(s)...`);

        try {
            const uploadedFiles: string[] = [];
            const duplicateFiles: { name: string; matchedTitle?: string; similarity?: number }[] = [];
            const trashFiles: { name: string; searchQuery: string }[] = [];
            const skippedFiles: { name: string; reason: string }[] = [];
            const failedFiles: { name: string; reason: string }[] = [];
            const filesForBackgroundOcr: Array<{
                docId: string;
                file: File;
                initialPoNumber: string | null;
                initialPrice: string | null;
                initialSupplier: string | null;
                resolvedSupplierId: number | null;
            }> = [];

            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                const currentPct = Math.round((i / totalFiles) * 100);
                toast.loading(`Uploading "${file.name}" (${i + 1}/${totalFiles} • ${currentPct}%)...`, { id: toastId });

                // 1. Check exact file in trash archive first
                const { data: existingTrashDocs } = await supabase
                    .from('documents_archive')
                    .select('id, file_name, file_size, title, po_number')
                    .ilike('file_name', file.name)
                    .eq('file_size', file.size);

                if (existingTrashDocs && existingTrashDocs.length > 0) {
                    const match = existingTrashDocs[0];
                    const searchQ = match.file_name || match.title || file.name;
                    trashFiles.push({ name: file.name, searchQuery: searchQ });
                    skippedFiles.push({ name: file.name, reason: 'File is already in trash' });
                    setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
                    continue;
                }

                // Check exact file duplicate in active database
                const { data: existingDocs, error: checkError } = await supabase
                    .from('supplier_documents')
                    .select('id, file_name, file_size, storage_path')
                    .ilike('file_name', file.name)
                    .eq('file_size', file.size);

                if (checkError) {
                    console.error('Duplicate check error:', checkError);
                    failedFiles.push({ name: file.name, reason: `Duplicate check error: ${checkError.message}` });
                    setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
                    continue;
                }

                if (existingDocs && existingDocs.length > 0) {
                    duplicateFiles.push({ name: file.name });
                    skippedFiles.push({ name: file.name, reason: 'Already uploaded in system' });
                    setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
                    continue;
                }

                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
                const filePath = `documents/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('documents')
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: true
                    });

                if (uploadError) {
                    console.error('Upload error:', uploadError);
                    failedFiles.push({ name: file.name, reason: uploadError.message || 'Storage upload error' });
                    setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
                    continue;
                }

                let resolvedSupplierId: number | null = null;
                if (supplier && suppliers.length > 0) {
                    const matched = suppliers.find(s => s.name.toLowerCase() === supplier.toLowerCase());
                    if (matched) resolvedSupplierId = matched.id;
                } else if (selectedSupplier && selectedSupplier.id !== 0) {
                    resolvedSupplierId = selectedSupplier.id;
                }

                const { data: publicUrlData } = supabase.storage
                    .from('documents')
                    .getPublicUrl(filePath);
                const filePublicUrl = publicUrlData?.publicUrl || null;

                const docTitle = title.trim()
                    ? (totalFiles > 1 ? `${title.trim()} (${file.name})` : title.trim())
                    : `${documentType} - ${file.name}`;

                const insertData: any = {
                    title: docTitle,
                    file_name: file.name,
                    file_size: file.size,
                    file_type: file.type || fileExt || 'unknown',
                    storage_path: filePath,
                    file_url: filePublicUrl,
                    category: category,
                    document_type: documentType,
                    supplier_id: resolvedSupplierId,
                    supplier: supplier || (resolvedSupplierId ? suppliers.find(s => s.id === resolvedSupplierId)?.name : null) || null,
                    po_number: poNumber,
                    parcel_batch: parcelBatch,
                    uploaded_by: effectiveUploaderUuid,
                    notes: notes,
                    Price: price,
                    version: 1,
                    user_id: effectiveUserId,
                    session_id: effectiveSessionId,
                    role: userRole || null,
                    extracted_text: (parsedPreExtracted && (i === 0 || totalFiles === 1)) ? (parsedPreExtracted.text || parsedPreExtracted.extracted_text || null) : null,
                    extracted_data: (parsedPreExtracted && (i === 0 || totalFiles === 1)) ? parsedPreExtracted : null,
                    extracted: (parsedPreExtracted && (i === 0 || totalFiles === 1)) ? {
                        status: 'completed',
                        text: parsedPreExtracted.text || parsedPreExtracted.extracted_text || null,
                        description: parsedPreExtracted.description || parsedPreExtracted.photo_description || null,
                        visual_objects: parsedPreExtracted.visual_objects || [],
                        vendor_name: parsedPreExtracted.vendor_name || supplier || null,
                        po_number: parsedPreExtracted.po_number || poNumber || null,
                        price: parsedPreExtracted.price || price || null,
                        summary: parsedPreExtracted.summary || null,
                        document_type: parsedPreExtracted.document_type || documentType || null,
                        category: parsedPreExtracted.category || category || null,
                        confidence_score: parsedPreExtracted.confidence_score || 95,
                        extracted_at: new Date().toISOString(),
                    } : {
                        status: 'processing',
                        message: 'Running AI OCR in background...',
                        ocr_pending: true,
                        started_at: new Date().toISOString(),
                    },
                };

                const { data: insertedDoc, error: insertError } = await supabase
                    .from('supplier_documents')
                    .insert(insertData)
                    .select('id')
                    .single();

                if (insertError) {
                    console.error('Insert error:', insertError);
                    failedFiles.push({ name: file.name, reason: insertError.message || 'Database save error' });
                    setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
                    continue;
                }

                uploadedFiles.push(file.name);
                const isAlreadyExtracted = parsedPreExtracted && (i === 0 || totalFiles === 1) && (insertData.extracted?.status === 'completed');
                if (insertedDoc?.id && !isAlreadyExtracted) {
                    filesForBackgroundOcr.push({
                        docId: insertedDoc.id,
                        file: file,
                        initialPoNumber: poNumber,
                        initialPrice: price,
                        initialSupplier: supplier,
                        resolvedSupplierId: resolvedSupplierId,
                    });
                }
                const stepPct = Math.round(((i + 1) / totalFiles) * 100);
                setUploadProgress(stepPct);
            }

            const unuploadedItems = [
                ...failedFiles.map(f => `• ${f.name} (Failed: ${f.reason})`),
                ...skippedFiles.map(s => `• ${s.name} (Skipped: ${s.reason})`),
            ];

            // Feedback and modal dismissal
            if (uploadedFiles.length > 0) {
                clearAllCachedFilePreviewUrls();
                setSelectedFiles([]);
                setUploadProgress(0);
                setIsUploadModalOpen(false);
                setOcrWarning(null);

                toast.success(
                    uploadedFiles.length === 1
                        ? `Document uploaded successfully! AI OCR is processing in the background.`
                        : `All ${uploadedFiles.length} file(s) uploaded! AI OCR is processing in the background.`,
                    {
                        id: toastId,
                        duration: 4000,
                    }
                );

                await fetchStatistics();
                await fetchDocuments(false);

                // Launch non-blocking background OCR
                if (filesForBackgroundOcr.length > 0) {
                    runBackgroundOcr(filesForBackgroundOcr);
                }
            } else if (trashFiles.length > 0 && duplicateFiles.length === 0) {
                const targetQ = trashFiles[0].searchQuery;
                toast.warning(
                    trashFiles.length === 1
                        ? `file is already in trash ask your manager to restore it to avoid duplication or see if you can restore it`
                        : `${trashFiles.length} files are already in trash. Ask your manager to restore them to avoid duplication or see if you can restore them.`,
                    {
                        id: toastId,
                        duration: 12000,
                        action: {
                            label: 'View in Trash',
                            onClick: () => {
                                router.push(`/trash?tab=documents&q=${encodeURIComponent(targetQ)}`);
                            },
                        },
                    }
                );
            } else if (duplicateFiles.length === selectedFiles.length) {
                if (duplicateFiles.length === 1) {
                    const dup = duplicateFiles[0];
                    toast.info(
                        dup.matchedTitle
                            ? `Document "${dup.name}" was already uploaded previously (similar content to "${dup.matchedTitle}").`
                            : `Document "${dup.name}" has already been uploaded previously.`,
                        {
                            id: toastId,
                            duration: 6000,
                        }
                    );
                } else {
                    toast.info(
                        `All ${duplicateFiles.length} file(s) are already uploaded:\n${duplicateFiles.map(d => d.matchedTitle ? `• ${d.name} (similar to "${d.matchedTitle}")` : `• ${d.name}`).join('\n')}`,
                        {
                            id: toastId,
                            duration: 7000,
                        }
                    );
                }
            } else {
                if (failedFiles.length > 0) {
                    toast.error(
                        `Failed to upload ${failedFiles.length} file(s):\n${failedFiles.map(f => `• ${f.name} (${f.reason})`).join('\n')}`,
                        { id: toastId, duration: 8000 }
                    );
                } else if (unuploadedItems.length > 0) {
                    toast.error(
                        `None of the ${selectedFiles.length} file(s) could be uploaded:\n${unuploadedItems.join('\n')}`,
                        { id: toastId, duration: 8000 }
                    );
                }
            }

            // In-app Notification record to the uploader
            try {
                let notifTitle = '';
                let notifMsg = '';
                let notifType = 'info';

                if (uploadedFiles.length === selectedFiles.length) {
                    notifTitle = `Upload Complete: All ${uploadedFiles.length} files uploaded`;
                    notifMsg = `All ${uploadedFiles.length} document(s) (${documentType}, ${category}) were successfully saved. Background OCR active.`;
                    notifType = 'info';
                } else if (duplicateFiles.length === selectedFiles.length) {
                    notifTitle = `Upload Skipped: Already uploaded`;
                    notifMsg = `${duplicateFiles.length} file(s) already exist in the document archive.`;
                    notifType = 'info';
                } else if (uploadedFiles.length > 0) {
                    notifTitle = `Upload Partial: ${uploadedFiles.length}/${selectedFiles.length} files uploaded`;
                    notifMsg = `Uploaded ${uploadedFiles.length} of ${selectedFiles.length} files.\n${unuploadedItems.length} file(s) were not uploaded:\n${unuploadedItems.join('\n')}`;
                    notifType = 'alert';
                } else {
                    notifTitle = `Upload Failed: 0/${selectedFiles.length} files uploaded`;
                    notifMsg = `Failed to upload ${selectedFiles.length} file(s):\n${unuploadedItems.join('\n')}`;
                    notifType = 'alert';
                }

                const notifData: any = {
                    creator_name: uploadedBy || userName || DEFAULT_USER.name,
                    creator_email: userEmail || DEFAULT_USER.email,
                    title: notifTitle,
                    message: notifMsg,
                    type: notifType,
                    link: '/documents',
                    role: userRole || 'User',
                    reference_type: 'document_upload',
                    is_read: false,
                };

                if (effectiveUserId) {
                    notifData.user_id = effectiveUserId;
                }

                const { error: notifErr } = await supabase
                    .from('notifications')
                    .insert(notifData);

                if (notifErr && notifData.user_id) {
                    delete notifData.user_id;
                    await supabase.from('notifications').insert(notifData);
                }
            } catch (notifErr) {
                console.warn('Could not insert document upload notification:', notifErr);
            }
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error(error.message || 'Failed to upload files', {
                id: toastId,
                duration: 5000,
            });
        } finally {
            setIsUploading(false);
        }
    };

    // Confirm force upload for privileged Admin/Executive
    const handleConfirmForceUpload = async () => {
        if (isUploading || selectedFiles.length === 0) return;
        setIsUploading(true);
        setUploadProgress(0);
        const totalFiles = selectedFiles.length;
        const toastId = toast.loading(`Uploading 1 of ${totalFiles} file(s) with Admin override (0%)...`);

        try {
            let currentUserId = userId;
            if (!currentUserId) {
                const { data: { user: authUser } } = await supabase.auth.getUser();
                currentUserId = authUser?.id || null;
            }

            const effectiveUploaderUuid = isValidUUID(currentUserId)
                ? currentUserId
                : (isValidUUID(userName) ? userName : null);
            const effectiveUserId = isValidUUID(currentUserId) ? currentUserId : null;
            const effectiveSessionId = isValidUUID(userSessionId) ? userSessionId : null;

            const uploadedFiles: string[] = [];
            const duplicateFiles: string[] = [];
            const failedFiles: { name: string; reason: string }[] = [];

            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                const currentPct = Math.round((i / totalFiles) * 100);
                toast.loading(`Uploading "${file.name}" (${i + 1}/${totalFiles} • ${currentPct}%)...`, { id: toastId });

                try {
                    // Check duplicate in database (case-insensitive filename and matching file size)
                    const { data: existingDocs } = await supabase
                        .from('supplier_documents')
                        .select('id, file_name, file_size')
                        .ilike('file_name', file.name)
                        .eq('file_size', file.size);

                    if (existingDocs && existingDocs.length > 0) {
                        duplicateFiles.push(file.name);
                        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
                        continue;
                    }

                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
                    const filePath = `documents/${fileName}`;

                    const { error: uploadError } = await supabase.storage
                        .from('documents')
                        .upload(filePath, file, { cacheControl: '3600', upsert: true });

                    if (uploadError) {
                        failedFiles.push({ name: file.name, reason: uploadError.message || 'Storage error' });
                        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
                        continue;
                    }

                    let defaultSupplierId: number | null = selectedSupplier && selectedSupplier.id !== 0 ? selectedSupplier.id : null;

                    const { data: publicUrlData } = supabase.storage
                        .from('documents')
                        .getPublicUrl(filePath);
                    const filePublicUrl = publicUrlData?.publicUrl || null;

                    const insertData: any = {
                        title: `Uploaded File - ${file.name}`,
                        file_name: file.name,
                        file_size: file.size,
                        file_type: file.type || fileExt || 'unknown',
                        storage_path: filePath,
                        file_url: filePublicUrl,
                        category: 'documents',
                        document_type: 'Other',
                        supplier_id: defaultSupplierId,
                        supplier: defaultSupplierId ? (suppliers.find(s => s.id === defaultSupplierId)?.name || null) : null,
                        uploaded_by: effectiveUploaderUuid,
                        version: 1,
                        user_id: effectiveUserId,
                        session_id: effectiveSessionId,
                        role: userRole || null,
                        force_inserted_by: effectiveUserId,
                        extracted: {
                            text: null,
                            description: `Document uploaded: ${file.name}`,
                            summary: `Upload: ${file.name}`,
                            visual_objects: [],
                            extracted_at: new Date().toISOString(),
                        },
                    };

                    const { error: insertError } = await supabase
                        .from('supplier_documents')
                        .insert(insertData);

                    if (insertError) {
                        failedFiles.push({ name: file.name, reason: insertError.message || 'Database error' });
                        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
                        continue;
                    }

                    uploadedFiles.push(file.name);
                    const stepPct = Math.round(((i + 1) / totalFiles) * 100);
                    setUploadProgress(stepPct);
                    if (i + 1 < totalFiles) {
                        toast.loading(`Uploaded ${i + 1} of ${totalFiles} file(s) (${stepPct}%)...`, { id: toastId });
                    }
                } catch (err: any) {
                    failedFiles.push({ name: file.name, reason: err.message || 'Unexpected error' });
                    setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
                }
            }

            const unuploadedItems = failedFiles.map(f => `• ${f.name} (Failed: ${f.reason})`);

            if (duplicateFiles.length === selectedFiles.length) {
                if (duplicateFiles.length === 1) {
                    toast.info(`Document "${duplicateFiles[0]}" has already been uploaded previously.`, { id: toastId, duration: 5000 });
                } else {
                    toast.info(`All ${duplicateFiles.length} file(s) are already uploaded:\n${duplicateFiles.map(name => `• ${name}`).join('\n')}`, { id: toastId, duration: 6000 });
                }
            } else if (uploadedFiles.length === selectedFiles.length) {
                toast.success(`All ${uploadedFiles.length} file(s) uploaded successfully with Admin override!`, { id: toastId, duration: 4000 });
            } else if (uploadedFiles.length > 0) {
                toast.success(`Uploaded ${uploadedFiles.length} of ${selectedFiles.length} file(s) with override.`, { id: toastId, duration: 4000 });
                if (duplicateFiles.length > 0) {
                    toast.info(
                        duplicateFiles.length === 1
                            ? `"${duplicateFiles[0]}" was skipped because it is already uploaded.`
                            : `${duplicateFiles.length} file(s) were skipped because they are already uploaded:\n${duplicateFiles.map(name => `• ${name}`).join('\n')}`,
                        { duration: 6000 }
                    );
                }
                if (failedFiles.length > 0) {
                    toast.error(`Failed:\n${unuploadedItems.join('\n')}`, { duration: 8000 });
                }
            } else {
                if (duplicateFiles.length > 0) {
                    toast.info(
                        duplicateFiles.length === 1
                            ? `"${duplicateFiles[0]}" has already been uploaded previously.`
                            : `${duplicateFiles.length} file(s) are already uploaded:\n${duplicateFiles.map(name => `• ${name}`).join('\n')}`,
                        { id: toastId, duration: 6000 }
                    );
                    if (failedFiles.length > 0) {
                        toast.error(`Admin override failed for ${failedFiles.length} file(s):\n${unuploadedItems.join('\n')}`, { duration: 8000 });
                    }
                } else {
                    toast.error(`Admin override failed for all ${selectedFiles.length} file(s):\n${unuploadedItems.join('\n')}`, { id: toastId, duration: 8000 });
                }
            }

            // Insert notification in notifications table
            try {
                const notifData: any = {
                    creator_name: userName || DEFAULT_USER.name,
                    creator_email: userEmail || DEFAULT_USER.email,
                    title: `Admin Override Upload: ${uploadedFiles.length}/${selectedFiles.length} file(s)`,
                    message: uploadedFiles.length === selectedFiles.length
                        ? `Admin override upload of all ${uploadedFiles.length} document(s) completed by ${userName || DEFAULT_USER.name}.`
                        : `Admin override upload of ${uploadedFiles.length} of ${selectedFiles.length} document(s) completed. Failed:\n${unuploadedItems.join('\n')}`,
                    type: 'alert',
                    link: '/documents',
                    role: 'Admin',
                    reference_type: 'document_override',
                    is_read: false,
                };
                if (currentUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentUserId)) {
                    notifData.user_id = currentUserId;
                }
                const { error: notifErr } = await supabase.from('notifications').insert(notifData);
                if (notifErr && notifData.user_id) {
                    delete notifData.user_id;
                    await supabase.from('notifications').insert(notifData);
                }
            } catch (notifErr) {
                console.warn('Could not insert admin override notification:', notifErr);
            }

            if (uploadedFiles.length > 0) {
                clearAllCachedFilePreviewUrls();
                setSelectedFiles([]);
                setOcrWarning(null);
                setIsUploadModalOpen(false);
                await fetchStatistics();
                await fetchDocuments(false);
            }
        } catch (err: any) {
            console.error('Force upload error:', err);
            toast.error(err.message || 'Failed to upload with override', { id: toastId });
        } finally {
            setIsUploading(false);
        }
    };

    // handle document update
    const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingDoc) return;

        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        const price = (formData.get('price') as string) || null;

        const toastId = toast.loading('Updating document...');

        try {
            const rawUploadedBy = formData.get('uploadedBy') as string;
            const updates: any = {
                title: formData.get('title') as string,
                document_type: formData.get('documentType') as string,
                category: formData.get('category') as string,
                supplier: (formData.get('supplier') as string) || null,
                supplier_id: (() => {
                    const sName = (formData.get('supplier') as string) || null;
                    if (!sName) return null;
                    const matched = suppliers.find(s => s.name.toLowerCase() === sName.toLowerCase());
                    return matched ? matched.id : null;
                })(),
                po_number: formData.get('poNumber') as string || null,
                parcel_batch: formData.get('parcelBatch') as string || null,
                notes: formData.get('notes') as string || null,
                Price: price,
                updated_at: new Date().toISOString(),
                version: (editingDoc.version || 0) + 1,
                session_id: isValidUUID(userSessionId) ? userSessionId : null,
                role: userRole || null,
            };

            if (isValidUUID(rawUploadedBy)) {
                updates.uploaded_by = rawUploadedBy;
            }

            const { error } = await supabase
                .from('supplier_documents')
                .update(updates)
                .eq('id', editingDoc.id);

            if (error) throw error;

            toast.success('Document updated successfully!', { id: toastId });
            setIsEditModalOpen(false);
            setEditingDoc(null);
            setEditPreviewUrl(null);
            await fetchDocuments(false);
        } catch (error) {
            console.error('Update error:', error);
            toast.error('Failed to update document', { id: toastId });
        }
    };

    // open preview modal
    const handleViewDocument = async (doc: Document) => {
        setSelectedDoc(doc);
        setIsPreviewModalOpen(true);
        setPreviewLoading(true);
        setPreviewUrl(null);

        try {
            if (!doc.storage_path) {
                setPreviewLoading(false);
                return;
            }
            const { data: { publicUrl } } = supabase.storage
                .from('documents')
                .getPublicUrl(doc.storage_path);

            setPreviewUrl(publicUrl);
        } catch (error) {
            console.error('Error getting preview URL:', error);
            toast.error('Failed to load preview');
        } finally {
            setPreviewLoading(false);
        }
    };

    // open edit modal
    const handleEditDocument = async (doc: Document) => {
        setEditingDoc(doc);
        setIsEditModalOpen(true);
        setEditPreviewLoading(true);
        setEditPreviewUrl(null);

        try {
            if (!doc.storage_path) {
                setEditPreviewLoading(false);
                return;
            }
            const { data: { publicUrl } } = supabase.storage
                .from('documents')
                .getPublicUrl(doc.storage_path);

            setEditPreviewUrl(publicUrl);
        } catch (error) {
            console.error('Error getting preview URL:', error);
        } finally {
            setEditPreviewLoading(false);
        }
    };

    // reset all filters
    const clearAllFilters = () => {
        setSearchTerm("");
        setTypeFilter("");
        setExtensionFilter("");
        setCategoryFilter("");
        setSupplierFilter("");
        setDateFrom("");
        setDateTo("");
        setCurrentPage(1);
        setSelectedDocIds(new Set());
    };

    const MAX_FILES_PER_TRANSACTION = 5;

    // file select handler with 5 max file limit
    const handleFileSelect = (files: FileList | null) => {
        if (isUploading) {
            toast.warning('Upload in progress. Please wait until current upload finishes.');
            return;
        }
        if (!files || files.length === 0) return;
        const incoming = Array.from(files);

        setSelectedFiles(prev => {
            const currentCount = prev.length;
            const availableSlots = MAX_FILES_PER_TRANSACTION - currentCount;

            if (availableSlots <= 0) {
                toast.warning(`Maximum of ${MAX_FILES_PER_TRANSACTION} files allowed per transaction. Please remove some files to add new ones.`);
                return prev;
            }

            // Check if any incoming files are already in the staged selection
            const alreadySelected = incoming.filter(f => prev.some(p => p.name === f.name && p.size === f.size));
            const newFiles = incoming.filter(f => !prev.some(p => p.name === f.name && p.size === f.size));

            if (alreadySelected.length > 0 && newFiles.length === 0) {
                toast.info(`Selected file(s) are already in the upload list.`);
                return prev;
            } else if (alreadySelected.length > 0) {
                toast.info(`${alreadySelected.length} duplicate file(s) already in the upload list were skipped.`);
            }

            if (newFiles.length > availableSlots) {
                toast.warning(`Maximum ${MAX_FILES_PER_TRANSACTION} files allowed per transaction. Only the first ${availableSlots} file(s) were added.`);
                return [...prev, ...newFiles.slice(0, availableSlots)];
            }

            toast.success(`${newFiles.length} file(s) selected (${currentCount + newFiles.length}/${MAX_FILES_PER_TRANSACTION})`);
            return [...prev, ...newFiles];
        });
    };

    // remove file from staging list
    const removeFile = (index: number) => {
        if (isUploading) return;
        setSelectedFiles(prev => {
            if (prev[index]) {
                revokeCachedFilePreviewUrl(prev[index]);
            }
            return prev.filter((_, i) => i !== index);
        });
    };

    // clear all staging files
    const clearAllSelectedFiles = () => {
        if (isUploading) return;
        clearAllCachedFilePreviewUrls();
        setSelectedFiles([]);
    };

    // toggle select all documents
    const toggleSelectAllDocuments = () => {
        if (selectedDocIds.size === documents.length) {
            setSelectedDocIds(new Set());
        } else {
            setSelectedDocIds(new Set(documents.map(d => d.id)));
        }
    };


    // initial data load & recurring 5-min pending notification interval
    useEffect(() => {
        getCurrentUser();
        fetchDocuments(true);
        fetchStatistics();
        fetchSuppliers();
        fetchPurchaseOrders();
        fetchArchiveCount();
        triggerPendingNotifications();

        // 5 minutes interval for testing
        const notifInterval = setInterval(() => {
            triggerPendingNotifications();
        }, 5 * 60 * 1000);

        return () => clearInterval(notifInterval);
    }, [getCurrentUser, fetchDocuments, fetchStatistics, fetchSuppliers, fetchPurchaseOrders, fetchArchiveCount, triggerPendingNotifications]);

    // refetch on document filter change
    useEffect(() => {
        fetchDocuments(false);
    }, [fetchDocuments]);

    // realtime subscription for documents
    useEffect(() => {
        let debounceTimer: NodeJS.Timeout | null = null;

        const handleDocumentChange = (payload: any) => {
            if (payload?.eventType === 'DELETE' && payload.old && 'id' in payload.old) {
                const deletedId = (payload.old as { id: string }).id;
                if (deletedId) {
                    setSelectedDoc(prev => {
                        if (prev?.id === deletedId) {
                            setIsPreviewModalOpen(false);
                            return null;
                        }
                        return prev;
                    });
                    setEditingDoc(prev => {
                        if (prev?.id === deletedId) {
                            setIsEditModalOpen(false);
                            return null;
                        }
                        return prev;
                    });
                }
            }

            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetchDocuments(false);
                fetchStatistics();
                fetchArchiveCount();
            }, 300);
        };

        const channel = supabase
            .channel(`supplier_documents_realtime_${Date.now()}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'supplier_documents' },
                handleDocumentChange
            )
            .subscribe();

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            supabase.removeChannel(channel);
        };
    }, [fetchDocuments, fetchStatistics, fetchArchiveCount]);

    return {
        documents,
        suppliers,
        loading,
        refreshing,
        searchTerm,
        setSearchTerm,
        typeFilter,
        setTypeFilter,
        extensionFilter,
        setExtensionFilter,
        categoryFilter,
        setCategoryFilter,
        supplierFilter,
        setSupplierFilter,
        dateFrom,
        setDateFrom,
        dateTo,
        setDateTo,
        currentPage,
        setCurrentPage,
        totalPages,
        totalItems,
        itemsPerPage,
        selectedFiles,
        setSelectedFiles,
        uploadProgress,
        setUploadProgress,
        selectedDoc,
        setSelectedDoc,
        isUploadModalOpen,
        setIsUploadModalOpen,
        isPreviewModalOpen,
        setIsPreviewModalOpen,
        isEditModalOpen,
        setIsEditModalOpen,
        isAttachModalOpen,
        setIsAttachModalOpen,
        attachTargetDoc,
        setAttachTargetDoc,
        openAttachModal,
        ocrWarning,
        setOcrWarning,
        isUploading,
        editingDoc,
        setEditingDoc,
        previewUrl,
        setPreviewUrl,
        previewLoading,
        editPreviewUrl,
        setEditPreviewUrl,
        editPreviewLoading,
        userName,
        userEmail,
        userRole,
        archiveCount,
        selectedDocIds,
        setSelectedDocIds,
        isDownloading,
        isBulkDeleting,
        totalFiles,
        totalPhotos,
        totalDocuments,
        fileInputRef,
        dropZoneRef,
        fetchDocuments,
        downloadFile,
        handleDelete,
        downloadSelectedFiles,
        deleteSelectedDocuments,
        handleUpload,
        handleConfirmForceUpload,
        handleUpdate,
        handleViewDocument,
        handleEditDocument,
        clearAllFilters,
        handleFileSelect,
        removeFile,
        clearAllSelectedFiles,
        maxFilesPerTransaction: MAX_FILES_PER_TRANSACTION,
        toggleSelectAllDocuments,
        selectedSupplier,
        setSelectedSupplier,
        handleSelectSupplier,
        galleryViewMode,
        setGalleryViewMode,
        purchaseOrders,
        fetchPurchaseOrders,
    };
}
