// app/(supplyChain)/(pages)/suppliers/components/tables/PotentialSuppliersTab.tsx
"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { AppButton } from "../../../../components/ui/AppButton";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { 
    Building2, 
    Search, 
    Filter, 
    Compass, 
    MapPin, 
    Phone, 
    Mail, 
    Globe, 
    ExternalLink, 
    CheckCircle2, 
    ChevronDown, 
    ChevronUp, 
    Layers, 
    Boxes, 
    User, 
    Calendar, 
    Clock, 
    Sparkles, 
    Store, 
    Check, 
    RefreshCw, 
    AlertCircle, 
    ArrowUpRight,
    FileText,
    Tag,
    X,
    Eye,
    PlusCircle,
    Trash2,
    Send,
    PhoneCall,
    SlidersHorizontal,
    Inbox,
    Award,
    Info,
    MailCheck,
    RotateCcw,
    Video
} from "lucide-react";
import { AIRSHIP_HQ, calculateDistanceKm, resolveDestinationCoords } from "../../../inventory/utils/geo-locations";
import { supabase } from "../../../../lib/services/client/supabase";
import { fetchPurchaseRequestsForSourcing, removePotentialSupplierLinkage } from "../../../inventory/server/query";
import Portal from "../../../../components/client/Portal";
import { RequestQuotationsSummary } from "./RequestQuotationsSummary";
import { SupplierReviewModal } from "../modals/SupplierReviewModal";
import { AddPotentialSupplierModal } from "../modals/AddPotentialSupplierModal";
import { VendorQuotationViewModal } from "../modals/VendorQuotationViewModal";
import { SetSupplierMeetingModal } from "../../../procurement/components/SetSupplierMeetingModal";
import { fetchSupplierMeetingsAction, removeSupplierMeetingAction } from "../../../procurement/server/meeting-actions";
import Cards from "../../../../components/global/Cards";

// Dynamic map with SSR disabled
const SupplierSourcingMap = dynamic(
    () => import("../../../inventory/components/modals/SupplierSourcingMap"),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-[400px] rounded-3xl bg-[#0f111a] flex flex-col items-center justify-center p-6 text-white space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-pink-500/20 text-pink-400 flex items-center justify-center animate-pulse">
                    <Compass className="w-6 h-6 animate-spin" />
                </div>
                <p className="text-xs font-bold text-slate-300">Loading Sourcing Map...</p>
            </div>
        ),
    }
);

export interface SupplierQuotationItem {
    id: number;
    supplier_id?: number;
    supplier_name: string;
    contact_person?: string;
    contact_phone?: string;
    contact_email?: string;
    request_number: string;
    item_name: string;
    products?: string;
    quantity: number;
    unit: string;
    unit_price: number;
    subtotal?: number;
    shipping_fee?: number;
    discount?: number;
    tax_type?: string;
    tax_rate?: number;
    tax_amount?: number;
    total_amount: number;
    availability: string;
    lead_time_days: string;
    services_offered?: string[];
    other_products_offer?: any[];
    notes?: string;
    status: string;
    created_at?: string;
}

export interface PotentialSupplierItem {
    id: string;
    dbSupplierId?: number;
    name: string;
    category: string;
    location: string;
    streetAddress?: string;
    city?: string;
    postcode?: string;
    phone?: string;
    email?: string;
    website?: string;
    contact_person?: string;
    products?: string;
    notes?: string;
    coords: {
        lat: number;
        lng: number;
        displayName: string;
    };
    distanceKm: number;
    source: string;
    matchLevel: "exact" | "category" | "possible";
    isSavedInDB?: boolean;
    linkedRequestId?: string;
    services_offered?: string[];
    other_products_offer?: any[];
    submittedQuote?: SupplierQuotationItem | null;
    hasRfqSent?: boolean;
    rfqSentAt?: string;
    scheduledMeeting?: any | null;
}

export interface RequestSupplierGroup {
    groupKey: string;
    requestId: string;
    requestNumber: string;
    itemId?: string;
    itemIndex?: number;
    totalItemsInRequest?: number;
    itemName: string;
    quantityRequested: number;
    unit: string;
    department: string;
    requestedBy: string;
    category: string;
    priority: string;
    status: string;
    purpose?: string;
    createdAt?: string;
    potentialSuppliers: PotentialSupplierItem[];
    quotations?: SupplierQuotationItem[];
}

interface PotentialSuppliersTabProps {
    registeredSuppliers?: any[];
    onSupplierPromoted?: () => void;
    onViewPurchaseOrder?: (order: any) => void;
}

