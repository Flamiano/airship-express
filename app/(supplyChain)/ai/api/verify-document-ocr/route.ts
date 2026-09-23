import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_SUPPLYCHAIN_API_KEY;
const MODEL_NAME = process.env.GEMINI_SUPPLYCHAIN_MODEL || "gemini-2.5-flash";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            fileBase64,
            fileName = "uploaded_file",
            fileType = "image/png",
            userRole = "Employee",
            userName = "User",
        } = body;

        if (!fileBase64) {
            return NextResponse.json(
                { success: false, error: "No file provided for OCR inspection." },
                { status: 400 }
            );
        }

        // Clean base64 string
        let pureBase64 = fileBase64;
        if (pureBase64.includes(",")) {
            pureBase64 = pureBase64.split(",")[1];
        }

        if (!apiKey) {
            // Fallback if no key configured: allow upload with basic check
            return NextResponse.json({
                success: true,
                is_valid_system_doc: true,
                detected_type: "Standard Document",
                detected_category: "documents",
                extracted_title: fileName.replace(/\.[^/.]+$/, ""),
                extracted_price: null,
                extracted_supplier: null,
                extracted_po_number: null,
                rejection_reason: null,
                summary: "AI validation bypassed: API key not configured.",
            });
        }

        const genAI = new GoogleGenAI({ apiKey });

        const promptText = `
You are the Chief OCR & Compliance Intelligence Officer for Airship Express (a courier, logistics, and supply chain management enterprise).
Your strict task is to inspect the attached document or image named "${fileName}" and determine if it represents a VALID supply chain/company operational document or photo, OR if it is UNRELATED out-of-scope media (such as an anime character like Itachi, cartoon, video game screenshot, internet meme, personal selfie, or random unrelated photo).

VALID Supply Chain & Company Assets include:
- Financial & Commercial documents: Official Receipts, Invoices, Delivery Receipts, Purchase Orders, Bills of Lading, Manifests, Quotations, Vendor Contracts, Tax Certificates, Customs Declarations.
- Logistics & Operational media: Parcel photos, Damaged package condition, Courier handover, Barcode/Tracking labels, Packaging, Warehouse storage/racks, Fleet vehicles/trucks/vans, Vehicle maintenance, Official badges/IDs, Workplace equipment.

INVALID / OUT-OF-SCOPE Media include:
- Anime, manga, cartoon illustrations (e.g. Itachi Uchiha, Naruto, Dragon Ball, superheroes, fictional drawings).
- Gaming screenshots, fantasy graphics, video game characters.
- Personal selfies, casual vacation photos, food/cooking recipes with no company relation.
- Internet memes, jokes, unrelated viral images.

Perform detailed OCR and visual inspection.
Extract any visible:
1. "is_valid_system_doc": boolean (true if valid supply chain/business/logistics document or photo; false if anime, meme, selfie, or unrelated graphic).
2. "detected_type": Specific name of what is depicted (e.g., "Official Receipt", "Tax Invoice", "Delivery Receipt", "Parcel Condition Photo", "Anime Illustration (Itachi Uchiha)", "Internet Meme", "Personal Selfie").
3. "confidence_score": 0 to 100 percentage.
4. "detected_category": "documents" | "photos" | "unrelated".
5. "extracted_title": Clean recommended title for the document.
6. "extracted_price": Formatted currency amount (e.g., "₱1,250.00" or "1250.00") if a financial amount/total is visible, or null.
7. "extracted_supplier": Merchant, vendor, or supplier name if visible, or null.
8. "extracted_po_number": PO reference number (e.g., "PO-2026-0031") if visible, or null.
9. "rejection_reason": If invalid, write a clear, polite 1-2 sentence explanation of why this file is rejected (e.g. "The uploaded image was detected as an anime illustration (Itachi Uchiha) and does not qualify as an official supply chain document, receipt, or logistics photo."). If valid, return null.
10. "summary": 1-2 sentence description of the file.

Return ONLY a valid JSON object without markdown formatting, code fences, or backticks:
{
  "is_valid_system_doc": true,
  "detected_type": "Official Receipt",
  "confidence_score": 95,
  "detected_category": "documents",
  "extracted_title": "Official Receipt - ABC Logistics",
  "extracted_price": "1,500.00",
  "extracted_supplier": "ABC Logistics Co.",
  "extracted_po_number": null,
  "rejection_reason": null,
  "summary": "Official sales receipt from ABC Logistics Co. with itemized charges."
}
`;

        let mime = fileType;
        if (!mime || mime === "application/octet-stream") {
            mime = "image/png";
        }
        if (mime === "application/pdf") {
            mime = "application/pdf";
        }

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
                                mimeType: mime.startsWith("image/") ? mime : (mime === "application/pdf" ? "application/pdf" : "image/png"),
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

        let parsedResult: any;
        try {
            parsedResult = JSON.parse(cleanJsonStr);
        } catch (parseErr) {
            console.warn("Failed to parse Gemini OCR response as JSON:", rawText);
            // Fallback parse attempt or basic default
            const isInvalid = /anime|itachi|naruto|meme|cartoon|selfie|gaming/i.test(rawText);
            parsedResult = {
                is_valid_system_doc: !isInvalid,
                detected_type: isInvalid ? "Unrelated Image" : "Document / Photo",
                confidence_score: 80,
                detected_category: isInvalid ? "unrelated" : "documents",
                extracted_title: fileName.replace(/\.[^/.]+$/, ""),
                extracted_price: null,
                extracted_supplier: null,
                extracted_po_number: null,
                rejection_reason: isInvalid ? "The uploaded file does not appear to be a standard supply chain document or warehouse photo." : null,
                summary: rawText.substring(0, 150),
            };
        }

        return NextResponse.json({
            success: true,
            ...parsedResult,
            userRole,
            userName,
        });
    } catch (error: any) {
        console.error("Error in verify-document-ocr route:", error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || "Failed to inspect document with Gemini OCR.",
                is_valid_system_doc: true, // Fail-open gracefully on internal server error
            },
            { status: 500 }
        );
    }
}
