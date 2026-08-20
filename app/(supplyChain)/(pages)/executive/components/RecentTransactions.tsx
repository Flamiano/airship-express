import ViewLink from "@/app/(supplyChain)/components/global/Links";

interface Transaction {
    id: string;
    consignee: string;
    courier: string;
    area: string;
    status: string;
    received: string;
}

const transactions: Transaction[] = [
    {
        id: "AX-1023",
        consignee: "Maria Santos",
        courier: "Shopee Express",
        area: "Area A",
        status: "Received",
        received: "2026-07-17 08:23"
    },
    {
        id: "AX-1027",
        consignee: "John Reyes",
        courier: "J&T Express",
        area: "Area B",
        status: "Waiting",
        received: "2026-07-17 09:45"
    },
    {
        id: "AX-1018",
        consignee: "Ana Cruz",
        courier: "Lazada Express",
        area: "Area C",
        status: "Dispatched",
        received: "2026-07-17 10:15"
    },
    {
        id: "AX-1032",
        consignee: "Mike Tan",
        courier: "Flash Express",
        area: "Area A",
        status: "Received",
        received: "2026-07-17 11:30"
    },
    {
        id: "AX-1020",
        consignee: "Lisa Gomez",
        courier: "Shopee Express",
        area: "Area D",
        status: "Dispatched",
        received: "2026-07-17 12:00"
    },
    {
        id: "AX-1034",
        consignee: "Carlos Mendoza",
        courier: "J&T Express",
        area: "Area B",
        status: "Ready for Dispatch",
        received: "2026-07-17 13:20"
    }
];

const StatusBadge = ({ status }: { status: string }) => {
    // Map status to appropriate color scheme
    const getStatusStyles = (status: string) => {
        switch (status) {
            case "Received":
                return "bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/40";
            case "Waiting":
                return "bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/40";
            case "Dispatched":
                return "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40";
            case "Ready for Dispatch":
                return "bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/40";
            default:
                return "bg-slate-50 text-slate-700 border-slate-200/80 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700/60";
        }
    };

    const dotColor = {
        "Received": "bg-blue-500 dark:bg-blue-400",
        "Waiting": "bg-amber-500 dark:bg-amber-400",
        "Dispatched": "bg-emerald-500 dark:bg-emerald-400",
        "Ready for Dispatch": "bg-purple-500 dark:bg-purple-400"
    }[status] || "bg-slate-500 dark:bg-slate-400";

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${getStatusStyles(status)}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
            {status}
        </span>
    );
};

export default function RecentTransactions() {
    return (
        <div className="card xl:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs dark:shadow-xl overflow-hidden">
            {/* Card Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-2.5 font-semibold text-slate-900 dark:text-white text-sm">
                    <div className="w-8 h-8 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400 flex items-center justify-center border border-pink-100 dark:border-pink-900/30">
                        <i className="fas fa-list text-xs"></i>
                    </div>
                    <span>Recent transactions</span>
                </div>
                <ViewLink link="/inventory" name="Open inventory" />
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-50/70 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200/80 dark:border-slate-800">
                        <tr>
                            <th className="px-6 py-3.5">Reference</th>
                            <th className="px-6 py-3.5">Consignee</th>
                            <th className="px-6 py-3.5">Courier</th>
                            <th className="px-6 py-3.5">Area</th>
                            <th className="px-6 py-3.5">Status</th>
                            <th className="px-6 py-3.5">Received</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                        {transactions.map((tx, index) => (
                            <tr
                                key={tx.id}
                                className={`${index % 2 === 1 ? 'bg-slate-50/30 dark:bg-slate-800/20' : 'bg-white dark:bg-slate-900'} 
                                           hover:bg-slate-50 dark:hover:bg-slate-800/50 
                                           transition-colors duration-150`}
                            >
                                <td className="px-6 py-3.5 font-mono font-semibold text-slate-800 dark:text-slate-200">{tx.id}</td>
                                <td className="px-6 py-3.5 text-slate-900 dark:text-white">{tx.consignee}</td>
                                <td className="px-6 py-3.5 text-slate-600 dark:text-slate-300">{tx.courier}</td>
                                <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400">{tx.area}</td>
                                <td className="px-6 py-3.5">
                                    <StatusBadge status={tx.status} />
                                </td>
                                <td className="px-6 py-3.5 text-slate-400 dark:text-slate-500 font-mono text-[11px]">{tx.received}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}