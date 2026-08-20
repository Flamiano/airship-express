export const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
        'available': 'bg-green-100 text-green-700',
        'low-stock': 'bg-amber-100 text-amber-700',
        'out-of-stock': 'bg-red-100 text-red-700',
        'received': 'bg-blue-100 text-blue-700',
        'sorting': 'bg-amber-100 text-amber-700',
        'ready_for_pickup': 'bg-emerald-100 text-emerald-700',
        'picked_up': 'bg-purple-100 text-purple-700',
        'delivered': 'bg-green-100 text-green-700',
        'in-use': 'bg-blue-100 text-blue-700',
        'maintenance': 'bg-orange-100 text-orange-700',
        'retired': 'bg-gray-100 text-gray-700',
    };
    return classes[status] || 'bg-gray-100 text-gray-700';
};

export const getStatusLabel = (status: string) => {
    switch (status) {
        case 'ready_for_pickup': return 'Ready';
        case 'picked_up': return 'Picked Up';
        default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
};

export const calculateItemStatus = (currentStock: number, minimumStock: number): 'available' | 'low-stock' | 'out-of-stock' => {
    if (currentStock <= 0) return 'out-of-stock';
    if (currentStock < minimumStock) return 'low-stock';
    return 'available';
};