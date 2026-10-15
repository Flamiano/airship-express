"use client";

import { useState } from "react";
import Link from "next/link";
import ExecutiveInfoModal, { ExecutiveModalContentType } from "./modals/ExecutiveInfoModal";

interface QuickActionsProps {
    onSelectTab?: (tab: string) => void;
}

export default function QuickActions({ onSelectTab }: QuickActionsProps) {
    const [infoModalContent, setInfoModalContent] = useState<ExecutiveModalContentType | null>(null);

    const showDocInfoModal = () => {
        setInfoModalContent({
            type: "info",
            data: {
                title: "Document Archival & Compliance Oversight",
                subtitle: "Executive Governance & Record Keeping",
                icon: "fa-file-shield",
                description:
                    "Executive role accounts maintain view-only governance and compliance access over contract attachments, supplier BIR certificates, and shipping manifests. Creation and direct file uploads are executed by procurement officers and warehouse dock supervisors in accordance with operational segregation-of-duties protocols.",
                details: [
                    { label: "Executive Permission Scope", value: "Audit & Read-Only Archival", tone: "blue" },
                    { label: "Document Types Monitored", value: "Supplier Accreditations & Receipts", tone: "emerald" },
                    { label: "Audit Trail Status", value: "Active & Realtime Verified", tone: "emerald" }
                ],
                note: "To review full document breakdowns and report exports, navigate to the Reports tab in the executive dashboard."
            }
        });
    };

    return (
        <>
            <div className="bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] rounded-3xl p-5 shadow-[6px_6px_18px_rgba(166,175,195,0.35),-6px_-6px_18px_rgba(255,255,255,0.9)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.8),-4px_-4px_12px_rgba(255,255,255,0.03)] flex flex-col justify-between transition-all">
                <div>
                    <div className="flex items-center pb-3.5 border-b border-slate-200/60 dark:border-white/[0.06] mb-4">
                        <div className="w-9 h-9 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] text-pink-500 dark:text-pink-400 flex items-center justify-center mr-3 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)] shrink-0">
                            <i className="fas fa-bolt text-xs"></i>
                        </div>
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">Quick actions</span>
                    </div>

                    <div className="p-4 bg-[#ebf0f7] dark:bg-[#12131b] rounded-2xl border border-white/80 dark:border-white/[0.06] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.3),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.6)]">
                        <div className="grid grid-cols-2 gap-2.5">
                            <Link
                                href="?tab=operations"
                                onClick={() => onSelectTab?.("operations")}
                                className="inline-flex items-center justify-center gap-2 px-3.5 py-3 rounded-2xl text-xs font-bold
                                bg-[#f0f3f8] dark:bg-[#191a24] text-slate-700 dark:text-slate-200
                                border border-white/90 dark:border-white/[0.08]
                                shadow-[4px_4px_10px_rgba(166,175,195,0.4),-4px_-4px_10px_rgba(255,255,255,0.95)] 
                                dark:shadow-[4px_4px_12px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.04)]
                                hover:bg-[#e8edf5] dark:hover:bg-[#20212f]
                                active:shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.4),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)]
                                active:scale-[0.98] transition-all cursor-pointer"
                                title="View warehouse storage & operations"
                            >
                                <i className="fas fa-boxes-stacked text-pink-500 dark:text-pink-400 text-xs"></i>
                                <span>Operations</span>
                            </Link>

                            <Link
                                href="?tab=issued-pos"
                                onClick={() => onSelectTab?.("issued-pos")}
                                className="inline-flex items-center justify-center gap-2 px-3.5 py-3 rounded-2xl text-xs font-bold
                                bg-[#f0f3f8] dark:bg-[#191a24] text-slate-700 dark:text-slate-200
                                border border-white/90 dark:border-white/[0.08]
                                shadow-[4px_4px_10px_rgba(166,175,195,0.4),-4px_-4px_10px_rgba(255,255,255,0.95)] 
                                dark:shadow-[4px_4px_12px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.04)]
                                hover:bg-[#e8edf5] dark:hover:bg-[#20212f]
                                active:shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.4),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)]
                                active:scale-[0.98] transition-all cursor-pointer"
                                title="Inspect issued purchase orders"
                            >
                                <i className="fas fa-file-invoice text-pink-500 dark:text-pink-400 text-xs"></i>
                                <span>Issued POs</span>
                            </Link>

                            <button
                                type="button"
                                onClick={showDocInfoModal}
                                className="inline-flex items-center justify-center gap-2 px-3.5 py-3 rounded-2xl text-xs font-bold
                                bg-[#f0f3f8] dark:bg-[#191a24] text-slate-700 dark:text-slate-200
                                border border-white/90 dark:border-white/[0.08]
                                shadow-[4px_4px_10px_rgba(166,175,195,0.4),-4px_-4px_10px_rgba(255,255,255,0.95)] 
                                dark:shadow-[4px_4px_12px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.04)]
                                hover:bg-[#e8edf5] dark:hover:bg-[#20212f]
                                active:shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.4),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)]
                                active:scale-[0.98] transition-all cursor-pointer"
                                title="View document compliance info"
                            >
                                <i className="fas fa-file-shield text-pink-500 dark:text-pink-400 text-xs"></i>
                                <span>Doc Archive</span>
                            </button>

                            <Link
                                href="?tab=forecast"
                                onClick={() => onSelectTab?.("forecast")}
                                className="inline-flex items-center justify-center gap-2 px-3.5 py-3 rounded-2xl text-xs font-bold
                                bg-[#f0f3f8] dark:bg-[#191a24] text-slate-700 dark:text-slate-200
                                border border-white/90 dark:border-white/[0.08]
                                shadow-[4px_4px_10px_rgba(166,175,195,0.4),-4px_-4px_10px_rgba(255,255,255,0.95)] 
                                dark:shadow-[4px_4px_12px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.04)]
                                hover:bg-[#e8edf5] dark:hover:bg-[#20212f]
                                active:shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.4),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)]
                                active:scale-[0.98] transition-all cursor-pointer"
                                title="View predictive demand & forecast models"
                            >
                                <i className="fas fa-chart-line text-pink-500 dark:text-pink-400 text-xs"></i>
                                <span>Forecast</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <ExecutiveInfoModal
                isOpen={!!infoModalContent}
                onClose={() => setInfoModalContent(null)}
                content={infoModalContent}
            />
        </>
    );
}