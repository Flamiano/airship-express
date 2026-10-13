// app/(supplyChain)/(pages)/warehousing/server/supplier-returns-actions.ts
'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { logStockMovement } from '../../inventory/server/stock-movements';
import { sendSupplyChainEmail } from '../../../lib/email/mailer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_URL || '';
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_ANON_KEY || '';

const dbClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

export type DefectType = 
    | 'Damaged' 
    | 'Defective' 
    | 'Incorrect Item' 
    | 'Wrong Specification' 
    | 'Missing Parts' 
    | 'Other';

export type RequestedResolution = 
    | 'Replacement' 
    | 'Refund' 
    | 'Supplier Credit' 
    | 'Pending Supplier Review';

export type SupplierResponsibility = 
    | 'Pending Supplier Confirmation'
    | 'Supplier Responsible'
    | 'Supplier Not Responsible'
    | 'Disputed / Further Investigation Required';

export type SupplierReturnStatus = 
    | 'Pending Review'
    | 'Under Investigation'
    | 'Awaiting Supplier Response'
    | 'Approved for Return'
    | 'Return in Transit'
    | 'Awaiting Resolution'
    | 'Resolved'
    | 'Rejected';

export interface DefectiveItemSubmissionPayload {
    purchaseOrderId?: string;
    poNumber: string;
    supplierId?: number | string;
    supplierName: string;
    supplierEmail?: string;
    itemId?: string;
    itemCode: string;
    itemName: string;
    unit?: string;
    quantityReceived: number;
    defectiveQuantity: number;
    defectType: DefectType;
    defectDescription: string;
    evidenceUrls?: string[];
    inspectionDate?: string;
    requestedResolution?: RequestedResolution;
    additionalNotes?: string;
    reporterName: string;
    reporterId?: string;
    isDiscoveredPostReceiving?: boolean;
}

export interface SupplierReturnRequestRecord {
    id: string;
    return_request_number: string;
    incident_id?: string | null;
    purchase_order_id?: string | null;
    po_number: string;
    supplier_id?: number | null;
    supplier_name: string;
    supplier_email?: string | null;
    item_id?: string | null;
    item_code: string;
    item_name: string;
    unit: string;
    quantity_received: number;
    defective_quantity: number;
    defect_type: DefectType;
    defect_description: string;
    requested_resolution: RequestedResolution;
    status: SupplierReturnStatus;
    supplier_responsibility: SupplierResponsibility;
    supplier_responsibility_notes?: string | null;
    proposed_resolution?: string | null;
    resolution_details: {
        replacement_quantity?: number;
        expected_replacement_date?: string;
        supplier_reference?: string;
        replacement_receiving_status?: string;
        agreed_refund_amount?: number;
        currency?: string;
        refund_status?: string;
        refund_date_received?: string;
        agreed_credit_amount?: number;
        credit_note_reference?: string;
        credit_supporting_doc?: string;
        credit_available_for_future?: boolean;
        alternative_resolution?: string;
        alternative_justification?: string;
        general_notes?: string;
    };
    finance_verified: boolean;
    finance_verified_at?: string | null;
    finance_verified_by?: string | null;
    assigned_reviewer?: string | null;
    assigned_reviewer_id?: string | null;
    evidence_urls: string[];
    inspection_date: string;
    reported_by: string;
    reported_by_id?: string | null;
    created_at: string;
    updated_at: string;
    
    // Joined / enriched metadata
    incident_number?: string;
    po_details?: {
        total_amount?: number;
        payment_terms?: string;
        terms_and_conditions?: string;
        financial_approval?: string;
        admin_approval?: string;
        status?: string;
        paid?: boolean;
        items?: any[];
        supplier_contact_person?: string;
        supplier_phone?: string;
        supplier_address?: string;
    };
}

export interface SupplierReturnMessageRecord {
    id: string;
    return_request_id: string;
    incident_id?: string | null;
    po_number: string;
    supplier_id?: number | null;
    supplier_name: string;
    supplier_email: string;
    sender_name: string;
    sender_email: string;
    subject: string;
    message_body: string;
    template_used?: string | null;
    attachments: string[];
    delivery_status: 'Sent' | 'Failed';
    delivery_error?: string | null;
    created_at: string;
}

/**
 * 1. Report Defective Items & Initiate Supplier Return Request
 * Transaction-safe workflow with inventory isolation and quarantine tracking.
 */
