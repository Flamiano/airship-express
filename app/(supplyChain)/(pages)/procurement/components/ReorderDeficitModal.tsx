"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
    RotateCw, 
    X, 
    Building2, 
    Package, 
    AlertTriangle, 
    FileText, 
    Calendar, 
    MapPin, 
    DollarSign, 
    Layers, 
    Send, 
    ShieldAlert, 
    Store, 
    Phone, 
    Mail, 
    CheckCircle2, 
    Info, 
    Sparkles,
    Lock
} from "lucide-react";
import { toast } from "sonner";
import Portal from "../../../components/client/Portal";
import { supabase } from "../../../lib/services/client/supabase";
import { user } from "../../../lib/services/Class/user";
import { createNotification } from "../../../lib/services/notifications";
import { toSingularForm, normalizeItemName } from "../../../lib/utils";
import type { StockShortageItem, Supplier } from "../types/index";

export interface ReorderDeficitModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: StockShortageItem | null;
    supplierName?: string | null;
    supplierId?: number | string | null;
    quotation?: any | null;
    registeredSuppliers?: Supplier[];
    onOrderCreated?: (newPo: any) => void;
}

export function ReorderDeficitModal({
    isOpen,
    onClose,
    item,
    supplierName: initialSupplierName,
    supplierId: initialSupplierId,
    quotation,
    registeredSuppliers = [],
    onOrderCreated,
}: ReorderDeficitModalProps) {
    if (!isOpen || !item) return null;

    // Derived deficits and demand numbers
    const totalDemand = Number(
        item.total_approved_demand ?? 
        (item as any).approved_quantity ?? 
        (item as any).demand_quantity ?? 
        (item as any).quantity ?? 
        0
    );
    const usableStock = Number(
        item.usable_stock ?? 
        (item as any).usable_warehouse_stock ?? 
        item.current_stock ?? 
        (item as any).stock_quantity ?? 
        0
    );
    const isPoDelivered =
        item.po_status_indicator === 'Delivered' ||
        (item.covering_purchase_orders && item.covering_purchase_orders.length > 0 && item.covering_purchase_orders.every(po => {
            const s = (po.status || "").toLowerCase();
            return s === "delivered" || s === "completed" || s === "received" || s === "fulfilled";
        }));
    const activeCovered = isPoDelivered ? 0 : Number(
        item.active_po_coverage ?? 
        item.covered_quantity ?? 
        0
    );
    const remainingDeficit = Number(
        item.remaining_deficit !== undefined 
            ? item.remaining_deficit 
            : (item.deficit !== undefined ? item.deficit : Math.max(0, totalDemand - usableStock - activeCovered))
    );

    // Initial proposed quantity defaults to remaining deficit
    const initialQty = remainingDeficit > 0 ? remainingDeficit : 1;
    const [quantity, setQuantity] = useState<number>(initialQty);

    // Identify previous PO info
    const previousPO = useMemo(() => {
        if (item.covering_purchase_orders && item.covering_purchase_orders.length > 0) {
            return item.covering_purchase_orders[0];
        }
        return null;
    }, [item.covering_purchase_orders]);

    // Resolve supplier details
    const resolvedSupplierName = useMemo(() => {
        if (initialSupplierName) return initialSupplierName;
        if (quotation?.supplier_name) return quotation.supplier_name;
        if (previousPO?.supplier_name) return previousPO.supplier_name;
        if (item.previous_supplier) return item.previous_supplier;
        if ((item as any).supplier_name) return (item as any).supplier_name;
        return "Supplier Partner";
    }, [initialSupplierName, quotation, previousPO, item]);

    const resolvedSupplier = useMemo(() => {
        return registeredSuppliers.find(s => 
            (initialSupplierId && String(s.id) === String(initialSupplierId)) ||
            (s.name && s.name.toLowerCase() === resolvedSupplierName.toLowerCase())
        ) || null;
    }, [registeredSuppliers, initialSupplierId, resolvedSupplierName]);

    // Initial price resolution (from quotation, previous PO, or item purchase price)
    const initialUnitPrice = useMemo(() => {
        if (quotation && quotation.unit_price) return Number(quotation.unit_price);
        if (previousPO && Array.isArray((previousPO as any).items) && (previousPO as any).items[0]?.unit_price) {
            return Number((previousPO as any).items[0].unit_price);
        }
        if (item.purchase_price) return Number(item.purchase_price);
        if (item.previous_unit_price) return Number(item.previous_unit_price);
        return 0;
    }, [quotation, previousPO, item]);

    const [unitPrice, setUnitPrice] = useState<number>(initialUnitPrice);
    const [discount, setDiscount] = useState<number>(0);
    const [shippingFee, setShippingFee] = useState<number>(0);
    const [taxRate, setTaxRate] = useState<number>(12); // standard 12% VAT in PH
    const [deliveryDate, setDeliveryDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        return d.toISOString().split("T")[0];
    });
    const [deliveryLocation, setDeliveryLocation] = useState<string>(
        "352 Escolta St, Binondo, Manila, 1006 Metro Manila (Airship Express Central Warehouse)"
    );
    const [paymentTerms, setPaymentTerms] = useState<string>(
        (resolvedSupplier as any)?.payment_terms || "Net 30 Days (Standard B2B)"
    );

    // Notes prefilled with deficit replenishment reasoning
    const [notes, setNotes] = useState<string>(() => {
        const reqStr = item.source_request ? ` Requisition ${item.source_request}.` : "";
        const prevPoStr = previousPO?.po_number ? ` Ref Previous PO: #${previousPO.po_number}.` : "";
        return `Reorder for remaining inventory deficit of ${initialQty} ${item.unit || "units"} of ${item.item_name}.${reqStr}${prevPoStr} Approved vendor replenishment directly routed to Admin review.`;
    });

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [allowOverorder, setAllowOverorder] = useState<boolean>(false);

    // Reset when modal opens for a new item
    useEffect(() => {
        const q = remainingDeficit > 0 ? remainingDeficit : 1;
        setQuantity(q);
        setUnitPrice(initialUnitPrice);
        setDiscount(0);
        setShippingFee(0);
        const reqStr = item.source_request ? ` Requisition ${item.source_request}.` : "";
        const prevPoStr = previousPO?.po_number ? ` Ref Previous PO: #${previousPO.po_number}.` : "";
        setNotes(`Reorder for remaining inventory deficit of ${q} ${item.unit || "units"} of ${item.item_name}.${reqStr}${prevPoStr} Approved vendor replenishment directly routed to Admin review.`);
    }, [item, initialUnitPrice, remainingDeficit, previousPO]);

    // Financial calculations
    const subtotal = useMemo(() => {
        return Number((Math.max(0, quantity) * Math.max(0, unitPrice)).toFixed(2));
    }, [quantity, unitPrice]);

    const taxableAmount = useMemo(() => {
        return Math.max(0, subtotal - discount);
    }, [subtotal, discount]);

    const taxAmount = useMemo(() => {
        return Number(((taxableAmount * taxRate) / 100).toFixed(2));
    }, [taxableAmount, taxRate]);

    const totalAmount = useMemo(() => {
        return Number((taxableAmount + taxAmount + shippingFee).toFixed(2));
    }, [taxableAmount, taxAmount, shippingFee]);

    const isOverordering = remainingDeficit > 0 && quantity > remainingDeficit;

    const handleSubmitReorder = async (e: React.FormEvent) => {
        e.preventDefault();

        if (quantity <= 0) {
            toast.error("Reorder quantity must be at least 1 unit.");
            return;
        }

        if (isOverordering && !allowOverorder) {
            toast.warning(`Quantity exceeds remaining deficit of ${remainingDeficit} units. Please confirm over-ordering before submitting.`);
            return;
        }

        if (!deliveryDate) {
            toast.error("Please specify an expected delivery date.");
            return;
        }

        setIsSubmitting(true);
        const toastId = toast.loading("Generating Reorder Purchase Order & notifying Admin...");

        try {
            // Generate a fresh unique PO number and new UUID
            const randomCode = Math.floor(100000 + Math.random() * 900000);
            const batchNum = Math.floor(100 + Math.random() * 900);
            const newPoNumber = `PO-DRAFT-${randomCode}-${batchNum}`;
            const newPoId = crypto.randomUUID();

            const sanitizedItemName = item.item_name || "Catalog Inventory Item";
            const sanitizedUnit = item.unit || "pcs";

            const poLineItems = [
                {
                    name: sanitizedItemName,
                    item_name: sanitizedItemName,
                    quantity: quantity,
                    unit: sanitizedUnit,
                    unit_price: unitPrice,
                    total: subtotal,
                    category: item.category || "General Procurement",
                }
            ];

            const supplierIdNum = initialSupplierId ? Number(initialSupplierId) : (resolvedSupplier?.id ? Number(resolvedSupplier.id) : null);
            const quoteBidId = quotation?.id ? Number(quotation.id) : null;

            // Structured commercial terms
            const structuredTerms = `Payment=${paymentTerms} | Delivery=${deliveryLocation} | Deficit Reorder for ${item.item_name}`;

            const isValidUuid = (val: any) => typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val?.trim() || "");

            // Fetch authenticated user UUID for created_by foreign key
            let currentUserId: string | null = null;
            try {
                const { data: authData } = await supabase.auth.getUser();
                if (authData?.user?.id && isValidUuid(authData.user.id)) {
                    currentUserId = authData.user.id;
                } else {
                    const { data: sessionData } = await supabase.auth.getSession();
                    if (sessionData?.session?.user?.id && isValidUuid(sessionData.session.user.id)) {
                        currentUserId = sessionData.session.user.id;
                    }
                }
            } catch (authErr) {
                console.warn("Could not retrieve auth user for PO creation:", authErr);
            }

            const rawReqId = (item as any).source_request_id || (item as any).requestId;
            const targetRequestId = isValidUuid(rawReqId) ? String(rawReqId).trim() : null;

            const insertPayload: any = {
                id: newPoId,
                po_number: newPoNumber,
                request_id: targetRequestId,
                supplier_id: supplierIdNum,
                supplier_name: resolvedSupplierName,
                suppliers_qoutation_bid: quoteBidId,
                category: item.category || "General Procurement",
                subtotal: subtotal,
                discount: discount,
                shipping_fee: shippingFee,
                tax_rate: taxRate,
                tax_amount: taxAmount,
                total_amount: totalAmount,
                status: "Pending", // Kept as Pending awaiting Admin Review
                delivery_date: deliveryDate,
                delivery_location: deliveryLocation,
                payment_terms: paymentTerms,
                terms_and_conditions: `1. Official BIR Sales Invoice & Delivery Receipt required upon arrival.\n2. Goods must strictly match approved technical specifications.\n3. Defective or substandard units replaced within 48 hours without additional charge.\n[${structuredTerms}]`,
                notes: `Reorder created by ${user.getName() || "Store Supervisor"} for deficit replenishment. ${notes.trim()}`.trim(),
                items: poLineItems,
                admin_approval: "Pending",
                financial_approval: "Pending",
                paid: false,
                fully_received: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            if (currentUserId) {
                insertPayload.created_by = currentUserId;
            }

            const { data: createdPO, error: poError } = await supabase
                .from("purchase_orders")
                .insert(insertPayload)
                .select()
                .single();

            if (poError) {
                console.error("Failed to insert reorder PO:", poError);
                throw new Error(poError.message || "Failed to save purchase order to database.");
            }

            // Dispatch in-app notification to Admin & Executive for review
            try {
                const notifTitle = `Reorder PO Created: #${newPoNumber}`;
                const notifMsg = `Reorder Purchase Order #${newPoNumber} for ${resolvedSupplierName} (${quantity} ${sanitizedUnit} of ${sanitizedItemName} - ₱${totalAmount.toLocaleString()}) submitted for deficit replenishment. Pending Admin review & approval.`;
                const notifLink = `/purchase-orders?poNumber=${encodeURIComponent(newPoNumber)}`;

                await createNotification({
                    creatorName: user.getName() || "Purchase Officer",
                    creatorEmail: user.getEmail() || "procurement@airshipexpress.ph",
                    title: notifTitle,
                    message: notifMsg,
                    type: "purchase_order",
                    link: notifLink,
                    role: ["Admin", "Executive"],
                    poRequestId: newPoId,
                });
            } catch (notifErr) {
                console.warn("Notice: Could not send Admin notification for reorder PO:", notifErr);
            }

            toast.success(`Reorder PO #${newPoNumber} created & submitted to Admin for review!`, { id: toastId });
            onOrderCreated?.(createdPO || insertPayload);
            onClose();
        } catch (err: any) {
            console.error("Error creating reorder purchase order:", err);
            toast.error(err.message || "Failed to submit reorder PO. Please try again.", { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Portal>
            <div 
                className="fixed inset-0 bg-slate-950/70 dark:bg-black/85 backdrop-blur-md flex items-center justify-center z-[99999] p-3 sm:p-5 animate-in fade-in duration-200"
                onClick={onClose}
            >
                <div 
                    className="bg-[#f0f3f8] dark:bg-[#141522] rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col border border-slate-300 dark:border-white/[0.08] overflow-hidden animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-6 py-4.5 border-b border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-[#12131d]/70">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                                <RotateCw className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                        Reorder Inventory Deficit
                                    </h2>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-mono border border-blue-200/50 dark:border-blue-800/40">
                                        New Purchase Order
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Order additional quantity directly from established supplier without repeating discovery.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 cursor-pointer transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <form onSubmit={handleSubmitReorder} className="overflow-y-auto p-6 space-y-5 text-xs">
                        {/* 1. Demand & Deficit Overview Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="p-3 rounded-2xl bg-white dark:bg-[#181926] border border-slate-200/70 dark:border-white/[0.05]">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Approved Demand</span>
                                <span className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100 font-mono mt-0.5 block">
                                    {totalDemand} <span className="text-[10px] font-normal text-slate-400">{item.unit || "units"}</span>
                                </span>
                            </div>

                            <div className="p-3 rounded-2xl bg-white dark:bg-[#181926] border border-slate-200/70 dark:border-white/[0.05]">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Usable Stock</span>
                                <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
                                    {usableStock} <span className="text-[10px] font-normal text-slate-400">{item.unit || "units"}</span>
                                </span>
                            </div>

                            <div className="p-3 rounded-2xl bg-white dark:bg-[#181926] border border-slate-200/70 dark:border-white/[0.05]">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active PO Coverage</span>
                                <span className="text-sm sm:text-base font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5 block">
                                    {activeCovered} <span className="text-[10px] font-normal text-slate-400">{item.unit || "units"}</span>
                                </span>
                            </div>

                            <div className="p-3 rounded-2xl bg-pink-50 dark:bg-pink-950/30 border border-pink-200/80 dark:border-pink-800/40">
                                <span className="text-[10px] font-bold text-pink-600 dark:text-pink-400 uppercase tracking-wider block">Remaining Deficit</span>
                                <span className="text-sm sm:text-base font-black text-pink-600 dark:text-pink-400 font-mono mt-0.5 block">
                                    {remainingDeficit} <span className="text-[10px] font-normal text-pink-500/70">{item.unit || "units"}</span>
                                </span>
                            </div>
                        </div>

                        {/* 2. Item & Supplier Reference Card */}
                        <div className="p-4 rounded-2xl bg-white/80 dark:bg-[#181926] border border-slate-200/80 dark:border-white/[0.06] space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-white/[0.05] pb-2.5">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Replenishment Item</span>
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                                        <Package className="w-4 h-4 text-pink-500" />
                                        <span>{item.item_name}</span>
                                        <span className="text-[10px] font-normal text-slate-400">({toSingularForm(item.item_name)})</span>
                                    </h3>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Category</span>
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        {item.category || "General Procurement"}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                                        <Store className="w-3 h-3 text-blue-500" />
                                        <span>Target Supplier</span>
                                    </span>
                                    <p className="font-bold text-slate-800 dark:text-slate-100 text-xs">
                                        {resolvedSupplierName}
                                    </p>
                                    {resolvedSupplier && (
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                            {resolvedSupplier.contact_person && `Contact: ${resolvedSupplier.contact_person} • `}
                                            {resolvedSupplier.phone || resolvedSupplier.email || resolvedSupplier.location}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-1 sm:border-l sm:border-slate-100 sm:dark:border-white/[0.05] sm:pl-3">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                                        <FileText className="w-3 h-3 text-indigo-500" />
                                        <span>Previous PO Reference</span>
                                    </span>
                                    {previousPO ? (
                                        <div>
                                            <p className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                                                #{previousPO.po_number}
                                                <span className="ml-1.5 text-[9px] px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-normal">
                                                    {previousPO.status || "Completed"}
                                                </span>
                                            </p>
                                            <p className="text-[10px] text-slate-400">
                                                Covered {previousPO.quantity || (Array.isArray((previousPO as any).items) && (previousPO as any).items[0]?.quantity) || "N/A"} units
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="text-[10px] text-slate-400 italic">No previous covering PO record attached</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 3. Reorder Parameters & Quantity Input */}
                        <div className="p-4 rounded-2xl bg-white dark:bg-[#181926] border border-slate-200/80 dark:border-white/[0.06] space-y-4">
                            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                                <span>Reorder Quantity &amp; Pricing</span>
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Reorder Quantity ({item.unit || "units"}) *
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={quantity}
                                        onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                                        className="w-full px-3 py-2 rounded-xl bg-[#f0f3f8] dark:bg-[#12131d] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                        required
                                    />
                                    <span className="text-[10px] text-slate-400 mt-1 block">
                                        Current remaining deficit: <strong className="text-pink-600">{remainingDeficit}</strong>
                                    </span>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                                        <span>Unit Price (₱) *</span>
                                        <span className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                                            <Lock className="w-2.5 h-2.5 text-slate-400" />
                                            <span>Fixed</span>
                                        </span>
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={unitPrice}
                                        readOnly
                                        disabled
                                        tabIndex={-1}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-100/90 dark:bg-[#12131d]/60 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold font-mono text-sm cursor-not-allowed select-none opacity-85"
                                        required
                                    />
                                    <span className="text-[10px] text-slate-400 mt-1 block">
                                        {quotation ? "Locked from active quotation" : "Established vendor price"}
                                    </span>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Expected Delivery Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={deliveryDate}
                                        onChange={(e) => setDeliveryDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-[#f0f3f8] dark:bg-[#12131d] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Over-ordering warning check */}
                            {isOverordering && (
                                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                    <div className="space-y-1.5">
                                        <p className="font-bold text-xs">Quantity Exceeds Remaining Deficit</p>
                                        <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
                                            The requested quantity ({quantity} {item.unit || "units"}) exceeds the calculated deficit ({remainingDeficit} {item.unit || "units"}). The extra {quantity - remainingDeficit} units will be stocked into warehouse inventory.
                                        </p>
                                        <label className="flex items-center gap-2 cursor-pointer font-bold text-[11px] text-amber-900 dark:text-amber-200 pt-1">
                                            <input
                                                type="checkbox"
                                                checked={allowOverorder}
                                                onChange={(e) => setAllowOverorder(e.target.checked)}
                                                className="rounded text-blue-600 focus:ring-blue-500"
                                            />
                                            <span>I confirm over-ordering for buffer safety stock</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* Commercial Terms & Notes */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                                        <span>Payment Terms</span>
                                        <span className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                                            <Lock className="w-2.5 h-2.5 text-slate-400" />
                                            <span>Fixed</span>
                                        </span>
                                    </label>
                                    <input
                                        type="text"
                                        value={paymentTerms}
                                        readOnly
                                        disabled
                                        tabIndex={-1}
                                        className="w-full px-3 py-1.5 rounded-xl bg-slate-100/90 dark:bg-[#12131d]/60 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs cursor-not-allowed select-none opacity-85"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Delivery Location
                                    </label>
                                    <input
                                        type="text"
                                        value={deliveryLocation}
                                        onChange={(e) => setDeliveryLocation(e.target.value)}
                                        className="w-full px-3 py-1.5 rounded-xl bg-[#f0f3f8] dark:bg-[#12131d] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs truncate"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Reorder Notes for Admin &amp; Supplier *
                                </label>
                                <textarea
                                    rows={2}
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-[#f0f3f8] dark:bg-[#12131d] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                    placeholder="Add reason for deficit reorder or delivery instructions..."
                                    required
                                />
                            </div>
                        </div>

                        {/* 4. Financial Calculation Summary Table */}
                        <div className="p-4 rounded-2xl bg-slate-100/80 dark:bg-[#10121a] border border-slate-200/80 dark:border-white/[0.06] space-y-2">
                            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                <span>Line Subtotal ({quantity} × ₱{unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                    ₱{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>

                            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                <span>Discount</span>
                                <span className="font-mono text-slate-700 dark:text-slate-300">
                                    - ₱{discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>

                            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                <span>VAT ({taxRate}%)</span>
                                <span className="font-mono text-slate-700 dark:text-slate-300">
                                    + ₱{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>

                            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                <span>Shipping &amp; Delivery Fee</span>
                                <span className="font-mono text-slate-700 dark:text-slate-300">
                                    + ₱{shippingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>

                            <div className="border-t border-slate-200 dark:border-white/[0.08] pt-2 flex items-center justify-between font-black text-sm text-slate-900 dark:text-white">
                                <span className="text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Total Purchase Order Amount:</span>
                                <span className="text-base font-mono text-blue-600 dark:text-blue-400">
                                    ₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>

                        {/* Footer Action Buttons */}
                        <div className="flex items-center justify-between pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800 font-bold transition-all cursor-pointer text-xs"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={isSubmitting || (isOverordering && !allowOverorder)}
                                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                            >
                                {isSubmitting ? (
                                    <>
                                        <RotateCw className="w-4 h-4 animate-spin" />
                                        <span>Submitting to Admin...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        <span>Submit Reorder PO to Admin</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Portal>
    );
}

export default ReorderDeficitModal;
