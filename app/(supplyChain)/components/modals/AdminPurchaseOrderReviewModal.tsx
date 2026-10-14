"use client";

import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "../../lib/services/client/supabase";
import { user } from "../../lib/services/Class/user";
import { createNotification } from "../../lib/services/notifications";
import { normalizeItemName, isItemRelated, toSingularForm } from "../../lib/utils";
import { fetchAllRequisitionsForMatching } from "../../(pages)/inventory/server/query";
import Portal from "../client/Portal";
import { 
    X, 
    FileText, 
    CheckCircle2, 
    XCircle, 
    Building2, 
    User, 
    Calendar, 
    Package, 
    DollarSign, 
    Layers, 
    AlertTriangle, 
    Edit3, 
    Save, 
    RotateCcw, 
    Clock, 
    ShieldCheck, 
    Store,
    Info,
    ExternalLink
} from "lucide-react";

export interface AdminPurchaseOrderReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    purchaseOrderId?: string | null;
    poId?: string | null;
    poNumber?: string | null;
    initialPoData?: any | null;
    onPOUpdated?: (updatedPo: any) => void;
}

export function AdminPurchaseOrderReviewModal({
    isOpen,
    onClose,
    purchaseOrderId,
    poId,
    poNumber,
    initialPoData,
    onPOUpdated,
}: AdminPurchaseOrderReviewModalProps) {
    const effectivePoId = purchaseOrderId || poId;
    const [po, setPo] = useState<any | null>(initialPoData || null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Quantity editing state (Admin may only adjust quantity)
    const [isEditingQty, setIsEditingQty] = useState(false);
    const [editQuantities, setEditQuantities] = useState<Record<number, number>>({});
    const [editReason, setEditReason] = useState("");

    // Rejection state
    const [isRejecting, setIsRejecting] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");

    // Related and cross-request items for the same normalized item name
    const [matchingRequests, setMatchingRequests] = useState<any[]>([]);
    const [isLoadingMatchingRequests, setIsLoadingMatchingRequests] = useState(false);

    // Fetch PO data if effectivePoId or poNumber provided
    const loadPoData = async () => {
        if (!effectivePoId && !poNumber && !initialPoData) return;
        setIsLoading(true);
        try {
            let query = supabase.from("purchase_orders").select("*");
            if (effectivePoId) {
                query = query.eq("id", effectivePoId);
            } else if (poNumber) {
                query = query.eq("po_number", poNumber);
            }
            const { data, error } = await query.single();
            if (error) throw error;
            if (data) {
                if (typeof data.items === "string") {
                    try {
                        data.items = JSON.parse(data.items);
                    } catch (e) {
                        data.items = [];
                    }
                }
                // Fallback: If data.items is empty, synthesize from item_name or notes
                if (!Array.isArray(data.items) || data.items.length === 0) {
                    let fallbackName = data.item_name;
                    if (!fallbackName && data.notes) {
                        const m = data.notes.match(/\(([^)]+)\)/);
                        if (m && m[1]) fallbackName = m[1];
                    }
                    if (fallbackName) {
                        data.items = [{
                            item_name: fallbackName,
                            quantity: 1,
                            unit_price: Number(data.subtotal || data.total_amount || 0)
                        }];
                    }
                }
                setPo(data);
                // Initialize editable quantities
                const initialQtyMap: Record<number, number> = {};
                if (Array.isArray(data.items)) {
                    data.items.forEach((it: any, idx: number) => {
                        initialQtyMap[idx] = Number(it.quantity_ordered ?? it.quantity ?? 1);
                    });
                }
                setEditQuantities(initialQtyMap);
            }
        } catch (err: any) {
            console.error("Error fetching purchase order for review:", err);
            toast.error("Could not load purchase order details.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            if (initialPoData) {
                let parsedPo = { ...initialPoData };
                if (typeof parsedPo.items === "string") {
                    try {
                        parsedPo.items = JSON.parse(parsedPo.items);
                    } catch (e) {
                        parsedPo.items = [];
                    }
                }
                if (!Array.isArray(parsedPo.items) || parsedPo.items.length === 0) {
                    let fallbackName = parsedPo.item_name;
                    if (!fallbackName && parsedPo.notes) {
                        const m = parsedPo.notes.match(/\(([^)]+)\)/);
                        if (m && m[1]) fallbackName = m[1];
                    }
                    if (fallbackName) {
                        parsedPo.items = [{
                            item_name: fallbackName,
                            quantity: 1,
                            unit_price: Number(parsedPo.subtotal || parsedPo.total_amount || 0)
                        }];
                    }
                }
                setPo(parsedPo);
                const initialQtyMap: Record<number, number> = {};
                if (Array.isArray(parsedPo.items)) {
                    parsedPo.items.forEach((it: any, idx: number) => {
                        initialQtyMap[idx] = Number(it.quantity_ordered ?? it.quantity ?? 1);
                    });
                }
                setEditQuantities(initialQtyMap);
            }
            loadPoData();
            setIsEditingQty(false);
            setIsRejecting(false);
            setRejectionReason("");
            setEditReason("");
        }
    }, [isOpen, effectivePoId, poNumber, initialPoData?.id]);

    // Compute normalized item names in this PO
    const poItemNamesList = useMemo(() => {
        if (!po) return [];
        const names = new Set<string>();
        let poItemsList = po.items;
        if (typeof poItemsList === "string") {
            try {
                poItemsList = JSON.parse(poItemsList);
            } catch (e) {
                poItemsList = [];
            }
        }
        if (Array.isArray(poItemsList)) {
            poItemsList.forEach((it: any) => {
                const norm = normalizeItemName(it.item_name || it.name);
                if (norm) names.add(norm);
            });
        }
        if (po.item_name) {
            const norm = normalizeItemName(po.item_name);
            if (norm) names.add(norm);
        }
        if (po.notes) {
            const matches = po.notes.matchAll(/\(([^)]+)\)/g);
            for (const m of matches) {
                if (m && m[1]) {
                    const norm = normalizeItemName(m[1]);
                    if (norm) names.add(norm);
                }
            }
            const forMatch = po.notes.match(/for\s+([^()]+?)\s*\(/i);
            if (forMatch && forMatch[1]) {
                const norm = normalizeItemName(forMatch[1]);
                if (norm) names.add(norm);
            }
        }
        return Array.from(names);
    }, [po?.items, po?.item_name, po?.notes]);

    // Fetch matching purchase requests with related item names (LAPTOP, Laptops, Lptops, etc.)
    useEffect(() => {
        if (!po || !isOpen) return;

        const fetchMatchingRequests = async () => {
            setIsLoadingMatchingRequests(true);
            try {
                const poItemNames = new Set<string>(poItemNamesList);

                // Query all department requisitions and purchase requests via Server Action (bypasses RLS)
                let allReqs: any[] = [];
                try {
                    allReqs = await fetchAllRequisitionsForMatching();
                } catch (actionErr) {
                    console.warn("Notice calling fetchAllRequisitionsForMatching:", actionErr);
                }

                // Fallback to client query if server action returns empty or encounters network error
                if (!allReqs || allReqs.length === 0) {
                    const [prRes, irRes] = await Promise.allSettled([
                        supabase.from("purchase_requests").select("*").order("created_at", { ascending: false }).limit(100),
                        supabase.from("inventory_requests").select("*").order("created_at", { ascending: false }).limit(100)
                    ]);
                    const prData = prRes.status === "fulfilled" && prRes.value.data ? prRes.value.data : [];
                    const irData = irRes.status === "fulfilled" && irRes.value.data ? irRes.value.data : [];
                    allReqs = [...prData, ...irData];
                }

                // If poItemNames is still empty, check if any request matches po.request_id to extract its item name
                if (poItemNames.size === 0 && po.request_id) {
                    const linked = allReqs.find((r: any) => r.id === po.request_id || r.request_number === po.request_id);
                    if (linked) {
                        const norm = normalizeItemName(linked.item_name || linked.name);
                        if (norm) poItemNames.add(norm);
                        let lItems = linked.items;
                        if (typeof lItems === "string") {
                            try { lItems = JSON.parse(lItems); } catch { lItems = []; }
                        }
                        if (Array.isArray(lItems)) {
                            lItems.forEach((it: any) => {
                                const n = normalizeItemName(it.item_name || it.name);
                                if (n) poItemNames.add(n);
                            });
                        }
                    }
                }

                if (poItemNames.size === 0 && !po.request_id && !po.notes) {
                    setMatchingRequests([]);
                    return;
                }

                const poItemNamesArr = Array.from(poItemNames);

                if (allReqs && allReqs.length > 0) {
                    const matched = allReqs.filter((req: any) => {
                        // 1. Direct link by request id or PO notes containing requisition number
                        if (po.request_id && (req.id === po.request_id || req.request_number === po.request_id)) {
                            return true;
                        }
                        if (po.notes && req.request_number && po.notes.includes(req.request_number)) {
                            return true;
                        }

                        // 2. Check req.item_name against all PO items using isItemRelated
                        const reqItemNorm = req.item_name || req.name;
                        if (reqItemNorm && poItemNamesArr.some((poItem) => isItemRelated(poItem, reqItemNorm))) {
                            return true;
                        }

                        // 3. Check items array in req against all PO items using isItemRelated
                        let reqItems = req.items;
                        if (typeof reqItems === "string") {
                            try { reqItems = JSON.parse(reqItems); } catch { reqItems = []; }
                        }
                        if (Array.isArray(reqItems)) {
                            return reqItems.some((it: any) => {
                                const itName = it.item_name || it.name;
                                return itName && poItemNamesArr.some((poItem) => isItemRelated(poItem, itName));
                            });
                        }
                        return false;
                    });

                    // Sort: directly linked first, then pending requests, then newest
                    matched.sort((a: any, b: any) => {
                        const aLinked = a.id === po.request_id || (po.notes && a.request_number && po.notes.includes(a.request_number)) ? 1 : 0;
                        const bLinked = b.id === po.request_id || (po.notes && b.request_number && po.notes.includes(b.request_number)) ? 1 : 0;
                        if (aLinked !== bLinked) return bLinked - aLinked;

                        const aPending = String(a.status || "").toLowerCase() === "pending" ? 1 : 0;
                        const bPending = String(b.status || "").toLowerCase() === "pending" ? 1 : 0;
                        if (aPending !== bPending) return bPending - aPending;

                        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
                    });

                    setMatchingRequests(matched);
                } else {
                    setMatchingRequests([]);
                }
            } catch (err: any) {
                console.warn("Notice fetching matching purchase requests:", err);
            } finally {
                setIsLoadingMatchingRequests(false);
            }
        };

        fetchMatchingRequests();
    }, [po?.id, po?.po_number, poItemNamesList, po?.request_id, po?.notes, isOpen]);

    // Financial calculations when quantities are adjusted by Admin
    const calculatedFinancials = useMemo(() => {
        if (!po || !Array.isArray(po.items)) {
            return {
                subtotal: Number(po?.subtotal || 0),
                discount: Number(po?.discount || 0),
                shippingFee: Number(po?.shipping_fee || 0),
                taxRate: Number(po?.tax_rate || 12),
                taxAmount: Number(po?.tax_amount || 0),
                totalAmount: Number(po?.total_amount || 0),
            };
        }

        let newSubtotal = 0;
        const discount = Number(po.discount || 0);
        const shippingFee = Number(po.shipping_fee || 0);
        const taxRate = Number(po.tax_rate !== undefined && po.tax_rate !== null ? po.tax_rate : 12);

        po.items.forEach((it: any, idx: number) => {
            const qty = editQuantities[idx] !== undefined ? editQuantities[idx] : Number(it.quantity_ordered ?? it.quantity ?? 1);
            const unitPrice = Number(it.unit_price ?? it.price ?? 0);
            newSubtotal += qty * unitPrice;
        });

        const taxable = Math.max(0, newSubtotal - discount);
        const taxAmount = Number(((taxable * taxRate) / 100).toFixed(2));
        const totalAmount = Number((taxable + taxAmount + shippingFee).toFixed(2));

        return {
            subtotal: newSubtotal,
            discount,
            shippingFee,
            taxRate,
            taxAmount,
            totalAmount,
        };
    }, [po, editQuantities]);

    // Handle Admin Approval
    const handleApprove = async () => {
        if (!po) return;
        setIsSubmitting(true);
        try {
            const adminId = user.getId() || null;
            const now = new Date().toISOString();

            const updatePayload: Record<string, any> = {
                admin_approval: "Approved",
                admin_approved_at: now,
                admin_approved_by: adminId,
                status: "Pending", // Keep status as Pending upon Admin approval
                updated_at: now,
            };

            const { data, error } = await supabase
                .from("purchase_orders")
                .update(updatePayload)
                .eq("id", po.id)
                .select()
                .single();

            if (error) throw error;

            // Notify Purchase Officer / Procurement
            try {
                await createNotification({
                    title: "Purchase Order Approved",
                    message: `PO #${po.po_number} for ${po.supplier_name} (₱${Number(po.total_amount).toLocaleString()}) has been officially approved by Admin ${user.getName() || "Admin"}. Status remains Pending.`,
                    type: "purchase_order_approved",
                    role: ["Purchase Officer", "Procurement Officer"],
                    poRequestId: po.id,
                    link: `/purchase-orders?poNumber=${po.po_number}`,
                    creatorName: user.getName() || "System Admin",
                    creatorEmail: user.getEmail() || "admin@airship.express",
                });
            } catch (notifErr) {
                console.warn("Could not dispatch approval notification:", notifErr);
            }

            toast.success(`Purchase Order #${po.po_number} approved successfully!`);
            onPOUpdated?.(data || { ...po, ...updatePayload });
            onClose();
        } catch (err: any) {
            console.error("Error approving purchase order:", err);
            toast.error(err?.message || "Failed to approve purchase order.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle Admin Rejection
    const handleReject = async () => {
        if (!po) return;
        if (!rejectionReason.trim()) {
            toast.error("Please provide a reason for rejecting this purchase order.");
            return;
        }

        setIsSubmitting(true);
        try {
            const now = new Date().toISOString();
            const adminName = user.getName() || "Admin";

            const updatedNotes = `${po.notes || ""}\n[Admin Rejection by ${adminName} on ${new Date().toLocaleDateString()}]: ${rejectionReason.trim()}`.trim();

            const updatePayload: Record<string, any> = {
                admin_approval: "Rejected",
                status: "Rejected",
                notes: updatedNotes,
                updated_at: now,
            };

            const { data, error } = await supabase
                .from("purchase_orders")
                .update(updatePayload)
                .eq("id", po.id)
                .select()
                .single();

            if (error) throw error;

            // Notify Purchase Officer / Procurement
            try {
                await createNotification({
                    title: "Purchase Order Rejected",
                    message: `PO #${po.po_number} for ${po.supplier_name} was rejected by Admin ${adminName}. Reason: ${rejectionReason.trim()}`,
                    type: "purchase_order_rejected",
                    role: ["Purchase Officer", "Procurement Officer"],
                    poRequestId: po.id,
                    link: `/purchase-orders?poNumber=${po.po_number}`,
                    creatorName: user.getName() || "System Admin",
                    creatorEmail: user.getEmail() || "admin@airship.express",
                });
            } catch (notifErr) {
                console.warn("Could not dispatch rejection notification:", notifErr);
            }

            toast.success(`Purchase Order #${po.po_number} has been rejected.`);
            onPOUpdated?.(data || { ...po, ...updatePayload });
            onClose();
        } catch (err: any) {
            console.error("Error rejecting purchase order:", err);
            toast.error(err?.message || "Failed to reject purchase order.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle Admin Save Edited Quantities
    const handleSaveQuantity = async () => {
        if (!po || !Array.isArray(po.items)) return;

        // Validation: Every quantity must be > 0
        for (let i = 0; i < po.items.length; i++) {
            const q = editQuantities[i];
            if (q === undefined || isNaN(q) || q <= 0) {
                toast.error(`Quantity for item #${i + 1} must be a valid number greater than 0.`);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const adminId = user.getId() || null;
            const adminName = user.getName() || "Admin";
            const now = new Date().toISOString();

            let hasChanges = false;
            const changesList: string[] = [];

            const updatedItems = po.items.map((it: any, idx: number) => {
                const prevQty = Number(it.quantity_ordered ?? it.quantity ?? 1);
                const newQty = editQuantities[idx];
                const unitPrice = Number(it.unit_price ?? it.price ?? 0);
                const newLineTotal = newQty * unitPrice;

                if (prevQty !== newQty) {
                    hasChanges = true;
                    changesList.push(`${it.item_name || it.name || `Item ${idx + 1}`}: ${prevQty} → ${newQty}`);
                }

                return {
                    ...it,
                    quantity: newQty,
                    quantity_ordered: newQty,
                    subtotal: newLineTotal,
                    total: newLineTotal,
                    total_price: newLineTotal,
                };
            });

            if (!hasChanges) {
                toast.info("No quantity changes detected.");
                setIsEditingQty(false);
                setIsSubmitting(false);
                return;
            }

            const auditReason = editReason.trim() 
                ? editReason.trim() 
                : `Admin adjusted order quantities: ${changesList.join(", ")}`;

            const updatePayload: Record<string, any> = {
                items: updatedItems,
                subtotal: calculatedFinancials.subtotal,
                tax_amount: calculatedFinancials.taxAmount,
                total_amount: calculatedFinancials.totalAmount,
                force_updated_by: adminId,
                force_updated_at: now,
                force_reason: auditReason,
                admin_approval: "Pending", // Stays pending until explicitly approved
                updated_at: now,
            };

            const { data, error } = await supabase
                .from("purchase_orders")
                .update(updatePayload)
                .eq("id", po.id)
                .select()
                .single();

            if (error) throw error;

            // Notify Purchase Officer of quantity adjustments
            try {
                await createNotification({
                    title: "PO Quantity Adjusted by Admin",
                    message: `Admin ${adminName} adjusted line quantities on PO #${po.po_number} (${changesList.join(", ")}). New Total: ₱${calculatedFinancials.totalAmount.toLocaleString()}. PO remains pending review.`,
                    type: "purchase_order_qty_changed",
                    role: ["Purchase Officer", "Procurement Officer"],
                    poRequestId: po.id,
                    link: `/purchase-orders?poNumber=${po.po_number}`,
                    creatorName: user.getName() || "Admin",
                    creatorEmail: user.getEmail() || "admin@airship.express",
                });
            } catch (notifErr) {
                console.warn("Could not dispatch quantity change notification:", notifErr);
            }

            toast.success(`Quantities updated for PO #${po.po_number}. Affected line totals & taxes recalculated.`);
            const updatedPO = data || { ...po, ...updatePayload };
            setPo(updatedPO);
            setIsEditingQty(false);
            onPOUpdated?.(updatedPO);
        } catch (err: any) {
            console.error("Error saving updated PO quantities:", err);
            toast.error(err?.message || "Failed to save adjusted quantities.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Portal>
            <div 
                className="fixed inset-0 z-[10000] grid place-items-center p-3 sm:p-5 bg-slate-950/70 dark:bg-black/85 backdrop-blur-md overflow-hidden animate-in fade-in duration-200"
                onClick={onClose}
            >
                <div 
                    className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-[#f0f3f8] dark:bg-[#141624] rounded-3xl border border-slate-200 dark:border-white/[0.08] shadow-none overflow-hidden my-auto animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="shrink-0 flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.06] px-6 py-4 bg-[#f0f3f8] dark:bg-[#141624]">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_2px_2px_6px_rgba(79,70,229,0.35)] shrink-0">
                                <FileText className="w-5 h-5 text-indigo-100" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                                        Purchase Order Review &amp; Admin Approval
                                    </h3>
                                    {po?.po_number && (
                                        <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800/40">
                                            #{po.po_number}
                                        </span>
                                    )}
                                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                                        po?.admin_approval === "Approved"
                                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/50"
                                            : po?.admin_approval === "Rejected"
                                            ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800/50"
                                            : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800/50"
                                    }`}>
                                        Admin: {po?.admin_approval || "Pending"}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Inspect line items, verify related department requests, and approve, reject, or adjust quantities.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-xl bg-[#ebf0f7] dark:bg-[#1a1c2c] border border-white/80 dark:border-white/[0.08] shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)] dark:shadow-[-1px_-1px_3px_rgba(255,255,255,0.02),_2px_2px_4px_rgba(0,0,0,0.5)] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Scrollable Content Grid */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs font-bold text-slate-500">Loading purchase order data...</span>
                            </div>
                        ) : !po ? (
                            <div className="p-8 text-center text-slate-400">
                                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                                <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Purchase Order Not Found</p>
                                <p className="text-xs mt-1">Unable to locate the specified purchase order in the database.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                {/* Left Main Section: PO Details & Line Items (8 Cols) */}
                                <div className="lg:col-span-8 space-y-5">
                                    {/* Summary Card */}
                                    <div className="p-4.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/[0.06] shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.5)] space-y-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 dark:border-white/[0.06] pb-3">
                                            <div className="flex items-center gap-2">
                                                <Store className="w-4 h-4 text-pink-500" />
                                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Selected Supplier:</span>
                                                <span className="text-sm font-black text-slate-900 dark:text-white">
                                                    {po.supplier_name || "Supplier on File"}
                                                </span>
                                            </div>
                                            {po.suppliers_qoutation_bid && (
                                                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/40">
                                                    Awarded Quotation #{po.suppliers_qoutation_bid}
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                            <div>
                                                <span className="text-[10px] text-slate-400 uppercase font-bold block">Status</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-200">{po.status || "Pending"}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-400 uppercase font-bold block">Category</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-200">{po.category || "General"}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-400 uppercase font-bold block">Payment Terms</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-200">{po.payment_terms || "Net 30"}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-400 uppercase font-bold block">Delivery Turnaround</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-200">{po.delivery_date ? new Date(po.delivery_date).toLocaleDateString() : "Standard 7-day"}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Line Items Table with Admin Quantity Editing */}
                                    <div className="p-4.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/[0.06] shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.5)] space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Package className="w-4 h-4 text-indigo-500" />
                                                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                                    Purchased Line Items
                                                </h4>
                                            </div>

                                            {po.admin_approval !== "Approved" && (
                                                <div className="flex items-center gap-2">
                                                    {isEditingQty ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setIsEditingQty(false);
                                                                    // Reset editQuantities to po values
                                                                    const resetMap: Record<number, number> = {};
                                                                    if (Array.isArray(po.items)) {
                                                                        po.items.forEach((it: any, idx: number) => {
                                                                            resetMap[idx] = Number(it.quantity_ordered ?? it.quantity ?? 1);
                                                                        });
                                                                    }
                                                                    setEditQuantities(resetMap);
                                                                }}
                                                                className="px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={handleSaveQuantity}
                                                                disabled={isSubmitting}
                                                                className="px-3 py-1 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                                            >
                                                                <Save className="w-3 h-3" />
                                                                <span>Save Quantities</span>
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsEditingQty(true)}
                                                            className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 rounded-lg border border-indigo-200 dark:border-indigo-800/40 flex items-center gap-1 cursor-pointer transition-colors"
                                                            title="Admin may adjust line quantity only"
                                                        >
                                                            <Edit3 className="w-3 h-3" />
                                                            <span>Edit Quantity Only</span>
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {isEditingQty && (
                                            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                                                <div className="flex items-center gap-1.5 font-bold">
                                                    <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                                    <span>Quantity Adjustment Rule</span>
                                                </div>
                                                <p className="text-[11px] leading-relaxed">
                                                    You may edit the ordered quantity. Supplier, item specification, and unit price remain locked. Line totals and applicable VAT/taxes will be automatically recalculated.
                                                </p>
                                                <input
                                                    type="text"
                                                    placeholder="Optional: Audit reason for quantity adjustment..."
                                                    value={editReason}
                                                    onChange={(e) => setEditReason(e.target.value)}
                                                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#14151e] border border-amber-300 dark:border-amber-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                />
                                            </div>
                                        )}

                                        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-white/[0.06] bg-[#ebf0f7] dark:bg-[#13141c]">
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead>
                                                    <tr className="border-b border-slate-200/80 dark:border-white/[0.06] bg-white/40 dark:bg-white/[0.02] text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">
                                                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                                                        <th className="py-2.5 px-3">Item Description</th>
                                                        <th className="py-2.5 px-3 text-center w-28">Quantity</th>
                                                        <th className="py-2.5 px-3 text-right w-24">Unit Price</th>
                                                        <th className="py-2.5 px-3 text-right w-28">Line Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.04]">
                                                    {Array.isArray(po.items) && po.items.length > 0 ? (
                                                        po.items.map((it: any, idx: number) => {
                                                            const currentQty = editQuantities[idx] !== undefined ? editQuantities[idx] : Number(it.quantity_ordered ?? it.quantity ?? 1);
                                                            const unitPrice = Number(it.unit_price ?? it.price ?? 0);
                                                            const lineTotal = currentQty * unitPrice;

                                                            return (
                                                                <tr key={idx} className="hover:bg-white/30 dark:hover:bg-white/[0.01]">
                                                                    <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-xs">
                                                                        {idx + 1}
                                                                    </td>
                                                                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                                                                        {it.item_name || it.name || "Purchased Item"}
                                                                        {it.unit && (
                                                                            <span className="text-[10px] font-normal text-slate-400 ml-1">
                                                                                ({it.unit})
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-center">
                                                                        {isEditingQty ? (
                                                                            <input
                                                                                type="number"
                                                                                min={1}
                                                                                value={currentQty}
                                                                                onChange={(e) => {
                                                                                    const val = parseInt(e.target.value, 10);
                                                                                    setEditQuantities({
                                                                                        ...editQuantities,
                                                                                        [idx]: isNaN(val) ? 1 : val,
                                                                                    });
                                                                                }}
                                                                                className="w-20 px-2 py-1 text-center font-mono text-xs font-bold rounded-lg bg-white dark:bg-[#1a1b26] border border-indigo-300 dark:border-indigo-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
                                                                            />
                                                                        ) : (
                                                                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-white/80 dark:bg-[#1c1e2b] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800">
                                                                                {currentQty}
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                                                                        ₱{unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                                                        ₱{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    ) : (
                                                        <tr>
                                                            <td colSpan={5} className="py-4 text-center text-slate-400">
                                                                No line items specified.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                                <tfoot>
                                                    <tr className="border-t border-slate-200 dark:border-white/[0.06] bg-white/20 dark:bg-white/[0.01]">
                                                        <td colSpan={3} className="py-2 px-3 text-xs text-slate-500">Subtotal</td>
                                                        <td colSpan={2} className="py-2 px-3 text-right font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                                                            ₱{calculatedFinancials.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                    {calculatedFinancials.discount > 0 && (
                                                        <tr className="border-t border-slate-200/50 dark:border-white/[0.03]">
                                                            <td colSpan={3} className="py-1.5 px-3 text-xs text-emerald-600 dark:text-emerald-400">Discount</td>
                                                            <td colSpan={2} className="py-1.5 px-3 text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                                                -₱{calculatedFinancials.discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>
                                                    )}
                                                    {calculatedFinancials.shippingFee > 0 && (
                                                        <tr className="border-t border-slate-200/50 dark:border-white/[0.03]">
                                                            <td colSpan={3} className="py-1.5 px-3 text-xs text-slate-500">Shipping Fee</td>
                                                            <td colSpan={2} className="py-1.5 px-3 text-right font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                                                                +₱{calculatedFinancials.shippingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>
                                                    )}
                                                    <tr className="border-t border-slate-200/50 dark:border-white/[0.03]">
                                                        <td colSpan={3} className="py-1.5 px-3 text-xs text-slate-500">VAT ({calculatedFinancials.taxRate}%)</td>
                                                        <td colSpan={2} className="py-1.5 px-3 text-right font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                                                            +₱{calculatedFinancials.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                    <tr className="border-t-2 border-slate-300 dark:border-white/[0.1] bg-white/50 dark:bg-white/[0.02]">
                                                        <td colSpan={3} className="py-2.5 px-3 text-xs font-black text-slate-900 dark:text-white uppercase">
                                                            Final Total Order Value
                                                        </td>
                                                        <td colSpan={2} className="py-2.5 px-3 text-right font-mono text-base font-black text-indigo-600 dark:text-indigo-400">
                                                            ₱{calculatedFinancials.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Audit & Force Updates Info if present */}
                                    {po.force_updated_at && (
                                        <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-bold">Prior Admin Quantity Adjustment:</span>
                                                <p className="mt-0.5">{po.force_reason || "Quantities modified by Admin on " + new Date(po.force_updated_at).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Rejection input box */}
                                    {isRejecting && (
                                        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                                                    <XCircle className="w-4 h-4 text-rose-600" />
                                                    State Reason for Rejection
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsRejecting(false)}
                                                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                            <textarea
                                                rows={2}
                                                placeholder="Provide detailed reason for rejecting this purchase order (sent to Purchase Officer)..."
                                                value={rejectionReason}
                                                onChange={(e) => setRejectionReason(e.target.value)}
                                                className="w-full p-2.5 text-xs rounded-xl bg-white dark:bg-[#13141c] border border-rose-300 dark:border-rose-800 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
                                            />
                                            <div className="flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={handleReject}
                                                    disabled={isSubmitting || !rejectionReason.trim()}
                                                    className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                                                >
                                                    Confirm Rejection
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right Side Panel: Related Purchase Requests Matching Normalized Item (4 Cols) */}
                                <div className="lg:col-span-4 space-y-4">
                                    <div className="p-4.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/[0.06] shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.5)] space-y-3">
                                        <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.06] pb-2.5">
                                            <div className="flex items-center gap-1.5">
                                                <Layers className="w-4 h-4 text-pink-500" />
                                                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                                    Matching Requisitions
                                                </h4>
                                            </div>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                                {matchingRequests.length} found
                                            </span>
                                        </div>

                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                            Requisitions from departments matching this PO item (including plurals, related items &amp; typos like LAPTOP, Laptops, Lptops):
                                        </p>

                                        {isLoadingMatchingRequests ? (
                                            <div className="py-8 text-center text-xs text-slate-400">
                                                Checking related requests...
                                            </div>
                                        ) : matchingRequests.length === 0 ? (
                                            <div className="py-6 text-center text-xs text-slate-400 space-y-1">
                                                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto opacity-70" />
                                                <p className="font-bold text-slate-700 dark:text-slate-300">No Other Requests</p>
                                                <p className="text-[10px]">No pending or approved requests share this item name.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                                                {matchingRequests.map((req: any) => {
                                                    const isPending = String(req.status || "").toLowerCase() === "pending";
                                                    const isApproved = String(req.status || "").toLowerCase() === "approved";
                                                    const isCurrentLinked = req.id === po.request_id || Boolean(po.notes && req.request_number && po.notes.includes(req.request_number));

                                                    let reqItemsList = req.items;
                                                    if (typeof reqItemsList === "string") {
                                                        try { reqItemsList = JSON.parse(reqItemsList); } catch { reqItemsList = []; }
                                                    }
                                                    const matchedChildItem = Array.isArray(reqItemsList)
                                                        ? reqItemsList.find((it: any) => {
                                                            const itName = it.item_name || it.name;
                                                            return itName && poItemNamesList.some((poItem: string) => isItemRelated(poItem, itName));
                                                        })
                                                        : null;

                                                    const displayItemName = req.item_name || matchedChildItem?.item_name || matchedChildItem?.name || (Array.isArray(reqItemsList) && (reqItemsList[0]?.item_name || reqItemsList[0]?.name)) || "Requisition Item";
                                                    const displayQty = matchedChildItem?.quantity ?? req.quantity ?? (Array.isArray(reqItemsList) && reqItemsList[0]?.quantity) ?? 1;
                                                    const displayUnit = matchedChildItem?.unit || req.unit || (Array.isArray(reqItemsList) && reqItemsList[0]?.unit) || "units";

                                                    return (
                                                        <div 
                                                            key={req.id}
                                                            className={`p-3 rounded-xl border transition-all text-xs space-y-1.5 ${
                                                                isCurrentLinked
                                                                    ? "bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/40"
                                                                    : "bg-white/60 dark:bg-[#12131d] border-slate-200/70 dark:border-white/[0.04]"
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-mono font-bold text-indigo-700 dark:text-indigo-400">
                                                                    #{req.request_number || String(req.id).slice(0, 8)}
                                                                </span>
                                                                <div className="flex items-center gap-1">
                                                                    {isCurrentLinked && (
                                                                        <span className="text-[9px] font-black uppercase text-indigo-600 px-1.5 py-0.2 rounded-md bg-indigo-100 dark:bg-indigo-900/50">
                                                                            Linked
                                                                        </span>
                                                                    )}
                                                                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md uppercase ${
                                                                        isApproved
                                                                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                                                                            : isPending
                                                                            ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400"
                                                                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                                                    }`}>
                                                                        {req.status || "Pending"}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate" title={displayItemName}>
                                                                {displayItemName}
                                                            </div>

                                                            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                                                                <span className="flex items-center gap-1">
                                                                    <Building2 className="w-2.5 h-2.5" />
                                                                    {req.department || "General"}
                                                                </span>
                                                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                                                    Qty: {displayQty} {displayUnit}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions Toolbar (Admin Actions: Approve, Reject, Cancel) */}
                    <div className="shrink-0 flex items-center justify-between border-t border-slate-200/80 dark:border-white/[0.06] p-4 bg-[#f0f3f8] dark:bg-[#141624]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer"
                        >
                            Close
                        </button>

                        {po && po.admin_approval !== "Approved" && !isEditingQty && !isRejecting && (
                            <div className="flex items-center gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setIsRejecting(true)}
                                    disabled={isSubmitting}
                                    className="px-4 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl border border-rose-300 dark:border-rose-800/50 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>Reject Order</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleApprove}
                                    disabled={isSubmitting}
                                    className="px-5 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-[0_2px_8px_rgba(16,185,129,0.35)] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
                                >
                                    {isSubmitting ? (
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                                    )}
                                    <span>Approve Purchase Order</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Portal>
    );
}

export default AdminPurchaseOrderReviewModal;

