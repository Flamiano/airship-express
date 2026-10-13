"use client";

import React, { useState, useMemo, useEffect } from "react";
import { 
    Search, 
    Compass, 
    MapPin, 
    Store, 
    Boxes, 
    ArrowRight, 
    Sparkles, 
    Building2, 
    Phone, 
    Mail, 
    CheckCircle2, 
    RefreshCw,
    SlidersHorizontal,
    Tag,
    X,
    ChevronLeft,
    ChevronRight,
    Package,
    AlertTriangle
} from "lucide-react";
import { Supplier, StockShortageItem } from "../types/index";
import { FindSupplierModal } from "../../inventory/components/modals/FindSupplierModal";
import Cards from "../../../components/global/Cards";
import { supabase } from "../../../lib/services/client/supabase";
import { toast } from "sonner";

interface StageFindPotentialSuppliersProps {
    suppliers: Supplier[];
    shortages: StockShortageItem[];
    activeSourcingFocus?: {
        itemName?: string;
        category?: string;
        requestNumber?: string;
        previousSupplier?: string | null;
    } | null;
    onClearSourcingFocus: () => void;
    onRefresh: () => void;
    onOpenPOModal?: (item: any, selectedSupplier?: any) => void;
}

const ORIGIN_LOCATION = "Binondo, Manila";

