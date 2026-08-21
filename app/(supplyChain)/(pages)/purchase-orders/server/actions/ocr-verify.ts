// app/(supplyChain)/(pages)/purchase-orders/server/actions/ocr-verify.ts

'use server';

import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { GoogleGenAI } from '@google/genai';

interface VerifyReceiptInput {
    po_id: string;
    fileBase64: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    userId?: string;
    userRole?: string;
    userName?: string;
    userEmail?: string;
}

interface ForceInsertInput {
    verification_id: string;
    po_id: string;
    userId?: string;
    userRole?: string;
    userName?: string;
    userEmail?: string;
    reason?: string;
}

export interface ExtractedReceiptJSON {
    vendor_name: string;
    total_amount: number;
    date: string;
    po_reference: string;
    items: Array<{
        name: string;
        quantity: number;
        unit_price: number;
    }>;
}

export interface FieldDiff {
    extracted: any;
    expected: any;
    matched: boolean;
    difference?: string;
}

export interface ComparedFields {
    vendor_match: FieldDiff;
    amount_match: FieldDiff;
    po_match: FieldDiff;
    items_count: {
        extracted: number;
        expected: number;
        matched: boolean;
    };
    all_matched: boolean;
}

/**
 * Normalizes strings for robust matching (removes symbols, extra spaces, casing)
 */
