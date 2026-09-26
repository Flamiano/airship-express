'use client';

import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/useCurrentUser';

const SLIDES = [
    '/images/flash.jpg',
    '/images/gogo.jpg',
    '/images/lazada.jpg',
    '/images/shoppee.jpg',
];

const SLIDE_INTERVAL = 6000;

function greetingFor(hour: number) {
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
}

export function HeroCarousel() {
    const { user } = useCurrentUser();
    const firstName = user?.fullName?.split(' ')[0] ?? 'there';
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const id = setInterval(() => {
            setIndex((i) => (i + 1) % SLIDES.length);
        }, SLIDE_INTERVAL);
        return () => clearInterval(id);
    }, []);

    const greeting = greetingFor(new Date().getHours());

    return (
        <div
            className="relative w-full overflow-hidden rounded-2xl border border-line bg-ink dark:border-paper/10"
            style={{ minHeight: 240 }}
        >
            <div className="absolute inset-0">
                {SLIDES.map((src, i) => (
                    <img
                        key={src}
                        src={src}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${i === index ? 'opacity-100' : 'opacity-0'
                            }`}
                    />
                ))}
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/30" />
            </div>

            <div className="relative z-10 flex flex-col justify-between gap-6 px-6 py-7 sm:px-8 sm:py-9">
                <div className="flex items-start gap-4">
                    <div className="relative shrink-0">
                        <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-white/30 bg-black/40 backdrop-blur">
                            <img
                                src="/images/airy-ai/hi.png"
                                alt="Airy"
                                className="h-11 w-11 object-contain"
                            />
                        </div>
                    </div>

                    <div className="min-w-0">
                        <p className="text-[11.5px] font-medium uppercase tracking-[0.16em] text-white/70">
                            Airy · Payroll Assistant
                        </p>
                        <h2 className="mt-1 font-bricolage text-[22px] font-semibold leading-tight tracking-tight text-white sm:text-[28px]">
                            {greeting}, {firstName}.
                        </h2>
                        <p className="mt-1.5 max-w-lg text-[13px] leading-relaxed text-white/80 sm:text-[14px]">
                            Here&rsquo;s your payroll snapshot for this cycle. Everything&rsquo;s
                            live — pull up a chart, check the calendar, or ask me anything.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    {SLIDES.map((_, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => setIndex(i)}
                            aria-label={`Show slide ${i + 1}`}
                            className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'
                                }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default HeroCarousel;