export function StageFindPotentialSuppliers({
    suppliers,
    shortages,
    activeSourcingFocus,
    onClearSourcingFocus,
    onRefresh,
    onOpenPOModal,
}: StageFindPotentialSuppliersProps) {
    const [searchQuery, setSearchQuery] = useState(activeSourcingFocus?.itemName || "");
    const [selectedRadius, setSelectedRadius] = useState<number>(10);
    const [selectedShortageItem, setSelectedShortageItem] = useState<StockShortageItem | null>(null);
    const [isFindModalOpen, setIsFindModalOpen] = useState(false);
    const [editedQuantities, setEditedQuantities] = useState<Record<string, number>>({});
    const [isCreatingDraftPO, setIsCreatingDraftPO] = useState(false);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const itemsPerPage = 6;

    // Dynamic filtering for shortage items based on search query
    const filteredShortages = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return shortages;
        return shortages.filter((item) =>
            item.item_name?.toLowerCase().includes(q) ||
            item.item_code?.toLowerCase().includes(q) ||
            item.category?.toLowerCase().includes(q) ||
            item.previous_supplier?.toLowerCase().includes(q)
        );
    }, [shortages, searchQuery]);

    // Reset pagination to page 1 whenever search query changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    const totalPages = Math.max(1, Math.ceil(filteredShortages.length / itemsPerPage));

    const paginatedShortages = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredShortages.slice(start, start + itemsPerPage);
    }, [filteredShortages, currentPage, itemsPerPage]);

    // Handle local quantity editing for shortage items (DOES NOT EDIT THE REQUEST TABLE)
    const handleUpdateItemQty = (itemKey: string, newQty: number) => {
        const validQty = Math.max(1, isNaN(newQty) ? 1 : newQty);
        setEditedQuantities((prev) => ({
            ...prev,
            [itemKey]: validQty,
        }));
    };

    // Build the request object for FindSupplierModal with edited quantity
    const requestForModal = useMemo(() => {
        const queryTerm = searchQuery || selectedShortageItem?.item_name || activeSourcingFocus?.itemName || "Auto Parts & Fleet Supplies";
        const category = selectedShortageItem?.category || activeSourcingFocus?.category || "Fleet Maintenance";

        // Extract pure UUID if available
        const rawId = String(selectedShortageItem?.request_id || selectedShortageItem?.id || "");
        const matchedUuid = rawId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0];
        const effectiveId = matchedUuid || (selectedShortageItem ? String(selectedShortageItem.id) : `query-${Date.now()}`);

        const itemKey = selectedShortageItem ? String(selectedShortageItem.id || selectedShortageItem.item_code) : "";
        const effectiveQty = itemKey && editedQuantities[itemKey] !== undefined 
            ? editedQuantities[itemKey] 
            : (selectedShortageItem?.deficit || 1);

        return {
            id: effectiveId,
            request_id: matchedUuid || undefined,
            request_number: selectedShortageItem?.source_request || (selectedShortageItem?.item_code ? `REQ-${selectedShortageItem.item_code}` : "PROCUREMENT-SOURCING"),
            item_name: queryTerm,
            quantity_requested: effectiveQty,
            unit: selectedShortageItem?.unit || "units",
            category: category,
            items: [
                {
                    id: effectiveId,
                    name: queryTerm,
                    item_name: queryTerm,
                    quantity: effectiveQty,
                    unit: selectedShortageItem?.unit || "units",
                    category: category,
                },
            ],
        };
    }, [searchQuery, selectedShortageItem, activeSourcingFocus, editedQuantities]);

    // Search Nearby Suppliers handler: creates a row in purchase_orders table with status of DRAFT (DO NOT notify admin or show toast)
    const handleSearchNearbySuppliers = async (targetShortage?: StockShortageItem) => {
        const itemToSource = targetShortage || selectedShortageItem || (filteredShortages.length > 0 ? filteredShortages[0] : null);
        const queryTerm = itemToSource?.item_name || searchQuery.trim() || activeSourcingFocus?.itemName || "Warehouse Supplies";
        const itemKey = itemToSource ? String(itemToSource.id || itemToSource.item_code) : "";
        const chosenQty = itemKey && editedQuantities[itemKey] !== undefined
            ? editedQuantities[itemKey]
            : (itemToSource?.deficit || 1);
        const unit = itemToSource?.unit || "units";
        const category = itemToSource?.category || activeSourcingFocus?.category || "Fleet Maintenance";
        const supplierName = itemToSource?.previous_supplier || (itemToSource as any)?.supplier || "Pending Supplier Sourcing";

        if (itemToSource) {
            setSelectedShortageItem(itemToSource);
            setSearchQuery(itemToSource.item_name);
        }

        setIsCreatingDraftPO(true);
        try {
            // Add pure request_id if available as UUID
            const rawId = String(itemToSource?.request_id || itemToSource?.id || "");
            const matchedUuid = rawId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0];

            // Check if there is ALREADY an active purchase order for this requisition or item
            let poAlreadyExists = false;

            if (matchedUuid) {
                const { data: poByReq } = await supabase
                    .from("purchase_orders")
                    .select("id, status")
                    .eq("request_id", matchedUuid)
                    .neq("status", "cancelled")
                    .limit(1);

                if (poByReq && poByReq.length > 0) {
                    poAlreadyExists = true;
                }
            }

            if (!poAlreadyExists) {
                const queryItemLower = queryTerm.toLowerCase().trim();
                const sourceReq = (itemToSource?.source_request || "").trim().toLowerCase();

                const { data: recentPOs } = await supabase
                    .from("purchase_orders")
                    .select("id, status, items, notes, request_id")
                    .neq("status", "cancelled")
                    .order("created_at", { ascending: false })
                    .limit(100);

                if (recentPOs && recentPOs.length > 0) {
                    for (const po of recentPOs) {
                        const poNotes = (po.notes || "").toLowerCase();
                        if (sourceReq && poNotes.includes(sourceReq)) {
                            poAlreadyExists = true;
                            break;
                        }
                        if (Array.isArray(po.items)) {
                            const hasItem = po.items.some((it: any) => {
                                const name = String(it.name || it.item_name || "").toLowerCase().trim();
                                return name && name === queryItemLower;
                            });
                            if (hasItem) {
                                poAlreadyExists = true;
                                break;
                            }
                        }
                    }
                }
            }

            // Only insert a draft PO if none exists already in the purchase_orders table
            if (!poAlreadyExists) {
                const poNumber = `PO-DRAFT-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
                const itemObj = {
                    item_name: queryTerm,
                    name: queryTerm,
                    description: `Sourced shortage item: ${queryTerm}${itemToSource?.item_code ? ` (${itemToSource.item_code})` : ""}`,
                    category: category,
                    quantity: chosenQty,
                    quantity_ordered: chosenQty,
                    quantity_received: 0,
                    unit: unit,
                    unit_price: 0,
                    subtotal: 0,
                    total: 0,
                };

                const poData: Record<string, any> = {
                    po_number: poNumber,
                    status: "Draft",
                    supplier_name: supplierName,
                    category: category,
                    subtotal: 0,
                    discount: 0,
                    shipping_fee: 0,
                    tax_rate: 0,
                    tax_amount: 0,
                    total_amount: 0,
                    notes: `Draft PO created from Procurement Sourcing for ${queryTerm} (${chosenQty} ${unit})`,
                    items: [itemObj],
                    delivery_location: "Airship HQ - Binondo, Manila",
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };

                if (matchedUuid) {
                    poData.request_id = matchedUuid;
                }

                const { error: poErr } = await supabase.from("purchase_orders").insert([poData]);
                if (poErr) {
                    console.warn("Draft PO insert notice:", poErr);
                }
            }
            // Silent - do not show toast when opening or creating draft
        } catch (err: any) {
            console.warn("Error creating draft PO:", err);
        } finally {
            setIsCreatingDraftPO(false);
            setIsFindModalOpen(true);
        }
    };

    return (
        <div className="space-y-6">
            {/* Top Overview Cards using 3D Flipping Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Cards
                    frontIcon="fas fa-boxes-stacked mr-1"
                    header="Shortage Items"
                    data={String(shortages.length)}
                    arrow="fas fa-cart-arrow-down mr-1"
                    description="Awaiting sourcing"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Sourcing Requisitions"
                    backIcon="fas fa-boxes-stacked"
                    backDescription={`${shortages.length} warehouse items currently have stock deficits that require locating qualified vendor sources.`}
                    tooltip="Inventory items with active deficits"
                    badge={shortages.length > 0 ? "Action Required" : "Optimal"}
                    frontTextColor="text-slate-500 dark:text-slate-400"
                    descriptionTextColor="text-pink-600 dark:text-pink-400"
                />
                <Cards
                    frontIcon="fas fa-store mr-1"
                    header="Active Suppliers"
                    data={String(suppliers.length)}
                    arrow="fas fa-users-gear mr-1"
                    description="In vendor database"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Vendor Network"
                    backIcon="fas fa-store"
                    backDescription={`${suppliers.length} commercial suppliers, manufacturers, and hardware distributors currently registered.`}
                    tooltip="Registered suppliers in database"
                    badge="Registered"
                    frontTextColor="text-slate-500 dark:text-slate-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />
                <Cards
                    frontIcon="fas fa-compass mr-1"
                    header="Search Radius"
                    data={`${selectedRadius} km`}
                    arrow="fas fa-location-crosshairs mr-1"
                    description={`From ${ORIGIN_LOCATION}`}
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Logistics Perimeter"
                    backIcon="fas fa-compass"
                    backDescription={`Configured to query OpenStreetMap Overpass within ${selectedRadius} km around ${ORIGIN_LOCATION}.`}
                    tooltip="Active geographic radius"
                    badge="Perimeter"
                    frontTextColor="text-slate-500 dark:text-slate-400"
                    descriptionTextColor="text-pink-600 dark:text-pink-400"
                />
                <Cards
                    frontIcon="fas fa-crosshairs mr-1"
                    header="Sourcing Focus"
                    data={activeSourcingFocus?.itemName ? "1 Item" : "All Items"}
                    arrow="fas fa-tag mr-1"
                    description={activeSourcingFocus?.itemName ? activeSourcingFocus.itemName : "General Sourcing"}
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Target Sourcing Focus"
                    backIcon="fas fa-crosshairs"
                    backDescription={activeSourcingFocus?.itemName ? `Currently prioritizing sourcing for ${activeSourcingFocus.itemName}.` : "Broad discovery mode active across all procurement categories."}
                    tooltip="Specific product targeted for sourcing"
                    badge={activeSourcingFocus?.itemName ? "Targeted" : "General"}
                    frontTextColor="text-slate-500 dark:text-slate-400"
                    descriptionTextColor={activeSourcingFocus?.itemName ? "text-pink-600 dark:text-pink-400" : "text-slate-500 dark:text-slate-400"}
                />
            </div>

            {/* Active Sourcing Banner */}
            {activeSourcingFocus?.itemName && (
                <div className="p-4 sm:p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#141624] border border-pink-500/40 dark:border-pink-500/30 shadow-[-4px_-4px_10px_rgba(255,255,255,0.85),_4px_4px_10px_rgba(219,39,119,0.2)] dark:shadow-[-2px_-2px_8px_rgba(255,255,255,0.02),_2px_2px_8px_rgba(0,0,0,0.6)] flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-2xl bg-pink-600 text-white flex items-center justify-center shrink-0 shadow-[-2px_-2px_6px_rgba(255,255,255,0.7),_2px_2px_6px_rgba(219,39,119,0.4)]">
                            <Compass className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-pink-600 dark:text-pink-400">
                                Sourcing In Progress
                            </div>
                            <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                                <span>Locating potential suppliers for: <span className="text-pink-600 dark:text-pink-400">{activeSourcingFocus.itemName}</span></span>
                                {activeSourcingFocus.previousSupplier ? (
                                    <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 flex items-center gap-1">
                                        <Building2 className="w-3 h-3" />
                                        <span>Previous Vendor on record: {activeSourcingFocus.previousSupplier}</span>
                                    </span>
                                ) : (
                                    <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                                        No active supplier recorded • Sourcing required
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClearSourcingFocus}
                        className="px-3.5 py-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#181a28] text-slate-600 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-white/80 dark:border-white/[0.05] shadow-[-2px_-2px_6px_rgba(255,255,255,0.9),_2px_2px_6px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.6)] active:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4)]"
                    >
                        <X className="w-3.5 h-3.5" />
                        <span>Clear Sourcing Focus</span>
                    </button>
                </div>
            )}

            {/* Sourcing Hub Configuration Container */}
            <div className="p-5 sm:p-6 rounded-3xl bg-[#ebf0f7] dark:bg-[#141624] border border-white/80 dark:border-white/[0.06] shadow-[-6px_-6px_16px_rgba(255,255,255,0.85),_6px_6px_16px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_8px_rgba(255,255,255,0.02),_2px_2px_10px_rgba(0,0,0,0.55)] space-y-5">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <Compass className="w-5 h-5 text-pink-500" />
                            <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                                Find Potential Suppliers &amp; Logistics Sourcing Map
                            </h3>
                            {/* Saved suppliers counter & link to /procurement?stage=3 */}
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#ebf0f7] dark:bg-[#181a28] border border-white/80 dark:border-white/[0.05] shadow-[-2px_-2px_5px_rgba(255,255,255,0.85),_2px_2px_5px_rgba(163,177,198,0.35)] dark:shadow-[-1px_-1px_3px_rgba(255,255,255,0.02),_2px_2px_5px_rgba(0,0,0,0.6)]">
                                <Store className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
                                <span className="text-[11px] font-black text-slate-800 dark:text-slate-100">
                                    {suppliers.length} Saved
                                </span>
                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                <a
                                    href="/procurement?stage=3"
                                    className="text-[11px] font-black text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 hover:underline flex items-center gap-1 cursor-pointer"
                                    title="View saved potential suppliers and quotations in Stage 3"
                                >
                                    <span>View in /procurement?stage=3 &rarr;</span>
                                </a>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Search nearby stores and hardware vendors via OpenStreetMap Overpass API, compute distances to Airship HQ, and request quotes.
                        </p>
                    </div>

                    <button
                        type="button"
                        disabled={isCreatingDraftPO}
                        onClick={() => handleSearchNearbySuppliers()}
                        className="px-4 py-2.5 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black shadow-[-2px_-2px_6px_rgba(255,255,255,0.6),_3px_3px_8px_rgba(219,39,119,0.45)] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.3)] flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                    >
                        <Compass className="w-4 h-4" />
                        <span>Open Sourcing Map &amp; Finder</span>
                    </button>
                </div>

                {/* Sourcing Search Parameters Form */}
                <div className="p-4 sm:p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#12131f] border border-white/80 dark:border-white/[0.04] shadow-[inset_2px_2px_6px_rgba(163,177,198,0.3),_inset_-2px_-2px_6px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.5),_inset_-2px_-2px_6px_rgba(255,255,255,0.02)] space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Search Query - functional filtering and enter trigger */}
                        <div className="md:col-span-2">
                            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                                Supplies / Item Name *
                            </label>
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search shortage items or enter item name (press Enter to search)..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleSearchNearbySuppliers();
                                        }
                                    }}
                                    className="w-full pl-9 pr-9 py-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#141624] border border-white/70 dark:border-white/[0.04] text-xs font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/40 shadow-[inset_2px_2px_4px_rgba(163,177,198,0.35),_inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)] transition-all"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                        title="Clear search"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium mt-1 block">
                                Origin is fixed to Airship HQ ({ORIGIN_LOCATION}). Type to filter shortage items below or trigger supplier search.
                            </span>
                        </div>

                        {/* Radius Slider */}
                        <div className="md:col-span-1">
                            <div className="flex items-center justify-between text-xs font-black mb-1">
                                <span className="text-slate-700 dark:text-slate-300">Search Radius</span>
                                <span className="text-pink-600 dark:text-pink-400 font-mono font-bold">{selectedRadius} km</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="25"
                                step="1"
                                value={selectedRadius}
                                onChange={(e) => setSelectedRadius(Number(e.target.value))}
                                className="w-full accent-pink-600 cursor-pointer h-2 bg-[#d8e2ee] dark:bg-[#141624] rounded-lg shadow-[inset_1px_1px_2px_rgba(0,0,0,0.2)] mt-2"
                            />
                        </div>
                    </div>

                    <div className="pt-2 flex items-center justify-end">
                        <button
                            type="button"
                            disabled={isCreatingDraftPO}
                            onClick={() => handleSearchNearbySuppliers()}
                            className="px-5 py-2.5 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black flex items-center gap-2 cursor-pointer transition-all shadow-[-2px_-2px_6px_rgba(255,255,255,0.6),_3px_3px_8px_rgba(219,39,119,0.45)] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.3)] disabled:opacity-50"
                        >
                            {isCreatingDraftPO ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Search className="w-3.5 h-3.5" />
                            )}
                            <span>Search Nearby Suppliers ({selectedRadius}km from {ORIGIN_LOCATION})</span>
                        </button>
                    </div>
                </div>

                {/* Quick Sourcing Shortcuts for Warehouse Shortages */}
                {shortages.length > 0 && (
                    <div className="space-y-3.5 pt-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                <Boxes className="w-4 h-4 text-pink-500" />
                                <span>Shortage Items Awaiting Sourcing ({filteredShortages.length}{filteredShortages.length !== shortages.length ? ` of ${shortages.length}` : ""})</span>
                            </h4>
                            <span className="text-[11px] text-slate-400 font-medium">
                                Adjust order quantity below and click Find to draft a PO &amp; open sourcing map
                            </span>
                        </div>

                        {filteredShortages.length === 0 ? (
                            <div className="p-8 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-2.5 shadow-[inset_2px_2px_6px_rgba(163,177,198,0.2)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.4)]">
                                <Package className="w-8 h-8 text-slate-400 mx-auto opacity-60" />
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                    No shortage items match &ldquo;{searchQuery}&rdquo;.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => handleSearchNearbySuppliers()}
                                    className="text-xs font-black text-pink-600 hover:text-pink-500 hover:underline cursor-pointer"
                                >
                                    Search suppliers for &ldquo;{searchQuery}&rdquo; anyway &rarr;
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {paginatedShortages.map((item, index) => {
                                        const isAwarded = Boolean(item.is_bid_awarded);
                                        const itemKey = String(item.id || item.item_code || index);
                                        const currentQty = editedQuantities[itemKey] !== undefined ? editedQuantities[itemKey] : (item.deficit || 1);

                                        return (
                                            <div
                                                key={`${item.id}-${item.item_code}-${index}`}
                                                className={`p-4 rounded-3xl transition-all flex flex-col justify-between gap-3.5 border ${
                                                    isAwarded
                                                        ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-500/30 shadow-none"
                                                        : "bg-[#ebf0f7] dark:bg-[#141624] border-white/90 dark:border-white/[0.06] shadow-[-6px_-6px_14px_rgba(255,255,255,0.95),_6px_6px_14px_rgba(163,177,198,0.4)] dark:shadow-[-3px_-3px_10px_rgba(255,255,255,0.02),_4px_4px_14px_rgba(0,0,0,0.7)] hover:shadow-[-8px_-8px_18px_rgba(255,255,255,1),_8px_8px_18px_rgba(163,177,198,0.5)] dark:hover:shadow-[-4px_-4px_12px_rgba(255,255,255,0.03),_6px_6px_16px_rgba(0,0,0,0.85)] group"
                                                }`}
                                            >
                                                {/* Header Row: Icon, Title & Badges */}
                                                <div className="space-y-2.5">
                                                    <div className="flex items-start justify-between gap-2.5">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 ${
                                                                isAwarded
                                                                    ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                                                    : "bg-[#ebf0f7] dark:bg-[#181a28] text-pink-600 dark:text-pink-400 border-white/80 dark:border-white/[0.05] shadow-[-2px_-2px_6px_rgba(255,255,255,0.9),_2px_2px_6px_rgba(163,177,198,0.35)] dark:shadow-[-1px_-1px_3px_rgba(255,255,255,0.02),_2px_2px_5px_rgba(0,0,0,0.6)]"
                                                            }`}>
                                                                {isAwarded ? <CheckCircle2 className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h5 className={`text-xs font-black truncate leading-tight ${
                                                                    isAwarded 
                                                                        ? "text-emerald-950 dark:text-emerald-200" 
                                                                        : "text-slate-900 dark:text-slate-100 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors"
                                                                }`}>
                                                                    {item.item_name}
                                                                </h5>
                                                                <div className="flex items-center gap-1.5 mt-1">
                                                                    <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 bg-[#e2e8f0]/80 dark:bg-[#10121d] px-2 py-0.5 rounded-lg shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.4),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6),_inset_-1px_-1px_2px_rgba(255,255,255,0.02)]">
                                                                        {item.item_code}
                                                                    </span>
                                                                    <span className="text-[10px] font-bold text-slate-400 truncate">
                                                                        {item.category}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {isAwarded ? (
                                                            <span className="text-[10px] px-2.5 py-1 rounded-xl font-bold bg-emerald-500 text-white flex items-center gap-1 shadow-[-2px_-2px_5px_rgba(255,255,255,0.4),_2px_2px_5px_rgba(16,185,129,0.3)] shrink-0">
                                                                <CheckCircle2 className="w-3 h-3" />
                                                                <span>Awarded</span>
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] px-2.5 py-1 rounded-xl font-black font-mono text-rose-600 dark:text-rose-400 bg-[#ebf0f7] dark:bg-[#181a28] border border-rose-500/20 shadow-[-2px_-2px_5px_rgba(255,255,255,0.9),_2px_2px_5px_rgba(163,177,198,0.35)] dark:shadow-[-1px_-1px_3px_rgba(255,255,255,0.02),_2px_2px_5px_rgba(0,0,0,0.6)] flex items-center gap-1 shrink-0">
                                                                <AlertTriangle className="w-3 h-3" />
                                                                <span>Deficit: {item.deficit} {item.unit}</span>
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Meta Vendor / Sourcing Status Row */}
                                                    <div className="pt-0.5 flex items-center justify-between text-[11px] gap-2 flex-wrap">
                                                        {item.previous_supplier ? (
                                                            <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1 text-[10px] truncate">
                                                                <Building2 className="w-3 h-3 shrink-0" />
                                                                <span className="truncate">Prev: {item.previous_supplier}</span>
                                                            </span>
                                                        ) : (
                                                            <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1 text-[10px]">
                                                                <Sparkles className="w-3 h-3 shrink-0" />
                                                                <span>Sourcing Required</span>
                                                            </span>
                                                        )}

                                                        {isAwarded && item.awarded_supplier_name && (
                                                            <span className="font-bold text-emerald-700 dark:text-emerald-300 text-[10px] truncate">
                                                                Awarded to: {item.awarded_supplier_name}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Bottom Row: Deep Neumorphic Integrated Quantity Stepper Well & Find Action */}
                                                <div 
                                                    className="flex items-center justify-between p-2 rounded-2xl bg-[#e2e8f0]/90 dark:bg-[#10121d] border border-white/60 dark:border-white/[0.03] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.95)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.7),_inset_-1px_-1px_3px_rgba(255,255,255,0.02)] gap-2"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <div className="flex items-center gap-1 pl-1">
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Qty:</span>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                disabled={isAwarded}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleUpdateItemQty(itemKey, currentQty - 1);
                                                                }}
                                                                className="w-7 h-7 rounded-xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-700 dark:text-slate-200 hover:text-pink-600 dark:hover:text-pink-400 flex items-center justify-center font-black text-sm shadow-[-2px_-2px_5px_rgba(255,255,255,0.95),_2px_2px_5px_rgba(163,177,198,0.4)] dark:shadow-[-1px_-1px_3px_rgba(255,255,255,0.03),_2px_2px_4px_rgba(0,0,0,0.6)] active:shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.5),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:active:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.8)] border border-white/80 dark:border-white/[0.04] transition-all cursor-pointer disabled:opacity-40"
                                                                title="Decrease quantity"
                                                            >
                                                                -
                                                            </button>
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                disabled={isAwarded}
                                                                value={currentQty}
                                                                onChange={(e) => {
                                                                    e.stopPropagation();
                                                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                                                    handleUpdateItemQty(itemKey, val);
                                                                }}
                                                                className="w-12 text-center bg-transparent text-xs font-black text-slate-900 dark:text-white focus:outline-none font-mono"
                                                            />
                                                            <button
                                                                type="button"
                                                                disabled={isAwarded}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleUpdateItemQty(itemKey, currentQty + 1);
                                                                }}
                                                                className="w-7 h-7 rounded-xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-700 dark:text-slate-200 hover:text-pink-600 dark:hover:text-pink-400 flex items-center justify-center font-black text-sm shadow-[-2px_-2px_5px_rgba(255,255,255,0.95),_2px_2px_5px_rgba(163,177,198,0.4)] dark:shadow-[-1px_-1px_3px_rgba(255,255,255,0.03),_2px_2px_4px_rgba(0,0,0,0.6)] active:shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.5),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:active:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.8)] border border-white/80 dark:border-white/[0.04] transition-all cursor-pointer disabled:opacity-40"
                                                                title="Increase quantity"
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 pr-1 truncate max-w-[50px]">{item.unit || "units"}</span>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        disabled={isAwarded || isCreatingDraftPO}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (!isAwarded) handleSearchNearbySuppliers(item);
                                                        }}
                                                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                                                            isAwarded
                                                                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 cursor-default"
                                                                : "bg-pink-600 hover:bg-pink-500 text-white shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_3px_3px_8px_rgba(219,39,119,0.45)] active:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.4)]"
                                                        }`}
                                                        title="Search nearby suppliers &amp; draft PO"
                                                    >
                                                        <Compass className="w-3.5 h-3.5" />
                                                        <span>Find</span>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between flex-wrap gap-3 pt-3 border-t border-white/60 dark:border-white/[0.05]">
                                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                            Showing <span className="font-mono text-slate-800 dark:text-slate-200">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
                                            <span className="font-mono text-slate-800 dark:text-slate-200">{Math.min(currentPage * itemsPerPage, filteredShortages.length)}</span> of{" "}
                                            <span className="font-mono text-slate-800 dark:text-slate-200">{filteredShortages.length}</span> shortage items
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                disabled={currentPage === 1}
                                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                                className="px-3 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#161826] text-xs font-bold text-slate-700 dark:text-slate-200 border border-white/80 dark:border-white/[0.05] shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.02),_2px_2px_5px_rgba(0,0,0,0.5)] disabled:opacity-40 disabled:cursor-not-allowed hover:text-pink-600 dark:hover:text-pink-400 transition-all flex items-center gap-1 cursor-pointer"
                                            >
                                                <ChevronLeft className="w-3.5 h-3.5" />
                                                <span>Prev</span>
                                            </button>

                                            <div className="flex items-center gap-1">
                                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                                                    const isCurrent = pageNum === currentPage;
                                                    return (
                                                        <button
                                                            key={pageNum}
                                                            type="button"
                                                            onClick={() => setCurrentPage(pageNum)}
                                                            className={`w-7 h-7 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                                                isCurrent
                                                                    ? "bg-pink-600 text-white shadow-[-1px_-1px_3px_rgba(255,255,255,0.5),_2px_2px_6px_rgba(219,39,119,0.45)]"
                                                                    : "bg-[#ebf0f7] dark:bg-[#161826] text-slate-700 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 border border-white/70 dark:border-white/[0.04] shadow-[-2px_-2px_4px_rgba(255,255,255,0.7),_2px_2px_4px_rgba(163,177,198,0.25)]"
                                                            }`}
                                                        >
                                                            {pageNum}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <button
                                                type="button"
                                                disabled={currentPage === totalPages}
                                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                                className="px-3 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#161826] text-xs font-bold text-slate-700 dark:text-slate-200 border border-white/80 dark:border-white/[0.05] shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.02),_2px_2px_5px_rgba(0,0,0,0.5)] disabled:opacity-40 disabled:cursor-not-allowed hover:text-pink-600 dark:hover:text-pink-400 transition-all flex items-center gap-1 cursor-pointer"
                                            >
                                                <span>Next</span>
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Exact FindSupplierModal from /inventory */}
            {isFindModalOpen && (
                <FindSupplierModal
                    isOpen={isFindModalOpen}
                    onClose={() => setIsFindModalOpen(false)}
                    request={requestForModal as any}
                    suppliers={suppliers}
                    onOpenPOModal={onOpenPOModal}
                />
            )}
        </div>
    );
}

