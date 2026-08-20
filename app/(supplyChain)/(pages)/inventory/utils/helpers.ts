export const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
        'available': 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800/60',
        'low-stock': 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60',
        'out-of-stock': 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60',
        'received': 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60',
        'sorting': 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60',
        'ready_for_pickup': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60',
        'picked_up': 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/60',
        'in_transit': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/60',
        'out_for_delivery': 'bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400 dark:border-pink-800/60',
        'delivered': 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800/60',
        'in-use': 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60',
        'maintenance': 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800/60',
        'retired': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
    };
    return classes[status] || 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300';
};

export const getStatusLabel = (status: string) => {
    switch (status) {
        case 'ready_for_pickup': return 'Ready for Pickup';
        case 'picked_up': return 'Picked Up';
        case 'in_transit': return 'In Transit';
        case 'out_for_delivery': return 'Out for Delivery';
        default: return status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ') : 'N/A';
    }
};

export const calculateItemStatus = (currentStock: number, minimumStock: number): 'available' | 'low-stock' | 'out-of-stock' => {
    if (currentStock <= 0) return 'out-of-stock';
    if (currentStock < minimumStock) return 'low-stock';
    return 'available';
};