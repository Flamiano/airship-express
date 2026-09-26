'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Home, Compass } from 'lucide-react';
import { useNavVisibility } from '../../layout';

interface Custom404Props {
    title?: string;
    description?: string;
    redirectSeconds?: number;
    redirectPath?: string;
    isFullScreen?: boolean;
}

export default function Custom404({
    title = "Page not found",
    description = "The page you're looking for doesn't exist or has been moved to another location.",
    redirectSeconds = 5,
    redirectPath,
    isFullScreen = true,
}: Custom404Props) {
    const router = useRouter();
    const [countdown, setCountdown] = useState(redirectSeconds);
    const { setIsNavHidden } = useNavVisibility();

    useEffect(() => {
        setIsNavHidden?.(true);
        return () => {
            setIsNavHidden?.(false);
        };
    }, [setIsNavHidden]);

    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    if (redirectPath) {
                        router.push(redirectPath);
                    } else {
                        router.back();
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [router, redirectPath, countdown]);

    const handleGoBack = () => {
        if (redirectPath) {
            router.push(redirectPath);
        } else {
            router.back();
        }
    };

    const handleGoHome = () => {
        router.push('/');
    };

    return (
        <div
            className={`${
                isFullScreen
                    ? 'fixed inset-0 z-[9999] bg-[#EEF2F6] dark:bg-[#0c0e14] overflow-y-auto pointer-events-auto'
                    : 'w-full min-h-[calc(100vh-120px)] bg-[#EEF2F6] dark:bg-[#0c0e14]'
            } flex items-center justify-center p-4 sm:p-6 transition-colors duration-300 select-none`}
        >
            {/* Ambient neumorphic background glow */}
            <div
                aria-hidden
                className="pointer-events-none fixed -top-28 -left-28 h-80 w-80 rounded-full bg-accent/10 dark:bg-pink-500/5 blur-3xl"
            />
            <div
                aria-hidden
                className="pointer-events-none fixed -bottom-28 -right-28 h-80 w-80 rounded-full bg-pink-500/10 dark:bg-pink-500/5 blur-3xl"
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 18 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="relative max-w-lg w-full bg-[#EEF2F6] dark:bg-[#141622] rounded-3xl p-6 sm:p-10 text-center border border-white/80 dark:border-white/[0.08] shadow-[14px_14px_32px_#cbd6e4,-14px_-14px_32px_#ffffff] dark:shadow-[20px_20px_50px_rgba(0,0,0,0.85),-8px_-8px_24px_rgba(255,255,255,0.02)] my-auto"
            >
                {/* Neumorphic 404 Floating Badge */}
                <div className="flex justify-center mb-6">
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-[#EEF2F6] dark:bg-[#171926] rounded-3xl p-1 flex items-center justify-center shadow-[6px_6px_14px_#cbd6e4,-6px_-6px_14px_#ffffff] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.7),-4px_-4px_12px_rgba(255,255,255,0.03)] border border-pink-500/20 dark:border-pink-500/30">
                        <div className="w-full h-full rounded-2xl flex items-center justify-center bg-[#EAF0F6] dark:bg-[#10121b] shadow-[inset_3px_3px_6px_#cbd6e4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_rgba(0,0,0,0.6),inset_-2px_-2px_5px_rgba(255,255,255,0.02)]">
                            <Compass className="w-10 h-10 sm:w-12 sm:h-12 text-pink-500 dark:text-pink-400 animate-pulse" />
                        </div>
                    </div>
                </div>

                {/* Recessed Error 404 Chip */}
                <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-[#EAF0F6] dark:bg-[#10121b] shadow-[inset_2px_2px_5px_#cbd6e4,inset_-2px_-2px_5px_#ffffff] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),inset_-1px_-1px_4px_rgba(255,255,255,0.02)] border border-pink-500/20 mb-4">
                    <span className="font-mono text-xs sm:text-sm font-extrabold tracking-widest text-pink-600 dark:text-pink-400 uppercase">
                        Error 404
                    </span>
                </div>

                {/* Heading & Subtitle */}
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-bricolage tracking-tight mb-2.5">
                    {title}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto mb-6">
                    {description}
                </p>

                {/* Recessed Countdown Pill */}
                <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-[#EAF0F6] dark:bg-[#10121b] px-4 py-2 rounded-full shadow-[inset_2px_2px_5px_#cbd6e4,inset_-2px_-2px_5px_#ffffff] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),inset_-1px_-1px_4px_rgba(255,255,255,0.02)] border border-white/40 dark:border-white/[0.06] mb-8">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
                    </span>
                    <span>
                        Redirecting back in{' '}
                        <strong className="font-bold text-slate-900 dark:text-white">{countdown}s</strong>
                    </span>
                </div>

                {/* Neumorphic Tactile Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
                    <button
                        type="button"
                        onClick={handleGoBack}
                        className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400 text-white text-xs sm:text-sm font-semibold rounded-2xl shadow-[4px_4px_12px_rgba(236,72,153,0.38),-2px_-2px_8px_rgba(255,255,255,0.4)] active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer border border-pink-400/30"
                    >
                        <ArrowLeft size={16} />
                        <span>Go Back</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleGoHome}
                        className="w-full sm:w-auto px-6 py-3 bg-[#EEF2F6] dark:bg-[#171926] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs sm:text-sm font-semibold rounded-2xl shadow-[4px_4px_10px_#d1dbe7,-4px_-4px_10px_#ffffff] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)] active:shadow-[inset_2px_2px_5px_#c4d0df,inset_-2px_-2px_5px_#ffffff] dark:active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.7)] transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/60 dark:border-white/[0.08]"
                    >
                        <Home size={16} />
                        <span>Dashboard Home</span>
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