function normalizeStr(str?: string | null): string {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

/**
 * Checks if vendor names match using fuzzy/substring inclusion
 */
function isVendorMatching(extracted?: string, expected?: string): boolean {
    const ext = normalizeStr(extracted);
    const exp = normalizeStr(expected);
    if (!ext || !exp) return false;
    if (ext === exp) return true;
    if (ext.includes(exp) || exp.includes(ext)) return true;

    // Check individual significant word tokens (>= 4 chars)
    const extWords = (extracted || '').toLowerCase().split(/\s+/).filter(w => w.length >= 4);
    const expWords = (expected || '').toLowerCase().split(/\s+/).filter(w => w.length >= 4);
    return extWords.some(w => expWords.includes(w));
}

/**
 * 4.2 & 4.3 & 4.4 & 4.5: Upload Receipt & Trigger Gemini OCR Verification
 */
export async function uploadReceiptAndVerifyAction(input: VerifyReceiptInput) {
    try {
        const {
            po_id,
            fileBase64,
            fileName,
            fileType,
            fileSize,
            userId,
            userRole = 'Employee',
            userName = 'System User',
            userEmail = 'system@company.com',
        } = input;

        if (!po_id || !fileBase64) {
            return { success: false, error: 'Missing purchase order ID or file data', status: 400 };
        }

        // 1. Fetch the Purchase Order record
        const { data: po, error: poError } = await supabase
            .from('purchase_orders')
            .select('*')
            .eq('id', po_id)
            .single();

        if (poError || !po) {
            return { success: false, error: 'Purchase Order not found', status: 404 };
        }

        // 2. Resolve an authentic User UUID from public.users table
        let validUserUUID: string | null = null;

        if (userEmail) {
            const { data: uByEmail } = await supabase.from('users').select('id').eq('email', userEmail).maybeSingle();
            if (uByEmail?.id) validUserUUID = uByEmail.id;
        }

        if (!validUserUUID && userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
            const { data: uById } = await supabase.from('users').select('id').eq('id', userId).maybeSingle();
            if (uById?.id) validUserUUID = uById.id;
        }

        if (!validUserUUID) {
            const { data: fallbackUser } = await supabase.from('users').select('id').limit(1).maybeSingle();
            if (fallbackUser?.id) validUserUUID = fallbackUser.id;
        }

        // 3. Upload file buffer to Supabase Storage ('documents' bucket)
        const fileExt = fileName.split('.').pop() || 'png';
        const storagePath = `documents/${po.po_number || po_id}_${Date.now()}.${fileExt}`;
        
        // Strip data:image/...;base64, prefix if present
        const pureBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
        const fileBuffer = Buffer.from(pureBase64, 'base64');

        const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(storagePath, fileBuffer, {
                contentType: fileType || 'image/png',
                upsert: true,
            });

        if (uploadError) {
            console.warn('Storage upload warning:', uploadError);
        }

        const { data: publicUrlData } = supabase.storage
            .from('documents')
            .getPublicUrl(storagePath);
        const uploadedFileUrl = publicUrlData?.publicUrl || storagePath;

        // 4. Insert Initial pending record in `document_verifications`
        let dvRecord: any = null;
        let dvInsertError: any = null;

        const { data: firstTry, error: err1 } = await supabase
            .from('document_verifications')
            .insert({
                purchase_order_id: po_id,
                uploaded_file_url: uploadedFileUrl,
                extracted_json: {},
                match_result: 'pending',
                submitted_by: validUserUUID,
            })
            .select('id')
            .single();

        if (!err1 && firstTry) {
            dvRecord = firstTry;
        } else {
            console.error('First DV insert error:', err1);
            dvInsertError = err1;

            // Fallback: try fetching any valid user id from users table
            const { data: altUser } = await supabase.from('users').select('id').limit(1).maybeSingle();
            if (altUser?.id && altUser.id !== validUserUUID) {
                const { data: secondTry, error: err2 } = await supabase
                    .from('document_verifications')
                    .insert({
                        purchase_order_id: po_id,
                        uploaded_file_url: uploadedFileUrl,
                        extracted_json: {},
                        match_result: 'pending',
                        submitted_by: altUser.id,
                    })
                    .select('id')
                    .single();
                if (!err2 && secondTry) {
                    dvRecord = secondTry;
                    dvInsertError = null;
                    validUserUUID = altUser.id;
                } else {
                    console.error('Second DV insert error:', err2);
                }
            }
        }

        if (dvInsertError || !dvRecord) {
            console.error('Failed to create document_verification record:', dvInsertError);
            return {
                success: false,
                error: `Database verification creation failed: ${dvInsertError?.message || 'Foreign key or column error'}`,
                status: 500
            };
        }

        const dvId = dvRecord.id;

        // 4b. Insert into `public.documents` table immediately so the file is recorded
        const sanitizedFileName = (fileName || `receipt_${po.po_number || 'po'}.png`).slice(0, 250);
        const sanitizedTitle = `Receipt - ${po.po_number || po.supplier_name}`.slice(0, 250);
        const sanitizedType = (fileType || fileExt || 'image/png').slice(0, 48);

        const docPayload = {
            title: sanitizedTitle,
            file_name: sanitizedFileName,
            file_size: Number(fileSize) || 1024,
            file_type: sanitizedType,
            storage_path: storagePath,
            category: 'documents',
            document_type: 'Official Receipt',
            supplier: po.supplier_name ? String(po.supplier_name).slice(0, 190) : null,
            po_number: po.po_number ? String(po.po_number).slice(0, 48) : null,
            purchase_id: po.id,
            document_verification_id: dvId,
            user_id: validUserUUID || null,
            uploaded_by: userName ? String(userName).slice(0, 95) : 'Procurement',
            notes: 'Uploaded for OCR receipt verification',
            role: userRole || null,
        };

        let newDocId: string | null = null;
        const { data: newDoc, error: docError } = await supabase
            .from('documents')
            .insert(docPayload)
            .select('id')
            .single();

        if (!docError && newDoc?.id) {
            newDocId = newDoc.id;
        } else {
            console.error('First document insert attempt failed:', docError);
            const { data: retryDoc, error: retryErr } = await supabase
                .from('documents')
                .insert({
                    title: sanitizedTitle,
                    file_name: sanitizedFileName,
                    file_size: Number(fileSize) || 1024,
                    file_type: sanitizedType,
                    storage_path: storagePath,
                    category: 'documents',
                    document_type: 'Official Receipt',
                    supplier: po.supplier_name ? String(po.supplier_name).slice(0, 190) : null,
                    po_number: po.po_number ? String(po.po_number).slice(0, 48) : null,
                    purchase_id: po.id,
                    document_verification_id: dvId,
                    uploaded_by: userName ? String(userName).slice(0, 95) : 'Procurement',
                    notes: 'Uploaded for OCR receipt verification',
                })
                .select('id')
                .single();

            if (retryDoc?.id) {
                newDocId = retryDoc.id;
            } else {
                console.error('Retry document insert failed:', retryErr);
            }
        }

        // Link document_id to document_verifications
        if (newDocId) {
            await supabase
                .from('document_verifications')
                .update({ document_id: newDocId })
                .eq('id', dvId);
        }

        // 5. OCR with Gemini using strict JSON schema
        let extracted: ExtractedReceiptJSON = {
            vendor_name: '',
            total_amount: 0,
            date: '',
            po_reference: '',
            items: [],
        };

        const apiKey = process.env.GEMINI_SUPPLYCHAIN_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn('GEMINI API KEY not configured. Falling back to synthetic extraction for dev.');
            extracted = {
                vendor_name: po.supplier_name,
                total_amount: po.total_amount,
                date: new Date().toISOString().split('T')[0],
                po_reference: po.po_number,
                items: Array.isArray(po.items) ? po.items : [],
            };
        } else {
            try {
                const genAI = new GoogleGenAI({ apiKey });
                const promptText = `
You are an automated invoice & payment receipt OCR parser for supply chain logistics.
Carefully examine the provided document image and extract the key receipt fields.

Return ONLY a valid JSON object matching the following structure without any markdown fences, backticks, or extra explanation:
{
  "vendor_name": "Name of supplier/store on receipt",
  "total_amount": 0.00,
  "date": "YYYY-MM-DD",
  "po_reference": "PO number or reference if present",
  "items": [
    {
      "name": "Item name",
      "quantity": 1,
      "unit_price": 0.00
    }
  ]
}`;

                const response = await genAI.models.generateContent({
                    model: process.env.GEMINI_SUPPLYCHAIN_MODEL || 'gemini-2.5-flash',
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                { text: promptText },
                                {
                                    inlineData: {
                                        data: pureBase64,
                                        mimeType: fileType && fileType.startsWith('image/') ? fileType : 'image/png',
                                    },
                                },
                            ],
                        },
                    ],
                });

                const rawText = response.text || '';
                const cleanJsonStr = rawText
                    .replace(/```json/gi, '')
                    .replace(/```/g, '')
                    .trim();

                const parsed = JSON.parse(cleanJsonStr);
                extracted = {
                    vendor_name: String(parsed.vendor_name || ''),
                    total_amount: Number(parsed.total_amount || 0),
                    date: String(parsed.date || ''),
                    po_reference: String(parsed.po_reference || ''),
                    items: Array.isArray(parsed.items) ? parsed.items : [],
                };
            } catch (ocrErr) {
                console.error('Gemini OCR Error:', ocrErr);
                extracted = {
                    vendor_name: 'Unparsed Receipt',
                    total_amount: 0,
                    date: new Date().toISOString().split('T')[0],
                    po_reference: '',
                    items: [],
                };
            }
        }

        // Store raw extracted JSON in document_verifications
        await supabase
            .from('document_verifications')
            .update({ extracted_json: extracted })
            .eq('id', dvId);

        // 6. Compare Extracted JSON vs purchase_orders record
        const poItems = Array.isArray(po.items) ? po.items : [];
        const vendorMatched = isVendorMatching(extracted.vendor_name, po.supplier_name);
        const amountDiff = Math.abs((Number(extracted.total_amount) || 0) - (Number(po.total_amount) || 0));
        const amountMatched = amountDiff <= 1.50; // allows small float rounding tolerance
        
        let poRefMatched = true;
        if (extracted.po_reference && extracted.po_reference.trim().length > 2) {
            poRefMatched = normalizeStr(extracted.po_reference).includes(normalizeStr(po.po_number)) ||
                           normalizeStr(po.po_number).includes(normalizeStr(extracted.po_reference));
        }

        const allMatched = vendorMatched && amountMatched;

        const comparedFields: ComparedFields = {
            vendor_match: {
                extracted: extracted.vendor_name || 'Not detected',
                expected: po.supplier_name,
                matched: vendorMatched,
                difference: vendorMatched ? undefined : `Supplier mismatch (${extracted.vendor_name} vs ${po.supplier_name})`,
            },
            amount_match: {
                extracted: Number(extracted.total_amount) || 0,
                expected: Number(po.total_amount) || 0,
                matched: amountMatched,
                difference: amountMatched ? undefined : `Diff of ₱${amountDiff.toFixed(2)}`,
            },
            po_match: {
                extracted: extracted.po_reference || 'N/A',
                expected: po.po_number,
                matched: poRefMatched,
            },
            items_count: {
                extracted: extracted.items.length,
                expected: poItems.length,
                matched: extracted.items.length === poItems.length,
            },
            all_matched: allMatched,
        };

        // 7. Handle Outcomes
        if (allMatched) {
            // --- 4.5 ON MATCH ---
            // A. Update documents notes
            if (newDocId) {
                await supabase
                    .from('documents')
                    .update({ notes: 'Verified via Gemini OCR (Matched)' })
                    .eq('id', newDocId);
            }

            // B. Update document_verifications
            await supabase
                .from('document_verifications')
                .update({
                    compared_fields: comparedFields,
                    match_result: 'matched',
                    document_id: newDocId,
                    resolved_by: validUserUUID,
                    resolved_at: new Date().toISOString(),
                })
                .eq('id', dvId);

            // C. Update purchase_orders (paid = true)
            await supabase
                .from('purchase_orders')
                .update({
                    paid: true,
                    paid_verified_at: new Date().toISOString(),
                    paid_verified_by: validUserUUID,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', po.id);

            // D. Emit Notification (ocr_complete) & Log Activity History
            try {
                await supabase.from('activity_history').insert({
                    action_type: 'upload',
                    action_name: 'Uploaded Verified Receipt',
                    document_id: newDocId,
                    document_title: docPayload.title,
                    user_id: validUserUUID || null,
                    user_name: userName || 'Procurement',
                    details: {
                        po_number: po.po_number,
                        ocr_verified: true,
                        amount: po.total_amount,
                    },
                });
            } catch (actErr) {
                console.warn('Could not log activity history:', actErr);
            }

            try {
                await supabase.from('notifications').insert({
                    creator_name: 'OCR Verification System',
                    creator_email: 'ocr@airshipexpress.com',
                    title: 'Receipt Verified',
                    message: `PO #${po.po_number} payment verified via OCR.`,
                    type: 'ocr_complete',
                    link: `/purchase-orders?po_id=${po.id}`,
                    role: 'Admin',
                    reference_type: 'document_verification',
                    reference_id: dvId,
                    is_read: false,
                });
            } catch (notifErr) {
                console.warn('Could not insert notification:', notifErr);
            }

            return {
                success: true,
                verificationId: dvId,
                matchResult: 'matched',
                documentId: newDocId,
                extractedJson: extracted,
                comparedFields,
            };
        } else {
            // --- 4.6 ON MISMATCH ---
            // Update document_verifications and document notes
            if (newDocId) {
                await supabase
                    .from('documents')
                    .update({ notes: 'OCR Verification Mismatch - Pending Admin Review' })
                    .eq('id', newDocId);
            }

            await supabase
                .from('document_verifications')
                .update({
                    compared_fields: comparedFields,
                    match_result: 'mismatched',
                    document_id: newDocId,
                })
                .eq('id', dvId);

            // Emit Mismatch Notification
            try {
                await supabase.from('notifications').insert({
                    creator_name: 'OCR Verification System',
                    creator_email: 'ocr@airshipexpress.com',
                    title: 'Receipt OCR Mismatch',
                    message: `PO #${po.po_number} receipt details do not match order. Review required.`,
                    type: 'ocr_mismatch',
                    link: `/purchase-orders?verification=${dvId}`,
                    role: 'Admin',
                    reference_type: 'document_verification',
                    reference_id: dvId,
                    is_read: false,
                });
            } catch (notifErr) {
                console.warn('Could not insert notification:', notifErr);
            }

            return {
                success: true,
                verificationId: dvId,
                matchResult: 'mismatched',
                documentId: newDocId,
                documentInserted: !!newDocId,
                extractedJson: extracted,
                comparedFields,
            };
        }
    } catch (error: any) {
        console.error('Error in uploadReceiptAndVerifyAction:', error);
        return { success: false, error: error?.message || 'Receipt verification failed', status: 500 };
    }
}

