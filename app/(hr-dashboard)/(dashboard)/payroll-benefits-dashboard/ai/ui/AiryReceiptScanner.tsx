"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Loader2,
    Sparkles,
    Camera,
    FileText,
    RefreshCw,
    Shield,
    Zap,
} from "lucide-react";

export type ScanVerdict = {
    verdict: "approve" | "review" | "reject";
    confidence: number;
    notes: string;
    extracted: {
        merchant: string | null;
        date: string | null;
        amount: number | null;
    };
    mismatches: Array<{
        field: string;
        claimed: string;
        found: string;
        severity: "low" | "medium" | "high";
    }>;
    tamper_signals: string[];
    receipt_readable: boolean;
    readability_issue: string | null;
};

type Props = {
    imagePreviewUrl: string | null;
    scanning: boolean;
    verdict: ScanVerdict | null;
    onRescan?: () => void;
};

const AIRY_AVATAR = "/images/airy-ai/hi.png";
const AIRY_RUN = "/images/airy-ai/run.png";

const SCAN_STAGES = [
    { at: 0, label: "Uploading receipt…", icon: Camera },
    { at: 15, label: "Reading merchant header…", icon: FileText },
    { at: 35, label: "Extracting amount and date…", icon: Sparkles },
    { at: 55, label: "Cross-checking claimed fields…", icon: Shield },
    { at: 75, label: "Detecting tamper signals…", icon: Zap },
    { at: 90, label: "Finalizing verdict…", icon: CheckCircle2 },
];

