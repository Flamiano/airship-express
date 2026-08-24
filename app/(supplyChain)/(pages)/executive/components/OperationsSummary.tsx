import ViewLink from "@/app/(supplyChain)/components/global/Links";

export default function OperationsSummary() {
    return (
        <div className="card p-5 
                bg-white dark:bg-slate-900 
                border border-slate-200/80 dark:border-slate-800 
                rounded-2xl shadow-xs 
                dark:shadow-none transition-all">
            <div className="flex items-center justify-between pb-3.5 
                    border-b border-slate-100 dark:border-slate-800/80">
                <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 text-xs uppercase tracking-wider">
                    <div className="w-7 h-7 rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400 flex items-center justify-center border border-pink-100 dark:border-pink-900/30">
                        <i className="fas fa-warehouse text-xs"></i>
                    </div>
                    <span>Operations Summary</span>
                </div>
                <ViewLink link="/warehousing" name="view" />
            </div>

            <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                <li className="py-3 flex justify-between items-center">
                    <span className="font-medium text-slate-600 dark:text-slate-400">Sorting areas active</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-200">4 / 4</span>
                </li>
                <li className="py-3 flex justify-between items-center">
                    <span className="font-medium text-slate-600 dark:text-slate-400">Avg dwell time</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-200">3h 12m</span>
                </li>
                <li className="py-3 flex justify-between items-center">
                    <span className="font-medium text-slate-600 dark:text-slate-400">Scans (today)</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-200">2,146</span>
                </li>
                <li className="py-3 flex justify-between items-center">
                    <span className="font-medium text-slate-600 dark:text-slate-400">Anomalies flagged</span>
                    <span className="font-semibold text-[11px] px-2.5 py-1 rounded-xl 
                            bg-slate-100 dark:bg-slate-800 
                            text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                        3 flagged
                    </span>
                </li>
            </ul>
        </div>
    );
}