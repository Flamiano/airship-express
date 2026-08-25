"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";

type LoaderText = {
    title: string;
    subtitle: string;
};

function getLoaderText(pathname: string): LoaderText {
    if (pathname.includes("/payroll-benefits-dashboard/payroll")) {
        return {
            title: "Payroll",
            subtitle: "Retrieving payroll runs and payslip records\u2026",
        };
    }

    if (pathname.includes("/payroll-benefits-dashboard/compensation")) {
        return {
            title: "Compensation",
            subtitle: "Retrieving compensation and salary records\u2026",
        };
    }

    if (pathname.includes("/payroll-benefits-dashboard/claims")) {
        return {
            title: "Claims",
            subtitle: "Retrieving claims and reimbursement records\u2026",
        };
    }

    if (pathname.includes("/payroll-benefits-dashboard/benefits")) {
        return {
            title: "Benefits",
            subtitle: "Calculating government and statutory deductions\u2026",
        };
    }

    if (pathname.includes("/payroll-benefits-dashboard/analytics")) {
        return {
            title: "Analytics",
            subtitle: "Generating reports and workforce insights\u2026",
        };
    }

    if (pathname.includes("/payroll-benefits-dashboard/assistant")) {
        return {
            title: "Assistant",
            subtitle: "Initializing your HR assistant\u2026",
        };
    }

    return {
        title: "Dashboard",
        subtitle: "Preparing your dashboard\u2026",
    };
}

export default function DashboardLoader() {
    const pathname = usePathname() ?? "";
    const { title, subtitle } = getLoaderText(pathname);

    return (
        <div className="flex h-dvh w-full flex-col items-center justify-center gap-6 bg-background text-foreground">
            <div className="relative flex h-28 w-28 items-center justify-center">
                <div className="absolute h-full w-full rounded-full border-2 border-line" />

                <motion.div
                    className="absolute h-full w-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2.2, ease: "linear", repeat: Infinity }}
                >
                    <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                        <motion.div
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-paper shadow-sm ring-1 ring-line"
                            animate={{ rotate: -360 }}
                            transition={{ duration: 2.2, ease: "linear", repeat: Infinity }}
                        >
                            <Image
                                src="/images/logo-remove-bg.png"
                                alt="Airship Express"
                                width={24}
                                height={24}
                                className="h-6 w-6 object-contain"
                                priority
                            />
                        </motion.div>
                    </div>
                </motion.div>

                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-paper">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">
                        Express
                    </span>
                </div>
            </div>

            <div className="flex flex-col items-center gap-1">
                <p className="text-sm font-medium tracking-wide text-ink">{title}</p>
                <p className="text-xs text-muted">{subtitle}</p>
            </div>
        </div>
    );
}