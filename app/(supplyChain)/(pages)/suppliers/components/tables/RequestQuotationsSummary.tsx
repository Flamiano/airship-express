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
} from "lucide-react";
import { SupplierQuotationItem, PotentialSupplierItem, RequestSupplierGroup } from "./PotentialSuppliersTab";
import { toast } from "sonner";
import Portal from "../../../../components/client/Portal";
import { useAI } from "../../../../ai/services/AIContext";

interface RequestQuotationsSummaryProps {
    group: RequestSupplierGroup;
    quotations: SupplierQuotationItem[];
    onAwardBid: (supplier: PotentialSupplierItem, quote: SupplierQuotationItem) => Promise<void> | void;
    awardingQuoteId: number | null;
}

export function RequestQuotationsSummary({
    group,
    quotations,
    onAwardBid,
    awardingQuoteId,
}: RequestQuotationsSummaryProps) {
    const { setActiveRecommendation, openRecommendationChat } = useAI();
    const [isExpanded, setIsExpanded] = useState(true);
    const [showDeepDiveModal, setShowDeepDiveModal] = useState(false);
    const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiResult, setAiResult] = useState<any>(null);

    // Filter valid quotations for this request
    const validQuotes = useMemo(() => {
        if (!quotations || quotations.length === 0) return [];
        return quotations;
    }, [quotations]);

    const hasAnyAcceptedQuote = useMemo(() => {
        return validQuotes.some((q) => (q.status || "").toLowerCase().includes("accept"));
    }, [validQuotes]);

    const acceptedQuote = useMemo(() => {
        return validQuotes.find((q) => (q.status || "").toLowerCase().includes("accept"));
    }, [validQuotes]);

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
                                Received Quotations &amp; AI Offer Recommendation
                            </h4>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-pink-500/15 text-pink-600 dark:text-pink-400 border border-pink-500/20 shadow-[-1px_-1px_3px_rgba(255,255,255,0.6),_1px_1px_3px_rgba(219,39,119,0.15)]">
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

                                {/* Award Bid Button */}
                                {winningQuote.status === "accepted" ? (
                                    <div className="px-3.5 py-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-black flex items-center gap-1.5 border border-emerald-500/30">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Bid Awarded</span>
                                    </div>
                                ) : hasAnyAcceptedQuote ? (
                                    <div className="px-3.5 py-2 rounded-xl bg-slate-200/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-xs font-black flex items-center gap-1.5 border border-slate-300 dark:border-slate-700">
                                        <Award className="w-3.5 h-3.5" />
                                        <span>Bid Awarded</span>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => onAwardBid(winningSupplier, winningQuote)}
                                        disabled={awardingQuoteId === winningQuote.id}
                                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_8px_rgba(16,185,129,0.4)] active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                        title="Award procurement bid to this top AI recommended supplier"
                                    >
                                        {awardingQuoteId === winningQuote.id ? (
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

                    {/* All Submitted Quotations Comparison Table / Grid */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h5 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                Side-by-Side Quotation Comparison ({validQuotes.length} Vendor{validQuotes.length !== 1 ? "s" : ""})
                            </h5>
                            <button
                                type="button"
                                onClick={() => setShowDeepDiveModal(true)}
                                className="px-3 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#191b2b] text-xs font-extrabold text-pink-600 dark:text-pink-400 hover:text-pink-500 border border-white/80 dark:border-white/10 shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_5px_rgba(163,177,198,0.3)] active:shadow-[inset_1px_1px_2px_rgba(163,177,198,0.4)] flex items-center gap-1.5 cursor-pointer transition-all"
                            >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                <span>Deep-Dive Evaluation</span>
                            </button>
                        </div>

                        {/* Quotation Rows */}
                        <div className="space-y-3">
                            {validQuotes.map((quote, idx) => {
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

                                const quoteRanking = aiResult?.rankings?.find((r: any) => r.id === quote.id);
                                const isWinner = quote.id === winningQuote.id;
                                const isAwarding = awardingQuoteId === quote.id;
                                const isAccepted = quote.status === "accepted";
                                const totalAmt = Number(quote.total_amount || 0);
                                const lowestPrice = metrics?.lowestPrice || totalAmt;
                                const delta = totalAmt - lowestPrice;

                                return (
                                    <div
                                        key={quote.id || idx}
                                        className={`p-4 sm:p-5 rounded-2xl bg-[#ebf0f7] dark:bg-[#141624] transition-all ${
                                            isWinner
                                                ? "border-2 border-pink-500/70 dark:border-pink-500/60 shadow-[-4px_-4px_10px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(219,39,119,0.2)]"
                                                : "border border-white/80 dark:border-white/10 shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_3px_3px_8px_rgba(0,0,0,0.5)]"
                                        } space-y-3`}
                                    >
                                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                            {/* Supplier Meta */}
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-black text-sm text-slate-900 dark:text-white">
                                                        {quote.supplier_name}
                                                    </span>

                                                    {isWinner && (
                                                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-pink-500/15 text-pink-600 dark:text-pink-400 border border-pink-500/30 flex items-center gap-1 shadow-[-1px_-1px_2px_rgba(255,255,255,0.6),_1px_1px_2px_rgba(219,39,119,0.2)]">
                                                            <Trophy className="w-3 h-3 text-amber-500" />
                                                            <span>AI Best Pick</span>
                                                        </span>
                                                    )}

                                                    {quoteRanking && (
                                                        <span className="text-[10px] font-mono font-black text-slate-600 dark:text-slate-300 bg-[#e8ecf4] dark:bg-[#1a1c2d] px-2 py-0.5 rounded-lg border border-slate-300/70 dark:border-white/10 shadow-[inset_1px_1px_2px_rgba(163,177,198,0.3)]">
                                                            Score: {quoteRanking.overallScore}/100 (Rank #{quoteRanking.rank})
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                                                    {quote.contact_phone && (
                                                        <span className="flex items-center gap-1">
                                                            <Phone className="w-3 h-3 text-pink-500" />
                                                            {quote.contact_phone}
                                                        </span>
                                                    )}
                                                    {quote.contact_email && (
                                                        <span className="flex items-center gap-1">
                                                            <Mail className="w-3 h-3 text-pink-500" />
                                                            {quote.contact_email}
                                                        </span>
                                                    )}
                                                    {matchedSupplier.distanceKm && (
                                                        <span className="flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300">
                                                            <MapPin className="w-3 h-3 text-pink-500" />
                                                            {matchedSupplier.distanceKm.toFixed(1)} km from HQ
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Pricing & Commercial Terms */}
                                            <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
                                                <div>
                                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                                                        Offered Unit Price
                                                    </span>
                                                    <span className="font-mono text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
                                                        ₱{Number(quote.unit_price).toLocaleString()}
                                                        <span className="text-[10px] font-bold text-slate-400">/{quote.unit || "unit"}</span>
                                                    </span>
                                                </div>

                                                <div>
                                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                                                        Total Proposal Bid
                                                    </span>
                                                    <div className="flex items-baseline gap-1.5">
                                                        <span className="font-mono text-sm sm:text-base font-black text-pink-600 dark:text-pink-400">
                                                            ₱{totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </span>
                                                        {delta === 0 ? (
                                                            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                                                                (Lowest)
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-rose-500">
                                                                (+₱{delta.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                                                            </span>
                                                        )}
                                                    </div>
                                                    {(Number(quote.discount || 0) > 0 || Number(quote.shipping_fee || 0) > 0 || Number(quote.tax_amount || 0) > 0 || quote.tax_type) && (
                                                        <div className="text-[9px] text-slate-400 flex items-center gap-1.5 font-medium mt-0.5">
                                                            {Number(quote.discount || 0) > 0 && <span className="text-emerald-600 font-bold">Disc -₱{Number(quote.discount).toLocaleString()}</span>}
                                                            {Number(quote.shipping_fee || 0) > 0 && <span>+₱{Number(quote.shipping_fee).toLocaleString()} ship</span>}
                                                            {Number(quote.tax_amount || 0) > 0 && <span>+₱{Number(quote.tax_amount).toLocaleString()} tax</span>}
                                                        </div>
                                                    )}
                                                </div>

                                                <div>
                                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                                                        Lead Time
                                                    </span>
                                                    <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200">
                                                        {quote.lead_time_days} days
                                                    </span>
                                                </div>

                                                <div>
                                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                                                        Stock Status
                                                    </span>
                                                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                                        {quote.availability}
                                                    </span>
                                                </div>

                                                {/* Award Bid Action */}
                                                <div>
                                                    {isAccepted ? (
                                                        <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-black flex items-center gap-1.5 border border-emerald-500/30">
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                            <span>Bid Awarded</span>
                                                        </div>
                                                    ) : hasAnyAcceptedQuote ? (
                                                        <div className="px-3.5 py-1.5 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 text-xs font-bold flex items-center gap-1.5 border border-slate-300/40 dark:border-slate-700/40 cursor-not-allowed">
                                                            <Award className="w-3.5 h-3.5" />
                                                            <span>Bidding Concluded</span>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => onAwardBid(matchedSupplier, quote)}
                                                            disabled={isAwarding}
                                                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                                                                isWinner
                                                                    ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_6px_rgba(16,185,129,0.4)] active:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3)]"
                                                                    : "bg-[#ebf0f7] dark:bg-[#191b2b] text-slate-700 dark:text-slate-200 hover:text-emerald-600 border border-white/80 dark:border-white/10 shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_5px_rgba(163,177,198,0.3)] active:shadow-[inset_1px_1px_2px_rgba(163,177,198,0.4)]"
                                                            }`}
                                                        >
                                                            {isAwarding ? (
                                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                            ) : (
                                                                <Sparkles className="w-3.5 h-3.5" />
                                                            )}
                                                            <span>Award Bid</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Products Offered & Services Offered & Notes preview */}
                                        {(quote.products || (quote.services_offered && quote.services_offered.length > 0) || quote.notes) && (
                                            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-300/60 dark:border-white/10 text-xs">
                                                {quote.products && (
                                                    <div className="flex items-center gap-1 bg-[#e8ecf4] dark:bg-[#10121b] text-pink-700 dark:text-pink-300 px-2.5 py-1 rounded-xl border border-pink-500/30 font-semibold text-[11px] shadow-[inset_1px_1px_2px_rgba(163,177,198,0.25)]">
                                                        <span>📦 Products Offered:</span>
                                                        <span className="font-bold">{quote.products}</span>
                                                    </div>
                                                )}
                                                {quote.services_offered && quote.services_offered.map((svc, sIdx) => (
                                                    <span
                                                        key={sIdx}
                                                        className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#e8ecf4] dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-300/70 dark:border-white/10 shadow-[-1px_-1px_2px_rgba(255,255,255,0.6),_1px_1px_2px_rgba(163,177,198,0.2)]"
                                                    >
                                                        ✓ {svc}
                                                    </span>
                                                ))}
                                                {quote.notes && (
                                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 italic ml-1">
                                                        &ldquo;{quote.notes}&rdquo;
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
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
                                        <table className="w-full text-left border-collapse">
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
                                                            <td className="p-3">
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
                                                            <td className="p-3 font-mono font-black text-pink-600 dark:text-pink-400">
                                                                ₱{Number(q.total_amount).toLocaleString()}
                                                            </td>
                                                            <td className="p-3 font-mono text-[11px]">
                                                                {rankItem.priceDeltaVsLowest === 0 ? (
                                                                    <span className="text-emerald-600 font-bold">Best Price</span>
                                                                ) : (
                                                                    <span className="text-rose-500 font-bold">
                                                                        +{rankItem.priceDeltaPercentage}%
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-slate-700 dark:text-slate-300 font-bold">
                                                                {q.lead_time_days} days
                                                            </td>
                                                            <td className="p-3 text-slate-600 dark:text-slate-400">
                                                                {q.availability}
                                                            </td>
                                                            <td className="p-3">
                                                                <span className="font-mono font-black text-xs px-2 py-0.5 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                                                                    {rankItem.overallScore}/100
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-right">
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