export function AiryReceiptScanner({
    imagePreviewUrl,
    scanning,
    verdict,
    onRescan,
}: Props) {
    const [stageIndex, setStageIndex] = useState(0);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (!scanning) {
            setStageIndex(0);
            setProgress(0);
            return;
        }
        const started = Date.now();
        const id = setInterval(() => {
            const elapsed = Date.now() - started;
            const pct = Math.min(95, (elapsed / 5000) * 100);
            setProgress(pct);

            let idx = 0;
            for (let i = 0; i < SCAN_STAGES.length; i++) {
                if (pct >= SCAN_STAGES[i].at) idx = i;
            }
            setStageIndex(idx);
        }, 120);
        return () => clearInterval(id);
    }, [scanning]);

    if (!imagePreviewUrl) return null;

    const stage = SCAN_STAGES[stageIndex];
    const StageIcon = stage.icon;

    return (
        <div className="relative overflow-hidden rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50/80 via-fuchsia-50/50 to-paper p-4 dark:border-violet-800/40 dark:from-violet-950/40 dark:via-fuchsia-950/20 dark:to-paper">
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-fuchsia-400/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-violet-400/10 blur-3xl" />

            <div className="relative mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="relative">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30">
                            <Sparkles className="h-4 w-4" />
                        </div>
                        {scanning && (
                            <motion.span
                                className="absolute inset-0 rounded-xl border-2 border-fuchsia-400"
                                animate={{ scale: [1, 1.35, 1], opacity: [0.8, 0, 0.8] }}
                                transition={{ duration: 1.6, repeat: Infinity }}
                            />
                        )}
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300 font-rethink">
                            Airy Scan Receipt
                        </p>
                        <p className="text-[10px] text-violet-600/70 dark:text-violet-400/70 font-rethink">
                            {scanning
                                ? "AI verification in progress"
                                : verdict
                                    ? "Verification complete"
                                    : "Ready to verify"}
                        </p>
                    </div>
                </div>

                {!scanning && verdict && (
                    <VerdictBadge verdict={verdict.verdict} />
                )}
            </div>

            <div className="relative overflow-hidden rounded-xl border border-violet-200/40 bg-black/5 dark:border-violet-800/30 dark:bg-black/40">
                <img
                    src={imagePreviewUrl}
                    alt="Receipt being scanned"
                    className="max-h-64 w-full object-contain"
                    style={{ filter: scanning ? "saturate(1.05)" : "none" }}
                />

                <AnimatePresence>
                    {scanning && (
                        <>
                            <motion.div
                                initial={{ y: "-15%" }}
                                animate={{ y: "115%" }}
                                exit={{ opacity: 0 }}
                                transition={{
                                    duration: 1.7,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                }}
                                className="pointer-events-none absolute left-0 right-0 h-24"
                                style={{
                                    background:
                                        "linear-gradient(to bottom, rgba(139,92,246,0) 0%, rgba(217,70,239,0.55) 45%, rgba(139,92,246,0.55) 55%, rgba(139,92,246,0) 100%)",
                                    boxShadow:
                                        "0 0 32px 8px rgba(168,85,247,0.55), 0 0 64px 16px rgba(217,70,239,0.25)",
                                }}
                            />
                            <motion.div
                                className="pointer-events-none absolute inset-0"
                                animate={{ opacity: [0.25, 0.5, 0.25] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                style={{
                                    background:
                                        "radial-gradient(circle at 50% 50%, rgba(139,92,246,0.18), transparent 70%)",
                                }}
                            />

                            <div className="pointer-events-none absolute inset-3">
                                <motion.div
                                    className="absolute left-0 top-0 h-5 w-5 border-l-2 border-t-2 border-fuchsia-400"
                                    animate={{ opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 1.4, repeat: Infinity }}
                                />
                                <motion.div
                                    className="absolute right-0 top-0 h-5 w-5 border-r-2 border-t-2 border-fuchsia-400"
                                    animate={{ opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 1.4, repeat: Infinity, delay: 0.35 }}
                                />
                                <motion.div
                                    className="absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2 border-fuchsia-400"
                                    animate={{ opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 1.4, repeat: Infinity, delay: 0.7 }}
                                />
                                <motion.div
                                    className="absolute bottom-0 right-0 h-5 w-5 border-b-2 border-r-2 border-fuchsia-400"
                                    animate={{ opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 1.4, repeat: Infinity, delay: 1.05 }}
                                />
                            </div>

                            <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur">
                                <Loader2 className="h-3 w-3 animate-spin text-fuchsia-300" />
                                <span className="font-rethink">{stage.label}</span>
                            </div>

                            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40 backdrop-blur">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400"
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 0.15 }}
                                />
                            </div>
                        </>
                    )}
                </AnimatePresence>

                {!scanning && verdict && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute bottom-2 left-2 right-2 flex items-center gap-2 rounded-lg bg-black/70 px-2.5 py-1.5 backdrop-blur"
                    >
                        <img
                            src={AIRY_AVATAR}
                            alt="Airy"
                            className="h-5 w-5 rounded-full border border-white/40"
                        />
                        <span className="text-[10px] font-medium text-white font-rethink truncate">
                            Airy verified this receipt
                        </span>
                        <span
                            className={`ml-auto rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${verdict.verdict === "approve"
                                    ? "bg-emerald-500 text-white"
                                    : verdict.verdict === "review"
                                        ? "bg-amber-500 text-white"
                                        : "bg-red-500 text-white"
                                }`}
                        >
                            {verdict.verdict}
                        </span>
                    </motion.div>
                )}
            </div>

            <AnimatePresence>
                {!scanning && verdict && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="relative mt-3 space-y-2.5"
                    >
                        <div className="flex items-start gap-2.5 rounded-lg border border-violet-200/50 bg-white/60 p-2.5 dark:border-violet-800/40 dark:bg-violet-950/30">
                            <img
                                src={AIRY_AVATAR}
                                alt="Airy"
                                className="h-8 w-8 shrink-0 rounded-full border border-violet-200 dark:border-violet-700"
                            />
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300 font-rethink">
                                    Airy says
                                </p>
                                <p className="mt-0.5 text-[11px] leading-relaxed text-ink/90 font-rethink">
                                    {!verdict.receipt_readable
                                        ? `I couldn't read this receipt clearly.${verdict.readability_issue
                                            ? ` ${verdict.readability_issue}`
                                            : ""
                                        } Please retake the photo: flat on a surface, good lighting, all four corners visible, no glare.`
                                        : verdict.verdict === "approve"
                                            ? "Everything matches. The amount, merchant, and details on this receipt line up with the claim. Safe to approve."
                                            : verdict.verdict === "review"
                                                ? "I spotted a few differences. Nothing critical, but take a moment to review the mismatches below before approving."
                                                : "This receipt does not match the claim. Do not approve without a manual check. Enable override only if you've verified it yourself."}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <MiniStat
                                label="Merchant"
                                value={verdict.extracted.merchant || "—"}
                            />
                            <MiniStat
                                label="Date"
                                value={verdict.extracted.date || "—"}
                            />
                            <MiniStat
                                label="Amount"
                                value={
                                    verdict.extracted.amount != null
                                        ? `₱${verdict.extracted.amount.toLocaleString()}`
                                        : "—"
                                }
                            />
                        </div>

                        {verdict.mismatches.length > 0 && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 dark:border-amber-800/40 dark:bg-amber-950/30">
                                <div className="mb-1.5 flex items-center gap-1.5">
                                    <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300 font-rethink">
                                        Mismatches found
                                    </p>
                                </div>
                                <ul className="space-y-1">
                                    {verdict.mismatches.map((m, i) => (
                                        <li
                                            key={i}
                                            className="text-[11px] text-amber-900/90 dark:text-amber-200/90 font-rethink"
                                        >
                                            <span className="font-semibold capitalize">
                                                {m.field}:
                                            </span>{" "}
                                            claimed "{m.claimed}" vs found "{m.found}"
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {verdict.tamper_signals.length > 0 && (
                            <div className="rounded-lg border border-red-200 bg-red-50/70 p-2.5 dark:border-red-800/40 dark:bg-red-950/30">
                                <div className="mb-1.5 flex items-center gap-1.5">
                                    <Shield className="h-3 w-3 text-red-600 dark:text-red-400" />
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-red-700 dark:text-red-300 font-rethink">
                                        Possible tampering
                                    </p>
                                </div>
                                <ul className="space-y-1">
                                    {verdict.tamper_signals.map((s, i) => (
                                        <li
                                            key={i}
                                            className="text-[11px] text-red-900/90 dark:text-red-200/90 font-rethink"
                                        >
                                            • {s}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {verdict.notes && (
                            <p className="text-[11px] text-muted font-rethink italic">
                                {verdict.notes}
                            </p>
                        )}

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-ink/10 dark:bg-ink/20">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{
                                            width: `${Math.max(0, Math.min(100, verdict.confidence * 100))}%`,
                                        }}
                                        transition={{ duration: 0.8, ease: "easeOut" }}
                                        className={`h-full ${verdict.confidence >= 0.8
                                                ? "bg-emerald-500"
                                                : verdict.confidence >= 0.6
                                                    ? "bg-amber-500"
                                                    : "bg-red-500"
                                            }`}
                                    />
                                </div>
                                <p className="text-[10px] text-muted font-rethink">
                                    {(verdict.confidence * 100).toFixed(0)}% confidence
                                </p>
                            </div>

                            {onRescan && (
                                <button
                                    type="button"
                                    onClick={onRescan}
                                    className="inline-flex items-center gap-1 rounded-md border border-violet-300 bg-white/70 px-2 py-1 text-[10px] font-medium text-violet-700 transition-colors hover:bg-violet-50 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-900/40 font-rethink"
                                >
                                    <RefreshCw className="h-3 w-3" />
                                    Re-scan
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {!scanning && !verdict && (
                <div className="relative mt-3 flex items-center gap-2.5 rounded-lg border border-dashed border-violet-300/60 bg-white/40 p-2.5 dark:border-violet-800/50 dark:bg-violet-950/20">
                    <img
                        src={AIRY_RUN}
                        alt="Airy waiting"
                        className="h-8 w-8 shrink-0 rounded-full border border-violet-200 dark:border-violet-700"
                    />
                    <p className="text-[11px] text-violet-700 dark:text-violet-300 font-rethink">
                        Airy is ready. Fill in the amount, claim type, and employee to start the scan.
                    </p>
                </div>
            )}
        </div>
    );
}

function VerdictBadge({
    verdict,
}: {
    verdict: "approve" | "review" | "reject";
}) {
    const map = {
        approve: {
            cls: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-emerald-500/30",
            icon: CheckCircle2,
            label: "Matched",
        },
        review: {
            cls: "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-amber-500/30",
            icon: AlertTriangle,
            label: "Review",
        },
        reject: {
            cls: "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-red-500/30",
            icon: XCircle,
            label: "Reject",
        },
    } as const;
    const m = map[verdict];
    const Icon = m.icon;
    return (
        <motion.span
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider shadow-lg ${m.cls}`}
        >
            <Icon className="h-3 w-3" />
            {m.label}
        </motion.span>
    );
}

function MiniStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-md border border-violet-200/50 bg-white/60 p-2 dark:border-violet-800/40 dark:bg-violet-950/30">
            <p className="text-[9px] uppercase tracking-wider text-violet-600/80 dark:text-violet-400/80 font-rethink">
                {label}
            </p>
            <p className="text-[11px] font-semibold text-ink truncate font-rethink">
                {value}
            </p>
        </div>
    );
}