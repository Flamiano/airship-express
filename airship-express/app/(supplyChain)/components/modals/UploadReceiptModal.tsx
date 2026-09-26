// app/(supplyChain)/components/modals/UploadReceiptModal.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { user } from '../../lib/services/Class/user';
import { AppButton } from '../ui/AppButton';
import { StatusBadge } from '../ui/StatusBadge';
import Portal from '../client/Portal';
import {
    uploadReceiptAndVerifyAction,
    forceInsertVerificationAction,
    getVerificationDetailsAction,
    ComparedFields,
    ExtractedReceiptJSON
} from '../../(pages)/purchase-orders/server/actions/ocr-verify';

export interface VerificationJob {
    verificationId: string;
    poId: string;
    poNumber: string;
    status: 'processing' | 'matched' | 'mismatched' | 'forced';
    comparedFields?: ComparedFields | null;
    extractedJson?: ExtractedReceiptJSON | null;
    timestamp: number;
}

export interface ReceiptQueueItem {
    id: string;
    poId: string;
    poNumber: string;
    supplierName: string;
    totalAmount: number;
    file: File;
    fileName: string;
    fileBase64: string;
    fileType: string;
    fileSize: number;
    status: 'queued' | 'processing' | 'matched' | 'mismatched' | 'error';
    error?: string;
    verificationId?: string;
    comparedFields?: ComparedFields | null;
    extractedJson?: ExtractedReceiptJSON | null;
    addedAt: number;
}

export const RATE_LIMIT_PREFIX = 'ocr_mismatch_rate_';
export const MAX_MISMATCH_ATTEMPTS = 3;
export const COOLDOWN_DURATION_SECONDS = 120; // 2 minutes

export interface RateLimitInfo {
    count: number;
    lockedUntil: number | null; // epoch timestamp ms
}

export function getPoRateLimit(poId: string): RateLimitInfo {
    if (typeof window === 'undefined') return { count: 0, lockedUntil: null };
    try {
        const stored = localStorage.getItem(`${RATE_LIMIT_PREFIX}${poId}`);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Failed to get rate limit:', e);
    }
    return { count: 0, lockedUntil: null };
}

export function setPoRateLimit(poId: string, info: RateLimitInfo) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(`${RATE_LIMIT_PREFIX}${poId}`, JSON.stringify(info));
    } catch (e) {
        console.error('Failed to set rate limit:', e);
    }
}

export function clearPoRateLimit(poId: string) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem(`${RATE_LIMIT_PREFIX}${poId}`);
    } catch (e) {
        console.error('Failed to clear rate limit:', e);
    }
}

export interface UploadReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    po: {
        id: string;
        po_number: string;
        supplier_name: string;
        total_amount: number;
        status?: string;
        items?: any[];
        paid?: boolean;
        verification?: any;
        document?: any;
    } | null;
    initialVerificationId?: string | null;
    isQueuedOrVerifying?: boolean;
    onMinimize?: (job: VerificationJob | null) => void;
    onSuccess?: () => void;
    onStartVerification?: (poId: string, poNumber: string) => void;
    onEndVerification?: (poId: string) => void;
    onQueueVerification?: (job: {
        po: any;
        file: File;
        base64Data: string;
    }) => void;
}

