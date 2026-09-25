import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "../../../lib/services/client/supabase";

const apiKey = process.env.GEMINI_SUPPLYCHAIN_API_KEY;
const MODEL_NAME = process.env.GEMINI_SUPPLYCHAIN_MODEL || "gemini-2.5-flash";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            file,
            userPrompt = "",
            mode = "normal",
            role = "User",
            userName = "User",
            userEmail = ""
        } = body;

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
        const isSearchDocMode = mode === "search_document";

        const promptText = isSearchDocMode ? `
You are an expert AI Supply Chain, Media Gallery & Logistics Vision Intelligence Assistant for Airship Express.
The user uploaded an image/file with the file name: "${fileName}" specifically to SEARCH AND MATCH database records.
User message/prompt: "${userPrompt || "Search and identify matching supply chain records for this document/picture."}".

Your task:
1. Deeply inspect and analyze BOTH this image/document and its file name ("${fileName}").
2. Check the file name itself for vital context:
   - Does the file name contain a Purchase Order number (e.g. PO-XXXXXX, PO641123)?
   - Does it indicate a receipt, invoice, delivery note, stock photo, inspection, or badge?
   - Does it contain supplier names, item names, or dates?
3. Cross-reference what you see visually in the image with the clues in the file name:
   - Extract all visible text, PO numbers, reference codes, supplier names, total amounts, and dates.
4. Scope Verification:
   - If the uploaded media is completely out of scope for Supply Chain operations and Media Gallery assets (e.g. personal selfies, academic homework, recipes), flag "is_out_of_scope": true.
   - For ANY uploaded image, photo, or document (including anime, products, equipment, vehicles, receipts, badges), analyze and classify it as a valid system media asset.
5. Visual & File Name Classification:
   - "document_type": e.g. "Purchase Order", "Official Receipt", "Tax Invoice", "Delivery Note", "Media Gallery Photo", "Merchandise / Item Photo", "Inventory Photo", "Parcel Shipping Label", "Warehouse Inspection", "Fleet Vehicle", "Material/Stock Photo", "Equipment"
   - "detected_category": e.g. "Procurement", "photos", "Inventory", "Warehousing", "Fleet", "Packaging", "Electronics", "General"
   - "item_identification": Name or subject of the item/character/product/equipment shown in the picture or implied by the file name
   - "vendor_name": Merchant, supplier, brand, creator, or manufacturer name if visible or inferred (e.g. "ABC Tires")
   - "reference_number": Any clearly visible printed PO#, Invoice#, Tracking#, Serial#, Barcode, Model#, or Batch# from the document or image. CRITICAL: If no reference code or barcode is visibly printed on the image, you MUST return null. NEVER invent synthetic codes like 'MG-H-001' or make up arbitrary codes.
   - "date": Date if visible (e.g. "2026-08-22")
   - "total_amount": Numerical price/cost amount in PHP as a number (e.g. 1715) or null if not applicable
   - "quantity_estimate": Estimated count or quantity of items visible
   - "condition_status": Visual or order status (e.g. "Delivered", "Delivered / OCR Mismatch", "Good Condition", "In Storage", "New / Sealed")
   - "summary": A clear 2-3 sentence description explaining what is depicted in the picture or document, explicitly referencing the file name and all identified records
   - "key_observations": Bullet points of noteworthy visual observations and details
   - "search_keywords": Array of 3-7 specific search keywords to query the database (including file name words, reference numbers like "PO-641123", subject name, brand, supplier name)

Return ONLY a valid JSON object without markdown formatting, backticks, or fences:
{
  "is_out_of_scope": false,
  "out_of_scope_reason": null,
  "document_type": "Purchase Order / Official Receipt / Photo / etc",
  "detected_category": "Procurement / photos / Inventory / Warehousing",
  "item_identification": "Item, character, or product name",
  "vendor_name": "Supplier or Brand if any",
  "reference_number": "PO-641123",
  "date": "2026-08-22",
  "total_amount": 1715,
  "quantity_estimate": "1 pc",
  "condition_status": "Delivered",
  "summary": "Clear visual description of the picture and file name context",
  "key_observations": ["Observation 1", "Observation 2"],
  "search_keywords": ["PO-641123", "ABC Tires", "Barcode Scanner"]
}
` : `
You are an expert AI Supply Chain, Media Gallery & Logistics Assistant for Airship Express.
The user uploaded an image/file named: "${fileName}" in normal chat.
User prompt / question: "${userPrompt || "Describe what is shown in this picture/document and provide key details."}".

Your tasks:
1. SCOPE VERIFICATION (Mandatory):
   - Check if this image/document or prompt relates to Airship Express Supply Chain operations, warehousing, logistics, parcel shipping, freight, fleet, inventory items, equipment, merchandise/branding items, supplier receipts, purchase orders, packaging, or employee badges.
   - If the uploaded image or question is completely unrelated to supply chain operations (e.g. personal selfies, domestic cooking recipes, academic homework, video game screenshots, landscape vacation photos with no company context), flag "is_out_of_scope": true with a clear "out_of_scope_reason".
   - If it is related to supply chain, logistics, media gallery assets, receipts, or products, flag "is_out_of_scope": false.

2. CHAT FULFILLMENT & DESCRIPTION (When in scope):
   - Answer what the user specifically asked in their prompt.
   - If the user asked a question (e.g. "what items are visible?", "extract the total amount", "summarize this receipt", "describe the condition of this parcel"), fulfill their prompt directly, accurately, and politely.
   - If the user did not provide a specific prompt, provide a clean description and breakdown of the document/image.
   - Note: Do NOT perform database search matching in normal chat mode. Just describe or fulfill what the user asked.

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
  "summary": "Brief summary of the image",
  "key_observations": ["Observation 1", "Observation 2"]
}
`;

        const response = await genAI.models.generateContent({
            model: MODEL_NAME,
            contents: [
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
            ],
        });

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
                key_observations: [],
                search_keywords: [fileName.replace(/\.[^/.]+$/, "")],
            };
        }

        // Generic stop words to prevent false positive matches
        const GENERIC_STOP_WORDS = new Set([
            "receipt", "receipts", "official", "invoice", "invoices", "image", "images",
            "photo", "photos", "picture", "pictures", "screenshot", "document", "documents",
            "scan", "scanned", "file", "upload", "uploaded", "png", "jpg", "jpeg", "pdf", "webp",
            "new", "temp", "copy", "airship", "express", "download", "attachment", "null", "undefined",
            "item", "items", "general", "photo-removebg-preview", "image-removebg-preview",
            "removebg", "preview", "bg", "remove", "img", "untitled", "asset", "assets",
            "anime", "artwork", "character", "style", "illustration", "wallpaper", "drawing", "render",
            "portrait", "graphic", "design", "digital", "high-contrast", "media"
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

        // Tokenize filename, strictly ignoring pure numbers < 4 digits (e.g. 01, 1, 99) and generic stop words
        const nameTokens = normalizedBaseName
            .split(/[-_\s.,+()]+/)
            .map((t: string) => t.trim())
            .filter((t: string) => {
                if (/^\d{1,3}$/.test(t)) return false; // Ignore short numbers like 01, 02
                return t.length >= 3 && !GENERIC_STOP_WORDS.has(t.toLowerCase());
            });

        const highPriorityRefTerms = Array.from(new Set([
            parsedAnalysis.reference_number,
            ...extractedPoPatterns,
            ...extractedNumbers
        ])).filter((term): term is string => {
            if (!term || typeof term !== "string") return false;
            const clean = term.trim();
            if (/^\d{1,3}$/.test(clean)) return false; // Never allow short digits like 01
            return clean.length >= 3 && !GENERIC_STOP_WORDS.has(clean.toLowerCase());
        });

        // Extract sub-tokens from item_identification to match specific character/item/product names
        const itemTokens = (parsedAnalysis.item_identification || "")
            .split(/[-_\s.,+()]+/)
            .map((t: string) => t.trim())
            .filter((t: string) => {
                if (/^\d{1,3}$/.test(t)) return false;
                return t.length >= 4 && !GENERIC_STOP_WORDS.has(t.toLowerCase());
            });

        // Extract sub-tokens from search_keywords to handle hyphenated filenames
        const keywordTokens: string[] = [];
        (parsedAnalysis.search_keywords || []).forEach((kw: string) => {
            if (typeof kw !== "string") return;
            const cleanKw = kw.trim();
            if (cleanKw.includes(" ") || cleanKw.includes("-")) {
                cleanKw.split(/[-_\s.,+()]+/).forEach((sub: string) => {
                    const cleanSub = sub.trim();
                    if (cleanSub.length >= 4 && !GENERIC_STOP_WORDS.has(cleanSub.toLowerCase()) && !/^\d{1,3}$/.test(cleanSub)) {
                        keywordTokens.push(cleanSub);
                    }
                });
            }
        });

        const searchTerms = Array.from(new Set([
            ...highPriorityRefTerms,
            parsedAnalysis.vendor_name,
            ...nameTokens,
            ...itemTokens,
            ...keywordTokens,
            ...(parsedAnalysis.search_keywords || []),
        ])).filter((term): term is string => {
            if (!term || typeof term !== "string") return false;
            const clean = term.trim();
            const lower = clean.toLowerCase();
            if (/^\d{1,3}$/.test(clean)) return false; // Never allow short digits like 01
            return clean.length >= 3 && !GENERIC_STOP_WORDS.has(lower) && !lower.startsWith("image-removebg");
        });

        const isGenericBaseName = GENERIC_STOP_WORDS.has(normalizedBaseName.toLowerCase()) || 
            normalizedBaseName.toLowerCase().startsWith("image-removebg") ||
            normalizedBaseName.toLowerCase().startsWith("screenshot") ||
            normalizedBaseName.toLowerCase().startsWith("untitled") ||
            /^\d+$/.test(normalizedBaseName);

        let matchedDocument: any = null;
        let matchedDocumentsList: any[] = [];
        const seenDocKeys = new Set<string>();

        const getDocPublicUrl = (storagePath?: string | null) => {
            if (!storagePath) return "";
            try {
                const { data } = supabase.storage.from("documents").getPublicUrl(storagePath);
                return data?.publicUrl || "";
            } catch {
                return "";
            }
        };

        const addMatchRecord = (
            doc: any,
            matchReason?: string,
            criteriaList?: { label: string; inserted_value: string; matched_value: string }[]
        ) => {
            if (!doc || !doc.id) return;
            const key = `doc_${doc.id}`;
            if (!seenDocKeys.has(key)) {
                seenDocKeys.add(key);
                matchedDocumentsList.push({
                    ...doc,
                    match_reason: matchReason || "System Record Match",
                    matched_criteria: criteriaList || [],
                });
            }
        };

        // ONLY execute database search matching in the `documents` table if user explicitly requested "search_document" mode
        // STRICT: Do NOT query `inventory_items`. We only search genuine records stored in the documents repository.
        if (isSearchDocMode) {
            try {
                // 1. High Priority: Check `documents` table by verified reference PO / Tracking numbers from OCR or filename
                if (highPriorityRefTerms.length > 0) {
                    for (const poRef of highPriorityRefTerms) {
                        const cleanPo = poRef.trim();
                        if (cleanPo.length < 3 || /^\d{1,3}$/.test(cleanPo)) continue;

                        const { data: exactDocs } = await supabase
                            .from("documents")
                            .select("*")
                            .or(`po_number.ilike.%${cleanPo}%,file_name.ilike.%${cleanPo}%,title.ilike.%${cleanPo}%`)
                            .order("created_at", { ascending: false })
                            .limit(3);

                        if (exactDocs && exactDocs.length > 0) {
                            exactDocs.forEach(doc => {
                                const pubUrl = getDocPublicUrl(doc.storage_path);
                                const matchedTarget = doc.po_number?.toLowerCase().includes(cleanPo.toLowerCase())
                                    ? `PO #${doc.po_number}`
                                    : (doc.file_name?.toLowerCase().includes(cleanPo.toLowerCase()) ? `File "${doc.file_name}"` : `Title "${doc.title}"`);

                                addMatchRecord(
                                    {
                                        ...doc,
                                        public_url: pubUrl,
                                        file_url: pubUrl,
                                        source_type: doc.category === "photos" ? "gallery" : "document"
                                    },
                                    `Reference / PO Match: ${cleanPo}`,
                                    [
                                        {
                                            label: "Reference Identifier",
                                            inserted_value: cleanPo,
                                            matched_value: matchedTarget || cleanPo,
                                        }
                                    ]
                                );
                            });
                            break;
                        }
                    }
                }

                // 2. Exact file name match in `documents` (only for specific non-generic, non-pure-number filenames with length >= 4)
                if (normalizedBaseName.length >= 4 && !isGenericBaseName && !/^\d+$/.test(normalizedBaseName)) {
                    const { data: fileNameMatches } = await supabase
                        .from("documents")
                        .select("*")
                        .or(`file_name.ilike.%${fileName}%,file_name.ilike.%${rawBaseName}%,title.ilike.%${rawBaseName}%`)
                        .order("created_at", { ascending: false })
                        .limit(3);

                    if (fileNameMatches && fileNameMatches.length > 0) {
                        fileNameMatches.forEach(doc => {
                            const pubUrl = getDocPublicUrl(doc.storage_path);
                            addMatchRecord(
                                {
                                    ...doc,
                                    public_url: pubUrl,
                                    file_url: pubUrl,
                                    source_type: doc.category === "photos" ? "gallery" : "document"
                                },
                                `File Name Match: "${rawBaseName}"`,
                                [
                                    {
                                        label: "File Name",
                                        inserted_value: fileName,
                                        matched_value: doc.file_name || doc.title,
                                    }
                                ]
                            );
                        });
                    }
                }

                // 3. Search in `documents` table by verified vendor/supplier name (if document record has supplier assigned)
                if (parsedAnalysis.vendor_name) {
                    const cleanVendor = parsedAnalysis.vendor_name.trim();
                    if (cleanVendor.length >= 3 && !GENERIC_STOP_WORDS.has(cleanVendor.toLowerCase())) {
                        const { data: vendorDocs } = await supabase
                            .from("documents")
                            .select("*")
                            .ilike("supplier", `%${cleanVendor}%`)
                            .order("created_at", { ascending: false })
                            .limit(2);

                        if (vendorDocs && vendorDocs.length > 0) {
                            vendorDocs.forEach(doc => {
                                const pubUrl = getDocPublicUrl(doc.storage_path);
                                addMatchRecord(
                                    {
                                        ...doc,
                                        public_url: pubUrl,
                                        file_url: pubUrl,
                                        source_type: doc.category === "photos" ? "gallery" : "document"
                                    },
                                    `Supplier / Vendor Match: "${cleanVendor}"`,
                                    [
                                        {
                                            label: "Supplier / Vendor",
                                            inserted_value: cleanVendor,
                                            matched_value: doc.supplier || cleanVendor,
                                        }
                                    ]
                                );
                            });
                        }
                    }
                }

                // 4. Search in `documents` table by specific search terms (strictly length >= 4, non-numeric, non-generic)
                for (const term of searchTerms) {
                    const cleanTerm = term.trim();
                    const lowerTerm = cleanTerm.toLowerCase();
                    if (
                        cleanTerm.length < 4 ||
                        /^\d+$/.test(cleanTerm) ||
                        GENERIC_STOP_WORDS.has(lowerTerm) ||
                        lowerTerm.startsWith("image-removebg") ||
                        lowerTerm.startsWith("screenshot") ||
                        lowerTerm.startsWith("untitled") ||
                        lowerTerm.includes("receipt") ||
                        lowerTerm.includes("invoice")
                    ) continue;

                    // Generate hyphenated variant for multi-word phrases (e.g. "Itachi Uchiha" -> "Itachi-Uchiha")
                    const hyphenTerm = cleanTerm.replace(/\s+/g, "-");
                    const orQuery = cleanTerm !== hyphenTerm
                        ? `title.ilike.%${cleanTerm}%,file_name.ilike.%${cleanTerm}%,title.ilike.%${hyphenTerm}%,file_name.ilike.%${hyphenTerm}%,supplier.ilike.%${cleanTerm}%`
                        : `title.ilike.%${cleanTerm}%,file_name.ilike.%${cleanTerm}%,supplier.ilike.%${cleanTerm}%`;

                    const { data: docMatches } = await supabase
                        .from("documents")
                        .select("*")
                        .or(orQuery)
                        .order("created_at", { ascending: false })
                        .limit(3);

                    if (docMatches && docMatches.length > 0) {
                        docMatches.forEach(d => {
                            const pubUrl = getDocPublicUrl(d.storage_path);
                            addMatchRecord(
                                {
                                    ...d,
                                    public_url: pubUrl,
                                    file_url: pubUrl,
                                    source_type: d.category === "photos" ? "gallery" : "document"
                                },
                                `Content / Keyword Match: "${cleanTerm}"`,
                                [
                                    {
                                        label: "Matched Keyword",
                                        inserted_value: cleanTerm,
                                        matched_value: d.title || d.file_name,
                                    }
                                ]
                            );
                        });
                    }
                }
            } catch (searchErr) {
                console.error("Error searching documents for match:", searchErr);
            }
        }

        matchedDocument = matchedDocumentsList.length > 0 ? matchedDocumentsList[0] : null;

        // If a system record was found in the database, it is ALWAYS in scope!
        if (matchedDocument) {
            parsedAnalysis.is_out_of_scope = false;
        }

        // Check if explicitly out of scope and no database record found
        if (parsedAnalysis.is_out_of_scope && !matchedDocument) {
            return NextResponse.json({
                success: true,
                isOutOfScope: true,
                analysis: parsedAnalysis,
                response: `Out of Scope Request\n\n${parsedAnalysis.out_of_scope_reason || "The uploaded image/file is outside the scope of Airship Express Supply Chain operations."}\n\nAirship Express AI specializes in:\n• Warehouse inventory tracking and stock identification\n• Analyzing photos of parcels, gallery media, and freight\n• Verifying and OCR parsing supplier invoices and receipts\n• Checking purchase requests and purchase orders\n• Auditing delivery batches and fleet photos`,
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
                formattedResponse += `${parsedAnalysis.summary || "Inspected image and contents."}\n\n`;
                if (parsedAnalysis.item_identification) formattedResponse += `• Item: ${parsedAnalysis.item_identification}\n`;
                if (parsedAnalysis.vendor_name) formattedResponse += `• Brand / Supplier: ${parsedAnalysis.vendor_name}\n`;
                if (parsedAnalysis.quantity_estimate) formattedResponse += `• Quantity: ${parsedAnalysis.quantity_estimate}\n`;
                if (parsedAnalysis.condition_status) formattedResponse += `• Condition: ${parsedAnalysis.condition_status}\n`;
            }
        } else {
            // Document search mode response: structured breakdown + database match card
            const isPhoto = mimeType.startsWith("image/") && !parsedAnalysis.document_type?.toLowerCase().includes("receipt") && !parsedAnalysis.document_type?.toLowerCase().includes("invoice") && !parsedAnalysis.document_type?.toLowerCase().includes("purchase order");
            formattedResponse = `📷 Picture & Vision Analysis: ${parsedAnalysis.document_type || (isPhoto ? "Warehouse Photo" : "Document")}\n\n`;
            formattedResponse += `${parsedAnalysis.summary || "Image and file metadata inspected successfully."}\n\n`;

            formattedResponse += `Detected Details:\n`;
            formattedResponse += `• File Name: ${fileName}\n`;
            if (parsedAnalysis.item_identification) formattedResponse += `• Item / Object: ${parsedAnalysis.item_identification}\n`;
            if (parsedAnalysis.detected_category) formattedResponse += `• Category: ${parsedAnalysis.detected_category}\n`;
            if (parsedAnalysis.quantity_estimate) formattedResponse += `• Quantity Estimate: ${parsedAnalysis.quantity_estimate}\n`;
            if (parsedAnalysis.condition_status) formattedResponse += `• Condition / Status: ${parsedAnalysis.condition_status}\n`;
            if (parsedAnalysis.vendor_name) formattedResponse += `• Vendor / Supplier / Brand: ${parsedAnalysis.vendor_name}\n`;
            if (parsedAnalysis.reference_number) formattedResponse += `• Reference / Barcode #: ${parsedAnalysis.reference_number}\n`;

            if (parsedAnalysis.total_amount !== undefined && parsedAnalysis.total_amount !== null) {
                const rawAmt = String(parsedAnalysis.total_amount).replace(/[^0-9.-]+/g, "");
                const parsedAmt = parseFloat(rawAmt);
                if (!isNaN(parsedAmt) && parsedAmt > 0) {
                    formattedResponse += `• Total Amount: ₱${parsedAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
                }
            }

            if (parsedAnalysis.key_observations && parsedAnalysis.key_observations.length > 0) {
                formattedResponse += `\nVisual Observations:\n`;
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
                viewLink = `/gallery?search=${encodeURIComponent(rawDoc.title || rawDoc.file_name || rawDoc.po_number || "")}`;
                targetLabel = "Media Gallery";
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
                source_type: rawDoc.source_type,
                target_label: targetLabel,
                is_gallery: Boolean(isImage || rawDoc.category === "photos"),
                view_link: viewLink,
                match_reason: rawDoc.match_reason || "System Match",
                matched_criteria: rawDoc.matched_criteria || [],
            };
        };

        let matchPayload = null;
        let matchedDocumentsPayload: any[] = [];

        if (isSearchDocMode && matchedDocumentsList.length > 0) {
            matchedDocumentsPayload = matchedDocumentsList.slice(0, 4).map(formatMatchedPayload).filter(Boolean);
            matchPayload = matchedDocumentsPayload[0] || null;

            formattedResponse += `\n\n🎯 **System Match Found in ${matchPayload.target_label}:**\n`;
            formattedResponse += `• **Matched Document / Record:** ${matchPayload.title || matchPayload.file_name} (${matchPayload.category || "Record"})\n`;
            
            if (matchPayload.match_reason) {
                formattedResponse += `• **Why it Matched:** ${matchPayload.match_reason}\n`;
            }

            if (matchPayload.matched_criteria && matchPayload.matched_criteria.length > 0) {
                formattedResponse += `• **Matching Criteria:**\n`;
                for (const crit of matchPayload.matched_criteria) {
                    formattedResponse += `   - **${crit.label}:** Uploaded: \`${crit.inserted_value}\` ⇄ Database: \`${crit.matched_value}\`\n`;
                }
            }

            const recordDetails: string[] = [];
            if (matchPayload.supplier && matchPayload.supplier !== "—") recordDetails.push(`Supplier: ${matchPayload.supplier}`);
            if (matchPayload.po_number && matchPayload.po_number !== "—") recordDetails.push(`Ref / PO #: ${matchPayload.po_number}`);
            if (matchPayload.document_type) recordDetails.push(`Type: ${matchPayload.document_type}`);
            if (recordDetails.length > 0) {
                formattedResponse += `• **Database Record Info:** ${recordDetails.join(" • ")}\n`;
            }

            if (matchedDocumentsPayload.length > 1) {
                formattedResponse += `\n*(+ ${matchedDocumentsPayload.length - 1} other related record${matchedDocumentsPayload.length > 2 ? 's' : ''} found in database)*`;
            }
        } else if (isSearchDocMode) {
            formattedResponse += `\n\nℹ️ System Database Check: No matching existing record found in /documents or /gallery for this document/image.`;
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
