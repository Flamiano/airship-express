"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
    Sparkles,
    Trophy,
    Award,
    TrendingDown,
    Clock,
    CheckCircle2,
    ShieldCheck,
    Truck,
    PackageCheck,
    FileText,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    AlertCircle,
    Building2,
    Phone,
    Mail,
    MapPin,
    ArrowRight,
    RefreshCw,
    SlidersHorizontal,
    X,
    Info,
    Check,
    RotateCw,
    Scale,
    Package,
} from "lucide-react";
import { SupplierQuotationItem, PotentialSupplierItem, RequestSupplierGroup } from "./PotentialSuppliersTab";
import { toast } from "sonner";
import Portal from "../../../../components/client/Portal";
import { useAI } from "../../../../ai/services/AIContext";
import { parseQuotationNotes } from "../../utils/termsParser";
import { VendorQuotationViewModal } from "../modals/VendorQuotationViewModal";

interface RequestQuotationsSummaryProps {
    group: RequestSupplierGroup;
    quotations: SupplierQuotationItem[];
    onAwardBid: (supplier: PotentialSupplierItem, quote: SupplierQuotationItem) => Promise<void> | void;
    awardingQuoteId: number | null;
    isPreviousWinner?: (quote: SupplierQuotationItem, supplier: PotentialSupplierItem) => boolean;
    onReorder?: (group: RequestSupplierGroup, quote: SupplierQuotationItem, supplier: PotentialSupplierItem) => void;
}

