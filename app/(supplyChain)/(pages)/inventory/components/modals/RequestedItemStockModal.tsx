'use client';

import React from 'react';
import { InventoryRequest, InventoryItem, Supplier } from '../../types';
import { PurchaseRequestFormModal } from './PurchaseRequestFormModal';

export interface RequestedItemStockModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: InventoryRequest | null;
    inventoryItems: InventoryItem[];
    suppliers?: Supplier[] | any[];
    onOpenRequestFormModal?: (request: InventoryRequest) => void;
    onOpenSupplierModal?: (request: InventoryRequest) => void;
    onOpenMessageSupplier?: (supplier: any) => void;
}

/**
 * Unified side-by-side Requisition & Live Inventory Stock Modal.
 * Replaced separate modal with the integrated command center modal.
 */
export function RequestedItemStockModal({
    isOpen,
    onClose,
    request,
    inventoryItems,
    suppliers = [],
    onOpenSupplierModal,
    onOpenMessageSupplier,
}: RequestedItemStockModalProps) {
    return (
        <PurchaseRequestFormModal
            isOpen={isOpen}
            onClose={onClose}
            request={request}
            inventoryItems={inventoryItems}
            suppliers={suppliers}
            onOpenSupplierModal={onOpenSupplierModal}
            onOpenMessageSupplier={onOpenMessageSupplier}
        />
    );
}
