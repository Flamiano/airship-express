"use client";
import Link from "next/link";
import { AppButton } from "../ui/AppButton";

interface Params {
    link: string;
    icon?: string;
    label: string;
    className?: string;
    color?: string;
}

export function DownloadBtn({ onClick, className = "" }: { onClick?: () => void; className?: string }) {
    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={onClick || (() => alert("PDF export started"))}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold
                bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-700 dark:text-slate-200
                border border-white/70 dark:border-[#2a2b38]
                shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] 
                dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)]
                hover:shadow-[1px_1px_3px_rgba(166,175,195,0.5),-1px_-1px_3px_rgba(255,255,255,0.9)] 
                hover:border-pink-300 dark:hover:border-pink-500/50 active:scale-95 transition-all duration-200 cursor-pointer ${className}`}
            >
                <i className="fas fa-file-pdf text-pink-500 dark:text-pink-400 text-xs"></i>
                <span>Export PDF</span>
            </button>
        </div>
    );
}

export function LinkBtn({ link, icon = "", label, className = "" }: Params) {
    return (
        <Link
            href={link}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold
            bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-700 dark:text-slate-200
            border border-white/70 dark:border-[#2a2b38]
            shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] 
            dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)]
            hover:shadow-[1px_1px_3px_rgba(166,175,195,0.5),-1px_-1px_3px_rgba(255,255,255,0.9)] 
            hover:border-pink-300 dark:hover:border-pink-500/50 active:scale-95 transition-all duration-200 cursor-pointer ${className}`}
        >
            {icon && <i className={`${icon} text-pink-500 dark:text-pink-400 text-xs`}></i>}
            <span>{label}</span>
        </Link>
    );
}

interface NavBtnProps {
    link: string;
    icon: string;
    label: string;
    isActive?: boolean;
    color?: string;
    onClick?: () => void;
    'data-tab'?: string;
}

export function NavBtn({ link, isActive, color, icon, label, onClick, 'data-tab': dataTab }: NavBtnProps) {
    return (
        <button
            type="button"
            className={`tab-btn relative flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl
                        border transition-all duration-200 whitespace-nowrap cursor-pointer
                        active:scale-95 ${
                            isActive
                                ? 'bg-gradient-to-b from-pink-500 to-pink-600 text-white border-pink-400/80 dark:border-pink-500/80 shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)] font-bold'
                                : 'bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-700 dark:text-slate-200 border-white/70 dark:border-[#2a2b38] hover:bg-[#e8edf5] dark:hover:bg-[#232533] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:shadow-[1px_1px_3px_rgba(166,175,195,0.5),-1px_-1px_3px_rgba(255,255,255,0.9)]'
                        } ${color || ''}`}
            data-tab={dataTab || link}
            data-active={isActive ? 'true' : 'false'}
            onClick={onClick}
        >
            <i className={`${icon} ${isActive ? 'text-white' : 'text-pink-500 dark:text-pink-400'}`}></i>
            <span>{label}</span>
        </button>
    );
}

export { CrudActionButton } from "../ui/CrudActionButton";
export type { CrudActionButtonProps, CrudActionType, CrudActionVariant } from "../ui/CrudActionButton";