"use client";
import Link from "next/link";

interface Params {
    link: string;
    icon: string;
    label: string;
    className?: string;
    color?: string;
}

export function DownloadBtn() {
    return (
        <div className="flex items-center gap-2">
            <button
                className="btn-ghost bg-white dark:bg-[#2a2a2e] 
                        border border-slate-200/60 dark:border-slate-700/60
                        text-slate-700 dark:text-slate-300
                        hover:bg-slate-50 dark:hover:bg-[#3a3a3e]
                        transition-all duration-200
                        py-2 px-4 rounded-xl text-[13px] font-medium 
                        inline-flex items-center gap-2"
                onClick={() => alert("PDF export started")}
            >
                <i className="fas fa-file-pdf mr-2 text-pink-500 dark:text-pink-400"></i>
                Export PDF
            </button>
        </div>
    );
}

export function LinkBtn({ link, icon = "", label, className = "btn-ghost justify-center" }: Params) {
    const baseClasses = "bg-white dark:bg-[#2a2a2e] " +
        "border border-slate-200/60 dark:border-slate-700/60 " +
        "text-slate-700 dark:text-slate-300 " +
        "hover:bg-slate-50 dark:hover:bg-[#3a3a3e] " +
        "transition-all duration-200 " +
        "py-2 px-3.5 rounded-xl text-[13px] font-medium " +
        "inline-flex items-center gap-2";
    return (
        <Link
            href={link}
            className={`${baseClasses} ${className}`}
        >
            {icon && <i className={icon}></i>}
            {label}
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
            className={`tab-btn relative flex items-center gap-2 px-3 py-2 text-sm font-semibold 
                        border-b-2 transition-all whitespace-nowrap
                        ${color}
                        hover:text-slate-900 dark:hover:text-white
                        ${color.includes('text-') ? color : 'text-slate-600 dark:text-slate-400'}
                        border-transparent hover:border-pink-500 dark:hover:border-pink-400
                        data-[active=true]:border-pink-500 dark:data-[active=true]:border-pink-400
                        data-[active=true]:text-pink-600 dark:data-[active=true]:text-pink-400`}
            data-tab={dataTab || link}
            onClick={onClick}
        >
            <i className={`${icon} text-pink-500 dark:text-pink-400`}></i>
            {label}
        </button>
    );
}