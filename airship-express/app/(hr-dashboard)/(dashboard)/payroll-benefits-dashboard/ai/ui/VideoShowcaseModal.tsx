'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '../shared/utils';

interface VideoShowcaseModalProps {
    open: boolean;
    onClose: () => void;
}

const CLIPS = [
    { src: '/images/airy-ai/okay_make_a_promo_video.mp4', label: 'Meet Airy' },
    { src: '/images/airy-ai/combine_all_of_this_video__an.mp4', label: 'What Airy can do' },
    { src: '/images/airy-ai/do_all_option_and_make_video_w.mp4', label: 'Live in your dashboard' },
];

export const VideoShowcaseModal: React.FC<VideoShowcaseModalProps> = ({ open, onClose }) => {
    const [activeIndex, setActiveIndex] = useState(0);

    const goTo = (index: number) => {
        setActiveIndex((index + CLIPS.length) % CLIPS.length);
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 px-4 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.94, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 12 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-line bg-paper shadow-2xl dark:border-line/30"
                    >
                        <button
                            type="button"
                            onClick={onClose}
                            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-ink/70 text-paper backdrop-blur transition-colors hover:bg-ink"
                            aria-label="Close"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        <div className="relative aspect-[9/12] w-full bg-ink sm:aspect-video">
                            <video
                                key={CLIPS[activeIndex].src}
                                src={CLIPS[activeIndex].src}
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="h-full w-full object-cover"
                            />

                            {CLIPS.length > 1 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => goTo(activeIndex - 1)}
                                        className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-ink/50 text-paper backdrop-blur transition-colors hover:bg-ink/70"
                                        aria-label="Previous"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => goTo(activeIndex + 1)}
                                        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-ink/50 text-paper backdrop-blur transition-colors hover:bg-ink/70"
                                        aria-label="Next"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-3 px-4 py-3">
                            <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink font-rethink">
                                <Sparkles className="h-3.5 w-3.5 text-accent" />
                                {CLIPS[activeIndex].label}
                            </div>
                            <div className="flex items-center gap-1.5">
                                {CLIPS.map((clip, i) => (
                                    <button
                                        key={clip.src}
                                        type="button"
                                        onClick={() => setActiveIndex(i)}
                                        className={cn(
                                            'h-1.5 rounded-full transition-all',
                                            i === activeIndex ? 'w-5 bg-accent' : 'w-1.5 bg-ink/15 dark:bg-ink/30'
                                        )}
                                        aria-label={`Go to ${clip.label}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};