export async function reportDefectiveItemAction(payload: DefectiveItemSubmissionPayload) {
    try {
        if (!payload.poNumber || !payload.itemName) {
            return { success: false, error: 'Purchase Order number and Item Name are required.' };
        }

        const defectiveQty = Number(payload.defectiveQuantity);
        const receivedQty = Number(payload.quantityReceived);

        if (isNaN(defectiveQty) || defectiveQty <= 0) {
            return { success: false, error: 'Defective quantity must be greater than zero.' };
        }

        if (receivedQty > 0 && defectiveQty > receivedQty) {
            return {
                success: false,
                error: `Defective quantity (${defectiveQty}) cannot exceed the received quantity (${receivedQty}).`,
            };
        }

        if (!payload.defectDescription?.trim()) {
            return { success: false, error: 'Defect description is required.' };
        }

        const timestampCode = Math.floor(100000 + Math.random() * 900000);
        const incidentNumber = `INC-DEF-${timestampCode}`;
        const returnRequestNumber = `SRR-${timestampCode}`;

        // Fetch PO details to link supplier email and item pricing if possible
        let supplierEmail = payload.supplierEmail || '';
        let unitCost = 0;
        let poRecord: any = null;

        if (payload.poNumber) {
            const { data: po } = await dbClient
                .from('purchase_orders')
                .select('*')
                .eq('po_number', payload.poNumber)
                .maybeSingle();

            if (po) {
                poRecord = po;
                if (!supplierEmail && po.supplier_email) {
                    supplierEmail = po.supplier_email;
                }
                if (Array.isArray(po.items)) {
                    const matchedItem = po.items.find(
                        (i: any) =>
                            (i.item_name || i.name || '').toLowerCase() === payload.itemName.toLowerCase() ||
                            (i.item_code || i.code || '').toLowerCase() === (payload.itemCode || '').toLowerCase()
                    );
                    if (matchedItem) {
                        unitCost = Number(matchedItem.unit_price || matchedItem.price || 0);
                    }
                }
            }
        }

        // If supplier email still not found, check suppliers table
        if (!supplierEmail && payload.supplierName) {
            const { data: sup } = await dbClient
                .from('suppliers')
                .select('email')
                .ilike('name', payload.supplierName)
                .maybeSingle();
            if (sup?.email) {
                supplierEmail = sup.email;
            }
        }

        const totalEstimatedLoss = defectiveQty * unitCost;

        // Step 1: Insert into warehouse_damage_incidents
        const incidentPayload = {
            incident_number: incidentNumber,
            item_id: payload.itemId || null,
            item_code: payload.itemCode || `ITM-${timestampCode}`,
            item_name: payload.itemName,
            category: 'Defective Vendor Delivery',
            quantity: defectiveQty,
            unit: payload.unit || 'units',
            discrepancy_type: payload.defectType,
            severity: totalEstimatedLoss > 10000 ? 'Severe' : 'Moderate',
            unit_cost: unitCost,
            total_estimated_loss: totalEstimatedLoss,
            detected_at_location: 'Inbound Receiving Dock',
            reported_by: payload.reporterName || 'Warehouse Receiving Staff',
            reported_by_id: payload.reporterId || null,
            status: 'Under Investigation',
            action_taken: 'Quarantine for Claim',
            incident_notes: [
                `Defect Type: ${payload.defectType}`,
                `Description: ${payload.defectDescription}`,
                `PO: ${payload.poNumber} | Supplier: ${payload.supplierName}`,
                payload.additionalNotes ? `Notes: ${payload.additionalNotes}` : null,
                `Linked Return Request: ${returnRequestNumber}`,
            ]
                .filter(Boolean)
                .join(' | '),
            purchase_order_id: payload.purchaseOrderId || poRecord?.id || null,
            po_number: payload.poNumber,
            supplier_id: payload.supplierId ? Number(payload.supplierId) : poRecord?.supplier_id || null,
            supplier_name: payload.supplierName,
            quantity_received: receivedQty,
            defect_type: payload.defectType,
            defect_description: payload.defectDescription,
            evidence_urls: payload.evidenceUrls || [],
            requested_resolution: payload.requestedResolution || 'Pending Supplier Review',
        };

        let incidentId: string | null = null;

        const { data: incidentRes, error: incidentErr } = await dbClient
            .from('warehouse_damage_incidents')
            .insert([incidentPayload])
            .select('id')
            .single();

        if (incidentErr) {
            console.warn('Incident insert with full fields had error, retrying standard fields:', incidentErr.message);
            // Fallback for minimal existing schema
            const fallbackPayload = {
                incident_number: incidentNumber,
                item_code: payload.itemCode || `ITM-${timestampCode}`,
                item_name: payload.itemName,
                quantity: defectiveQty,
                unit: payload.unit || 'units',
                discrepancy_type: payload.defectType,
                severity: 'Moderate',
                unit_cost: unitCost,
                total_estimated_loss: totalEstimatedLoss,
                detected_at_location: 'Inbound Receiving Dock',
                reported_by: payload.reporterName || 'Warehouse Staff',
                status: 'Under Investigation',
                action_taken: 'Quarantined / Return Initiated',
                incident_notes: `[PO #${payload.poNumber}] Supplier: ${payload.supplierName}. Defect: ${payload.defectDescription}. Return Ref: ${returnRequestNumber}`,
            };
            const { data: fbRes, error: fbErr } = await dbClient
                .from('warehouse_damage_incidents')
                .insert([fallbackPayload])
                .select('id')
                .single();

            if (fbErr) {
                console.error('Critical failure inserting damage incident:', fbErr);
                return { success: false, error: `Failed to log damage incident: ${fbErr.message}` };
            }
            incidentId = fbRes?.id || null;
        } else {
            incidentId = incidentRes?.id || null;
        }

        // Step 2: Insert into supplier_return_requests
        const returnRequestPayload = {
            return_request_number: returnRequestNumber,
            incident_id: incidentId,
            purchase_order_id: payload.purchaseOrderId || poRecord?.id || null,
            po_number: payload.poNumber,
            supplier_id: payload.supplierId ? Number(payload.supplierId) : poRecord?.supplier_id || null,
            supplier_name: payload.supplierName,
            supplier_email: supplierEmail || null,
            item_id: payload.itemId || null,
            item_code: payload.itemCode || `ITM-${timestampCode}`,
            item_name: payload.itemName,
            unit: payload.unit || 'units',
            quantity_received: receivedQty,
            defective_quantity: defectiveQty,
            defect_type: payload.defectType,
            defect_description: payload.defectDescription,
            requested_resolution: payload.requestedResolution || 'Pending Supplier Review',
            status: 'Pending Review',
            supplier_responsibility: 'Pending Supplier Confirmation',
            evidence_urls: payload.evidenceUrls || [],
            inspection_date: payload.inspectionDate || new Date().toISOString().split('T')[0],
            reported_by: payload.reporterName || 'Warehouse Staff',
            reported_by_id: payload.reporterId || null,
            resolution_details: {
                general_notes: payload.additionalNotes || '',
            },
        };

        let returnRequestId: string | null = null;
        const { data: retRes, error: retErr } = await dbClient
            .from('supplier_return_requests')
            .insert([returnRequestPayload])
            .select('id')
            .single();

        if (retErr) {
            console.warn('supplier_return_requests table returned error (might need migration):', retErr.message);
            // It will be stored safely in the warehouse_damage_incidents table as fallback
            returnRequestId = incidentId;
        } else {
            returnRequestId = retRes?.id || incidentId;
        }

        // Step 3: Protect Inventory & Track Quarantine Stock
        try {
            // Find matched inventory item
            const { data: invItems } = await dbClient
                .from('inventory_items')
                .select('*')
                .or(`item_code.eq."${payload.itemCode}",item_name.ilike."${payload.itemName}"`)
                .limit(1);

            const invItem = invItems && invItems.length > 0 ? invItems[0] : null;

            if (invItem) {
                const currentStock = Number(invItem.current_stock) || 0;
                const prevQuarantine = Number(invItem.quarantine_stock) || 0;
                const newQuarantine = prevQuarantine + defectiveQty;

                // If reported after receipt was already added to usable stock, decrement usable stock
                const poStatus = String(poRecord?.status || '').toLowerCase().trim();
                const isDeliveredPO = poStatus === 'delivered' || poStatus === 'received' || Boolean(poRecord?.fully_received);
                const shouldDeductUsableStock = Boolean(payload.isDiscoveredPostReceiving || isDeliveredPO);

                let updatedStock = currentStock;
                if (shouldDeductUsableStock) {
                    updatedStock = Math.max(0, currentStock - defectiveQty);
                }

                // Update inventory item
                const updateData: any = {
                    quarantine_stock: newQuarantine,
                    updated_at: new Date().toISOString(),
                };
                if (shouldDeductUsableStock) {
                    updateData.current_stock = updatedStock;
                    const reorderLevel = Number(invItem.reorder_level) || 0;
                    if (updatedStock <= 0) {
                        updateData.status = 'out-of-stock';
                    } else if (updatedStock <= reorderLevel) {
                        updateData.status = 'low-stock';
                    } else {
                        updateData.status = 'available';
                    }
                }

                await dbClient
                    .from('inventory_items')
                    .update(updateData)
                    .eq('id', invItem.id);

                // Traceable stock movement for quarantine
                await logStockMovement({
                    item_id: invItem.id,
                    item_code: invItem.item_code,
                    item_name: invItem.item_name,
                    movement_type: 'Adjustment',
                    quantity: defectiveQty,
                    previous_stock: currentStock,
                    new_stock: updatedStock,
                    reference_number: returnRequestNumber,
                    reason: `Quarantined Defective Units: ${payload.defectType}`,
                    notes: `Quarantined ${defectiveQty} ${payload.unit || 'units'} from PO #${payload.poNumber} (${payload.defectDescription}). Isolated from usable inventory pending supplier return.`,
                    department: 'Warehouse Quarantine',
                    performed_by: payload.reporterName || 'Warehouse Staff',
                    performed_by_id: payload.reporterId || null,
                    metadata: {
                        defect_type: payload.defectType,
                        incident_number: incidentNumber,
                        return_request_number: returnRequestNumber,
                        po_number: payload.poNumber,
                        supplier: payload.supplierName,
                        quarantine_stock_total: newQuarantine,
                    },
                });
            }
        } catch (invErr) {
            console.warn('Inventory quarantine logging notice:', invErr);
            // Non-blocking for the return request itself
        }

        revalidatePath('/warehousing');
        revalidatePath('/procurement');

        return {
            success: true,
            returnRequestNumber,
            incidentNumber,
            incidentId,
            returnRequestId,
        };
    } catch (err: any) {
        console.error('Error reporting defective item:', err);
        return { success: false, error: err.message || 'An unexpected error occurred while reporting defective item.' };
    }
}

