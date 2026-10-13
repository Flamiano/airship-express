// modal for attaching a file to an existing pending document with Gemini OCR check
'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Document } from '../../types';
import { formatFileSize } from '../../utils/formatters';
import { AppButton } from '../../../../components/ui/AppButton';
import Portal from '../../../../components/client/Portal';
import { toast } from 'sonner';
import { findSimilarExtractedDocument } from '../../utils/textSimilarity';

interface DocumentAttachFileModalProps {
    isOpen: boolean;
    document: Document | null;
    userRole: string;
    onClose: () => void;
    onAttachSuccess: () => Promise<void>;
}

export function DocumentAttachFileModal({
    isOpen,
    document: targetDoc,
    userRole,
    onClose,
    onAttachSuccess,
}: DocumentAttachFileModalProps) {
    const router = useRouter();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isAttaching, setIsAttaching] = useState(false);
    const [ocrWarning, setOcrWarning] = useState<string | null>(null);
    const [overrideAllowed, setOverrideAllowed] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    if (!isOpen || !targetDoc) return null;

    const isPrivileged = ['Executive', 'Admin'].includes(userRole);

    const handleFileSelect = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        setSelectedFile(file);
        setOcrWarning(null);
        setOverrideAllowed(false);
    };

    const handleAttach = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) {
            toast.warning('Please select a file to attach.');
            return;
        }

        try {
            setIsVerifying(true);
            const toastId = toast.loading('Running Gemini OCR document validation...');

            // Duplicate check against existing documents by filename & size
            const { supabase } = await import('../../../../lib/services/client/supabase');
            const { data: existingDocs } = await supabase
                .from('supplier_documents')
                .select('id, file_name, file_size')
                .ilike('file_name', selectedFile.name)
                .eq('file_size', selectedFile.size)
                .neq('id', targetDoc.id);

            if (existingDocs && existingDocs.length > 0) {
                setIsVerifying(false);
                toast.info(`Document "${selectedFile.name}" has already been uploaded previously.`, { id: toastId, duration: 5000 });
                return;
            }

            // Convert file to base64
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
            });
            reader.readAsDataURL(selectedFile);
            const base64 = await base64Promise;

            // Call verify OCR API
            const ocrRes = await fetch('/ai/api/verify-document-ocr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileBase64: base64,
                    fileName: selectedFile.name,
                    fileSize: selectedFile.size,
                    fileType: selectedFile.type,
                    userRole: userRole,
                    excludeDocId: targetDoc.id,
                }),
            });

            const ocrData = await ocrRes.json();
            setIsVerifying(false);

            if (ocrData.success && ocrData.is_in_trash) {
                const searchQ = ocrData.search_query || ocrData.trash_match?.file_name || ocrData.trash_match?.title || selectedFile.name;
                toast.warning(
                    `file is already in trash ask your manager to restore it to avoid duplication or see if you can restore it`,
                    {
                        id: toastId,
                        duration: 12000,
                        action: {
                            label: 'View in Trash',
                            onClick: () => {
                                router.push(`/trash?tab=documents&q=${encodeURIComponent(searchQ)}`);
                            },
                        },
                    }
                );
                return;
            }

            if (ocrData.success && ocrData.is_duplicate) {
                const matchedName = ocrData.duplicate_match?.matchedDoc?.title || ocrData.duplicate_match?.matchedDoc?.file_name || 'existing document';
                toast.info(
                    `Duplicate Blocked: "${selectedFile.name}" has already been uploaded previously (matches "${matchedName}").`,
                    { id: toastId, duration: 6000 }
                );
                return;
            }

            // Proceed without rejecting out-of-scope media, allowing user to upload any photo or document

            // Check extracted content similarity against trash archive and existing active documents
            const ocrTextToCompare = ocrData?.extracted_text || ocrData?.extracted?.text || ocrData?.photo_description;
            if (ocrTextToCompare || selectedFile) {
                try {
                    // Check trash archive
                    const { data: existingTrashDocs } = await supabase
                        .from('documents_archive')
                        .select('id, title, file_name, file_size, supplier, po_number, extracted')
                        .order('deleted_at', { ascending: false })
                        .limit(150);

                    if (existingTrashDocs && existingTrashDocs.length > 0) {
                        const trashMatch = findSimilarExtractedDocument(
                            {
                                text: ocrData?.extracted?.text || ocrData?.extracted_text || null,
                                description: ocrData?.extracted?.description || ocrData?.photo_description || null,
                                summary: ocrData?.extracted?.summary || ocrData?.summary || null,
                                po_number: ocrData?.extracted?.po_number || ocrData?.extracted_po_number || null,
                                file_name: selectedFile.name,
                                file_size: selectedFile.size,
                            },
                            existingTrashDocs
                        );

                        if (trashMatch && trashMatch.isSimilar) {
                            const searchQ = trashMatch.matchedDoc.file_name || trashMatch.matchedDoc.title || selectedFile.name;
                            toast.warning(
                                `file is already in trash ask your manager to restore it to avoid duplication or see if you can restore it`,
                                {
                                    id: toastId,
                                    duration: 12000,
                                    action: {
                                        label: 'View in Trash',
                                        onClick: () => {
                                            router.push(`/trash?tab=documents&q=${encodeURIComponent(searchQ)}`);
                                        },
                                    },
                                }
                            );
                            return;
                        }
                    }

                    // Check active documents
                    const { data: existingExtractedDocs } = await supabase
                        .from('supplier_documents')
                        .select('id, title, file_name, file_size, supplier, po_number, extracted')
                        .neq('id', targetDoc.id)
                        .order('created_at', { ascending: false })
                        .limit(250);

                    if (existingExtractedDocs && existingExtractedDocs.length > 0) {
                        const simMatch = findSimilarExtractedDocument(
                            {
                                text: ocrData?.extracted?.text || ocrData?.extracted_text || null,
                                description: ocrData?.extracted?.description || ocrData?.photo_description || null,
                                summary: ocrData?.extracted?.summary || ocrData?.summary || null,
                                po_number: ocrData?.extracted?.po_number || ocrData?.extracted_po_number || null,
                                file_name: selectedFile.name,
                                file_size: selectedFile.size,
                            },
                            existingExtractedDocs,
                            targetDoc.id
                        );
                        if (simMatch && simMatch.isSimilar) {
                            toast.info(
                                `Document "${selectedFile.name}" was already uploaded previously (similar content to "${simMatch.matchedDoc.title || simMatch.matchedDoc.file_name}").`,
                                { id: toastId, duration: 6000 }
                            );
                            return;
                        }
                    }
                } catch (simErr) {
                    console.warn('Text similarity check skipped in attachment:', simErr);
                }
            }

            // Proceed with upload
            await executeAttachment(toastId, false, ocrData?.extracted);
        } catch (err: any) {
            console.error('OCR Verification error:', err);
            setIsVerifying(false);
            toast.error(err.message || 'Failed to verify file with Gemini OCR.');
        }
    };

    const handleForceAttach = async () => {
        const toastId = toast.loading('Uploading file with Admin override...');
        await executeAttachment(toastId, true, {
            text: null,
            description: `Document attached via Admin override: ${selectedFile?.name}`,
            summary: `Admin Override Attachment: ${selectedFile?.name}`,
            visual_objects: [],
            extracted_at: new Date().toISOString(),
        });
    };

    const executeAttachment = async (toastId: string | number, isForce: boolean, extractedData?: any) => {
        if (!selectedFile) return;
        setIsAttaching(true);

        try {
            const { supabase } = await import('../../../../lib/services/client/supabase');

            const fileExt = selectedFile.name.split('.').pop() || 'png';
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
            const filePath = `documents/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, selectedFile, {
                    cacheControl: '3600',
                    upsert: true,
                });

            const { data: publicUrlData } = supabase.storage
                .from('documents')
                .getPublicUrl(filePath);
            const filePublicUrl = publicUrlData?.publicUrl || null;

            // Update document row
            const updatePayload: any = {
                file_name: selectedFile.name,
                file_size: selectedFile.size,
                file_type: selectedFile.type || fileExt,
                storage_path: filePath,
                file_url: filePublicUrl,
                updated_at: new Date().toISOString(),
            };

            if (extractedData) {
                updatePayload.extracted = extractedData;
            }

            if (isForce) {
                const { data: { user: authUser } } = await supabase.auth.getUser();
                updatePayload.force_inserted_by = authUser?.id || null;
            }

            const { error: updateError } = await supabase
                .from('supplier_documents')
                .update(updatePayload)
                .eq('id', targetDoc.id);

            if (updateError) throw updateError;

            // Mark previous missing file alerts as read and insert resolution notification
            try {
                const { data: { user: authUser } } = await supabase.auth.getUser();

                // 1. Mark existing pending notifications for this document as read
                await supabase
                    .from('notifications')
                    .update({ is_read: true, read_at: new Date().toISOString() })
                    .eq('reference_id', targetDoc.id);

                // 2. Insert confirmation notification
                const notifData: any = {
                    creator_name: targetDoc.uploaded_by || 'System',
                    creator_email: authUser?.email || 'system@airshipexpress.ph',
                    title: `File Attached: "${targetDoc.title}"`,
                    message: `Attachment "${selectedFile.name}" has been successfully added to document "${targetDoc.title}".`,
                    type: 'info',
                    link: '/documents',
                    role: 'All',
                    reference_type: 'document_attach',
                    reference_id: targetDoc.id,
                    is_read: false,
                };

                if (authUser?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authUser.id)) {
                    notifData.user_id = authUser.id;
                }

                const { error: notifErr } = await supabase
                    .from('notifications')
                    .insert(notifData);

                if (notifErr && notifData.user_id) {
                    delete notifData.user_id;
                    await supabase.from('notifications').insert(notifData);
                }
            } catch (notifErr) {
                console.warn('Could not update/insert notification on attach:', notifErr);
            }

            toast.success(`File "${selectedFile.name}" attached successfully!`, { id: toastId });
            onClose();
            await onAttachSuccess();
        } catch (err: any) {
            console.error('Attachment error:', err);
            toast.error(err.message || 'Failed to attach file to document.', { id: toastId });
        } finally {
            setIsAttaching(false);
        }
    };

    return (
        <Portal>
            <div className="fixed inset-0 z-[99999] bg-slate-950/60 dark:bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
                <div className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] border border-white/90 dark:border-white/[0.08] overflow-hidden animate-in zoom-in-95 duration-200">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/50 dark:bg-[#14151e]/50">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] flex items-center justify-center shrink-0 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] ${(isVerifying || isAttaching) ? 'text-pink-600 dark:text-pink-400 animate-pulse' : 'text-pink-500 dark:text-pink-400'}`}>
                                <i className={`fas ${(isVerifying || isAttaching) ? 'fa-spinner fa-spin' : 'fa-paperclip'} text-sm`}></i>
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                                    <span>Attach File to Document</span>
                                    {(isVerifying || isAttaching) && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 animate-pulse">
                                            {isVerifying ? 'Verifying...' : 'Attaching...'}
                                        </span>
                                    )}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                    Upload official document or receipt file with Gemini OCR verification
                                </p>
                            </div>
                        </div>
                        <AppButton type="button" variant="neutral" size="icon-sm" onClick={onClose} disabled={isVerifying || isAttaching} aria-label="Close modal">
                            <i className="fas fa-times text-xs"></i>
                        </AppButton>
                    </div>

                    {/* Content */}
                    <form onSubmit={handleAttach} className="flex-1 overflow-y-auto p-6 space-y-4">
                        
                        {/* Target Document Info Box */}
                        <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-1.5 text-xs">
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-900 dark:text-white text-sm">{targetDoc.title}</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-pink-500/10 text-pink-600 dark:text-pink-400 font-bold border border-pink-500/20">
                                    {targetDoc.document_type}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 text-[11px] flex-wrap">
                                {targetDoc.supplier && <span>Supplier: <strong className="text-slate-700 dark:text-slate-300">{targetDoc.supplier}</strong></span>}
                                {targetDoc.po_number && <span>PO: <strong className="text-slate-700 dark:text-slate-300">{targetDoc.po_number}</strong></span>}
                                {targetDoc.Price && <span>Price: <strong className="text-pink-600 dark:text-pink-400">₱{targetDoc.Price}</strong></span>}
                            </div>
                        </div>

                        {/* Loading Banner */}
                        {(isVerifying || isAttaching) && (
                            <div className="p-3.5 rounded-2xl bg-pink-50 dark:bg-pink-950/30 border border-pink-300 dark:border-pink-800/60 text-xs space-y-2 animate-in fade-in duration-200">
                                <div className="flex items-center gap-2 font-bold text-pink-600 dark:text-pink-400">
                                    <i className="fas fa-circle-notch fa-spin text-sm"></i>
                                    <span>{isVerifying ? 'Running AI OCR Verification on selected file...' : 'Attaching & saving file...'}</span>
                                </div>
                                <div className="w-full bg-pink-100/80 dark:bg-pink-950/60 rounded-full h-2 overflow-hidden shadow-inner border border-pink-200/60 dark:border-pink-900/40">
                                    <div className="bg-pink-600 dark:bg-pink-500 h-2 rounded-full w-3/4 animate-pulse"></div>
                                </div>
                            </div>
                        )}

                        {/* OCR Warning Alert (for Admin/Executive) */}
                        {ocrWarning && overrideAllowed && (
                            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs space-y-2">
                                <div className="flex items-center gap-2 font-bold">
                                    <i className="fas fa-triangle-exclamation text-amber-500"></i>
                                    <span>AI OCR Validation Warning</span>
                                </div>
                                <p className="leading-relaxed text-[11px]">{ocrWarning}</p>
                                <div className="pt-2 flex justify-end">
                                    <AppButton
                                        type="button"
                                        variant="primary"
                                        size="xs"
                                        onClick={handleForceAttach}
                                        disabled={isAttaching}
                                        loading={isAttaching}
                                    >
                                        <i className="fas fa-shield-halved text-xs"></i>
                                        <span>Confirm Admin Override &amp; Attach</span>
                                    </AppButton>
                                </div>
                            </div>
                        )}

                        {/* Dropzone */}
                        <div
                            className={`border-2 border-dashed border-slate-300 dark:border-white/10 rounded-2xl p-6 text-center transition-all bg-[#ebf0f7] dark:bg-[#14151e] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] ${
                                (isVerifying || isAttaching)
                                    ? 'opacity-60 cursor-not-allowed pointer-events-none'
                                    : 'hover:border-pink-400 dark:hover:border-pink-500/60 cursor-pointer'
                            }`}
                            onClick={() => {
                                if (isVerifying || isAttaching) return;
                                fileInputRef.current?.click();
                            }}
                            onDragOver={(e) => {
                                if (isVerifying || isAttaching) return;
                                e.preventDefault();
                                e.currentTarget.classList.add('border-pink-400', 'bg-pink-500/5');
                            }}
                            onDragLeave={(e) => {
                                if (isVerifying || isAttaching) return;
                                e.currentTarget.classList.remove('border-pink-400', 'bg-pink-500/5');
                            }}
                            onDrop={(e) => {
                                if (isVerifying || isAttaching) return;
                                e.preventDefault();
                                e.currentTarget.classList.remove('border-pink-400', 'bg-pink-500/5');
                                handleFileSelect(e.dataTransfer.files);
                            }}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                disabled={isVerifying || isAttaching}
                                className="hidden"
                                accept=".pdf,.jpg,.jpeg,.png,.heic,.doc,.docx,.xls,.xlsx"
                                onChange={(e) => handleFileSelect(e.target.files)}
                            />
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-12 h-12 rounded-2xl bg-[#f0f3f8] dark:bg-[#191a24] text-pink-500 dark:text-pink-400 flex items-center justify-center mb-1 border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)]">
                                    <i className={`fas ${(isVerifying || isAttaching) ? 'fa-spinner fa-spin' : 'fa-file-arrow-up'} text-xl`}></i>
                                </div>
                                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    {selectedFile ? selectedFile.name : (
                                        <>Select file or <span className="text-pink-600 dark:text-pink-400 underline">browse</span></>
                                    )}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                    {selectedFile ? `(${formatFileSize(selectedFile.size)})` : 'PDF, JPG, PNG, HEIC, Word, Excel (Max 10MB)'}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200/60 dark:border-white/[0.06]">
                            <AppButton type="button" variant="neutral" size="md" onClick={onClose} disabled={isVerifying || isAttaching}>
                                Cancel
                            </AppButton>
                            {!ocrWarning && (
                                <AppButton
                                    type="submit"
                                    variant="primary"
                                    size="md"
                                    disabled={!selectedFile || isVerifying || isAttaching}
                                    loading={isVerifying || isAttaching}
                                >
                                    <i className="fas fa-wand-magic-sparkles text-xs"></i>
                                    <span>{isVerifying ? 'Verifying OCR...' : isAttaching ? 'Attaching...' : 'Verify & Attach File'}</span>
                                </AppButton>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </Portal>
    );
}
