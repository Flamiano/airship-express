// app/(supplyChain)/components/modals/UploadReceiptModal.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { user } from '@/app/(supplyChain)/lib/services/Class/user';
import { AppButton } from '@/app/(supplyChain)/components/ui/AppButton';
import { StatusBadge } from '@/app/(supplyChain)/components/ui/StatusBadge';
import {
    uploadReceiptAndVerifyAction,
    forceInsertVerificationAction,
    getVerificationDetailsAction,
    ComparedFields,
    ExtractedReceiptJSON
} from '@/app/(supplyChain)/(pages)/purchase-orders/server/actions/ocr-verify';

export interface VerificationJob {
    verificationId: string;
    poId: string;
    poNumber: string;
    status: 'processing' | 'matched' | 'mismatched' | 'forced';
    comparedFields?: ComparedFields | null;
    extractedJson?: ExtractedReceiptJSON | null;
    timestamp: number;
}

interface UploadReceiptModalProps {
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
    onMinimize?: (job: VerificationJob | null) => void;
    onSuccess?: () => void;
}

export function UploadReceiptModal({
    isOpen,
    onClose,
    po,
    initialVerificationId,
    onMinimize,
    onSuccess,
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

    const fileInputRef = useRef<HTMLInputElement>(null);
    const currentUserRole = user.getRole();
    const isAdminOrManager = currentUserRole === 'Admin' || currentUserRole === 'Manager';

    const existingDbFileName = po?.document?.file_name || null;

    useEffect(() => {
        if (isOpen) {
            if (initialVerificationId) {
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
    }, [isOpen, initialVerificationId, po]);

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

        setFile(dropped);
        const url = URL.createObjectURL(dropped);
        setPreviewUrl(url);
    };

    const handleSubmitUpload = async () => {
        if (!file) {
            toast.warning('Please select a receipt file first');
            return;
        }

        setIsUploading(true);
        setVerificationState('verifying');

        // Convert file to Base64
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64Data = reader.result as string;

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
                        toast.success(`Receipt document successfully saved into Documents table.`);
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
                    toast.error(res.error || 'Verification process failed');
                    setVerificationState('upload');
                    onMinimize?.(null);
                }
            } catch (err: any) {
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

        if (!isAdminOrManager) {
            toast.error('Force insert requires Admin or Manager authorization');
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
        <div
            className="fixed inset-0 bg-slate-950/60 dark:bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-2xs shrink-0 ${
                            verificationState === 'matched'
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200 dark:border-emerald-800'
                                : verificationState === 'mismatched'
                                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 border border-amber-200 dark:border-amber-800'
                                    : 'bg-pink-50 dark:bg-pink-950/40 text-pink-600 border border-pink-100 dark:border-pink-900/40'
                        }`}>
                            <i className={`fas ${
                                verificationState === 'matched'
                                    ? 'fa-check'
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
                            <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between text-xs">
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

                            {/* Dropzone */}
                            <div
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-pink-500 dark:hover:border-pink-500 rounded-3xl p-8 text-center cursor-pointer bg-slate-50/40 dark:bg-slate-800/20 hover:bg-pink-50/20 transition-all space-y-3"
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept="image/*,application/pdf"
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
                                        <div className="w-14 h-14 rounded-2xl bg-pink-100/60 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 mx-auto flex items-center justify-center text-xl shadow-inner">
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
                                    disabled={!file || isUploading}
                                    onClick={handleSubmitUpload}
                                >
                                    <i className="fas fa-microchip text-xs"></i>
                                    <span>{initialVerificationId || po.verification ? 'Retry Run AI OCR' : 'Run AI OCR Verification'}</span>
                                </AppButton>
                            </div>
                        </div>
                    )}

                    {/* 2. VERIFYING STATE */}
                    {verificationState === 'verifying' && (
                        <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                            <div className="w-16 h-16 rounded-3xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 flex items-center justify-center text-2xl shadow-inner animate-pulse">
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
                            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden text-xs">
                                <table className="w-full border-collapse">
                                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-500">
                                        <tr>
                                            <th className="px-3.5 py-2.5 text-left">Field</th>
                                            <th className="px-3.5 py-2.5 text-left">Extracted (Receipt)</th>
                                            <th className="px-3.5 py-2.5 text-left">Expected (PO Record)</th>
                                            <th className="px-3.5 py-2.5 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
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
                                <div className="p-4 rounded-2xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                                        <i className="fas fa-shield-halved text-pink-500"></i>
                                        <span>Authorize Administrative Force Insert</span>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Reason for manual approval (e.g. Authorized vendor fee variation)"
                                        value={forceReason}
                                        onChange={(e) => setForceReason(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-pink-500"
                                    />
                                    <AppButton
                                        type="button"
                                        variant="danger"
                                        size="md"
                                        disabled={isForcing}
                                        onClick={handleForceInsert}
                                        className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                                    >
                                        <i className="fas fa-shield-alt"></i>
                                        <span>{isForcing ? 'Authorizing...' : 'Force Insert & Mark Paid'}</span>
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
                                        onClick={() => {
                                            setVerificationState('upload');
                                            setFile(null);
                                            setPreviewUrl(null);
                                        }}
                                    >
                                        Upload Different File
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
    );
}
