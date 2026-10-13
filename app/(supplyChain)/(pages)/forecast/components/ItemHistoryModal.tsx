// app/(supplyChain)/(pages)/forecast/components/ItemHistoryModal.tsx
"use client";

import { useEffect, useState } from "react";
import Portal from "../../../components/client/Portal";
import { AppButton } from "../../../components/ui/AppButton";
import { supabase } from "../../../lib/services/client/supabase";

interface ItemHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: any | null;
    historicalPeriodDays: number;
}

export default function ItemHistoryModal({
    isOpen,
    onClose,
    item,
    historicalPeriodDays
}: ItemHistoryModalProps) {
    const [movements, setMovements] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        if (!isOpen || !item) return;

        let isMounted = true;
        setLoading(true);

        const fetchHistory = async () => {
            try {
                const startDate = new Date(Date.now() - historicalPeriodDays * 24 * 60 * 60 * 1000).toISOString();
                const idStr = String(item.id);
                const codeStr = String(item.item_code);

                const { data, error } = await supabase
                    .from("stock_movements")
                    .select("*")
                    .or(`item_id.eq.${idStr},item_code.eq.${codeStr}`)
                    .gte("created_at", startDate)
                    .order("created_at", { ascending: false });

                if (error) throw error;
                if (isMounted) {
                    setMovements(data || []);
                }
            } catch (err) {
                console.warn("Failed to fetch item stock movements:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchHistory();

        return () => {
            isMounted = false;
        };
    }, [isOpen, item, historicalPeriodDays]);

    if (!isOpen || !item) return null;

    return (
        <Portal>
            <div
                className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
                onClick={(e) => {
                    if (e.target === e.currentTarget) onClose();
                }}
            >
                <div
                    className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl border border-white/90 dark:border-white/[0.08] shadow-[14px_14px_40px_rgba(166,175,195,0.4),-14px_-14px_40px_rgba(255,255,255,0.95)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.85)] max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-150"
                    data-lenis-prevent
                >
                    {/* Header */}
                    <div className="p-5 border-b border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between shrink-0 bg-[#ebf0f7]/70 dark:bg-[#14151e]/60 backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-blue-500 shrink-0">
                                <i className="fas fa-history text-lg"></i>
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                                    Historical Consumption Trail
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {item.item_name} ({item.item_code}) • Past {historicalPeriodDays} Days
                                </p>
                            </div>
                        </div>
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="icon-sm"
                            onClick={onClose}
                            aria-label="Close modal"
                        >
                            <i className="fas fa-times text-xs"></i>
                        </AppButton>
                    </div>

                    {/* Stats Ribbon (Debossed Panel) */}
                    <div className="grid grid-cols-3 gap-3 p-4 bg-[#ebf0f7]/90 dark:bg-[#12131b]/90 border-b border-slate-200/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.2)]">
                        <div className="text-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Total Issuances
                            </span>
                            <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                                {item.total_consumed_period} {item.unit}
                            </div>
                        </div>
                        <div className="text-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Active Days
                            </span>
                            <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                                {item.consumption_events_count} / {historicalPeriodDays} days
                            </div>
                        </div>
                        <div className="text-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Demand Velocity
                            </span>
                            <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5 flex items-center justify-center gap-1">
                                {item.demand_trend === "Increasing" ? (
                                    <span className="text-emerald-500 font-bold">
                                        <i className="fas fa-arrow-up text-xs mr-1" />
                                        +{item.trend_percentage}%
                                    </span>
                                ) : item.demand_trend === "Decreasing" ? (
                                    <span className="text-amber-500 font-bold">
                                        <i className="fas fa-arrow-down text-xs mr-1" />
                                        {item.trend_percentage}%
                                    </span>
                                ) : (
                                    <span className="text-slate-500 font-bold">Stable</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Movement List */}
                    <div className="p-6 overflow-y-auto space-y-3">
                        {loading ? (
                            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                                <i className="fas fa-circle-notch fa-spin text-2xl mb-2 text-pink-500" />
                                <span className="text-xs font-medium">Loading audit records...</span>
                            </div>
                        ) : movements.length === 0 ? (
                            <div className="py-12 text-center text-slate-400">
                                <i className="fas fa-inbox text-3xl mb-2 opacity-50" />
                                <p className="text-xs font-medium">No stock issuance records found for this period.</p>
                            </div>
                        ) : (
                            movements.map((m) => {
                                const isOut = m.movement_type === "Stock Out";
                                const isIn = m.movement_type === "Stock In";
                                return (
                                    <div
                                        key={m.id}
                                        className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4)] flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.2)] ${
                                                    isOut
                                                        ? "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
                                                        : isIn
                                                        ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                                                        : "bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                                                }`}
                                            >
                                                <i
                                                    className={`fas ${
                                                        isOut
                                                            ? "fa-arrow-up-right"
                                                            : isIn
                                                            ? "fa-arrow-down-left"
                                                            : "fa-sliders"
                                                    }`}
                                                />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                        {m.reason || (isOut ? "Stock Issuance" : m.movement_type)}
                                                    </span>
                                                    {m.reference_number && (
                                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-[#f0f3f8] dark:bg-[#161722] border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)] text-slate-600 dark:text-slate-400 font-bold">
                                                            {m.reference_number}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                                                    {m.department || "Operations"} • {new Date(m.created_at).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span
                                                className={`text-sm font-bold ${
                                                    isOut ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                                                }`}
                                            >
                                                {isOut ? `-${Math.abs(m.quantity)}` : `+${Math.abs(m.quantity)}`} {item.unit}
                                            </span>
                                            <div className="text-[10px] text-slate-400">
                                                Prev: {m.previous_stock} → New: {m.new_stock}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-end bg-[#ebf0f7]/40 dark:bg-[#14151c]/40">
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="sm"
                            onClick={onClose}
                        >
                            Close
                        </AppButton>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
