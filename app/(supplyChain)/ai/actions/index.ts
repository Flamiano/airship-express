// app/(supplyChain)/ai/actions/index.ts

// Inventory & Low Stock
export {
    getLowStockItems,
    getOutOfStockItems,
    getInventorySummary
} from './get_low_stock';
export type { LowStockItem } from './get_low_stock';

export { getInventory, getInventoryItems } from './get_inventory';

// Stock Movements & Audits
export {
    getStockMovements,
    getStockMovementsSummary
} from './get_stock_movements';
export type { StockMovement, StockMovementsSummary } from './get_stock_movements';

// Suppliers
export { getSuppliers, getSuppliersSummary } from './get_suppliers';
export type { Supplier } from './get_suppliers';

// Purchase Orders & Requests
export { getPurchaseOrders, getPurchaseOrdersSummary } from './get_purchase_orders';
export type { PurchaseOrder } from './get_purchase_orders';
export { getPendingPurchaseRequests } from './get_pending_purchase_requests';
export type { PendingPurchaseRequest } from './get_pending_purchase_requests';

// Damage Incidents, Defects & Returns
export {
    getDamageIncidents,
    getSupplierReturns,
    getDamageAndReturnsSummary
} from './get_damage_and_returns';
export type { DamageIncident, SupplierReturnRequest, DamageAndReturnsSummary } from './get_damage_and_returns';

// User Activity, Sessions & Security
export {
    getUserActivityLogs,
    getUserActivitySummary
} from './get_user_activity';
export type { UserActivityLog, UserActivitySummary } from './get_user_activity';

// Supplier Quotations & Meetings
export {
    getSupplierQuotations,
    getSupplierMeetings,
    getQuotationsAndMeetingsSummary
} from './get_supplier_quotations';
export type { SupplierQuotation, SupplierMeeting, QuotationsAndMeetingsSummary } from './get_supplier_quotations';

// Document Verifications & Gemini OCR Receipts
export {
    getDocumentVerifications,
    getDocumentVerificationsSummary
} from './get_document_verifications';
export type { DocumentVerification, DocumentVerificationsSummary } from './get_document_verifications';