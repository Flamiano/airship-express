"use client";
import Link from "next/link";
import { AppButton } from "@/app/(supplyChain)/components/ui/AppButton";

interface Params {
    link: string;
    icon?: string;
    label: string;
    className?: string;
    color?: string;
}

export function DownloadBtn() {
    return (
        <div className="flex items-center gap-2">
            <AppButton
                type="button"
                variant="neutral"
                size="sm"
                onClick={() => alert("PDF export started")}
            >
                <i className="fas fa-file-pdf text-pink-500 dark:text-pink-400 text-xs mr-1"></i>
                <span>Export PDF</span>
            </AppButton>
        </div>
    );
}

export function LinkBtn({ link, icon = "", label, className = "" }: Params) {
    return (
        <Link
            href={link}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold
            bg-slate-50 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200
            border border-slate-200/90 dark:border-slate-800
            shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] 
            dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)]
            hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700
            hover:shadow-xs active:scale-[0.98] transition-all cursor-pointer ${className}`}
        >
            {icon && <i className={`${icon} text-pink-500 dark:text-pink-400 text-xs`}></i>}
            <span>{label}</span>
        </Link>
    );
}

interface NavBtnProps {
    link: string;
    color: string;
    icon: string;
    label: string;
    onClick?: () => void;
    'data-tab'?: string;
}

export function NavBtn({ link, color, icon, label, onClick, 'data-tab': dataTab }: NavBtnProps) {
    return (
        <button
            className={`tab-btn relative flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl
                        border transition-all whitespace-nowrap cursor-pointer
                        bg-slate-50/80 dark:bg-slate-900/60
                        border-slate-200/80 dark:border-slate-800
                        shadow-[inset_0_1px_0_#ffffff,0_1px_2px_rgba(0,0,0,0.04)]
                        dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.3)]
                        hover:border-pink-300 dark:hover:border-pink-500/40
                        data-[active=true]:border-pink-500 dark:data-[active=true]:border-pink-500
                        data-[active=true]:bg-pink-50 dark:data-[active=true]:bg-pink-950/40
                        data-[active=true]:text-pink-600 dark:data-[active=true]:text-pink-400
                        active:scale-[0.98]`}
            data-tab={dataTab || link}
            onClick={onClick}
        >
            <i className={`${icon} text-pink-500 dark:text-pink-400`}></i>
            <span>{label}</span>
        </button>
    );
}

export { CrudActionButton } from "@/app/(supplyChain)/components/ui/CrudActionButton";
export type { CrudActionButtonProps, CrudActionType, CrudActionVariant } from "@/app/(supplyChain)/components/ui/CrudActionButton";