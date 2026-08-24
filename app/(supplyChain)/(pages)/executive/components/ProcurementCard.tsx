import ViewLink from "@/app/(supplyChain)/components/global/Links";

export default function ProcurementCard() {
    return (
        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs transition-all">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white text-sm">
                    <div className="w-7 h-7 rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400 flex items-center justify-center border border-pink-100 dark:border-pink-900/30">
                        <i className="fas fa-shopping-cart text-xs"></i>
                    </div>
                    <span>Procurement</span>
                </div>
                <ViewLink link="/procurement" name="view" />
            </div>

            <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                <li className="py-2.5 flex justify-between items-center">
                    <span className="font-medium text-slate-600 dark:text-slate-400">Open POs</span>
                    <span className="font-bold text-slate-900 dark:text-white">12</span>
                </li>
                <li className="py-2.5 flex justify-between items-center">
                    <span className="font-medium text-slate-600 dark:text-slate-400">Pending approvals</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">
                        2 pending
                    </span>
                </li>
                <li className="py-2.5 flex justify-between items-center">
                    <span className="font-medium text-slate-600 dark:text-slate-400">MTD spend</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">₱ 661,500</span>
                </li>
                <li className="pt-3 pb-1">
                    <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="font-medium text-slate-600 dark:text-slate-400">Budget utilization</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">62%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200/40 dark:border-slate-700/40">
                        <div
                            className="h-full bg-pink-500 dark:bg-pink-400 rounded-full transition-all duration-500"
                            style={{ width: "62%" }}
                        ></div>
                    </div>
                </li>
            </ul>
        </div>
    );
}