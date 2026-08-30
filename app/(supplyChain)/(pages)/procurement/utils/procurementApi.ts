// app/(supplyChain)/utils/procurementApi.ts

interface FetchProcurementParams {
    page?: number;
    limit?: number;
    search?: string;
    tab?: string;
    includeOrders?: boolean;
    includeSuppliers?: boolean;
}

interface CreateRequestData {
    type?: string;
    description?: string;
    requested_by: string;
    department?: string;
    supplier_id: string;
    supplier_name: string;
    amount?: number;
    priority?: string;
    status?: string;
    date?: string;
    items: Array<{ name: string; quantity: number }>;
    reason: string;
}

interface UpdateRequestData {
    id: string;
    type?: string;
    description?: string;
    requested_by?: string;
    department?: string;
    supplier_id?: string;
    supplier_name?: string;
    amount?: number;
    priority?: string;
    status?: string;
    date?: string;
    items?: Array<{ name: string; quantity: number }>;
    reason?: string;
}

interface PatchRequestData {
    id: string;
    action: 'approve' | 'reject';
}

/**
 * Fetch procurement data with pagination and filters
 */
export async function fetchProcurementData(params: FetchProcurementParams = {}) {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.set('page', String(params.page));
    if (params.limit) queryParams.set('limit', String(params.limit));
    if (params.search) queryParams.set('search', params.search);
    if (params.tab) queryParams.set('tab', params.tab);
    if (params.includeOrders) queryParams.set('includeOrders', 'true');
    if (params.includeSuppliers) queryParams.set('includeSuppliers', 'true');

    const response = await fetch(`/procurement/api?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.error || 'Failed to fetch procurement data');
    }

    return result.data;
}

/**
 * Create a new purchase request
 */
export async function createPurchaseRequest(data: CreateRequestData) {
    const response = await fetch('/procurement/api', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.error || 'Failed to create purchase request');
    }

    return result.data;
}

/**
 * Update an existing purchase request
 */
export async function updatePurchaseRequest(data: UpdateRequestData) {
    const response = await fetch('/procurement/api', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.error || 'Failed to update purchase request');
    }

    return result.data;
}

/**
 * Delete a purchase request
 */
export async function deletePurchaseRequest(id: string) {
    const response = await fetch(`/procurement/api?id=${id}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.error || 'Failed to delete purchase request');
    }

    return result.data;
}

/**
 * Delete multiple purchase requests
 */
export async function deleteMultiplePurchaseRequests(ids: string[]) {
    const response = await fetch(`/procurement/api?ids=${JSON.stringify(ids)}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.error || 'Failed to delete purchase requests');
    }

    return result.data;
}

/**
 * Approve or reject a purchase request
 */
export async function patchPurchaseRequest(data: PatchRequestData) {
    const response = await fetch('/procurement/api', {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.error || `Failed to ${data.action} purchase request`);
    }

    return result.data;
}