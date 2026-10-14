import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

const apiKey = process.env.GEMINI_SUPPLYCHAIN_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_URL || "";
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_ANON_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

const FALLBACK_MODELS = [
    process.env.GEMINI_SUPPLYCHAIN_MODEL || "gemini-3.5-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-2.5-flash",
];

async function generateWithFallback(genAI: any, contents: any[]) {
    let lastError: any = null;
    for (const model of FALLBACK_MODELS) {
        try {
            const response = await genAI.models.generateContent({
                model,
                contents,
            });
            if (response && response.text) {
                return response;
            }
        } catch (err: any) {
            console.warn(`[analyze-document] Model ${model} failed, trying next fallback:`, err?.message || err);
            lastError = err;
        }
    }
    throw lastError || new Error("All Gemini models unavailable");
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            file,
            userPrompt = "",
            mode = "normal",
            role = "User",
            userId = null,
            userName = "User",
            userEmail = ""
        } = body;

        const normalizedRole = (role || "").toLowerCase().trim();
        const isSearchDocMode = mode === "search_document";

        const isManagementRole = /^(admin|super\s*admin|manager|executive|supervisor)$/i.test(normalizedRole);
        const isStaffRole = !isManagementRole; // Staff, Operator, Employee, etc. only see what they inserted

        if (!file || !file.base64) {
            return NextResponse.json(
                { success: false, error: "No document or picture provided." },
                { status: 400 }
            );
        }

        // Clean base64 data
        let pureBase64 = file.base64;
        if (pureBase64.includes(",")) {
            pureBase64 = pureBase64.split(",")[1];
        }

        const mimeType = file.type || "image/png";
        const fileName = file.name || "uploaded_document";

        if (!apiKey) {
            return NextResponse.json({
                success: false,
                error: "Gemini API key is not configured.",
            }, { status: 500 });
        }

        const genAI = new GoogleGenAI({ apiKey });

        const promptText = isSearchDocMode ? `
You are AIRY, the Google Lens Vision & Logistics Intelligence Engine for Airship Express.
The user uploaded an image/file named: "${fileName}" to perform GOOGLE LENS DOCUMENT SEARCH across all system document records.
User message/prompt: "${userPrompt || "Search and identify matching supply chain records for this document/picture like Google Lens."}".

Your tasks:
1. DEEP VISUAL & OCR INSPECTION (Google Lens Style):
   - Extract ALL readable text, table rows, totals, reference numbers, dates, addresses, barcodes, and tracking labels ("ocr_text").
   - If there is NO text or this is just a photograph (e.g. warehouse facility, forklift, damaged package, fleet truck, equipment, badges, pallet), provide a comprehensive, detailed visual description ("visual_description") of what is seen in the photo: physical objects, machinery, environment, packaging condition, colors, materials, and layout.
   - List key visual objects, parts, equipment, or items recognized in the image ("visual_objects": array of strings).
   - Check the file name ("${fileName}") for supplementary context (PO numbers, document type, dates).

2. METADATA & FIELD EXTRACTION:
   - "document_type": e.g. "Official Receipt", "Tax Invoice", "Purchase Order", "Delivery Note", "Warehouse Facility Photo", "Parcel Shipping Label", "Equipment Photo", "Fleet Vehicle Photo", "Merchandise / Item Photo"
   - "detected_category": e.g. "documents", "photos", "Procurement", "Warehousing", "Inventory", "Fleet"
   - "item_identification": Name or subject of the item/character/product/equipment/scene depicted
   - "vendor_name": Merchant, supplier, brand, logistics provider, or manufacturer name if visible (e.g. "Petron", "ABC Logistics", "Shell")
   - "reference_number": Any clearly visible printed PO#, Invoice#, Tracking#, Serial#, Barcode, Model#, or Batch# from the document or image. CRITICAL: If no reference code or barcode is visibly printed on the image, you MUST return null. NEVER invent synthetic codes.
   - "date": Date if visible (e.g. "2026-08-22")
   - "total_amount": Numerical price/cost amount in PHP as a number (e.g. 1715) or null if not applicable
   - "quantity_estimate": Estimated count or quantity of items visible
   - "condition_status": Visual or order status (e.g. "Good Condition", "Ready for Pickup", "Delivered", "Damaged", "In Storage", "New / Sealed")
   - "summary": A clear 2-3 sentence description explaining what is depicted in the picture or document
   - "key_observations": Bullet points of noteworthy visual observations and details
   - "search_keywords": Array of 4-10 specific search keywords to query the database (including prominent OCR words, reference codes, subject name, supplier name, visual object tags)

3. SCOPE CHECK:
   - Only flag "is_out_of_scope": true if completely unrelated to business, logistics, media gallery, or supply chain (e.g. domestic cooking recipe, personal selfie with no context). For any uploaded photo, receipt, or warehouse asset, flag false.

Return ONLY a valid JSON object without markdown formatting, backticks, or fences:
{
  "is_out_of_scope": false,
  "out_of_scope_reason": null,
  "document_type": "Official Receipt / Warehouse Photo / etc",
  "detected_category": "documents / photos",
  "item_identification": "Item, character, or product name",
  "vendor_name": "Supplier or Brand if any",
  "reference_number": "PO-641123 or TRK20260522000014 or null",
  "date": "2026-08-22",
  "total_amount": 1715,
  "quantity_estimate": "1 pc",
  "condition_status": "Good condition",
  "ocr_text": "All transcribed text from the document or null",
  "visual_description": "Detailed visual description of the photo or image content",
  "visual_objects": ["forklift", "wooden pallet", "steel rack"],
  "summary": "Clear visual description of the picture and file name context",
  "key_observations": ["Observation 1", "Observation 2"],
  "search_keywords": ["LBC", "Caloocan", "TRK20260522000014", "Parcel Tracking"]
}
` : `
You are AIRY, the expert AI Supply Chain, Media Gallery & Logistics Assistant for Airship Express.
The user uploaded an image/file named: "${fileName}" in normal chat.
User prompt / question: "${userPrompt || "Describe what is shown in this picture/document and provide key details."}".

Your tasks:
1. SCOPE VERIFICATION:
   - If completely unrelated to supply chain, logistics, media gallery assets, receipts, or products, flag "is_out_of_scope": true.
   - Otherwise flag false.

2. CHAT FULFILLMENT & DESCRIPTION:
   - Answer what the user specifically asked in their prompt.
   - If the user did not provide a specific prompt, provide a clean description and breakdown of the document/image.
   - Extract OCR text if present ("ocr_text") and visual description of the photo ("visual_description").

Return ONLY a valid JSON object without markdown formatting, backticks, or fences:
{
  "is_out_of_scope": false,
  "out_of_scope_reason": null,
  "chat_response": "Clear, friendly, and comprehensive answer directly fulfilling the user's prompt or describing the uploaded image/document.",
  "document_type": "Warehouse Photo / Merchandise / Receipt / etc",
  "item_identification": "Item, character, or product name",
  "vendor_name": "Supplier or Brand if any",
  "reference_number": "PO or Tracking # if visible",
  "total_amount": 1715,
  "quantity_estimate": "1 pc",
  "condition_status": "Good condition",
  "ocr_text": "Extracted text or null",
  "visual_description": "Detailed description of the image",
  "visual_objects": ["box", "pallet"],
  "summary": "Brief summary of the image",
  "key_observations": ["Observation 1", "Observation 2"]
}
`;

        const response = await generateWithFallback(genAI, [
            {
                role: "user",
                parts: [
                    { text: promptText },
                    {
                        inlineData: {
                            data: pureBase64,
                            mimeType: mimeType.startsWith("image/") ? mimeType : (mimeType === "application/pdf" ? "application/pdf" : "image/png"),
                        },
                    },
                ],
            },
        ]);

        const rawText = response.text || "";
        const cleanJsonStr = rawText
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        let parsedAnalysis: any = {};
        try {
            parsedAnalysis = JSON.parse(cleanJsonStr);
        } catch (e) {
            console.error("Failed to parse Gemini output as JSON:", rawText);
            parsedAnalysis = {
                is_out_of_scope: false,
                document_type: mimeType.startsWith("image/") ? "Media Gallery Photo" : "Document Analysis",
                summary: rawText || "Analyzed uploaded picture/document.",
                ocr_text: null,
                visual_description: rawText || "",
                visual_objects: [],
                key_observations: [],
                search_keywords: [fileName.replace(/\.[^/.]+$/, "")],
            };
        }

        // Generic stop words to prevent broad noisy matches
        const GENERIC_STOP_WORDS = new Set([
            "receipt", "receipts", "official", "invoice", "invoices", "image", "images",
            "photo", "photos", "picture", "pictures", "screenshot", "document", "documents",
            "scan", "scanned", "file", "files", "upload", "uploaded", "png", "jpg", "jpeg", "pdf", "webp",
            "new", "temp", "copy", "airship", "express", "download", "attachment", "null", "undefined",
            "item", "items", "general", "photo-removebg-preview", "image-removebg-preview",
            "removebg", "preview", "bg", "remove", "img", "untitled", "asset", "assets",
            "anime", "artwork", "character", "style", "illustration", "wallpaper", "drawing", "render",
            "portrait", "graphic", "design", "digital", "high-contrast", "media",
            "student", "students", "school", "uniform", "uniforms", "people", "person", "man", "woman",
            "boy", "girl", "child", "children", "family", "face", "selfie", "clothes", "medals", "ribbons",
            "grad", "graduation", "event", "party", "food", "animal", "pet", "dog", "cat", "friend", "friends"
        ]);

        // Clean file name and strip Windows/browser duplicate suffixes like " (5)" or " - Copy"
        const rawBaseName = fileName.replace(/\.[^/.]+$/, "").trim();
        const normalizedBaseName = rawBaseName
            .replace(/\s*\(\d+\)$/g, "")
            .replace(/\s*-\s*Copy(?:\s*\(\d+\))?$/i, "")
            .trim();

        const extractedPoPatterns = (
            fileName.match(/\b(?:PO|PR|INV|TRK|BATCH|ORD)[-_ ]?[A-Za-z0-9]+\b/gi) || []
        ).map((s: string) => s.trim());
        const extractedNumbers = (fileName.match(/\b\d{4,}\b/g) || []).map((s: string) => s.trim());

        // Fill reference_number from file name if AI didn't catch it
        if (!parsedAnalysis.reference_number && extractedPoPatterns.length > 0) {
            parsedAnalysis.reference_number = extractedPoPatterns[0];
        }

        // Extract reference numbers from OCR text if any
        if (!parsedAnalysis.reference_number && parsedAnalysis.ocr_text) {
            const ocrPoMatch = parsedAnalysis.ocr_text.match(/\b(?:PO|PR|INV|TRK|BATCH|ORD)[-_ ]?[A-Za-z0-9]{4,}\b/i);
            if (ocrPoMatch) {
                parsedAnalysis.reference_number = ocrPoMatch[0].trim();
            }
        }

        // Tokenize filename, ignoring short pure numbers < 4 digits and generic stop words
        const nameTokens = normalizedBaseName
            .split(/[-_\s.,+()]+/)
            .map((t: string) => t.trim())
            .filter((t: string) => {
                if (/^\d{1,3}$/.test(t)) return false;
                return t.length >= 3 && !GENERIC_STOP_WORDS.has(t.toLowerCase());
            });

        const highPriorityRefTerms = Array.from(new Set([
            parsedAnalysis.reference_number,
            ...extractedPoPatterns,
            ...extractedNumbers
        ])).filter((term): term is string => {
            if (!term || typeof term !== "string") return false;
            const clean = term.trim();
            if (/^\d{1,3}$/.test(clean)) return false;
            return clean.length >= 3 && !GENERIC_STOP_WORDS.has(clean.toLowerCase());
        });

        // Extract sub-tokens from item_identification
        const itemTokens = (parsedAnalysis.item_identification || "")
            .split(/[-_\s.,+()]+/)
            .map((t: string) => t.trim())
            .filter((t: string) => {
                if (/^\d{1,3}$/.test(t)) return false;
                return t.length >= 4 && !GENERIC_STOP_WORDS.has(t.toLowerCase());
            });

        // Extract sub-tokens from visual_objects (Google Lens visual object tags)
        const visualObjectTokens: string[] = [];
        (parsedAnalysis.visual_objects || []).forEach((obj: string) => {
            if (typeof obj !== "string") return;
            const clean = obj.trim().toLowerCase();
            if (clean.length >= 3 && !GENERIC_STOP_WORDS.has(clean) && !/^\d+$/.test(clean)) {
                visualObjectTokens.push(clean);
            }
        });

        // Extract tokens from search_keywords
        const keywordTokens: string[] = [];
        (parsedAnalysis.search_keywords || []).forEach((kw: string) => {
            if (typeof kw !== "string") return;
            const cleanKw = kw.trim();
            if (cleanKw.length >= 3 && !GENERIC_STOP_WORDS.has(cleanKw.toLowerCase()) && !/^\d{1,3}$/.test(cleanKw)) {
                keywordTokens.push(cleanKw);
            }
            if (cleanKw.includes(" ") || cleanKw.includes("-")) {
                cleanKw.split(/[-_\s.,+()]+/).forEach((sub: string) => {
                    const cleanSub = sub.trim();
                    if (cleanSub.length >= 3 && !GENERIC_STOP_WORDS.has(cleanSub.toLowerCase()) && !/^\d{1,3}$/.test(cleanSub)) {
                        keywordTokens.push(cleanSub);
                    }
                });
            }
        });

        // Add user prompt tokens if user entered text search alongside or instead
        const promptTokens: string[] = [];
        if (userPrompt && typeof userPrompt === "string") {
            userPrompt.split(/[-_\s.,+()]+/).forEach((pt: string) => {
                const cleanPt = pt.trim();
                if (cleanPt.length >= 3 && !GENERIC_STOP_WORDS.has(cleanPt.toLowerCase()) && !/^\d{1,3}$/.test(cleanPt)) {
                    promptTokens.push(cleanPt);
                }
            });
        }

        const searchTerms = Array.from(new Set([
            ...highPriorityRefTerms,
            parsedAnalysis.vendor_name,
            ...nameTokens,
            ...itemTokens,
            ...visualObjectTokens,
            ...keywordTokens,
            ...promptTokens,
        ])).filter((term): term is string => {
            if (!term || typeof term !== "string") return false;
            const clean = term.trim();
            const lower = clean.toLowerCase();
            if (/^\d{1,3}$/.test(clean)) return false;
            return clean.length >= 3 && !GENERIC_STOP_WORDS.has(lower) && !lower.startsWith("image-removebg");
        });

        const isGenericBaseName = GENERIC_STOP_WORDS.has(normalizedBaseName.toLowerCase()) || 
            normalizedBaseName.toLowerCase().startsWith("image-removebg") ||
            normalizedBaseName.toLowerCase().startsWith("screenshot") ||
            normalizedBaseName.toLowerCase().startsWith("untitled") ||
            /^\d+$/.test(normalizedBaseName);

        let matchedDocument: any = null;
        let matchedDocumentsList: any[] = [];
        const seenCandidateDocs = new Map<string, any>();

        const getDocPublicUrl = (storagePath?: string | null) => {
            if (!storagePath) return "";
            try {
                const { data } = supabaseAdmin.storage.from("documents").getPublicUrl(storagePath);
                return data?.publicUrl || "";
            } catch {
                return "";
            }
        };

        // If image was classified as out of scope (personal photos, students, memes, pets, etc.)
        // and does NOT have an explicit PO/Tracking/Logistics reference, immediately return out-of-scope!
        const hasExplicitLogisticsRef = highPriorityRefTerms.some(t => /^(?:PO|PR|INV|TRK|BATCH|ORD)[-_ ]?[A-Za-z0-9]+/i.test(t));
        if (parsedAnalysis.is_out_of_scope && !hasExplicitLogisticsRef) {
            return NextResponse.json({
                success: true,
                isOutOfScope: true,
                analysis: parsedAnalysis,
                response: `⚠️ **Out of Scope Request**\n\n${parsedAnalysis.out_of_scope_reason || "The uploaded image or file is a personal or non-operational photo outside the scope of Airship Express Supply Chain operations."}\n\n**AIRY specializes in:**\n• Warehouse inventory tracking and stock identification\n• Analyzing photos of parcels, gallery media, and freight\n• Verifying and OCR parsing supplier invoices and receipts\n• Checking purchase requests and purchase orders\n• Auditing delivery batches and fleet photos`,
                matchedDocument: null,
                matchedDocuments: [],
            });
        }

        // ROLE-BASED ACCESS CONTROL:
        // Managers, Admins, Supervisors can search and view all system records.
        // Staff, Employees, etc. can ONLY see and match documents that they inserted / uploaded!
        const canUserAccessDoc = (doc: any) => {
            if (!isStaffRole) return true; // Management roles can access all records
            
            // For Staff / Employee: Check if the document was inserted/uploaded by this user
            const matchesUserId = Boolean(userId && doc.user_id && String(doc.user_id).toLowerCase() === String(userId).toLowerCase());
            const matchesForcedUserId = Boolean(userId && doc.force_inserted_by && String(doc.force_inserted_by).toLowerCase() === String(userId).toLowerCase());
            const matchesUserName = Boolean(userName && doc.uploaded_by && doc.uploaded_by.trim().toLowerCase() === userName.trim().toLowerCase());
            const matchesUserEmail = Boolean(userEmail && doc.uploaded_by && doc.uploaded_by.trim().toLowerCase() === userEmail.trim().toLowerCase());

            return matchesUserId || matchesForcedUserId || matchesUserName || matchesUserEmail;
        };

        const addCandidateDoc = (doc: any) => {
            if (!doc || !doc.id) return;
            // Exclude document if staff member is searching and the document belongs to someone else (e.g. manager)
            if (!canUserAccessDoc(doc)) return;
            if (!seenCandidateDocs.has(doc.id)) {
                seenCandidateDocs.set(doc.id, doc);
            }
        };

        // GOOGLE LENS DOCUMENT SEARCH:
        // Search public.supplier_documents across ALL matching columns including:
        // file_name, title, document_type, category, supplier, po_number, parcel_batch, uploaded_by, notes, "Price", and "extracted" (jsonb)
        if (isSearchDocMode) {
            try {
                // Pass 1: High Priority Reference / PO / Tracking Numbers
                if (highPriorityRefTerms.length > 0) {
                    for (const poRef of highPriorityRefTerms) {
                        const cleanPo = poRef.trim();
                        if (cleanPo.length < 3 || /^\d{1,3}$/.test(cleanPo)) continue;

                        const orQuery = [
                            `po_number.ilike.%${cleanPo}%`,
                            `file_name.ilike.%${cleanPo}%`,
                            `title.ilike.%${cleanPo}%`,
                            `parcel_batch.ilike.%${cleanPo}%`,
                            `notes.ilike.%${cleanPo}%`,
                            `extracted->>po_number.ilike.%${cleanPo}%`,
                            `extracted->>text.ilike.%${cleanPo}%`
                        ].join(",");

                        const { data: refDocs } = await supabaseAdmin
                            .from("supplier_documents")
                            .select("*")
                            .or(orQuery)
                            .order("created_at", { ascending: false })
                            .limit(5);

                        if (refDocs && refDocs.length > 0) {
                            refDocs.forEach(addCandidateDoc);
                        }
                    }
                }

                // Pass 2: Extracted OCR Text & Description Search (Google Lens Content & Visual search)
                const contentSearchTerms = Array.from(new Set([
                    ...keywordTokens,
                    ...visualObjectTokens,
                    ...promptTokens,
                ])).slice(0, 6);

                for (const cTerm of contentSearchTerms) {
                    const cleanTerm = cTerm.trim();
                    if (cleanTerm.length < 3 || GENERIC_STOP_WORDS.has(cleanTerm.toLowerCase())) continue;

                    const orQuery = [
                        `extracted->>text.ilike.%${cleanTerm}%`,
                        `extracted->>description.ilike.%${cleanTerm}%`,
                        `extracted->>summary.ilike.%${cleanTerm}%`,
                        `title.ilike.%${cleanTerm}%`,
                        `file_name.ilike.%${cleanTerm}%`,
                        `notes.ilike.%${cleanTerm}%`,
                        `supplier.ilike.%${cleanTerm}%`
                    ].join(",");

                    const { data: contentDocs } = await supabaseAdmin
                        .from("supplier_documents")
                        .select("*")
                        .or(orQuery)
                        .order("created_at", { ascending: false })
                        .limit(5);

                    if (contentDocs && contentDocs.length > 0) {
                        contentDocs.forEach(addCandidateDoc);
                    }
                }

                // Pass 3: Supplier / Vendor Name Search
                if (parsedAnalysis.vendor_name) {
                    const cleanVendor = parsedAnalysis.vendor_name.trim();
                    if (cleanVendor.length >= 3 && !GENERIC_STOP_WORDS.has(cleanVendor.toLowerCase())) {
                        const orQuery = [
                            `supplier.ilike.%${cleanVendor}%`,
                            `extracted->>vendor_name.ilike.%${cleanVendor}%`,
                            `title.ilike.%${cleanVendor}%`,
                            `file_name.ilike.%${cleanVendor}%`
                        ].join(",");

                        const { data: vendorDocs } = await supabaseAdmin
                            .from("supplier_documents")
                            .select("*")
                            .or(orQuery)
                            .order("created_at", { ascending: false })
                            .limit(4);

                        if (vendorDocs && vendorDocs.length > 0) {
                            vendorDocs.forEach(addCandidateDoc);
                        }
                    }
                }

                // Pass 4: File Name Match (with duplicate-awareness)
                if (normalizedBaseName.length >= 4 && !isGenericBaseName && !/^\d+$/.test(normalizedBaseName)) {
                    const { data: fileNameMatches } = await supabaseAdmin
                        .from("supplier_documents")
                        .select("*")
                        .or(`file_name.ilike.%${fileName}%,file_name.ilike.%${rawBaseName}%,title.ilike.%${rawBaseName}%`)
                        .order("created_at", { ascending: false })
                        .limit(5);

                    if (fileNameMatches && fileNameMatches.length > 0) {
                        fileNameMatches.forEach(addCandidateDoc);
                    }
                }

                // Pass 5: Broad Multi-Column Search across all search terms
                for (const term of searchTerms.slice(0, 8)) {
                    const cleanTerm = term.trim();
                    const lowerTerm = cleanTerm.toLowerCase();
                    if (
                        cleanTerm.length < 4 ||
                        /^\d+$/.test(cleanTerm) ||
                        GENERIC_STOP_WORDS.has(lowerTerm) ||
                        lowerTerm.startsWith("image-removebg") ||
                        lowerTerm.startsWith("screenshot")
                    ) continue;

                    const hyphenTerm = cleanTerm.replace(/\s+/g, "-");
                    const orQuery = [
                        `file_name.ilike.%${cleanTerm}%`,
                        `title.ilike.%${cleanTerm}%`,
                        `supplier.ilike.%${cleanTerm}%`,
                        `parcel_batch.ilike.%${cleanTerm}%`,
                        `notes.ilike.%${cleanTerm}%`,
                        `Price.ilike.%${cleanTerm}%`,
                        `extracted->>text.ilike.%${cleanTerm}%`,
                        `extracted->>description.ilike.%${cleanTerm}%`,
                        `extracted->>summary.ilike.%${cleanTerm}%`
                    ].join(",");

                    const { data: docMatches } = await supabaseAdmin
                        .from("supplier_documents")
                        .select("*")
                        .or(orQuery)
                        .order("created_at", { ascending: false })
                        .limit(4);

                    if (docMatches && docMatches.length > 0) {
                        docMatches.forEach(addCandidateDoc);
                    }
                }

                // INTELLIGENT GOOGLE LENS SCORING & DISAMBIGUATION:
                // Evaluates each candidate document against OCR text, visual description, PO, supplier, price, and filename.
                // Breaks ties and prevents false matches when documents have identical filenames!
                const scoredDocs: any[] = [];

                for (const doc of Array.from(seenCandidateDocs.values())) {
                    if (!canUserAccessDoc(doc)) continue;
                    let score = 0;
                    const matchedCriteria: { label: string; inserted_value: string; matched_value: string }[] = [];
                    const matchReasons: string[] = [];

                    const docExtracted = doc.extracted || {};
                    const docText = (docExtracted.text || "").toLowerCase();
                    const docDesc = (docExtracted.description || docExtracted.summary || "").toLowerCase();
                    const docObjects = Array.isArray(docExtracted.visual_objects) ? docExtracted.visual_objects.map((o: any) => String(o).toLowerCase()) : [];
                    const docPo = (doc.po_number || docExtracted.po_number || "").toLowerCase();
                    const docSupplier = (doc.supplier || docExtracted.vendor_name || "").toLowerCase();
                    const docFileName = (doc.file_name || "").toLowerCase();
                    const docTitle = (doc.title || "").toLowerCase();
                    const docPrice = doc.Price || docExtracted.price || null;
                    const docNotes = (doc.notes || "").toLowerCase();

                    // 1. PO / Reference Number Match (+35 pts)
                    if (parsedAnalysis.reference_number) {
                        const targetRef = parsedAnalysis.reference_number.toLowerCase();
                        if (docPo && (docPo.includes(targetRef) || targetRef.includes(docPo))) {
                            score += 35;
                            matchedCriteria.push({
                                label: "PO / Reference Number",
                                inserted_value: parsedAnalysis.reference_number,
                                matched_value: doc.po_number || docExtracted.po_number,
                            });
                            matchReasons.push(`PO #${doc.po_number || docExtracted.po_number}`);
                        } else if (docText.includes(targetRef) || docFileName.includes(targetRef)) {
                            score += 25;
                            matchedCriteria.push({
                                label: "Reference in Text/File",
                                inserted_value: parsedAnalysis.reference_number,
                                matched_value: doc.file_name,
                            });
                            matchReasons.push(`Ref #${parsedAnalysis.reference_number}`);
                        }
                    }

                    // 2. Extracted OCR Text Match (+35 pts)
                    if (parsedAnalysis.ocr_text && docText) {
                        const ocrWords = parsedAnalysis.ocr_text
                            .toLowerCase()
                            .split(/\s+/)
                            .filter((w: string) => w.length >= 4 && !GENERIC_STOP_WORDS.has(w));
                        const matchedOcrWords = ocrWords.filter((w: string) => docText.includes(w));
                        if (matchedOcrWords.length > 0) {
                            const bonus = Math.min(35, matchedOcrWords.length * 8);
                            score += bonus;
                            matchedCriteria.push({
                                label: "Extracted OCR Text",
                                inserted_value: matchedOcrWords.slice(0, 3).join(", "),
                                matched_value: "Found in document text",
                            });
                            matchReasons.push(`OCR text match: "${matchedOcrWords.slice(0, 2).join(' ')}"`);
                        }
                    }

                    // 3. Visual Description & Object Match (+30 pts - Google Lens Photo Match)
                    const visualTerms = [...visualObjectTokens, ...(parsedAnalysis.item_identification ? [parsedAnalysis.item_identification.toLowerCase()] : [])];
                    const matchedVisual = visualTerms.filter(vt => 
                        docDesc.includes(vt) || docObjects.some((o: string) => o.includes(vt)) || docTitle.includes(vt)
                    );
                    if (matchedVisual.length > 0) {
                        const bonus = Math.min(30, matchedVisual.length * 10);
                        score += bonus;
                        matchedCriteria.push({
                            label: "Visual Content Match",
                            inserted_value: matchedVisual.slice(0, 3).join(", "),
                            matched_value: "Visual match in document photo",
                        });
                        matchReasons.push(`Visual match: ${matchedVisual.slice(0, 2).join(', ')}`);
                    }

                    // 4. Supplier / Vendor Match (+25 pts)
                    if (parsedAnalysis.vendor_name) {
                        const targetVendor = parsedAnalysis.vendor_name.toLowerCase();
                        if (docSupplier && (docSupplier.includes(targetVendor) || targetVendor.includes(docSupplier))) {
                            score += 25;
                            matchedCriteria.push({
                                label: "Supplier / Vendor",
                                inserted_value: parsedAnalysis.vendor_name,
                                matched_value: doc.supplier || docExtracted.vendor_name,
                            });
                            matchReasons.push(`Supplier "${doc.supplier || docExtracted.vendor_name}"`);
                        } else if (docText.includes(targetVendor)) {
                            score += 15;
                            matchedCriteria.push({
                                label: "Supplier in Document",
                                inserted_value: parsedAnalysis.vendor_name,
                                matched_value: "Found in extracted text",
                            });
                        }
                    }

                    // 5. Price / Total Match (+15 pts)
                    if (parsedAnalysis.total_amount && docPrice) {
                        const numStr = String(parsedAnalysis.total_amount);
                        const cleanDocPrice = String(docPrice).replace(/[^0-9.]/g, "");
                        if (cleanDocPrice.includes(numStr) || numStr.includes(cleanDocPrice)) {
                            score += 15;
                            matchedCriteria.push({
                                label: "Price / Total Amount",
                                inserted_value: `₱${parsedAnalysis.total_amount}`,
                                matched_value: `₱${docPrice}`,
                            });
                            matchReasons.push(`Price match: ₱${docPrice}`);
                        }
                    }

                    // 6. File Name & Title Match (+20 pts)
                    // Note: If ONLY filename matches but content/text DOES NOT match, score remains 20 (allowing content to break ties between duplicate filenames!)
                    if (
                        docFileName.includes(normalizedBaseName.toLowerCase()) ||
                        normalizedBaseName.toLowerCase().includes(docFileName.replace(/\.[^/.]+$/, "")) ||
                        docTitle.includes(normalizedBaseName.toLowerCase())
                    ) {
                        score += 20;
                        matchedCriteria.push({
                            label: "File Name",
                            inserted_value: fileName,
                            matched_value: doc.file_name,
                        });
                        matchReasons.push(`File name "${doc.file_name}"`);
                    }

                    // 7. General Keywords / Metadata Match (+10 pts)
                    for (const kw of keywordTokens.slice(0, 4)) {
                        const lkw = kw.toLowerCase();
                        if (docNotes.includes(lkw) || docTitle.includes(lkw) || (doc.category && doc.category.toLowerCase().includes(lkw))) {
                            score += 5;
                        }
                    }

                    const pubUrl = getDocPublicUrl(doc.storage_path);
                    const finalReason = matchReasons.length > 0 
                        ? `Google Lens Match: ${matchReasons.join(" • ")}` 
                        : null;

                    // STRICT FILTER: Only accept candidate document if it achieved a score >= 20 AND matched at least one genuine criterion!
                    // This prevents false matches when documents have no real connection (e.g. personal photos, unrelated images)
                    if (score >= 20 && matchedCriteria.length > 0 && finalReason) {
                        scoredDocs.push({
                            ...doc,
                            public_url: pubUrl,
                            file_url: pubUrl,
                            source_type: doc.category === "photos" ? "gallery" : "document",
                            match_score: score,
                            match_reason: finalReason,
                            matched_criteria: matchedCriteria,
                        });
                    }
                }

                // Sort by Google Lens match score descending, then by created_at desc
                scoredDocs.sort((a, b) => {
                    if (b.match_score !== a.match_score) {
                        return b.match_score - a.match_score;
                    }
                    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
                });

                matchedDocumentsList = scoredDocs;

            } catch (searchErr) {
                console.error("Error searching documents for Google Lens match:", searchErr);
            }
        }

        matchedDocument = matchedDocumentsList.length > 0 ? matchedDocumentsList[0] : null;
 
        // If a genuine system record was found with score >= 20, mark in-scope
        if (matchedDocument && matchedDocument.match_score >= 20) {
            parsedAnalysis.is_out_of_scope = false;
        }

        // Check if explicitly out of scope and no genuine database record found
        if (parsedAnalysis.is_out_of_scope && !matchedDocument) {
            return NextResponse.json({
                success: true,
                isOutOfScope: true,
                analysis: parsedAnalysis,
                response: `⚠️ **Out of Scope Request**\n\n${parsedAnalysis.out_of_scope_reason || "The uploaded image or file is outside the scope of Airship Express Supply Chain operations."}\n\n**AIRY specializes in:**\n• Warehouse inventory tracking and stock identification\n• Analyzing photos of parcels, gallery media, and freight\n• Verifying and OCR parsing supplier invoices and receipts\n• Checking purchase requests and purchase orders\n• Auditing delivery batches and fleet photos`,
                matchedDocument: null,
                matchedDocuments: [],
            });
        }

        let formattedResponse = "";

        if (!isSearchDocMode) {
            // Normal chat response: fulfill user prompt directly or describe file
            if (parsedAnalysis.chat_response) {
                formattedResponse = parsedAnalysis.chat_response;
            } else {
                formattedResponse = `📷 **Image Analysis:** ${parsedAnalysis.document_type || "Supply Chain Asset"}\n\n`;
                formattedResponse += `${parsedAnalysis.summary || parsedAnalysis.visual_description || "Inspected image and contents."}\n\n`;
                if (parsedAnalysis.item_identification) formattedResponse += `• Item: ${parsedAnalysis.item_identification}\n`;
                if (parsedAnalysis.vendor_name) formattedResponse += `• Brand / Supplier: ${parsedAnalysis.vendor_name}\n`;
                if (parsedAnalysis.quantity_estimate) formattedResponse += `• Quantity: ${parsedAnalysis.quantity_estimate}\n`;
                if (parsedAnalysis.condition_status) formattedResponse += `• Condition: ${parsedAnalysis.condition_status}\n`;
            }
        } else {
            // Document search mode response: structured breakdown + Google Lens match card
            const isPhoto = mimeType.startsWith("image/") && !parsedAnalysis.document_type?.toLowerCase().includes("receipt") && !parsedAnalysis.document_type?.toLowerCase().includes("invoice") && !parsedAnalysis.document_type?.toLowerCase().includes("purchase order");
            formattedResponse = `🔍 **Google Lens Vision & Document Analysis:** ${parsedAnalysis.document_type || (isPhoto ? "Warehouse Photo" : "Document")}\n\n`;
            formattedResponse += `${parsedAnalysis.summary || parsedAnalysis.visual_description || "Image contents, OCR text, and visual metadata inspected."}\n\n`;

            formattedResponse += `**Detected Details:**\n`;
            formattedResponse += `• File Name: \`${fileName}\`\n`;
            if (parsedAnalysis.item_identification) formattedResponse += `• Item / Subject: **${parsedAnalysis.item_identification}**\n`;
            if (parsedAnalysis.detected_category) formattedResponse += `• Category: **${parsedAnalysis.detected_category}**\n`;
            if (parsedAnalysis.vendor_name) formattedResponse += `• Vendor / Supplier / Brand: **${parsedAnalysis.vendor_name}**\n`;
            if (parsedAnalysis.reference_number) formattedResponse += `• Reference / Tracking #: \`${parsedAnalysis.reference_number}\`\n`;
            if (parsedAnalysis.condition_status) formattedResponse += `• Condition / Status: **${parsedAnalysis.condition_status}**\n`;

            if (parsedAnalysis.total_amount !== undefined && parsedAnalysis.total_amount !== null) {
                const rawAmt = String(parsedAnalysis.total_amount).replace(/[^0-9.-]+/g, "");
                const parsedAmt = parseFloat(rawAmt);
                if (!isNaN(parsedAmt) && parsedAmt > 0) {
                    formattedResponse += `• Total Amount: **₱${parsedAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**\n`;
                }
            }

            if (parsedAnalysis.visual_objects && parsedAnalysis.visual_objects.length > 0) {
                formattedResponse += `• Recognized Objects: ${parsedAnalysis.visual_objects.map((o: string) => `\`${o}\``).join(", ")}\n`;
            }

            if (parsedAnalysis.key_observations && parsedAnalysis.key_observations.length > 0) {
                formattedResponse += `\n**Visual Observations:**\n`;
                parsedAnalysis.key_observations.forEach((obs: string) => {
                    formattedResponse += `• ${obs}\n`;
                });
            }
        }

        const formatMatchedPayload = (rawDoc: any) => {
            if (!rawDoc) return null;
            const isImage = (rawDoc.file_type || "").startsWith("image/") ||
                (rawDoc.storage_path || "").match(/\.(jpg|jpeg|png|webp|gif|svg)$/i) ||
                rawDoc.source_type === "gallery" ||
                rawDoc.category === "photos";

            let viewLink = `/documents?search=${encodeURIComponent(rawDoc.title || rawDoc.file_name || rawDoc.po_number || "")}`;
            let targetLabel = "Documents Repository";

            if (isImage || rawDoc.category === "photos") {
                viewLink = `/documents?search=${encodeURIComponent(rawDoc.title || rawDoc.file_name || rawDoc.po_number || "")}`;
                targetLabel = "Media & Documents Gallery";
            }

            const publicUrl = rawDoc.public_url || getDocPublicUrl(rawDoc.storage_path);

            return {
                id: String(rawDoc.id),
                title: rawDoc.title || rawDoc.file_name || "Document",
                file_name: rawDoc.file_name || rawDoc.title || "file",
                category: rawDoc.category || "General",
                document_type: rawDoc.document_type || (isImage ? "Media / Photo" : "Document"),
                supplier: rawDoc.supplier || "—",
                po_number: rawDoc.po_number || "—",
                parcel_batch: rawDoc.parcel_batch || null,
                uploaded_by: rawDoc.uploaded_by || "System",
                created_at: rawDoc.created_at || new Date().toISOString(),
                storage_path: rawDoc.storage_path || null,
                public_url: publicUrl || null,
                file_url: publicUrl || null,
                file_type: rawDoc.file_type || (isImage ? "image/jpeg" : "application/pdf"),
                file_size: rawDoc.file_size || null,
                notes: rawDoc.notes || null,
                price: rawDoc.Price || rawDoc.extracted?.price || null,
                extracted: rawDoc.extracted || null,
                source_type: rawDoc.source_type,
                target_label: targetLabel,
                is_gallery: Boolean(isImage || rawDoc.category === "photos"),
                view_link: viewLink,
                match_score: rawDoc.match_score || 0,
                match_reason: rawDoc.match_reason || "Google Lens Document Match",
                matched_criteria: rawDoc.matched_criteria || [],
            };
        };

        let matchPayload: any = null;
        let matchedDocumentsPayload: any[] = [];

        if (isSearchDocMode && matchedDocumentsList.length > 0) {
            matchedDocumentsPayload = matchedDocumentsList.slice(0, 5).map(formatMatchedPayload).filter(Boolean);
            matchPayload = matchedDocumentsPayload[0] || null;

            if (matchPayload) {
                formattedResponse += `\n\n🎯 **Google Lens Match Found in ${matchPayload.target_label}:**\n`;
                formattedResponse += `• **Matched Document / Record:** **${matchPayload.title || matchPayload.file_name}** (${matchPayload.category || "Record"})\n`;
                
                if (matchPayload.match_reason) {
                    formattedResponse += `• **Match Verification:** ${matchPayload.match_reason}\n`;
                }

                if (matchPayload.matched_criteria && matchPayload.matched_criteria.length > 0) {
                    formattedResponse += `• **Matched Columns & Criteria:**\n`;
                    for (const crit of matchPayload.matched_criteria) {
                        formattedResponse += `   - **${crit.label}:** Uploaded: \`${crit.inserted_value}\` ⇄ Database: \`${crit.matched_value}\`\n`;
                    }
                }

                const recordDetails: string[] = [];
                if (matchPayload.supplier && matchPayload.supplier !== "—") recordDetails.push(`Supplier: ${matchPayload.supplier}`);
                if (matchPayload.po_number && matchPayload.po_number !== "—") recordDetails.push(`Ref / PO #: ${matchPayload.po_number}`);
                if (matchPayload.document_type) recordDetails.push(`Type: ${matchPayload.document_type}`);
                if (matchPayload.price) recordDetails.push(`Price: ₱${matchPayload.price}`);
                if (recordDetails.length > 0) {
                    formattedResponse += `• **Record Details:** ${recordDetails.join(" • ")}\n`;
                }

                if (matchPayload.extracted?.description) {
                    formattedResponse += `• **Extracted Content Summary:** ${matchPayload.extracted.description.slice(0, 160)}...\n`;
                }

                if (matchedDocumentsPayload.length > 1) {
                    formattedResponse += `\n*(+ ${matchedDocumentsPayload.length - 1} other matching record${matchedDocumentsPayload.length > 2 ? 's' : ''} found in database)*`;
                }
            } else {
                formattedResponse += `\n\nℹ️ **Google Lens Database Check:** No matching document record found in ${isStaffRole ? "your uploaded documents" : "the database"} for this document/image.`;
            }
        } else if (isSearchDocMode) {
            formattedResponse += `\n\nℹ️ **Google Lens Database Check:** No matching document record found in ${isStaffRole ? "your uploaded documents" : "the database"} for this document/image.`;
        }

        return NextResponse.json({
            success: true,
            isOutOfScope: false,
            analysis: parsedAnalysis,
            response: formattedResponse,
            matchedDocument: matchPayload,
            matchedDocuments: matchedDocumentsPayload,
        });

    } catch (error: any) {
        console.error("Error in analyze-document route:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to analyze document." },
            { status: 500 }
        );
    }
}