import { BadgeTone } from "@/app/(supplyChain)/components/ui/StatusBadge";

export const getStatusTone = (status: string): BadgeTone => {
    switch (status?.toLowerCase()) {
        case 'delivered':
        case 'ready_for_pickup':
        case 'available':
            return 'emerald';
        case 'sorting':
        case 'low-stock':
            return 'amber';
        case 'received':
        case 'in-use':
            return 'blue';
        case 'picked_up':
            return 'purple';
        case 'in_transit':
            return 'indigo';
        case 'out_for_delivery':
            return 'pink';
        case 'cancelled':
        case 'returned':
        case 'out-of-stock':
        case 'maintenance':
            return 'rose';
        case 'retired':
        default:
            return 'neutral';
    }
};

export const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
        'available': 'bg-[#e6f8ef] text-emerald-800 border-emerald-300/90 shadow-[0_1px_3px_rgba(16,185,129,0.12),inset_0_1px_0_#ffffff] dark:bg-[#0f2c1f] dark:text-emerald-200 dark:border-[#1d573c]',
        'low-stock': 'bg-[#fef3c7] text-amber-800 border-amber-300/90 shadow-[0_1px_3px_rgba(245,158,11,0.12),inset_0_1px_0_#ffffff] dark:bg-[#332005] dark:text-amber-200 dark:border-[#633e08]',
        'out-of-stock': 'bg-[#ffe8ec] text-rose-700 border-rose-300/90 shadow-[0_1px_3px_rgba(225,29,72,0.12),inset_0_1px_0_#ffffff] dark:bg-[#38141b] dark:text-rose-200 dark:border-[#6d202d]',
        'received': 'bg-[#e0f2fe] text-sky-700 border-sky-300/90 shadow-[0_1px_3px_rgba(14,165,233,0.12),inset_0_1px_0_#ffffff] dark:bg-[#0c2a42] dark:text-sky-200 dark:border-[#124b74]',
        'sorting': 'bg-[#fef3c7] text-amber-800 border-amber-300/90 shadow-[0_1px_3px_rgba(245,158,11,0.12),inset_0_1px_0_#ffffff] dark:bg-[#332005] dark:text-amber-200 dark:border-[#633e08]',
        'ready_for_pickup': 'bg-[#e6f8ef] text-emerald-800 border-emerald-300/90 shadow-[0_1px_3px_rgba(16,185,129,0.12),inset_0_1px_0_#ffffff] dark:bg-[#0f2c1f] dark:text-emerald-200 dark:border-[#1d573c]',
        'picked_up': 'bg-[#f3e8ff] text-purple-700 border-purple-300/90 shadow-[0_1px_3px_rgba(168,85,247,0.12),inset_0_1px_0_#ffffff] dark:bg-[#2e1047] dark:text-purple-200 dark:border-[#581c87]',
        'in_transit': 'bg-[#e0e7ff] text-indigo-700 border-indigo-300/90 shadow-[0_1px_3px_rgba(99,102,241,0.12),inset_0_1px_0_#ffffff] dark:bg-[#1e1b4b] dark:text-indigo-200 dark:border-[#3730a3]',
        'out_for_delivery': 'bg-[#ffe6f0] text-pink-700 border-pink-300/90 shadow-[0_1px_3px_rgba(244,63,94,0.12),inset_0_1px_0_#ffffff] dark:bg-[#341427] dark:text-pink-200 dark:border-[#67224c]',
        'delivered': 'bg-[#e6f8ef] text-emerald-800 border-emerald-300/90 shadow-[0_1px_3px_rgba(16,185,129,0.12),inset_0_1px_0_#ffffff] dark:bg-[#0f2c1f] dark:text-emerald-200 dark:border-[#1d573c]',
        'in-use': 'bg-[#e0f2fe] text-sky-700 border-sky-300/90 shadow-[0_1px_3px_rgba(14,165,233,0.12),inset_0_1px_0_#ffffff] dark:bg-[#0c2a42] dark:text-sky-200 dark:border-[#124b74]',
        'maintenance': 'bg-[#ffe8ec] text-rose-700 border-rose-300/90 shadow-[0_1px_3px_rgba(225,29,72,0.12),inset_0_1px_0_#ffffff] dark:bg-[#38141b] dark:text-rose-200 dark:border-[#6d202d]',
        'retired': 'bg-white text-slate-700 border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_#ffffff] dark:bg-[#1c1d25] dark:text-slate-200 dark:border-[#353746]',
    };
    return classes[status] || 'bg-white text-slate-700 border-slate-200 dark:bg-[#1c1d25] dark:text-slate-200 dark:border-[#353746]';
};

export const getStatusLabel = (status: string) => {
    switch (status) {
        case 'ready_for_pickup': return 'Ready for Pickup';
        case 'picked_up': return 'Picked Up';
        case 'in_transit': return 'In Transit';
        case 'out_for_delivery': return 'Out for Delivery';
        case 'low-stock': return 'Low Stock';
        case 'out-of-stock': return 'Out of Stock';
        case 'in-use': return 'In Use';
        default: return status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ') : 'N/A';
    }
};

export const calculateItemStatus = (currentStock: number, minimumStock: number): 'available' | 'low-stock' | 'out-of-stock' => {
    if (currentStock <= 0) return 'out-of-stock';
    if (currentStock < minimumStock) return 'low-stock';
    return 'available';
};