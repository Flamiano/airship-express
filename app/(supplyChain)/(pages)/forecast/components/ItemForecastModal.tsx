// app/(supplyChain)/(pages)/forecast/components/ItemForecastModal.tsx
"use client";

import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import Portal from "../../../components/client/Portal";
import { AppButton } from "../../../components/ui/AppButton";
import { StatusBadge, type BadgeTone } from "../../../components/ui/StatusBadge";
import Link from "next/link";

interface ItemForecastModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: any | null;
    horizonDays: number;
    historicalPeriodDays: number;
}

export default function ItemForecastModal({
    isOpen,
    onClose,
    item,
    horizonDays,
    historicalPeriodDays
}: ItemForecastModalProps) {
    const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const chartInstanceRef = useRef<Chart | null>(null);

    useEffect(() => {
        if (!isOpen || !item) return;

        const timer = setTimeout(() => {
            if (!chartCanvasRef.current) return;

            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
            }

            const existing = Chart.getChart(chartCanvasRef.current);
            if (existing) {
                existing.destroy();
            }

            const ctx = chartCanvasRef.current.getContext("2d");
            if (!ctx) return;

            const predictionDates = item.prediction_dates || [];
            const dailyPredictions = item.daily_predictions || [];
            const lowerBounds = item.lower_bounds || [];
            const upperBounds = item.upper_bounds || [];

            const labels = predictionDates.map((d: string) => {
                const parts = d.split("-");
                return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : d;
            });

            chartInstanceRef.current = new Chart(ctx, {
                type: "line",
                data: {
                    labels,
                    datasets: [
                        {
                            label: "Upper Interval",
                            data: upperBounds,
                            borderColor: "transparent",
                            backgroundColor: "rgba(236, 72, 153, 0.12)",
                            pointRadius: 0,
                            fill: "+1",
                            tension: 0.3
                        },
                        {
                            label: "Lower Interval",
                            data: lowerBounds,
                            borderColor: "transparent",
                            backgroundColor: "transparent",
                            pointRadius: 0,
                            fill: false,
                            tension: 0.3
                        },
                        {
                            label: "Projected Demand",
                            data: dailyPredictions,
                            borderColor: "#ec4899",
                            backgroundColor: "rgba(236, 72, 153, 0.2)",
                            borderWidth: 2.5,
                            pointRadius: 3,
                            pointHoverRadius: 5,
                            pointBackgroundColor: "#ec4899",
                            tension: 0.3,
                            fill: false
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => {
                                    const val = ctx.parsed.y ?? 0;
                                    return `Predicted Demand: ${val} ${item.unit || "units"}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { font: { size: 10 } }
                        },
                        y: {
                            beginAtZero: true,
                            grid: { color: "rgba(166, 175, 195, 0.15)" },
                            ticks: {
                                font: { size: 10 },
                                stepSize: 1
                            }
                        }
                    }
                }
            });
        }, 50);

        return () => {
            clearTimeout(timer);
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
            }
            if (chartCanvasRef.current) {
                const existing = Chart.getChart(chartCanvasRef.current);
                if (existing) existing.destroy();
            }
        };
    }, [isOpen, item]);

    if (!isOpen || !item) return null;

    const riskTone: BadgeTone =
        item.risk_level === "Critical"
            ? "rose"
            : item.risk_level === "Low Stock Risk"
            ? "amber"
            : "emerald";

    return (
        <Portal>
            <div
                className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
                onClick={(e) => {
                    if (e.target === e.currentTarget) onClose();
                }}
            >
                <div
                    className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl border border-white/90 dark:border-white/[0.08] shadow-[14px_14px_40px_rgba(166,175,195,0.4),-14px_-14px_40px_rgba(255,255,255,0.95)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.85)] max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150"
                    data-lenis-prevent
                >
                    {/* Header */}
                    <div className="p-5 border-b border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between shrink-0 bg-[#ebf0f7]/70 dark:bg-[#14151e]/60 backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-pink-500 shrink-0">
                                <i className="fas fa-chart-line text-lg"></i>
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                                        {item.item_name}
                                    </h2>
                                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3)] text-slate-700 dark:text-slate-300 font-bold">
                                        {item.item_code}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {item.category} • {horizonDays}-Day Horizon Analysis
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <StatusBadge tone={riskTone} dot>
                                {item.risk_level}
                            </StatusBadge>
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
                    </div>

                    {/* Scrollable Body */}
                    <div className="p-6 space-y-6 overflow-y-auto">
                        {/* Summary Metrics Grid (Debossed Wells) */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Available Stock
                                </span>
                                <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                                    {item.available_stock} <span className="text-xs font-normal text-slate-500">{item.unit}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 mt-0.5 block">
                                    Gross: {item.current_stock}
                                </span>
                            </div>

                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Forecast Demand
                                </span>
                                <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">
                                    {item.forecast_demand} <span className="text-xs font-normal text-slate-500">{item.unit}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 mt-0.5 block">
                                    {item.is_prediction_valid === false ? "0% Conf (< 3 Yrs Data)" : `Next ${horizonDays} days`}
                                </span>
                            </div>

                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Incoming POs
                                </span>
                                <div className="text-lg font-bold text-sky-600 dark:text-sky-400 mt-1">
                                    +{item.expected_incoming} <span className="text-xs font-normal text-slate-500">{item.unit}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 mt-0.5 block">
                                    {item.incoming_pos_details?.length || 0} active orders
                                </span>
                            </div>

                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Projected Stock
                                </span>
                                <div
                                    className={`text-lg font-bold mt-1 ${
                                        item.risk_level === "Critical"
                                            ? "text-rose-600 dark:text-rose-400"
                                            : item.risk_level === "Low Stock Risk"
                                            ? "text-amber-600 dark:text-amber-400"
                                            : "text-emerald-600 dark:text-emerald-400"
                                    }`}
                                >
                                    {item.projected_stock} <span className="text-xs font-normal text-slate-500">{item.unit}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 mt-0.5 block">
                                    Buffer: {item.minimum_stock} min
                                </span>
                            </div>
                        </div>

                        {/* Forecast Chart (Debossed Well) */}
                        <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                        Predicted Daily Consumption Path
                                    </h4>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 font-bold border border-pink-200 dark:border-pink-800">
                                        {item.model_used}
                                    </span>
                                </div>
                                <span className="text-[11px] text-slate-500 font-medium">
                                    Confidence: <b className={item.confidence === "0%" ? "text-rose-500 font-bold" : ""}>{item.confidence}</b>
                                </span>
                            </div>

                            {item.is_prediction_valid === false && (
                                <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
                                    <i className="fas fa-triangle-exclamation text-amber-500 shrink-0" />
                                    <span>Data is not enough for prediction (requires 3+ years). Forecast is suppressed with 0% AI confidence.</span>
                                </div>
                            )}

                            <div className="h-48 w-full relative">
                                <canvas ref={chartCanvasRef}></canvas>
                            </div>
                        </div>

                        {/* Recommendation Banner */}
                        <div
                            className={`p-4 rounded-2xl border flex items-start gap-3 ${
                                item.risk_level === "Critical"
                                    ? "bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-200 shadow-[3px_3px_8px_rgba(166,175,195,0.2)]"
                                    : item.risk_level === "Low Stock Risk"
                                    ? "bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 shadow-[3px_3px_8px_rgba(166,175,195,0.2)]"
                                    : "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200 shadow-[3px_3px_8px_rgba(166,175,195,0.2)]"
                            }`}
                        >
                            <i
                                className={`fas mt-0.5 text-base ${
                                    item.risk_level === "Critical"
                                        ? "fa-triangle-exclamation text-rose-600 dark:text-rose-400"
                                        : item.risk_level === "Low Stock Risk"
                                        ? "fa-circle-exclamation text-amber-600 dark:text-amber-400"
                                        : "fa-circle-check text-emerald-600 dark:text-emerald-400"
                                }`}
                            />
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider">
                                    Operational Recommendation
                                </h4>
                                <p className="text-xs mt-1 leading-relaxed font-medium">
                                    {item.recommended_action}
                                </p>
                            </div>
                        </div>

                        {/* Model Evaluation Details if available (Debossed Well & Inner Pills) */}
                        {item.evaluation?.has_evaluation && (
                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]">
                                <div className="flex items-center justify-between mb-2.5">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                        Model Backtesting & Holdout Accuracy
                                    </h4>
                                    <span className="text-[10px] font-mono text-slate-400">
                                        Winner: {item.evaluation.model_tested || "Automated Tournament"}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2.5 text-center">
                                    <div className="p-2.5 rounded-xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/80 dark:border-white/[0.05] shadow-[2px_2px_5px_rgba(166,175,195,0.25),-2px_-2px_5px_rgba(255,255,255,0.85)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)]">
                                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                                            {item.evaluation.accuracy_percentage}%
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-medium">Holdout Accuracy</div>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/80 dark:border-white/[0.05] shadow-[2px_2px_5px_rgba(166,175,195,0.25),-2px_-2px_5px_rgba(255,255,255,0.85)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)]">
                                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                                            {item.evaluation.mae}
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-medium">Mean Abs Error (MAE)</div>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/80 dark:border-white/[0.05] shadow-[2px_2px_5px_rgba(166,175,195,0.25),-2px_-2px_5px_rgba(255,255,255,0.85)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5)]">
                                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                                            {item.evaluation.wape}%
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-medium">WAPE Error</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Machine Learning Training Metrics Card (If ML Regressor Was Used) */}
                        {item.ml_metadata && (
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-200/80 dark:border-indigo-800/50 shadow-[inset_1.5px_1.5px_3px_rgba(99,102,241,0.15)] space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-md bg-indigo-500 text-white flex items-center justify-center text-[10px]">
                                            <i className="fas fa-brain" />
                                        </span>
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
                                            Machine Learning Training Telemetry
                                        </h4>
                                    </div>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-700">
                                        Gradient Descent (MSE + Ridge L2)
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                                    <div className="p-2 rounded-xl bg-white/80 dark:bg-black/30 border border-indigo-100 dark:border-indigo-900/40">
                                        <span className="text-[10px] text-slate-500 block font-medium">Training Epochs</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-100">{item.ml_metadata.epochs}</span>
                                    </div>
                                    <div className="p-2 rounded-xl bg-white/80 dark:bg-black/30 border border-indigo-100 dark:border-indigo-900/40">
                                        <span className="text-[10px] text-slate-500 block font-medium">Final Loss (MSE)</span>
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{item.ml_metadata.finalLoss}</span>
                                    </div>
                                    <div className="p-2 rounded-xl bg-white/80 dark:bg-black/30 border border-indigo-100 dark:border-indigo-900/40">
                                        <span className="text-[10px] text-slate-500 block font-medium">R² Determination</span>
                                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{item.ml_metadata.r2Score}</span>
                                    </div>
                                    <div className="p-2 rounded-xl bg-white/80 dark:bg-black/30 border border-indigo-100 dark:border-indigo-900/40">
                                        <span className="text-[10px] text-slate-500 block font-medium">Learning Rate (α)</span>
                                        <span className="font-bold text-purple-600 dark:text-purple-400">{item.ml_metadata.learningRate}</span>
                                    </div>
                                </div>

                                {item.ml_metadata.featureImportances?.length > 0 && (
                                    <div className="pt-1 border-t border-indigo-200/40 dark:border-indigo-800/30">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
                                            Learned Feature Importance Weights:
                                        </span>
                                        <div className="space-y-1">
                                            {item.ml_metadata.featureImportances.map((feat: any, idx: number) => (
                                                <div key={idx} className="flex items-center justify-between text-[11px]">
                                                    <span className="text-slate-600 dark:text-slate-300 font-medium">{feat.featureName}</span>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-20 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                                            <div
                                                                className="h-full bg-indigo-500 rounded-full"
                                                                style={{ width: `${feat.importancePercentage}%` }}
                                                            />
                                                        </div>
                                                        <span className="font-mono text-[10px] text-slate-500 w-8 text-right font-semibold">
                                                            {feat.importancePercentage}%
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between shrink-0 bg-[#ebf0f7]/40 dark:bg-[#14151c]/40">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Supplier: <b>{item.supplier || "Internal / Standard"}</b>
                        </span>
                        <div className="flex items-center gap-2">
                            <AppButton
                                type="button"
                                variant="neutral"
                                size="sm"
                                onClick={onClose}
                            >
                                Close
                            </AppButton>
                            <Link href={`/procurement?search=${encodeURIComponent(item.item_code)}`}>
                                <AppButton
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                >
                                    <i className="fas fa-shopping-cart text-xs mr-1.5" />
                                    Review in Procurement
                                </AppButton>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
