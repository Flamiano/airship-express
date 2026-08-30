import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "@/app/(supplyChain)/lib/services/client/supabase";

const apiKey = process.env.GEMINI_SUPPLYCHAIN_API_KEY;
const MODEL_NAME = process.env.GEMINI_SUPPLYCHAIN_MODEL || "gemini-2.5-flash";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            file,
            userPrompt = "",
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

        const promptText = `
You are an expert AI Supply Chain, Media Gallery & Logistics Vision Intelligence Assistant for Airship Express.
The user uploaded an image/file with the file name: "${fileName}".
User message/prompt: "${userPrompt || "Analyze this picture/document and identify any details, items, text, or matching supply chain records."}".

Your task:
1. Deeply inspect and analyze this image/document and also analyze its file name ("${fileName}").
2. Note: Airship Express Media Gallery and Documents repository stores a wide range of assets, including parcel contents, merchandise, anime/branding items, equipment, warehouse photos, packaging, employee badges, vehicles, receipts, and invoices.
   - If the user asks a completely unrelated academic question (e.g. "write my calculus homework" or "tell me a cooking recipe") that has nothing to do with the uploaded media, only then flag "is_out_of_scope": true.
   - For ANY uploaded image, photo, or document (including anime, products, equipment, vehicles, receipts, badges), analyze and classify it as a valid system media asset.
3. Visual & File Name Classification:
   - "document_type": e.g. "Media Gallery Photo", "Merchandise / Item Photo", "Inventory Photo", "Parcel Shipping Label", "Warehouse Inspection", "Fleet Vehicle", "Official Receipt", "Tax Invoice", "Purchase Order", "Delivery Note", "Material/Stock Photo", "Equipment"
   - "detected_category": e.g. "photos", "Inventory", "Procurement", "Warehousing", "Fleet", "Packaging", "Electronics", "General"
   - "item_identification": Name or subject of the item/character/product/equipment shown in the picture or implied by the file name
   - "vendor_name": Merchant, supplier, brand, creator, or manufacturer name if visible or inferred
   - "reference_number": Any visible or file-name-based PO#, Invoice#, Tracking#, Serial#, Barcode, Model#, or Batch#
   - "date": Date if visible
   - "total_amount": Price or cost in PHP/currency if visible
   - "quantity_estimate": Estimated count or quantity of items visible
   - "condition_status": Visual condition (e.g. "Digital Image", "Good Condition", "In Storage", "New / Sealed")
   - "summary": A clear 2-3 sentence description explaining what is depicted in the picture or document, referencing the file name
   - "key_observations": Bullet points of noteworthy visual observations and details
   - "search_keywords": Array of 3-7 specific search keywords to query the database (including file name words, subject name, brand, reference number, supplier name)

Return ONLY a valid JSON object without markdown formatting, backticks, or fences:
{
  "is_out_of_scope": false,
  "out_of_scope_reason": null,
  "document_type": "Media Gallery Photo / Inventory Photo / Receipt / etc",
  "detected_category": "photos",
  "item_identification": "Item, character, or product name",
  "vendor_name": "Supplier or Brand if any",
  "reference_number": "PO or Tracking # if any",
  "date": "2026-08-30",
  "total_amount": null,
  "quantity_estimate": "1 pc",
  "condition_status": "Good condition",
  "summary": "Clear visual description of the picture",
  "key_observations": ["Observation 1", "Observation 2"],
  "search_keywords": ["keyword1", "keyword2", "keyword3"]
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

        // Search for matches across documents, gallery, and inventory FIRST
        let matchedDocument: any = null;
        const rawBaseName = fileName.replace(/\.[^/.]+$/, "").trim();
        const nameTokens = rawBaseName
            .split(/[-_\s.,+]+/)
            .map((t: string) => t.trim())
            .filter((t: string) => t.length >= 2);

        const searchTerms = [
            fileName,
            rawBaseName,
            parsedAnalysis.reference_number,
            parsedAnalysis.vendor_name,
            parsedAnalysis.item_identification,
            ...nameTokens,
            ...(parsedAnalysis.search_keywords || []),
        ].filter((term): term is string => Boolean(term && typeof term === "string" && term.trim().length >= 2));

        try {
            // 1. Check by exact/partial file name, title, or storage path in `documents` (includes gallery items)
            if (rawBaseName.length >= 2) {
                const { data: fileNameMatch } = await supabase
                    .from("documents")
                    .select("*")
                    .or(`file_name.ilike.%${fileName}%,file_name.ilike.%${rawBaseName}%,storage_path.ilike.%${rawBaseName}%,title.ilike.%${rawBaseName}%`)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (fileNameMatch) {
                    matchedDocument = { ...fileNameMatch, source_type: fileNameMatch.category === "photos" ? "gallery" : "document" };
                }
            }

            // 2. Search in `documents` table by reference number or title
            if (!matchedDocument && parsedAnalysis.reference_number) {
                const { data: exactDoc } = await supabase
                    .from("documents")
                    .select("*")
                    .or(`po_number.ilike.%${parsedAnalysis.reference_number}%,title.ilike.%${parsedAnalysis.reference_number}%,file_name.ilike.%${parsedAnalysis.reference_number}%`)
                    .limit(1)
                    .maybeSingle();

                if (exactDoc) {
                    matchedDocument = { ...exactDoc, source_type: exactDoc.category === "photos" ? "gallery" : "document" };
                }
            }

            // 3. Search in `documents` table by keywords or supplier/uploader
            if (!matchedDocument) {
                for (const term of searchTerms) {
                    const cleanTerm = term.trim();
                    if (cleanTerm.length < 2) continue;

                    const { data: docMatch } = await supabase
                        .from("documents")
                        .select("*")
                        .or(`title.ilike.%${cleanTerm}%,file_name.ilike.%${cleanTerm}%,supplier.ilike.%${cleanTerm}%,notes.ilike.%${cleanTerm}%,uploaded_by.ilike.%${cleanTerm}%`)
                        .order("created_at", { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (docMatch) {
                        matchedDocument = { ...docMatch, source_type: docMatch.category === "photos" ? "gallery" : "document" };
                        break;
                    }
                }
            }

            // 4. If no document match, search in `inventory_items` table by item name/code/filename
            if (!matchedDocument) {
                for (const term of searchTerms) {
                    const cleanTerm = term.trim();
                    if (cleanTerm.length < 2) continue;

                    const { data: itemMatch } = await supabase
                        .from("inventory_items")
                        .select("*")
                        .or(`item_name.ilike.%${cleanTerm}%,item_code.ilike.%${cleanTerm}%,category.ilike.%${cleanTerm}%`)
                        .limit(1)
                        .maybeSingle();

                    if (itemMatch) {
                        matchedDocument = {
                            id: itemMatch.id,
                            title: itemMatch.item_name,
                            file_name: itemMatch.item_code,
                            category: itemMatch.category || "Inventory",
                            document_type: "Inventory Item",
                            supplier: `Location: ${itemMatch.storage_location || "Warehouse"} (Stock: ${itemMatch.current_stock} ${itemMatch.unit || "pcs"})`,
                            po_number: itemMatch.item_code,
                            uploaded_by: "Inventory Registry",
                            source_type: "inventory",
                            created_at: itemMatch.created_at || new Date().toISOString(),
                        };
                        break;
                    }
                }
            }

            // 5. If no inventory match, search in `purchase_orders` table by PO number or supplier
            if (!matchedDocument && (parsedAnalysis.reference_number || nameTokens.length > 0)) {
                const poCheckTerms = [parsedAnalysis.reference_number, ...nameTokens].filter(Boolean);
                for (const poTerm of poCheckTerms) {
                    const { data: poMatch } = await supabase
                        .from("purchase_orders")
                        .select("*")
                        .or(`po_number.ilike.%${poTerm}%,supplier_name.ilike.%${poTerm}%`)
                        .limit(1)
                        .maybeSingle();

                    if (poMatch) {
                        matchedDocument = {
                            id: poMatch.id,
                            title: `Purchase Order: ${poMatch.po_number}`,
                            file_name: poMatch.po_number,
                            category: "Procurement",
                            document_type: "Purchase Order",
                            supplier: poMatch.supplier_name,
                            po_number: poMatch.po_number,
                            uploaded_by: "Procurement System",
                            source_type: "purchase_order",
                            created_at: poMatch.created_at,
                        };
                        break;
                    }
                }
            }
        } catch (searchErr) {
            console.error("Error searching records for match:", searchErr);
        }

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
                response: `⚠️ Out of Scope Request\n\n${parsedAnalysis.out_of_scope_reason || "The uploaded file appears to be unrelated to Airship Express operations or stored gallery records."}\n\nAirship Express AI specializes in:\n• Warehouse inventory tracking and stock identification\n• Analyzing photos of parcels, gallery media, and freight\n• Verifying and OCR parsing supplier invoices and receipts\n• Checking purchase requests and purchase orders\n• Auditing delivery batches and fleet photos`,
                matchedDocument: null,
            });
        }

        // Format clean, structured response without markdown asterisks or hashes
        const isPhoto = mimeType.startsWith("image/") && !parsedAnalysis.document_type?.toLowerCase().includes("receipt") && !parsedAnalysis.document_type?.toLowerCase().includes("invoice");
        let formattedResponse = `📷 Picture & Vision Analysis: ${parsedAnalysis.document_type || (isPhoto ? "Warehouse Photo" : "Document")}\n\n`;
        formattedResponse += `${parsedAnalysis.summary || "Image inspected and analyzed successfully."}\n\n`;

        formattedResponse += `Detected Details:\n`;
        formattedResponse += `• File Name: ${fileName}\n`;
        if (parsedAnalysis.item_identification) formattedResponse += `• Item / Object: ${parsedAnalysis.item_identification}\n`;
        if (parsedAnalysis.detected_category) formattedResponse += `• Category: ${parsedAnalysis.detected_category}\n`;
        if (parsedAnalysis.quantity_estimate) formattedResponse += `• Quantity Estimate: ${parsedAnalysis.quantity_estimate}\n`;
        if (parsedAnalysis.condition_status) formattedResponse += `• Condition / Status: ${parsedAnalysis.condition_status}\n`;
        if (parsedAnalysis.vendor_name) formattedResponse += `• Vendor / Supplier / Brand: ${parsedAnalysis.vendor_name}\n`;
        if (parsedAnalysis.reference_number) formattedResponse += `• Reference / Barcode #: ${parsedAnalysis.reference_number}\n`;
        if (parsedAnalysis.total_amount) {
            formattedResponse += `• Total Amount: ₱${Number(parsedAnalysis.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
        }

        if (parsedAnalysis.key_observations && parsedAnalysis.key_observations.length > 0) {
            formattedResponse += `\nVisual Observations:\n`;
            parsedAnalysis.key_observations.forEach((obs: string) => {
                formattedResponse += `• ${obs}\n`;
            });
        }

        let matchPayload = null;
        if (matchedDocument) {
            const isImage = (matchedDocument.file_type || "").startsWith("image/") || (matchedDocument.storage_path || "").match(/\.(jpg|jpeg|png|webp|gif)$/i) || matchedDocument.source_type === "gallery";
            let viewLink = `/documents?search=${encodeURIComponent(matchedDocument.title || matchedDocument.file_name || matchedDocument.po_number || "")}`;
            let targetLabel = "Documents Repository";

            if (matchedDocument.source_type === "inventory") {
                viewLink = `/inventory?search=${encodeURIComponent(matchedDocument.title || matchedDocument.file_name)}`;
                targetLabel = "Inventory Page";
            } else if (matchedDocument.source_type === "purchase_order") {
                viewLink = `/purchase-orders?search=${encodeURIComponent(matchedDocument.po_number || matchedDocument.file_name)}`;
                targetLabel = "Purchase Orders";
            } else if (isImage || matchedDocument.category === "photos") {
                viewLink = `/gallery?search=${encodeURIComponent(matchedDocument.title || matchedDocument.file_name || matchedDocument.po_number || "")}`;
                targetLabel = "Media Gallery";
            }

            matchPayload = {
                id: matchedDocument.id,
                title: matchedDocument.title || matchedDocument.file_name,
                file_name: matchedDocument.file_name,
                category: matchedDocument.category || "General",
                document_type: matchedDocument.document_type || "Document",
                supplier: matchedDocument.supplier || "—",
                po_number: matchedDocument.po_number || "—",
                parcel_batch: matchedDocument.parcel_batch || null,
                uploaded_by: matchedDocument.uploaded_by || "System",
                created_at: matchedDocument.created_at,
                storage_path: matchedDocument.storage_path,
                is_gallery: Boolean(isImage || matchedDocument.category === "photos"),
                view_link: viewLink,
            };

            formattedResponse += `\n\n🎯 System Match Found in ${targetLabel}:\n`;
            formattedResponse += `Matched record: ${matchedDocument.title || matchedDocument.file_name} (${matchedDocument.category || "Record"})\n`;
            formattedResponse += `Details: ${matchedDocument.supplier || "—"} | Ref: ${matchedDocument.po_number || "—"}`;
        } else {
            formattedResponse += `\n\nℹ️ System Database Check: No identical existing match found in /documents or /gallery. This picture has been analyzed and can be archived or used for replenishment.`;
        }

        return NextResponse.json({
            success: true,
            isOutOfScope: false,
            analysis: parsedAnalysis,
            response: formattedResponse,
            matchedDocument: matchPayload,
        });

    } catch (error: any) {
        console.error("Error in analyze-document route:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to analyze document." },
            { status: 500 }
        );
    }
}
