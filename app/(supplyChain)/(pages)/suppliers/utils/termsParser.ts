// app/(supplyChain)/(pages)/suppliers/utils/termsParser.ts

export interface ParsedQuoteTerms {
    paymentTerms: string;
    warrantyTerms: string;
    priceValidity: string;
    deliveryTerms: string;
    clauses: string;
    cleanNotes: string;
}

/**
 * Safely parses structured terms, governing commercial clauses, and vendor notes
 * from quotation notes without truncating inner brackets (e.g. [product], [number], etc.).
 */
export function parseQuotationNotes(rawNotes: string | undefined | null, quote?: any): ParsedQuoteTerms {
    const result: ParsedQuoteTerms = {
        paymentTerms: quote?.payment_terms || "",
        warrantyTerms: quote?.warranty_terms || "",
        priceValidity: quote?.price_validity || "",
        deliveryTerms: quote?.delivery_terms || "",
        clauses: quote?.supplier_terms || "",
        cleanNotes: "",
    };

    if (!rawNotes || typeof rawNotes !== "string") return result;

    const text = rawNotes.trim();

    // 1. Check for [Terms: ... ]
    const termsStartIdx = text.indexOf("[Terms:");
    if (termsStartIdx !== -1) {
        // Legal texts frequently contain placeholder brackets like [product], [number], [delivery term], etc.
        // The [Terms: ...] block ends at the closing bracket of the terms block.
        // In standard submission: `[Terms: Payment=... | Warranty=... | Validity=... | Delivery=... | Clauses: ...] ${optionalNotes}`
        const lastBracketIdx = text.lastIndexOf("]");
        let termsContent = "";
        if (lastBracketIdx > termsStartIdx) {
            termsContent = text.slice(termsStartIdx + 7, lastBracketIdx).trim();
            const beforeTerms = text.slice(0, termsStartIdx).replace(/\[Category:[^\]]*\]/gi, "").trim();
            const afterLastBracket = text.slice(lastBracketIdx + 1).trim();
            result.cleanNotes = [beforeTerms, afterLastBracket].filter(Boolean).join("\n\n");
        } else {
            termsContent = text.slice(termsStartIdx + 7).trim();
        }

        // Separate Key-Value terms from "Clauses:"
        const clausesPos = termsContent.search(/\|\s*Clauses:\s*|^Clauses:\s*/i);
        let keyValStr = termsContent;
        if (clausesPos !== -1) {
            const clausesMatch = termsContent.slice(clausesPos).match(/(?:\|\s*)?Clauses:\s*/i);
            if (clausesMatch) {
                keyValStr = termsContent.slice(0, clausesPos);
                const clausesBody = termsContent.slice(clausesPos + clausesMatch[0].length).trim();
                if (clausesBody) {
                    result.clauses = clausesBody;
                }
            }
        }

        // Parse key-value pairs: Payment=..., Warranty=..., Validity=..., Delivery=...
        const keys = [
            { key: "Payment=", field: "paymentTerms" as const },
            { key: "Warranty=", field: "warrantyTerms" as const },
            { key: "Validity=", field: "priceValidity" as const },
            { key: "Delivery=", field: "deliveryTerms" as const },
        ];

        const keyPositions: { key: string; field: keyof ParsedQuoteTerms; index: number }[] = [];
        for (const k of keys) {
            const re = new RegExp(`(?:^|\\|\\s*)${k.key}`, "i");
            const m = keyValStr.match(re);
            if (m && m.index !== undefined) {
                const actualStart = m.index + (m[0].startsWith("|") ? m[0].indexOf(k.key) : 0);
                keyPositions.push({ key: k.key, field: k.field, index: actualStart });
            }
        }
        keyPositions.sort((a, b) => a.index - b.index);

        for (let i = 0; i < keyPositions.length; i++) {
            const current = keyPositions[i];
            const next = keyPositions[i + 1];
            const valStart = current.index + current.key.length;
            const valEnd = next ? next.index : keyValStr.length;
            let val = keyValStr.slice(valStart, valEnd).trim();
            if (val.endsWith("|")) val = val.slice(0, -1).trim();

            if (!result[current.field]) {
                (result as any)[current.field] = val;
            }
        }
    }

    // 2. Fallback check for "--- Terms & Conditions ---"
    if (!result.clauses && text.includes("--- Terms & Conditions ---")) {
        const parts = text.split(/---+\s*Terms\s*&\s*Conditions\s*---+/i);
        if (parts[1]) result.clauses = parts[1].trim();
        if (!result.cleanNotes) result.cleanNotes = (parts[0] || "").trim();
    }

    // 3. Fallback check if "Clauses:" exists directly without "[Terms:"
    if (!result.clauses && text.includes("Clauses:")) {
        const cIdx = text.indexOf("Clauses:");
        let cText = text.slice(cIdx + 8).trim();
        if (cText.endsWith("]")) cText = cText.slice(0, -1).trim();
        result.clauses = cText;
    }

    // Clean remaining raw notes if still empty and no structured [Terms: ...]
    if (!result.cleanNotes && !text.includes("[Terms:") && !text.includes("--- Terms & Conditions ---")) {
        result.cleanNotes = text.replace(/\[Category:[^\]]*\]/gi, "").trim();
    }

    return result;
}