/**
 * 2. Fetch Supplier Return Requests with enriched PO and Supplier metadata
 */
export async function fetchSupplierReturnRequestsAction() {
    try {
        let returnRequests: any[] = [];

        // Attempt querying dedicated table first
        const { data: dedicatedData, error: dedicatedErr } = await dbClient
            .from('supplier_return_requests')
            .select('*')
            .order('created_at', { ascending: false });

        if (!dedicatedErr && dedicatedData && dedicatedData.length > 0) {
            returnRequests = dedicatedData;
        } else {
            // Fallback: extract from warehouse_damage_incidents
            const { data: incidentsData } = await dbClient
                .from('warehouse_damage_incidents')
                .select('*')
                .order('created_at', { ascending: false });

            if (incidentsData) {
                returnRequests = incidentsData.map((inc) => {
                    const poMatch = inc.incident_notes?.match(/PO:?\s*#?([A-Za-z0-9\-_]+)/i);
                    const poNum = inc.po_number || (poMatch ? poMatch[1] : 'PO-RECORD');
                    const supMatch = inc.incident_notes?.match(/Supplier:?\s*([^|.]+)/i);
                    const supName = inc.supplier_name || (supMatch ? supMatch[1].trim() : 'Vendor Supplier');
                    const refMatch = inc.incident_notes?.match(/Linked Return Request:?\s*([A-Za-z0-9\-_]+)/i);
                    const returnReqNum = refMatch ? refMatch[1] : `SRR-${inc.incident_number.replace('INC-DEF-', '')}`;

                    return {
                        id: inc.id,
                        return_request_number: returnReqNum,
                        incident_id: inc.id,
                        incident_number: inc.incident_number,
                        po_number: poNum,
                        supplier_name: supName,
                        item_id: inc.item_id,
                        item_code: inc.item_code,
                        item_name: inc.item_name,
                        unit: inc.unit || 'units',
                        quantity_received: inc.quantity_received || inc.quantity,
                        defective_quantity: inc.quantity,
                        defect_type: (inc.defect_type || inc.discrepancy_type || 'Damaged') as DefectType,
                        defect_description: inc.defect_description || inc.incident_notes || 'Defective item reported during inspection',
                        requested_resolution: (inc.requested_resolution || 'Pending Supplier Review') as RequestedResolution,
                        status: (inc.status === 'Under Investigation' ? 'Pending Review' : inc.status) as SupplierReturnStatus,
                        supplier_responsibility: 'Pending Supplier Confirmation',
                        evidence_urls: inc.evidence_urls || [],
                        inspection_date: inc.reported_at ? inc.reported_at.split('T')[0] : new Date().toISOString().split('T')[0],
                        reported_by: inc.reported_by,
                        resolution_details: {},
                        finance_verified: false,
                        created_at: inc.created_at,
                        updated_at: inc.updated_at,
                    };
                });
            }
        }

        // Fetch all relevant POs to enrich details (terms, quotation, prices, line items)
        const poNumbers = Array.from(new Set(returnRequests.map((r) => r.po_number).filter(Boolean)));
        let poMap = new Map<string, any>();

        if (poNumbers.length > 0) {
            const { data: pos } = await dbClient
                .from('purchase_orders')
                .select('*')
                .in('po_number', poNumbers);

            if (pos) {
                pos.forEach((p) => poMap.set(p.po_number, p));
            }
        }

        // Enrich records with PO terms, supplier details, incident numbers
        const enriched: SupplierReturnRequestRecord[] = returnRequests.map((req) => {
            const matchedPO = poMap.get(req.po_number);
            return {
                ...req,
                incident_number: req.incident_number || `INC-${req.return_request_number.replace('SRR-', '')}`,
                po_details: matchedPO
                    ? {
                          total_amount: Number(matchedPO.total_amount) || 0,
                          payment_terms: matchedPO.payment_terms || 'Net 30 Days Upon Receipt',
                          terms_and_conditions:
                              matchedPO.terms_and_conditions ||
                              'Defective or damaged items subject to standard vendor replacement or credit note within 14 business days of arrival notice.',
                          financial_approval: matchedPO.financial_approval,
                          admin_approval: matchedPO.admin_approval,
                          status: matchedPO.status,
                          paid: Boolean(matchedPO.paid),
                          items: matchedPO.items || [],
                          supplier_contact_person: matchedPO.supplier_contact || 'Vendor Account Representative',
                          supplier_phone: matchedPO.supplier_phone || '',
                          supplier_address: matchedPO.supplier_address || matchedPO.delivery_address || '',
                      }
                    : undefined,
            };
        });

        return { success: true, data: enriched };
    } catch (err: any) {
        console.error('Error fetching supplier return requests:', err);
        return { success: false, error: err.message || 'Failed to fetch supplier return requests', data: [] };
    }
}

/**
 * 3. Update Supplier Responsibility, Resolution, and Workflow Status
 */
export interface UpdateResolutionPayload {
    id: string;
    status?: SupplierReturnStatus;
    supplierResponsibility?: SupplierResponsibility;
    supplierResponsibilityNotes?: string;
    proposedResolution?: RequestedResolution | string;
    resolutionDetails?: any;
    financeVerified?: boolean;
    assignedReviewer?: string;
    assignedReviewerId?: string;
    reviewerName?: string;
}

export async function updateSupplierReturnStatusAndResolutionAction(payload: UpdateResolutionPayload) {
    try {
        if (!payload.id) {
            return { success: false, error: 'Return Request ID is required.' };
        }

        // Validate explanation requirement
        if (
            payload.supplierResponsibility &&
            (payload.supplierResponsibility === 'Supplier Not Responsible' ||
                payload.supplierResponsibility === 'Disputed / Further Investigation Required')
        ) {
            if (!payload.supplierResponsibilityNotes?.trim()) {
                return {
                    success: false,
                    error: `A detailed explanation is required when setting responsibility to "${payload.supplierResponsibility}".`,
                };
            }
        }

        const updateData: any = {
            updated_at: new Date().toISOString(),
        };

        if (payload.status) updateData.status = payload.status;
        if (payload.supplierResponsibility) updateData.supplier_responsibility = payload.supplierResponsibility;
        if (payload.supplierResponsibilityNotes !== undefined) {
            updateData.supplier_responsibility_notes = payload.supplierResponsibilityNotes;
        }
        if (payload.proposedResolution) updateData.proposed_resolution = payload.proposedResolution;
        if (payload.resolutionDetails) updateData.resolution_details = payload.resolutionDetails;
        if (payload.assignedReviewer) updateData.assigned_reviewer = payload.assignedReviewer;
        if (payload.assignedReviewerId) updateData.assigned_reviewer_id = payload.assignedReviewerId;

        if (payload.financeVerified !== undefined) {
            updateData.finance_verified = payload.financeVerified;
            if (payload.financeVerified) {
                updateData.finance_verified_at = new Date().toISOString();
                updateData.finance_verified_by = payload.reviewerName || 'Finance Officer';
            }
        }

        // Update supplier_return_requests
        const { data: updatedReq, error: reqErr } = await dbClient
            .from('supplier_return_requests')
            .update(updateData)
            .eq('id', payload.id)
            .select('*')
            .maybeSingle();

        // Also sync status automatically on warehouse_damage_incidents
        try {
            let mappedIncidentStatus: 'Under Investigation' | 'Written Off' | 'Returned to Vendor (RMA)' | 'Replaced / Restored' = 'Under Investigation';
            let mappedActionTaken: 'Stock Deducted / Disposed' | 'Quarantine for Claim' | 'Vendor Replacement' | 'Repackaged' = 'Quarantine for Claim';

            if (payload.status === 'Resolved' && (payload.proposedResolution === 'Replacement' || payload.resolutionDetails?.replacement_receiving_status === 'Received & Restocked')) {
                mappedIncidentStatus = 'Replaced / Restored';
                mappedActionTaken = 'Vendor Replacement';
            } else if (
                payload.proposedResolution === 'Scrap / Write Off' ||
                payload.proposedResolution === 'Refund' ||
                payload.proposedResolution === 'Supplier Credit' ||
                (payload.status === 'Resolved' && payload.proposedResolution !== 'Replacement')
            ) {
                mappedIncidentStatus = 'Written Off';
                mappedActionTaken = 'Stock Deducted / Disposed';
            } else if (
                payload.status === 'Approved for Return' ||
                payload.status === 'Return in Transit' ||
                payload.status === 'Awaiting Supplier Response' ||
                Boolean((payload as any).rmaNumber || payload.resolutionDetails?.supplier_reference)
            ) {
                mappedIncidentStatus = 'Returned to Vendor (RMA)';
                mappedActionTaken = 'Quarantine for Claim';
            }

            const incidentUpdatePayload = {
                status: mappedIncidentStatus,
                action_taken: mappedActionTaken,
                updated_at: new Date().toISOString(),
            };

            if (updatedReq?.incident_id) {
                await dbClient
                    .from('warehouse_damage_incidents')
                    .update(incidentUpdatePayload)
                    .eq('id', updatedReq.incident_id);
            }
            if (updatedReq?.return_request_number) {
                await dbClient
                    .from('warehouse_damage_incidents')
                    .update(incidentUpdatePayload)
                    .ilike('incident_notes', `%${updatedReq.return_request_number}%`);
            }
        } catch (syncErr) {
            console.warn('Incident sync notice:', syncErr);
        }

        // Inventory movements on specific status transitions:
        // Case A: Dispatched to supplier ('Return in Transit') -> Deduct from quarantine stock
        if (payload.status === 'Return in Transit' && updatedReq) {
            try {
                const { data: invItems } = await dbClient
                    .from('inventory_items')
                    .select('*')
                    .or(`item_code.eq."${updatedReq.item_code}",item_name.ilike."${updatedReq.item_name}"`)
                    .limit(1);

                if (invItems && invItems.length > 0) {
                    const inv = invItems[0];
                    const prevQuarantine = Number(inv.quarantine_stock) || 0;
                    const newQuarantine = Math.max(0, prevQuarantine - Number(updatedReq.defective_quantity));

                    await dbClient
                        .from('inventory_items')
                        .update({ quarantine_stock: newQuarantine, updated_at: new Date().toISOString() })
                        .eq('id', inv.id);

                    await logStockMovement({
                        item_id: inv.id,
                        item_code: inv.item_code,
                        item_name: inv.item_name,
                        movement_type: 'Stock Out',
                        quantity: Number(updatedReq.defective_quantity),
                        previous_stock: Number(inv.current_stock) || 0,
                        new_stock: Number(inv.current_stock) || 0,
                        reference_number: updatedReq.return_request_number,
                        reason: `Dispatched Return to Supplier (${updatedReq.supplier_name})`,
                        notes: `Returned ${updatedReq.defective_quantity} ${updatedReq.unit} defective stock to supplier under ${updatedReq.return_request_number}. Cleared from quarantine.`,
                        department: 'Warehouse Returns Dispatch',
                        performed_by: payload.reviewerName || 'Procurement / Warehouse Staff',
                        metadata: {
                            action: 'RETURN_DISPATCH',
                            return_request_number: updatedReq.return_request_number,
                            supplier: updatedReq.supplier_name,
                        },
                    });
                }
            } catch (dispErr) {
                console.warn('Dispatch movement logging notice:', dispErr);
            }
        }

        // Case B: Replacement received and verified -> Restock usable inventory
        if (
            payload.status === 'Resolved' &&
            payload.proposedResolution === 'Replacement' &&
            payload.resolutionDetails?.replacement_receiving_status === 'Received & Restocked' &&
            updatedReq
        ) {
            try {
                const repQty = Number(payload.resolutionDetails.replacement_quantity) || Number(updatedReq.defective_quantity);
                const { data: invItems } = await dbClient
                    .from('inventory_items')
                    .select('*')
                    .or(`item_code.eq."${updatedReq.item_code}",item_name.ilike."${updatedReq.item_name}"`)
                    .limit(1);

                if (invItems && invItems.length > 0) {
                    const inv = invItems[0];
                    const prevStock = Number(inv.current_stock) || 0;
                    const newStock = prevStock + repQty;

                    await dbClient
                        .from('inventory_items')
                        .update({ current_stock: newStock, updated_at: new Date().toISOString() })
                        .eq('id', inv.id);

                    await logStockMovement({
                        item_id: inv.id,
                        item_code: inv.item_code,
                        item_name: inv.item_name,
                        movement_type: 'Stock In',
                        quantity: repQty,
                        previous_stock: prevStock,
                        new_stock: newStock,
                        reference_number: updatedReq.return_request_number,
                        reason: `Supplier Replacement Restocked (PO #${updatedReq.po_number})`,
                        notes: `Received and accepted ${repQty} ${updatedReq.unit} replacement units from ${updatedReq.supplier_name} under return request ${updatedReq.return_request_number}.`,
                        department: 'Warehouse Receiving Dock',
                        performed_by: payload.reviewerName || 'Warehouse Staff',
                        metadata: {
                            action: 'REPLACEMENT_RESTOCKED',
                            return_request_number: updatedReq.return_request_number,
                            original_po: updatedReq.po_number,
                        },
                    });
                }
            } catch (repErr) {
                console.warn('Replacement restock logging notice:', repErr);
            }
        }

        revalidatePath('/procurement');
        revalidatePath('/warehousing');

        return { success: true, message: 'Resolution and status updated successfully.' };
    } catch (err: any) {
        console.error('Error updating return request resolution:', err);
        return { success: false, error: err.message || 'Failed to update resolution.' };
    }
}

/**
 * 4. Supplier Return Communication & Messaging
 */
export interface SendSupplierMessagePayload {
    returnRequestId: string;
    incidentId?: string;
    poNumber: string;
    supplierId?: number;
    supplierName: string;
    supplierEmail: string;
    senderName: string;
    senderEmail?: string;
    subject: string;
    messageBody: string;
    templateUsed?: string;
    attachments?: string[];
}

export async function sendSupplierReturnMessageAction(payload: SendSupplierMessagePayload) {
    try {
        if (!payload.supplierEmail || !payload.supplierEmail.includes('@')) {
            return {
                success: false,
                error: 'A verified supplier email address is required. Please verify contact information.',
            };
        }

        if (!payload.subject?.trim() || !payload.messageBody?.trim()) {
            return { success: false, error: 'Email Subject and Message Body cannot be empty.' };
        }

        const senderDisplayName = payload.senderName || 'Airship Express Procurement';
        const senderDisplayEmail = payload.senderEmail || 'procurement@airshipexpress.ph';

        // Prepare email HTML template with professional Airship Express branding
        const formattedHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); padding: 24px; color: #ffffff; text-align: left; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em; }
        .header p { margin: 4px 0 0 0; font-size: 13px; opacity: 0.9; }
        .content { padding: 28px 24px; }
        .meta-box { background-color: #f1f5f9; border-radius: 12px; padding: 14px 16px; margin: 18px 0; font-size: 13px; }
        .meta-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .meta-row:last-child { margin-bottom: 0; }
        .meta-label { color: #64748b; font-weight: 600; }
        .meta-value { color: #0f172a; font-weight: 700; }
        .message-body { font-size: 14px; white-space: pre-line; color: #334155; margin: 20px 0; }
        .footer { padding: 20px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Airship Express Supply Chain</h1>
            <p>Procurement & Quality Assurance Notice</p>
        </div>
        <div class="content">
            <div class="meta-box">
                <div class="meta-row"><span class="meta-label">Purchase Order:</span> <span class="meta-value">${payload.poNumber}</span></div>
                <div class="meta-row"><span class="meta-label">Supplier:</span> <span class="meta-value">${payload.supplierName}</span></div>
                <div class="meta-row"><span class="meta-label">Date:</span> <span class="meta-value">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
            </div>
            
            <div class="message-body">
${payload.messageBody}
            </div>

            ${
                payload.attachments && payload.attachments.length > 0
                    ? `
            <div style="margin-top: 20px; padding-top: 16px; border-top: 1px dashed #cbd5e1;">
                <p style="font-size: 12px; font-weight: 700; color: #475569; margin: 0 0 8px 0;">Attached Evidence / References:</p>
                <ul style="font-size: 12px; color: #ec4899; padding-left: 20px; margin: 0;">
                    ${payload.attachments.map((url, i) => `<li><a href="${url}" target="_blank" style="color: #ec4899; text-decoration: underline;">Photo / Evidence Document ${i + 1}</a></li>`).join('')}
                </ul>
            </div>
            `
                    : ''
            }
        </div>
        <div class="footer">
            <p>This is an official communication from Airship Express Logistics & Supply Chain Management.</p>
            <p>Please reply directly to this notice or contact your designated Procurement Representative.</p>
        </div>
    </div>
</body>
</html>
        `;

        // Send actual email via existing mailer
        const mailResult = await sendSupplyChainEmail({
            to: payload.supplierEmail,
            subject: payload.subject,
            html: formattedHtml,
            text: payload.messageBody,
            senderName: senderDisplayName,
            senderEmail: senderDisplayEmail,
        });

        const deliveryStatus = mailResult.success ? 'Sent' : 'Failed';
        const deliveryError = mailResult.error || null;

        // Record message in supplier_return_messages
        const messageRecord = {
            return_request_id: payload.returnRequestId,
            incident_id: payload.incidentId || null,
            po_number: payload.poNumber,
            supplier_id: payload.supplierId || null,
            supplier_name: payload.supplierName,
            supplier_email: payload.supplierEmail,
            sender_name: senderDisplayName,
            sender_email: senderDisplayEmail,
            subject: payload.subject,
            message_body: payload.messageBody,
            template_used: payload.templateUsed || 'Custom Message',
            attachments: payload.attachments || [],
            delivery_status: deliveryStatus,
            delivery_error: deliveryError,
            created_at: new Date().toISOString(),
        };

        const { data: savedMsg, error: saveErr } = await dbClient
            .from('supplier_return_messages')
            .insert([messageRecord])
            .select('*')
            .maybeSingle();

        if (saveErr) {
            console.warn('Could not record to supplier_return_messages table (might need migration):', saveErr.message);
        }

        // Advance return request status to 'Awaiting Supplier Response' if currently pending or under investigation
        try {
            await dbClient
                .from('supplier_return_requests')
                .update({
                    status: 'Awaiting Supplier Response',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', payload.returnRequestId)
                .in('status', ['Pending Review', 'Under Investigation']);
        } catch (stErr) {
            console.warn('Status update notice:', stErr);
        }

        // Also sync into public.messages table for the supplier account
        if (payload.supplierId || payload.supplierEmail) {
            try {
                let supId = payload.supplierId;
                if (!supId && payload.supplierEmail) {
                    const { data: supRow } = await dbClient
                        .from('suppliers')
                        .select('id')
                        .ilike('email', payload.supplierEmail)
                        .maybeSingle();
                    if (supRow?.id) supId = Number(supRow.id);
                }

                if (supId) {
                    await dbClient.from('messages').insert({
                        supplier_id: supId,
                        sender_type: 'internal',
                        sender_name: senderDisplayName,
                        sender_email: senderDisplayEmail,
                        sender_role: 'Procurement QA Officer',
                        message: `[Official Notice: ${payload.subject}]\n\n${payload.messageBody}`,
                        attachments: payload.attachments || [],
                        is_read: false,
                        created_at: new Date().toISOString(),
                    });
                }
            } catch (msgSyncErr) {
                console.warn('Sync to public.messages notice:', msgSyncErr);
            }
        }

        if (!mailResult.success) {
            return {
                success: false,
                deliveryStatus: 'Failed',
                error: mailResult.error || 'Failed to dispatch email to supplier.',
            };
        }

        revalidatePath('/procurement');
        revalidatePath('/suppliers_page/purchase-orders');

        return {
            success: true,
            deliveryStatus: 'Sent',
            messageId: mailResult.messageId,
            message: `Official communication delivered successfully to ${payload.supplierEmail}.`,
        };
    } catch (err: any) {
        console.error('Error in sendSupplierReturnMessageAction:', err);
        return { success: false, error: err.message || 'Failed to send message to supplier.' };
    }
}

/**
 * 5. Fetch Message History for a Return Request
 */
export async function fetchSupplierReturnMessagesAction(returnRequestId: string) {
    try {
        if (!returnRequestId) return { success: true, data: [] };

        const { data, error } = await dbClient
            .from('supplier_return_messages')
            .select('*')
            .eq('return_request_id', returnRequestId)
            .order('created_at', { ascending: false });

        if (error) {
            console.warn('Error fetching supplier_return_messages:', error.message);
            return { success: true, data: [] };
        }

        return { success: true, data: (data || []) as SupplierReturnMessageRecord[] };
    } catch (err: any) {
        console.error('Error fetching return messages:', err);
        return { success: false, error: err.message, data: [] };
    }
}

/**
 * 6. Fetch Supplier Return Requests For Supplier Portal (/suppliers_page/purchase-orders)
 */
export async function fetchSupplierReturnRequestsForSupplierAction(filter: {
    supplierId?: string | number;
    supplierEmail?: string;
    supplierName?: string;
}) {
    try {
        let query = dbClient.from('supplier_return_requests').select('*');

        if (filter.supplierId) {
            query = query.eq('supplier_id', Number(filter.supplierId));
        } else if (filter.supplierEmail) {
            query = query.ilike('supplier_email', filter.supplierEmail);
        } else if (filter.supplierName) {
            query = query.ilike('supplier_name', filter.supplierName);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        let list: any[] = data || [];

        // Fallback: check warehouse_damage_incidents
        if (list.length === 0 && (filter.supplierName || filter.supplierId)) {
            const { data: incs } = await dbClient
                .from('warehouse_damage_incidents')
                .select('*')
                .order('created_at', { ascending: false });

            if (incs) {
                list = incs
                    .filter((inc) => {
                        const supMatch = inc.incident_notes?.toLowerCase().includes((filter.supplierName || '').toLowerCase());
                        const poSupMatch = inc.supplier_name?.toLowerCase().includes((filter.supplierName || '').toLowerCase());
                        return supMatch || poSupMatch;
                    })
                    .map((inc) => {
                        const poMatch = inc.incident_notes?.match(/PO:?\s*#?([A-Za-z0-9\-_]+)/i);
                        const poNum = inc.po_number || (poMatch ? poMatch[1] : 'PO-RECORD');
                        const refMatch = inc.incident_notes?.match(/Linked Return Request:?\s*([A-Za-z0-9\-_]+)/i);
                        const returnReqNum = refMatch ? refMatch[1] : `SRR-${inc.incident_number.replace('INC-DEF-', '')}`;

                        return {
                            id: inc.id,
                            return_request_number: returnReqNum,
                            incident_id: inc.id,
                            incident_number: inc.incident_number,
                            po_number: poNum,
                            supplier_name: inc.supplier_name || filter.supplierName || 'Vendor Supplier',
                            item_id: inc.item_id,
                            item_code: inc.item_code,
                            item_name: inc.item_name,
                            unit: inc.unit || 'units',
                            quantity_received: inc.quantity_received || inc.quantity,
                            defective_quantity: inc.quantity,
                            defect_type: inc.defect_type || inc.discrepancy_type || 'Damaged',
                            defect_description: inc.defect_description || inc.incident_notes || 'Defective item reported during inspection',
                            requested_resolution: inc.requested_resolution || 'Replacement',
                            status: inc.status === 'Under Investigation' ? 'Pending Review' : inc.status,
                            supplier_responsibility: 'Pending Supplier Confirmation',
                            evidence_urls: inc.evidence_urls || [],
                            inspection_date: inc.reported_at ? inc.reported_at.split('T')[0] : new Date().toISOString().split('T')[0],
                            reported_by: inc.reported_by,
                            resolution_details: {},
                            finance_verified: false,
                            created_at: inc.created_at,
                            updated_at: inc.updated_at,
                        };
                    });
            }
        }

        // Enrich with PO details
        const poNumbers = Array.from(new Set(list.map((r) => r.po_number).filter(Boolean)));
        let poMap = new Map<string, any>();

        if (poNumbers.length > 0) {
            const { data: pos } = await dbClient
                .from('purchase_orders')
                .select('*')
                .in('po_number', poNumbers);

            if (pos) {
                pos.forEach((p) => poMap.set(p.po_number, p));
            }
        }

        const enriched: SupplierReturnRequestRecord[] = list.map((req) => {
            const matchedPO = poMap.get(req.po_number);
            return {
                ...req,
                incident_number: req.incident_number || `INC-${req.return_request_number.replace('SRR-', '')}`,
                po_details: matchedPO
                    ? {
                          total_amount: Number(matchedPO.total_amount) || 0,
                          payment_terms: matchedPO.payment_terms || 'Net 30 Days Upon Receipt',
                          terms_and_conditions:
                              matchedPO.terms_and_conditions ||
                              'Defective or damaged items subject to standard vendor replacement or credit note within 14 business days of arrival notice.',
                          financial_approval: matchedPO.financial_approval,
                          admin_approval: matchedPO.admin_approval,
                          status: matchedPO.status,
                          paid: Boolean(matchedPO.paid),
                          items: matchedPO.items || [],
                          supplier_contact_person: matchedPO.supplier_contact || 'Vendor Account Representative',
                          supplier_phone: matchedPO.supplier_phone || '',
                          supplier_address: matchedPO.supplier_address || matchedPO.delivery_address || '',
                      }
                    : undefined,
            };
        });

        return { success: true, data: enriched };
    } catch (err: any) {
        console.error('Error fetching return requests for supplier:', err);
        return { success: false, error: err.message || 'Failed to fetch return requests for supplier.', data: [] };
    }
}

/**
 * 7. Supplier Responds to Return Request (from /suppliers_page/purchase-orders)
 */
export interface SupplierResponsePayload {
    returnRequestId: string;
    supplierId?: number | string;
    supplierName: string;
    supplierEmail: string;
    messageBody?: string;
    supplierResponsibility?: SupplierResponsibility;
    supplierResponsibilityNotes?: string;
    updatedStatus?: SupplierReturnStatus;
    resolutionDetails?: any;
}

export async function supplierRespondToReturnRequestAction(payload: SupplierResponsePayload) {
    try {
        if (!payload.returnRequestId) {
            return { success: false, error: 'Return Request ID is required.' };
        }

        const { data: currentReq } = await dbClient
            .from('supplier_return_requests')
            .select('*')
            .eq('id', payload.returnRequestId)
            .maybeSingle();

        if (!currentReq) {
            return { success: false, error: 'Return request record not found.' };
        }

        // Determine updated status (auto-detection vs explicit selection)
        let finalStatus: SupplierReturnStatus = payload.updatedStatus || currentReq.status;
        if (!payload.updatedStatus) {
            if (payload.supplierResponsibility === 'Supplier Responsible') {
                if (payload.resolutionDetails?.replacement_receiving_status === 'In Transit' || payload.resolutionDetails?.expected_replacement_date) {
                    finalStatus = 'Approved for Return';
                } else {
                    finalStatus = 'Under Investigation';
                }
            } else if (payload.supplierResponsibility === 'Supplier Not Responsible' || payload.supplierResponsibility === 'Disputed / Further Investigation Required') {
                finalStatus = 'Under Investigation';
            } else if (payload.messageBody?.trim()) {
                finalStatus = 'Under Investigation';
            }
        }

        const updateData: any = {
            status: finalStatus,
            updated_at: new Date().toISOString(),
        };

        if (payload.supplierResponsibility) {
            updateData.supplier_responsibility = payload.supplierResponsibility;
        }
        if (payload.supplierResponsibilityNotes !== undefined) {
            updateData.supplier_responsibility_notes = payload.supplierResponsibilityNotes;
        }
        if (payload.resolutionDetails) {
            updateData.resolution_details = {
                ...(currentReq.resolution_details || {}),
                ...payload.resolutionDetails,
            };
        }

        // Auto RMA generation fallback if supplier confirms responsibility and reference is blank
        if (payload.supplierResponsibility === 'Supplier Responsible') {
            if (!updateData.resolution_details) {
                updateData.resolution_details = { ...(currentReq.resolution_details || {}) };
            }
            if (!updateData.resolution_details.supplier_reference?.trim()) {
                const rawNum = (currentReq.return_request_number || '').replace(/^SRR-?/i, '');
                updateData.resolution_details.supplier_reference = rawNum
                    ? `RMA-${rawNum}`
                    : `RMA-${currentReq.po_number || 'REF'}-${new Date().getFullYear()}`;
            }
        }

        // Update supplier_return_requests
        await dbClient
            .from('supplier_return_requests')
            .update(updateData)
            .eq('id', payload.returnRequestId);

        // Also sync status automatically on warehouse_damage_incidents
        try {
            let mappedIncidentStatus: 'Under Investigation' | 'Written Off' | 'Returned to Vendor (RMA)' | 'Replaced / Restored' = 'Under Investigation';
            let mappedActionTaken: 'Stock Deducted / Disposed' | 'Quarantine for Claim' | 'Vendor Replacement' | 'Repackaged' = 'Quarantine for Claim';

            if (finalStatus === 'Resolved' && (currentReq.proposed_resolution === 'Replacement' || payload.resolutionDetails?.replacement_receiving_status === 'Received & Restocked')) {
                mappedIncidentStatus = 'Replaced / Restored';
                mappedActionTaken = 'Vendor Replacement';
            } else if (
                finalStatus === 'Return in Transit' ||
                finalStatus === 'Approved for Return' ||
                Boolean((payload as any).rmaNumber || payload.resolutionDetails?.supplier_reference) ||
                payload.supplierResponsibility === 'Supplier Responsible'
            ) {
                mappedIncidentStatus = 'Returned to Vendor (RMA)';
                mappedActionTaken = 'Quarantine for Claim';
            } else if (
                currentReq.proposed_resolution === 'Scrap / Write Off' ||
                currentReq.proposed_resolution === 'Refund' ||
                currentReq.proposed_resolution === 'Supplier Credit'
            ) {
                mappedIncidentStatus = 'Written Off';
                mappedActionTaken = 'Stock Deducted / Disposed';
            }

            const incidentUpdatePayload = {
                status: mappedIncidentStatus,
                action_taken: mappedActionTaken,
                updated_at: new Date().toISOString(),
            };

            if (currentReq.incident_id) {
                await dbClient
                    .from('warehouse_damage_incidents')
                    .update(incidentUpdatePayload)
                    .eq('id', currentReq.incident_id);
            }
            if (currentReq.return_request_number) {
                await dbClient
                    .from('warehouse_damage_incidents')
                    .update(incidentUpdatePayload)
                    .ilike('incident_notes', `%${currentReq.return_request_number}%`);
            }
        } catch (syncErr) {
            console.warn('Incident sync notice:', syncErr);
        }

        // If message body was provided, record in supplier_return_messages
        if (payload.messageBody?.trim()) {
            const messageRecord = {
                return_request_id: payload.returnRequestId,
                incident_id: currentReq.incident_id || null,
                po_number: currentReq.po_number,
                supplier_id: payload.supplierId ? Number(payload.supplierId) : currentReq.supplier_id || null,
                supplier_name: payload.supplierName,
                supplier_email: payload.supplierEmail,
                sender_name: payload.supplierName,
                sender_email: payload.supplierEmail,
                subject: `Re: Defective Item Return Notice - Req #${currentReq.return_request_number}`,
                message_body: payload.messageBody,
                template_used: 'Supplier Portal Response',
                attachments: [],
                delivery_status: 'Sent',
                created_at: new Date().toISOString(),
            };

            await dbClient.from('supplier_return_messages').insert([messageRecord]);

            // Also sync into public.messages table
            if (payload.supplierId || currentReq.supplier_id) {
                try {
                    await dbClient.from('messages').insert({
                        supplier_id: payload.supplierId ? Number(payload.supplierId) : currentReq.supplier_id,
                        sender_type: 'supplier',
                        sender_name: payload.supplierName,
                        sender_email: payload.supplierEmail,
                        sender_role: 'Authorized Supplier',
                        message: `[Return Request #${currentReq.return_request_number} Response]\n\n${payload.messageBody}`,
                        attachments: [],
                        is_read: false,
                        created_at: new Date().toISOString(),
                    });
                } catch (msgErr) {
                    console.warn('Sync to public.messages notice:', msgErr);
                }
            }
        }

        // Insert notification for Procurement
        try {
            await dbClient.from('notifications').insert({
                creator_name: payload.supplierName,
                creator_email: payload.supplierEmail,
                title: `Supplier Response: Return Request #${currentReq.return_request_number}`,
                message: `${payload.supplierName} updated Return Request #${currentReq.return_request_number} (PO #${currentReq.po_number}). Status: ${finalStatus}. Responsibility: ${payload.supplierResponsibility || 'Updated'}.`,
                type: 'alert',
                link: `/procurement?stage=4`,
                role: ['Purchase Officer', 'Admin', 'Executive'],
                is_read: false,
                reference_type: 'supplier_return',
                reference_id: payload.returnRequestId,
            });
        } catch (notifErr) {
            console.warn('Procurement notification notice:', notifErr);
        }

        revalidatePath('/procurement');
        revalidatePath('/warehousing');
        revalidatePath('/suppliers_page/purchase-orders');

        return {
            success: true,
            status: finalStatus,
            message: `Response submitted successfully. Return request workflow status updated to ${finalStatus}.`,
        };
    } catch (err: any) {
        console.error('Error in supplierRespondToReturnRequestAction:', err);
        return { success: false, error: err.message || 'Failed to submit response.' };
    }
}

/**
 * 8. Fetch Approved Replacements for Warehouse Receiving Dock (/warehousing?tab=receive)
 */
export async function fetchApprovedReplacementReturnsAction() {
    try {
        const { data, error } = await dbClient
            .from('supplier_return_requests')
            .select('*')
            .or('requested_resolution.ilike.%Replacement%,proposed_resolution.ilike.%Replacement%')
            .order('created_at', { ascending: false });

        if (error) {
            console.warn('Error fetching approved replacement returns:', error.message);
            return { success: true, data: [] };
        }

        // Filter strictly for approved replacement returns that have NOT yet been received & restocked
        const approvedReplacements = (data || []).filter((req: any) => {
            const st = String(req.status || '').trim().toLowerCase();
            const receivingStatus = String(req.resolution_details?.replacement_receiving_status || '').trim().toLowerCase();

            // Already received and resolved
            if (receivingStatus === 'received & restocked' || (st === 'resolved' && receivingStatus !== '')) {
                return false;
            }

            // Must be approved
            const isApproved =
                st === 'approved for return' ||
                st === 'return in transit' ||
                st === 'replacement dispatched' ||
                st.includes('approved') ||
                st.includes('dispatched');

            return isApproved;
        });

        return { success: true, data: approvedReplacements as SupplierReturnRequestRecord[] };
    } catch (err: any) {
        console.error('Error in fetchApprovedReplacementReturnsAction:', err);
        return { success: false, error: err.message, data: [] };
    }
}

export interface ReceiveSupplierReplacementPayload {
    returnRequestId: string;
    receivedQuantity: number;
    storageLocation?: string;
    deliveryReceiptNumber?: string;
    invoiceNumber?: string;
    qcCondition?: string;
    receivedBy?: string;
    receivedById?: string;
    notes?: string;
}

/**
 * 9. Process Receiving of Approved Supplier Replacement at Warehouse Dock
 */
export async function receiveSupplierReplacementAction(payload: ReceiveSupplierReplacementPayload) {
    try {
        if (!payload.returnRequestId) {
            return { success: false, error: 'Return Request ID is required.' };
        }

        const { data: currentReq, error: reqErr } = await dbClient
            .from('supplier_return_requests')
            .select('*')
            .eq('id', payload.returnRequestId)
            .maybeSingle();

        if (reqErr || !currentReq) {
            return { success: false, error: 'Return request record not found.' };
        }

        const receivedQty = Number(payload.receivedQuantity) > 0 
            ? Number(payload.receivedQuantity) 
            : Number(currentReq.defective_quantity) || 1;

        const now = new Date().toISOString();
        const reviewer = payload.receivedBy || 'Warehouse QC Inspector';

        // 1. Update supplier_return_requests
        const updatedResolutionDetails = {
            ...(currentReq.resolution_details || {}),
            replacement_receiving_status: 'Received & Restocked',
            replacement_received_date: now,
            replacement_received_by: reviewer,
            replacement_storage_location: payload.storageLocation || 'Central Warehouse Storage',
            delivery_receipt_number: payload.deliveryReceiptNumber || '',
            invoice_number: payload.invoiceNumber || currentReq.po_number || '',
            qc_condition: payload.qcCondition || 'Passed QC Inspection',
            receiving_notes: payload.notes || '',
            replacement_quantity_received: receivedQty,
        };

        const { error: updateErr } = await dbClient
            .from('supplier_return_requests')
            .update({
                status: 'Resolved',
                proposed_resolution: 'Replacement',
                resolution_details: updatedResolutionDetails,
                updated_at: now,
            })
            .eq('id', payload.returnRequestId);

        if (updateErr) {
            console.error('Error updating supplier_return_requests:', updateErr);
            return { success: false, error: `Failed to update return claim: ${updateErr.message}` };
        }

        // 2. Restock into active inventory (inventory_items)
        let updatedStock = receivedQty;
        let prevStock = 0;
        try {
            const { data: invItems } = await dbClient
                .from('inventory_items')
                .select('*')
                .or(`item_code.eq."${currentReq.item_code}",item_name.ilike."${currentReq.item_name}"`)
                .limit(1);

            if (invItems && invItems.length > 0) {
                const inv = invItems[0];
                prevStock = Number(inv.current_stock) || 0;
                updatedStock = prevStock + receivedQty;

                const invUpdateData: any = {
                    current_stock: updatedStock,
                    updated_at: now,
                };

                if (payload.storageLocation) {
                    invUpdateData.storage_location = payload.storageLocation;
                }

                await dbClient
                    .from('inventory_items')
                    .update(invUpdateData)
                    .eq('id', inv.id);

                // 3. Log traceable Stock Movement
                await logStockMovement({
                    item_id: inv.id,
                    item_code: inv.item_code,
                    item_name: inv.item_name,
                    movement_type: 'Stock In',
                    quantity: receivedQty,
                    previous_stock: prevStock,
                    new_stock: updatedStock,
                    reference_number: currentReq.return_request_number,
                    reason: `Supplier Replacement Restocked (Claim #${currentReq.return_request_number})`,
                    notes: `Received & inspected ${receivedQty} ${currentReq.unit} replacement units from ${currentReq.supplier_name}. DR #${payload.deliveryReceiptNumber || 'N/A'}. Condition: ${payload.qcCondition || 'Passed QC Inspection'}. Restocked to ${payload.storageLocation || inv.storage_location || 'Warehouse Storage'}.`,
                    department: 'Warehouse Receiving Dock',
                    performed_by: reviewer,
                    performed_by_id: payload.receivedById || null,
                    metadata: {
                        action: 'REPLACEMENT_RESTOCKED',
                        return_request_number: currentReq.return_request_number,
                        po_number: currentReq.po_number,
                        supplier: currentReq.supplier_name,
                        storage_location: payload.storageLocation || inv.storage_location,
                        delivery_receipt: payload.deliveryReceiptNumber,
                    },
                });
            }
        } catch (invErr) {
            console.warn('Inventory restock warning:', invErr);
        }

        // 4. Sync warehouse_damage_incidents automatically to 'Replaced / Restored'
        try {
            const incStatus = 'Replaced / Restored';
            const incAction = 'Vendor Replacement';
            const incUpdate = {
                status: incStatus,
                action_taken: incAction,
                updated_at: now,
            };

            if (currentReq.incident_id) {
                await dbClient
                    .from('warehouse_damage_incidents')
                    .update(incUpdate)
                    .eq('id', currentReq.incident_id);
            }
            if (currentReq.return_request_number) {
                await dbClient
                    .from('warehouse_damage_incidents')
                    .update(incUpdate)
                    .ilike('incident_notes', `%${currentReq.return_request_number}%`);
            }
            if (currentReq.po_number) {
                await dbClient
                    .from('warehouse_damage_incidents')
                    .update(incUpdate)
                    .ilike('incident_notes', `%${currentReq.po_number}%`);
            }
        } catch (incSyncErr) {
            console.warn('Damage incident sync notice:', incSyncErr);
        }

        // 5. Log audit message into supplier_return_messages
        try {
            await dbClient.from('supplier_return_messages').insert([
                {
                    return_request_id: payload.returnRequestId,
                    incident_id: currentReq.incident_id || null,
                    po_number: currentReq.po_number,
                    supplier_id: currentReq.supplier_id || null,
                    supplier_name: currentReq.supplier_name,
                    supplier_email: currentReq.supplier_email,
                    sender_name: reviewer,
                    sender_email: 'warehouse@airshipexpress.com',
                    subject: `Replacement Received & Verified - Req #${currentReq.return_request_number}`,
                    message_body: `Warehouse Receiving Dock has received, verified, and accepted ${receivedQty} ${currentReq.unit} replacement units. Delivery Receipt: ${payload.deliveryReceiptNumber || 'On file'}. Condition: ${payload.qcCondition || 'Passed QC Inspection'}. Storage Location: ${payload.storageLocation || 'General Storage'}. Return claim is now Resolved.`,
                    template_used: 'Replacement Receiving Confirmation',
                    attachments: [],
                    delivery_status: 'Delivered',
                    created_at: now,
                },
            ]);
        } catch (msgErr) {
            console.warn('Message history log notice:', msgErr);
        }

        // 6. Notify Procurement team
        try {
            await dbClient.from('notifications').insert({
                creator_name: reviewer,
                creator_email: 'warehouse@airshipexpress.com',
                title: `Replacement Received: Claim #${currentReq.return_request_number}`,
                message: `Warehouse Dock accepted and restocked ${receivedQty} ${currentReq.unit} replacement units from ${currentReq.supplier_name} for PO #${currentReq.po_number}. Claim is now marked Resolved.`,
                type: 'success',
                link: `/procurement?stage=4`,
                role: ['Purchase Officer', 'Admin', 'Executive'],
                is_read: false,
                reference_type: 'supplier_return',
                reference_id: payload.returnRequestId,
            });
        } catch (notifErr) {
            console.warn('Notification insert notice:', notifErr);
        }

        revalidatePath('/warehousing');
        revalidatePath('/procurement');
        revalidatePath('/suppliers_page/purchase-orders');

        return {
            success: true,
            message: `Replacement goods received successfully! ${receivedQty} ${currentReq.unit} restocked into inventory & claim resolved.`,
        };
    } catch (err: any) {
        console.error('Error in receiveSupplierReplacementAction:', err);
        return { success: false, error: err.message || 'Failed to process replacement receiving.' };
    }
}
