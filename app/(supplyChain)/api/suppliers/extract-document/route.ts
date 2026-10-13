import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_SUPPLYCHAIN_API_KEY || process.env.GEMINI_API_KEY || "";

const FALLBACK_MODELS = Array.from(new Set([
    process.env.GEMINI_SUPPLYCHAIN_MODEL || "gemini-3.5-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
])).filter(Boolean);

async function generateWithModelFallback(genAI: any, contents: any[]) {
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
            console.warn(`[Supplier Doc Extraction] Model ${model} failed, trying next fallback:`, err?.message || err);
            lastError = err;
            continue;
        }
    }
    throw lastError || new Error("All Gemini models currently unavailable. Please retry.");
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            fileBase64,
            fileName = "document",
            fileType = "application/pdf",
            documentType = "General Document",
        } = body;

        if (!fileBase64) {
            return NextResponse.json(
                { success: false, error: "Missing file base64 data." },
                { status: 400 }
            );
        }

        // Clean base64 string
        let base64Clean = fileBase64;
        let mimeType = fileType || "application/pdf";

        if (fileBase64.includes(";base64,")) {
            const parts = fileBase64.split(";base64,");
            const mimeMatch = parts[0].match(/data:(.*?)$/);
            if (mimeMatch && mimeMatch[1]) {
                mimeType = mimeMatch[1];
            }
            base64Clean = parts[1];
        }

        if (!apiKey) {
            return NextResponse.json(
                { success: false, error: "Gemini API key is not configured." },
                { status: 500 }
            );
        }

        const genAI = new GoogleGenAI({ apiKey });

        const promptText = `
You are an expert AI for Supply Chain and Procurement Supplier Registration.
Analyze this uploaded supplier document (${documentType} - filename: "${fileName}").

Extract all available vendor / supplier details accurately into JSON format.
CRITICAL INSTRUCTIONS:
- Do NOT invent or hallucinate missing information.
- If a field is not present or cannot be inferred from the document, set its value to null (or empty string).
- For payment terms, delivery terms, warranty, lead time, MOQ: only extract if explicitly stated or clearly implied.
- If terms, conditions, clauses, service terms, cancellation policies, or governing agreements are found in the document, extract and format them as a clear numbered list separated by newlines (e.g. "1. First clause...\n2. Second clause..."), NOT as a single continuous inline paragraph.

Return ONLY a valid JSON object matching this exact structure:
{
  "supplier_name": string | null,
  "category": string | null,
  "contact_person": string | null,
  "phone": string | null,
  "email": string | null,
  "location": string | null,
  "website": string | null,
  "tax_id": string | null,
  "products": string | null,
  "notes": string | null,
  "payment_method": string | null,
  "payment_terms": string | null,
  "delivery_terms": string | null,
  "return_policy": string | null,
  "warranty": string | null,
  "lead_time": string | null,
  "moq": string | null,
  "terms_and_conditions": string | null,
  "document_summary": string | null,
  "extracted_text": string | null
}
`;

        const filePart = {
            inlineData: {
                data: base64Clean,
                mimeType: mimeType || "application/pdf",
            },
        };

        const response = await generateWithModelFallback(genAI, [promptText, filePart]);
        const responseText = response.text || "";

        // Parse JSON from model output
        let extractedData: any = {};
        try {
            const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, responseText];
            const cleanJsonStr = (jsonMatch[1] || responseText).trim();
            extractedData = JSON.parse(cleanJsonStr);
        } catch (parseErr) {
            console.warn("[Supplier Doc Extraction] Direct JSON parse failed, attempting regex cleanup:", parseErr);
            const firstBrace = responseText.indexOf("{");
            const lastBrace = responseText.lastIndexOf("}");
            if (firstBrace !== -1 && lastBrace !== -1) {
                try {
                    extractedData = JSON.parse(responseText.slice(firstBrace, lastBrace + 1));
                } catch {
                    extractedData = { document_summary: responseText, extracted_text: responseText };
                }
            } else {
                extractedData = { document_summary: responseText, extracted_text: responseText };
            }
        }

        return NextResponse.json({
            success: true,
            extractedData,
            rawText: responseText,
        });
    } catch (error: any) {
        console.error("Error extracting supplier document with AI:", error);
        return NextResponse.json(
            { success: false, error: error?.message || "Failed to extract information from document" },
            { status: 500 }
        );
    }
}
