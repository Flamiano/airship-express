"use client";

import React, { useState, useMemo } from "react";
import { 
    X, 
    Copy, 
    Check, 
    ExternalLink, 
    Sparkles, 
    Store, 
    MessageSquare, 
    FileText, 
    Package, 
    Share2,
    RefreshCw,
    Link2,
    FileSpreadsheet
} from "lucide-react";
import { toast } from "sonner";
import Portal from "../../../components/client/Portal";
import type { StockShortageItem } from "../types/index";
import {
    formatFacebookMarketplacePost,
    formatViberRFQPost,
    formatPlainTextSpec,
    buildQuotationPortalUrl,
    copyTextToClipboard,
} from "../utils/marketplacePostFormatter";

export interface MarketplaceCopyModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: StockShortageItem | null;
    initialQuantity?: number;
}

type TemplateType = "facebook" | "viber" | "plain";

export function MarketplaceCopyModal({
    isOpen,
    onClose,
    item,
    initialQuantity,
}: MarketplaceCopyModalProps) {
    const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>("facebook");
    const [quantity, setQuantity] = useState<number>(() => {
        if (!item) return 1;
        const defQty = initialQuantity !== undefined 
            ? initialQuantity 
            : (item.remaining_deficit !== undefined ? Number(item.remaining_deficit) : Number(item.deficit || 1));
        return Math.max(1, defQty);
    });
    const [location, setLocation] = useState<string>("Binondo, Manila (Airship HQ) / Metro Manila");
    const [targetPrice, setTargetPrice] = useState<string>(() => {
        const refPrice = item?.previous_unit_price || item?.purchase_price;
        return refPrice && Number(refPrice) > 0 ? String(refPrice) : "";
    });
    const [customNotes, setCustomNotes] = useState<string>(() => item?.description || "");
    const [includeQuotationLink, setIncludeQuotationLink] = useState<boolean>(true);
    const [customText, setCustomText] = useState<string>("");
    const [isCustomEdited, setIsCustomEdited] = useState<boolean>(false);
    const [copied, setCopied] = useState<boolean>(false);
    const [copiedLink, setCopiedLink] = useState<boolean>(false);

    // Dynamic Quotation Portal URL for this item
    const quoteUrl = useMemo(() => {
        if (!item) return "";
        return buildQuotationPortalUrl(item, { quantity, location });
    }, [item, quantity, location]);

    // Computed text based on active template & inputs
    const generatedText = useMemo(() => {
        if (!item) return "";
        const numPrice = targetPrice ? parseFloat(targetPrice) : undefined;
        const validPrice = numPrice !== undefined && !Number.isNaN(numPrice) ? numPrice : null;
        const opts = {
            quantity,
            location,
            customNotes,
            targetPrice: validPrice,
            quotationUrl: quoteUrl,
            includeQuotationLink,
        };

        if (selectedTemplate === "facebook") {
            return formatFacebookMarketplacePost(item, opts);
        }
        if (selectedTemplate === "viber") {
            return formatViberRFQPost(item, opts);
        }
        return formatPlainTextSpec(item, opts);
    }, [item, selectedTemplate, quantity, location, targetPrice, customNotes, quoteUrl, includeQuotationLink]);

    // Actual active text (falls back to generated unless manually edited)
    const activeText = isCustomEdited ? customText : generatedText;

    const handleCopy = async () => {
        if (!activeText) return;
        const ok = await copyTextToClipboard(activeText);
        if (ok) {
            setCopied(true);
            toast.success("Marketplace post template copied to clipboard!", {
                description: includeQuotationLink 
                    ? "Post includes the online quotation submission link. Ready to paste!"
                    : "Ready to paste into Facebook Marketplace, Viber, or supplier channels.",
            });
            setTimeout(() => setCopied(false), 2500);
        } else {
            toast.error("Failed to copy. Please manually select and copy the text.");
        }
    };

    const handleCopyLinkOnly = async () => {
        if (!quoteUrl) return;
        const ok = await copyTextToClipboard(quoteUrl);
        if (ok) {
            setCopiedLink(true);
            toast.success("Quotation submission link copied!", {
                description: "Suppliers can click this link to submit price bids and terms directly.",
            });
            setTimeout(() => setCopiedLink(false), 2200);
        } else {
            toast.error("Failed to copy quotation link.");
        }
    };

    const handleResetToGenerated = () => {
        setIsCustomEdited(false);
        setCustomText("");
        toast.info("Reset preview to default template.");
    };

    if (!isOpen || !item) return null;

    return (
        <Portal>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
                <div 
                    className="w-full max-w-2xl bg-[#ebf0f7] dark:bg-[#141624] rounded-3xl border border-white/80 dark:border-white/[0.08] shadow-[-8px_-8px_24px_rgba(255,255,255,0.95),_8px_8px_24px_rgba(163,177,198,0.45)] dark:shadow-[-4px_-4px_16px_rgba(255,255,255,0.02),_6px_6px_24px_rgba(0,0,0,0.85)] flex flex-col max-h-[92vh] overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-4 sm:p-5 border-b border-slate-300/60 dark:border-white/[0.06] flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#181a28] text-pink-600 dark:text-pink-400 border border-white/90 dark:border-white/[0.05] shadow-[-2px_-2px_6px_rgba(255,255,255,0.95),_2px_2px_6px_rgba(163,177,198,0.4)] dark:shadow-[-1px_-1px_3px_rgba(255,255,255,0.02),_2px_2px_5px_rgba(0,0,0,0.6)] flex items-center justify-center shrink-0">
                                <Share2 className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate flex items-center gap-2">
                                    <span>Copy for Marketplace &amp; Sourcing</span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-800/40">
                                        Stage 2
                                    </span>
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium">
                                    Format item details and quotation link for Facebook Marketplace or supplier chats
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-xl bg-[#ebf0f7] dark:bg-[#181a28] text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 flex items-center justify-center border border-white/80 dark:border-white/[0.05] shadow-[-2px_-2px_5px_rgba(255,255,255,0.9),_2px_2px_5px_rgba(163,177,198,0.35)] dark:shadow-[-1px_-1px_3px_rgba(255,255,255,0.02),_2px_2px_4px_rgba(0,0,0,0.5)] transition-all cursor-pointer"
                            title="Close"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Scrollable Content Body */}
                    <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
                        {/* Target Item summary badge */}
                        <div className="p-3 rounded-2xl bg-[#e2e8f0]/80 dark:bg-[#10121d] border border-white/60 dark:border-white/[0.04] shadow-[inset_1.5px_1.5px_4px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)] flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <Package className="w-4 h-4 text-pink-500 shrink-0" />
                                <div className="min-w-0">
                                    <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                                        {item.item_name}
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                        <span className="font-mono">{item.item_code}</span>
                                        <span>•</span>
                                        <span>{item.category}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black uppercase text-slate-400 block">Current Deficit</span>
                                <span className="text-xs font-mono font-black text-rose-600 dark:text-rose-400">
                                    {item.deficit} {item.unit}
                                </span>
                            </div>
                        </div>

                        {/* Template Tabs */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                                Choose Post Format
                            </label>
                            <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-[#e2e8f0]/80 dark:bg-[#10121d] border border-white/60 dark:border-white/[0.04] shadow-[inset_1.5px_1.5px_4px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)]">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedTemplate("facebook");
                                        setIsCustomEdited(false);
                                    }}
                                    className={`py-2 px-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                        selectedTemplate === "facebook"
                                            ? "bg-pink-600 text-white shadow-[-1px_-1px_3px_rgba(255,255,255,0.5),_2px_2px_6px_rgba(219,39,119,0.45)]"
                                            : "text-slate-600 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400"
                                    }`}
                                >
                                    <Store className="w-3.5 h-3.5" />
                                    <span className="truncate">FB Marketplace</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedTemplate("viber");
                                        setIsCustomEdited(false);
                                    }}
                                    className={`py-2 px-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                        selectedTemplate === "viber"
                                            ? "bg-pink-600 text-white shadow-[-1px_-1px_3px_rgba(255,255,255,0.5),_2px_2px_6px_rgba(219,39,119,0.45)]"
                                            : "text-slate-600 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400"
                                    }`}
                                >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    <span className="truncate">Viber / Chat</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedTemplate("plain");
                                        setIsCustomEdited(false);
                                    }}
                                    className={`py-2 px-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                        selectedTemplate === "plain"
                                            ? "bg-pink-600 text-white shadow-[-1px_-1px_3px_rgba(255,255,255,0.5),_2px_2px_6px_rgba(219,39,119,0.45)]"
                                            : "text-slate-600 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400"
                                    }`}
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span className="truncate">Plain Specs</span>
                                </button>
                            </div>
                        </div>

                        {/* Quotation Submission Link Card */}
                        <div className="p-3.5 rounded-2xl bg-[#e2e8f0]/80 dark:bg-[#10121d] border border-white/60 dark:border-white/[0.04] shadow-[inset_1.5px_1.5px_4px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)] space-y-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                    <Link2 className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                                        Online Quotation Submission Link
                                    </span>
                                </div>
                                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={includeQuotationLink}
                                        onChange={(e) => {
                                            setIncludeQuotationLink(e.target.checked);
                                            setIsCustomEdited(false);
                                        }}
                                        className="accent-pink-600 cursor-pointer rounded"
                                    />
                                    <span>Include quotation link in post</span>
                                </label>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="relative flex-1 min-w-0">
                                    <input
                                        type="text"
                                        readOnly
                                        value={quoteUrl}
                                        className="w-full px-3 py-2 rounded-xl bg-[#ebf0f7] dark:bg-[#141624] border border-white/70 dark:border-white/[0.04] text-[11px] font-mono font-medium text-slate-700 dark:text-slate-300 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.2)] focus:outline-none select-all truncate"
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={handleCopyLinkOnly}
                                    className="px-3.5 py-2 rounded-xl bg-[#ebf0f7] dark:bg-[#181a28] text-slate-700 dark:text-slate-200 hover:text-pink-600 dark:hover:text-pink-400 text-xs font-bold border border-white/80 dark:border-white/[0.05] shadow-[-2px_-2px_5px_rgba(255,255,255,0.9),_2px_2px_5px_rgba(163,177,198,0.3)] dark:shadow-[-1px_-1px_3px_rgba(255,255,255,0.02),_2px_2px_4px_rgba(0,0,0,0.6)] flex items-center gap-1.5 shrink-0 cursor-pointer transition-all"
                                    title="Copy quotation submission link to clipboard"
                                >
                                    {copiedLink ? (
                                        <>
                                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">Copied</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3.5 h-3.5" />
                                            <span className="text-[11px]">Copy Link</span>
                                        </>
                                    )}
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-400">
                                This link is generated using NEXT_PUBLIC_SUPPLYCHAIN_APP_URL. Vendors clicking this link are taken directly to the Supplier Portal with item name, quantity, and SKU pre-filled.
                            </p>
                        </div>

                        {/* Customization Inputs Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* Quantity */}
                            <div>
                                <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 block mb-1">
                                    Quantity ({item.unit || "units"})
                                </label>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        min={1}
                                        value={quantity}
                                        onChange={(e) => {
                                            const val = Math.max(1, parseInt(e.target.value) || 1);
                                            setQuantity(val);
                                            setIsCustomEdited(false);
                                        }}
                                        className="w-full px-3 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#12131f] border border-white/70 dark:border-white/[0.04] text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] font-mono"
                                    />
                                </div>
                            </div>

                            {/* Reference Price */}
                            <div>
                                <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 block mb-1">
                                    Ref / Target Price (₱)
                                </label>
                                <input
                                    type="number"
                                    placeholder="Optional"
                                    value={targetPrice}
                                    onChange={(e) => {
                                        setTargetPrice(e.target.value);
                                        setIsCustomEdited(false);
                                    }}
                                    className="w-full px-3 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#12131f] border border-white/70 dark:border-white/[0.04] text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] font-mono"
                                />
                            </div>

                            {/* Location */}
                            <div>
                                <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 block mb-1">
                                    Delivery Dropoff
                                </label>
                                <input
                                    type="text"
                                    value={location}
                                    onChange={(e) => {
                                        setLocation(e.target.value);
                                        setIsCustomEdited(false);
                                    }}
                                    className="w-full px-3 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#12131f] border border-white/70 dark:border-white/[0.04] text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] truncate"
                                />
                            </div>

                            {/* Custom Notes / Specs */}
                            <div>
                                <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 block mb-1">
                                    Notes / Specs (Optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Brand, specs, urgency"
                                    value={customNotes}
                                    onChange={(e) => {
                                        setCustomNotes(e.target.value);
                                        setIsCustomEdited(false);
                                    }}
                                    className="w-full px-3 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#12131f] border border-white/70 dark:border-white/[0.04] text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] truncate"
                                />
                            </div>
                        </div>

                        {/* Live Post Preview (Editable Textarea) */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-black">
                                <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-pink-500" />
                                    <span>Live Post Preview (You can edit directly before copying)</span>
                                </span>
                                {isCustomEdited && (
                                    <button
                                        type="button"
                                        onClick={handleResetToGenerated}
                                        className="text-[10px] text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                        <span>Reset to template</span>
                                    </button>
                                )}
                            </div>

                            <div className="relative">
                                <textarea
                                    rows={8}
                                    value={activeText}
                                    onChange={(e) => {
                                        setIsCustomEdited(true);
                                        setCustomText(e.target.value);
                                    }}
                                    className="w-full p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#10121d] border border-white/70 dark:border-white/[0.04] text-xs font-mono font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40 shadow-[inset_2px_2px_6px_rgba(163,177,198,0.35),_inset_-2px_-2px_6px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.7)] resize-none"
                                />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                                <span>{activeText.split("\n").length} lines • {activeText.length} characters</span>
                                <span>Paste anywhere: Facebook, Viber, Telegram, or Email</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 sm:p-5 border-t border-slate-300/60 dark:border-white/[0.06] flex items-center justify-between gap-3 flex-wrap bg-[#ebf0f7]/50 dark:bg-[#12131f]/50">
                        <div className="flex items-center gap-2 flex-wrap">
                            <a
                                href="https://www.facebook.com/marketplace/create/item"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3.5 py-2 rounded-xl bg-[#ebf0f7] dark:bg-[#181a28] text-slate-700 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 text-xs font-bold border border-white/80 dark:border-white/[0.05] shadow-[-2px_-2px_5px_rgba(255,255,255,0.9),_2px_2px_5px_rgba(163,177,198,0.3)] dark:shadow-[-1px_-1px_3px_rgba(255,255,255,0.02),_2px_2px_4px_rgba(0,0,0,0.6)] flex items-center gap-1.5 transition-all cursor-pointer"
                                title="Open Facebook Marketplace Create Listing in a new tab"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Facebook Marketplace</span>
                            </a>

                            <a
                                href="/procurement?stage=3"
                                className="px-3.5 py-2 rounded-xl bg-[#ebf0f7] dark:bg-[#181a28] text-pink-600 dark:text-pink-400 hover:text-pink-700 text-xs font-bold border border-white/80 dark:border-white/[0.05] shadow-[-2px_-2px_5px_rgba(255,255,255,0.9),_2px_2px_5px_rgba(163,177,198,0.3)] dark:shadow-[-1px_-1px_3px_rgba(255,255,255,0.02),_2px_2px_4px_rgba(0,0,0,0.6)] flex items-center gap-1.5 transition-all cursor-pointer"
                                title="View and compare quotations in Stage 3"
                            >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                <span>View Quotations (Stage 3) &rarr;</span>
                            </a>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-xl bg-[#ebf0f7] dark:bg-[#181a28] text-slate-600 dark:text-slate-400 text-xs font-bold hover:text-slate-800 dark:hover:text-slate-200 transition-all cursor-pointer"
                            >
                                Close
                            </button>

                            <button
                                type="button"
                                onClick={handleCopy}
                                className="px-5 py-2.5 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black shadow-[-2px_-2px_6px_rgba(255,255,255,0.6),_3px_3px_8px_rgba(219,39,119,0.45)] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.3)] flex items-center gap-2 cursor-pointer transition-all"
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-4 h-4 text-emerald-200" />
                                        <span>Copied!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4" />
                                        <span>Copy to Clipboard</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