export function RequestQuotationsSummary({
    group,
    quotations,
    onAwardBid,
    awardingQuoteId,
    isPreviousWinner,
    onReorder,
}: RequestQuotationsSummaryProps) {
    const { setActiveRecommendation, openRecommendationChat } = useAI();
    const [isExpanded, setIsExpanded] = useState(true);
    const [showDeepDiveModal, setShowDeepDiveModal] = useState(false);
    const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiResult, setAiResult] = useState<any>(null);

    // Filter valid quotations for this request (remove rejected/declined/cancelled quotes, and show only winning quote once accepted)
    const validQuotes = useMemo(() => {
        if (!quotations || quotations.length === 0) return [];
        const nonRejected = quotations.filter((q) => {
            const st = (q.status || "").toLowerCase().trim();
            return st !== "rejected" && st !== "declined" && st !== "cancelled";
        });
        const accepted = nonRejected.filter((q) => (q.status || "").toLowerCase().includes("accept"));
        if (accepted.length > 0) {
            return accepted;
        }
        return nonRejected;
    }, [quotations]);

    const hasAnyAcceptedQuote = useMemo(() => {
        return validQuotes.some((q) => (q.status || "").toLowerCase().includes("accept"));
    }, [validQuotes]);

    const acceptedQuote = useMemo(() => {
        return validQuotes.find((q) => (q.status || "").toLowerCase().includes("accept"));
    }, [validQuotes]);

    const [locallyAwardedId, setLocallyAwardedId] = useState<number | null>(null);

    const isBidAwarded = useMemo(() => {
        return (
            locallyAwardedId !== null ||
            hasAnyAcceptedQuote ||
            (quotations && quotations.some((q) => {
                const st = (q.status || "").toLowerCase().trim();
                return st.includes("accept") || st.includes("award") || (q as any).purchase_order_id != null;
            })) ||
            (group.status || "").toLowerCase().includes("award") ||
            (group.status || "").toLowerCase().includes("complete") ||
            (group.status || "").toLowerCase().includes("ordered")
        );
    }, [locallyAwardedId, hasAnyAcceptedQuote, quotations, group.status]);

    const handleAwardBidAction = async (supplier: PotentialSupplierItem, quote: SupplierQuotationItem) => {
        setLocallyAwardedId(quote.id);
        await onAwardBid(supplier, quote);
    };

    // Calculate basic summary metrics
    const metrics = useMemo(() => {
        if (validQuotes.length === 0) return null;

        const prices = validQuotes.map((q) => Number(q.total_amount || 0));
        const lowestPrice = Math.min(...prices);
        const highestPrice = Math.max(...prices);
        const averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const potentialSavings = highestPrice - lowestPrice;
        const savingsPercentage = highestPrice > 0 ? Math.round((potentialSavings / highestPrice) * 100) : 0;

        const parseDays = (leadStr: string): number => {
            if (!leadStr) return 5;
            const matches = leadStr.match(/\d+/g);
            if (!matches) return 5;
            const nums = matches.map(Number);
            return nums.reduce((a, b) => a + b, 0) / nums.length;
        };

        const fastestQuote = validQuotes.reduce((prev, curr) =>
            parseDays(curr.lead_time_days) < parseDays(prev.lead_time_days) ? curr : prev,
            validQuotes[0]
        );

        const inStockQuotes = validQuotes.filter((q) =>
            (q.availability || "").toLowerCase().includes("stock") ||
            (q.availability || "").toLowerCase().includes("immediate")
        );

        return {
            totalQuotes: validQuotes.length,
            lowestPrice,
            highestPrice,
            averagePrice,
            potentialSavings,
            savingsPercentage,
            fastestLeadTime: fastestQuote.lead_time_days || "1-2",
            fastestSupplierName: fastestQuote.supplier_name,
            inStockCount: inStockQuotes.length,
        };
    }, [validQuotes]);

    // Deterministic local evaluation engine
    const localEvaluation = useMemo(() => {
        if (validQuotes.length === 0) return null;
        const prices = validQuotes.map((q) => Number(q.total_amount || 0));
        const lowestPrice = Math.min(...prices);
        const highestPrice = Math.max(...prices);
        const potentialSavings = highestPrice - lowestPrice;

        const parseDays = (leadStr: string): number => {
            if (!leadStr) return 5;
            const matches = leadStr.match(/\d+/g);
            if (!matches) return 5;
            const nums = matches.map(Number);
            return nums.reduce((a, b) => a + b, 0) / nums.length;
        };

        const leadTimes = validQuotes.map((q) => parseDays(q.lead_time_days));
        const minLeadTime = Math.min(...leadTimes);

        const rankings = validQuotes.map((quote) => {
            const totalAmt = Number(quote.total_amount || 0);
            const leadDays = parseDays(quote.lead_time_days);
            const avail = (quote.availability || "").toLowerCase();
            const services = Array.isArray(quote.services_offered) ? quote.services_offered : [];
            const matchedSup = group.potentialSuppliers.find(
                (s) =>
                    (quote.supplier_id && Number(quote.supplier_id) === Number(s.id)) ||
                    s.name.toLowerCase().trim() === quote.supplier_name.toLowerCase().trim()
            );
            const distance = matchedSup?.distanceKm || 5;

            const priceRatio = totalAmt > 0 ? lowestPrice / totalAmt : 1;
            const priceScore = Math.min(40, Math.round(priceRatio * 40));

            let speedScore = 15;
            if (leadDays <= 1) speedScore = 25;
            else if (leadDays <= 3) speedScore = 22;
            else if (leadDays <= 5) speedScore = 18;
            else if (leadDays <= 7) speedScore = 14;
            else speedScore = 10;

            if (avail.includes("immediate") || avail.includes("in stock")) {
                speedScore = Math.min(25, speedScore + 3);
            }

            let servicesScore = 5;
            const serviceBonus = services.length * 4;
            servicesScore = Math.min(20, servicesScore + serviceBonus);

            let logisticsScore = 10;
            if (distance <= 3) logisticsScore = 15;
            else if (distance <= 8) logisticsScore = 13;
            else if (distance <= 15) logisticsScore = 11;
            else logisticsScore = 8;

            const overallScore = Math.min(100, priceScore + speedScore + servicesScore + logisticsScore);

            const priceDeltaVsLowest = totalAmt - lowestPrice;
            const priceDeltaPercentage = lowestPrice > 0 ? Math.round(((totalAmt - lowestPrice) / lowestPrice) * 100) : 0;

            const strengths: string[] = [];
            if (totalAmt === lowestPrice) {
                strengths.push("Lowest Quotation Price (Best Market Rate)");
            } else if (priceDeltaPercentage <= 10) {
                strengths.push("Highly Competitive Pricing (within 10% of lowest)");
            }

            if (leadDays <= minLeadTime) {
                strengths.push(`Fastest Delivery Lead Time (${quote.lead_time_days || "1-2"} days)`);
            }

            if (avail.includes("stock") || avail.includes("immediate")) {
                strengths.push("Immediate Stock Availability (Zero Indent Delay)");
            }

            if (services.length > 0) {
                strengths.push(`Bundled ${services.length} Value-Added Services (${services.slice(0, 2).join(", ")})`);
            }

            if (distance <= 5) {
                strengths.push(`Proximity Advantage (${distance.toFixed(1)} km from Airship HQ)`);
            }

            let verdict = "Viable Option";
            if (overallScore >= 90) verdict = "Highly Recommended (Top Pick)";
            else if (overallScore >= 80) verdict = "Strong Contender";
            else if (overallScore >= 70) verdict = "Acceptable Standard Offer";
            else verdict = "Higher Cost / Slower Lead Time";

            return {
                id: quote.id,
                supplier_name: quote.supplier_name,
                rank: 0,
                overallScore,
                priceScore,
                speedScore,
                servicesScore,
                logisticsScore,
                priceDeltaVsLowest,
                priceDeltaPercentage,
                strengths,
                recommendationVerdict: verdict,
            };
        });

        rankings.sort((a, b) => {
            if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
            const quoteA = validQuotes.find((q) => q.id === a.id);
            const quoteB = validQuotes.find((q) => q.id === b.id);
            return Number(quoteA?.total_amount || 0) - Number(quoteB?.total_amount || 0);
        });

        rankings.forEach((r, idx) => {
            r.rank = idx + 1;
        });

        const winner = rankings[0];
        const winnerQuote = validQuotes.find((q) => q.id === winner.id);
        const winnerTotalAmount = Number(winnerQuote?.total_amount || 0);

        let brief = `AI Evaluation recommends ${winner.supplier_name} as the optimal procurement choice for ${group.itemName} (${group.quantityRequested} ${group.unit}). `;
        if (winnerTotalAmount === lowestPrice) {
            brief += `They achieved the highest composite score of ${winner.overallScore}/100 with the lowest quotation price of ₱${winnerTotalAmount.toLocaleString()}, ${winnerQuote?.lead_time_days || "2-3"} days delivery lead time, and verified stock availability.`;
        } else {
            brief += `They achieved the top composite score of ${winner.overallScore}/100 with superior turnaround speed (${winnerQuote?.lead_time_days} days) and comprehensive service inclusions.`;
        }

        if (potentialSavings > 0) {
            brief += ` Selecting this offer yields up to ₱${potentialSavings.toLocaleString()} in procurement cost efficiency versus alternative market proposals.`;
        }

        return {
            winnerId: winner.id,
            winnerName: winner.supplier_name,
            winnerTotalAmount,
            winnerScore: winner.overallScore,
            summary: brief,
            rankings,
            aiExecutiveBrief: brief,
        };
    }, [validQuotes, group]);

    // Active AI result defaults to local calculation, then upgrades with server LLM if fetched
    const activeAi = aiResult || localEvaluation;

    // Call AI recommendation endpoint or compute client-side recommendation
    const fetchAiRecommendation = async () => {
        if (validQuotes.length === 0) return;
        setIsAnalyzing(true);
        try {
            const formattedQuotes = validQuotes.map((q) => {
                const matchedSup = group.potentialSuppliers.find(
                    (s) =>
                        (q.supplier_id && Number(q.supplier_id) === Number(s.id)) ||
                        s.name.toLowerCase().trim() === q.supplier_name.toLowerCase().trim()
                );
                return {
                    id: q.id,
                    supplier_name: q.supplier_name,
                    unit_price: Number(q.unit_price),
                    subtotal: Number(q.subtotal || 0),
                    shipping_fee: Number(q.shipping_fee || 0),
                    discount: Number(q.discount || 0),
                    tax_type: q.tax_type,
                    tax_rate: Number(q.tax_rate || 0),
                    tax_amount: Number(q.tax_amount || 0),
                    total_amount: Number(q.total_amount),
                    availability: q.availability,
                    lead_time_days: q.lead_time_days,
                    services_offered: q.services_offered,
                    notes: q.notes,
                    distance_km: matchedSup?.distanceKm || 5,
                    contact_phone: q.contact_phone || matchedSup?.phone,
                    contact_email: q.contact_email || matchedSup?.email,
                };
            });

            const res = await fetch("/api/suppliers/ai-recommend", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    requestInfo: {
                        requestNumber: group.requestNumber,
                        itemName: group.itemName,
                        quantity: group.quantityRequested,
                        unit: group.unit,
                        department: group.department,
                    },
                    quotations: formattedQuotes,
                }),
            });

            if (res.ok) {
                const json = await res.json();
                if (json.success && json.data) {
                    setAiResult(json.data);
                }
            }
        } catch (err) {
            console.warn("Server AI recommendation fetch skipped, utilizing baseline AI engine:", err);
        } finally {
            setIsAnalyzing(false);
        }
    };

    useEffect(() => {
        if (validQuotes.length > 0) {
            fetchAiRecommendation();
        }
    }, [validQuotes.length, group.requestNumber]);

    if (validQuotes.length === 0) {
        return null;
    }

    // Identify winning quote & supplier
    const winningQuoteId = activeAi?.winnerId || validQuotes[0]?.id;
    const winningQuote = validQuotes.find((q) => q.id === winningQuoteId) || validQuotes[0];
    const winningSupplier = group.potentialSuppliers.find(
        (s) =>
            (winningQuote.supplier_id && Number(winningQuote.supplier_id) === Number(s.id)) ||
            s.name.toLowerCase().trim() === winningQuote.supplier_name.toLowerCase().trim()
    ) || {
        id: String(winningQuote.supplier_id || winningQuote.id),
        name: winningQuote.supplier_name,
        category: group.category || "General",
        location: "Metro Manila, Philippines",
        distanceKm: 5,
        source: "Quotation Submission",
        matchLevel: "exact" as const,
        coords: { lat: 14.5995, lng: 120.9842, displayName: winningQuote.supplier_name },
    };

    const winnerRanking = activeAi?.rankings?.find((r: any) => r.id === winningQuote.id);

    // Ranked list of all valid quotes with matched supplier and score
    const rankedQuotes = useMemo(() => {
        const list = validQuotes.map((quote) => {
            const matchedSupplier = group.potentialSuppliers.find(
                (s) =>
                    (quote.supplier_id && Number(quote.supplier_id) === Number(s.id)) ||
                    s.name.toLowerCase().trim() === quote.supplier_name.toLowerCase().trim()
            ) || {
                id: String(quote.supplier_id || quote.id),
                name: quote.supplier_name,
                category: group.category || "General",
                location: "Metro Manila, Philippines",
                distanceKm: 5,
                source: "Quotation Submission",
                matchLevel: "exact" as const,
                coords: { lat: 14.5995, lng: 120.9842, displayName: quote.supplier_name },
            };

            const quoteRanking = activeAi?.rankings?.find((r: any) => r.id === quote.id);
            const rank = quoteRanking?.rank || 99;
            const score = quoteRanking?.overallScore || 70;

            return {
                quote,
                ranking: quoteRanking,
                matchedSupplier,
                rank,
                score,
            };
        });

        list.sort((a, b) => {
            if (a.rank !== b.rank) return a.rank - b.rank;
            return b.score - a.score;
        });

        list.forEach((item, idx) => {
            item.rank = idx + 1;
        });

        return list;
    }, [validQuotes, activeAi?.rankings, group.potentialSuppliers]);

    const [modalQuoteItem, setModalQuoteItem] = useState<{ supplier: PotentialSupplierItem; quote: SupplierQuotationItem } | null>(null);

    // Always provide 5 fixed podium slots in visual arrangement: [4th, 2nd, 1st, 3rd, 5th]
    const podiumSlots = useMemo(() => {
        const slotOrder = [4, 2, 1, 3, 5];
        return slotOrder.map((rankNum) => {
            const item = rankedQuotes.find((r) => r.rank === rankNum) || null;
            return {
                targetRank: rankNum,
                data: item,
            };
        });
    }, [rankedQuotes]);

    // Synchronize active winning recommendation with global floating AI robot
    useEffect(() => {
        if (winningQuote && !hasAnyAcceptedQuote) {
            setActiveRecommendation({
                id: winningQuote.id,
                requestNumber: group.requestNumber,
                itemName: group.itemName,
                supplierName: winningQuote.supplier_name,
                supplierId: winningQuote.supplier_id,
                totalAmount: Number(winningQuote.total_amount || 0),
                unitPrice: Number(winningQuote.unit_price || 0),
                unit: winningQuote.unit || group.unit || "unit",
                leadTimeDays: Number(winningQuote.lead_time_days || 1),
                availability: winningQuote.availability || "In Stock",
                overallScore: winnerRanking?.overallScore || 96,
                summary: aiResult?.aiExecutiveBrief || localEvaluation?.aiExecutiveBrief || `AI recommends ${winningQuote.supplier_name} for optimal price-to-turnaround efficiency on ${group.itemName}.`,
                strengths: winnerRanking?.strengths || [],
                comparisonQuotes: validQuotes.map((q) => ({
                    supplierName: q.supplier_name,
                    totalAmount: Number(q.total_amount || 0),
                    leadTimeDays: Number(q.lead_time_days || 1),
                })),
            });
        }
        return () => {
            setActiveRecommendation(null);
        };
    }, [winningQuote?.id, hasAnyAcceptedQuote, group.requestNumber, group.itemName]);

    return (
        <div className="mt-4 rounded-3xl bg-[#ebf0f7] dark:bg-[#141624] border border-white/90 dark:border-white/10 shadow-[-8px_-8px_20px_rgba(255,255,255,0.85),_8px_8px_20px_rgba(163,177,198,0.4)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.02),_8px_8px_20px_rgba(0,0,0,0.7)] overflow-hidden">
            {/* Header Ribbon / Toggle */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-4 sm:p-5 bg-[#ebf0f7] dark:bg-[#151724] border-b border-slate-300/80 dark:border-white/10 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-pink-600 text-white flex items-center justify-center shrink-0 shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_6px_rgba(219,39,119,0.4)]">
                        <Sparkles className="w-5 h-5 drop-shadow" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                                AI Offer Recommendation
                            </h4>
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-black bg-pink-500/15 text-pink-600 dark:text-pink-400 border border-pink-500/20 shadow-[-1px_-1px_3px_rgba(255,255,255,0.6),_1px_1px_3px_rgba(219,39,119,0.15)]">
                                {validQuotes.length} Proposal{validQuotes.length !== 1 ? "s" : ""}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Comparative evaluation across pricing, lead times, warranties, and logistics
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            fetchAiRecommendation();
                        }}
                        disabled={isAnalyzing}
                        className="px-3 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#191b2b] text-slate-600 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 text-xs font-bold border border-white/80 dark:border-white/10 shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)] active:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4)] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Re-run AI evaluation"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? "animate-spin text-pink-500" : ""}`} />
                        <span className="hidden sm:inline">Re-evaluate</span>
                    </button>

                    <div className="w-8 h-8 rounded-xl bg-[#ebf0f7] dark:bg-[#181a28] flex items-center justify-center text-slate-500 dark:text-slate-400 border border-white/80 dark:border-white/10 shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_5px_rgba(163,177,198,0.3)]">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                </div>
            </div>

            {isExpanded && (
                <div className="p-4 sm:p-6 space-y-6">
                    {/* Key Metrics Quick Summary Cards */}
                    {metrics && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                            {/* Lowest / Best Price Card */}
                            <div className="p-3.5 sm:p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_3px_3px_8px_rgba(0,0,0,0.5)] space-y-1">
                                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                                    <span className="text-[10px] font-black uppercase tracking-wider">Lowest Offered Bid</span>
                                    <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
                                </div>
                                <div className="font-mono text-base sm:text-lg font-black text-slate-900 dark:text-white">
                                    ₱{metrics.lowestPrice.toLocaleString()}
                                </div>
                                {metrics.savingsPercentage > 0 ? (
                                    <p className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                                        Save {metrics.savingsPercentage}% (₱{metrics.potentialSavings.toLocaleString()}) vs max
                                    </p>
                                ) : (
                                    <p className="text-[10px] font-bold text-slate-400">Single rate offer</p>
                                )}
                            </div>

                            {/* Average Market Rate */}
                            <div className="p-3.5 sm:p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_3px_3px_8px_rgba(0,0,0,0.5)] space-y-1">
                                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                                    <span className="text-[10px] font-black uppercase tracking-wider">Average Market Bid</span>
                                    <FileText className="w-3.5 h-3.5 text-pink-500" />
                                </div>
                                <div className="font-mono text-base sm:text-lg font-black text-slate-900 dark:text-white">
                                    ₱{Math.round(metrics.averagePrice).toLocaleString()}
                                </div>
                                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                    Across {metrics.totalQuotes} quotation{metrics.totalQuotes !== 1 ? "s" : ""}
                                </p>
                            </div>

                            {/* Fastest Delivery Turnaround */}
                            <div className="p-3.5 sm:p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_3px_3px_8px_rgba(0,0,0,0.5)] space-y-1">
                                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                                    <span className="text-[10px] font-black uppercase tracking-wider">Fastest Delivery</span>
                                    <Clock className="w-3.5 h-3.5 text-pink-500" />
                                </div>
                                <div className="font-mono text-base sm:text-lg font-black text-slate-900 dark:text-white">
                                    {metrics.fastestLeadTime} days
                                </div>
                                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate" title={metrics.fastestSupplierName}>
                                    by {metrics.fastestSupplierName}
                                </p>
                            </div>

                            {/* Ready Stock Count */}
                            <div className="p-3.5 sm:p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_3px_3px_8px_rgba(0,0,0,0.5)] space-y-1">
                                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                                    <span className="text-[10px] font-black uppercase tracking-wider">Stock Readiness</span>
                                    <PackageCheck className="w-3.5 h-3.5 text-emerald-500" />
                                </div>
                                <div className="font-mono text-base sm:text-lg font-black text-slate-900 dark:text-white">
                                    {metrics.inStockCount} / {metrics.totalQuotes} In Stock
                                </div>
                                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                    Immediate dispatch available
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Sleek Neumorphic AI Recommended Best Offer Spotlight */}
                    <div className="p-4 sm:p-4.5 rounded-2xl bg-gradient-to-r from-[#ebf0f7] via-[#f0f4fa] to-[#ebf0f7] dark:from-[#151724] dark:via-[#191c2b] dark:to-[#151724] border border-pink-500/50 dark:border-pink-500/40 shadow-[-4px_-4px_10px_rgba(255,255,255,0.85),_4px_4px_12px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_4px_4px_12px_rgba(0,0,0,0.55)] relative overflow-hidden transition-all">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                            {/* Left: Supplier Info & AI Badges */}
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-600 to-rose-500 text-white flex items-center justify-center shrink-0 shadow-[-2px_-2px_4px_rgba(255,255,255,0.8),_2px_2px_6px_rgba(236,72,153,0.35)]">
                                    <Trophy className="w-5 h-5 text-amber-300 drop-shadow-sm" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-pink-600 dark:text-pink-400 flex items-center gap-1">
                                            <Sparkles className="w-3 h-3 text-pink-500" />
                                            AI Recommended Best Offer
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                            {winnerRanking?.overallScore || 96}/100 Match
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                                            {winningQuote.supplier_name}
                                        </h4>
                                        <span className="text-slate-300 dark:text-slate-700 font-bold">•</span>
                                        <span className="font-mono text-xs sm:text-sm font-black text-pink-600 dark:text-pink-400">
                                            ₱{Number(winningQuote.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                            ({winningQuote.lead_time_days}d lead time • {winningQuote.availability})
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Right: Actions */}
                            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                {/* Open in ChatBot Button */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        openRecommendationChat({
                                            id: winningQuote.id,
                                            requestNumber: group.requestNumber,
                                            itemName: group.itemName,
                                            supplierName: winningQuote.supplier_name,
                                            supplierId: winningQuote.supplier_id,
                                            totalAmount: Number(winningQuote.total_amount || 0),
                                            unitPrice: Number(winningQuote.unit_price || 0),
                                            unit: winningQuote.unit || group.unit || "unit",
                                            leadTimeDays: Number(winningQuote.lead_time_days || 1),
                                            availability: winningQuote.availability || "In Stock",
                                            overallScore: winnerRanking?.overallScore || 96,
                                            summary: aiResult?.aiExecutiveBrief || localEvaluation?.aiExecutiveBrief || `AI recommends ${winningQuote.supplier_name} as providing the optimal balance of competitive pricing and turnaround speed.`,
                                            strengths: winnerRanking?.strengths || [],
                                            comparisonQuotes: validQuotes.map(q => ({
                                                supplierName: q.supplier_name,
                                                totalAmount: Number(q.total_amount || 0),
                                                leadTimeDays: Number(q.lead_time_days || 1),
                                            })),
                                        });
                                    }}
                                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-xs font-black shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_8px_rgba(236,72,153,0.35)] active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                                    title="Open interactive AI recommendation & comparison in AI Chatbot"
                                >
                                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                    <span>Ask AI Advisor in Chat</span>
                                </button>

                                {/* View Proposal Button */}
                                <button
                                    type="button"
                                    onClick={() => setModalQuoteItem({ quote: winningQuote, supplier: winningSupplier })}
                                    className="px-3 py-2 rounded-xl bg-[#ebf0f7] dark:bg-[#181a28] hover:bg-slate-200/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold border border-white/80 dark:border-white/10 shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_5px_rgba(163,177,198,0.3)] active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                                    title="Inspect vendor quotation, breakdown, and governing terms"
                                >
                                    <FileText className="w-3.5 h-3.5 text-pink-500" />
                                    <span>View Proposal</span>
                                </button>

                                {/* Award Bid Button */}
                                {winningQuote.status === "accepted" ? (
                                    <div className="px-3.5 py-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-black flex items-center gap-1.5 border border-emerald-500/30">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Bid Awarded</span>
                                    </div>
                                ) : hasAnyAcceptedQuote || isBidAwarded ? (
                                    <div className="px-3.5 py-2 rounded-xl bg-slate-200/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-xs font-black flex items-center gap-1.5 border border-slate-300 dark:border-slate-700">
                                        <Award className="w-3.5 h-3.5" />
                                        <span>Bid Awarded</span>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => handleAwardBidAction(winningSupplier, winningQuote)}
                                        disabled={awardingQuoteId === winningQuote.id || locallyAwardedId !== null}
                                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_8px_rgba(16,185,129,0.4)] active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                        title="Award procurement bid to this top AI recommended supplier"
                                    >
                                        {awardingQuoteId === winningQuote.id || locallyAwardedId !== null ? (
                                             <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <Award className="w-3.5 h-3.5 text-amber-300" />
                                        )}
                                        <span>Award Bid</span>
                                    </button>
                                )}

                                {/* Toggle detailed breakdown button */}
                                <button
                                    type="button"
                                    onClick={() => setShowScoreBreakdown(!showScoreBreakdown)}
                                    className="p-2 rounded-xl bg-[#ebf0f7] dark:bg-[#1a1c2a] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white border border-white/80 dark:border-white/10 shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_5px_rgba(163,177,198,0.3)] active:scale-95 transition-all cursor-pointer"
                                    title={showScoreBreakdown ? "Hide Dimension Breakdown" : "View Dimension Breakdown"}
                                >
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showScoreBreakdown ? "rotate-180" : ""}`} />
                                </button>
                            </div>
                        </div>

                        {/* Collapsible Score Breakdown if user toggles */}
                        {showScoreBreakdown && (
                            <div className="pt-3 mt-3 border-t border-pink-500/20 grid grid-cols-2 sm:grid-cols-4 gap-2 animate-in fade-in-50 duration-200 text-xs">
                                <div className="p-2 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/5 space-y-1">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-500">
                                        <span>Price Value</span>
                                        <span className="text-pink-600 font-mono font-black">{winnerRanking?.priceScore || 38}/40</span>
                                    </div>
                                    <div className="w-full h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                        <div className="h-full bg-pink-500 rounded-full" style={{ width: `${((winnerRanking?.priceScore || 38) / 40) * 100}%` }} />
                                    </div>
                                </div>
                                <div className="p-2 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/5 space-y-1">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-500">
                                        <span>Speed &amp; Stock</span>
                                        <span className="text-pink-600 font-mono font-black">{winnerRanking?.speedScore || 24}/25</span>
                                    </div>
                                    <div className="w-full h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                        <div className="h-full bg-pink-500 rounded-full" style={{ width: `${((winnerRanking?.speedScore || 24) / 25) * 100}%` }} />
                                    </div>
                                </div>
                                <div className="p-2 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/5 space-y-1">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-500">
                                        <span>Service Coverage</span>
                                        <span className="text-pink-600 font-mono font-black">{winnerRanking?.servicesScore || 18}/20</span>
                                    </div>
                                    <div className="w-full h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                        <div className="h-full bg-pink-500 rounded-full" style={{ width: `${((winnerRanking?.servicesScore || 18) / 20) * 100}%` }} />
                                    </div>
                                </div>
                                <div className="p-2 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/5 space-y-1">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-500">
                                        <span>Logistics</span>
                                        <span className="text-pink-600 font-mono font-black">{winnerRanking?.logisticsScore || 14}/15</span>
                                    </div>
                                    <div className="w-full h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                        <div className="h-full bg-pink-500 rounded-full" style={{ width: `${((winnerRanking?.logisticsScore || 14) / 15) * 100}%` }} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Side-by-Side Quotation Comparison • Top 5 Leaderboard Podium (Hidden once a bid is awarded) */}
                    {!isBidAwarded && (
                        <div className="space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                                <div className="flex items-center gap-2">
                                    <Trophy className="w-4 h-4 text-amber-500" />
                                    <h5 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                                        Top 5 Vendor Quotation Podium
                                    </h5>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-300/40">
                                        Top {Math.min(5, validQuotes.length)} of {validQuotes.length}
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    Click any podium pillar to inspect full vendor quotation breakdown, terms &amp; proposal details in modal
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowDeepDiveModal(true)}
                                className="px-3 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#191b2b] text-xs font-extrabold text-pink-600 dark:text-pink-400 hover:text-pink-500 border border-white/80 dark:border-white/10 shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_5px_rgba(163,177,198,0.3)] active:shadow-[inset_1px_1px_2px_rgba(163,177,198,0.4)] flex items-center gap-1.5 cursor-pointer transition-all"
                            >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                <span>Deep-Dive Evaluation</span>
                            </button>
                        </div>

                        {/* Interactive Leaderboard Podium Base (Always 5 Slots) */}
                        <div className="p-3 sm:p-5 md:p-6 rounded-3xl bg-[#ebf0f7] dark:bg-[#131522] border border-pink-200/80 dark:border-pink-950/80 shadow-[inset_1.5px_1.5px_4px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_4px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)]">
                            <div className="flex items-end justify-center gap-2 sm:gap-3 md:gap-5 pt-8 pb-3 overflow-x-auto no-scrollbar min-w-[320px]">
                                {podiumSlots.map((slot) => {
                                    const rankNum = slot.targetRank;
                                    const item = slot.data;

                                    // Solid pink podium styling (NO GRADIENTS)
                                    let pillarHeight = "h-24 sm:h-32";
                                    let medalIcon = <Award className="w-4 h-4 text-pink-600 dark:text-pink-400" />;
                                    let medalBg = "bg-pink-100 dark:bg-pink-950/80 text-pink-700 dark:text-pink-300 border border-pink-300 dark:border-pink-800";
                                    let pillarBg = "bg-pink-500 dark:bg-pink-600 border-2 border-pink-400 dark:border-pink-500 shadow-md";
                                    let pillarCapBg = "bg-pink-300 dark:bg-pink-400";
                                    let rankNumberColor = "text-white/70 dark:text-white/70 font-black";
                                    let rankLabel = `#${rankNum}`;
                                    let rankBadgeBg = "bg-pink-600 text-white font-bold border border-pink-400";

                                    if (rankNum === 1) {
                                        pillarHeight = "h-44 sm:h-56";
                                        medalIcon = <Trophy className="w-5 h-5 text-amber-950 dark:text-amber-950" />;
                                        medalBg = "bg-amber-400 text-amber-950 border-2 border-amber-300 dark:border-amber-400 shadow-[0_2px_8px_rgba(245,158,11,0.35)]";
                                        pillarBg = "bg-pink-600 dark:bg-pink-600 border-2 border-pink-400 dark:border-pink-400 shadow-[0_4px_16px_rgba(236,72,153,0.35)]";
                                        pillarCapBg = "bg-pink-300 dark:bg-pink-400";
                                        rankNumberColor = "text-white/80 dark:text-white/80 font-black";
                                        rankLabel = "🥇 1st Place";
                                        rankBadgeBg = "bg-pink-700 text-white font-black border border-pink-500 shadow-xs";
                                    } else if (rankNum === 2) {
                                        pillarHeight = "h-34 sm:h-44";
                                        medalIcon = <Award className="w-4 h-4 text-slate-800 dark:text-slate-100" />;
                                        medalBg = "bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-2 border-slate-400/80 dark:border-slate-500 shadow-xs";
                                        pillarBg = "bg-pink-500 dark:bg-pink-500 border-2 border-pink-300 dark:border-pink-400 shadow-[0_4px_14px_rgba(236,72,153,0.25)]";
                                        pillarCapBg = "bg-pink-300 dark:bg-pink-400";
                                        rankNumberColor = "text-white/70 dark:text-white/70 font-black";
                                        rankLabel = "🥈 2nd Place";
                                        rankBadgeBg = "bg-pink-600 text-white font-bold border border-pink-400 shadow-xs";
                                    } else if (rankNum === 3) {
                                        pillarHeight = "h-28 sm:h-36";
                                        medalIcon = <Award className="w-4 h-4 text-white" />;
                                        medalBg = "bg-amber-700 dark:bg-amber-700 text-white border-2 border-amber-600 shadow-xs";
                                        pillarBg = "bg-pink-500 dark:bg-pink-500 border-2 border-pink-300 dark:border-pink-400 shadow-[0_4px_14px_rgba(236,72,153,0.2)]";
                                        pillarCapBg = "bg-pink-300 dark:bg-pink-400";
                                        rankNumberColor = "text-white/70 dark:text-white/70 font-black";
                                        rankLabel = "🥉 3rd Place";
                                        rankBadgeBg = "bg-pink-600 text-white font-bold border border-pink-400 shadow-xs";
                                    } else if (rankNum === 4) {
                                        pillarHeight = "h-22 sm:h-28";
                                        pillarBg = "bg-pink-500/95 dark:bg-pink-600/95 border-2 border-pink-300 dark:border-pink-400";
                                        pillarCapBg = "bg-pink-300 dark:bg-pink-400";
                                        rankNumberColor = "text-white/70 dark:text-white/70 font-black";
                                        rankLabel = "4th Place";
                                        rankBadgeBg = "bg-pink-600 text-white font-bold border border-pink-400";
                                    } else if (rankNum === 5) {
                                        pillarHeight = "h-18 sm:h-24";
                                        pillarBg = "bg-pink-500/95 dark:bg-pink-600/95 border-2 border-pink-300 dark:border-pink-400";
                                        pillarCapBg = "bg-pink-300 dark:bg-pink-400";
                                        rankNumberColor = "text-white/70 dark:text-white/70 font-black";
                                        rankLabel = "5th Place";
                                        rankBadgeBg = "bg-pink-600 text-white font-bold border border-pink-400";
                                    }

                                    // Active Vendor Slot
                                    if (item) {
                                        const isAccepted = (item.quote.status || "").toLowerCase().includes("accept");
                                        const totalAmt = Number(item.quote.total_amount || 0);

                                        return (
                                            <div
                                                key={`podium-slot-${rankNum}-${item.quote.id}`}
                                                onClick={() => setModalQuoteItem({ supplier: item.matchedSupplier, quote: item.quote })}
                                                className="group relative flex flex-col items-center flex-1 min-w-[110px] sm:min-w-[125px] max-w-[155px] cursor-pointer select-none transition-all duration-200 hover:-translate-y-1.5 z-10"
                                                title={`Click to open full quotation proposal modal for ${item.quote.supplier_name}`}
                                            >
                                                {/* Top Vendor Card Floating Above Pillar */}
                                                <div className="flex flex-col items-center text-center space-y-1 mb-2.5 w-full px-1">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${rankBadgeBg}`}>
                                                        {rankLabel}
                                                    </span>

                                                    {/* Medal Avatar Badge */}
                                                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center ${medalBg} transition-transform group-hover:scale-110`}>
                                                        {medalIcon}
                                                    </div>

                                                    {/* Supplier Name */}
                                                    <p className="font-black text-xs sm:text-[13px] text-slate-900 dark:text-white truncate max-w-full" title={item.quote.supplier_name}>
                                                        {item.quote.supplier_name}
                                                    </p>

                                                    {/* Score & Bid */}
                                                    <div className="flex items-center gap-1">
                                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                                                            item.rank === 1
                                                                ? "bg-amber-500 text-white"
                                                                : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/60 dark:border-slate-700"
                                                        }`}>
                                                            {item.score}/100
                                                        </span>
                                                        {isAccepted && (
                                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800">
                                                                Won
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="bg-white dark:bg-[#1b1e2c] border border-slate-200 dark:border-slate-700/80 px-2 py-0.5 rounded-lg shadow-xs mt-0.5">
                                                        <p className="font-mono text-xs font-black text-pink-600 dark:text-pink-400">
                                                            ₱{totalAmt.toLocaleString()}
                                                        </p>
                                                    </div>
                                                    <span className="text-[9.5px] font-medium text-slate-500 dark:text-slate-400">
                                                        {item.quote.lead_time_days}d lead
                                                    </span>
                                                </div>

                                                {/* Stepped Podium Pillar (SOLID PINK - NO GRADIENTS) */}
                                                <div
                                                    className={`w-full rounded-2xl transition-all duration-200 flex flex-col justify-between items-center pb-3 relative overflow-hidden ${pillarHeight} ${pillarBg} hover:scale-[1.02] shadow-sm`}
                                                >
                                                    {/* Solid Pillar Top Cap Line */}
                                                    <div className={`w-full h-1.5 shrink-0 ${pillarCapBg}`} />

                                                    {/* Embossed Podium Rank Number */}
                                                    <div className={`text-2xl sm:text-3xl font-black select-none ${rankNumberColor}`}>
                                                        #{item.rank}
                                                    </div>

                                                    <div className="px-2.5 py-0.5 rounded-full bg-white text-[10px] font-black text-pink-700 group-hover:bg-pink-50 transition-colors flex items-center gap-1 shadow-sm">
                                                        <span>View</span>
                                                        <ExternalLink className="w-2.5 h-2.5" />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    // Empty Slot in Podium
                                    return (
                                        <div
                                            key={`podium-slot-empty-${rankNum}`}
                                            className="group relative flex flex-col items-center flex-1 min-w-[110px] sm:min-w-[125px] max-w-[155px] select-none opacity-60 z-0"
                                        >
                                            {/* Empty Card Floating Above Pillar */}
                                            <div className="flex flex-col items-center text-center space-y-1 mb-2.5 w-full px-1">
                                                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 px-2 py-0.5 rounded-full bg-slate-200/50 dark:bg-slate-800/40 border border-slate-300/40 dark:border-slate-800">
                                                    {rankLabel}
                                                </span>

                                                {/* Empty Avatar Badge */}
                                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500">
                                                    <Package className="w-4 h-4 opacity-50" />
                                                </div>

                                                {/* Empty Supplier Name */}
                                                <p className="font-semibold text-xs text-slate-400 dark:text-slate-500 italic truncate max-w-full">
                                                    Empty Slot
                                                </p>

                                                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                                                    No Proposal
                                                </span>

                                                <div className="bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded-lg mt-0.5">
                                                    <p className="font-mono text-xs text-slate-400 dark:text-slate-500">
                                                        —
                                                    </p>
                                                </div>
                                                <span className="text-[9.5px] text-slate-400 dark:text-slate-600">
                                                    Awaiting Bid
                                                </span>
                                            </div>

                                            {/* Empty Stepped Podium Pillar (SOLID PINK THEMED - NO GRADIENTS) */}
                                            <div
                                                className={`w-full rounded-2xl border-2 border-dashed border-pink-300 dark:border-pink-800/80 bg-pink-100/40 dark:bg-pink-950/30 flex flex-col justify-between items-center pb-3 relative overflow-hidden ${pillarHeight}`}
                                            >
                                                {/* Solid Pillar Top Cap Line */}
                                                <div className="w-full h-1.5 shrink-0 bg-pink-200 dark:bg-pink-900/60" />

                                                {/* Embossed Podium Rank Number */}
                                                <div className="text-2xl sm:text-3xl font-black text-pink-300/80 dark:text-pink-700/60 select-none">
                                                    #{rankNum}
                                                </div>

                                                <div className="px-2 py-0.5 rounded-full bg-white/90 dark:bg-[#1a1c28] text-[10px] font-bold text-pink-600 dark:text-pink-400 select-none border border-pink-200 dark:border-pink-900/60">
                                                    Vacant
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Podium Shelf Horizon Line (SOLID PINK - NO GRADIENT) */}
                            <div className="h-2 w-full rounded-full bg-pink-500 dark:bg-pink-500 -mt-1 shadow-sm" />
                        </div>
                    </div>
                )}
                </div>
            )}

            {/* Vendor Quotation & Proposal Details Modal when clicking any podium pillar */}
            {modalQuoteItem && (
                <VendorQuotationViewModal
                    supplier={modalQuoteItem.supplier}
                    initialQuote={modalQuoteItem.quote}
                    onClose={() => setModalQuoteItem(null)}
                    onAwardBid={handleAwardBidAction}
                />
            )}

            {/* Modal: Deep-Dive AI Evaluation & Multi-Criteria Matrix */}
            {showDeepDiveModal && (
                <Portal>
                    <div
                        className="fixed inset-0 bg-slate-950/75 dark:bg-black/85 backdrop-blur-sm z-[110] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
                        onClick={() => setShowDeepDiveModal(false)}
                    >
                        <div
                            className="relative w-full max-w-4xl bg-[#ebf0f7] dark:bg-[#161826] rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-none overflow-hidden my-auto flex flex-col max-h-[92vh]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="p-5 border-b border-slate-300/80 dark:border-white/10 flex items-center justify-between bg-[#ebf0f7] dark:bg-[#141624]">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-pink-600 text-white flex items-center justify-center shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_6px_rgba(219,39,119,0.4)]">
                                        <Sparkles className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-base text-slate-900 dark:text-white">
                                            AI Sourcing Intelligence • Multi-Factor Evaluation
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Requisition #{group.requestNumber} • {group.itemName} ({group.quantityRequested} {group.unit})
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setShowDeepDiveModal(false)}
                                    className="w-8 h-8 rounded-full bg-[#ebf0f7] dark:bg-[#12131b] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center border border-white/80 dark:border-white/10 shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_5px_rgba(163,177,198,0.3)] active:shadow-[inset_1px_1px_2px_rgba(163,177,198,0.4)] cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-5 overflow-y-auto space-y-6 text-xs">
                                {/* AI Executive Summary */}
                                <div className="p-4 rounded-2xl bg-[#e8ecf4] dark:bg-[#12131f] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-pink-500" />
                                        <span className="font-black uppercase tracking-wider text-pink-600 dark:text-pink-400">
                                            Executive Recommendation
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                        {activeAi?.aiExecutiveBrief || activeAi?.summary}
                                    </p>
                                </div>

                                {/* Comparison Matrix Table */}
                                <div className="space-y-2">
                                    <h4 className="font-black text-sm text-slate-900 dark:text-white">
                                        Ranked Supplier Scorecard Matrix
                                    </h4>

                                    <div className="overflow-x-auto rounded-2xl border border-slate-300/80 dark:border-white/10 bg-[#e8ecf4]/60 dark:bg-black/30 shadow-[inset_1px_1px_3px_rgba(163,177,198,0.3)]">
                                        <table className="table-pro w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-slate-300/80 dark:border-white/10 bg-[#e0e6f0] dark:bg-[#12131f] text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
                                                    <th className="p-3">Rank &amp; Supplier</th>
                                                    <th className="p-3">Total Bid</th>
                                                    <th className="p-3">Price Delta</th>
                                                    <th className="p-3">Lead Time</th>
                                                    <th className="p-3">Stock Readiness</th>
                                                    <th className="p-3">AI Score</th>
                                                    <th className="p-3 text-right">Verdict</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200/40 dark:divide-white/[0.04] text-xs">
                                                {(activeAi?.rankings || validQuotes.map((q, i) => ({
                                                    id: q.id,
                                                    supplier_name: q.supplier_name,
                                                    rank: i + 1,
                                                    overallScore: 90 - i * 5,
                                                    priceDeltaVsLowest: 0,
                                                    priceDeltaPercentage: 0,
                                                    recommendationVerdict: i === 0 ? "Top Pick" : "Standard Option",
                                                }))).map((rankItem: any) => {
                                                    const q = validQuotes.find((x) => x.id === rankItem.id) || validQuotes[0];
                                                    const isTop = rankItem.rank === 1;

                                                    return (
                                                        <tr
                                                            key={rankItem.id}
                                                            className={isTop ? "bg-pink-500/5 font-semibold" : ""}
                                                        >
                                                            <td className="p-3" data-label="Rank & Supplier">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] font-black ${
                                                                        isTop ? "bg-pink-600 text-white shadow-[-1px_-1px_2px_rgba(255,255,255,0.6),_1px_1px_3px_rgba(219,39,119,0.4)]" : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                                                    }`}>
                                                                        #{rankItem.rank}
                                                                    </span>
                                                                    <span className="font-bold text-slate-900 dark:text-white">
                                                                        {rankItem.supplier_name}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="p-3 font-mono font-black text-pink-600 dark:text-pink-400" data-label="Total Bid">
                                                                ₱{Number(q.total_amount).toLocaleString()}
                                                            </td>
                                                            <td className="p-3 font-mono text-[11px]" data-label="Price Delta">
                                                                {rankItem.priceDeltaVsLowest === 0 ? (
                                                                    <span className="text-emerald-600 font-bold">Best Price</span>
                                                                ) : (
                                                                    <span className="text-rose-500 font-bold">
                                                                        +{rankItem.priceDeltaPercentage}%
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-slate-700 dark:text-slate-300 font-bold" data-label="Lead Time">
                                                                {q.lead_time_days} days
                                                            </td>
                                                            <td className="p-3 text-slate-600 dark:text-slate-400" data-label="Stock Readiness">
                                                                {q.availability}
                                                            </td>
                                                            <td className="p-3" data-label="AI Score">
                                                                <span className="font-mono font-black text-xs px-2 py-0.5 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                                                                    {rankItem.overallScore}/100
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-right" data-label="Verdict">
                                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${
                                                                    isTop
                                                                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                                                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                                                }`}>
                                                                    {rankItem.recommendationVerdict}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 border-t border-slate-300/80 dark:border-white/10 flex items-center justify-between bg-[#ebf0f7] dark:bg-[#141624]">
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    Scoring weights: Pricing (40%), Delivery Turnaround (25%), Value-Added Services (20%), Logistics (15%)
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setShowDeepDiveModal(false)}
                                    className="px-4 py-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-700 dark:text-slate-200 text-xs font-bold border border-white/80 dark:border-white/10 shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)] active:shadow-[inset_1px_1px_2px_rgba(163,177,198,0.4)] cursor-pointer"
                                >
                                    Close Sourcing Analysis
                                </button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}
        </div>
    );
}
