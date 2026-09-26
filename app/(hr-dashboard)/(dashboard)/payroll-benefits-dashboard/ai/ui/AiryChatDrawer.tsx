"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import {
    X,
    Send,
    Loader2,
    Printer,
    Download,
    AlertTriangle,
    Copy,
    Check,
    ExternalLink,
    ArrowRight,
} from "lucide-react";
import { airyChat } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/ai/actions/payrollActions";
import type { AiryBlock } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/ai/shared/types";

type Attachment = {
    type: "image";
    url: string;
    label?: string;
    downloadUrl?: string;
    printUrl?: string;
};

type Msg = {
    role: "user" | "assistant";
    content: string;
    attachment?: Attachment;
    blocks?: AiryBlock[];
};

function sanitize(text: string): string {
    if (!text) return "";
    let s = text;
    s = s.replace(/```[\s\S]*?```/g, (m) =>
        m.replace(/```[a-z]*\n?/gi, "").trim()
    );
    s = s.replace(/`([^`]+)`/g, "$1");
    s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
    s = s.replace(/__([^_]+)__/g, "$1");
    s = s.replace(/(^|\s)\*([^*\n]+)\*(?=\s|$)/g, "$1$2");
    s = s.replace(/(^|\s)_([^_\n]+)_(?=\s|$)/g, "$1$2");
    s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");
    s = s.replace(/^\s*[-*+]\s+/gm, "");
    s = s.replace(/^\s*\d+\.\s+/gm, "");
    s = s.replace(/^\s*>\s?/gm, "");
    s = s.replace(/—/g, ",");
    s = s.replace(/–/g, ",");
    s = s.replace(/[ \t]+\n/g, "\n");
    s = s.replace(/\n{3,}/g, "\n\n");
    const emojiRe =
        /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}]/gu;
    s = s.replace(emojiRe, "");
    return s.trim();
}

function downloadFileName(label: string | undefined, url: string): string {
    if (label) {
        const cleaned = label.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 60);
        return `${cleaned}.png`;
    }
    const base = url.split("/").pop() || "payslip.png";
    return base;
}

function blockToPlainText(blocks?: AiryBlock[]): string {
    if (!blocks || blocks.length === 0) return "";
    const lines: string[] = [];
    for (const b of blocks) {
        if (b.kind === "heading") lines.push(b.text.toUpperCase());
        else if (b.kind === "summary") {
            lines.push(b.items.map((i) => `${i.label}: ${i.value}`).join("  |  "));
        } else if (b.kind === "employee_table") {
            for (const it of b.items) {
                lines.push(
                    `${it.name}\t${it.employee_id_number}\t${it.position ?? "—"}${it.warnings.length ? `\t${it.warnings.join(", ")}` : ""
                    }`
                );
            }
        } else if (b.kind === "top_rated_table") {
            for (const it of b.items) {
                lines.push(
                    `${it.name}\t${it.employee_id_number}\t${it.department ?? "—"}\t${it.rating.toFixed(2)}`
                );
            }
        } else if (b.kind === "run_table") {
            for (const it of b.items) {
                lines.push(
                    `${it.period_start} to ${it.period_end}\t${it.approval_status}${it.note ? `\t${it.note}` : ""
                    }`
                );
            }
        } else if (b.kind === "link") {
            lines.push(`${b.full} -> ${b.href}`);
        } else if (b.kind === "text") {
            lines.push(b.text);
        }
    }
    return lines.join("\n");
}

const STATUS_STYLES: Record<string, string> = {
    draft:
        "bg-gray-50 text-gray-600 ring-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:ring-gray-700",
    pending_approval:
        "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800/40",
    approved:
        "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/40",
    rejected:
        "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-800/40",
    distributed:
        "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:ring-blue-800/40",
};

const STATUS_LABELS: Record<string, string> = {
    draft: "Draft",
    pending_approval: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    distributed: "Distributed",
};

