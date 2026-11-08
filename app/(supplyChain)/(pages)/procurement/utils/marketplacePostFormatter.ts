import type { StockShortageItem } from "../types/index";

export interface MarketplaceFormatOptions {
    quantity?: number;
    location?: string;
    customNotes?: string;
    targetPrice?: number | null;
    quotationUrl?: string;
    includeQuotationLink?: boolean;
}

export const DEFAULT_LOCATION = "Binondo, Manila (Airship HQ) / Metro Manila";

/**
 * Builds the online Supplier Portal Quotation Submission URL pre-filled for this item
 * Strictly uses NEXT_PUBLIC_SUPPLYCHAIN_APP_URL from environment
 */
export function buildQuotationPortalUrl(
    item: StockShortageItem,
    options?: {
        quantity?: number;
        location?: string;
        baseUrl?: string;
    }
): string {
    const envBase = (process.env.NEXT_PUBLIC_SUPPLYCHAIN_APP_URL || "").trim().replace(/\/+$/, "");
    const base = options?.baseUrl || envBase || "https://sc.airship-express.com";

    const qty = options?.quantity ?? item.deficit ?? 1;
    const reqNum = item.source_request || (item.item_code ? `REQ-${item.item_code}` : "PROCUREMENT-SOURCING");
    
    const params = new URLSearchParams({
        req: reqNum,
        item: item.item_name || "",
        qty: String(qty),
        unit: item.unit || "units",
        cat: item.category || "General",
        loc: options?.location || DEFAULT_LOCATION,
    });

    return `${base}/supplier-portal/quote?${params.toString()}`;
}

/**
 * Copies string to clipboard with modern API and reliable fallback
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
    if (typeof window === "undefined") return false;

    // Modern Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // fallback if permission denied
        }
    }

    // Fallback using textarea + execCommand
    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand("copy");
        textArea.remove();
        return successful;
    } catch {
        return false;
    }
}

/**
 * Template A: Facebook Marketplace / Social Media (WTB - Want To Buy)
 */
export function formatFacebookMarketplacePost(
    item: StockShortageItem,
    options?: MarketplaceFormatOptions
): string {
    const qty = options?.quantity ?? item.deficit ?? 1;
    const unit = item.unit || "units";
    const location = options?.location || DEFAULT_LOCATION;
    const refPrice = options?.targetPrice ?? item.previous_unit_price ?? item.purchase_price;
    const customNotes = options?.customNotes?.trim();
    const shouldIncludeLink = options?.includeQuotationLink !== false;
    const quoteUrl = options?.quotationUrl || (shouldIncludeLink ? buildQuotationPortalUrl(item, { quantity: qty, location }) : undefined);

    const priceText = refPrice && Number(refPrice) > 0
        ? `₱${Number(refPrice).toLocaleString()} (Reference / Negotiable)`
        : "Open / Send your best price quote";

    const lines: string[] = [
        "🛒 [LOOKING FOR SUPPLIER / WTB - URGENT REQUISITION]",
        "──────────────────────────────",
        `📦 Item Name: ${item.item_name || "Supplies"}`,
        `🔢 Needed Quantity: ${qty} ${unit}`,
        `📍 Delivery Destination: ${location}`,
        `💰 Target / Ref Price: ${priceText}`,
    ];

    if (customNotes) {
        lines.push(`📝 Notes / Specs: ${customNotes}`);
    } else if (item.description) {
        lines.push(`📝 Description: ${item.description}`);
    }

    if (quoteUrl) {
        lines.push(`🔗 Submit Quotation Online: ${quoteUrl}`);
    }

    lines.push(
        "──────────────────────────────",
        "📩 If you have available on-hand stock or are an authorized distributor, please send a quotation:",
        quoteUrl ? `• Direct Quote Submission Link: ${quoteUrl}` : "• Send PM with best unit price (cash/terms)",
        "• Include product photos / brand specifications & lead time",
        "Thank you!"
    );

    return lines.join("\n");
}

/**
 * Template B: Quick Chat / Viber / WhatsApp RFQ
 */
export function formatViberRFQPost(
    item: StockShortageItem,
    options?: MarketplaceFormatOptions
): string {
    const qty = options?.quantity ?? item.deficit ?? 1;
    const unit = item.unit || "units";
    const location = options?.location || DEFAULT_LOCATION;
    const shouldIncludeLink = options?.includeQuotationLink !== false;
    const quoteUrl = options?.quotationUrl || (shouldIncludeLink ? buildQuotationPortalUrl(item, { quantity: qty, location }) : undefined);

    const lines = [
        "Good day! Sourcing for Airship Express procurement:",
        `Do you have available stock for ${item.item_name}?`,
        `• Quantity needed: ${qty} ${unit}`,
        `• Destination: ${location}`,
    ];

    if (quoteUrl) {
        lines.push(`• Submit quotation directly: ${quoteUrl}`);
    }

    lines.push("Kindly send your best unit price and availability/lead time. Thank you!");
    return lines.join("\n");
}

/**
 * Template C: Clean Plain Text / Specification Sheet
 */
export function formatPlainTextSpec(
    item: StockShortageItem,
    options?: MarketplaceFormatOptions
): string {
    const qty = options?.quantity ?? item.deficit ?? 1;
    const unit = item.unit || "units";
    const location = options?.location || DEFAULT_LOCATION;
    const shouldIncludeLink = options?.includeQuotationLink !== false;
    const quoteUrl = options?.quotationUrl || (shouldIncludeLink ? buildQuotationPortalUrl(item, { quantity: qty, location }) : undefined);

    return [
        "PROCUREMENT ITEM SPECIFICATION",
        `Item Name: ${item.item_name}`,
        `Required Quantity: ${qty} ${unit}`,
        `Delivery Location: ${location}`,
        quoteUrl ? `Quotation Submission Link: ${quoteUrl}` : "",
        item.description ? `Description: ${item.description}` : "",
    ]
        .filter(Boolean)
        .join("\n");
}

/**
 * Template D: Consolidated Sourcing List (Bulk)
 */
export function formatBatchSourcingList(
    items: StockShortageItem[],
    quantities?: Record<string, number>,
    location?: string
): string {
    const dest = location || DEFAULT_LOCATION;
    const envBase = (process.env.NEXT_PUBLIC_SUPPLYCHAIN_APP_URL || "").trim().replace(/\/+$/, "");
    const base = envBase || "https://sc.airship-express.com";

    const lines: string[] = [
        "🛒 [LOOKING FOR SUPPLIERS / BULK PROCUREMENT REQUISITION]",
        "───────────────────────────────────────",
        `Company: Airship Express Procurement`,
        `Delivery Destination: ${dest}`,
        `Total Items Needed: ${items.length}`,
        "",
        "Items Sourcing List:",
    ];

    items.forEach((item, idx) => {
        const itemKey = String(item.id || item.item_code || idx);
        const qty = quantities?.[itemKey] ?? item.deficit ?? 1;
        const unit = item.unit || "units";
        lines.push(
            `${idx + 1}. ${item.item_name} - Qty: ${qty} ${unit}`
        );
    });

    lines.push(
        "",
        "───────────────────────────────────────",
        `🌐 Submit quotations online: ${base}/supplier-portal/quote`,
        "📩 Direct distributors or suppliers: please PM with your price list, availability, and lead time. Thank you!"
    );

    return lines.join("\n");
}