export function UploadReceiptModal({
    isOpen,
    onClose,
    po,
    initialVerificationId,
    isQueuedOrVerifying,
    onMinimize,
    onSuccess,
    onStartVerification,
    onEndVerification,
    onQueueVerification,
}: UploadReceiptModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [verificationState, setVerificationState] = useState<'upload' | 'verifying' | 'matched' | 'mismatched' | 'forced'>('upload');
    const [comparedFields, setComparedFields] = useState<ComparedFields | null>(null);
    const [extractedData, setExtractedData] = useState<ExtractedReceiptJSON | null>(null);
    const [verificationId, setVerificationId] = useState<string | null>(initialVerificationId || null);

    const [isForcing, setIsForcing] = useState<boolean>(false);
    const [forceReason, setForceReason] = useState<string>('');
    const [sameNameWarning, setSameNameWarning] = useState<boolean>(false);

    // Rate limiting state (3 mismatched attempts -> 2 mins cooldown)
    const [mismatchCount, setMismatchCount] = useState<number>(0);
    const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const currentUserRole = user.getRole();
    const normalizedRole = (currentUserRole || '').toLowerCase().trim();
    const isAdmin = ['admin', 'super_admin', 'superadmin'].includes(normalizedRole) || currentUserRole === 'Admin';
    const isManager = ['manager'].includes(normalizedRole) || currentUserRole === 'Manager';
    const isAdminOrManager = isAdmin || isManager;

    const existingDbFileName = po?.document?.file_name || null;

    // Check rate limit state when opened
    useEffect(() => {
        if (!isOpen || !po?.id) return;

        const rateData = getPoRateLimit(po.id);
        const now = Date.now();

        if (rateData.lockedUntil && rateData.lockedUntil > now) {
            const remaining = Math.ceil((rateData.lockedUntil - now) / 1000);
            setSecondsRemaining(remaining);
            setMismatchCount(rateData.count || MAX_MISMATCH_ATTEMPTS);
        } else {
            if (rateData.lockedUntil && rateData.lockedUntil <= now) {
                clearPoRateLimit(po.id);
                setMismatchCount(0);
            } else {
                setMismatchCount(rateData.count || 0);
            }
            setSecondsRemaining(0);
        }
    }, [isOpen, po?.id]);

    // Active 1s countdown timer effect
    useEffect(() => {
        if (secondsRemaining <= 0) return;

        const timer = setInterval(() => {
            setSecondsRemaining((prev) => {
                if (prev <= 1) {
                    if (po?.id) {
                        clearPoRateLimit(po.id);
                        setMismatchCount(0);
                    }
                    toast.success('Upload cooldown expired. You can now try uploading a receipt again.');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [secondsRemaining, po?.id]);

    useEffect(() => {
        if (isOpen) {
            if (isQueuedOrVerifying) {
                setIsUploading(true);
                setVerificationState('verifying');
            } else if (initialVerificationId) {
                loadVerificationDetails(initialVerificationId);
            } else if (po?.verification?.id) {
                loadVerificationDetails(po.verification.id);
            } else {
                setFile(null);
                setPreviewUrl(null);
                setIsUploading(false);
                setVerificationState('upload');
                setComparedFields(null);
                setExtractedData(null);
                setVerificationId(null);
                setForceReason('');
                setSameNameWarning(false);
            }
        }
    }, [isOpen, initialVerificationId, po, isQueuedOrVerifying]);

    useEffect(() => {
        return () => {
            if (previewUrl && previewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    const loadVerificationDetails = async (id: string) => {
        if (!id || id.startsWith('temp_')) {
            setIsUploading(true);
            setVerificationState('verifying');
            return;
        }
        setIsUploading(true);
        setVerificationState('verifying');
        try {
            const res = await getVerificationDetailsAction(id);
            if (res.success && res.data) {
                const dv = res.data;
                setVerificationId(dv.id);
                setExtractedData(dv.extracted_json as ExtractedReceiptJSON);
                setComparedFields(dv.compared_fields as ComparedFields);
                setPreviewUrl(dv.uploaded_file_url);
                setVerificationState(dv.match_result as any || 'mismatched');
            } else {
                toast.error('Could not load verification details');
                setVerificationState('upload');
            }
        } catch (err) {
            console.error('Failed to load verification:', err);
            setVerificationState('upload');
        } finally {
            setIsUploading(false);
        }
    };

    if (!isOpen || !po) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (!selected) return;

        if (!selected.type.startsWith('image/') && selected.type !== 'application/pdf') {
            toast.warning('Please upload an image (PNG, JPG, WebP) or PDF receipt.');
            return;
        }

        const isSameName = !!existingDbFileName && selected.name.toLowerCase() === existingDbFileName.toLowerCase();
        setSameNameWarning(isSameName);
        if (isSameName) {
            toast.warning(`Note: Selected file '${selected.name}' has the same name as the existing document in DB.`);
        }

        if (previewUrl && previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(previewUrl);
        }

        setFile(selected);
        const url = URL.createObjectURL(selected);
        setPreviewUrl(url);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const dropped = e.dataTransfer.files?.[0];
        if (!dropped) return;

        if (!dropped.type.startsWith('image/') && dropped.type !== 'application/pdf') {
            toast.warning('Please drop an image or PDF receipt.');
            return;
        }

        if (previewUrl && previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(previewUrl);
        }

        setFile(dropped);
        const url = URL.createObjectURL(dropped);
        setPreviewUrl(url);
    };

    const handleSubmitUpload = async () => {
        if (!file) {
            toast.warning('Please select a receipt file first');
            return;
        }

        if (secondsRemaining > 0) {
            toast.error(`Upload is locked due to 3 mismatched attempts. Please wait ${Math.floor(secondsRemaining / 60)}m ${secondsRemaining % 60}s before uploading again.`);
            return;
        }

        setIsUploading(true);
        setVerificationState('verifying');
        onStartVerification?.(po.id, po.po_number);

        // Convert file to Base64
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64Data = reader.result as string;

            if (onQueueVerification) {
                onQueueVerification({
                    po,
                    file,
                    base64Data,
                });
                onClose();
                return;
            }

            // Notify minimizer if user chooses to minimize early
            const tempJob: VerificationJob = {
                verificationId: 'temp_' + Date.now(),
                poId: po.id,
                poNumber: po.po_number,
                status: 'processing',
                timestamp: Date.now(),
            };
            onMinimize?.(tempJob);

            try {
                const res = await uploadReceiptAndVerifyAction({
                    po_id: po.id,
                    fileBase64: base64Data,
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    userId: user.getUserId() || undefined,
                    userRole: currentUserRole,
                    userName: user.getName() || 'Procurement Officer',
                    userEmail: user.getEmail() || 'procurement@airshipexpress.com',
                });

                if (res.success) {
                    setVerificationId(res.verificationId || null);
                    setExtractedData(res.extractedJson || null);
                    setComparedFields(res.comparedFields || null);
                    setVerificationState((res.matchResult as 'matched' | 'mismatched') || 'mismatched');

                    if (res.matchResult === 'matched') {
                        clearPoRateLimit(po.id);
                        setMismatchCount(0);
                        setSecondsRemaining(0);
                        onEndVerification?.(po.id);

                        toast.success(`Receipt document inserted into Documents & PO #${po.po_number} marked as Paid!`);
                        onMinimize?.({
                            verificationId: res.verificationId!,
                            poId: po.id,
                            poNumber: po.po_number,
                            status: 'matched',
                            comparedFields: res.comparedFields,
                            extractedJson: res.extractedJson,
                            timestamp: Date.now(),
                        });
                        onSuccess?.();
                        setTimeout(() => {
                            onClose();
                        }, 500);
                    } else {
                        onEndVerification?.(po.id);
                        const newCount = (mismatchCount || 0) + 1;
                        if (newCount >= MAX_MISMATCH_ATTEMPTS) {
                            const lockedUntil = Date.now() + COOLDOWN_DURATION_SECONDS * 1000;
                            setPoRateLimit(po.id, { count: newCount, lockedUntil });
                            setMismatchCount(newCount);
                            setSecondsRemaining(COOLDOWN_DURATION_SECONDS);
                            toast.error('Upload locked: 3 mismatched receipt attempts reached. Upload is disabled for 2 minutes.');
                        } else {
                            setPoRateLimit(po.id, { count: newCount, lockedUntil: null });
                            setMismatchCount(newCount);
                            toast.warning(`Receipt mismatch (${newCount}/${MAX_MISMATCH_ATTEMPTS}). 3 mismatches will lock uploads for 2 minutes.`);
                        }

                        toast.warning(`Receipt details did not match PO #${po.po_number}. Review fields below.`);
                        onMinimize?.({
                            verificationId: res.verificationId!,
                            poId: po.id,
                            poNumber: po.po_number,
                            status: 'mismatched',
                            comparedFields: res.comparedFields,
                            extractedJson: res.extractedJson,
                            timestamp: Date.now(),
                        });
                    }
                } else {
                    onEndVerification?.(po.id);
                    toast.error(res.error || 'Verification process failed');
                    setVerificationState('upload');
                    onMinimize?.(null);
                }
            } catch (err: any) {
                onEndVerification?.(po.id);
                console.error('Error during OCR verification:', err);
                toast.error(err?.message || 'Verification failed');
                setVerificationState('upload');
                onMinimize?.(null);
            } finally {
                setIsUploading(false);
            }
        };
    };

    const handleForceInsert = async () => {
        if (!verificationId) {
            toast.error('No verification ID available to force insert');
            return;
        }

        if (!isAdmin) {
            toast.error('Permission denied: Force insert is disabled for Manager role and restricted to Administrators.');
            return;
        }

        setIsForcing(true);
        const toastId = toast.loading('Authorizing forced receipt insert...');

        try {
            const res = await forceInsertVerificationAction({
                verification_id: verificationId,
                po_id: po.id,
                userId: user.getUserId() || undefined,
                userRole: currentUserRole,
                userName: user.getName() || 'Administrator',
                userEmail: user.getEmail() || 'admin@airshipexpress.com',
                reason: forceReason || 'Manual administrative receipt approval',
            });

            if (res.success) {
                clearPoRateLimit(po.id);
                setMismatchCount(0);
                setSecondsRemaining(0);
                onEndVerification?.(po.id);

                toast.success(`Receipt recorded in Documents & PO #${po.po_number} marked as Paid!`, { id: toastId });
                setVerificationState('forced');
                onMinimize?.({
                    verificationId: verificationId,
                    poId: po.id,
                    poNumber: po.po_number,
                    status: 'forced',
                    timestamp: Date.now(),
                });
                onSuccess?.();
                setTimeout(() => {
                    onClose();
                }, 500);
            } else {
                toast.error(res.error || 'Force insert rejected', { id: toastId });
            }
        } catch (err: any) {
            console.error('Force insert error:', err);
            toast.error(err?.message || 'Force insert failed', { id: toastId });
        } finally {
            setIsForcing(false);
        }
    };

    return (
        <Portal>
            <div
                className="fixed inset-0 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200"
                onClick={onClose}
            >
            <div
                className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl max-w-2xl w-full p-6  dark:shadow-[14px_14px_40px_rgba(0,0,0,0.8),-4px_-4px_12px_rgba(255,255,255,0.03)] border border-white/90 dark:border-white/[0.08] animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-200/60 dark:border-white/[0.06] shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] ${
                            verificationState === 'matched'
                                ? 'bg-[#ebf0f7] dark:bg-[#14151e] text-emerald-600'
                                : verificationState === 'forced'
                                    ? 'bg-[#ebf0f7] dark:bg-[#14151e] text-blue-600'
                                    : verificationState === 'mismatched'
                                        ? 'bg-[#ebf0f7] dark:bg-[#14151e] text-amber-600'
                                        : 'bg-[#ebf0f7] dark:bg-[#14151e] text-pink-600'
                        }`}>
                            <i className={`fas ${
                                verificationState === 'matched'
                                    ? 'fa-check'
                                    : verificationState === 'forced'
                                        ? 'fa-shield-alt'
                                        : verificationState === 'mismatched'
                                            ? 'fa-triangle-exclamation'
                                            : 'fa-receipt'
                            } text-sm`}></i>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                                    {verificationState === 'matched'
                                        ? 'Receipt Verified & Paid'
                                        : verificationState === 'mismatched'
                                            ? 'Receipt OCR Mismatch Review'
                                            : verificationState === 'forced'
                                                ? 'Receipt Force-Approved'
                                                : 'Verify Payment Receipt'}
                                </h3>
                                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
                                    {po.po_number}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Automated Gemini OCR validation for {po.supplier_name}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {verificationState === 'verifying' && (
                            <AppButton
                                type="button"
                                variant="neutral"
                                size="xs"
                                onClick={onClose}
                                title="Minimize to background indicator"
                            >
                                <i className="fas fa-window-minimize text-[10px] -translate-y-0.5"></i>
                                <span>Minimize</span>
                            </AppButton>
                        )}
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="icon-sm"
                            onClick={onClose}
                            aria-label="Close modal"
                            title="Close"
                        >
                            <i className="fas fa-times text-xs"></i>
                        </AppButton>
                    </div>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                    {/* 1. UPLOAD STATE */}
                    {verificationState === 'upload' && (
                        <div className="space-y-4">
                            {/* PO Target Details */}
                            <div className="p-3.5 bg-[#ebf0f7] dark:bg-[#14151e] rounded-2xl border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] flex items-center justify-between text-xs">
                                <div>
                                    <span className="text-slate-400 block text-[11px]">Expected Supplier:</span>
                                    <strong className="text-slate-800 dark:text-slate-200">{po.supplier_name}</strong>
                                </div>
                                <div className="text-right">
                                    <span className="text-slate-400 block text-[11px]">Expected Amount:</span>
                                    <strong className="text-slate-900 dark:text-slate-100 font-mono text-sm">
                                        ₱{po.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </strong>
                                </div>
                            </div>

                            {/* Rate limit lockout warning */}
                            {secondsRemaining > 0 ? (
                                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 flex items-center justify-between text-xs text-rose-900 dark:text-rose-200">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                                            <i className="fas fa-lock text-sm"></i>
                                        </div>
                                        <div>
                                            <p className="font-bold">Upload Temporarily Locked ({mismatchCount}/3 Attempts)</p>
                                            <p className="text-[11px] text-rose-700 dark:text-rose-300">
                                                3 mismatched receipts detected. Upload is disabled for 2 minutes.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="px-3 py-1.5 rounded-xl bg-rose-100 dark:bg-rose-900/50 border border-rose-200 dark:border-rose-800 font-mono font-bold text-rose-700 dark:text-rose-200 text-xs">
                                        {Math.floor(secondsRemaining / 60)}m {secondsRemaining % 60}s
                                    </div>
                                </div>
                            ) : mismatchCount > 0 ? (
                                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 flex items-center justify-between text-[11px] text-amber-800 dark:text-amber-300">
                                    <span className="flex items-center gap-1.5">
                                        <i className="fas fa-triangle-exclamation text-amber-500" />
                                        Previous receipt mismatched.
                                    </span>
                                    <span className="font-bold font-mono px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-[10px]">
                                        {mismatchCount} / {MAX_MISMATCH_ATTEMPTS} Attempts
                                    </span>
                                </div>
                            ) : null}

                            {/* Dropzone */}
                            <div
                                onDragOver={(e) => {
                                    if (secondsRemaining > 0) return;
                                    e.preventDefault();
                                }}
                                onDrop={(e) => {
                                    if (secondsRemaining > 0) return;
                                    handleDrop(e);
                                }}
                                onClick={() => {
                                    if (secondsRemaining > 0) return;
                                    fileInputRef.current?.click();
                                }}
                                className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all space-y-3 bg-[#ebf0f7]/60 dark:bg-[#14151e]/60 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.3),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] ${
                                    secondsRemaining > 0
                                        ? 'border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed pointer-events-none'
                                        : 'border-slate-300/80 dark:border-slate-700/80 hover:border-pink-500 dark:hover:border-pink-500 cursor-pointer hover:bg-pink-50/20'
                                }`}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept="image/*,application/pdf"
                                    disabled={secondsRemaining > 0}
                                    className="hidden"
                                />

                                {previewUrl && file?.type.startsWith('image/') ? (
                                    <div className="space-y-2">
                                        <img
                                            src={previewUrl}
                                            alt="Receipt preview"
                                            className="max-h-48 mx-auto rounded-xl shadow-md object-contain border border-slate-200 dark:border-slate-700"
                                        />
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                            {file.name} ({(file.size / 1024).toFixed(1)} KB)
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-14 h-14 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] text-pink-600 dark:text-pink-400 mx-auto flex items-center justify-center text-xl">
                                            <i className="fas fa-cloud-arrow-up"></i>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                                Click to upload or drag & drop receipt
                                            </p>
                                            <p className="text-xs text-slate-400 mt-1">
                                                Supports PNG, JPG, WebP, PDF (receipts, delivery invoices)
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Same filename warning alert if re-uploading same file */}
                            {sameNameWarning && (
                                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                                    <i className="fas fa-exclamation-triangle mt-0.5 shrink-0" />
                                    <span>
                                        This file has the same filename as the existing record in the database. Please ensure you are uploading the updated/corrected document.
                                    </span>
                                </div>
                            )}

                            {/* Submit Button */}
                            <div className="flex items-center justify-end gap-2.5 pt-2">
                                <AppButton
                                    type="button"
                                    variant="neutral"
                                    size="sm"
                                    onClick={onClose}
                                >
                                    Cancel
                                </AppButton>
                                <AppButton
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    disabled={!file || isUploading || secondsRemaining > 0}
                                    onClick={handleSubmitUpload}
                                >
                                    <i className={`fas ${secondsRemaining > 0 ? 'fa-lock' : 'fa-microchip'} text-xs`}></i>
                                    <span>
                                        {secondsRemaining > 0
                                            ? `Locked (${Math.floor(secondsRemaining / 60)}m ${secondsRemaining % 60}s)`
                                            : initialVerificationId || po.verification
                                                ? 'Retry Run AI OCR'
                                                : 'Run AI OCR Verification'}
                                    </span>
                                </AppButton>
                            </div>
                        </div>
                    )}

                    {/* 2. VERIFYING STATE */}
                    {verificationState === 'verifying' && (
                        <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                            <div className="w-16 h-16 rounded-3xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] text-pink-600 flex items-center justify-center text-2xl animate-pulse">
                                <i className="fas fa-spinner fa-spin"></i>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                    Parsing receipt with Gemini OCR...
                                </h4>
                                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                                    Extracting vendor name, total amounts, and line items to match against PO #{po.po_number}.
                                </p>
                            </div>
                            <AppButton
                                type="button"
                                variant="neutral"
                                size="sm"
                                onClick={onClose}
                            >
                                Minimize & Continue Working
                            </AppButton>
                        </div>
                    )}

                    {/* 3. MATCHED OR MISMATCHED OR FORCED REVIEW STATE */}
                    {(verificationState === 'matched' || verificationState === 'mismatched' || verificationState === 'forced') && (
                        <div className="space-y-4">
                            {/* Result Banner */}
                            {verificationState === 'matched' && (
                                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-200">
                                    <i className="fas fa-circle-check text-emerald-500 text-base shrink-0 mt-0.5"></i>
                                    <div>
                                        <p className="font-bold">Receipt Matched Successfully!</p>
                                        <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                                            The vendor and total amount matched PO #{po.po_number}. The receipt has been stored in Document Tracking and PO #{po.po_number} is marked as <strong>Paid</strong>.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {verificationState === 'mismatched' && (
                                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
                                    <i className="fas fa-triangle-exclamation text-amber-500 text-base shrink-0 mt-0.5"></i>
                                    <div>
                                        <p className="font-bold">OCR Mismatch Detected</p>
                                        <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                                            The extracted receipt fields do not match the expected Purchase Order. Admin/Manager review or Force Insert is required.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {verificationState === 'forced' && (
                                <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 flex items-start gap-3 text-xs text-blue-900 dark:text-blue-200">
                                    <i className="fas fa-user-shield text-blue-500 text-base shrink-0 mt-0.5"></i>
                                    <div>
                                        <p className="font-bold">Force Inserted by Administrator</p>
                                        <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                                            This document was manually approved and registered. Audit logs have recorded this override.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Side-by-Side Comparison Table */}
                            <div className="rounded-2xl border border-white/80 dark:border-white/[0.06] bg-[#ebf0f7] dark:bg-[#14151e] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] overflow-hidden text-xs">
                                <table className="w-full border-collapse">
                                    <thead className="bg-[#e4ebf5] dark:bg-[#111218] border-b border-slate-200/60 dark:border-white/[0.06] text-[10px] uppercase font-bold text-slate-500">
                                        <tr>
                                            <th className="px-3.5 py-2.5 text-left">Field</th>
                                            <th className="px-3.5 py-2.5 text-left">Extracted (Receipt)</th>
                                            <th className="px-3.5 py-2.5 text-left">Expected (PO Record)</th>
                                            <th className="px-3.5 py-2.5 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.06]">
                                        {/* Vendor */}
                                        <tr>
                                            <td className="px-3.5 py-2.5 font-bold text-slate-600 dark:text-slate-400">Vendor / Supplier</td>
                                            <td className="px-3.5 py-2.5 text-slate-900 dark:text-slate-100">
                                                {comparedFields?.vendor_match?.extracted || extractedData?.vendor_name || '---'}
                                            </td>
                                            <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">
                                                {po.supplier_name}
                                            </td>
                                            <td className="px-3.5 py-2.5 text-center">
                                                {comparedFields?.vendor_match?.matched ? (
                                                    <StatusBadge tone="emerald" size="xs">
                                                        Match ✓
                                                    </StatusBadge>
                                                ) : (
                                                    <StatusBadge tone="rose" size="xs">
                                                        Mismatch ✕
                                                    </StatusBadge>
                                                )}
                                            </td>
                                        </tr>

                                        {/* Amount */}
                                        <tr>
                                            <td className="px-3.5 py-2.5 font-bold text-slate-600 dark:text-slate-400">Total Amount</td>
                                            <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                                                ₱{(comparedFields?.amount_match?.extracted ?? extractedData?.total_amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-3.5 py-2.5 font-mono text-slate-600 dark:text-slate-400">
                                                ₱{po.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-3.5 py-2.5 text-center">
                                                {comparedFields?.amount_match?.matched ? (
                                                    <StatusBadge tone="emerald" size="xs">
                                                        Match ✓
                                                    </StatusBadge>
                                                ) : (
                                                    <StatusBadge tone="rose" size="xs">
                                                        Mismatch ✕
                                                    </StatusBadge>
                                                )}
                                            </td>
                                        </tr>

                                        {/* PO Reference */}
                                        <tr>
                                            <td className="px-3.5 py-2.5 font-bold text-slate-600 dark:text-slate-400">PO Number</td>
                                            <td className="px-3.5 py-2.5 font-mono text-slate-900 dark:text-slate-100">
                                                {comparedFields?.po_match?.extracted || extractedData?.po_reference || 'Not specified'}
                                            </td>
                                            <td className="px-3.5 py-2.5 font-mono text-slate-600 dark:text-slate-400">
                                                {po.po_number}
                                            </td>
                                            <td className="px-3.5 py-2.5 text-center">
                                                <StatusBadge tone="neutral" size="xs">
                                                    Ref
                                                </StatusBadge>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Admin Force Insert Section for Mismatches */}
                            {verificationState === 'mismatched' && isAdminOrManager && (
                                <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                                            <i className="fas fa-shield-halved text-pink-500"></i>
                                            <span>Authorize Administrative Force Insert</span>
                                        </div>
                                        {isAdmin ? (
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                Admin Authorized
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                                                <i className="fas fa-lock text-[9px]"></i> Admin Only
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        placeholder={isAdmin ? "Reason for manual approval (e.g. Authorized vendor fee variation)" : "Disabled for Manager role (Administrator access required)"}
                                        value={forceReason}
                                        disabled={!isAdmin || isForcing}
                                        onChange={(e) => setForceReason(e.target.value)}
                                        className={`w-full bg-[#e4ebf5] dark:bg-[#111218] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)] rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-pink-500 ${!isAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    />
                                    {!isAdmin && (
                                        <p className="text-[11px] text-amber-700 dark:text-amber-400/90 flex items-center gap-1.5 px-1 font-medium">
                                            <i className="fas fa-circle-info text-amber-500 text-xs shrink-0"></i>
                                            <span>Force insert is disabled for Manager role. Please contact an Administrator if this receipt requires manual override.</span>
                                        </p>
                                    )}
                                    <AppButton
                                        type="button"
                                        variant="danger"
                                        size="md"
                                        disabled={!isAdmin || isForcing}
                                        onClick={handleForceInsert}
                                        title={!isAdmin ? 'Administrative Force Insert is disabled for Manager role. Only Administrators can authorize override.' : undefined}
                                        className={`w-full ${isAdmin ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-500 cursor-not-allowed opacity-60'}`}
                                    >
                                        <i className={`fas ${isAdmin ? 'fa-shield-alt' : 'fa-lock'}`}></i>
                                        <span>{isForcing ? 'Authorizing...' : (!isAdmin ? 'Force Insert Disabled (Admin Only)' : 'Force Insert & Mark Paid')}</span>
                                    </AppButton>
                                </div>
                            )}

                            {/* Close / Re-upload actions */}
                            <div className="flex items-center justify-end gap-2.5 pt-2">
                                {verificationState === 'mismatched' && (
                                    <AppButton
                                        type="button"
                                        variant="neutral"
                                        size="sm"
                                        disabled={secondsRemaining > 0}
                                        onClick={() => {
                                            setVerificationState('upload');
                                            setFile(null);
                                            setPreviewUrl(null);
                                        }}
                                        title={secondsRemaining > 0 ? `Upload disabled for ${Math.floor(secondsRemaining / 60)}m ${secondsRemaining % 60}s` : undefined}
                                    >
                                        <i className={`fas ${secondsRemaining > 0 ? 'fa-lock text-rose-500 mr-1.5' : ''}`}></i>
                                        Upload Different File {secondsRemaining > 0 ? `(${Math.floor(secondsRemaining / 60)}m ${secondsRemaining % 60}s)` : ''}
                                    </AppButton>
                                )}
                                <AppButton
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    onClick={onClose}
                                >
                                    Done
                                </AppButton>
                            </div>
                        </div>
                    )}
                    </div>
                </div>
            </div>
        </Portal>
    );
}
