'use client';

import { ShieldCheck, Lock } from 'lucide-react';

interface Props {
    active: boolean;
    secondsLeft: number;
    onLock: () => void;
    scopeLabel?: string;
}

const formatTime = (total: number) => {
    if (!Number.isFinite(total) || total < 0) return '5:00';
    const m = Math.floor(total / 60);
    const s = Math.floor(total % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
};

const OtpUnlockBanner = ({ active, secondsLeft, onLock, scopeLabel }: Props) => {
    if (!active) return null;

    return (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 dark:border-emerald-800/40 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                    <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300 font-rethink">
                        Verified session active · {formatTime(secondsLeft)}
                    </p>
                    <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400/70 font-rethink">
                        {scopeLabel || 'save & delete allowed without re-verifying'}
                    </p>
                </div>
            </div>
            <button
                onClick={onLock}
                className="flex items-center gap-1 rounded-md bg-white/70 px-2 py-1 text-[10px] font-medium text-emerald-700 hover:bg-white dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60 transition-colors"
            >
                <Lock className="h-3 w-3" />
                Lock
            </button>
        </div>
    );
};

export default OtpUnlockBanner;