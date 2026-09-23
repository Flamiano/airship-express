// custom hook encapsulating document management state, database queries, bulk actions, and realtime sync
'use client';

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/services/client/supabase";
import { toast } from "sonner";
import { useDebounce } from "../../../hooks/useDebounce";
import { useConfirm } from "../../../components/ui/ConfirmModal";
import { Document, Supplier, Activity, DEFAULT_USER } from "../types";
import { user } from "../../../lib/services/Class/user";
import { revokeCachedFilePreviewUrl, clearAllCachedFilePreviewUrls } from "../components/modals/SelectedFilesGridModal";

export function useDocuments() {
    const searchParams = useSearchParams();
    const initialSearch = searchParams?.get('search') || "";
    const { confirm } = useConfirm();

    const [documents, setDocuments] = useState<Document[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
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
    const [activityFilter, setActivityFilter] = useState("");
    const [activitySearch, setActivitySearch] = useState("");
    const [activityPage, setActivityPage] = useState(1);
    const [totalActivities, setTotalActivities] = useState(0);
    const [userName, setUserName] = useState<string>(DEFAULT_USER.name);
    const [userEmail, setUserEmail] = useState<string>(DEFAULT_USER.email);
    const [userRole, setUserRole] = useState<string>("");
    const [userSessionId, setUserSessionId] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [archiveCount, setArchiveCount] = useState(0);
    const [activityDateFrom, setActivityDateFrom] = useState("");
    const [activityDateTo, setActivityDateTo] = useState("");

    const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
    const [selectedActivityIds, setSelectedActivityIds] = useState<Set<string>>(new Set());
    const [isDownloading, setIsDownloading] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const debouncedSearch = useDebounce(searchTerm, 300);
    const debouncedActivitySearch = useDebounce(activitySearch, 300);
    const itemsPerPage = 50;
    const activitiesPerPage = 50;

    const [totalFiles, setTotalFiles] = useState(0);
    const [totalPhotos, setTotalPhotos] = useState(0);
    const [totalDocuments, setTotalDocuments] = useState(0);

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
                .from('documents')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false });

            if (debouncedSearch) {
                query = query.or(
                    `title.ilike.%${debouncedSearch}%,file_name.ilike.%${debouncedSearch}%`
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

            // resolve forced user names
            const forcedIds = rawDocs
                .map((d: any) => d.force_inserted_by)
                .filter((id: string | null): id is string => Boolean(id));

            let forcedUserMap: Record<string, string> = {};
            if (forcedIds.length > 0) {
                try {
                    const { data: usersData } = await supabase
                        .from('users')
                        .select('id, display_name, email')
                        .in('id', Array.from(new Set(forcedIds)));
                    if (usersData) {
                        usersData.forEach((u: any) => {
                            forcedUserMap[u.id] = u.display_name || u.email || 'Admin';
                        });
                    }
                } catch (userErr) {
                    console.warn('Could not load forced user names:', userErr);
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

            const enrichedDocs = rawDocs.map((d: any) => ({
                ...d,
                purchase_orders: d.purchase_id ? (poMap[d.purchase_id] || null) : null,
                force_user_name: d.force_inserted_by ? (forcedUserMap[d.force_inserted_by] || 'Authorized Administrator') : null,
            }));

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

    // fetch activity history
    const fetchActivities = useCallback(async () => {
        try {
            let query = supabase
                .from('activity_history')
                .select('*', { count: 'exact' })
                .order('timestamp', { ascending: false });

            if (debouncedActivitySearch) {
                query = query.or(
                    `user_name.ilike.%${debouncedActivitySearch}%,document_title.ilike.%${debouncedActivitySearch}%`
                );
            }

            if (activityFilter) {
                query = query.eq('action_type', activityFilter);
            }

            if (activityDateFrom) {
                query = query.gte('timestamp', activityDateFrom);
            }
            if (activityDateTo) {
                query = query.lte('timestamp', activityDateTo);
            }

            const from = (activityPage - 1) * activitiesPerPage;
            const to = from + activitiesPerPage - 1;
            query = query.range(from, to);

            const { data, error, count } = await query;

            if (error) throw error;

            setActivities(data || []);
            setTotalActivities(count || 0);
        } catch (error) {
            console.error('Error fetching activities:', error);
        }
    }, [debouncedActivitySearch, activityFilter, activityDateFrom, activityDateTo, activityPage]);

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
                .from('documents')
                .select('*', { count: 'exact', head: true });

            if (totalError) throw totalError;
            setTotalFiles(totalCount || 0);

            const { count: photosCount, error: photosError } = await supabase
                .from('documents')
                .select('*', { count: 'exact', head: true })
                .eq('category', 'photos');

            if (photosError) throw photosError;
            setTotalPhotos(photosCount || 0);

            setTotalDocuments((totalCount || 0) - (photosCount || 0));
        } catch (error) {
            console.error('Error fetching statistics:', error);
        }
    }, []);

    // fetch suppliers
    const fetchSuppliers = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('suppliers')
                .select('*')
                .eq('is_active', true)
                .order('name');

            if (error) throw error;
            setSuppliers(data || []);
        } catch (error) {
            console.error('Error fetching suppliers:', error);
        }
    }, []);

    // log activity entry
    const logActivity = useCallback(async (
        actionType: string,
        targetResource: string,
        documentId?: string,
        documentTitle?: string,
        details?: any,
        status: string = 'Success'
    ) => {
        try {
            const name = userName || DEFAULT_USER.name;
            const email = userEmail || DEFAULT_USER.email;

            const activityData = {
                user_name: name,
                user_email: email,
                action_type: actionType,
                target_resource: targetResource,
                document_id: documentId || null,
                document_title: documentTitle || null,
                status: status,
                details: details || null,
            };

            const { error } = await supabase
                .from('activity_history')
                .insert(activityData);

            if (error) {
                console.error('Error logging activity:', error);
                return null;
            }

            return true;
        } catch (error) {
            console.error('Error logging activity:', error);
            return null;
        }
    }, [userName, userEmail]);

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

            await logActivity(
                'delete',
                'Deleted Document',
                doc.id,
                doc.title,
                { deleted_by: deletedBy }
            );

            const { error } = await supabase
                .from('documents')
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
            await fetchActivities();
            await fetchStatistics();
        } catch (error) {
            console.error('Delete error:', error);
            toast.error('Failed to delete document', { id: toastId });
        }
    }, [userName, logActivity, fetchArchiveCount, fetchDocuments, fetchActivities, fetchStatistics, confirm]);

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

                    await logActivity(
                        'delete',
                        'Deleted Document',
                        doc.id,
                        doc.title,
                        { deleted_by: deletedBy, bulk_delete: true }
                    );

                    await supabase.storage.from('documents').remove([doc.storage_path]);

                    const { error } = await supabase
                        .from('documents')
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
            await fetchActivities();
            await fetchStatistics();
        } catch (error) {
            console.error('Bulk delete error:', error);
            toast.error('Failed to delete documents', { id: toastId });
        } finally {
            setIsBulkDeleting(false);
        }
    }, [selectedDocIds, documents, userName, logActivity, fetchArchiveCount, fetchDocuments, fetchActivities, fetchStatistics, confirm]);

    // delete multiple selected activity records
    const deleteSelectedActivities = useCallback(async () => {
        if (selectedActivityIds.size === 0) {
            toast.warning('Please select activities to delete');
            return;
        }

        const confirmed = await confirm({
            title: `Delete ${selectedActivityIds.size} Activity Records`,
            message: `Are you sure you want to permanently delete ${selectedActivityIds.size} selected activity record(s)? This action cannot be undone.`,
            confirmText: 'Delete All',
            confirmVariant: 'danger'
        });

        if (!confirmed) return;

        const toastId = toast.loading(`Deleting ${selectedActivityIds.size} activity record(s)...`);

        try {
            const idsToDelete = Array.from(selectedActivityIds);

            const { error } = await supabase
                .from('activity_history')
                .delete()
                .in('id', idsToDelete);

            if (error) throw error;

            toast.success(`Successfully deleted ${idsToDelete.length} activity record(s)`, { id: toastId });

            setSelectedActivityIds(new Set());
            await fetchActivities();
        } catch (error) {
            console.error('Error deleting activities:', error);
            toast.error('Failed to delete activity records', { id: toastId });
        }
    }, [selectedActivityIds, fetchActivities, confirm]);

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

    // handle upload submission with OCR check and fileless option
    const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

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

        let currentUserId = userId;
        if (!currentUserId) {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            currentUserId = authUser?.id || null;
        }

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
                const insertData: any = {
                    title: title.trim(),
                    file_name: 'Pending Attachment',
                    file_size: 0,
                    file_type: 'pending',
                    storage_path: '',
                    category: category,
                    document_type: documentType,
                    supplier: supplier,
                    po_number: poNumber,
                    parcel_batch: parcelBatch,
                    uploaded_by: uploadedBy,
                    notes: notes,
                    Price: price,
                    version: 1,
                    user_id: currentUserId || null,
                    session_id: userSessionId || null,
                    role: userRole || null,
                };

                const { data: insertedDoc, error: insertError } = await supabase
                    .from('documents')
                    .insert(insertData)
                    .select()
                    .single();

                if (insertError) throw insertError;

                await logActivity(
                    'create',
                    'Created Pending Document Record',
                    insertedDoc?.id,
                    title.trim(),
                    { created_without_file: true, price: price }
                );

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

                    if (currentUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentUserId)) {
                        notifData.user_id = currentUserId;
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
                await fetchActivities();
            } catch (error: any) {
                console.error('Error creating fileless document:', error);
                toast.error(error.message || 'Failed to create document record', { id: toastId });
            } finally {
                setIsUploading(false);
            }
            return;
        }

        // Path 2: Upload with attached file(s) and run Gemini OCR check
        setIsUploading(true);
        setUploadProgress(0);
        const toastId = toast.loading(`Verifying & uploading ${selectedFiles.length} file(s)...`);

        try {
            let uploadedCount = 0;
            let skippedCount = 0;
            const skippedFiles: string[] = [];

            for (const file of selectedFiles) {
                // Check duplicate
                const { data: existingDocs, error: checkError } = await supabase
                    .from('documents')
                    .select('id, file_name, file_size, storage_path')
                    .eq('file_name', file.name)
                    .eq('file_size', file.size);

                if (checkError) {
                    console.error('Duplicate check error:', checkError);
                    toast.error(`Failed to check for duplicates for ${file.name}`);
                    continue;
                }

                if (existingDocs && existingDocs.length > 0) {
                    skippedCount++;
                    skippedFiles.push(file.name);
                    continue;
                }

                // OCR Document Validation via Gemini
                try {
                    const reader = new FileReader();
                    const base64Promise = new Promise<string>((resolve, reject) => {
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                    });
                    reader.readAsDataURL(file);
                    const fileBase64 = await base64Promise;

                    const ocrRes = await fetch('/ai/api/verify-document-ocr', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            fileBase64,
                            fileName: file.name,
                            fileType: file.type,
                            userRole: userRole,
                        }),
                    });

                    const ocrData = await ocrRes.json();

                    if (ocrData.success && !ocrData.is_valid_system_doc) {
                        if (!isPrivileged) {
                            // Non-admin hard rejection
                            toast.error(
                                `Document Rejected: ${ocrData.rejection_reason || 'Out-of-scope media detected.'}`,
                                { id: toastId, duration: 6000 }
                            );
                            setIsUploading(false);
                            return;
                        } else {
                            // Admin warning notice
                            setOcrWarning(
                                `Warning: Gemini OCR detected "${ocrData.detected_type || 'Unrelated media'}". ${ocrData.rejection_reason || 'Out-of-scope media.'} As an Admin/Executive, you may proceed with an override.`
                            );
                            toast.warning('AI Warning: Out-of-scope media detected. Review warning to override.', { id: toastId });
                            setIsUploading(false);
                            return;
                        }
                    }
                } catch (ocrErr) {
                    console.warn('Gemini OCR verification error (continuing):', ocrErr);
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
                    toast.error(`Failed to upload ${file.name}: ${uploadError.message}`);
                    continue;
                }

                const docTitle = title.trim() || `${documentType} - ${file.name}`;
                const insertData: any = {
                    title: docTitle,
                    file_name: file.name,
                    file_size: file.size,
                    file_type: file.type || fileExt || 'unknown',
                    storage_path: filePath,
                    category: category,
                    document_type: documentType,
                    supplier: supplier,
                    po_number: poNumber,
                    parcel_batch: parcelBatch,
                    uploaded_by: uploadedBy,
                    notes: notes,
                    Price: price,
                    version: 1,
                    user_id: currentUserId || null,
                    session_id: userSessionId || null,
                    role: userRole || null,
                };

                const { error: insertError } = await supabase
                    .from('documents')
                    .insert(insertData);

                if (insertError) {
                    console.error('Insert error:', insertError);
                    toast.error(`Failed to save ${file.name}: ${insertError.message}`);
                    continue;
                }

                uploadedCount++;
                setUploadProgress(Math.round(((uploadedCount + skippedCount) / selectedFiles.length) * 100));
            }

            if (uploadedCount > 0 && skippedCount > 0) {
                toast.warning(`Uploaded ${uploadedCount} file(s), skipped ${skippedCount} duplicate(s)`, {
                    id: toastId,
                    duration: 5000,
                });
            } else if (uploadedCount > 0) {
                toast.success(`Successfully uploaded ${uploadedCount} file(s)!`, {
                    id: toastId,
                    duration: 3000,
                });
            } else if (skippedCount > 0) {
                toast.warning(`All ${skippedCount} file(s) already exist and were skipped`, {
                    id: toastId,
                    duration: 5000,
                });
            } else {
                toast.error('No files were uploaded successfully', {
                    id: toastId,
                    duration: 5000,
                });
            }

            if (uploadedCount > 0 || skippedCount > 0) {
                // Insert notification in notifications table for the uploader only
                try {
                    const notifData: any = {
                        creator_name: uploadedBy || userName || DEFAULT_USER.name,
                        creator_email: userEmail || DEFAULT_USER.email,
                        title: `Document Uploaded: "${title.trim() || `${documentType} (${uploadedCount} file${uploadedCount > 1 ? 's' : ''})`}"`,
                        message: `${uploadedCount} document(s) (${documentType}, ${category}) uploaded successfully.`,
                        type: 'info',
                        link: '/documents',
                        role: userRole || 'User',
                        reference_type: 'document_upload',
                        is_read: false,
                    };

                    if (currentUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentUserId)) {
                        notifData.user_id = currentUserId;
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

                clearAllCachedFilePreviewUrls();
                setSelectedFiles([]);
                setUploadProgress(0);
                setIsUploadModalOpen(false);
                setOcrWarning(null);
                await fetchStatistics();
                await fetchDocuments(false);
                await fetchActivities();
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
        if (selectedFiles.length === 0) return;
        setIsUploading(true);
        const toastId = toast.loading('Uploading with Admin override...');

        try {
            let currentUserId = userId;
            if (!currentUserId) {
                const { data: { user: authUser } } = await supabase.auth.getUser();
                currentUserId = authUser?.id || null;
            }

            for (const file of selectedFiles) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
                const filePath = `documents/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('documents')
                    .upload(filePath, file, { cacheControl: '3600', upsert: true });

                if (uploadError) throw uploadError;

                const insertData: any = {
                    title: `Admin Override - ${file.name}`,
                    file_name: file.name,
                    file_size: file.size,
                    file_type: file.type || fileExt || 'unknown',
                    storage_path: filePath,
                    category: 'documents',
                    document_type: 'Other',
                    uploaded_by: userName || DEFAULT_USER.name,
                    version: 1,
                    user_id: currentUserId || null,
                    session_id: userSessionId || null,
                    role: userRole || null,
                    force_inserted_by: currentUserId || null,
                };

                const { error: insertError } = await supabase
                    .from('documents')
                    .insert(insertData);

                if (insertError) throw insertError;
            }

            toast.success('Files uploaded successfully with Admin override!', { id: toastId });

            // Insert notification in notifications table
            try {
                const notifData: any = {
                    creator_name: userName || DEFAULT_USER.name,
                    creator_email: userEmail || DEFAULT_USER.email,
                    title: `Admin Override Upload: ${selectedFiles.length} file(s)`,
                    message: `Admin override upload of ${selectedFiles.length} document(s) completed by ${userName || DEFAULT_USER.name}.`,
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

            clearAllCachedFilePreviewUrls();
            setSelectedFiles([]);
            setOcrWarning(null);
            setIsUploadModalOpen(false);
            await fetchStatistics();
            await fetchDocuments(false);
            await fetchActivities();
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
            const updates: any = {
                title: formData.get('title') as string,
                document_type: formData.get('documentType') as string,
                category: formData.get('category') as string,
                supplier: formData.get('supplier') as string || null,
                po_number: formData.get('poNumber') as string || null,
                parcel_batch: formData.get('parcelBatch') as string || null,
                uploaded_by: formData.get('uploadedBy') as string || null,
                notes: formData.get('notes') as string || null,
                Price: price,
                updated_at: new Date().toISOString(),
                version: (editingDoc.version || 0) + 1,
                session_id: userSessionId || null,
                role: userRole || null,
            };

            const { error } = await supabase
                .from('documents')
                .update(updates)
                .eq('id', editingDoc.id);

            if (error) throw error;

            await logActivity(
                'update',
                'Updated Document',
                editingDoc.id,
                updates.title,
                { old_version: editingDoc.version, new_version: updates.version }
            );

            toast.success('Document updated successfully!', { id: toastId });
            setIsEditModalOpen(false);
            setEditingDoc(null);
            setEditPreviewUrl(null);
            await fetchDocuments(false);
            await fetchActivities();
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
        setActivitySearch("");
        setActivityFilter("");
        setActivityDateFrom("");
        setActivityDateTo("");
        setActivityPage(1);
        setSelectedDocIds(new Set());
        setSelectedActivityIds(new Set());
    };

    const MAX_FILES_PER_TRANSACTION = 10;

    // file select handler with 10 max file limit
    const handleFileSelect = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const incoming = Array.from(files);

        setSelectedFiles(prev => {
            const currentCount = prev.length;
            const availableSlots = MAX_FILES_PER_TRANSACTION - currentCount;

            if (availableSlots <= 0) {
                toast.warning(`Maximum of ${MAX_FILES_PER_TRANSACTION} files allowed per transaction. Please remove some files to add new ones.`);
                return prev;
            }

            if (incoming.length > availableSlots) {
                toast.warning(`Maximum ${MAX_FILES_PER_TRANSACTION} files allowed per transaction. Only the first ${availableSlots} file(s) were added.`);
                return [...prev, ...incoming.slice(0, availableSlots)];
            }

            toast.success(`${incoming.length} file(s) selected (${currentCount + incoming.length}/${MAX_FILES_PER_TRANSACTION})`);
            return [...prev, ...incoming];
        });
    };

    // remove file from staging list
    const removeFile = (index: number) => {
        setSelectedFiles(prev => {
            if (prev[index]) {
                revokeCachedFilePreviewUrl(prev[index]);
            }
            return prev.filter((_, i) => i !== index);
        });
    };

    // clear all staging files
    const clearAllSelectedFiles = () => {
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

    // toggle select all activities
    const toggleSelectAllActivities = () => {
        if (selectedActivityIds.size === activities.length) {
            setSelectedActivityIds(new Set());
        } else {
            setSelectedActivityIds(new Set(activities.map(a => a.id)));
        }
    };

    // initial data load & recurring 5-min pending notification interval
    useEffect(() => {
        getCurrentUser();
        fetchDocuments(true);
        fetchStatistics();
        fetchSuppliers();
        fetchActivities();
        fetchArchiveCount();
        triggerPendingNotifications();

        // 5 minutes interval for testing
        const notifInterval = setInterval(() => {
            triggerPendingNotifications();
        }, 5 * 60 * 1000);

        return () => clearInterval(notifInterval);
    }, [getCurrentUser, fetchDocuments, fetchStatistics, fetchSuppliers, fetchActivities, fetchArchiveCount, triggerPendingNotifications]);

    // refetch on document filter change
    useEffect(() => {
        fetchDocuments(false);
    }, [fetchDocuments]);

    // refetch on activity filter change
    useEffect(() => {
        fetchActivities();
    }, [fetchActivities]);

    // realtime subscription for documents and activity history
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

        let activityDebounceTimer: NodeJS.Timeout | null = null;
        const handleActivityChange = () => {
            if (activityDebounceTimer) clearTimeout(activityDebounceTimer);
            activityDebounceTimer = setTimeout(() => {
                fetchActivities();
            }, 300);
        };

        const channel = supabase
            .channel(`documents_realtime_${Date.now()}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'documents' },
                handleDocumentChange
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'activity_history' },
                handleActivityChange
            )
            .subscribe();

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            if (activityDebounceTimer) clearTimeout(activityDebounceTimer);
            supabase.removeChannel(channel);
        };
    }, [fetchDocuments, fetchStatistics, fetchArchiveCount, fetchActivities]);

    return {
        documents,
        suppliers,
        activities,
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
        activityFilter,
        setActivityFilter,
        activitySearch,
        setActivitySearch,
        activityPage,
        setActivityPage,
        totalActivities,
        activitiesPerPage,
        userName,
        userEmail,
        userRole,
        archiveCount,
        activityDateFrom,
        setActivityDateFrom,
        activityDateTo,
        setActivityDateTo,
        selectedDocIds,
        setSelectedDocIds,
        selectedActivityIds,
        setSelectedActivityIds,
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
        deleteSelectedActivities,
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
        toggleSelectAllActivities,
    };
}