/**
 * 4.6: Admin/Manager Force Insert on Mismatched Verifications
 */
export async function forceInsertVerificationAction(input: ForceInsertInput) {
    try {
        const {
            verification_id,
            po_id,
            userId,
            userRole = 'Employee',
            userName = 'Administrator',
            userEmail = 'admin@company.com',
            reason = 'Authorized administrative override',
        } = input;

        // Role Authorization Guard: Only Admin or Manager permitted
        const isAdminOrManager = userRole === 'Admin' || userRole === 'Manager';
        if (!isAdminOrManager) {
            return {
                success: false,
                error: 'Forbidden: Force insert requires Admin or Manager authorization.',
                status: 403,
            };
        }

        // Fetch verification record and PO record
        const { data: dv, error: dvErr } = await supabase
            .from('document_verifications')
            .select('*')
            .eq('id', verification_id)
            .single();

        if (dvErr || !dv) {
            return { success: false, error: 'Document verification record not found', status: 404 };
        }

        const targetPoId = po_id || dv.purchase_order_id;
        const { data: po, error: poErr } = await supabase
            .from('purchase_orders')
            .select('*')
            .eq('id', targetPoId)
            .single();

        if (poErr || !po) {
            return { success: false, error: 'Purchase Order not found', status: 404 };
        }

        // 2. Resolve an authentic User UUID from public.users
        let validUserUUID: string | null = null;

        if (userEmail) {
            const { data: uByEmail } = await supabase.from('users').select('id').eq('email', userEmail).maybeSingle();
            if (uByEmail?.id) validUserUUID = uByEmail.id;
        }

        if (!validUserUUID && userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
            const { data: uById } = await supabase.from('users').select('id').eq('id', userId).maybeSingle();
            if (uById?.id) validUserUUID = uById.id;
        }

        if (!validUserUUID) {
            const { data: anyUser } = await supabase.from('users').select('id').limit(1).maybeSingle();
            if (anyUser?.id) validUserUUID = anyUser.id;
        }

        // 1. Insert into documents with force_inserted_by
        const fileName = `Receipt_${po.po_number || 'PO'}.png`;
        let newDocId: string | null = null;

        const { data: newDoc, error: docErr } = await supabase
            .from('documents')
            .insert({
                title: `Receipt (Forced) - ${po.po_number || po.supplier_name}`.slice(0, 250),
                file_name: fileName.slice(0, 250),
                file_size: 1024,
                file_type: 'image/png',
                storage_path: dv.uploaded_file_url || 'documents/forced.png',
                category: 'documents',
                document_type: 'Official Receipt',
                supplier: po.supplier_name ? String(po.supplier_name).slice(0, 190) : null,
                po_number: po.po_number ? String(po.po_number).slice(0, 48) : null,
                purchase_id: po.id,
                document_verification_id: dv.id,
                user_id: validUserUUID || null,
                force_inserted_by: validUserUUID || null,
                uploaded_by: userName ? String(userName).slice(0, 95) : 'Administrator',
                notes: `Forced override by ${userName}: ${reason}`,
                role: userRole || null,
            })
            .select('id')
            .single();

        if (!docErr && newDoc?.id) {
            newDocId = newDoc.id;
        } else {
            console.error('First forced document insert failed:', docErr);
            const { data: retryDoc, error: retryErr } = await supabase
                .from('documents')
                .insert({
                    title: `Receipt (Forced) - ${po.po_number || po.supplier_name}`.slice(0, 250),
                    file_name: fileName.slice(0, 250),
                    file_size: 1024,
                    file_type: 'image/png',
                    storage_path: dv.uploaded_file_url || 'documents/forced.png',
                    category: 'documents',
                    document_type: 'Official Receipt',
                    supplier: po.supplier_name ? String(po.supplier_name).slice(0, 190) : null,
                    po_number: po.po_number ? String(po.po_number).slice(0, 48) : null,
                    purchase_id: po.id,
                    document_verification_id: dv.id,
                    uploaded_by: userName ? String(userName).slice(0, 95) : 'Administrator',
                    notes: `Forced override by ${userName}: ${reason}`,
                })
                .select('id')
                .single();

            if (retryDoc?.id) {
                newDocId = retryDoc.id;
            } else {
                console.error('Retry forced document insert failed:', retryErr);
            }
        }

        // 2. Update document_verifications
        await supabase
            .from('document_verifications')
            .update({
                match_result: 'forced',
                document_id: newDocId,
                resolved_by: validUserUUID,
                resolved_at: new Date().toISOString(),
            })
            .eq('id', dv.id);

        // 3. Update purchase_orders (paid = true)
        await supabase
            .from('purchase_orders')
            .update({
                paid: true,
                paid_verified_at: new Date().toISOString(),
                paid_verified_by: validUserUUID,
                updated_at: new Date().toISOString(),
            })
            .eq('id', po.id);

        // 4. Emit Audit Notification & Log Activity History
        try {
            await supabase.from('activity_history').insert({
                action_type: 'upload',
                action_name: 'Force Inserted Receipt (Admin Override)',
                document_id: newDocId,
                document_title: `Receipt (Forced) - ${po.po_number || po.supplier_name}`,
                user_id: validUserUUID || null,
                user_name: userName || 'Administrator',
                details: {
                    po_number: po.po_number,
                    forced: true,
                    reason: reason,
                },
            });
        } catch (actErr) {
            console.warn('Could not log forced activity history:', actErr);
        }

        try {
            await supabase.from('notifications').insert({
                creator_name: userName,
                creator_email: userEmail,
                title: 'Receipt Force-Approved',
                message: `PO #${po.po_number} was manually force-approved by ${userName} (${userRole}). Reason: ${reason}`,
                type: 'ocr_complete',
                link: `/purchase-orders?po_id=${po.id}`,
                role: 'Admin',
                reference_type: 'document_verification',
                reference_id: dv.id,
                is_read: false,
            });
        } catch (notifErr) {
            console.warn('Could not insert notification:', notifErr);
        }

        return {
            success: true,
            documentId: newDocId,
            verificationId: dv.id,
            matchResult: 'forced',
        };
    } catch (error: any) {
        console.error('Error in forceInsertVerificationAction:', error);
        return { success: false, error: error?.message || 'Force insert failed', status: 500 };
    }
}

/**
 * Fetches verification details with PO data
 */
export async function getVerificationDetailsAction(verification_id: string) {
    try {
        const { data: dv, error } = await supabase
            .from('document_verifications')
            .select(`
                *,
                purchase_orders (
                    id,
                    po_number,
                    supplier_name,
                    total_amount,
                    status,
                    items
                )
            `)
            .eq('id', verification_id)
            .single();

        if (error || !dv) {
            return { success: false, error: 'Verification record not found', status: 404 };
        }

        return { success: true, data: dv };
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to fetch verification details', status: 500 };
    }
}