function formatShortDate(iso: string): string {
    if (!iso) return "";
    try {
        return new Date(iso).toLocaleDateString("en-PH", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    } catch {
        return iso;
    }
}

function WarningBadges({
    warnings,
}: {
    warnings: Array<"missing_bank" | "missing_birthdate">;
}) {
    if (warnings.length === 0) {
        return (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/40">
                Complete
            </span>
        );
    }
    return (
        <div className="flex flex-wrap gap-1 justify-end">
            {warnings.includes("missing_bank") && (
                <span
                    title="Missing bank details"
                    className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800/40"
                >
                    <AlertTriangle className="h-2.5 w-2.5" />
                    Bank
                </span>
            )}
            {warnings.includes("missing_birthdate") && (
                <span
                    title="Missing birthdate"
                    className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-medium text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:ring-rose-800/40"
                >
                    <AlertTriangle className="h-2.5 w-2.5" />
                    DOB
                </span>
            )}
        </div>
    );
}

function EmployeeTable({
    items,
}: {
    items: Array<{
        name: string;
        employee_id_number: string;
        position: string | null;
        department: string | null;
        warnings: Array<"missing_bank" | "missing_birthdate">;
    }>;
}) {
    return (
        <div className="rounded-xl border border-line bg-paper overflow-hidden dark:border-line/30">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="border-b border-line bg-ink/[0.02] dark:bg-ink/[0.04]">
                            <th className="text-left px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                Employee
                            </th>
                            <th className="text-left px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                ID
                            </th>
                            <th className="text-left px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                Position
                            </th>
                            <th className="text-right px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                Status
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((row, i) => (
                            <tr
                                key={i}
                                className="border-b border-line last:border-b-0 hover:bg-ink/[0.02] transition-colors dark:border-line/30"
                            >
                                <td className="px-3 py-2 text-[12px] font-medium text-ink font-rethink whitespace-nowrap">
                                    {row.name}
                                </td>
                                <td className="px-3 py-2 text-[11px] text-muted font-mono whitespace-nowrap">
                                    {row.employee_id_number}
                                </td>
                                <td className="px-3 py-2 text-[11px] text-ink/80 font-rethink">
                                    {row.position || "—"}
                                    {row.department && (
                                        <span className="block text-[10px] text-muted">
                                            {row.department}
                                        </span>
                                    )}
                                </td>
                                <td className="px-3 py-2 text-right whitespace-nowrap">
                                    <WarningBadges warnings={row.warnings} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function RunTable({
    items,
}: {
    items: Array<{
        id: number;
        period_start: string;
        period_end: string;
        approval_status: string;
        note?: string | null;
    }>;
}) {
    return (
        <div className="rounded-xl border border-line bg-paper overflow-hidden dark:border-line/30">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="border-b border-line bg-ink/[0.02] dark:bg-ink/[0.04]">
                            <th className="text-left px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                Period
                            </th>
                            <th className="text-right px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                Status
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((row, i) => (
                            <tr
                                key={i}
                                className="border-b border-line last:border-b-0 hover:bg-ink/[0.02] transition-colors dark:border-line/30"
                            >
                                <td className="px-3 py-2 text-[12px] text-ink font-rethink whitespace-nowrap">
                                    {formatShortDate(row.period_start)} to{" "}
                                    {formatShortDate(row.period_end)}
                                    {row.note && (
                                        <span className="block text-[10px] text-red-600 dark:text-red-400 mt-0.5">
                                            {row.note}
                                        </span>
                                    )}
                                </td>
                                <td className="px-3 py-2 text-right whitespace-nowrap">
                                    <span
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium ring-1 ${STATUS_STYLES[row.approval_status] ||
                                            STATUS_STYLES.draft
                                            }`}
                                    >
                                        {STATUS_LABELS[row.approval_status] ||
                                            row.approval_status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function TopRatedTable({
    items,
}: {
    items: Array<{
        name: string;
        employee_id_number: string;
        department: string | null;
        rating: number;
        letter_grade: string | null;
    }>;
}) {
    return (
        <div className="rounded-xl border border-line bg-paper overflow-hidden dark:border-line/30">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="border-b border-line bg-ink/[0.02] dark:bg-ink/[0.04]">
                            <th className="text-left px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                #
                            </th>
                            <th className="text-left px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                Employee
                            </th>
                            <th className="text-left px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                Department
                            </th>
                            <th className="text-right px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                Rating
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((row, i) => (
                            <tr
                                key={i}
                                className="border-b border-line last:border-b-0 hover:bg-ink/[0.02] transition-colors dark:border-line/30"
                            >
                                <td className="px-3 py-2 text-[11px] font-mono text-muted whitespace-nowrap">
                                    {i + 1}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                    <p className="text-[12px] font-medium text-ink font-rethink">
                                        {row.name}
                                    </p>
                                    <p className="text-[10px] text-muted font-mono">
                                        {row.employee_id_number}
                                    </p>
                                </td>
                                <td className="px-3 py-2 text-[11px] text-ink/80 font-rethink">
                                    {row.department || "—"}
                                </td>
                                <td className="px-3 py-2 text-right whitespace-nowrap">
                                    <span className="text-[13px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                        {row.rating.toFixed(2)}
                                    </span>
                                    {row.letter_grade && (
                                        <span className="block text-[9px] text-muted font-rethink">
                                            {row.letter_grade}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function LinkBlock({
    full,
    href,
    allowed,
    reason,
}: {
    label: string;
    full: string;
    href: string;
    allowed: boolean;
    reason?: string;
}) {
    if (!allowed) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-950/30 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-red-800 dark:text-red-300 font-rethink">
                        Access denied
                    </p>
                    <p className="text-[11px] text-red-700/80 dark:text-red-400/80 font-rethink mt-0.5">
                        {reason === "wrong_role"
                            ? "Your role does not include access to this page."
                            : "I could not verify your session."}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <a
            href={href}
            className="group flex items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/[0.04] hover:bg-accent/[0.10] px-3.5 py-3 transition-colors"
        >
            <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                    <ExternalLink className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-ink font-rethink truncate">
                        {full}
                    </p>
                    <p className="text-[10px] text-muted font-rethink font-mono truncate">
                        {href}
                    </p>
                </div>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-accent group-hover:translate-x-0.5 transition-transform">
                Open
                <ArrowRight className="h-3 w-3" />
            </span>
        </a>
    );
}

function BlockRenderer({ block }: { block: AiryBlock }) {
    if (block.kind === "heading") {
        return (
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink px-1 pt-1">
                {block.text}
            </div>
        );
    }

    if (block.kind === "summary") {
        const cols = block.items.length >= 3 ? "grid-cols-3" : "grid-cols-2";
        return (
            <div
                className={`grid ${cols} gap-2 rounded-xl border border-line bg-paper p-2.5 dark:border-line/30`}
            >
                {block.items.map((item, i) => {
                    const tintCls =
                        item.tint === "success"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : item.tint === "warning"
                                ? "text-amber-600 dark:text-amber-400"
                                : item.tint === "danger"
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-ink";
                    return (
                        <div key={i} className="text-center">
                            <p className="text-[9px] uppercase tracking-wide text-muted font-rethink">
                                {item.label}
                            </p>
                            <p
                                className={`text-lg font-mono font-semibold tabular-nums ${tintCls}`}
                            >
                                {item.value}
                            </p>
                        </div>
                    );
                })}
            </div>
        );
    }

    if (block.kind === "employee_table") {
        return <EmployeeTable items={block.items} />;
    }

    if (block.kind === "run_table") {
        return <RunTable items={block.items} />;
    }

    if (block.kind === "top_rated_table") {
        return <TopRatedTable items={block.items} />;
    }

    if (block.kind === "link") {
        return (
            <LinkBlock
                label={block.label}
                full={block.full}
                href={block.href}
                allowed={block.allowed}
                reason={block.reason}
            />
        );
    }

    if (block.kind === "text") {
        return (
            <p className="text-sm text-ink font-rethink leading-relaxed whitespace-pre-wrap">
                {block.text}
            </p>
        );
    }

    return null;
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch {
            const ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            ta.remove();
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        }
    };

    return (
        <button
            type="button"
            onClick={handleCopy}
            title={copied ? "Copied" : "Copy reply"}
            className="inline-flex items-center gap-1 rounded-md border border-line bg-paper px-1.5 py-0.5 text-[10px] font-medium text-muted hover:text-ink hover:bg-ink/5 transition-colors"
        >
            {copied ? (
                <>
                    <Check className="h-3 w-3 text-emerald-600" />
                    Copied
                </>
            ) : (
                <>
                    <Copy className="h-3 w-3" />
                    Copy
                </>
            )}
        </button>
    );
}

function MessageBubble({
    m,
    index,
    onDownload,
}: {
    m: Msg;
    index: number;
    onDownload: (a: Attachment) => void;
}) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{
                type: "spring",
                stiffness: 300,
                damping: 26,
                delay: index * 0.02,
            }}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
        >
            {m.role === "assistant" && (
                <motion.img
                    src="/images/airy-ai/ok.png"
                    alt=""
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className="h-7 w-7 mr-2 mt-0.5 object-contain shrink-0"
                />
            )}
            <div className="max-w-[94%] space-y-2 min-w-0">
                <div
                    className={`rounded-2xl px-3.5 py-2.5 text-sm font-rethink leading-relaxed whitespace-pre-wrap ${m.role === "user"
                            ? "bg-accent text-white"
                            : "bg-ink/[0.04] text-ink dark:bg-ink/[0.08]"
                        }`}
                >
                    {m.content}
                </div>

                {m.blocks && m.blocks.length > 0 && (
                    <div className="space-y-2">
                        {m.blocks.map((block, bi) => (
                            <motion.div
                                key={bi}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 260,
                                    damping: 24,
                                    delay: 0.08 + bi * 0.06,
                                }}
                            >
                                <BlockRenderer block={block} />
                            </motion.div>
                        ))}
                    </div>
                )}

                {m.attachment?.type === "image" && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.94 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 260, damping: 22 }}
                        className="rounded-xl border border-line overflow-hidden bg-white"
                    >
                        <img
                            src={m.attachment.url}
                            alt={m.attachment.label || "Payslip"}
                            className="w-full h-auto"
                        />
                        <div className="flex gap-2 p-2 bg-ink/[0.02] border-t border-line">
                            <a
                                href={m.attachment.printUrl || m.attachment.url}
                                target="_blank"
                                rel="noreferrer"
                                title="Open in new tab for printing"
                                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-paper px-2 py-1.5 text-[11px] font-medium text-ink hover:bg-ink/5 transition-colors"
                            >
                                <Printer className="h-3.5 w-3.5" />
                                Print
                            </a>
                            <button
                                type="button"
                                onClick={() => onDownload(m.attachment!)}
                                title="Download PNG"
                                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-paper px-2 py-1.5 text-[11px] font-medium text-ink hover:bg-ink/5 transition-colors"
                            >
                                <Download className="h-3.5 w-3.5" />
                                Download
                            </button>
                        </div>
                    </motion.div>
                )}

                {m.role === "assistant" && index > 0 && (
                    <div className="flex items-center gap-2 px-1">
                        <CopyButton
                            text={
                                m.content + (m.blocks ? "\n\n" + blockToPlainText(m.blocks) : "")
                            }
                        />
                    </div>
                )}
            </div>
        </motion.div>
    );
}

export function AiryChatDrawer({
    isOpen,
    onClose,
    context,
    adminUserId,
}: {
    isOpen: boolean;
    onClose: () => void;
    context?: Record<string, any>;
    adminUserId?: string;
}) {
    const [messages, setMessages] = useState<Msg[]>([
        {
            role: "assistant",
            content:
                "Good day. I can help with employee lookups, payroll runs, payslip generation, and pre-run checks. What do you need?",
        },
    ]);
    const [input, setInput] = useState("");
    const [thinking, setThinking] = useState(false);
    const [openingGreeting, setOpeningGreeting] = useState(false);
    const [securityWarning, setSecurityWarning] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const drawerRef = useRef<HTMLDivElement | null>(null);
    const headerRef = useRef<HTMLDivElement | null>(null);
    const bodyRef = useRef<HTMLDivElement | null>(null);
    const footerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setOpeningGreeting(true);
        const t = setTimeout(() => setOpeningGreeting(false), 2200);
        return () => clearTimeout(t);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !drawerRef.current) return;

        const ctx = gsap.context(() => {
            const tl = gsap.timeline({
                defaults: { ease: "power3.out" },
            });

            tl.fromTo(
                drawerRef.current,
                { opacity: 0, y: 30, scale: 0.94 },
                { opacity: 1, y: 0, scale: 1, duration: 0.5 }
            );

            if (headerRef.current) {
                tl.fromTo(
                    headerRef.current.children,
                    { opacity: 0, y: -10 },
                    { opacity: 1, y: 0, duration: 0.35, stagger: 0.06 },
                    "-=0.25"
                );
            }

            if (bodyRef.current) {
                tl.fromTo(
                    bodyRef.current.children,
                    { opacity: 0, y: 8 },
                    { opacity: 1, y: 0, duration: 0.3, stagger: 0.05 },
                    "-=0.2"
                );
            }

            if (footerRef.current) {
                tl.fromTo(
                    footerRef.current,
                    { opacity: 0, y: 12 },
                    { opacity: 1, y: 0, duration: 0.3 },
                    "-=0.15"
                );
            }
        }, drawerRef);

        return () => ctx.revert();
    }, [isOpen]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, thinking]);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [isOpen, onClose]);

    const handleSend = async () => {
        if (!input.trim() || thinking) return;
        const userMsg = input.trim();
        setInput("");

        const priorHistory = messages.map((m) => ({
            role: m.role,
            content: m.content,
        }));

        setMessages((m) => [...m, { role: "user", content: userMsg }]);
        setThinking(true);

        try {
            const reply = await airyChat(userMsg, context, adminUserId, priorHistory);

            setMessages((m) => [
                ...m,
                {
                    role: "assistant",
                    content: sanitize(reply.text),
                    attachment: reply.attachment,
                    blocks: reply.blocks,
                },
            ]);

            if (/Attempt \d+ of \d+/i.test(reply.text)) {
                setSecurityWarning(reply.text);
            } else if (!reply.forceLogout) {
                setSecurityWarning(null);
            }

            if (reply.forceLogout) {
                const dest = reply.redirectTo || "/hrAuth";
                setSecurityWarning(reply.text);
                setTimeout(() => {
                    if (typeof window !== "undefined") {
                        window.location.href = dest;
                    }
                }, 3500);
            }
        } catch (e: any) {
            setMessages((m) => [
                ...m,
                {
                    role: "assistant",
                    content:
                        "The assistant is unavailable right now. Please try again in a moment.",
                },
            ]);
        } finally {
            setThinking(false);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    };

    const handleDownload = async (att: Attachment) => {
        try {
            const res = await fetch(att.downloadUrl || att.url);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = downloadFileName(att.label, att.url);
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch {
            window.open(att.downloadUrl || att.url, "_blank");
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={drawerRef}
                    className="fixed z-50
            right-3 bottom-3
            sm:right-6 sm:bottom-24
            w-[calc(100vw-1.5rem)] sm:w-[420px] md:w-[460px] lg:w-[480px]
            max-w-[480px]
            h-[min(620px,calc(100dvh-2rem))]
            max-h-[calc(100dvh-2rem)]
            rounded-2xl border border-line bg-paper shadow-2xl
            overflow-hidden flex flex-col"
                >
                    <div
                        ref={headerRef}
                        className="flex items-center gap-3 px-4 py-3 border-b border-line bg-gradient-to-r from-pink-50 to-white dark:from-pink-950/30 dark:to-transparent"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-line overflow-hidden">
                            <AnimatePresence mode="wait">
                                {openingGreeting ? (
                                    <motion.video
                                        key="hi"
                                        src="/images/airy-ai/hi-run.mp4"
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                        initial={{ opacity: 0, scale: 0.6 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.6 }}
                                        className="h-10 w-10 object-contain"
                                    />
                                ) : thinking ? (
                                    <motion.video
                                        key="run"
                                        src="/images/airy-ai/run.mp4"
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                        initial={{ opacity: 0, scale: 0.6 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.6 }}
                                        className="h-10 w-10 object-contain"
                                    />
                                ) : (
                                    <motion.img
                                        key="idle"
                                        src="/images/airy-ai/hi-full.png"
                                        alt="Airy"
                                        initial={{ opacity: 0, scale: 0.6 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.6 }}
                                        className="h-9 w-9 object-contain"
                                    />
                                )}
                            </AnimatePresence>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-ink font-bricolage">
                                Airy
                            </p>
                            <motion.p
                                key={thinking ? "w" : openingGreeting ? "g" : "i"}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-[10px] text-muted font-rethink"
                            >
                                {thinking
                                    ? "Working…"
                                    : openingGreeting
                                        ? "Saying hello…"
                                        : "Payroll co-pilot"}
                            </motion.p>
                        </div>
                        <motion.button
                            onClick={onClose}
                            whileHover={{ rotate: 90, scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            title="Close Airy"
                            className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-ink/5 transition-colors"
                        >
                            <X className="h-4 w-4 text-muted" />
                        </motion.button>
                    </div>

                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto p-4 space-y-3"
                    >
                        <div ref={bodyRef} className="space-y-3">
                            <AnimatePresence initial={false}>
                                {messages.map((m, i) => (
                                    <MessageBubble
                                        key={i}
                                        m={m}
                                        index={i}
                                        onDownload={handleDownload}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>

                        <AnimatePresence>
                            {thinking && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    className="flex justify-start items-center gap-2"
                                >
                                    <video
                                        src="/images/airy-ai/run.mp4"
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                        className="h-8 w-8 object-contain"
                                    />
                                    <div className="rounded-2xl bg-ink/[0.04] px-3.5 py-2.5 text-xs text-muted font-rethink flex items-center gap-2">
                                        Working
                                        <motion.span
                                            animate={{ opacity: [0.3, 1, 0.3] }}
                                            transition={{ duration: 1.2, repeat: Infinity }}
                                        >
                                            ●
                                        </motion.span>
                                        <motion.span
                                            animate={{ opacity: [0.3, 1, 0.3] }}
                                            transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
                                        >
                                            ●
                                        </motion.span>
                                        <motion.span
                                            animate={{ opacity: [0.3, 1, 0.3] }}
                                            transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
                                        >
                                            ●
                                        </motion.span>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {securityWarning && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="mx-3 mb-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-950/30 px-3 py-2"
                        >
                            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                            <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-semibold text-red-800 dark:text-red-300 font-rethink">
                                    Restricted request logged
                                </p>
                                <p className="text-[10px] text-red-700/80 dark:text-red-400/80 font-rethink mt-0.5">
                                    Repeated attempts will end your session automatically.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSecurityWarning(null)}
                                title="Dismiss"
                                className="shrink-0 rounded p-0.5 text-red-600/70 hover:text-red-800 dark:text-red-400/70 dark:hover:text-red-200"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </motion.div>
                    )}

                    <div
                        ref={footerRef}
                        className="border-t border-line p-3 flex gap-2"
                    >
                        <input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) =>
                                e.key === "Enter" && !e.shiftKey && handleSend()
                            }
                            placeholder="Ask Airy: list employees, top performers, missing bank details…"
                            title="Type your message"
                            className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
                        />
                        <motion.button
                            onClick={handleSend}
                            disabled={thinking || !input.trim()}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.92 }}
                            title="Send message"
                            className="rounded-lg bg-accent px-3 py-2 text-white disabled:opacity-50 hover:bg-accent/90 transition-colors"
                        >
                            {thinking ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </motion.button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}