
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../../lib/services/client/supabase';
import { toast } from 'sonner';
import { InventoryItem, Supplier, AddItemFormData, EditItemFormData } from '../types';
import { logStockMovement } from '../server/stock-movements';

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

            // Retrieve current user info for audit trail
            let performedByName = 'Warehouse Staff';
            let performedById: string | null = null;
            try {
                if (typeof window !== 'undefined') {
                    const localName = localStorage.getItem('user_name');
                    const localId = localStorage.getItem('user_id');
                    if (localName) performedByName = localName;
                    if (localId) performedById = localId;
                }
                const { data: authData } = await supabase.auth.getUser();
                if (authData?.user) {
                    performedById = authData.user.id || performedById;
                    performedByName = authData.user.user_metadata?.full_name 
                        || authData.user.user_metadata?.name 
                        || authData.user.email 
                        || performedByName;
                }
            } catch (_) {}

            const createdItem = data && data[0] ? data[0] : null;
            const initialQty = Number(formData.current_stock || 0);

            // Log stock movement audit trail for newly added item
            try {
                await logStockMovement({
                    item_id: createdItem ? String(createdItem.id) : null,
                    item_code: formData.item_code,
                    item_name: formData.item_name,
                    movement_type: initialQty > 0 ? 'Stock In' : 'Adjustment',
                    quantity: initialQty,
                    previous_stock: 0,
                    new_stock: initialQty,
                    reference_number: `INIT-${Date.now().toString().slice(-6)}`,
                    reason: formData.description?.trim() 
                        ? formData.description.trim() 
                        : (initialQty > 0 
                            ? `Initial stock registration (${initialQty} ${formData.unit})` 
                            : 'New inventory item registered (0 initial stock)'),
                    department: 'Warehouse / Inventory',
                    performed_by: performedByName,
                    performed_by_id: performedById,
                    metadata: {
                        action: 'ITEM_CREATION_STOCK_MOVEMENT',
                        category: formData.category,
                        unit: formData.unit,
                        storage_location: formData.storage_location || undefined,
                        supplier: formData.supplier || undefined,
                        purchase_price: formData.purchase_price || 0,
                        initial_stock: initialQty,
                    }
                });
            } catch (movementErr) {
                console.warn('Failed to log stock movement for new item:', movementErr);
            }

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

            let oldItem = items.find(i => String(i.id) === String(formData.id));
            if (!oldItem && formData.id) {
                const { data: dbItem } = await supabase
                    .from('inventory_items')
                    .select('*')
                    .eq('id', formData.id)
                    .maybeSingle();
                if (dbItem) oldItem = dbItem as InventoryItem;
            }

            const oldStock = oldItem ? Number(oldItem.current_stock ?? 0) : 0;
            const newStock = Number(formData.current_stock ?? 0);
            const diff = newStock - oldStock;

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

            // Retrieve current user info for audit trail
            let performedByName = 'Warehouse Staff';
            let performedById: string | null = null;
            try {
                const { data: authData } = await supabase.auth.getUser();
                if (authData?.user) {
                    performedById = authData.user.id;
                    performedByName = authData.user.user_metadata?.full_name 
                        || authData.user.user_metadata?.name 
                        || authData.user.email 
                        || 'Warehouse Staff';
                }
            } catch (_) {}

            // Strictly log into public.stock_movements as Adjustment
            await logStockMovement({
                item_id: formData.id,
                item_code: formData.item_code,
                item_name: formData.item_name,
                movement_type: 'Adjustment',
                quantity: diff,
                previous_stock: oldStock,
                new_stock: newStock,
                reference_number: `ADJ-${Date.now().toString().slice(-6)}`,
                reason: diff !== 0
                    ? (formData.description?.trim() || (diff > 0 ? `Stock increased by ${diff} via manual edit` : `Stock decreased by ${Math.abs(diff)} via manual edit`))
                    : (formData.description?.trim() || 'Item specifications updated via manual edit'),
                department: 'Warehouse / Inventory',
                performed_by: performedByName,
                performed_by_id: performedById,
                metadata: {
                    action: 'ITEM_EDIT_ADJUSTMENT',
                    supplier: formData.supplier || undefined,
                    storage_location: formData.storage_location || undefined,
                    previous_stock: oldStock,
                    new_stock: newStock,
                    diff: diff,
                }
            });

            toast.success('Item updated successfully!', { id: toastId });
            useInventoryCache = null;
            await fetchInventory(true);
            return { success: true };
        } catch (error) {
            console.error('Error updating item:', error);
            toast.error('Failed to update item', { id: toastId });
            return { success: false, error };
        } finally {
            setSaving(false);
        }
    }, [items, fetchInventory]);

    // delete single
    const deleteItem = useCallback(async (id: string, itemName: string) => {
        setDeleting(true);
        const toastId = toast.loading(`Deleting ${itemName}...`);

        try {
            let targetItem = items.find(i => String(i.id) === String(id));
            if (!targetItem) {
                const { data: dbItem } = await supabase
                    .from('inventory_items')
                    .select('*')
                    .eq('id', id)
                    .maybeSingle();
                if (dbItem) targetItem = dbItem as InventoryItem;
            }

            const { error } = await supabase
                .from('inventory_items')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Retrieve current user info for audit trail
            let performedByName = 'Warehouse Staff';
            let performedById: string | null = null;
            try {
                const { data: authData } = await supabase.auth.getUser();
                if (authData?.user) {
                    performedById = authData.user.id;
                    performedByName = authData.user.user_metadata?.full_name 
                        || authData.user.user_metadata?.name 
                        || authData.user.email 
                        || 'Warehouse Staff';
                }
            } catch (_) {}

            const prevStock = Number(targetItem?.current_stock ?? 0);
            await logStockMovement({
                item_id: id,
                item_code: targetItem?.item_code || 'N/A',
                item_name: targetItem?.item_name || itemName,
                movement_type: 'Adjustment',
                quantity: -prevStock,
                previous_stock: prevStock,
                new_stock: 0,
                reference_number: `DEL-${Date.now().toString().slice(-6)}`,
                reason: `Item deleted from inventory catalog (Stock cleared from ${prevStock} to 0)`,
                department: 'Warehouse / Inventory',
                performed_by: performedByName,
                performed_by_id: performedById,
                metadata: {
                    action: 'ITEM_DELETED',
                    deleted_item_code: targetItem?.item_code,
                    deleted_item_name: targetItem?.item_name || itemName,
                    supplier: targetItem?.supplier || undefined,
                    previous_stock: prevStock,
                    cleared_stock: prevStock
                }
            });

            toast.success(`"${itemName}" deleted successfully!`, { id: toastId });
            useInventoryCache = null;
            await fetchInventory(true);
            return { success: true };
        } catch (error) {
            console.error('Error deleting item:', error);
            toast.error('Failed to delete item', { id: toastId });
            return { success: false, error };
        } finally {
            setDeleting(false);
        }
    }, [items, fetchInventory]);

    // delete bulk
    const deleteMultipleItems = useCallback(async (ids: string[]) => {
        setDeleting(true);
        const toastId = toast.loading(`Deleting ${ids.length} items...`);

        try {
            const itemsToDelete = items.filter(i => ids.map(String).includes(String(i.id)));
            const foundIds = new Set(itemsToDelete.map(i => String(i.id)));
            const missingIds = ids.filter(id => !foundIds.has(String(id)));
            if (missingIds.length > 0) {
                const { data: extraItems } = await supabase
                    .from('inventory_items')
                    .select('*')
                    .in('id', missingIds);
                if (extraItems) itemsToDelete.push(...(extraItems as InventoryItem[]));
            }

            const { error } = await supabase
                .from('inventory_items')
                .delete()
                .in('id', ids);

            if (error) throw error;

            let performedByName = 'Warehouse Staff';
            let performedById: string | null = null;
            try {
                const { data: authData } = await supabase.auth.getUser();
                if (authData?.user) {
                    performedById = authData.user.id;
                    performedByName = authData.user.user_metadata?.full_name 
                        || authData.user.user_metadata?.name 
                        || authData.user.email 
                        || 'Warehouse Staff';
                }
            } catch (_) {}

            await Promise.all(
                itemsToDelete.map(async (itm) => {
                    const prevStock = Number(itm.current_stock ?? 0);
                    return logStockMovement({
                        item_id: itm.id,
                        item_code: itm.item_code || 'N/A',
                        item_name: itm.item_name,
                        movement_type: 'Adjustment',
                        quantity: -prevStock,
                        previous_stock: prevStock,
                        new_stock: 0,
                        reference_number: `DEL-${Date.now().toString().slice(-6)}`,
                        reason: `Bulk item deletion from inventory catalog (Stock cleared from ${prevStock} to 0)`,
                        department: 'Warehouse / Inventory',
                        performed_by: performedByName,
                        performed_by_id: performedById,
                        metadata: {
                            action: 'ITEM_DELETED_BULK',
                            deleted_item_code: itm.item_code,
                            deleted_item_name: itm.item_name,
                            supplier: itm.supplier || undefined,
                            previous_stock: prevStock,
                            cleared_stock: prevStock
                        }
                    });
                })
            );

            toast.success(`Successfully deleted ${ids.length} items!`, { id: toastId });
            useInventoryCache = null;
            await fetchInventory(true);
            return { success: true };
        } catch (error) {
            console.error('Error deleting items:', error);
            toast.error('Failed to delete items', { id: toastId });
            return { success: false, error };
        } finally {
            setDeleting(false);
        }
    }, [items, fetchInventory]);

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

            // Audit record for direct stock out
            logStockMovement({
                item_id: item.id,
                item_code: item.item_code || 'N/A',
                item_name: item.item_name,
                movement_type: 'Stock Out',
                quantity: -quantity,
                previous_stock: item.current_stock,
                new_stock: newStock,
                reference_number: `SO-${Date.now().toString().slice(-6)}`,
                reason: purpose || remarks || 'Direct stock issuance',
                department: department || 'General Operations',
                performed_by: 'Warehouse Staff',
            }).catch(e => console.warn('Stock out movement log error:', e));

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