export function PotentialSuppliersTab({
    registeredSuppliers = [],
    onSupplierPromoted,
    onViewPurchaseOrder,
}: PotentialSuppliersTabProps) {
    const [requestGroups, setRequestGroups] = useState<RequestSupplierGroup[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [departmentFilter, setDepartmentFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    
    // Expanded state for accordion groups
    const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set());

    // Selected supplier for map overlay modal
    const [mapSupplier, setMapSupplier] = useState<PotentialSupplierItem | null>(null);

    // Selected supplier & request for RFQ / Price Quotation Email Modal
    const [emailModalData, setEmailModalData] = useState<{
        supplier: PotentialSupplierItem;
        group: RequestSupplierGroup;
    } | null>(null);
    const [customEmailMessage, setCustomEmailMessage] = useState<string>("");
    const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);

    // Award Bid Confirmation Modal State
    const [awardConfirmation, setAwardConfirmation] = useState<{
        supplier: PotentialSupplierItem;
        quote: SupplierQuotationItem;
    } | null>(null);

    // Register Supplier Confirmation Modal State (Supplier Review & Activation)
    const [registerConfirmation, setRegisterConfirmation] = useState<PotentialSupplierItem | null>(null);

    // View-Only Review Vendor Quotation & Files Modal State
    const [viewQuotationModal, setViewQuotationModal] = useState<{
        supplier: PotentialSupplierItem;
        quote?: SupplierQuotationItem | null;
    } | null>(null);

    // Add / Edit Email Modal State
    const [addEmailSupplier, setAddEmailSupplier] = useState<{
        supplier: PotentialSupplierItem;
        group: RequestSupplierGroup;
    } | null>(null);
    const [inputEmail, setInputEmail] = useState<string>("");
    const [isSavingEmail, setIsSavingEmail] = useState<boolean>(false);

    // Schedule Supplier Meeting Modal State
    const [meetingModalData, setMeetingModalData] = useState<{
        supplier: PotentialSupplierItem;
        group?: RequestSupplierGroup;
        quote?: SupplierQuotationItem | null;
        meeting?: any | null;
    } | null>(null);
    const [removingMeetingId, setRemovingMeetingId] = useState<string | null>(null);
    const [meetingsList, setMeetingsList] = useState<any[]>([]);

    // Deleting state
    const [deletingSupplierId, setDeletingSupplierId] = useState<string | null>(null);
    // Promoting state
    const [promotingSupplierId, setPromotingSupplierId] = useState<string | null>(null);
    // Awarding Bid state
    const [awardingQuoteId, setAwardingQuoteId] = useState<number | null>(null);

    // Manually Add Potential Supplier Modal State
    const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState<boolean>(false);
    const [addModalInitialReqId, setAddModalInitialReqId] = useState<string>("");

    // Fetch real potential suppliers and live purchase requests from Supabase
    const loadPotentialSuppliersData = useCallback(async (silent: boolean = false) => {
        if (!silent) setIsLoading(true);
        try {
            // 1. Fetch potential suppliers (is_active = false or notes containing Potential)
            const { data: dbSuppliers, error: supError } = await supabase
                .from("suppliers")
                .select("*")
                .order("created_at", { ascending: false });

            if (supError) {
                console.error("Error fetching suppliers:", supError);
            }

            const potentialList = (dbSuppliers || []).filter(
                (s: any) => s.is_active === false || (s.notes && s.notes.toLowerCase().includes("potential"))
            );

            // 2. Fetch purchase requests directly from DB using server action (bypasses RLS) + client fallback
            const [serverPRs, clientPRRes, invRes] = await Promise.allSettled([
                fetchPurchaseRequestsForSourcing(),
                supabase.from("purchase_requests").select("*").order("created_at", { ascending: false }),
                supabase.from("inventory_requests").select("*").order("created_at", { ascending: false }),
            ]);

            const sPRs = serverPRs.status === "fulfilled" && Array.isArray(serverPRs.value) ? serverPRs.value : [];
            const cPRs = clientPRRes.status === "fulfilled" && clientPRRes.value.data ? clientPRRes.value.data : [];
            const invs = invRes.status === "fulfilled" && invRes.value.data ? invRes.value.data : [];

            // Combine all purchase requests from DB with deduplication
            const prList: any[] = [];
            const seenIds = new Set<string>();

            [...sPRs, ...cPRs].forEach((pr: any) => {
                const idKey = String(pr.id).toLowerCase().trim();
                if (!seenIds.has(idKey)) {
                    seenIds.add(idKey);
                    prList.push(pr);
                }
            });

            invs.forEach((inv: any) => {
                const idKey = String(inv.id).toLowerCase().trim();
                if (!seenIds.has(idKey)) {
                    seenIds.add(idKey);
                    prList.push({
                        id: inv.id,
                        request_number: inv.request_number || `PR-${String(inv.id).slice(0, 8).toUpperCase()}`,
                        description: inv.message || inv.purpose || inv.description || "Warehouse inventory requisition",
                        purpose: inv.purpose || inv.message || "Warehouse inventory requisition",
                        requested_by: inv.requested_by || "EDIZON PRADO",
                        department: inv.department || "Warehouse",
                        priority: inv.priority || "Normal",
                        status: inv.status || "Pending",
                        items: inv.items || (inv.item_name ? [{ name: inv.item_name, quantity: inv.quantity || 1, unit: inv.unit || "pcs", category: inv.category }] : []),
                        created_at: inv.created_at,
                    });
                }
            });

            // 3. Fetch real submitted vendor quotations from supplier_quotations table
            let quotationsList: SupplierQuotationItem[] = [];
            try {
                const { data: quotesData } = await supabase
                    .from("supplier_quotations")
                    .select("*")
                    .order("created_at", { ascending: false });
                if (quotesData) {
                    quotationsList = quotesData;
                }
            } catch (qErr) {
                console.warn("Could not fetch supplier_quotations:", qErr);
            }

            // 3c. Fetch active draft purchase orders to get updated requisition quantities from Sourcing
            let draftPOs: any[] = [];
            try {
                const { data: posData, error: poErr } = await supabase
                    .from("purchase_orders")
                    .select("id, request_id, po_number, status, items, notes, updated_at, created_at")
                    .neq("status", "cancelled")
                    .order("created_at", { ascending: false });
                if (!poErr && posData && Array.isArray(posData)) {
                    draftPOs = posData.filter((po: any) => {
                        const st = String(po.status || "").toLowerCase().trim();
                        return st === "draft";
                    });
                }
            } catch (poErr) {
                console.warn("Could not fetch draft purchase_orders:", poErr);
            }

            // 3b. Fetch real scheduled or pending supplier meetings using server action (bypasses RLS) + client fallback
            let fetchedMeetings: any[] = [];
            try {
                const meetingsRes = await fetchSupplierMeetingsAction();
                if (meetingsRes.success && Array.isArray(meetingsRes.data)) {
                    fetchedMeetings = meetingsRes.data.filter((m: any) => {
                        const st = (m.status || "").toLowerCase().trim();
                        return st === "scheduled" || st === "pending";
                    });
                }
            } catch (mErr) {
                console.warn("Could not fetch supplier_meetings via server action:", mErr);
            }

            // Client-side fallback if server action returned empty
            if (fetchedMeetings.length === 0) {
                try {
                    const { data: cMeetings } = await supabase
                        .from("supplier_meetings")
                        .select("*")
                        .order("meeting_date", { ascending: false });
                    if (cMeetings && Array.isArray(cMeetings)) {
                        fetchedMeetings = cMeetings.filter((m: any) => {
                            const st = (m.status || "").toLowerCase().trim();
                            return st === "scheduled" || st === "pending";
                        });
                    }
                } catch (cErr) {
                    console.warn("Client fallback for supplier_meetings notice:", cErr);
                }
            }
            setMeetingsList(fetchedMeetings);

            // 4. Map potential suppliers with coordinates, calculated distance, and matched quotations
            const mappedSuppliers: PotentialSupplierItem[] = potentialList.map((s: any) => {
                const locCoords = resolveDestinationCoords(s.location || "Binondo, Manila");
                const dist = calculateDistanceKm(AIRSHIP_HQ, locCoords);

                // Extract linked request ID from purchase_request_id column or notes tag
                let linkedReqId = "";
                if ((s as any).purchase_request_id) {
                    linkedReqId = String((s as any).purchase_request_id).trim();
                } else if (s.notes) {
                    const match = s.notes.match(/Request ID:\s*([^\s|]+)/i);
                    if (match && match[1]) {
                        linkedReqId = match[1].trim();
                    }
                }

                // Match submitted quotation for this supplier
                const matchedQuote = quotationsList.find((q) => {
                    const matchesId = (q.supplier_id && Number(q.supplier_id) === Number(s.id)) || (s.id && !isNaN(Number(s.id)) && q.supplier_id && Number(q.supplier_id) === Number(s.id));
                    const qName = (q.supplier_name || "").toLowerCase().trim();
                    const sName = (s.name || "").toLowerCase().trim();
                    const sClean = sName.split(" - ")[0].split(" (")[0].trim();
                    const qClean = qName.split(" - ")[0].split(" (")[0].trim();
                    const matchesName = qName === sName || (sClean && qName.includes(sClean)) || (qClean && sName.includes(qClean));
                    const matchesReq = !linkedReqId || (q.request_number && q.request_number.toLowerCase().includes(linkedReqId.toLowerCase()));
                    return matchesId || (matchesName && matchesReq);
                }) || null;

                // Extract RFQ sent status from notes
                const rfqMatch = s.notes ? s.notes.match(/\[RFQ Sent(?::\s*([^\]|]+))?\]/i) || s.notes.match(/RFQ Sent(?::\s*([^\|]+))?/i) : null;
                const hasRfq = Boolean(rfqMatch);
                const rfqDate = rfqMatch && rfqMatch[1] ? rfqMatch[1].trim() : (hasRfq ? "Sent" : undefined);

                // Match scheduled or pending meeting for this supplier
                const sIdNum = s.id && !isNaN(Number(s.id)) ? Number(s.id) : null;
                const sEmail = (s.email || "").toLowerCase().trim();
                const sName = (s.name || "").toLowerCase().trim();
                const sClean = sName.split(" - ")[0].split(" (")[0].trim();

                const matchedMeeting = fetchedMeetings.find((m) => {
                    const st = (m.status || "").toLowerCase().trim();
                    if (st !== "scheduled" && st !== "pending") return false;

                    const mIdNum = m.supplier_id ? Number(m.supplier_id) : null;
                    const matchesId = Boolean(sIdNum && mIdNum && sIdNum === mIdNum);

                    const mEmail = (m.supplier_email || "").toLowerCase().trim();
                    const matchesEmail = Boolean(sEmail && mEmail && (sEmail === mEmail || sEmail.includes(mEmail) || mEmail.includes(sEmail)));

                    const mName = (m.supplier_name || "").toLowerCase().trim();
                    const mClean = mName.split(" - ")[0].split(" (")[0].trim();
                    const matchesName = Boolean(
                        (sName && mName && (sName === mName || sName.includes(mName) || mName.includes(sName))) ||
                        (sClean && mClean && (sClean === mClean || sClean.includes(mClean) || mClean.includes(sClean)))
                    );

                    return matchesId || matchesEmail || matchesName;
                }) || null;

                return {
                    id: String(s.id),
                    dbSupplierId: s.id,
                    name: s.name,
                    category: s.category || "General Supplies",
                    location: s.location || "Metro Manila, Philippines",
                    phone: s.phone || "",
                    email: s.email || "",
                    website: s.fb_link || s.website || "",
                    contact_person: s.contact_person || "Store Representative",
                    products: s.products || `${s.category || "General"} Products`,
                    notes: s.notes || "",
                    coords: {
                        lat: locCoords.latitude,
                        lng: locCoords.longitude,
                        displayName: s.location || s.name,
                    },
                    distanceKm: dist,
                    source: s.notes?.includes("OpenStreetMap") ? "OpenStreetMap" : "Saved Supplier Lead",
                    matchLevel: "exact",
                    isSavedInDB: true,
                    linkedRequestId: linkedReqId,
                    services_offered: Array.isArray(s.services_offered)
                        ? s.services_offered
                        : s.services_offered
                        ? [s.services_offered]
                        : [],
                    submittedQuote: matchedQuote,
                    hasRfqSent: hasRfq,
                    rfqSentAt: rfqDate,
                    scheduledMeeting: matchedMeeting,
                };
            });

            // Helper to robustly extract PR item name, quantity, unit, and category from items JSON or columns
            const extractPRDetails = (pr: any) => {
                let itemsArr: any[] = [];
                if (Array.isArray(pr.items)) {
                    itemsArr = pr.items;
                } else if (typeof pr.items === "string") {
                    try {
                        const parsed = JSON.parse(pr.items);
                        itemsArr = Array.isArray(parsed) ? parsed : [parsed];
                    } catch {
                        itemsArr = [];
                    }
                }

                const firstItem = (Array.isArray(itemsArr) && itemsArr[0]) || {};
                const itemName =
                    firstItem.name ||
                    firstItem.item_name ||
                    pr.item_name ||
                    (itemsArr.length > 0 ? itemsArr.map((i: any) => i.name || i.item_name).filter(Boolean).join(", ") : null) ||
                    pr.description ||
                    pr.purpose ||
                    "Requested Supplies";

                const qty = Number(
                    firstItem.quantity ||
                    firstItem.qty ||
                    pr.quantity ||
                    pr.quantity_requested ||
                    1
                );

                const unit =
                    firstItem.unit ||
                    pr.unit ||
                    (qty > 1 ? "units" : "lot");

                const category =
                    firstItem.category ||
                    pr.category ||
                    "General";

                return { itemName, qty, unit, category };
            };

            // 5. Group potential suppliers strictly by requisition and individual items
            const groupsMap = new Map<string, RequestSupplierGroup>();

            // Pre-populate groups from database purchase_requests with item-level granularity
            prList.forEach((pr: any) => {
                const reqId = String(pr.id).trim();
                const reqNum = pr.request_number || `PR-${reqId.slice(0, 8).toUpperCase()}`;

                let itemsArr: any[] = [];
                if (Array.isArray(pr.items) && pr.items.length > 0) {
                    itemsArr = pr.items;
                } else if (typeof pr.items === "string") {
                    try {
                        const parsed = JSON.parse(pr.items);
                        if (Array.isArray(parsed) && parsed.length > 0) itemsArr = parsed;
                    } catch {}
                }

                if (itemsArr.length === 0) {
                    const { itemName, qty, unit, category } = extractPRDetails(pr);
                    itemsArr = [{
                        name: itemName,
                        quantity: qty,
                        unit: unit,
                        category: category,
                    }];
                }

                itemsArr.forEach((item: any, idx: number) => {
                    const itemName = item.name || item.item_name || pr.item_name || pr.description || "Requested Supplies";
                    const qty = Number(item.quantity || item.quantity_requested || item.qty || pr.quantity || 1);
                    const unit = item.unit || pr.unit || (qty > 1 ? "units" : "lot");
                    const category = item.category || pr.category || "General";
                    const itemId = item.id || item.item_id || item.inventory_item_id || `item-${idx}`;
                    const groupKey = itemsArr.length > 1 ? `${reqId}__item_${itemId}` : reqId;

                    groupsMap.set(groupKey, {
                        groupKey,
                        requestId: reqId,
                        requestNumber: reqNum,
                        itemId: String(itemId),
                        itemIndex: idx,
                        totalItemsInRequest: itemsArr.length,
                        itemName,
                        quantityRequested: qty,
                        unit,
                        department: pr.department || "Warehouse",
                        requestedBy: pr.requested_by || "EDIZON PRADO",
                        category: category,
                        priority: pr.priority || "Normal",
                        status: item.status || pr.status || "Pending",
                        purpose: pr.purpose || pr.description || "Warehouse inventory requisition",
                        createdAt: pr.created_at,
                        potentialSuppliers: [],
                        quotations: [],
                    });
                });
            });

            // Distribute mapped potential suppliers into their respective item groups
            mappedSuppliers.forEach((supplier) => {
                const sNotes = (supplier.notes || "").toLowerCase();
                const sProducts = (supplier.products || "").toLowerCase();
                const sCat = (supplier.category || "").toLowerCase();
                const sReqId = (supplier.linkedRequestId || "").toLowerCase().trim();

                const matchedGroupKeys: string[] = [];

                Array.from(groupsMap.values()).forEach((group) => {
                    if (group.groupKey.startsWith("custom-") || group.groupKey === "general-leads") return;

                    const gReqId = group.requestId.toLowerCase().trim();
                    const gReqNum = group.requestNumber.toLowerCase().trim();
                    const gItemName = group.itemName.toLowerCase().trim();

                    const matchesReq = (
                        (sReqId && (sReqId === gReqId || sReqId === gReqNum || sReqId.includes(gReqId) || gReqId.includes(sReqId) || sReqId.includes(gReqNum))) ||
                        (sNotes && (sNotes.includes(gReqId) || sNotes.includes(gReqNum)))
                    );

                    if (matchesReq) {
                        const gItemId = (group.itemId || "").toLowerCase().trim();
                        const matchesItemId = gItemId && sNotes.includes(gItemId);
                        const itemTagStr = `item: ${gItemName}`;
                        const matchesItemTag = sNotes.includes(itemTagStr) || (sProducts.includes(gItemName) && !sNotes.includes("item:"));

                        if (group.totalItemsInRequest === 1) {
                            matchedGroupKeys.push(group.groupKey);
                        } else if (matchesItemId || matchesItemTag) {
                            matchedGroupKeys.push(group.groupKey);
                        }
                    }
                });

                if (matchedGroupKeys.length > 0) {
                    matchedGroupKeys.forEach((key) => {
                        const group = groupsMap.get(key);
                        if (group) {
                            const isAlreadyInGroup = group.potentialSuppliers.some(
                                (s) => s.id === supplier.id || (s.dbSupplierId && s.dbSupplierId === supplier.dbSupplierId) || s.name.toLowerCase().trim() === supplier.name.toLowerCase().trim()
                            );
                            if (!isAlreadyInGroup) {
                                group.potentialSuppliers.push(supplier);
                            }
                        }
                    });
                } else {
                    // Custom PR or General manual lead without DB PR
                    const customKey = supplier.linkedRequestId ? `custom-${supplier.linkedRequestId}` : "general-leads";
                    let customGroup = groupsMap.get(customKey);
                    if (!customGroup) {
                        customGroup = {
                            groupKey: customKey,
                            requestId: customKey,
                            requestNumber: supplier.linkedRequestId || "GENERAL-LEADS",
                            itemName: supplier.products || `${supplier.category} Supplies`,
                            quantityRequested: 1,
                            unit: "lot",
                            department: "Procurement / Sourcing",
                            requestedBy: "Manual Entry",
                            category: supplier.category || "General Supplies",
                            priority: "Normal",
                            status: "Pending Sourcing",
                            purpose: "Manually registered potential supplier lead",
                            createdAt: new Date().toISOString(),
                            potentialSuppliers: [],
                            quotations: [],
                        };
                        groupsMap.set(customKey, customGroup);
                    }
                    const isAlreadyInGroup = customGroup.potentialSuppliers.some(
                        (s) => s.id === supplier.id || s.name.toLowerCase().trim() === supplier.name.toLowerCase().trim()
                    );
                    if (!isAlreadyInGroup) {
                        customGroup.potentialSuppliers.push(supplier);
                    }
                }
            });

            // 4b. Synchronize group quantities with active Draft Purchase Orders
            // When shortage items are sourced or updated in Stage 2 / Sourcing Modal,
            // draft purchase orders record the actual target quantity (e.g. 20 pcs instead of original 10 pcs).
            Array.from(groupsMap.values()).forEach((group) => {
                if (group.groupKey === "general-leads") return;

                const gReqId = group.requestId.toLowerCase().trim();
                const gReqNum = group.requestNumber.toLowerCase().trim();
                const gItemName = group.itemName.toLowerCase().trim();
                const gUuid = gReqId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0]?.toLowerCase();

                let matchedDraftQty: number | null = null;
                let matchedDraftUnit: string | null = null;

                // Priority 1: Check draftPOs matching this requisition and item
                for (const po of draftPOs) {
                    const poReqId = String(po.request_id || "").toLowerCase().trim();
                    const poNotes = String(po.notes || "").toLowerCase().trim();

                    const matchesReq = Boolean(
                        (poReqId && (poReqId === gReqId || (gUuid && poReqId === gUuid) || poReqId === gReqNum || gReqId.includes(poReqId) || poReqId.includes(gReqId))) ||
                        (poNotes && ((gUuid && poNotes.includes(gUuid)) || (gReqNum && poNotes.includes(gReqNum)) || (gReqId && poNotes.includes(gReqId))))
                    );

                    let poItems: any[] = [];
                    if (Array.isArray(po.items)) {
                        poItems = po.items;
                    } else if (typeof po.items === "string") {
                        try {
                            const parsed = JSON.parse(po.items);
                            if (Array.isArray(parsed)) poItems = parsed;
                            else if (parsed && typeof parsed === "object") poItems = [parsed];
                        } catch {}
                    }

                    if (matchesReq) {
                        for (const it of poItems) {
                            const itName = String(it.name || it.item_name || "").toLowerCase().trim();
                            const itQty = Number(it.quantity || it.quantity_ordered || it.qty || 0);
                            const itUnit = String(it.unit || "").trim();

                            if (itQty > 0 && (itName === gItemName || itName.includes(gItemName) || gItemName.includes(itName) || group.totalItemsInRequest === 1)) {
                                matchedDraftQty = itQty;
                                matchedDraftUnit = itUnit || group.unit;
                                break;
                            }
                        }

                        if (!matchedDraftQty && poNotes) {
                            const noteQtyMatch = poNotes.match(/\((\d+)\s*([a-zA-Z]+)?\)/) || poNotes.match(/(\d+)\s*([a-zA-Z]+)?\s+of/);
                            if (noteQtyMatch) {
                                matchedDraftQty = Number(noteQtyMatch[1]);
                                matchedDraftUnit = (noteQtyMatch[2] || group.unit).trim();
                            }
                        }

                        if (matchedDraftQty) break;
                    }
                }

                // Priority 2: If no request_id match, check if any draft PO has an item matching gItemName
                if (!matchedDraftQty && gItemName) {
                    for (const po of draftPOs) {
                        let poItems: any[] = [];
                        if (Array.isArray(po.items)) poItems = po.items;
                        else if (typeof po.items === "string") {
                            try {
                                const parsed = JSON.parse(po.items);
                                if (Array.isArray(parsed)) poItems = parsed;
                            } catch {}
                        }

                        for (const it of poItems) {
                            const itName = String(it.name || it.item_name || "").toLowerCase().trim();
                            const itQty = Number(it.quantity || it.quantity_ordered || it.qty || 0);
                            const itUnit = String(it.unit || "").trim();

                            if (itQty > 0 && (itName === gItemName || (itName && gItemName && (itName.includes(gItemName) || gItemName.includes(itName))))) {
                                matchedDraftQty = itQty;
                                matchedDraftUnit = itUnit || group.unit;
                                break;
                            }
                        }
                        if (matchedDraftQty) break;
                    }
                }

                // Priority 3: Fallback check against supplier.products in potentialSuppliers of this group (e.g. "20 pcs of Laptops")
                if (!matchedDraftQty) {
                    for (const s of group.potentialSuppliers) {
                        if (s.products) {
                            const pMatch = s.products.match(/^(\d+)\s*([a-zA-Z]+)?\s+of\s+(.+)$/i);
                            if (pMatch) {
                                const pQty = Number(pMatch[1]);
                                const pUnit = pMatch[2] || group.unit;
                                const pName = pMatch[3].trim().toLowerCase();
                                if (pQty > 0 && (pName === gItemName || pName.includes(gItemName) || gItemName.includes(pName))) {
                                    matchedDraftQty = pQty;
                                    matchedDraftUnit = pUnit;
                                    break;
                                }
                            }
                        }
                    }
                }

                // Override quantityRequested and unit if draft purchase order specifies target quantity
                if (matchedDraftQty && matchedDraftQty > 0) {
                    group.quantityRequested = matchedDraftQty;
                    if (matchedDraftUnit) {
                        group.unit = matchedDraftUnit;
                    }
                }
            });

            // 5. Connect and merge submitted quotations into item groups
            quotationsList.forEach((quote) => {
                const quoteReq = (quote.request_number || "").trim().toLowerCase();
                const quoteReqId = String((quote as any).request_id || "").trim().toLowerCase();
                const quoteItem = (quote.item_name || "").trim().toLowerCase();

                const candidateGroups = Array.from(groupsMap.values()).filter((g) => {
                    const gNum = g.requestNumber.toLowerCase().trim();
                    const gId = g.requestId.toLowerCase().trim();
                    return (
                        gNum === quoteReq ||
                        gId === quoteReq ||
                        (quoteReqId && gId === quoteReqId) ||
                        gNum.includes(quoteReq) ||
                        quoteReq.includes(gNum)
                    );
                });

                let targetGroup: RequestSupplierGroup | undefined;
                if (candidateGroups.length === 1) {
                    targetGroup = candidateGroups[0];
                } else if (candidateGroups.length > 1) {
                    targetGroup = candidateGroups.find((g) => {
                        const gItem = g.itemName.toLowerCase().trim();
                        return quoteItem && (gItem === quoteItem || gItem.includes(quoteItem) || quoteItem.includes(gItem));
                    }) || candidateGroups[0];
                }

                if (targetGroup) {
                    if (!targetGroup.quotations) {
                        targetGroup.quotations = [];
                    }
                    if (!targetGroup.quotations.some((q) => q.id === quote.id)) {
                        targetGroup.quotations.push(quote);
                    }

                    // Attach quote to supplier item if present in this group
                    const supExists = targetGroup.potentialSuppliers.find((s) => {
                        const matchesId = (quote.supplier_id && Number(quote.supplier_id) === Number(s.id)) || (s.dbSupplierId && quote.supplier_id && Number(quote.supplier_id) === Number(s.dbSupplierId));
                        const qName = (quote.supplier_name || "").toLowerCase().trim();
                        const sName = (s.name || "").toLowerCase().trim();
                        const sClean = sName.split(" - ")[0].split(" (")[0].trim();
                        const qClean = qName.split(" - ")[0].split(" (")[0].trim();
                        const matchesName = qName === sName || (sClean && qName.includes(sClean)) || (qClean && sName.includes(qClean));
                        return matchesId || matchesName;
                    });
                    if (supExists) {
                        supExists.submittedQuote = quote;
                    }
                }
            });

            const assembled = Array.from(groupsMap.values());
            setRequestGroups(assembled);
            setExpandedGroupKeys((prev) => {
                if (prev.size === 0) {
                    return new Set(assembled.map((g) => g.groupKey));
                }
                const next = new Set(prev);
                assembled.forEach((g) => {
                    if (!prev.has(g.groupKey)) {
                        next.add(g.groupKey);
                    }
                });
                return next;
            });
        } catch (err) {
            console.error("Error loading potential suppliers data:", err);
            setRequestGroups([]);
        } finally {
            if (!silent) {
                setIsLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        loadPotentialSuppliersData(false);

        // Supabase Realtime: listen to updates across all relevant procurement & sourcing tables
        const channel = supabase
            .channel(`potential_suppliers_realtime_${Date.now()}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "suppliers" },
                () => {
                    loadPotentialSuppliersData(true);
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "purchase_requests" },
                () => {
                    loadPotentialSuppliersData(true);
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "supplier_quotations" },
                () => {
                    loadPotentialSuppliersData(true);
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "purchase_orders" },
                () => {
                    loadPotentialSuppliersData(true);
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "supplier_meetings" },
                () => {
                    loadPotentialSuppliersData(true);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadPotentialSuppliersData]);

    // Accordion toggle
    const toggleExpand = (key: string) => {
        setExpandedGroupKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const expandAll = () => {
        setExpandedGroupKeys(new Set(requestGroups.map((g) => g.groupKey)));
    };

    const collapseAll = () => {
        setExpandedGroupKeys(new Set());
    };

    // Remove / unlink a potential supplier
    const handleRemoveSupplier = async (supplierId: string, supplierName: string, group?: RequestSupplierGroup) => {
        if (!confirm(`Are you sure you want to remove "${supplierName}" from Potential Suppliers${group ? ` for "${group.itemName}"` : ''}?`)) {
            return;
        }

        setDeletingSupplierId(supplierId);
        try {
            if (!isNaN(Number(supplierId))) {
                const res = await removePotentialSupplierLinkage({
                    supplierId: Number(supplierId),
                    requestId: group?.requestId,
                    itemId: group?.itemId,
                    itemName: group?.itemName,
                });
                if (!res.success) {
                    console.warn("Notice unlinking/deleting supplier:", res.error);
                }
            }

            toast.success(`"${supplierName}" removed from Potential Suppliers${group ? ` for ${group.itemName}` : ''}.`);
            // Update local state immediately for this specific group only
            setRequestGroups((prev) =>
                prev
                    .map((g) => {
                        if (group && g.groupKey !== group.groupKey) {
                            return g;
                        }
                        return {
                            ...g,
                            potentialSuppliers: g.potentialSuppliers.filter((s) => s.id !== supplierId && String(s.dbSupplierId) !== supplierId),
                        };
                    })
                    .filter((g) => g.potentialSuppliers.length > 0 || (g.quotations && g.quotations.length > 0))
            );
        } catch (err: any) {
            console.error("Error removing supplier:", err);
            toast.error(err?.message || "Failed to remove supplier.");
        } finally {
            setDeletingSupplierId(null);
        }
    };

    // Trigger Supplier Review & Activation Modal
    const handlePromoteSupplier = (supplier: PotentialSupplierItem) => {
        setRegisterConfirmation(supplier);
    };

    // Trigger Award Bid Confirmation Modal
    const handleAwardBid = (supplier: PotentialSupplierItem, quote: SupplierQuotationItem) => {
        setAwardConfirmation({ supplier, quote });
    };

    // Execute award bid after modal confirmation:
    // 1. Create Purchase Order in purchase_orders table
    // 2. Do NOT make the supplier active/registered yet (keep is_active = false)
    // 3. Notify competing suppliers via email that a proposal has already been selected
    // 4. Remove unselected potential suppliers from Database and state while keeping the selected one
    const executeAwardBid = async (supplier: PotentialSupplierItem, quote: SupplierQuotationItem) => {
        setAwardingQuoteId(quote.id);
        try {
            // Find target group for this requisition
            const targetGroup = requestGroups.find((g) =>
                g.potentialSuppliers.some((s) => s.id === supplier.id || (s.dbSupplierId && s.dbSupplierId === supplier.dbSupplierId)) ||
                (quote.request_number && g.requestNumber && g.requestNumber.toLowerCase() === quote.request_number.toLowerCase())
            );

            const isValidUuid = (val: any) => typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
            const rawPrId = targetGroup?.requestId || (quote as any).request_id || null;
            const targetPrId = isValidUuid(rawPrId) ? String(rawPrId).trim() : null;
            const supplierIdNum = typeof supplier.dbSupplierId === "number" 
                ? supplier.dbSupplierId 
                : (!isNaN(Number(supplier.id)) && Number(supplier.id) > 0 ? Number(supplier.id) : null);
            const poNumber = `PO-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

            const qty = Number(quote.quantity) || 1;
            const unitPrice = Number(quote.unit_price) || 0;
            const itemName = quote.item_name || targetGroup?.itemName || "Procured Supplies";
            // Get currently authenticated Admin user
            let currentAdminId: string | null = null;
            try {
                const { data: authData } = await supabase.auth.getUser();
                if (authData?.user?.id) {
                    currentAdminId = authData.user.id;
                } else {
                    const { data: sessionData } = await supabase.auth.getSession();
                    if (sessionData?.session?.user?.id) {
                        currentAdminId = sessionData.session.user.id;
                    }
                }
            } catch (authErr) {
                console.warn("Could not retrieve current admin auth user:", authErr);
            }

            const leadDays = Number(quote.lead_time_days) || 7;
            const deliveryDate = new Date(Date.now() + leadDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

            // Extract structured terms from quote and notes
            const quoteNotes = quote.notes || '';
            const paymentMatch = quoteNotes.match(/Payment=([^|]+)/);
            const deliveryMatch = quoteNotes.match(/Delivery=([^|]+)/);
            const warrantyMatch = quoteNotes.match(/Warranty=([^|]+)/);
            const clausesMatch = quoteNotes.match(/Clauses=([^|]+)/);

            const paymentTerms = (quote as any).payment_terms || (paymentMatch ? paymentMatch[1].trim() : "Net 30 Days (Standard B2B)");
            const deliveryLocation = (quote as any).delivery_location || (deliveryMatch ? deliveryMatch[1].trim() : "352 Escolta St, Binondo, Manila, 1006 Metro Manila");
            const warrantyTerms = (quote as any).warranty_terms || (warrantyMatch ? warrantyMatch[1].trim() : "1-Year Replacement Warranty");
            const termsAndConditions = (quote as any).supplier_terms || (quote as any).terms_and_conditions || (clausesMatch ? clausesMatch[1].trim() : "1. All goods supplied are guaranteed brand new, authentic, and subject to 7-day quality inspection upon arrival.\n2. Official BIR Invoice and Receipt must be issued upon delivery.\n3. Defective or non-compliant units will be replaced free of charge within 48 hours.\n4. Payment shall be settled according to agreed commercial payment terms upon receipt and verification.");

            const subtotal = Number((quote as any).subtotal) || (qty * unitPrice);
            const discount = quote.discount !== undefined && quote.discount !== null ? Number(quote.discount) : ((quote as any).discount_amount ? Number((quote as any).discount_amount) : 0);
            const shippingFee = quote.shipping_fee !== undefined && quote.shipping_fee !== null ? Number(quote.shipping_fee) : ((quote as any).shipping ? Number((quote as any).shipping) : 0);
            const taxRate = quote.tax_rate !== undefined && quote.tax_rate !== null ? Number(quote.tax_rate) : 12;
            const taxableAmount = Math.max(0, subtotal - discount);
            const taxAmount = quote.tax_amount !== undefined && quote.tax_amount !== null ? Number(quote.tax_amount) : Number(((taxableAmount * taxRate) / 100).toFixed(2));
            const calculatedTotal = Number((taxableAmount + taxAmount + shippingFee).toFixed(2));
            const totalAmt = Number(quote.total_amount) || (calculatedTotal > 0 ? calculatedTotal : (qty * unitPrice));
            const category = (quote as any).category || targetGroup?.category || supplier.category || "General Supplies";

            // 1. Create Purchase Order in Supabase purchase_orders with complete schema fields
            const poData: Record<string, any> = {
                po_number: poNumber,
                request_id: targetPrId,
                supplier_id: supplierIdNum,
                suppliers_qoutation_bid: quote.id ? Number(quote.id) : null,
                supplier_name: supplier.name,
                category: category,
                subtotal: subtotal,
                discount: discount,
                shipping_fee: shippingFee,
                tax_rate: taxRate,
                tax_amount: taxAmount,
                total_amount: totalAmt,
                status: "Pending",
                delivery_date: deliveryDate,
                delivery_location: deliveryLocation,
                payment_terms: paymentTerms,
                terms_and_conditions: termsAndConditions,
                notes: `Awarded Bid for Requisition #${quote.request_number || targetGroup?.requestNumber || ''} (${itemName}) - Quoted: ₱${totalAmt.toLocaleString()} by ${supplier.name}. Lead time: ${leadDays} days. Warranty: ${warrantyTerms}.`,
                items: [
                    {
                        item_name: itemName,
                        name: itemName,
                        description: targetGroup?.purpose || `Requisition #${quote.request_number || targetGroup?.requestNumber || ''} - ${itemName}`,
                        category: category,
                        quantity_ordered: qty,
                        quantity: qty,
                        quantity_received: 0,
                        unit: quote.unit || targetGroup?.unit || "units",
                        unit_price: unitPrice,
                        subtotal: subtotal,
                        total: totalAmt,
                        availability: quote.availability || "In Stock (Immediate Dispatch)",
                        lead_time_days: leadDays,
                        services_offered: quote.services_offered || [],
                    }
                ],
                created_by: currentAdminId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                paid: false,
                fully_received: false,
                paid_verified_at: null,
                paid_verified_by: null,
                force_updated_by: null,
                force_updated_at: null,
                force_reason: null,
                admin_approval: "Approved",
                admin_approved_at: new Date().toISOString(),
                admin_approved_by: currentAdminId,
                financial_approval: "Pending",
                financial_approved_at: null,
                financial_approved_by: null,
            };

            const { error: poInsertErr } = await supabase
                .from("purchase_orders")
                .insert([poData]);

            if (poInsertErr) {
                console.warn("Initial PO insert failed (likely status or column constraint). Retrying with safe parameters:", poInsertErr);
                // Fallback 1: Try with status "Draft" if DB constraint requires Draft
                const fallbackData1 = { ...poData, status: "Draft" };
                const { error: retryErr1 } = await supabase.from("purchase_orders").insert([fallbackData1]);
                
                if (retryErr1) {
                    console.warn("Retry 1 failed. Trying without foreign key IDs:", retryErr1);
                    // Fallback 2: Remove foreign keys
                    const fallbackData2 = { ...poData, status: "Draft", supplier_id: null, request_id: null, suppliers_qoutation_bid: null };
                    const { error: retryErr2 } = await supabase.from("purchase_orders").insert([fallbackData2]);
                    if (retryErr2) {
                        console.error("Critical: Failed to insert PO:", retryErr2);
                        toast.error(`Could not create Purchase Order: ${retryErr2.message}`);
                    } else {
                        console.info("PO created successfully with safe fallback.");
                    }
                } else {
                    console.info("PO created successfully as Draft.");
                }
            } else {
                console.info("PO created successfully:", poNumber);
            }

            // Update associated purchase request if applicable
            if (targetPrId) {
                const prUpdatePayload: Record<string, any> = {
                    status: "Approved",
                    supplier_name: supplier.name,
                };
                if (supplierIdNum) {
                    prUpdatePayload.supplier_id = supplierIdNum;
                }
                const { error: prErr } = await supabase
                    .from("purchase_requests")
                    .update(prUpdatePayload)
                    .eq("id", targetPrId);

                if (prErr) {
                    // Fallback: update status only
                    console.warn("Retrying purchase request update without supplier_id:", prErr);
                    await supabase
                        .from("purchase_requests")
                        .update({ status: "Approved" })
                        .eq("id", targetPrId);
                }
            }

            // 2. Update winning quotation status in supplier_quotations table
            const { error: quoteErr } = await supabase
                .from("supplier_quotations")
                .update({
                    status: "accepted",
                })
                .eq("id", quote.id);

            if (quoteErr) {
                console.error("Error updating quote status:", quoteErr);
            }

            // 3. Keep winning supplier in suppliers table as non-active (do NOT set is_active: true)
            const winnerEmail = (
                supplier.email ||
                (quote as any).contact_email ||
                (quote as any).supplier_email ||
                (quote as any).email ||
                ""
            ).trim().toLowerCase();
            const winnerContact = (
                supplier.contact_person ||
                (quote as any).contact_person ||
                supplier.name
            ).trim();
            const winnerPhone = (
                supplier.phone ||
                (quote as any).contact_phone ||
                ""
            ).trim();

            if (supplier.dbSupplierId || supplier.id) {
                const targetId = supplier.dbSupplierId || supplier.id;
                const updatePayload: Record<string, any> = {
                    is_active: false,
                    notes: `Selected Bid Winner for Requisition #${quote.request_number || targetGroup?.requestNumber || ''} (${itemName}) - PO #${poNumber} Issued on ${new Date().toLocaleDateString()}`,
                };
                if (winnerEmail) updatePayload.email = winnerEmail;
                if (winnerContact) updatePayload.contact_person = winnerContact;
                if (winnerPhone) updatePayload.phone = winnerPhone;

                const { error: supErr } = await supabase
                    .from("suppliers")
                    .update(updatePayload)
                    .eq("id", targetId);

                if (supErr) {
                    console.warn("Notice updating winning supplier notes:", supErr);
                }
            }

            // 4. Identify competing suppliers in this requisition group
            const otherSuppliers = targetGroup
                ? targetGroup.potentialSuppliers.filter(
                      (s) => s.id !== supplier.id && (!s.dbSupplierId || s.dbSupplierId !== supplier.dbSupplierId)
                  )
                : [];

            // 5. Notify competing suppliers via email that a supplier has already been selected
            for (const other of otherSuppliers) {
                if (other.email && other.email.includes("@")) {
                    try {
                        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 24px; color: #1e293b; }
    .card { background: #ffffff; border-radius: 16px; max-width: 600px; margin: 0 auto; padding: 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 24px; }
    .logo-text { font-size: 20px; font-weight: 800; color: #0284c7; letter-spacing: -0.5px; }
    .badge { display: inline-block; background: #e0f2fe; color: #0369a1; font-weight: 700; font-size: 12px; padding: 4px 10px; border-radius: 9999px; margin-top: 8px; }
    .title { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 16px; margin-bottom: 8px; }
    .content { line-height: 1.6; font-size: 14px; color: #475569; }
    .details-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; }
    .detail-label { color: #64748b; font-weight: 500; }
    .detail-val { color: #0f172a; font-weight: 700; }
    .footer { border-top: 1px solid #f1f5f9; margin-top: 28px; padding-top: 20px; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-text">AIRSHIP EXPRESS SUPPLY CHAIN</div>
      <div class="badge">Procurement Bid Selection Notice</div>
      <div class="title">Procurement Update: Requisition #${quote.request_number || targetGroup?.requestNumber || 'REQ'}</div>
    </div>
    <div class="content">
      <p>Dear <strong>${other.name}</strong> Team,</p>
      <p>Thank you very much for your interest and for participating in our procurement requisition for <strong>${itemName}</strong>.</p>
      
      <div class="details-box">
        <div class="detail-row"><span class="detail-label">Requisition Reference:</span><span class="detail-val">${quote.request_number || targetGroup?.requestNumber || 'N/A'}</span></div>
        <div class="detail-row"><span class="detail-label">Item / Commodity:</span><span class="detail-val">${itemName}</span></div>
        <div class="detail-row"><span class="detail-label">Quantity:</span><span class="detail-val">${qty} ${quote.unit || targetGroup?.unit || 'units'}</span></div>
        <div class="detail-row"><span class="detail-label">Status:</span><span class="detail-val" style="color: #0284c7;">Supplier Selected & Awarded</span></div>
      </div>

      <p>Following a comprehensive review of all proposals against our operational lead times, commercial terms, and inventory specifications, we would like to inform you that another vendor proposal has been selected and awarded for this requisition.</p>
      
      <p>We sincerely appreciate the effort and responsiveness demonstrated by your team. We value your participation and look forward to inviting your company to upcoming requests for quotations (RFQs) and bidding opportunities.</p>
      
      <p>Best regards,<br><strong>Procurement & Supply Chain Team</strong><br>Airship Express Philippines</p>
    </div>
    <div class="footer">
      This is an automated notification from Airship Express Supply Chain Management System.
    </div>
  </div>
</body>
</html>
                        `;

                        await fetch("/api/send-email", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                to: other.email,
                                subject: `Procurement Update: Requisition #${quote.request_number || targetGroup?.requestNumber || ''} - ${itemName}`,
                                html: emailHtml,
                            }),
                        });
                    } catch (emailErr) {
                        console.warn(`Notice sending email to ${other.email}:`, emailErr);
                    }
                }
            }

            // 6. Remove unselected potential suppliers from Database and reject competing quotes
            for (const other of otherSuppliers) {
                if (other.dbSupplierId || (other.id && !isNaN(Number(other.id)))) {
                    const supIdToDelete = other.dbSupplierId || Number(other.id);
                    try {
                        await supabase
                            .from("suppliers")
                            .delete()
                            .eq("id", supIdToDelete);
                    } catch (delErr) {
                        console.warn("Notice deleting unselected potential supplier:", delErr);
                    }
                }
            }

            // Update other quotations for this requisition to rejected status
            if (quote.request_number) {
                await supabase
                    .from("supplier_quotations")
                    .update({ status: "rejected" })
                    .neq("id", quote.id)
                    .eq("request_number", quote.request_number);
            }

            // 7. Auto-provision Supplier Portal account and email login credentials to winning vendor
            let accountCreated = false;
            let accountEmailSent = false;
            const targetSupplierId = supplierIdNum || supplier.dbSupplierId || (supplier.id && !isNaN(Number(supplier.id)) ? Number(supplier.id) : null);

            if (winnerEmail && winnerEmail.includes("@") && targetSupplierId) {
                try {
                    const accRes = await fetch("/api/suppliers/create-account", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            supplierId: targetSupplierId,
                            supplierName: supplier.name,
                            contactName: winnerContact || supplier.name,
                            email: winnerEmail,
                            invitedBy: currentAdminId,
                            invitedByName: "Procurement Administrator",
                        }),
                    });

                    const accData = await accRes.json();
                    if (accData.ok) {
                        accountCreated = true;
                        accountEmailSent = Boolean(accData.emailSent);
                        console.info("Supplier Portal account provisioned for awarded winner:", accData);
                    } else {
                        console.warn("Notice during supplier account creation upon award:", accData.message);
                    }
                } catch (accErr) {
                    console.warn("Could not provision supplier account during bid award:", accErr);
                }
            }

            // 8. Update local state immediately: keep only the selected supplier in this group
            setRequestGroups((prevGroups) =>
                prevGroups.map((g) => {
                    const isTargetGroup =
                        (targetGroup && g.requestId === targetGroup.requestId) ||
                        g.requestNumber === (quote.request_number || targetGroup?.requestNumber);

                    if (!isTargetGroup) return g;

                    const updatedPotentialSuppliers = g.potentialSuppliers
                        .filter(
                            (s) =>
                                s.id === supplier.id ||
                                (s.dbSupplierId && s.dbSupplierId === supplier.dbSupplierId)
                        )
                        .map((s) => ({
                            ...s,
                            notes: `Selected Bid Winner for Requisition #${quote.request_number || g.requestNumber} (${itemName}) - PO #${poNumber} Issued on ${new Date().toLocaleDateString()}`,
                            submittedQuote: s.submittedQuote
                                ? { ...s.submittedQuote, status: "accepted" as const }
                                : quote,
                        }));

                    return {
                        ...g,
                        potentialSuppliers: updatedPotentialSuppliers,
                    };
                })
            );

            if (accountCreated) {
                toast.success(
                    `Purchase Order #${poNumber} created & Bid awarded to "${supplier.name}"! Supplier Portal account created${accountEmailSent ? ` (credentials emailed to ${winnerEmail})` : ""}.`,
                    { duration: 6000 }
                );
            } else {
                toast.success(`Purchase Order #${poNumber} created! Bid awarded to "${supplier.name}". Other suppliers were notified and removed.`);
            }
            setAwardConfirmation(null);
            onSupplierPromoted?.();
            loadPotentialSuppliersData();
        } catch (err: any) {
            console.error("Error awarding bid and creating PO:", err);
            toast.error(err?.message || "Failed to award bid and create purchase order.");
        } finally {
            setAwardingQuoteId(null);
        }
    };

    // Save newly added / edited supplier email & update state + database
    const handleSaveSupplierEmail = async (sendRFQAfterSave: boolean = false) => {
        if (!addEmailSupplier) return;
        const { supplier, group } = addEmailSupplier;
        const cleanEmail = inputEmail.trim();

        const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
        if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
            toast.error("Please enter a valid email address (e.g., sales@goodyear.ph).");
            return;
        }

        setIsSavingEmail(true);
        try {
            // 1. Update in Supabase suppliers table if record exists
            if (supplier.dbSupplierId || supplier.id) {
                const targetId = supplier.dbSupplierId || supplier.id;
                const { error: supError } = await supabase
                    .from("suppliers")
                    .update({ email: cleanEmail })
                    .eq("id", targetId);

                if (supError) {
                    console.warn("Notice updating suppliers table:", supError);
                }
            }

            // 2. Update local state immediately
            setRequestGroups((prevGroups) =>
                prevGroups.map((g) => ({
                    ...g,
                    potentialSuppliers: g.potentialSuppliers.map((s) => {
                        if (s.id === supplier.id || (s.dbSupplierId && s.dbSupplierId === supplier.dbSupplierId)) {
                            return {
                                ...s,
                                email: cleanEmail,
                            };
                        }
                        return s;
                    }),
                }))
            );

            const updatedSupplier: PotentialSupplierItem = {
                ...supplier,
                email: cleanEmail,
            };

            toast.success(`Quotation email updated for "${supplier.name}"!`);
            setAddEmailSupplier(null);
            setInputEmail("");

            if (sendRFQAfterSave) {
                handleOpenEmailModal(updatedSupplier, group);
            }
        } catch (err: any) {
            console.error("Error saving supplier email:", err);
            toast.error(err?.message || "Failed to save supplier email.");
        } finally {
            setIsSavingEmail(false);
        }
    };

    // Open RFQ Email Dialog
    const handleOpenEmailModal = (supplier: PotentialSupplierItem, group: RequestSupplierGroup, isFollowUp: boolean = false) => {
        let activeGroup = group;
        if (supplier.products) {
            const pMatch = supplier.products.match(/^(\d+)\s*([a-zA-Z]+)?\s+of\s+/i);
            if (pMatch && Number(pMatch[1]) > 0 && (!activeGroup.quantityRequested || activeGroup.quantityRequested < Number(pMatch[1]))) {
                activeGroup = {
                    ...activeGroup,
                    quantityRequested: Number(pMatch[1]),
                    unit: pMatch[2] || activeGroup.unit,
                };
            }
        }
        setEmailModalData({ supplier, group: activeGroup });
        const shouldBeFollowUp = isFollowUp || supplier.hasRfqSent;

        if (shouldBeFollowUp) {
            setCustomEmailMessage(
                `Good day ${supplier.contact_person || supplier.name},\n\nThis is a follow-up inquiry from Airship Express Supply Chain regarding our purchase requisition #${activeGroup.requestNumber} (${activeGroup.quantityRequested} ${activeGroup.unit} of ${activeGroup.itemName}).\n\nWe are currently finalizing supplier evaluations and would appreciate it if you could submit your formal quotation, stock availability, and delivery lead time at your earliest convenience using the link below.`
            );
        } else {
            setCustomEmailMessage(
                `Good day ${supplier.contact_person || supplier.name},\n\nWe are reaching out from Airship Express Logistics & Warehousing. We are currently evaluating potential suppliers for our purchase requisition #${activeGroup.requestNumber} (${activeGroup.quantityRequested} ${activeGroup.unit} of ${activeGroup.itemName}).\n\nPlease submit your quotation, item availability, delivery lead time, and service inclusions using the link below.`
            );
        }
    };

    // Send RFQ Email via /api/send-email
    const handleSendRFQEmail = async () => {
        if (!emailModalData) return;
        const { supplier, group } = emailModalData;

        if (!supplier.email || !supplier.email.includes("@")) {
            toast.error("Supplier does not have a valid email address.");
            return;
        }

        setIsSendingEmail(true);
        try {
            const baseAppUrl = (
                process.env.NEXT_PUBLIC_SUPPLYCHAIN_APP_URL ||
                (typeof window !== "undefined" ? window.location.origin : "https://sc.airship-express.com")
            ).replace(/\/+$/, "");
            const quotePortalUrl = `${baseAppUrl}/supplier-portal/quote?req=${encodeURIComponent(group.requestNumber)}&supplier=${encodeURIComponent(supplier.name)}&item=${encodeURIComponent(group.itemName)}&qty=${group.quantityRequested}&unit=${encodeURIComponent(group.unit)}&cat=${encodeURIComponent(supplier.category || group.category || "")}&loc=${encodeURIComponent(supplier.location || "")}`;

            const isFollowUp = supplier.hasRfqSent;
            const emailSubject = isFollowUp
                ? `Follow-up: Request for Quotation & Partnership Inquiry: ${group.requestNumber} - ${group.itemName}`
                : `Request for Quotation & Partnership Inquiry: ${group.requestNumber} - ${group.itemName}`;

            const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <div style="background: linear-gradient(135deg, #db2777 0%, #e11d48 100%); padding: 24px; color: #ffffff;">
                        <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">AIRSHIP EXPRESS PHILIPPINES</h2>
                        <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Supply Chain Management & Procurement Office</p>
                    </div>
                    
                    <div style="padding: 28px; color: #1e293b; line-height: 1.6;">
                        <p style="font-size: 14px; margin-top: 0;">Dear <strong>${supplier.contact_person || supplier.name}</strong>,</p>
                        
                        <p style="font-size: 13px; color: #334155; white-space: pre-line;">${customEmailMessage}</p>

                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0;">
                            <h4 style="margin: 0 0 10px 0; font-size: 13px; text-transform: uppercase; color: #db2777; font-weight: 800;">Requisition Specification:</h4>
                            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                <tr>
                                    <td style="padding: 6px 0; color: #64748b; width: 140px;">Request Number:</td>
                                    <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${group.requestNumber}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 0; color: #64748b;">Item Description:</td>
                                    <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${group.itemName}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 0; color: #64748b;">Required Quantity:</td>
                                    <td style="padding: 6px 0; font-weight: bold; color: #db2777;">${group.quantityRequested} ${group.unit}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 0; color: #64748b;">Delivery Destination:</td>
                                    <td style="padding: 6px 0; color: #0f172a;">Airship Express HQ (Binondo, Manila)</td>
                                </tr>
                            </table>
                        </div>

                        <div style="text-align: center; margin: 30px 0 20px 0;">
                            <a href="${quotePortalUrl}" style="background-color: #db2777; color: #ffffff; padding: 14px 28px; border-radius: 10px; font-weight: 800; font-size: 14px; text-decoration: none; display: inline-block; box-shadow: 0 4px 12px rgba(219, 39, 119, 0.35);">
                                Submit Quotation & Service Proposal →
                            </a>
                        </div>

                        <p style="font-size: 12px; color: #64748b; text-align: center; margin-bottom: 0;">
                            Click the button above to enter your unit price, stock availability, and service details.
                        </p>
                    </div>

                    <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
                        Airship Express Inc. • Procurement & Supply Chain Dept • Binondo, Manila, Philippines
                    </div>
                </div>
            `;

            const res = await fetch("/api/send-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    to: supplier.email,
                    subject: emailSubject,
                    html: emailHtml,
                    text: customEmailMessage,
                    senderName: "Airship Express Procurement",
                }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                const todayFormatted = new Date().toLocaleDateString();
                toast.success(
                    isFollowUp
                        ? `Follow-up RFQ email sent to ${supplier.email}!`
                        : `Quotation request sent to ${supplier.email}! Bidding initiated.`
                );

                // Update supplier record in Supabase with RFQ Sent metadata
                if (supplier.dbSupplierId || (!isNaN(Number(supplier.id)) && Number(supplier.id) > 0)) {
                    const targetId = supplier.dbSupplierId || Number(supplier.id);
                    const tag = `[RFQ Sent: ${todayFormatted}]`;
                    const existingNotes = supplier.notes || "";
                    if (!existingNotes.toLowerCase().includes("rfq sent")) {
                        const newNotes = existingNotes ? `${existingNotes} | ${tag}` : tag;
                        await supabase.from("suppliers").update({ notes: newNotes }).eq("id", targetId);
                    }
                }

                // Update local state immediately
                setRequestGroups((prev) =>
                    prev.map((g) => {
                        if (g.requestId === group.requestId) {
                            return {
                                ...g,
                                potentialSuppliers: g.potentialSuppliers.map((s) => {
                                    if (s.id === supplier.id) {
                                        return {
                                            ...s,
                                            hasRfqSent: true,
                                            rfqSentAt: todayFormatted,
                                        };
                                    }
                                    return s;
                                }),
                            };
                        }
                        return g;
                    })
                );

                setEmailModalData(null);
            } else {
                toast.error(data.error || "Failed to send RFQ email.");
            }
        } catch (err: any) {
            console.error("Error sending RFQ email:", err);
            toast.error(err?.message || "Failed to send email. Please check internet/email configuration.");
        } finally {
            setIsSendingEmail(false);
        }
    };

    // Remove scheduled supplier meeting
    const handleRemoveMeeting = async (meetingId: string, supplierName: string) => {
        if (!confirm(`Are you sure you want to remove the scheduled meeting with ${supplierName}?`)) {
            return;
        }
        setRemovingMeetingId(meetingId);
        try {
            const res = await removeSupplierMeetingAction(meetingId);
            if (res.success) {
                toast.success(`Meeting with ${supplierName} removed`);
                await loadPotentialSuppliersData(true);
            } else {
                toast.error(res.error || "Failed to remove meeting");
            }
        } catch (err: any) {
            toast.error(err.message || "An unexpected error occurred while removing the meeting");
        } finally {
            setRemovingMeetingId(null);
        }
    };

    // Helper to check if there is a pending or scheduled meeting for that supplier
    const getSupplierActiveMeeting = useCallback((supplier: PotentialSupplierItem, group?: RequestSupplierGroup) => {
        const activeMeetings = (meetingsList || []).filter((m) => {
            const st = (m.status || "").toLowerCase().trim();
            return st === "scheduled" || st === "pending";
        });

        if (activeMeetings.length === 0) return supplier.scheduledMeeting || null;

        const sIdNum = supplier.dbSupplierId || (supplier.id && !isNaN(Number(supplier.id)) ? Number(supplier.id) : null);
        const sEmail = (supplier.email || "").toLowerCase().trim();
        const sName = (supplier.name || "").toLowerCase().trim();
        const sClean = sName.split(" - ")[0].split(" (")[0].trim();

        const matches = activeMeetings.filter((m) => {
            const mIdNum = m.supplier_id ? Number(m.supplier_id) : null;
            const matchesId = Boolean(sIdNum && mIdNum && sIdNum === mIdNum);

            const mEmail = (m.supplier_email || "").toLowerCase().trim();
            const matchesEmail = Boolean(sEmail && mEmail && (sEmail === mEmail || sEmail.includes(mEmail) || mEmail.includes(sEmail)));

            const mName = (m.supplier_name || "").toLowerCase().trim();
            const mClean = mName.split(" - ")[0].split(" (")[0].trim();
            const matchesName = Boolean(
                (sName && mName && (sName === mName || sName.includes(mName) || mName.includes(sName))) ||
                (sClean && mClean && (sClean === mClean || sClean.includes(mClean) || mClean.includes(sClean)))
            );

            return matchesId || matchesEmail || matchesName;
        });

        if (matches.length === 0) return supplier.scheduledMeeting || null;

        if (group?.requestId || group?.requestNumber) {
            const gReqId = (group.requestId || "").toLowerCase().trim();
            const gReqNum = (group.requestNumber || "").toLowerCase().trim();
            const exactGroup = matches.find((m) => {
                const mReqId = (m.requisition_id || "").toLowerCase().trim();
                const mReqNum = (m.request_number || "").toLowerCase().trim();
                return (mReqId && (mReqId === gReqId || mReqId === gReqNum || gReqId.includes(mReqId) || mReqId.includes(gReqId))) ||
                       (mReqNum && (mReqNum === gReqNum || mReqNum === gReqId || gReqNum.includes(mReqNum) || mReqNum.includes(gReqNum)));
            });
            if (exactGroup) return exactGroup;
        }

        return matches[0];
    }, [meetingsList]);

    // Filter request groups and their suppliers
    const filteredGroups = useMemo(() => {
        return requestGroups
            .map((group) => {
                if (departmentFilter !== "all" && group.department.toLowerCase() !== departmentFilter.toLowerCase()) {
                    return null;
                }

                if (statusFilter !== "all" && group.status.toLowerCase() !== statusFilter.toLowerCase()) {
                    return null;
                }

                const matchingSuppliers = group.potentialSuppliers.filter((s) => {
                    if (searchTerm.trim()) {
                        const term = searchTerm.toLowerCase();
                        const matchReqNum = group.requestNumber.toLowerCase().includes(term);
                        const matchItem = group.itemName.toLowerCase().includes(term);
                        const matchSupName = s.name.toLowerCase().includes(term);
                        const matchLoc = (s.location || "").toLowerCase().includes(term);
                        const matchProd = (s.products || "").toLowerCase().includes(term);
                        const matchCat = (s.category || "").toLowerCase().includes(term);
                        const matchPhone = (s.phone || "").toLowerCase().includes(term);
                        const matchEmail = (s.email || "").toLowerCase().includes(term);

                        if (!matchReqNum && !matchItem && !matchSupName && !matchLoc && !matchProd && !matchCat && !matchPhone && !matchEmail) {
                            return false;
                        }
                    }
                    return true;
                });

                if (matchingSuppliers.length === 0 && (!group.quotations || group.quotations.length === 0)) {
                    return null;
                }

                return {
                    ...group,
                    potentialSuppliers: matchingSuppliers,
                };
            })
            .filter((g): g is RequestSupplierGroup => g !== null);
    }, [requestGroups, departmentFilter, statusFilter, searchTerm]);

    const totalPotentialSuppliers = useMemo(() => {
        return filteredGroups.reduce((acc, g) => acc + g.potentialSuppliers.length, 0);
    }, [filteredGroups]);

    const quotationStats = useMemo(() => {
        let totalQuotes = 0;
        let acceptedQuotes = 0;
        filteredGroups.forEach((g) => {
            if (g.quotations) {
                totalQuotes += g.quotations.length;
                acceptedQuotes += g.quotations.filter((q) => q.status === "accepted").length;
            }
        });
        return { totalQuotes, acceptedQuotes };
    }, [filteredGroups]);

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* Top Overview Cards using 3D Flipping Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Cards
                    frontIcon="fas fa-clipboard-list mr-1"
                    header="Requisitions"
                    data={String(filteredGroups.length)}
                    arrow="fas fa-layer-group mr-1"
                    description="Requisition groups"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Requisition Groups"
                    backIcon="fas fa-clipboard-list"
                    backDescription={`${filteredGroups.length} distinct purchase request groups undergoing vendor comparison and quotation evaluation.`}
                    tooltip="Purchase requests with active quotation workflows"
                    badge="Groups"
                    frontTextColor="text-slate-500 dark:text-slate-400"
                    descriptionTextColor="text-pink-600 dark:text-pink-400"
                />
                <Cards
                    frontIcon="fas fa-building mr-1"
                    header="Potential Suppliers"
                    data={String(totalPotentialSuppliers)}
                    arrow="fas fa-store mr-1"
                    description="Matched vendor candidates"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Candidate Suppliers"
                    backIcon="fas fa-building"
                    backDescription={`${totalPotentialSuppliers} potential suppliers identified and linked to active requisitions.`}
                    tooltip="Candidate vendors under evaluation"
                    badge="Candidates"
                    frontTextColor="text-slate-500 dark:text-slate-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />
                <Cards
                    frontIcon="fas fa-file-invoice-dollar mr-1"
                    header="Submitted Quotes"
                    data={String(quotationStats.totalQuotes)}
                    arrow="fas fa-check-double mr-1"
                    description="Formal quotations received"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Quotation Records"
                    backIcon="fas fa-file-invoice-dollar"
                    backDescription={`${quotationStats.totalQuotes} competitive price quotations submitted by candidate suppliers.`}
                    tooltip="Vendor price bids submitted"
                    badge="Quotations"
                    frontTextColor="text-slate-500 dark:text-slate-400"
                    descriptionTextColor="text-pink-600 dark:text-pink-400"
                />
                <Cards
                    frontIcon="fas fa-scale-balanced mr-1"
                    header="Award Status"
                    data={quotationStats.acceptedQuotes > 0 ? `${quotationStats.acceptedQuotes} Awarded` : "In Review"}
                    arrow="fas fa-award mr-1"
                    description={quotationStats.acceptedQuotes > 0 ? "Bids awarded to suppliers" : "Pending award decision"}
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Bid Award Status"
                    backIcon="fas fa-award"
                    backDescription={`${quotationStats.acceptedQuotes} quotations have been accepted and finalized into purchase agreements.`}
                    tooltip="Progress of supplier quotation awards"
                    badge={quotationStats.acceptedQuotes > 0 ? "Awarded" : "Evaluating"}
                    frontTextColor="text-slate-500 dark:text-slate-400"
                    descriptionTextColor={quotationStats.acceptedQuotes > 0 ? "text-pink-600 dark:text-pink-400" : "text-slate-500 dark:text-slate-400"}
                />
            </div>
            {/* Control Panel / Filter Bar (Neumorphic) */}
            <div className="p-4 sm:p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#141624] border-2 border-slate-300 dark:border-white/15 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                {/* Search Input with Inset Neumorphic Shadow */}
                <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by Request #, supplier, phone, or location..."
                        className="w-full bg-[#ebf0f7] dark:bg-[#12131b] border border-white/70 dark:border-white/[0.04] rounded-2xl pl-10 pr-9 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] focus:outline-none focus:ring-2 focus:ring-pink-500/40 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Expand/Collapse All (Neumorphic Toggle Group) */}
                    <div className="flex items-center gap-1 bg-[#ebf0f7] dark:bg-[#12131b] p-1 rounded-2xl border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)]">
                        <button
                            type="button"
                            onClick={expandAll}
                            className="px-2.5 py-1 text-[11px] font-black text-slate-600 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 rounded-xl transition-colors cursor-pointer"
                            title="Expand all requisition groups"
                        >
                            Expand All
                        </button>
                        <button
                            type="button"
                            onClick={collapseAll}
                            className="px-2.5 py-1 text-[11px] font-black text-slate-600 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 rounded-xl transition-colors cursor-pointer"
                            title="Collapse all requisition groups"
                        >
                            Collapse All
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            setMeetingModalData({
                                supplier: {
                                    id: "",
                                    name: "",
                                    category: "",
                                    location: "",
                                    coords: { lat: 14.5995, lng: 120.9842, displayName: "" },
                                    distanceKm: 0,
                                    source: "manual",
                                    matchLevel: "exact"
                                }
                            });
                        }}
                        className="px-3.5 py-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 border border-pink-500/30 shadow-[-2px_-2px_6px_rgba(255,255,255,0.9),_2px_2px_6px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.6)] active:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4)] transition-all cursor-pointer flex items-center gap-1.5 text-xs font-black shrink-0"
                        title="Schedule a negotiation or clarification meeting with a supplier"
                    >
                        <Video className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                        <span>Set Meeting</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setAddModalInitialReqId("");
                            setIsAddSupplierModalOpen(true);
                        }}
                        className="px-4 py-2 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white shadow-[-2px_-2px_6px_rgba(255,255,255,0.6),_3px_3px_8px_rgba(219,39,119,0.45)] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.3)] transition-all cursor-pointer flex items-center gap-1.5 text-xs font-black shrink-0"
                        title="Manually record a potential supplier lead"
                    >
                        <PlusCircle className="w-4 h-4" />
                        <span>Add Potential Supplier</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => loadPotentialSuppliersData(false)}
                        disabled={isLoading}
                        className="px-3.5 py-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-600 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 border border-white/80 dark:border-white/[0.05] shadow-[-2px_-2px_6px_rgba(255,255,255,0.9),_2px_2px_6px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.6)] active:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4)] transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 text-xs font-bold"
                        title="Reload potential suppliers"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-pink-500" : ""}`} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Summary Context Badge */}
            <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 px-1">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                        {filteredGroups.length} Requisition Group{filteredGroups.length !== 1 ? "s" : ""}
                    </span>
                    <span>•</span>
                    <span className="font-bold text-pink-600 dark:text-pink-400">
                        {totalPotentialSuppliers} Selected Potential Supplier{totalPotentialSuppliers !== 1 ? "s" : ""}
                    </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Sparkles className="w-3.5 h-3.5 text-pink-500" />
                    <span>Real suppliers added during purchase request evaluation</span>
                </div>
            </div>

            {/* Request Categorized Accordion Groups */}
            {isLoading ? (
                <div className="p-12 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-pink-500/10 text-pink-600 flex items-center justify-center animate-spin">
                        <Compass className="w-6 h-6" />
                    </div>
                    <p className="font-bold text-sm text-slate-700 dark:text-slate-200">
                        Loading potential suppliers...
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                        Fetching selected suppliers from database
                    </p>
                </div>
            ) : filteredGroups.length === 0 ? (
                <div className="p-12 sm:p-16 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-3xl bg-pink-500/10 text-pink-500 flex items-center justify-center shadow-inner">
                        <Store className="w-8 h-8" />
                    </div>
                    <div className="space-y-1 max-w-md">
                        <h4 className="font-black text-base sm:text-lg text-slate-800 dark:text-slate-100">
                            No Potential Suppliers Added Yet
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            To add potential suppliers to this list, you can manually register new vendor leads using the button below or source nearby OpenStreetMap stores from pending requisitions in <strong>Inventory</strong>.
                        </p>
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setAddModalInitialReqId("");
                                    setIsAddSupplierModalOpen(true);
                                }}
                                className="px-5 py-2.5 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black shadow-[-2px_-2px_6px_rgba(255,255,255,0.5),_3px_3px_8px_rgba(219,39,119,0.45)] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.3)] transition-all flex items-center gap-2 cursor-pointer mx-auto"
                            >
                                <PlusCircle className="w-4 h-4" />
                                <span>Manually Add Potential Supplier</span>
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {filteredGroups.map((group) => {
                        const isExpanded = expandedGroupKeys.has(group.groupKey);
                        const priorityLower = (group.priority || "normal").toLowerCase();

                        return (
                            <div
                                key={group.groupKey}
                                className="rounded-3xl bg-[#ebf0f7] dark:bg-[#141624] border-2 border-slate-300 dark:border-white/15 overflow-hidden transition-all duration-200"
                            >
                                {/* Group Header Accordion Bar (Embossed Neumorphic) */}
                                <div
                                    onClick={() => toggleExpand(group.groupKey)}
                                    className="p-4 sm:p-5 bg-[#ebf0f7] dark:bg-[#141624] border-b-2 border-slate-300 dark:border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                                >
                                    {/* Left: Requisition Meta */}
                                    <div className="flex items-start gap-3.5">
                                        <div className="w-11 h-11 rounded-2xl bg-pink-600 text-white flex items-center justify-center shrink-0 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(219,39,119,0.4)] mt-0.5">
                                            <FileText className="w-5 h-5 drop-shadow" />
                                        </div>

                                        <div className="min-w-0 space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-mono text-xs font-black text-pink-600 dark:text-pink-400 bg-[#ebf0f7] dark:bg-[#1c1e2e] px-2.5 py-0.5 rounded-xl shadow-[inset_1px_1px_3px_rgba(163,177,198,0.35),_inset_-1px_-1px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5),_inset_-1px_-1px_3px_rgba(255,255,255,0.02)] border border-white/70 dark:border-white/[0.03]">
                                                    {group.requestNumber}
                                                </span>

                                                <StatusBadge
                                                    tone={
                                                        priorityLower === "critical"
                                                            ? "rose"
                                                            : priorityLower === "urgent" || priorityLower === "high"
                                                            ? "amber"
                                                            : "neutral"
                                                    }
                                                    size="xs"
                                                    dot
                                                >
                                                    {group.priority} Priority
                                                </StatusBadge>

                                                {group.quotations && group.quotations.length > 0 && (
                                                    <span className="px-2.5 py-0.5 rounded-xl text-[10px] sm:text-[11px] font-black bg-pink-500/15 text-pink-600 dark:text-pink-400 border border-pink-500/30 flex items-center gap-1 shadow-xs">
                                                        <Sparkles className="w-3 h-3 text-pink-500" />
                                                        <span>{group.quotations.length} Quote{group.quotations.length !== 1 ? "s" : ""} • AI Evaluated</span>
                                                    </span>
                                                )}

                                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                    <Building2 className="w-3.5 h-3.5 text-pink-500" />
                                                    {group.department}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight break-words whitespace-normal">
                                                    {group.itemName}
                                                </h3>
                                                <span className="font-mono text-xs font-extrabold text-slate-700 dark:text-slate-200 bg-[#e2e8f0] dark:bg-[#1a1c2d] px-2.5 py-0.5 rounded-xl shadow-[inset_1px_1px_2px_rgba(163,177,198,0.35),_inset_-1px_-1px_2px_rgba(255,255,255,0.9)] dark:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5)] border border-white/60 dark:border-white/[0.03]">
                                                    Qty: {group.quantityRequested} {group.unit}
                                                </span>
                                            </div>

                                            {group.purpose && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 italic font-medium">
                                                    &ldquo;{group.purpose}&rdquo;
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: Supplier Count & Expand Toggle */}
                                    <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-end lg:self-center">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setAddModalInitialReqId(group.requestId);
                                                setIsAddSupplierModalOpen(true);
                                            }}
                                            className="px-3 py-1.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] text-pink-600 dark:text-pink-400 hover:bg-pink-600 hover:text-white dark:hover:bg-pink-600 dark:hover:text-white border border-pink-200/80 dark:border-pink-900/40 shadow-[-2px_-2px_5px_rgba(255,255,255,0.85),_2px_2px_5px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.02),_2px_2px_5px_rgba(0,0,0,0.6)] active:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4)] transition-all cursor-pointer flex items-center gap-1.5 text-xs font-black shrink-0"
                                            title={`Add a manual supplier lead for ${group.requestNumber}`}
                                        >
                                            <PlusCircle className="w-3.5 h-3.5" />
                                            <span className="hidden sm:inline">Add Lead</span>
                                        </button>

                                        <div className="px-3.5 py-1.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/[0.05] shadow-[-2px_-2px_6px_rgba(255,255,255,0.9),_2px_2px_6px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.6)] flex items-center gap-2">
                                            <Store className="w-4 h-4 text-pink-500" />
                                            <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                                                {group.potentialSuppliers.length} Potential Supplier{group.potentialSuppliers.length !== 1 ? "s" : ""}
                                            </span>
                                        </div>

                                        <div className="w-9 h-9 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/[0.05] flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-[-2px_-2px_5px_rgba(255,255,255,0.9),_2px_2px_5px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.02),_2px_2px_5px_rgba(0,0,0,0.6)]">
                                            {isExpanded ? <ChevronUp className="w-4 h-4 text-pink-500" /> : <ChevronDown className="w-4 h-4" />}
                                        </div>
                                    </div>
                                </div>

                                {/* Group Body: Quotations Summary & Sourced Suppliers */}
                                {isExpanded && (
                                    <div className="p-4 sm:p-6 bg-[#ebf0f7]/60 dark:bg-[#10121c]/60 space-y-6">
                                        {/* 1. Submitted Quotations & AI Best Offer Recommendation */}
                                        {group.quotations && group.quotations.length > 0 && (
                                            <RequestQuotationsSummary
                                                group={group}
                                                quotations={group.quotations}
                                                onAwardBid={handleAwardBid}
                                                awardingQuoteId={awardingQuoteId}
                                            />
                                        )}

                                        {/* 2. Sourced Leads Pipeline & Contact Grid */}
                                        <div className="space-y-3 pt-1">
                                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                                <div className="flex items-center gap-2">
                                                    <Store className="w-4 h-4 text-pink-500" />
                                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                                        Sourced Vendor Leads & Outreach Pipeline ({group.potentialSuppliers.length})
                                                    </h4>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setAddModalInitialReqId(group.requestId);
                                                            setIsAddSupplierModalOpen(true);
                                                        }}
                                                        className="px-3 py-1.5 rounded-xl bg-[#e8eef6] dark:bg-[#181a29] text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 text-[11px] font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),_3px_3px_8px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_2px_2px_6px_rgba(0,0,0,0.5)] active:shadow-[inset_2px_2px_4px_rgba(163,177,198,0.4),_inset_-2px_-2px_4px_rgba(255,255,255,0.8)] border border-white/60 dark:border-white/[0.06]"
                                                    >
                                                        <PlusCircle className="w-3.5 h-3.5" />
                                                        <span>Add Lead</span>
                                                    </button>
                                                    <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                                                        Send RFQ emails or call stores to collect quotations
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                                            {group.potentialSuppliers.map((supplier) => {
                                                const hasEmail = Boolean(supplier.email && supplier.email.includes("@"));
                                                const isDeleting = deletingSupplierId === supplier.id;
                                                const isPromoting = promotingSupplierId === supplier.id;
                                                const hasQuote = Boolean(supplier.submittedQuote);

                                                return (
                                                    <div
                                                        key={supplier.id}
                                                        className={`rounded-3xl bg-[#e8eef6] dark:bg-[#161826] transition-all p-4 sm:p-5 flex flex-col justify-between space-y-4 group relative overflow-hidden ${
                                                            hasQuote
                                                                ? "border-2 border-pink-500/80 shadow-[-6px_-6px_16px_rgba(255,255,255,0.9),_6px_6px_16px_rgba(236,72,153,0.25)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.03),_4px_4px_16px_rgba(236,72,153,0.2)]"
                                                                : "border border-white/60 dark:border-white/[0.06] shadow-[-6px_-6px_16px_rgba(255,255,255,0.85),_6px_6px_16px_rgba(163,177,198,0.35)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.03),_4px_4px_12px_rgba(0,0,0,0.45)]"
                                                        } hover:shadow-[-8px_-8px_20px_rgba(255,255,255,0.95),_8px_8px_20px_rgba(163,177,198,0.45)] dark:hover:shadow-[-5px_-5px_15px_rgba(255,255,255,0.05),_5px_5px_15px_rgba(0,0,0,0.6)]`}
                                                    >
                                                        {/* Top & Middle Content (Grouped so it doesn't stretch awkwardly) */}
                                                        <div className="space-y-3 flex-1 flex flex-col justify-start">
                                                            {/* Top Card Header */}
                                                            <div>
                                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        <StatusBadge tone="amber" size="xs" dot>
                                                                            Pending Evaluation
                                                                        </StatusBadge>

                                                                        <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 bg-[#e2e8f0] dark:bg-[#12131f] px-2.5 py-0.5 rounded-lg shadow-[inset_1px_1px_3px_rgba(163,177,198,0.3),_inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5),_inset_-1px_-1px_3px_rgba(255,255,255,0.03)] border border-slate-200/50 dark:border-white/[0.04]">
                                                                            {supplier.distanceKm.toFixed(1)} km from HQ
                                                                        </span>
                                                                    </div>

                                                                    {/* Action buttons in header */}
                                                                    <div className="flex items-center gap-1">
                                                                        {/* Remove Potential Supplier Button */}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleRemoveSupplier(supplier.id, supplier.name, group)}
                                                                            disabled={isDeleting}
                                                                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 bg-[#e8eef6] dark:bg-[#161826] shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)] dark:shadow-[-1px_-1px_4px_rgba(255,255,255,0.03),_1px_1px_4px_rgba(0,0,0,0.4)] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.2)] transition-all cursor-pointer border border-white/50 dark:border-white/[0.04]"
                                                                            title={`Remove from Potential Suppliers for ${group.itemName}`}
                                                                        >
                                                                            {isDeleting ? (
                                                                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-500" />
                                                                            ) : (
                                                                                <Trash2 className="w-4 h-4" />
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                {/* Store Name & Category */}
                                                                <h4 className="font-black text-sm text-slate-900 dark:text-white tracking-tight leading-snug group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                                                                    {supplier.name}
                                                                </h4>
                                                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#e8eef6] dark:bg-[#161826] text-pink-600 dark:text-pink-400 shadow-[inset_1px_1px_3px_rgba(163,177,198,0.25),_inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.4),_inset_-1px_-1px_3px_rgba(255,255,255,0.03)] border border-pink-200/50 dark:border-pink-900/40 w-fit mt-1">
                                                                    <Tag className="w-3 h-3 shrink-0 text-pink-500" />
                                                                    <span className="text-[11px] font-black uppercase tracking-wide">
                                                                        {supplier.category || "General Store / Supplier"}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Supplier Details & Contact Info */}
                                                            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                                                                {/* Address */}
                                                                <div className="flex items-start gap-2">
                                                                    <MapPin className="w-3.5 h-3.5 text-pink-500 shrink-0 mt-0.5" />
                                                                    <span className="text-[11px] font-medium leading-relaxed">
                                                                        {supplier.location}
                                                                    </span>
                                                                </div>

                                                                {/* Phone */}
                                                                {supplier.phone && (
                                                                    <div className="flex items-center gap-2">
                                                                        <Phone className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                                                                        <a
                                                                            href={`tel:${supplier.phone}`}
                                                                            className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-pink-600 hover:underline"
                                                                        >
                                                                            {supplier.phone}
                                                                        </a>
                                                                    </div>
                                                                )}

                                                                {/* Email */}
                                                                {hasEmail ? (
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                            <Mail className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                                                                            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[180px]" title={supplier.email}>
                                                                                {supplier.email}
                                                                            </span>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setAddEmailSupplier({ supplier, group });
                                                                                setInputEmail(supplier.email || "");
                                                                            }}
                                                                            className="text-[10px] text-slate-400 hover:text-pink-600 font-bold underline cursor-pointer shrink-0"
                                                                            title="Edit supplier email"
                                                                        >
                                                                            Edit
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center justify-between gap-2 text-[11px] text-amber-700 dark:text-amber-300 bg-[#e2e8f0]/90 dark:bg-[#12131f] p-2.5 rounded-xl border border-amber-300/60 dark:border-amber-900/50 shadow-[inset_1.5px_1.5px_4px_rgba(163,177,198,0.3),_inset_-1.5px_-1.5px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.5),_inset_-1.5px_-1.5px_4px_rgba(255,255,255,0.03)]">
                                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                                            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                                                            <span className="truncate">No email listed on OSM</span>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setAddEmailSupplier({ supplier, group });
                                                                                setInputEmail(supplier.email || "");
                                                                            }}
                                                                            className="px-2 py-1 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-[10px] font-black shrink-0 transition-all flex items-center gap-1 cursor-pointer shadow-[-2px_-2px_5px_rgba(255,255,255,0.4),_2px_2px_6px_rgba(236,72,153,0.35)] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.3)]"
                                                                            title="Add supplier email to send RFQ quotation form"
                                                                        >
                                                                            <Mail className="w-3 h-3" />
                                                                            <span>+ Add Email</span>
                                                                        </button>
                                                                    </div>
                                                                )}

                                                                {/* Products Sourced */}
                                                                {supplier.products && (
                                                                    <div className="pt-1.5 border-t border-slate-200/50 dark:border-white/[0.04]">
                                                                        <span className="text-[10px] font-extrabold uppercase text-slate-400 block mb-0.5">
                                                                            Products / Sourced Catalog:
                                                                        </span>
                                                                        <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 bg-[#e2e8f0]/90 dark:bg-[#12131f] p-2.5 rounded-xl shadow-[inset_1.5px_1.5px_4px_rgba(163,177,198,0.3),_inset_-1.5px_-1.5px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.5),_inset_-1.5px_-1.5px_4px_rgba(255,255,255,0.03)] border border-slate-200/60 dark:border-white/[0.04]">
                                                                            {supplier.products}
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                {/* Services Offered */}
                                                                {supplier.services_offered && supplier.services_offered.length > 0 && !supplier.submittedQuote && (
                                                                    <div className="pt-1.5 space-y-1">
                                                                        <span className="text-[10px] font-extrabold uppercase text-slate-400 block">
                                                                            Services Offered:
                                                                        </span>
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {supplier.services_offered.map((svc, sIdx) => (
                                                                                <span
                                                                                    key={sIdx}
                                                                                    className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-[#e2e8f0] dark:bg-[#12131f] text-pink-700 dark:text-pink-300 border border-pink-200/50 dark:border-pink-900/40 shadow-[inset_1px_1px_2px_rgba(163,177,198,0.25),_inset_-1px_-1px_2px_rgba(255,255,255,0.7)]"
                                                                                >
                                                                                    ✓ {svc}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Highly Visible Official Submitted Quotation Box */}
                                                            {supplier.submittedQuote ? (
                                                                <div className="mt-2.5 p-4 rounded-2xl bg-[#e2e8f0]/90 dark:bg-[#131522] border-2 border-pink-500/80 shadow-[inset_2px_2px_6px_rgba(163,177,198,0.35),_inset_-2px_-2px_6px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.5),_inset_-2px_-2px_6px_rgba(255,255,255,0.03)] space-y-3">
                                                                    <div className="flex items-center justify-between gap-1.5 border-b border-pink-500/30 pb-2.5">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <Sparkles className="w-4 h-4 text-pink-600 dark:text-pink-400 shrink-0" />
                                                                            <span className="text-xs font-black uppercase text-pink-700 dark:text-pink-300 tracking-wider">
                                                                                Vendor Quotation Proposal
                                                                            </span>
                                                                        </div>
                                                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase shadow-[-2px_-2px_5px_rgba(255,255,255,0.3),_2px_2px_6px_rgba(0,0,0,0.15)] ${
                                                                            supplier.submittedQuote.status === 'accepted'
                                                                                ? 'bg-emerald-600 text-white border border-emerald-500'
                                                                                : 'bg-pink-600 text-white border border-pink-500'
                                                                        }`}>
                                                                            {supplier.submittedQuote.status === 'accepted' ? 'Bid Awarded' : 'Quote Received'}
                                                                        </span>
                                                                    </div>

                                                                    {/* Pricing display with Itemized Financial Breakdown */}
                                                                    <div className="p-3 rounded-xl bg-[#e8eef6] dark:bg-[#181a29] border border-pink-500/30 shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.4)] space-y-2">
                                                                        <div className="flex items-baseline justify-between">
                                                                            <div>
                                                                                <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 block">Unit Price</span>
                                                                                <span className="font-mono text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                                                                                    ₱{Number(supplier.submittedQuote.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                                    <span className="text-[10px] font-bold text-slate-400">/{supplier.submittedQuote.unit || 'unit'}</span>
                                                                                </span>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <span className="text-[10px] font-black uppercase text-pink-600 dark:text-pink-400 block">Total Bid Value</span>
                                                                                <span className="font-mono text-base sm:text-lg font-black text-pink-600 dark:text-pink-400">
                                                                                    ₱{Number(supplier.submittedQuote.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                                </span>
                                                                            </div>
                                                                        </div>

                                                                        {/* Optional itemized fees & tax badges if recorded */}
                                                                        {(Number(supplier.submittedQuote.discount || 0) > 0 ||
                                                                          Number(supplier.submittedQuote.shipping_fee || 0) > 0 ||
                                                                          Number(supplier.submittedQuote.tax_amount || 0) > 0 ||
                                                                          supplier.submittedQuote.tax_type) && (
                                                                            <div className="pt-2 border-t border-slate-200/80 dark:border-white/5 grid grid-cols-2 gap-1.5 text-[10px]">
                                                                                {Number(supplier.submittedQuote.subtotal || 0) > 0 && (
                                                                                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                                                                                        <span>Subtotal:</span>
                                                                                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                                                                            ₱{Number(supplier.submittedQuote.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                                        </span>
                                                                                    </div>
                                                                                )}
                                                                                {Number(supplier.submittedQuote.discount || 0) > 0 && (
                                                                                    <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                                                                                        <span>Discount:</span>
                                                                                        <span className="font-mono">
                                                                                            -₱{Number(supplier.submittedQuote.discount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                                        </span>
                                                                                    </div>
                                                                                )}
                                                                                {Number(supplier.submittedQuote.shipping_fee || 0) > 0 && (
                                                                                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                                                                                        <span>Shipping:</span>
                                                                                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                                                                            +₱{Number(supplier.submittedQuote.shipping_fee).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                                        </span>
                                                                                    </div>
                                                                                )}
                                                                                {(Number(supplier.submittedQuote.tax_amount || 0) > 0 || supplier.submittedQuote.tax_type) && (
                                                                                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                                                                                        <span>Tax ({supplier.submittedQuote.tax_type || `${supplier.submittedQuote.tax_rate || 0}%`}):</span>
                                                                                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                                                                            +₱{Number(supplier.submittedQuote.tax_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                                        </span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Availability & Lead time */}
                                                                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                                                                        <div className="bg-[#e8eef6] dark:bg-[#181a29] border border-white/60 dark:border-white/[0.06] p-2.5 rounded-xl shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.25)] dark:shadow-[-1px_-1px_4px_rgba(255,255,255,0.02),_1px_1px_4px_rgba(0,0,0,0.4)]">
                                                                            <span className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 block">Stock Readiness</span>
                                                                            <span className="font-bold text-slate-900 dark:text-white truncate block mt-0.5">
                                                                                {supplier.submittedQuote.availability}
                                                                            </span>
                                                                        </div>
                                                                        <div className="bg-[#e8eef6] dark:bg-[#181a29] border border-white/60 dark:border-white/[0.06] p-2.5 rounded-xl shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.25)] dark:shadow-[-1px_-1px_4px_rgba(255,255,255,0.02),_1px_1px_4px_rgba(0,0,0,0.4)]">
                                                                            <span className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 block">Turnaround</span>
                                                                            <span className="font-bold text-slate-900 dark:text-white truncate block mt-0.5">
                                                                                {supplier.submittedQuote.lead_time_days} days
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Buyer Delivery Destination */}
                                                                    <div className="bg-[#e8eef6] dark:bg-[#181a29] border border-white/60 dark:border-white/[0.06] p-2.5 rounded-xl shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.25)] dark:shadow-[-1px_-1px_4px_rgba(255,255,255,0.02),_1px_1px_4px_rgba(0,0,0,0.4)] flex items-center justify-between text-[11px] gap-2">
                                                                        <span className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 shrink-0">Buyer Destination:</span>
                                                                        <span className="font-bold text-slate-800 dark:text-slate-200 text-[10px] truncate text-right" title="352 Escolta St, Binondo, Manila, 1006 Metro Manila">
                                                                            352 Escolta St, Binondo, Manila, 1006 Metro Manila
                                                                        </span>
                                                                    </div>

                                                                    {/* Services Inclusions */}
                                                                    {supplier.submittedQuote.services_offered && supplier.submittedQuote.services_offered.length > 0 && (
                                                                        <div className="space-y-1.5 pt-1">
                                                                            <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 block">Services Included:</span>
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {supplier.submittedQuote.services_offered.map((svc, sIdx) => (
                                                                                    <span
                                                                                        key={sIdx}
                                                                                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-[#e2e8f0] dark:bg-[#12131f] text-pink-800 dark:text-pink-200 border border-pink-300/50 dark:border-pink-800/50 shadow-[inset_1px_1px_3px_rgba(163,177,198,0.25),_inset_-1px_-1px_3px_rgba(255,255,255,0.7)]"
                                                                                    >
                                                                                        ✓ {svc}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {/* Notes if any */}
                                                                    {supplier.submittedQuote.notes && (
                                                                        <p className="text-[11px] text-slate-700 dark:text-slate-200 italic bg-[#e8eef6] dark:bg-[#181a29] p-2.5 rounded-xl border border-pink-500/25 shadow-[inset_1.5px_1.5px_4px_rgba(163,177,198,0.25),_inset_-1.5px_-1.5px_4px_rgba(255,255,255,0.7)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.4)]">
                                                                            &ldquo;{supplier.submittedQuote.notes}&rdquo;
                                                                        </p>
                                                                    )}

                                                                    {/* Review Proposal Button (View Only Modal) */}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setViewQuotationModal({ supplier, quote: supplier.submittedQuote })}
                                                                        className="w-full mt-1 py-2 px-3.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-[-2px_-2px_6px_rgba(255,255,255,0.4),_2px_2px_8px_rgba(236,72,153,0.35)] active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2)]"
                                                                    >
                                                                        <Eye className="w-3.5 h-3.5" />
                                                                        <span>Review Vendor Quotation &amp; Files</span>
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                /* Structured Non-Stretching Outreach & RFQ Panel for Sourced Leads Awaiting Quote */
                                                                <div className="mt-2.5 p-3.5 rounded-2xl bg-[#e2e8f0]/90 dark:bg-[#131522] border border-slate-300/70 dark:border-white/10 shadow-[inset_2px_2px_6px_rgba(163,177,198,0.35),_inset_-2px_-2px_6px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.5),_inset_-2px_-2px_6px_rgba(255,255,255,0.03)] space-y-2.5 text-xs">
                                                                    <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 dark:border-white/[0.04] pb-2">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                                                            <span className="font-black text-slate-700 dark:text-slate-200 text-[11px] uppercase tracking-wide">
                                                                                Outreach Pipeline
                                                                            </span>
                                                                        </div>
                                                                        {supplier.hasRfqSent ? (
                                                                            <span className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-300 bg-[#e8eef6] dark:bg-[#181a29] px-2.5 py-0.5 rounded-md border border-blue-500/30 flex items-center gap-1 shadow-[inset_1px_1px_2px_rgba(163,177,198,0.3)] dark:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.4)]">
                                                                                <MailCheck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                                                                <span>RFQ Sent {supplier.rfqSentAt ? `• ${supplier.rfqSentAt}` : ""}</span>
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 bg-[#e8eef6] dark:bg-[#181a29] px-2.5 py-0.5 rounded-md border border-amber-500/30 shadow-[inset_1px_1px_2px_rgba(163,177,198,0.3)] dark:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.4)]">
                                                                                No Quote Yet
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    <div className="space-y-1 text-[11px]">
                                                                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                                                                            <span>Target Item:</span>
                                                                            <span className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[150px]" title={group.itemName}>
                                                                                {group.itemName}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                                                                            <span>Required Qty:</span>
                                                                            <span className="font-bold text-slate-700 dark:text-slate-200">
                                                                                {(() => {
                                                                                    const qty = group.quantityRequested;
                                                                                    const unit = group.unit;
                                                                                    if (supplier.products) {
                                                                                        const pMatch = supplier.products.match(/^(\d+)\s*([a-zA-Z]+)?\s+of\s+/i);
                                                                                        if (pMatch && Number(pMatch[1]) > 0 && (!qty || qty === 1 || qty < Number(pMatch[1]))) {
                                                                                            return `${pMatch[1]} ${pMatch[2] || unit}`;
                                                                                        }
                                                                                    }
                                                                                    return `${qty} ${unit}`;
                                                                                })()}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    <p className="text-[10px] font-medium text-slate-600 dark:text-slate-300 bg-[#e8eef6] dark:bg-[#181a29] p-2.5 rounded-xl shadow-[inset_1.5px_1.5px_4px_rgba(163,177,198,0.25),_inset_-1.5px_-1.5px_4px_rgba(255,255,255,0.7)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.4)] border border-slate-200/50 dark:border-white/[0.04]">
                                                                        {supplier.hasRfqSent
                                                                            ? `Quotation request previously dispatched${supplier.rfqSentAt ? ` on ${supplier.rfqSentAt}` : ''}. You can send a polite follow-up email if awaiting proposal.`
                                                                            : hasEmail
                                                                            ? "Official RFQ email inquiry can be sent directly to request pricing."
                                                                            : supplier.phone
                                                                            ? `Contact ${supplier.phone} to ask for their quotation email.`
                                                                            : "Visit location in person to request vendor proposal."}
                                                                    </p>

                                                                    {!hasEmail && (
                                                                        <div className="pt-1 flex items-center justify-between gap-2">
                                                                            <span className="text-[10px] text-slate-500">Have their quotation email?</span>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setAddEmailSupplier({ supplier, group });
                                                                                    setInputEmail(supplier.email || "");
                                                                                }}
                                                                                className="text-[10px] font-black text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1 cursor-pointer"
                                                                            >
                                                                                <Mail className="w-3 h-3" />
                                                                                <span>Enter Email & Send RFQ</span>
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Meeting Set Alert Banner if scheduled/pending meeting exists */}
                                                        {(() => {
                                                            const cardMeeting = getSupplierActiveMeeting(supplier, group);
                                                            if (!cardMeeting) return null;
                                                            return (
                                                                <div className="mt-2.5 px-3 py-2 rounded-xl bg-pink-500/10 dark:bg-pink-900/20 border border-pink-500/30 flex items-center justify-between gap-2 text-[11px] text-pink-700 dark:text-pink-300">
                                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                                        <Video className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400 shrink-0" />
                                                                        <span className="font-bold truncate">
                                                                            Meeting: {cardMeeting.meeting_date} ({cardMeeting.start_time})
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-pink-600 text-white shrink-0">
                                                                        {cardMeeting.status || "Scheduled"}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })()}

                                                        {/* Bottom Actions Bar */}
                                                        <div className="pt-3 border-t border-slate-200/60 dark:border-white/[0.05] flex items-center justify-between gap-2 flex-wrap">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                {/* Map Preview Icon */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setMapSupplier(supplier)}
                                                                    className="p-2 rounded-xl bg-[#e8eef6] dark:bg-[#181a29] text-slate-600 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_2px_2px_6px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.03),_2px_2px_5px_rgba(0,0,0,0.4)] active:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.2)] border border-white/60 dark:border-white/[0.05] transition-all cursor-pointer"
                                                                    title="View supplier location on Map"
                                                                >
                                                                    <MapPin className="w-3.5 h-3.5" />
                                                                </button>

                                                                {/* Meeting Action Button: If meeting is set (pending or scheduled) -> Update Meeting + Remove button; Else Set Meeting */}
                                                                {(() => {
                                                                    const currentMeeting = getSupplierActiveMeeting(supplier, group);

                                                                    if (currentMeeting) {
                                                                        return (
                                                                            <div className="flex items-center gap-1">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setMeetingModalData({ supplier, group, quote: supplier.submittedQuote, meeting: currentMeeting })}
                                                                                    className="px-2.5 py-1.5 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 border border-pink-500/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_2px_2px_6px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.03),_2px_2px_5px_rgba(0,0,0,0.4)] active:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.2)]"
                                                                                    title={`Update meeting with ${supplier.name} (${currentMeeting.meeting_date} @ ${currentMeeting.start_time})`}
                                                                                >
                                                                                    <Video className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
                                                                                    <span className="text-[11px] font-black">Update Meeting</span>
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleRemoveMeeting(currentMeeting.id, supplier.name)}
                                                                                    disabled={removingMeetingId === currentMeeting.id}
                                                                                    className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 border border-rose-500/30 text-xs transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_2px_2px_6px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.03),_2px_2px_5px_rgba(0,0,0,0.4)] active:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.2)]"
                                                                                    title={`Remove scheduled meeting with ${supplier.name}`}
                                                                                >
                                                                                    {removingMeetingId === currentMeeting.id ? (
                                                                                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-600" />
                                                                                    ) : (
                                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                                    )}
                                                                                </button>
                                                                            </div>
                                                                        );
                                                                    }

                                                                    return (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setMeetingModalData({ supplier, group, quote: supplier.submittedQuote, meeting: null })}
                                                                            className="px-2.5 py-1.5 rounded-xl bg-[#e8eef6] dark:bg-[#181a29] text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 border border-pink-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_2px_2px_6px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.03),_2px_2px_5px_rgba(0,0,0,0.4)] active:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.2)]"
                                                                            title={`Set negotiation or clarification meeting with ${supplier.name}`}
                                                                        >
                                                                            <Video className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
                                                                            <span className="text-[11px] font-black">Set Meeting</span>
                                                                        </button>
                                                                    );
                                                                })()}
                                                            </div>

                                                            {/* Right Action: If Quote Exists -> Award Bid / Accepted Pill + Register CTA; Else RFQ/Call CTA */}
                                                            {supplier.submittedQuote && supplier.submittedQuote.status !== 'accepted' ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAwardBid(supplier, supplier.submittedQuote!)}
                                                                    disabled={awardingQuoteId === supplier.submittedQuote.id}
                                                                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-[-2px_-2px_6px_rgba(255,255,255,0.4),_2px_2px_8px_rgba(16,185,129,0.35)] active:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.2)]"
                                                                    title="Award bid to this vendor"
                                                                >
                                                                    {awardingQuoteId === supplier.submittedQuote.id ? (
                                                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                                    ) : (
                                                                        <Sparkles className="w-3.5 h-3.5" />
                                                                    )}
                                                                    <span>Award Bid</span>
                                                                </button>
                                                            ) : supplier.submittedQuote && supplier.submittedQuote.status === 'accepted' ? (
                                                                <div className="flex items-center gap-2">
                                                                    <div className="px-2.5 py-1.5 rounded-xl bg-[#e2e8f0] dark:bg-[#12131f] text-emerald-700 dark:text-emerald-300 text-xs font-black flex items-center gap-1 border border-emerald-500/40 shadow-[inset_1px_1px_3px_rgba(163,177,198,0.25)]">
                                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                                                        <span>Bid Awarded</span>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handlePromoteSupplier(supplier)}
                                                                        className="px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black transition-all flex items-center gap-1 cursor-pointer shadow-[-2px_-2px_6px_rgba(255,255,255,0.4),_2px_2px_8px_rgba(236,72,153,0.35)] active:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.2)]"
                                                                        title="Proceed to full supplier registration and activation"
                                                                    >
                                                                        <span>Register &amp; Activate &rarr;</span>
                                                                    </button>
                                                                </div>
                                                            ) : hasEmail ? (
                                                                supplier.hasRfqSent ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenEmailModal(supplier, group, true)}
                                                                        className="px-3 py-1.5 rounded-xl bg-[#e8eef6] dark:bg-[#181a29] text-amber-800 dark:text-amber-200 border border-amber-500/40 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_2px_2px_6px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.03),_2px_2px_5px_rgba(0,0,0,0.4)] active:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.2)]"
                                                                        title={`Send follow-up quotation inquiry email to ${supplier.email}`}
                                                                    >
                                                                        <RotateCcw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                                                        <span>Follow-up RFQ</span>
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenEmailModal(supplier, group, false)}
                                                                        className="px-3.5 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-[-2px_-2px_6px_rgba(255,255,255,0.4),_2px_2px_8px_rgba(236,72,153,0.35)] active:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.2)]"
                                                                        title={`Send quotation and bidding inquiry email to ${supplier.email}`}
                                                                    >
                                                                        <Send className="w-3 h-3" />
                                                                        <span>Send RFQ Email</span>
                                                                    </button>
                                                                )
                                                            ) : (
                                                                <div className="flex items-center gap-1.5">
                                                                    {supplier.phone && (
                                                                        <a
                                                                            href={`tel:${supplier.phone}`}
                                                                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black flex items-center gap-1 transition-all shadow-[-2px_-2px_6px_rgba(255,255,255,0.4),_2px_2px_8px_rgba(16,185,129,0.35)] active:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.2)]"
                                                                            title="Call supplier directly"
                                                                        >
                                                                            <PhoneCall className="w-3 h-3" />
                                                                            <span>Call</span>
                                                                        </a>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setAddEmailSupplier({ supplier, group });
                                                                            setInputEmail(supplier.email || "");
                                                                        }}
                                                                        className="px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-[-2px_-2px_6px_rgba(255,255,255,0.4),_2px_2px_8px_rgba(236,72,153,0.35)] active:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.2)]"
                                                                        title="Add email address to send quotation inquiry form"
                                                                    >
                                                                        <Mail className="w-3 h-3" />
                                                                        <span>+ Add Email</span>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal 1: Interactive Map Preview for Sourced Potential Supplier */}
            {mapSupplier && (
                <Portal>
                    <div
                        className="fixed inset-0 bg-slate-950/70 dark:bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
                        onClick={() => setMapSupplier(null)}
                    >
                        <div
                            className="relative w-full max-w-3xl bg-[#ebf0f7] dark:bg-[#161826] rounded-3xl border border-white/80 dark:border-white/10 shadow-[-8px_-8px_20px_rgba(255,255,255,0.9),_8px_8px_20px_rgba(163,177,198,0.45)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.03),_6px_6px_16px_rgba(0,0,0,0.6)] overflow-hidden my-auto flex flex-col max-h-[90vh]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Map Modal Header */}
                            <div className="p-4 sm:p-5 border-b border-slate-300/80 dark:border-white/10 flex items-center justify-between bg-[#ebf0f7] dark:bg-[#141624]">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-pink-600 text-white flex items-center justify-center shrink-0 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_2px_2px_6px_rgba(219,39,119,0.4)]">
                                        <MapPin className="w-5 h-5 drop-shadow" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                                            {mapSupplier.name}
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {mapSupplier.location} • <span className="font-bold text-pink-600 dark:text-pink-400">{mapSupplier.distanceKm.toFixed(1)} km from Airship HQ</span>
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setMapSupplier(null)}
                                    className="w-8 h-8 rounded-xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center border border-white/80 dark:border-white/10 shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)] dark:shadow-[-1px_-1px_3px_rgba(255,255,255,0.04),_2px_2px_4px_rgba(0,0,0,0.4)] active:shadow-[inset_1px_1px_2px_rgba(163,177,198,0.4)] cursor-pointer transition-all"
                                    aria-label="Close map preview"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Leaflet Map Body */}
                            <div className="w-full h-[420px] relative bg-[#0f111a]">
                                <SupplierSourcingMap
                                    suppliers={[
                                        {
                                            id: mapSupplier.id,
                                            name: mapSupplier.name,
                                            category: mapSupplier.category,
                                            location: mapSupplier.location,
                                            phone: mapSupplier.phone,
                                            email: mapSupplier.email,
                                            products: mapSupplier.products,
                                            coords: mapSupplier.coords,
                                            distanceKm: mapSupplier.distanceKm,
                                        },
                                    ]}
                                    selectedSupplierId={mapSupplier.id}
                                    onSelectSupplier={() => {}}
                                    hqCoord={AIRSHIP_HQ}
                                    radiusKm={Math.max(10, Math.ceil(mapSupplier.distanceKm + 2))}
                                />
                            </div>

                            {/* Map Modal Footer */}
                            <div className="p-4 border-t border-slate-300/80 dark:border-white/10 flex items-center justify-between bg-[#ebf0f7] dark:bg-[#141624]">
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[340px]">
                                    Physical Address: <span className="font-semibold text-slate-700 dark:text-slate-200">{mapSupplier.location}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setMapSupplier(null)}
                                        className="px-4 py-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-700 dark:text-slate-300 text-xs font-bold border border-white/80 dark:border-white/10 shadow-[-2px_-2px_5px_rgba(255,255,255,0.85),_2px_2px_5px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.03),_2px_2px_5px_rgba(0,0,0,0.4)] active:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4)] hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
                                    >
                                        Close Map
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}

            {/* Modal 2: Send RFQ & Price Quotation Email Modal */}
            {emailModalData && (
                <Portal>
                    <div
                        className="fixed inset-0 bg-slate-950/75 dark:bg-black/85 backdrop-blur-sm z-[110] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
                        onClick={() => setEmailModalData(null)}
                    >
                        <div
                            className="relative w-full max-w-2xl bg-[#ebf0f7] dark:bg-[#161826] rounded-3xl border border-white/80 dark:border-white/10 shadow-[-8px_-8px_20px_rgba(255,255,255,0.9),_8px_8px_20px_rgba(163,177,198,0.45)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.03),_6px_6px_16px_rgba(0,0,0,0.6)] overflow-hidden my-auto flex flex-col max-h-[92vh]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Email Modal Header */}
                            <div className="p-5 border-b border-slate-300/80 dark:border-white/10 flex items-center justify-between bg-[#ebf0f7] dark:bg-[#141624]">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-pink-600 text-white flex items-center justify-center shrink-0 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_2px_2px_6px_rgba(219,39,119,0.4)]">
                                        <Mail className="w-5 h-5 drop-shadow" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-base text-slate-900 dark:text-white">
                                            {emailModalData.supplier.hasRfqSent ? "Send Follow-up RFQ Email" : "Send RFQ & Price Quotation Email"}
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Recipient: <strong className="text-pink-600 dark:text-pink-400">{emailModalData.supplier.email}</strong> ({emailModalData.supplier.name})
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setEmailModalData(null)}
                                    className="w-8 h-8 rounded-xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center border border-white/80 dark:border-white/10 shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)] dark:shadow-[-1px_-1px_3px_rgba(255,255,255,0.04),_2px_2px_4px_rgba(0,0,0,0.4)] active:shadow-[inset_1px_1px_2px_rgba(163,177,198,0.4)] cursor-pointer transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Email Modal Body */}
                            <div className="p-5 overflow-y-auto space-y-4 text-xs">
                                {/* Requisition Summary Box */}
                                <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-3px_-3px_7px_rgba(255,255,255,0.8),_3px_3px_7px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.03),_3px_3px_6px_rgba(0,0,0,0.4)] space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono text-xs font-black text-pink-600 dark:text-pink-400">
                                            {emailModalData.group.requestNumber}
                                        </span>
                                        <span className="text-[11px] font-bold text-slate-500">
                                            Qty: {emailModalData.group.quantityRequested} {emailModalData.group.unit}
                                        </span>
                                    </div>
                                    <p className="font-bold text-slate-800 dark:text-slate-200">
                                        Item: {emailModalData.group.itemName}
                                    </p>
                                </div>

                                {/* Editable Message */}
                                <div className="space-y-1.5">
                                    <label className="font-bold text-slate-700 dark:text-slate-300">
                                        Message to Supplier:
                                    </label>
                                    <textarea
                                        rows={5}
                                        value={customEmailMessage}
                                        onChange={(e) => setCustomEmailMessage(e.target.value)}
                                        className="w-full p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131e] border-0 text-xs font-medium text-slate-800 dark:text-slate-100 shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-1px_-1px_3px_rgba(255,255,255,0.04)] focus:outline-none focus:ring-2 focus:ring-pink-500/40 transition-all leading-relaxed"
                                    />
                                </div>

                                {/* Interactive Button Preview Notice */}
                                <div className="p-3.5 rounded-2xl bg-pink-50/80 dark:bg-pink-950/30 border border-pink-200/80 dark:border-pink-800/40 space-y-2">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-pink-600 dark:text-pink-400 block">
                                        Interactive Action Button Included in Email:
                                    </span>
                                    <div className="p-3 rounded-xl bg-[#ebf0f7] dark:bg-[#181a26] border border-pink-200/40 flex items-center justify-between gap-2 shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.25)]">
                                        <div className="flex items-center gap-2">
                                            <Send className="w-3.5 h-3.5 text-pink-500" />
                                            <span className="font-bold text-slate-800 dark:text-slate-200">
                                                [ Submit Quotation & Service Proposal ]
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-slate-400">
                                            Links to Supplier Response Portal
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-pink-700 dark:text-pink-300">
                                        When the recipient clicks this button in their email, they can enter their services, unit price, stock availability, and submit their proposal directly.
                                    </p>
                                </div>
                            </div>

                            {/* Email Modal Footer */}
                            <div className="p-4 border-t border-slate-300/80 dark:border-white/10 flex items-center justify-end gap-3 bg-[#ebf0f7] dark:bg-[#141624]">
                                <button
                                    type="button"
                                    onClick={() => setEmailModalData(null)}
                                    disabled={isSendingEmail}
                                    className="px-4 py-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-700 dark:text-slate-300 text-xs font-bold border border-white/80 dark:border-white/10 shadow-[-2px_-2px_5px_rgba(255,255,255,0.85),_2px_2px_5px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.03),_2px_2px_5px_rgba(0,0,0,0.4)] active:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4)] hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    onClick={handleSendRFQEmail}
                                    disabled={isSendingEmail}
                                    className="px-5 py-2.5 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black shadow-[-2px_-2px_6px_rgba(255,255,255,0.5),_3px_3px_8px_rgba(219,39,119,0.45)] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.3)] flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                                >
                                    {isSendingEmail ? (
                                        <>
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            <span>Sending Email...</span>
                                        </>
                                    ) : emailModalData.supplier.hasRfqSent ? (
                                        <>
                                            <RotateCcw className="w-3.5 h-3.5" />
                                            <span>Send Follow-up RFQ</span>
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-3.5 h-3.5" />
                                            <span>Send RFQ Email</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}

            {/* Modal 3: Award Bid Confirmation Modal */}
            {awardConfirmation && (
                <Portal>
                    <div
                        className="fixed inset-0 bg-slate-950/75 dark:bg-black/85 backdrop-blur-sm z-[120] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
                        onClick={() => setAwardConfirmation(null)}
                    >
                        <div
                            className="relative w-full max-w-lg bg-[#ebf0f7] dark:bg-[#161826] rounded-3xl border border-white/80 dark:border-white/10 shadow-[-8px_-8px_20px_rgba(255,255,255,0.9),_8px_8px_20px_rgba(163,177,198,0.45)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.03),_6px_6px_16px_rgba(0,0,0,0.6)] overflow-hidden my-auto flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="p-5 border-b border-slate-300/80 dark:border-white/10 flex items-center justify-between bg-[#ebf0f7] dark:bg-[#141624]">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_2px_2px_6px_rgba(16,185,129,0.4)]">
                                        <Award className="w-5 h-5 text-amber-300 drop-shadow" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-base text-slate-900 dark:text-white">
                                            Confirm Procurement Bid Award
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Requisition #{awardConfirmation.quote.request_number || "RFQ"}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setAwardConfirmation(null)}
                                    className="w-8 h-8 rounded-xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center border border-white/80 dark:border-white/10 shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)] dark:shadow-[-1px_-1px_3px_rgba(255,255,255,0.04),_2px_2px_4px_rgba(0,0,0,0.4)] active:shadow-[inset_1px_1px_2px_rgba(163,177,198,0.4)] cursor-pointer transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-5 space-y-4 text-xs">
                                <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#141624] border border-white/80 dark:border-white/10 shadow-[inset_2px_2px_5px_rgba(163,177,198,0.35),_inset_-2px_-2px_5px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),_inset_-1px_-1px_3px_rgba(255,255,255,0.04)]">
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-relaxed">
                                        Award the procurement bid to <strong className="text-emerald-700 dark:text-emerald-400 font-black">&ldquo;{awardConfirmation.supplier.name}&rdquo;</strong> for <span className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400">₱{Number(awardConfirmation.quote.total_amount).toLocaleString()}</span>?
                                    </p>
                                </div>

                                {/* Breakdown Card */}
                                <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-3px_-3px_7px_rgba(255,255,255,0.8),_3px_3px_7px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.03),_3px_3px_6px_rgba(0,0,0,0.4)] space-y-2.5">
                                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                                        <span>Category:</span>
                                        <span className="font-semibold text-slate-900 dark:text-white">
                                            {(awardConfirmation.quote as any).category || awardConfirmation.supplier.category || "General Supplies"}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                                        <span>Target Item:</span>
                                        <span className="font-bold text-slate-900 dark:text-white">
                                            {awardConfirmation.quote.item_name || "Sourced Goods"}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                                        <span>Offered Unit Price:</span>
                                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                                            ₱{Number(awardConfirmation.quote.unit_price).toLocaleString()}/{awardConfirmation.quote.unit || "unit"} (Qty: {Number(awardConfirmation.quote.quantity) || 1})
                                        </span>
                                    </div>
                                    {Number((awardConfirmation.quote as any).discount || 0) > 0 && (
                                        <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                                            <span>Discount:</span>
                                            <span className="font-mono font-bold">
                                                -₱{Number((awardConfirmation.quote as any).discount).toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                    {Number((awardConfirmation.quote as any).shipping_fee || 0) > 0 && (
                                        <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                                            <span>Shipping Fee:</span>
                                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                                                +₱{Number((awardConfirmation.quote as any).shipping_fee).toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                                        <span>Delivery Turnaround:</span>
                                        <span className="font-bold text-slate-900 dark:text-white">
                                            {awardConfirmation.quote.lead_time_days} days
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                                        <span>Stock Readiness:</span>
                                        <span className="font-bold text-slate-900 dark:text-white">
                                            {awardConfirmation.quote.availability || "In Stock"}
                                        </span>
                                    </div>
                                    <div className="flex items-start justify-between text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200/80 dark:border-white/5">
                                        <span className="shrink-0">Buyer Destination:</span>
                                        <span className="font-bold text-slate-900 dark:text-white text-right text-[11px] ml-2">
                                            352 Escolta St, Binondo, Manila, 1006 Metro Manila
                                        </span>
                                    </div>
                                </div>

                                <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/40 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start gap-2 shadow-xs">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                    <span>
                                        Confirming this award will create an official <strong>Purchase Order</strong>, retain <strong>{awardConfirmation.supplier.name}</strong> as the selected supplier, notify other competing suppliers via email that a supplier has already been selected, and clean up unselected vendor leads from the potential suppliers pipeline.
                                    </span>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="p-4 border-t border-slate-300/80 dark:border-white/10 flex items-center justify-end gap-3 bg-[#ebf0f7] dark:bg-[#141624]">
                                <button
                                    type="button"
                                    onClick={() => setAwardConfirmation(null)}
                                    disabled={awardingQuoteId !== null}
                                    className="px-4 py-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-700 dark:text-slate-300 text-xs font-bold border border-white/80 dark:border-white/10 shadow-[-2px_-2px_5px_rgba(255,255,255,0.85),_2px_2px_5px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.03),_2px_2px_5px_rgba(0,0,0,0.4)] active:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4)] hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => executeAwardBid(awardConfirmation.supplier, awardConfirmation.quote)}
                                    disabled={awardingQuoteId !== null}
                                    className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-[-2px_-2px_6px_rgba(255,255,255,0.5),_3px_3px_8px_rgba(16,185,129,0.45)] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.3)] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {awardingQuoteId === awardConfirmation.quote.id ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Award className="w-4 h-4 text-amber-300" />
                                    )}
                                    <span>Confirm & Award Bid</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}

            {/* Modal 4: Supplier Review & Activation Modal */}
            <SupplierReviewModal
                isOpen={!!registerConfirmation}
                onClose={() => setRegisterConfirmation(null)}
                supplier={registerConfirmation}
                onSupplierActivated={() => {
                    setRegisterConfirmation(null);
                    onSupplierPromoted?.();
                    loadPotentialSuppliersData();
                }}
            />

            {/* Modal 5: Add / Edit Supplier Email Modal (Neumorphic) */}
            {addEmailSupplier && (
                <Portal>
                    <div
                        className="fixed inset-0 bg-slate-950/75 dark:bg-black/85 backdrop-blur-sm z-[120] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
                        onClick={() => setAddEmailSupplier(null)}
                    >
                        <div
                            className="relative w-full max-w-lg bg-[#ebf0f7] dark:bg-[#161826] rounded-3xl border border-white/80 dark:border-white/10 shadow-[-8px_-8px_20px_rgba(255,255,255,0.9),_8px_8px_20px_rgba(163,177,198,0.45)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.03),_6px_6px_16px_rgba(0,0,0,0.6)] overflow-hidden my-auto flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="p-5 border-b border-slate-300/80 dark:border-white/10 flex items-center justify-between bg-[#ebf0f7] dark:bg-[#141624]">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-pink-600 text-white flex items-center justify-center shrink-0 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_2px_2px_6px_rgba(219,39,119,0.4)]">
                                        <Mail className="w-5 h-5 drop-shadow" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-base text-slate-900 dark:text-white">
                                            Add Supplier Quotation Email
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[280px]">
                                            {addEmailSupplier.supplier.name}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setAddEmailSupplier(null)}
                                    className="w-8 h-8 rounded-xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center border border-white/80 dark:border-white/10 shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)] dark:shadow-[-1px_-1px_3px_rgba(255,255,255,0.04),_2px_2px_4px_rgba(0,0,0,0.4)] active:shadow-[inset_1px_1px_2px_rgba(163,177,198,0.4)] cursor-pointer transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-5 space-y-4 text-xs">
                                {/* Phone inquiry prompt if phone exists */}
                                {addEmailSupplier.supplier.phone ? (
                                    <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.03),_2px_2px_5px_rgba(0,0,0,0.4)] flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                                <PhoneCall className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block">
                                                    Ask for quotation email via phone:
                                                </span>
                                                <a
                                                    href={`tel:${addEmailSupplier.supplier.phone}`}
                                                    className="font-mono text-xs font-black text-emerald-700 dark:text-emerald-400 hover:underline"
                                                >
                                                    {addEmailSupplier.supplier.phone}
                                                </a>
                                            </div>
                                        </div>
                                        <a
                                            href={`tel:${addEmailSupplier.supplier.phone}`}
                                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black shadow-[-2px_-2px_5px_rgba(255,255,255,0.3),_2px_2px_5px_rgba(16,185,129,0.35)] transition-all flex items-center gap-1.5"
                                        >
                                            <PhoneCall className="w-3 h-3" />
                                            <span>Call Now</span>
                                        </a>
                                    </div>
                                ) : (
                                    <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.03),_2px_2px_5px_rgba(0,0,0,0.4)] text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                            <Info className="w-4 h-4" />
                                        </div>
                                        <span>Inquire via store visit ({addEmailSupplier.supplier.location}) to obtain quotation contact.</span>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 mb-2">
                                        Supplier Email Address <span className="text-pink-600">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={inputEmail}
                                        onChange={(e) => setInputEmail(e.target.value)}
                                        placeholder="e.g. sales@goodyear.ph or quotations@store.com"
                                        className="w-full bg-[#ebf0f7] dark:bg-[#12131e] border-0 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-1px_-1px_3px_rgba(255,255,255,0.04)] focus:outline-none focus:ring-2 focus:ring-pink-500/40 transition-all placeholder:text-slate-400 font-mono"
                                        autoFocus
                                    />
                                </div>

                                <div className="p-3.5 rounded-2xl bg-pink-50/80 dark:bg-pink-950/30 border border-pink-200/80 dark:border-pink-800/40 text-[11px] text-pink-800 dark:text-pink-300 flex items-start gap-2 shadow-xs">
                                    <Info className="w-4 h-4 text-pink-600 shrink-0 mt-0.5" />
                                    <span className="leading-relaxed">
                                        Once saved, this email will be attached to the supplier&apos;s lead card and you will be able to send official Request for Quotation (RFQ) inquiry forms directly.
                                    </span>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="p-4 border-t border-slate-300/80 dark:border-white/10 flex items-center justify-end gap-3 bg-[#ebf0f7] dark:bg-[#141624]">
                                <button
                                    type="button"
                                    onClick={() => setAddEmailSupplier(null)}
                                    disabled={isSavingEmail}
                                    className="px-4 py-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-700 dark:text-slate-300 text-xs font-bold border border-white/80 dark:border-white/10 shadow-[-2px_-2px_5px_rgba(255,255,255,0.85),_2px_2px_5px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.03),_2px_2px_5px_rgba(0,0,0,0.4)] active:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4)] hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSaveSupplierEmail(false)}
                                    disabled={isSavingEmail || !inputEmail.trim()}
                                    className="px-4 py-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-800 dark:text-slate-200 hover:text-pink-600 dark:hover:text-pink-400 text-xs font-black border border-white/80 dark:border-white/10 shadow-[-2px_-2px_5px_rgba(255,255,255,0.85),_2px_2px_5px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.03),_2px_2px_5px_rgba(0,0,0,0.4)] active:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4)] transition-all cursor-pointer disabled:opacity-50"
                                >
                                    {isSavingEmail ? "Saving..." : "Save Email Only"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSaveSupplierEmail(true)}
                                    disabled={isSavingEmail || !inputEmail.trim()}
                                    className="px-5 py-2.5 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black shadow-[-2px_-2px_6px_rgba(255,255,255,0.5),_3px_3px_8px_rgba(219,39,119,0.45)] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.3)] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {isSavingEmail ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Send className="w-3.5 h-3.5" />
                                    )}
                                    <span>Save & Send RFQ</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}

            {/* Modal 4: View-Only Vendor Quotation Proposal & Files Review Modal */}
            <VendorQuotationViewModal
                supplier={viewQuotationModal?.supplier || null}
                initialQuote={viewQuotationModal?.quote || null}
                onClose={() => setViewQuotationModal(null)}
                onAwardBid={(sup, q) => {
                    setViewQuotationModal(null);
                    handleAwardBid(sup, q);
                }}
                onProceedToActivate={(sup) => {
                    setViewQuotationModal(null);
                    handlePromoteSupplier(sup);
                }}
            />

            {/* Modal 5: Supplier Review & Activation Modal (Admin Registration & Enrichment) */}
            <SupplierReviewModal
                isOpen={!!registerConfirmation}
                onClose={() => setRegisterConfirmation(null)}
                supplier={registerConfirmation}
                onSupplierActivated={() => {
                    setRegisterConfirmation(null);
                    onSupplierPromoted?.();
                    loadPotentialSuppliersData();
                }}
            />

            {/* Modal 6: Manually Add Potential Supplier Modal */}
            <AddPotentialSupplierModal
                isOpen={isAddSupplierModalOpen}
                onClose={() => {
                    setIsAddSupplierModalOpen(false);
                    setAddModalInitialReqId("");
                }}
                onSupplierAdded={() => {
                    loadPotentialSuppliersData();
                }}
                availableRequests={requestGroups
                    .filter((g) => {
                        // 1. Has no potential suppliers yet (or new without supplier)
                        const hasNoSuppliers = !g.potentialSuppliers || g.potentialSuppliers.length === 0;
                        // 2. Or the category is 'others' / 'other'
                        const cat = (g.category || "").trim().toLowerCase();
                        const isOthers = cat === "others" || cat === "other" || cat.includes("other");
                        // If preselected, keep it accessible
                        const isPreselected = Boolean(addModalInitialReqId && g.requestId === addModalInitialReqId);

                        return hasNoSuppliers || isOthers || isPreselected;
                    })
                    .map((g) => ({
                        id: g.requestId,
                        requestNumber: g.requestNumber,
                        itemName: g.itemName,
                        category: g.category,
                        department: g.department,
                        supplierCount: g.potentialSuppliers?.length || 0,
                    }))}
                initialRequestId={addModalInitialReqId}
            />

            {/* Modal 7: Schedule Supplier Meeting Modal (Video Call / In-Person / Phone) */}
            <SetSupplierMeetingModal
                isOpen={!!meetingModalData}
                onClose={() => setMeetingModalData(null)}
                supplier={meetingModalData?.supplier || null}
                group={meetingModalData?.group || null}
                initialQuote={meetingModalData?.quote || null}
                meeting={meetingModalData?.meeting || null}
                onMeetingScheduled={() => {
                    setMeetingModalData(null);
                    loadPotentialSuppliersData(true);
                }}
                onMeetingRemoved={() => {
                    setMeetingModalData(null);
                    loadPotentialSuppliersData(true);
                }}
            />
        </div>
    );
}
