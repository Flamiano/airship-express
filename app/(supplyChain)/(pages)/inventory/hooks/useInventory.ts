
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { toast } from 'sonner';
import { InventoryItem, Supplier, AddItemFormData, EditItemFormData } from '../types';

let useInventoryCache: { items: InventoryItem[]; timestamp: number } | null = null;
const CACHE_TTL = 3 * 60 * 1000;

export function useInventory() {
    const [items, setItems] = useState<InventoryItem[]>(useInventoryCache?.items || []);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(!useInventoryCache?.items?.length);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // fetch data
    const fetchInventory = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh && useInventoryCache && (Date.now() - useInventoryCache.timestamp < CACHE_TTL)) {
            setItems(useInventoryCache.items);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const [{ data: inventoryData, error: inventoryError }] = await Promise.all([
                supabase.from('inventory_items').select('*').order('item_name'),
            ]);

            if (inventoryError) throw inventoryError;
            const fetched = inventoryData || [];
            useInventoryCache = { items: fetched, timestamp: Date.now() };
            setItems(fetched);
        } catch (error) {
            console.error('Error fetching inventory:', error);
            toast.error('Failed to load inventory');
        } finally {
            setLoading(false);
        }
    }, []);

    // create
    const addItem = useCallback(async (formData: AddItemFormData) => {
        setSaving(true);
        const toastId = toast.loading('Adding item...');

        try {
            // calculate status
            let status = 'available';
            if (formData.current_stock <= 0) status = 'out-of-stock';
            else if (formData.current_stock < formData.minimum_stock) status = 'low-stock';

            const { data, error } = await supabase
                .from('inventory_items')
                .insert([{
                    item_code: formData.item_code,
                    item_name: formData.item_name,
                    category: formData.category,
                    unit: formData.unit,
                    current_stock: formData.current_stock,
                    minimum_stock: formData.minimum_stock,
                    storage_location: formData.storage_location || null,
                    supplier: formData.supplier || null,
                    purchase_price: formData.purchase_price || 0,
                    description: formData.description || null,
                    status: status
                }])
                .select();

            if (error) throw error;
            toast.success('Item added successfully!', { id: toastId });
            useInventoryCache = null;
            await fetchInventory(true);
            return { success: true, data };
        } catch (error) {
            toast.error('Failed to add item', { id: toastId });
            return { success: false, error };
        } finally {
            setSaving(false);
        }
    }, [fetchInventory]);

    // update
    const updateItem = useCallback(async (formData: EditItemFormData) => {
        setSaving(true);
        const toastId = toast.loading('Updating item...');

        try {
            let status = 'available';
            if (formData.current_stock <= 0) status = 'out-of-stock';
            else if (formData.current_stock < formData.minimum_stock) status = 'low-stock';

            const { error } = await supabase
                .from('inventory_items')
                .update({
                    item_code: formData.item_code,
                    item_name: formData.item_name,
                    category: formData.category,
                    unit: formData.unit,
                    current_stock: formData.current_stock,
                    minimum_stock: formData.minimum_stock,
                    storage_location: formData.storage_location || null,
                    supplier: formData.supplier || null,
                    purchase_price: formData.purchase_price || 0,
                    description: formData.description || null,
                    status: status,
                    updated_at: new Date().toISOString()
                })
                .eq('id', formData.id);

            if (error) throw error;
            toast.success('Item updated successfully!', { id: toastId });
            useInventoryCache = null;
            await fetchInventory(true);
            return { success: true };
        } catch (error) {
            toast.error('Failed to update item', { id: toastId });
            return { success: false, error };
        } finally {
            setSaving(false);
        }
    }, [fetchInventory]);

    // delete single
    const deleteItem = useCallback(async (id: string, itemName: string) => {
        setDeleting(true);
        const toastId = toast.loading(`Deleting ${itemName}...`);

        try {
            const { error } = await supabase
                .from('inventory_items')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success(`"${itemName}" deleted successfully!`, { id: toastId });
            useInventoryCache = null;
            await fetchInventory(true);
            return { success: true };
        } catch (error) {
            toast.error('Failed to delete item', { id: toastId });
            return { success: false, error };
        } finally {
            setDeleting(false);
        }
    }, [fetchInventory]);

    // delete bulk
    const deleteMultipleItems = useCallback(async (ids: string[]) => {
        setDeleting(true);
        const toastId = toast.loading(`Deleting ${ids.length} items...`);

        try {
            const { error } = await supabase
                .from('inventory_items')
                .delete()
                .in('id', ids);

            if (error) throw error;
            toast.success(`Successfully deleted ${ids.length} items!`, { id: toastId });
            useInventoryCache = null;
            await fetchInventory(true);
            return { success: true };
        } catch (error) {
            toast.error('Failed to delete items', { id: toastId });
            return { success: false, error };
        } finally {
            setDeleting(false);
        }
    }, [fetchInventory]);

    // stock in
    const stockIn = useCallback(async (itemName: string, quantity: number, supplier?: string, reference?: string, remarks?: string) => {
        const item = items.find(i => i.item_name === itemName);
        if (!item) {
            toast.error('Item not found');
            return { success: false, error: 'Item not found' };
        }

        const toastId = toast.loading(`Adding stock to ${item.item_name}...`);
        try {
            const newStock = item.current_stock + quantity;
            const { error } = await supabase
                .from('inventory_items')
                .update({
                    current_stock: newStock,
                    updated_at: new Date().toISOString()
                })
                .eq('id', item.id);

            if (error) throw error;
            toast.success(`Added ${quantity} ${item.unit} to ${item.item_name}`, { id: toastId });
            useInventoryCache = null;
            await fetchInventory(true);
            return { success: true };
        } catch (error) {
            toast.error('Failed to add stock', { id: toastId });
            return { success: false, error };
        }
    }, [items, fetchInventory]);

    // stock out
    const stockOut = useCallback(async (itemName: string, quantity: number, department?: string, purpose?: string, remarks?: string) => {
        const item = items.find(i => i.item_name === itemName);
        if (!item) {
            toast.error('Item not found');
            return { success: false, error: 'Item not found' };
        }

        if (quantity > item.current_stock) {
            toast.error(`Insufficient stock! Available: ${item.current_stock} ${item.unit}`);
            return { success: false, error: 'Insufficient stock' };
        }

        const toastId = toast.loading(`Removing stock from ${item.item_name}...`);
        try {
            const newStock = item.current_stock - quantity;
            const { error } = await supabase
                .from('inventory_items')
                .update({
                    current_stock: newStock,
                    updated_at: new Date().toISOString()
                })
                .eq('id', item.id);

            if (error) throw error;
            toast.success(`Removed ${quantity} ${item.unit} from ${item.item_name}`, { id: toastId });
            useInventoryCache = null;
            await fetchInventory(true);
            return { success: true };
        } catch (error) {
            toast.error('Failed to remove stock', { id: toastId });
            return { success: false, error };
        }
    }, [items, fetchInventory]);

    useEffect(() => {
        fetchInventory();
    }, [fetchInventory]);

    return {
        items,
        suppliers,
        loading,
        saving,
        deleting,
        fetchInventory,
        addItem,
        updateItem,
        deleteItem,
        deleteMultipleItems,
        stockIn,
        stockOut,
    };
}