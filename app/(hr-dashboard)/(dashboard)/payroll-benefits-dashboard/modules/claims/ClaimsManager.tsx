'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';
import {
    Plus, Eye, Banknote, Loader2, Receipt, AlertTriangle, Trash2,
    Wallet, Clock3, CheckCircle2, XCircle, FileText, Upload,
    Image as ImageIcon, Pencil, X, UserCircle2, CalendarClock,
} from 'lucide-react';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Card } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Pagination } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Pagination';
import { Search } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Search';
import { Input } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Input';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import { createClient } from '@/app/(hr-dashboard)/supabase/client';
import { ImageViewer } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/ImageViewer';
import OtpModal from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/OtpModal';
import OtpUnlockBanner from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/OtpUnlockBanner';
import { useOtpSessionContext } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/providers/OtpSessionProvider';
import { AiryReceiptScanner, type ScanVerdict } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/ai/ui/AiryReceiptScanner';
import { fileToResizedBase64, estimateSharpness } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/ai/shared/receiptImage';

const PAGE_SIZE = 8;
const STORAGE_BUCKET = 'hr4';
const STORAGE_FOLDER = 'claims';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ClaimSubTab = 'active' | 'approved' | 'rejected';

const STATUS_STYLES: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800',
    approved: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800',
    rejected: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800',
    reimbursed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800',
    cancelled: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700',
};

const STATUS_DOT_COLORS: Record<string, string> = {
    pending: 'bg-amber-500',
    approved: 'bg-blue-500',
    rejected: 'bg-red-500',
    reimbursed: 'bg-emerald-500',
    cancelled: 'bg-gray-400',
};

const EMPTY_FORM = {
    employee_id: '',
    claim_type_id: '',
    amount: '',
    description: '',
    receipt_url: '',
};

const formatDate = (value: string) => {
    if (!value) return '';
    try {
        return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return value;
    }
};

const formatDateTime = (value: string) => {
    if (!value) return '';
    try {
        return new Date(value).toLocaleString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    } catch {
        return value;
    }
};

const peso = (n: number) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

const initialsOf = (name: string) =>
    (name || '??').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

const AVATAR_PALETTE = [
    'from-blue-100 to-indigo-100 text-blue-700 dark:from-blue-950/40 dark:to-indigo-950/40 dark:text-blue-300',
    'from-pink-100 to-rose-100 text-pink-700 dark:from-pink-950/40 dark:to-rose-950/40 dark:text-pink-300',
    'from-emerald-100 to-teal-100 text-emerald-700 dark:from-emerald-950/40 dark:to-teal-950/40 dark:text-emerald-300',
    'from-amber-100 to-orange-100 text-amber-700 dark:from-amber-950/40 dark:to-orange-950/40 dark:text-amber-300',
    'from-purple-100 to-violet-100 text-purple-700 dark:from-purple-950/40 dark:to-violet-950/40 dark:text-purple-300',
];
const avatarClass = (seed: string) => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
};

const isValidId = (id: any): boolean =>
    typeof id === 'string' && id.length > 0 && id !== 'undefined' && UUID_RE.test(id);

function StatCard({
    icon: Icon, label, value, tint,
}: {
    icon: React.ComponentType<{ className?: string; size?: number; title?: string }>;
    label: string;
    value: string;
    tint: 'accent' | 'emerald' | 'blue' | 'amber' | 'red' | 'gray';
}) {
    const tints: Record<string, string> = {
        accent: 'bg-accent/10 text-accent',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
        red: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
        gray: 'bg-gray-50 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
    };
    return (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3.5 dark:border-line/30">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tints[tint]}`}>
                <Icon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted font-rethink">{label}</p>
                <p className="text-sm font-semibold font-mono tabular-nums text-ink truncate">{value}</p>
            </div>
        </div>
    );
}

