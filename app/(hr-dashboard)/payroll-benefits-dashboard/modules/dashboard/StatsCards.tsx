'use client';

import { motion } from 'framer-motion';

const STATS = [
    { label: 'Next pay run', value: 'Aug 08', hint: 'in 4 days', tone: 'bg-accent' },
    { label: 'Payroll cost, this cycle', value: '₱4.82M', hint: '312 employees', tone: 'bg-accent-dark' },
    { label: 'Pending claims', value: '18', hint: '₱126,400 total', tone: 'bg-ink' },
    { label: 'Active HMO enrollees', value: '287', hint: '92% of headcount', tone: 'bg-emerald-600' },
];

export function StatsCards() {
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.06,
            },
        },
    };

    const item = {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0 },
    };

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4"
        >
            {STATS.map((s) => (
                <motion.div
                    key={s.label}
                    variants={item}
                    className={`${s.tone} rounded-2xl px-4 py-5 text-paper sm:px-5`}
                >
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-paper/70 sm:text-[11.5px]">
                        {s.label}
                    </p>
                    <p className="mt-2 font-bricolage text-[20px] font-medium tracking-tight sm:text-[24px]">
                        {s.value}
                    </p>
                    <p className="mt-0.5 text-[12px] text-paper/70">{s.hint}</p>
                </motion.div>
            ))}
        </motion.div>
    );
}