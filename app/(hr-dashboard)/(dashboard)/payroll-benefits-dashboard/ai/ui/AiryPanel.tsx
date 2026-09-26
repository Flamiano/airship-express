"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import {
    airyPreflight,
    airyAudit,
    airyRunSummary,
    airyRecoveryPlan,
    airyDistributeCheck,
    airyBudgetGuard,
    airyAnomalyDeep,
} from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/ai/actions/payrollActions";

type AiryMode =
    | "preflight"
    | "audit"
    | "summary"
    | "recovery"
    | "distribute"
    | "budget"
    | "deep";

const TITLES: Record<AiryMode, string> = {
    preflight: "Airy Preflight Check",
    audit: "Airy Anomaly Audit",
    summary: "Airy Run Summary",
    recovery: "Airy Recovery Plan",
    distribute: "Airy Distribution Check",
    budget: "Airy Budget Guard",
    deep: "Airy Deep Anomaly Analysis",
};

const HANDLERS: Record<
    AiryMode,
    (ctx: any, adminUserId?: string) => Promise<string>
> = {
    preflight: airyPreflight,
    audit: airyAudit,
    summary: airyRunSummary,
    recovery: airyRecoveryPlan,
    distribute: airyDistributeCheck,
    budget: airyBudgetGuard,
    deep: airyAnomalyDeep,
};

export function AiryPanel({
    mode,
    context,
    adminUserId,
    autoRun = false,
}: {
    mode: AiryMode;
    context: any;
    adminUserId?: string;
    autoRun?: boolean;
}) {
    const [output, setOutput] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const run = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await HANDLERS[mode](context, adminUserId);
            setOutput(res);
        } catch (e: any) {
            setError(e?.message || "Airy is offline.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (autoRun && !output && !loading) void run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="rounded-xl border border-accent/20 bg-accent/[0.03] p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white border border-accent/20 overflow-hidden">
                        <img
                            src="/images/airy-ai/hi.png"
                            alt="Airy"
                            className="h-6 w-6 object-contain"
                        />
                    </div>
                    <p className="text-xs font-semibold text-ink font-rethink">
                        {TITLES[mode]}
                    </p>
                </div>
                <button
                    onClick={run}
                    disabled={loading}
                    title="Ask Airy again"
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-accent/20 bg-white text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
                >
                    {loading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                        <RefreshCw className="h-3 w-3" />
                    )}
                </button>
            </div>

            {loading ? (
                <div className="flex items-center gap-2 py-3">
                    <video
                        src="/images/airy-ai/run.mp4"
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="h-6 w-6 object-contain"
                    />
                    <span className="text-xs text-muted font-rethink">
                        Airy is analyzing…
                    </span>
                </div>
            ) : error ? (
                <p className="text-xs text-red-600 font-rethink">{error}</p>
            ) : output ? (
                <p className="text-xs text-ink font-rethink leading-relaxed whitespace-pre-wrap">
                    {output}
                </p>
            ) : (
                <button
                    onClick={run}
                    title="Ask Airy"
                    className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline font-rethink"
                >
                    <Sparkles className="h-3 w-3" /> Click to run
                </button>
            )}
        </div>
    );
}