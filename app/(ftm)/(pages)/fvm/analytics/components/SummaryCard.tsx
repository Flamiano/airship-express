import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

type SummaryCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: string;
  delta?: number | null;
};

export default function SummaryCard({ label, value, icon: Icon, tone, delta }: SummaryCardProps) {
  const positive = delta != null && delta > 0;
  const negative = delta != null && delta < 0;

  return (
    <article className="fvm-panel min-w-0 rounded-[22px] border border-pink-100 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(244,114,182,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">{value}</p>
      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
        <span>vs previous period</span>
        {delta == null ? (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-500">No baseline</span>
        ) : (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold ${positive ? "bg-emerald-50 text-emerald-700" : negative ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
            {positive ? <ArrowUpRight className="h-3 w-3" /> : negative ? <ArrowDownRight className="h-3 w-3" /> : null}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
    </article>
  );
}
