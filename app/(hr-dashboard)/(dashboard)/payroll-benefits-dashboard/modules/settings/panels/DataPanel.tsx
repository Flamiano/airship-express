'use client';

import { Download, FileSpreadsheet, FileText } from 'lucide-react';

export default function DataPanel() {
    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-base font-semibold text-ink font-rethink">
                    Data & Reports
                </h2>
                <p className="mt-1 text-[12px] text-muted font-rethink">
                    Export and download your payroll and claims data.
                </p>
            </header>

            <div className="space-y-2">
                <ExportRow
                    icon={FileSpreadsheet}
                    title="Payroll runs summary"
                    description="All runs with period, status, and totals."
                />
                <ExportRow
                    icon={FileSpreadsheet}
                    title="Claims register"
                    description="Every claim with verification verdict."
                />
                <ExportRow
                    icon={FileText}
                    title="Employee master list"
                    description="Active and inactive employees."
                />
                <ExportRow
                    icon={Download}
                    title="Audit trail"
                    description="Security events and admin actions."
                />
            </div>

            <p className="text-[11px] text-muted font-rethink">
                Bulk exports of salary data require written approval from the Data
                Privacy Officer.
            </p>
        </div>
    );
}

function ExportRow({
    icon: Icon,
    title,
    description,
}: {
    icon: React.ElementType;
    title: string;
    description: string;
}) {
    return (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-paper p-4 dark:border-line/40">
            <div className="flex items-start gap-3 min-w-0">
                <Icon className="h-4 w-4 mt-0.5 shrink-0 text-accent" />
                <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink font-rethink">
                        {title}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-muted font-rethink">
                        {description}
                    </p>
                </div>
            </div>
            <button
                type="button"
                disabled
                className="shrink-0 rounded-lg border border-line bg-paper px-3 py-1.5 text-[11.5px] font-medium text-muted opacity-60 dark:border-line/40 font-rethink"
            >
                Export
            </button>
        </div>
    );
}