const ClaimsManager = () => {
    const toast = useToast();
    const supabase = createClient();
    const { active: otpActive, secondsLeft, unlock, lock } = useOtpSessionContext();

    const [claims, setClaims] = useState<any[]>([]);
    const [claimTypes, setClaimTypes] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const [activeTab, setActiveTab] = useState<ClaimSubTab>('active');

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

    const [isOtpOpen, setIsOtpOpen] = useState(false);
    const [pendingCreate, setPendingCreate] = useState(false);

    const [scanning, setScanning] = useState(false);
    const [scanVerdict, setScanVerdict] = useState<ScanVerdict | null>(null);
    const [scanError, setScanError] = useState<string | null>(null);
    const [overrideReject, setOverrideReject] = useState(false);

    const [selected, setSelected] = useState<any | null>(null);
    const [editTarget, setEditTarget] = useState<any | null>(null);
    const [editAction, setEditAction] = useState<'approve' | 'reject' | 'reimburse' | null>(null);
    const [editNotes, setEditNotes] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

    const formRef = useRef(form);
    useEffect(() => { formRef.current = form; }, [form]);

    const selectedFileRef = useRef<File | null>(selectedFile);
    useEffect(() => { selectedFileRef.current = selectedFile; }, [selectedFile]);

    const { fetchData, postData, putData, deleteData } = useApi('/payroll-benefits-dashboard/api/claims');
    const { fetchData: fetchTypes } = useApi('/payroll-benefits-dashboard/api/claims/types');
    const { fetchData: fetchEmployees } = useApi('/payroll-benefits-dashboard/api/payroll/employee-info');
    const { postData: verifyReceipt } = useApi('/payroll-benefits-dashboard/api/claims/verify-receipt');

    const autoRefreshInterval = useRef<NodeJS.Timeout | null>(null);

    const validEmployees = useMemo(
        () => (employees || []).filter((emp: any) => emp && typeof emp.employee_id === 'string' && emp.employee_id !== 'undefined'),
        [employees]
    );

    const validClaimTypes = useMemo(
        () => (claimTypes || []).filter((t: any) => t && t.id !== undefined && t.id !== null),
        [claimTypes]
    );

    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            const [claimsData, typesData, employeesData] = await Promise.all([
                fetchData(),
                fetchTypes(),
                fetchEmployees(),
            ]);

            const cleaned = (Array.isArray(claimsData) ? claimsData : [])
                .map((c: any) => ({
                    ...c,
                    id: typeof c?.id === 'string' ? c.id.trim() : c?.id,
                }))
                .filter((c: any) => isValidId(c?.id));

            setClaims(cleaned);
            setClaimTypes((typesData || []).filter((t: any) => t.is_active));
            setEmployees(employeesData || []);
            setCurrentPage(1);
        } catch (error: any) {
            console.error('Load claims error:', error);
            toast.showError(error?.message || 'Failed to load claims');
        } finally {
            setLoading(false);
        }
    }, [fetchData, fetchTypes, fetchEmployees, toast]);

    useEffect(() => {
        loadAll();
        autoRefreshInterval.current = setInterval(() => {
            loadAll();
        }, 30000);
        return () => {
            if (autoRefreshInterval.current) clearInterval(autoRefreshInterval.current);
        };
    }, [loadAll]);

    const uploadImageToStorage = async (file: File): Promise<string> => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${STORAGE_FOLDER}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(filePath, file);

        if (uploadError) {
            console.error('Upload error:', uploadError);
            if (uploadError.message.includes('bucket not found')) {
                toast.showError(`Storage bucket "${STORAGE_BUCKET}" not found.`, 'Bucket Error');
            } else {
                toast.showError(uploadError.message, 'Upload Failed');
            }
            throw new Error(uploadError.message);
        }

        const { data: { publicUrl } } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(filePath);

        return publicUrl;
    };

    const runReceiptScanWithFile = async (file: File) => {
        const f = formRef.current;

        if (!isValidId(f.employee_id)) {
            setScanError('Pick an employee before scanning.');
            return;
        }
        if (!f.amount || Number(f.amount) <= 0) {
            setScanError('Enter the claimed amount before scanning.');
            return;
        }
        if (!f.claim_type_id) {
            setScanError('Pick a claim type before scanning.');
            return;
        }

        setScanning(true);
        setScanVerdict(null);
        setScanError(null);
        setOverrideReject(false);

        try {
            const { base64, mimeType } = await fileToResizedBase64(file);

            const data = await verifyReceipt('', {
                employeeId: f.employee_id,
                imageBase64: base64,
                mimeType,
                claimedAmount: Number(f.amount),
                claimedDescription: f.description,
                claimedClaimType:
                    validClaimTypes.find((t) => String(t.id) === String(f.claim_type_id))?.name || '',
            });

            setScanVerdict(data as ScanVerdict);

            if (data.receipt_readable === false) {
                const issue = data.readability_issue ? ` ${data.readability_issue}` : '';
                toast.showError(`Receipt is not clear.${issue} Please upload a sharper photo.`);
                return;
            }

            if (data.verdict === 'approve') {
                toast.showSuccess('Airy verified the receipt. Safe to submit.');
            } else if (data.verdict === 'review') {
                toast.showError('Airy flagged minor differences. Review before submitting.');
            } else {
                toast.showError('Airy rejected this receipt. Do not submit without fixing.');
            }
        } catch (err: any) {
            setScanError(err?.message || 'Could not verify receipt.');
            toast.showError(err?.message || 'Receipt verification failed');
        } finally {
            setScanning(false);
        }
    };

    const runReceiptScan = async () => {
        const file = selectedFileRef.current;
        if (!file) {
            toast.showError('Select a receipt image first.');
            return;
        }
        await runReceiptScanWithFile(file);
    };

    const handleFileSelect = async (file: File) => {
        if (!file) return;
        if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
        const previewUrl = URL.createObjectURL(file);
        setImagePreviewUrl(previewUrl);
        setSelectedFile(file);
        setUploadedFileName(file.name);
        setScanVerdict(null);
        setScanError(null);
        setOverrideReject(false);

        try {
            const { sharp } = await estimateSharpness(file);
            if (!sharp) {
                toast.showError(
                    'This photo looks blurry. Please retake it flat on a table, good lighting, no glare, all four corners visible.'
                );
            }
        } catch {
            // best-effort
        }

        const f = formRef.current;
        if (isValidId(f.employee_id) && f.amount && Number(f.amount) > 0 && f.claim_type_id) {
            queueMicrotask(() => {
                runReceiptScanWithFile(file);
            });
        }
    };

    useEffect(() => {
        if (!isCreateOpen) return;
        if (!selectedFile) return;
        if (scanning || scanVerdict || scanError) return;
        if (!isValidId(form.employee_id)) return;
        if (!form.claim_type_id) return;
        if (!form.amount || Number(form.amount) <= 0) return;

        const handle = setTimeout(() => {
            runReceiptScanWithFile(selectedFile);
        }, 800);

        return () => clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        isCreateOpen,
        selectedFile,
        form.employee_id,
        form.claim_type_id,
        form.amount,
        scanning,
        scanVerdict,
        scanError,
    ]);

    const handleRemoveImage = () => {
        if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
        setImagePreviewUrl(null);
        setSelectedFile(null);
        setUploadedFileName(null);
        setScanVerdict(null);
        setScanError(null);
        setOverrideReject(false);
        setForm((f) => ({ ...f, receipt_url: '' }));
    };

    const missingRequired =
        !isValidId(form.employee_id) ||
        !form.claim_type_id ||
        !form.amount ||
        Number(form.amount) <= 0 ||
        !selectedFile;

    const scanNotReady = !scanVerdict || scanning || !!scanError;

    const scanRejected = scanVerdict?.verdict === 'reject' && !overrideReject;

    const submitDisabled =
        isSaving ||
        isOtpOpen ||
        pendingCreate ||
        missingRequired ||
        scanNotReady ||
        scanRejected;

    const submitLabel = (() => {
        if (isSaving) return 'Submitting…';
        if (isOtpOpen) return 'Awaiting verification…';
        if (scanning) return 'Airy is scanning…';
        if (!selectedFile) return 'Upload a receipt first';
        if (missingRequired) return 'Fill all required fields';
        if (scanError) return 'Fix receipt scan error';
        if (!scanVerdict) return 'Waiting for AI scan…';
        if (scanVerdict.verdict === 'reject' && !overrideReject) return 'AI rejected receipt';
        return 'Submit Claim';
    })();

    const handleCreate = async () => {
        if (isOtpOpen || pendingCreate) return;
        const f = formRef.current;

        if (!isValidId(f.employee_id)) {
            toast.showError('Please select a valid employee');
            return;
        }
        if (
            !f.claim_type_id ||
            f.claim_type_id === 'undefined' ||
            Number.isNaN(Number(f.claim_type_id))
        ) {
            toast.showError('Please select a claim type');
            return;
        }
        if (!f.amount || Number(f.amount) <= 0) {
            toast.showError('Amount must be greater than zero');
            return;
        }
        if (!selectedFileRef.current) {
            toast.showError('Upload a receipt image before submitting.');
            return;
        }
        if (!scanVerdict) {
            toast.showError('Wait for Airy to finish scanning the receipt.');
            return;
        }
        if (scanning) {
            toast.showError('Airy is still scanning. Please wait.');
            return;
        }
        if (scanError) {
            toast.showError('Fix the receipt scan error before submitting.');
            return;
        }
        if (scanVerdict.verdict === 'reject' && !overrideReject) {
            toast.showError(
                'Airy rejected this receipt. Fix the issue or check the override box.'
            );
            return;
        }

        if (!otpActive) {
            setPendingCreate(true);
            setIsOtpOpen(true);
            return;
        }

        await commitCreate();
    };

    const commitCreate = async () => {
        const f = formRef.current;
        const file = selectedFileRef.current;

        if (!isValidId(f.employee_id)) { toast.showError('Please select a valid employee'); return; }
        if (!f.claim_type_id || f.claim_type_id === 'undefined' || Number.isNaN(Number(f.claim_type_id))) { toast.showError('Please select a claim type'); return; }
        if (!f.amount || Number(f.amount) <= 0) { toast.showError('Amount must be greater than zero'); return; }
        if (!file) { toast.showError('Upload a receipt image before submitting.'); return; }
        if (!scanVerdict) { toast.showError('Wait for Airy to finish scanning the receipt.'); return; }
        if (scanVerdict.verdict === 'reject' && !overrideReject) {
            toast.showError('Airy rejected this receipt. Fix the issue or check the override box.');
            return;
        }

        setIsSaving(true);
        try {
            let receiptUrl = f.receipt_url || null;
            setUploadingImage(true);
            try {
                receiptUrl = await uploadImageToStorage(file);
                setForm((prev) => ({ ...prev, receipt_url: receiptUrl }));
            } catch {
                setUploadingImage(false);
                setIsSaving(false);
                return;
            }
            setUploadingImage(false);

            await postData('', {
                employee_id: f.employee_id,
                claim_type_id: Number(f.claim_type_id),
                amount: Number(f.amount),
                description: f.description.trim() || null,
                receipt_url: receiptUrl,
                ai_verdict: scanVerdict.verdict,
                ai_confidence: scanVerdict.confidence,
                ai_notes: scanVerdict.notes,
                ai_override:
                    scanVerdict.verdict === 'reject' && overrideReject ? true : false,
            });

            toast.showSuccess('Claim submitted');
            setIsCreateOpen(false);
            setForm(EMPTY_FORM);
            setSelectedFile(null);
            setUploadedFileName(null);
            setScanVerdict(null);
            setScanError(null);
            setOverrideReject(false);
            if (imagePreviewUrl) {
                URL.revokeObjectURL(imagePreviewUrl);
                setImagePreviewUrl(null);
            }
            setActiveTab('active');
            loadAll();
        } catch (error: any) {
            console.error('Create claim error:', error);
            toast.showError(error?.message || 'Failed to submit claim');
        } finally {
            setIsSaving(false);
            setUploadingImage(false);
        }
    };

    const openEditModal = (claim: any, action: 'approve' | 'reject' | 'reimburse') => {
        if (!claim || !isValidId(claim.id)) {
            toast.showError('Invalid claim — cannot process');
            return;
        }
        setEditTarget(claim);
        setEditAction(action);
        setEditNotes('');
        setIsProcessing(false);
    };

    const handleApprove = async () => {
        if (!editTarget || !isValidId(editTarget.id)) { toast.showError('Invalid claim id'); return; }
        setIsProcessing(true);
        try {
            await putData(`/${editTarget.id}`, { status: 'approved' });
            toast.showSuccess(`Claim from ${editTarget.employee_name} approved`);
            setEditTarget(null); setEditAction(null); setEditNotes('');
            setActiveTab('approved');
            loadAll();
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to approve claim');
        } finally { setIsProcessing(false); }
    };

    const handleReject = async () => {
        if (!editTarget || !isValidId(editTarget.id)) { toast.showError('Invalid claim id'); return; }
        setIsProcessing(true);
        try {
            await putData(`/${editTarget.id}`, {
                status: 'rejected',
                review_notes: editNotes.trim() || null,
            });
            toast.showSuccess(`Claim from ${editTarget.employee_name} rejected`);
            setEditTarget(null); setEditAction(null); setEditNotes('');
            setActiveTab('rejected');
            loadAll();
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to reject claim');
        } finally { setIsProcessing(false); }
    };

    const handleReimburse = async () => {
        if (!editTarget || !isValidId(editTarget.id)) { toast.showError('Invalid claim id'); return; }
        setIsProcessing(true);
        try {
            await putData(`/${editTarget.id}`, { status: 'reimbursed' });
            toast.showSuccess(`Claim from ${editTarget.employee_name} marked as reimbursed`);
            setEditTarget(null); setEditAction(null); setEditNotes('');
            loadAll();
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to mark claim as reimbursed');
        } finally { setIsProcessing(false); }
    };

    const confirmDelete = async () => {
        if (!deleteTarget || !isValidId(deleteTarget.id)) {
            toast.showError('Invalid claim id');
            setDeleteTarget(null);
            return;
        }
        console.log('[delete] sending id =', JSON.stringify(deleteTarget.id));
        console.log('[delete] is UUID?', UUID_RE.test(deleteTarget.id));
        setIsDeleting(true);
        try {
            await deleteData(`/${deleteTarget.id}`);
            toast.showSuccess('Claim deleted');
            setDeleteTarget(null);
            loadAll();
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to delete claim');
        } finally { setIsDeleting(false); }
    };

    const sortedClaims = useMemo(() => {
        return [...claims].sort(
            (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
        );
    }, [claims]);

    const tabCounts = useMemo(() => {
        const active = sortedClaims.filter((c) => c.status === 'pending' || c.status === 'reimbursed');
        const approved = sortedClaims.filter((c) => c.status === 'approved');
        const rejected = sortedClaims.filter((c) => c.status === 'rejected');
        return { active: active.length, approved: approved.length, rejected: rejected.length };
    }, [sortedClaims]);

    const tabSource = useMemo(() => {
        if (activeTab === 'approved') return sortedClaims.filter((c) => c.status === 'approved');
        if (activeTab === 'rejected') return sortedClaims.filter((c) => c.status === 'rejected');
        return sortedClaims.filter((c) => c.status === 'pending' || c.status === 'reimbursed');
    }, [activeTab, sortedClaims]);

    const filtered = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return tabSource;
        return tabSource.filter(
            (c) =>
                (c.employee_name || '').toLowerCase().includes(term) ||
                (c.claim_type_name || '').toLowerCase().includes(term) ||
                (c.description || '').toLowerCase().includes(term)
        );
    }, [tabSource, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filtered.slice(start, start + PAGE_SIZE);
    }, [filtered, currentPage]);

    useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [totalPages, currentPage]);
    useEffect(() => { setCurrentPage(1); }, [searchTerm, activeTab]);

    const pendingCount = useMemo(() => claims.filter((c) => c.status === 'pending').length, [claims]);
    const approvedAmount = useMemo(
        () => claims.filter((c) => c.status === 'approved').reduce((sum, c) => sum + Number(c.amount || 0), 0),
        [claims]
    );
    const reimbursedYtd = useMemo(
        () => claims.filter((c) => c.status === 'reimbursed').reduce((sum, c) => sum + Number(c.amount || 0), 0),
        [claims]
    );

    const emptyStateFor = (tab: ClaimSubTab) => {
        if (tab === 'approved') {
            return {
                icon: CheckCircle2, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30',
                title: 'No approved claims',
                body: 'Claims you approve will show up here, ready to be marked as reimbursed.',
            };
        }
        if (tab === 'rejected') {
            return {
                icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/30',
                title: 'No rejected claims',
                body: 'Claims you reject will show up here for reference.',
            };
        }
        return {
            icon: Receipt, color: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-950/30',
            title: 'No active claims',
            body: 'Pending and reimbursed claims will show up here.',
        };
    };

    const currentEmpty = emptyStateFor(activeTab);
    const EmptyIcon = currentEmpty.icon;

    const SUB_TABS: { value: ClaimSubTab; label: string; icon: React.ComponentType<{ className?: string; size?: number; title?: string }> }[] = [
        { value: 'active', label: 'Active', icon: Clock3 },
        { value: 'approved', label: 'Approved', icon: CheckCircle2 },
        { value: 'rejected', label: 'Rejected', icon: XCircle },
    ];

    return (
        <div className="space-y-5">
            <OtpUnlockBanner
                active={otpActive}
                secondsLeft={secondsLeft}
                onLock={() => void lock()}
                scopeLabel="create, approve, and reimburse allowed without re-verifying"
            />

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard icon={Clock3} label="Pending Review" value={String(pendingCount)} tint="amber" />
                <StatCard icon={CheckCircle2} label="Approved (Unpaid)" value={peso(approvedAmount)} tint="blue" />
                <StatCard icon={Wallet} label="Reimbursed Total" value={peso(reimbursedYtd)} tint="emerald" />
                <StatCard icon={Receipt} label="Total Claims" value={String(claims.length)} tint="gray" />
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <Search placeholder="Search by employee, type, or description..." onSearch={setSearchTerm} className="w-full lg:max-w-sm" />
                <div className="flex gap-2 flex-wrap justify-stretch sm:justify-end w-full lg:w-auto">
                    <Button
                        onClick={() => setIsCreateOpen(true)}
                        disabled={isOtpOpen || pendingCreate}
                        className="font-rethink text-xs h-9 px-3 rounded-md bg-pink-600 text-white hover:bg-pink-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all flex-1 sm:flex-none disabled:opacity-60"
                    >
                        <span className="flex flex-row items-center justify-center gap-1.5">
                            <Plus className="h-3.5 w-3.5 shrink-0" />
                            <span className="whitespace-nowrap leading-none">New Claim</span>
                        </span>
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-1 border-b border-line dark:border-line/30 overflow-x-auto">
                {SUB_TABS.map((tab) => {
                    const active = activeTab === tab.value;
                    const Icon = tab.icon;
                    const count = tabCounts[tab.value];
                    return (
                        <button
                            key={tab.value}
                            onClick={() => setActiveTab(tab.value)}
                            className={`group relative flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium font-rethink transition-colors whitespace-nowrap ${active ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink/80'
                                }`}
                        >
                            <span className={`flex h-6 w-6 items-center justify-center rounded-md transition-all ${active ? 'bg-accent/10 text-accent' : 'bg-ink/[0.03] text-muted group-hover:bg-ink/[0.06] group-hover:text-ink/70'
                                }`}>
                                <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span>{tab.label}</span>
                            <span className={`ml-1 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${active ? 'bg-accent/15 text-accent' : 'bg-ink/[0.05] text-muted dark:bg-ink/[0.10]'
                                }`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                        Loading claims…
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                        <div className={`flex h-14 w-14 items-center justify-center rounded-full mb-3 ${currentEmpty.bg}`}>
                            <EmptyIcon className={`h-6 w-6 ${currentEmpty.color}`} />
                        </div>
                        <p className="text-sm font-medium text-ink font-rethink">{currentEmpty.title}</p>
                        <p className="text-xs text-muted font-rethink mt-1 max-w-xs">{currentEmpty.body}</p>
                    </div>
                ) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-line bg-ink/[0.02] dark:bg-ink/[0.04]">
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Employee</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden lg:table-cell">Type</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Submitted</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Amount</th>
                                        <th className="text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Status</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence initial={false}>
                                        {paginated.map((claim) => (
                                            <motion.tr
                                                key={claim.id}
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="group border-b border-line last:border-b-0 transition-colors hover:bg-pink-50/40 dark:hover:bg-pink-950/10"
                                            >
                                                <td className="px-3 py-3 whitespace-nowrap max-w-[220px]">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold bg-gradient-to-br ${avatarClass(claim.employee_name || claim.employee_id)}`}>
                                                            {initialsOf(claim.employee_name)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-[13px] font-medium text-ink font-rethink truncate">{claim.employee_name}</p>
                                                            {claim.employee_id_number && (
                                                                <p className="text-[10px] text-muted font-rethink">{claim.employee_id_number}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap hidden lg:table-cell">
                                                    <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-paper px-2 py-1 text-[11px] font-medium text-ink font-rethink">
                                                        <FileText className="h-3 w-3 text-accent" />
                                                        {claim.claim_type_name}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-[12px] text-ink/70 font-rethink whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <CalendarClock className="h-3 w-3 text-muted" />
                                                        {formatDate(claim.submitted_at)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                                    <span className="inline-flex items-center rounded-md bg-ink/[0.04] px-2 py-1 font-mono text-[12px] font-semibold text-ink dark:bg-ink/[0.08]">
                                                        {peso(claim.amount)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-center whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize font-rethink ${STATUS_STYLES[claim.status]}`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_COLORS[claim.status]}`} />
                                                        {claim.status}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => setSelected(claim)}
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 transition-all hover:bg-blue-100 hover:scale-105 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-400"
                                                            title="View claim details"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </button>
                                                        {claim.status === 'pending' && (
                                                            <button
                                                                onClick={() => openEditModal(claim, 'approve')}
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-600 transition-all hover:bg-emerald-100 hover:scale-105 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-400"
                                                                title="Approve or reject"
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {claim.status === 'approved' && (
                                                            <button
                                                                onClick={() => openEditModal(claim, 'reimburse')}
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 transition-all hover:bg-blue-100 hover:scale-105 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-400"
                                                                title="Mark reimbursed"
                                                            >
                                                                <Banknote className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => setDeleteTarget(claim)}
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 transition-all hover:bg-red-100 hover:scale-105 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400"
                                                            title="Delete permanently"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>

                        <div className="md:hidden space-y-2.5 p-3">
                            <AnimatePresence initial={false}>
                                {paginated.map((claim) => (
                                    <motion.div
                                        key={claim.id}
                                        layout
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="rounded-lg border border-line p-3.5 dark:border-line/30"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-2.5 min-w-0">
                                                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold bg-gradient-to-br ${avatarClass(claim.employee_name || claim.employee_id)}`}>
                                                    {initialsOf(claim.employee_name)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-ink font-rethink truncate">{claim.employee_name}</p>
                                                    <p className="text-[11px] text-muted font-rethink truncate">
                                                        {claim.claim_type_name} · {formatDate(claim.submitted_at)}
                                                    </p>
                                                    <span className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize font-rethink ${STATUS_STYLES[claim.status]}`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_COLORS[claim.status]}`} />
                                                        {claim.status}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="shrink-0 text-sm font-mono font-semibold tabular-nums text-ink whitespace-nowrap">{peso(claim.amount)}</p>
                                        </div>
                                        <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-line pt-3 dark:border-line/30">
                                            <Button size="sm" variant="outline" onClick={() => setSelected(claim)} className="flex-1 min-w-[60px] text-xs">
                                                <Eye className="h-3.5 w-3.5 mr-1.5" /> View
                                            </Button>
                                            {claim.status === 'pending' && (
                                                <Button size="sm" variant="outline" onClick={() => openEditModal(claim, 'approve')} className="flex-1 min-w-[60px] text-xs border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800/30 dark:bg-emerald-950/30 dark:text-emerald-400">
                                                    <Pencil className="h-3.5 w-3.5 mr-1.5" /> Review
                                                </Button>
                                            )}
                                            {claim.status === 'approved' && (
                                                <Button size="sm" variant="outline" onClick={() => openEditModal(claim, 'reimburse')} className="flex-1 min-w-[60px] text-xs border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800/30 dark:bg-blue-950/30 dark:text-blue-400">
                                                    <Banknote className="h-3.5 w-3.5 mr-1.5" /> Reimburse
                                                </Button>
                                            )}
                                            <Button size="sm" variant="outline" onClick={() => setDeleteTarget(claim)} className="flex-1 min-w-[60px] text-xs border-red-200 bg-red-50 text-red-600 dark:border-red-800/30 dark:bg-red-950/30 dark:text-red-400">
                                                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                                            </Button>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {totalPages > 1 && (
                            <div className="border-t border-line px-4 py-3 sm:px-5 dark:border-line/30">
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentPage}
                                    itemsPerPage={PAGE_SIZE}
                                    totalItems={filtered.length}
                                />
                            </div>
                        )}
                    </>
                )}
            </Card>

            {isCreateOpen && (
                <Modal
                    isOpen={isCreateOpen}
                    onClose={() => {
                        setIsCreateOpen(false);
                        setForm(EMPTY_FORM);
                        setSelectedFile(null);
                        setUploadedFileName(null);
                        setScanVerdict(null);
                        setScanError(null);
                        setOverrideReject(false);
                        if (imagePreviewUrl) {
                            URL.revokeObjectURL(imagePreviewUrl);
                            setImagePreviewUrl(null);
                        }
                    }}
                    title="New Claim"
                    className="max-w-lg"
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button type="button" variant="outline" onClick={() => {
                                setIsCreateOpen(false);
                                setForm(EMPTY_FORM);
                                setSelectedFile(null);
                                setUploadedFileName(null);
                                setScanVerdict(null);
                                setScanError(null);
                                setOverrideReject(false);
                                if (imagePreviewUrl) {
                                    URL.revokeObjectURL(imagePreviewUrl);
                                    setImagePreviewUrl(null);
                                }
                            }} disabled={isSaving} className="w-full sm:w-auto font-rethink">
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleCreate}
                                disabled={submitDisabled}
                                className="w-full sm:w-auto font-rethink"
                            >
                                {submitLabel}
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Employee</label>
                            <select
                                value={form.employee_id}
                                onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors dark:border-line/30"
                            >
                                <option value="">Select employee…</option>
                                {validEmployees.map((emp: any) => (
                                    <option key={emp.employee_id} value={emp.employee_id}>
                                        {emp.employee_name} {emp.employee_id_number ? `(${emp.employee_id_number})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Claim Type</label>
                            <select
                                value={form.claim_type_id}
                                onChange={(e) => setForm((f) => ({ ...f, claim_type_id: e.target.value }))}
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors dark:border-line/30"
                            >
                                <option value="">Select claim type…</option>
                                {validClaimTypes.map((t: any) => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Amount</label>
                            <Input
                                type="number" min="0" step="0.01"
                                value={form.amount}
                                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                                placeholder="0000"
                                leftIcon={
                                    <span className="flex items-center gap-1">
                                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">₱</span>
                                    </span>
                                }
                                className="font-mono"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Description</label>
                            <textarea
                                value={form.description}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                rows={2}
                                placeholder="Brief note on this claim"
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors dark:border-line/30 resize-none"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Receipt / Proof</label>
                            <div className="flex items-center gap-3">
                                <label className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-4 py-2.5 text-sm font-rethink text-accent hover:bg-accent/10 transition-colors flex-1">
                                    <Upload className="h-4 w-4" />
                                    <span>{selectedFile ? 'Change Image' : 'Select Image'}</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleFileSelect(file);
                                        }}
                                        disabled={isSaving || uploadingImage}
                                    />
                                </label>
                                {selectedFile && (
                                    <button
                                        type="button"
                                        onClick={handleRemoveImage}
                                        className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-rethink text-red-600 hover:bg-red-100 transition-colors"
                                        disabled={isSaving || uploadingImage}
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {imagePreviewUrl && (
                                <div className="mt-3 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <ImageIcon className="h-4 w-4 text-emerald-500" />
                                            <span className="text-xs font-medium text-ink font-rethink">{selectedFile?.name || 'Image preview'}</span>
                                            <span className="text-[10px] text-muted font-rethink">
                                                ({selectedFile?.size ? (selectedFile.size / 1024).toFixed(1) : 0} KB)
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-amber-500 font-rethink">Will be uploaded on submit</span>
                                    </div>

                                    <AiryReceiptScanner
                                        imagePreviewUrl={imagePreviewUrl}
                                        scanning={scanning}
                                        verdict={scanVerdict}
                                        onRescan={runReceiptScan}
                                    />

                                    {scanError && (
                                        <p className="text-[11px] text-red-600 font-rethink">{scanError}</p>
                                    )}

                                    {scanVerdict?.verdict === 'reject' && (
                                        <label className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/60 p-2.5 dark:border-red-800/40 dark:bg-red-950/30">
                                            <input
                                                type="checkbox"
                                                checked={overrideReject}
                                                onChange={(e) => setOverrideReject(e.target.checked)}
                                                className="mt-0.5 h-3.5 w-3.5 accent-red-600"
                                            />
                                            <span className="text-[11px] text-red-800 dark:text-red-300 font-rethink leading-relaxed">
                                                Airy rejected this receipt. I confirm I have manually verified the receipt and want to override.
                                            </span>
                                        </label>
                                    )}
                                </div>
                            )}

                            {uploadingImage && (
                                <div className="mt-2 flex items-center gap-2 text-xs text-muted font-rethink">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Uploading image...
                                </div>
                            )}
                        </div>
                    </div>
                </Modal>
            )}

            {editTarget && editAction && (
                <Modal
                    isOpen={!!editTarget}
                    onClose={() => { setEditTarget(null); setEditAction(null); setEditNotes(''); }}
                    title={
                        editAction === 'approve' ? 'Review Claim'
                            : editAction === 'reject' ? 'Reject Claim'
                                : 'Mark as Reimbursed'
                    }
                    className="max-w-md"
                    footer={
                        editAction === 'approve' ? (
                            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 w-full">
                                <Button type="button" variant="outline" onClick={() => { setEditTarget(null); setEditAction(null); setEditNotes(''); }} disabled={isProcessing} className="w-full sm:w-auto font-rethink">Cancel</Button>
                                <Button type="button" onClick={handleReject} disabled={isProcessing} className="w-full sm:w-auto font-rethink bg-red-600 text-white hover:bg-red-700 focus:ring-red-500">
                                    {isProcessing ? 'Processing…' : 'Reject'}
                                </Button>
                                <Button type="button" onClick={handleApprove} disabled={isProcessing} className="w-full sm:w-auto font-rethink bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500">
                                    {isProcessing ? 'Processing…' : 'Approve'}
                                </Button>
                            </div>
                        ) : editAction === 'reject' ? (
                            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                                <Button type="button" variant="outline" onClick={() => { setEditTarget(null); setEditAction(null); setEditNotes(''); }} disabled={isProcessing} className="w-full sm:w-auto font-rethink">Cancel</Button>
                                <Button type="button" onClick={handleReject} disabled={isProcessing} className="w-full sm:w-auto font-rethink bg-red-600 text-white hover:bg-red-700 focus:ring-red-500">
                                    {isProcessing ? 'Processing…' : 'Reject'}
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                                <Button type="button" variant="outline" onClick={() => { setEditTarget(null); setEditAction(null); setEditNotes(''); }} disabled={isProcessing} className="w-full sm:w-auto font-rethink">Cancel</Button>
                                <Button type="button" onClick={handleReimburse} disabled={isProcessing} className="w-full sm:w-auto font-rethink bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500">
                                    {isProcessing ? 'Processing…' : 'Confirm Reimbursement'}
                                </Button>
                            </div>
                        )
                    }
                >
                    <div className="space-y-4">
                        <div className={`flex items-start gap-4 rounded-xl border px-4 py-4 ${editAction === 'approve'
                            ? 'border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-800/30 dark:bg-emerald-950/30'
                            : editAction === 'reject'
                                ? 'border-red-200/60 bg-red-50/50 dark:border-red-800/30 dark:bg-red-950/30'
                                : 'border-blue-200/60 bg-blue-50/50 dark:border-blue-800/30 dark:bg-blue-950/30'
                            }`}>
                            {editAction === 'approve' && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5 dark:text-emerald-400" />}
                            {editAction === 'reject' && <XCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5 dark:text-red-400" />}
                            {editAction === 'reimburse' && <Banknote className="h-5 w-5 shrink-0 text-blue-600 mt-0.5 dark:text-blue-400" />}
                            <div>
                                <p className={`text-sm font-rethink leading-relaxed ${editAction === 'approve'
                                    ? 'text-emerald-800/90 dark:text-emerald-300/90'
                                    : editAction === 'reject'
                                        ? 'text-red-800/90 dark:text-red-300/90'
                                        : 'text-blue-800/90 dark:text-blue-300/90'
                                    }`}>
                                    {editAction === 'approve' && `Approve or reject the ${peso(editTarget.amount)} claim from ${editTarget.employee_name}?`}
                                    {editAction === 'reject' && `Reject the ${peso(editTarget.amount)} claim from ${editTarget.employee_name}?`}
                                    {editAction === 'reimburse' && `Confirm that ${peso(editTarget.amount)} has been paid out to ${editTarget.employee_name}?`}
                                </p>
                            </div>
                        </div>

                        {(editAction === 'reject' || editAction === 'approve') && (
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">
                                    Reason (optional for reject)
                                </label>
                                <textarea
                                    value={editNotes}
                                    onChange={(e) => setEditNotes(e.target.value)}
                                    rows={2}
                                    placeholder="Let the employee know why (for rejections)"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors dark:border-line/30 resize-none"
                                />
                            </div>
                        )}

                        <div className="flex items-center justify-between rounded-lg bg-paper border border-line px-3.5 py-2.5 dark:border-line/30">
                            <span className="text-xs text-muted font-rethink">Amount</span>
                            <span className="text-sm font-mono font-semibold text-ink">{peso(editTarget.amount)}</span>
                        </div>
                    </div>
                </Modal>
            )}

            {selected && (
                <Modal
                    isOpen={!!selected}
                    onClose={() => setSelected(null)}
                    title={selected.employee_name}
                    className="max-w-lg"
                    accent="pink"
                    icon={UserCircle2}
                    footer={
                        <Button type="button" variant="outline" onClick={() => setSelected(null)} className="font-rethink">Close</Button>
                    }
                >
                    <div className="space-y-4 font-rethink">
                        <div className="flex items-center gap-3">
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold bg-gradient-to-br ${avatarClass(selected.employee_name || selected.employee_id)}`}>
                                {initialsOf(selected.employee_name)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-ink truncate">{selected.employee_name}</p>
                                {selected.employee_id_number && (
                                    <p className="text-[11px] text-muted">{selected.employee_id_number}</p>
                                )}
                            </div>
                            <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize ${STATUS_STYLES[selected.status]}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_COLORS[selected.status]}`} />
                                {selected.status}
                            </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                            <span className="inline-flex items-center gap-1.5">
                                <FileText className="h-3 w-3" /> {selected.claim_type_name}
                            </span>
                            <span className="text-muted/30">•</span>
                            <span className="inline-flex items-center gap-1.5">
                                <CalendarClock className="h-3 w-3" /> Submitted {formatDateTime(selected.submitted_at)}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {selected.reviewed_at && (
                                <div className="rounded-lg border border-line bg-ink/[0.02] p-3 dark:bg-ink/[0.05]">
                                    <p className="text-[10px] uppercase tracking-wide text-muted">Reviewed</p>
                                    <p className="text-sm text-ink mt-0.5">{formatDate(selected.reviewed_at)}</p>
                                </div>
                            )}
                            {selected.reimbursed_at && (
                                <div className="rounded-lg border border-line bg-emerald-50/60 p-3 dark:bg-emerald-950/30">
                                    <p className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Paid</p>
                                    <p className="text-sm text-emerald-800 dark:text-emerald-300 mt-0.5">{formatDate(selected.reimbursed_at)}</p>
                                </div>
                            )}
                            {selected.reviewed_by_name && (
                                <div className="rounded-lg border border-line bg-ink/[0.02] p-3 dark:bg-ink/[0.05]">
                                    <p className="text-[10px] uppercase tracking-wide text-muted">Reviewed By</p>
                                    <p className="text-sm text-ink mt-0.5 truncate">{selected.reviewed_by_name}</p>
                                </div>
                            )}
                        </div>

                        {selected.description && (
                            <div className="rounded-lg border border-line bg-ink/[0.02] p-3 dark:bg-ink/[0.05]">
                                <p className="text-[10px] uppercase tracking-wide text-muted">Description</p>
                                <p className="text-sm text-ink mt-0.5">{selected.description}</p>
                            </div>
                        )}

                        {selected.receipt_url && (
                            <div className="rounded-lg border border-line p-3 dark:border-line/30">
                                <p className="text-[10px] uppercase tracking-wide text-muted mb-2">Receipt / Proof</p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedImageUrl(selected.receipt_url);
                                        setImageViewerOpen(true);
                                    }}
                                    className="w-full"
                                >
                                    <img
                                        src={selected.receipt_url}
                                        alt="Receipt"
                                        className="max-h-48 w-full rounded-lg border border-line object-contain hover:opacity-80 transition-opacity dark:border-line/30"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                </button>
                            </div>
                        )}

                        {selected.review_notes && (
                            <div className="rounded-lg border border-line bg-ink/[0.02] p-3 dark:bg-ink/[0.05]">
                                <p className="text-[10px] uppercase tracking-wide text-muted">Review Notes</p>
                                <p className="text-sm text-ink mt-0.5">{selected.review_notes}</p>
                            </div>
                        )}

                        <div className="flex items-center justify-between rounded-lg border border-accent/20 bg-accent/5 px-4 py-3">
                            <span className="text-sm font-medium text-accent">Amount</span>
                            <span className="text-lg font-mono font-semibold text-accent">{peso(selected.amount)}</span>
                        </div>
                    </div>
                </Modal>
            )}

            {deleteTarget && (
                <Modal
                    isOpen={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    title="Delete Claim"
                    className="max-w-md"
                    accent="red"
                    icon={AlertTriangle}
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="w-full sm:w-auto font-rethink">Cancel</Button>
                            <Button type="button" onClick={confirmDelete} disabled={isDeleting} className="w-full sm:w-auto font-rethink bg-red-600 text-white hover:bg-red-700 focus:ring-red-500">
                                {isDeleting ? 'Deleting…' : 'Delete Permanently'}
                            </Button>
                        </div>
                    }
                >
                    <div className="flex items-start gap-4 rounded-xl border border-red-200/60 bg-red-50/50 px-4 py-4 dark:border-red-800/30 dark:bg-red-950/30">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                        <p className="text-sm text-red-800/90 font-rethink leading-relaxed dark:text-red-300/90">
                            Delete the {peso(deleteTarget.amount)} claim from {deleteTarget.employee_name}? This cannot be undone.
                        </p>
                    </div>
                </Modal>
            )}

            {imageViewerOpen && selectedImageUrl && (
                <ImageViewer
                    isOpen={imageViewerOpen}
                    onClose={() => { setImageViewerOpen(false); setSelectedImageUrl(null); }}
                    imageUrl={selectedImageUrl}
                    title={`Receipt - ${selected?.employee_name || 'Claim'}`}
                />
            )}

            <OtpModal
                isOpen={isOtpOpen}
                onClose={() => { setIsOtpOpen(false); setPendingCreate(false); }}
                purpose="claim"
                title="Verify New Claim"
                subtitle="Enter the 6-digit code sent to your email to authorize this claim submission."
                actionLabel="claim"
                onVerified={(meta) => {
                    setIsOtpOpen(false);
                    const wasPending = pendingCreate;
                    setPendingCreate(false);
                    unlock(meta?.scope || 'all', meta?.secondsLeft);
                    if (wasPending) {
                        queueMicrotask(() => {
                            commitCreate().catch((err) => {
                                console.error('[claims] commitCreate failed after OTP verify', err);
                            });
                        });
                    }
                }}
            />
        </div>
    );
};

export default ClaimsManager;