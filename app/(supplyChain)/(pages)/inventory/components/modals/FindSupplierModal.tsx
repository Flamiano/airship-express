// app/(supplyChain)/(pages)/inventory/components/modals/FindSupplierModal.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { InventoryRequest, InventoryItem } from '../../types';
import Portal from '../../../../components/client/Portal';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { toast } from 'sonner';
import { supabase } from '../../../../lib/services/client/supabase';
import { 
    AIRSHIP_HQ, 
    calculateDistanceKm, 
    resolveDestinationCoords,
    KNOWN_PHILIPPINE_LOCATIONS,
    GeoCoordinate 
} from '../../utils/geo-locations';
import { SourcedSupplierItem } from './SupplierSourcingMap';
import { 
    searchOpenStreetMapOverpass, 
    mergeOSMWithDatabaseSuppliers,
    OSMStoreDetails 
} from '../../utils/realStores';
import { addPotentialSupplier } from '../../server/query';
import { SupplierMessageModal } from '../../../suppliers/components/modals/SupplierMessageModal';
import { PurchaseOrderModal } from '../../../../components/modals/PurchaseOrderModal';
import {
    MapPin,
    Search,
    Building2,
    User,
    Calendar,
    Phone,
    Mail,
    Tag,
    Boxes,
    Layers,
    FileText,
    Sparkles,
    Check,
    X,
    Maximize2,
    Minimize2,
    Navigation,
    Compass,
    ExternalLink,
    Clock,
    AlertCircle,
    ShoppingCart,
    Filter,
    ArrowRight,
    Store,
    Globe,
    RefreshCw,
    Info,
    ChevronLeft,
    ChevronDown,
    CheckCircle2,
    PlusCircle,
    HelpCircle,
    Grid,
    SlidersHorizontal,
    ArrowUpDown,
    CheckCheck,
    MessageSquare
} from 'lucide-react';

// Dynamic import with SSR disabled for Leaflet map component
const SupplierSourcingMap = dynamic(
    () => import('./SupplierSourcingMap'),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-full min-h-[380px] rounded-3xl bg-[#0f111a] flex flex-col items-center justify-center p-6 text-white space-y-3 shadow-[-4px_-4px_12px_rgba(255,255,255,0.02),_6px_6px_18px_rgba(0,0,0,0.8)] border border-white/[0.06]">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-600 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-pink-500/30 animate-pulse">
                    <Compass className="w-6 h-6 animate-spin" />
                </div>
                <p className="text-xs font-bold text-slate-300">Searching OpenStreetMap Overpass API...</p>
            </div>
        ),
    }
);

interface FindSupplierModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: InventoryRequest | null;
    suppliers?: any[];
    onOpenPOModal?: (item: any, selectedSupplier?: any) => void;
}

const LOCATION_PRESETS = [
    { label: 'Binondo, Manila (Airship HQ)', value: 'Binondo, Manila', lat: 14.6017, lng: 120.9721 },
    { label: 'Quezon City', value: 'Quezon City', lat: 14.6760, lng: 121.0437 },
    { label: 'Manila City', value: 'Manila', lat: 14.5995, lng: 120.9842 },
    { label: 'Makati City', value: 'Makati City', lat: 14.5547, lng: 121.0244 },
    { label: 'Pasig City', value: 'Pasig City', lat: 14.5764, lng: 121.0851 },
    { label: 'Taguig City (BGC)', value: 'Taguig City', lat: 14.5176, lng: 121.0509 },
    { label: 'Caloocan City', value: 'Caloocan City', lat: 14.6488, lng: 120.9673 },
    { label: 'Mandaluyong City', value: 'Mandaluyong City', lat: 14.5794, lng: 121.0359 },
    { label: 'San Juan City', value: 'San Juan City', lat: 14.6019, lng: 121.0355 },
    { label: 'Marikina City', value: 'Marikina City', lat: 14.6507, lng: 121.1029 },
    { label: 'Pasay City', value: 'Pasay City', lat: 14.5378, lng: 121.0014 },
    { label: 'Alabang, Muntinlupa', value: 'Alabang, Muntinlupa', lat: 14.4253, lng: 121.0409 },
    { label: 'Cebu City', value: 'Cebu City', lat: 10.3157, lng: 123.8854 },
];

export interface RequestedProductItem {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    category?: string;
    item_name?: string;
}

const COMMON_UNITS = ['units', 'reams', 'boxes', 'pcs', 'packs', 'sets', 'lot', 'kg', 'rolls', 'liters', 'pairs', 'bottles', 'bundles', 'cartons'];

// Helper: Check if business/supplier is an active verified official supplier
export function findOfficialSupplierMatch(
    business: any,
    dbSuppliersList: any[] = []
): any | null {
    if (!business) return null;

    const bName = (business.name || '').toLowerCase().trim();
    const rawId = String(business.id || '').replace(/^db-supplier-/, '').trim();

    return dbSuppliersList.find((s: any) => {
        // Must be active and not inactive
        if (s.is_active === false || (s.status || '').toLowerCase() === 'inactive') {
            return false;
        }

        // Must not be an unverified potential lead
        const notesLower = (s.notes || '').toLowerCase();
        const isLead =
            notesLower.includes('[manual potential supplier lead]') ||
            notesLower.includes('[potential supplier lead]') ||
            notesLower.includes('pending evaluation') ||
            notesLower.includes('openstreetmap') ||
            s.verification_status === 'unverified' ||
            s.verification_status === 'lead' ||
            /(?<!\b(?:lead\s*time|leadtime))\b(potential lead|unofficial lead|sales lead|raw lead)\b/i.test(notesLower);

        if (isLead) return false;

        // Match by numeric/uuid id
        if (rawId && String(s.id).trim() === rawId) return true;

        // Match by name
        const sName = (s.name || '').toLowerCase().trim();
        if (bName && sName) {
            if (bName === sName) return true;
            const cleanB = bName.replace(/\b(inc|corp|corporation|ltd|co|company|trading|enterprises|philippines)\b/gi, '').trim();
            const cleanS = sName.replace(/\b(inc|corp|corporation|ltd|co|company|trading|enterprises|philippines)\b/gi, '').trim();
            if (cleanB.length >= 3 && cleanS.length >= 3 && (cleanB === cleanS || cleanB.includes(cleanS) || cleanS.includes(cleanB))) {
                return true;
            }
        }

        return false;
    }) || null;
}

// Helper: Check if the business offers the specific requested item or category
export function checkSupplierOffersItem(
    business: any,
    targetItemName: string,
    targetItemCategory?: string,
    matchedDbSupplier?: any
): boolean {
    if (!business || !targetItemName) return false;

    const target = targetItemName.toLowerCase().trim();
    if (!target) return false;

    // 1. Direct match level from Overpass search
    if (business.matchLevel === 'exact') return true;

    // 2. Gather all offered product strings
    const offeredStrings: string[] = [];

    if (business.products) {
        offeredStrings.push(...String(business.products).split(/[,;\n\r•\/\&]+/));
    }
    if (matchedDbSupplier?.products) {
        offeredStrings.push(...String(matchedDbSupplier.products).split(/[,;\n\r•\/\&]+/));
    }

    const otherOffers = business.other_products_offer || matchedDbSupplier?.other_products_offer;
    if (otherOffers) {
        const parsed = Array.isArray(otherOffers)
            ? otherOffers
            : (typeof otherOffers === 'string'
                ? (() => { try { return JSON.parse(otherOffers); } catch { return []; } })()
                : []);
        if (Array.isArray(parsed)) {
            parsed.forEach((it: any) => {
                if (typeof it === 'string') offeredStrings.push(it);
                else if (it && (it.item_name || it.name || it.product_name)) {
                    offeredStrings.push(String(it.item_name || it.name || it.product_name));
                }
            });
        }
    }

    const cleanOffers = offeredStrings.map((s) => s.toLowerCase().trim()).filter(Boolean);

    const stopWords = new Set(['a', 'an', 'the', 'and', 'or', 'for', 'of', 'in', 'with', 'to', 'pcs', 'unit', 'units', 'box', 'boxes', 'pack', 'packs', 'set', 'sets', 'roll', 'rolls', 'reams']);
    const targetTokens = target
        .replace(/[^a-z0-9\s]/gi, ' ')
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3 && !stopWords.has(t));

    // Check direct match or token match against offered products
    for (const offer of cleanOffers) {
        if (offer === target || offer.includes(target) || target.includes(offer)) {
            return true;
        }
        for (const token of targetTokens) {
            if (offer.includes(token)) {
                return true;
            }
        }
    }

    // Also check tags
    if (business.tags) {
        const tagsValues = Object.values(business.tags).map((v) => String(v).toLowerCase());
        for (const tagVal of tagsValues) {
            if (tagVal.includes(target) || target.includes(tagVal)) return true;
            for (const token of targetTokens) {
                if (tagVal.includes(token)) return true;
            }
        }
    }

    // If no products listed, check category overlap
    const bCat = (business.category || matchedDbSupplier?.category || '').toLowerCase();
    const tCat = (targetItemCategory || '').toLowerCase();
    if (cleanOffers.length === 0 || cleanOffers.some((o) => o.includes('discovered goods') || o.includes('fulfillment'))) {
        if (tCat && bCat && (bCat.includes(tCat) || tCat.includes(bCat))) {
            return true;
        }
    }

    return false;
}

interface BusinessCardItemProps {
    b: OSMStoreDetails;
    isSelected: boolean;
    isSaved: boolean;
    isSaving: boolean;
    isOfficial: boolean;
    offersItem: boolean;
    onSelect: (b: OSMStoreDetails) => void;
    onAdd: (b: OSMStoreDetails) => void;
    onOrderOfficial: (b: OSMStoreDetails) => void;
    onInquire: (b: OSMStoreDetails) => void;
}

const BusinessCardItem = React.memo(function BusinessCardItem({
    b,
    isSelected,
    isSaved,
    isSaving,
    isOfficial,
    offersItem,
    onSelect,
    onAdd,
    onOrderOfficial,
    onInquire,
}: BusinessCardItemProps) {
    return (
        <div
            onClick={() => onSelect(b)}
            className={`p-4 rounded-2xl transition-all cursor-pointer space-y-2.5 shadow-none ${
                isSelected
                    ? 'bg-pink-50/60 dark:bg-pink-950/20 border-2 border-pink-500 ring-2 ring-pink-500/20'
                    : 'bg-white dark:bg-[#161826] border border-slate-200 dark:border-slate-800 hover:border-pink-300 dark:hover:border-pink-800'
            }`}
        >
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 hover:text-pink-600 transition-colors">
                        {b.name}
                    </h3>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        {b.matchLevel === 'exact' ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-pink-500 text-white shadow-xs shadow-pink-500/40 inline-flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5" />
                                Direct Match
                            </span>
                        ) : b.matchLevel === 'category' ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 inline-flex items-center gap-1">
                                <Tag className="w-2.5 h-2.5" />
                                Category Match
                            </span>
                        ) : (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 inline-flex items-center gap-1">
                                <Compass className="w-2.5 h-2.5" />
                                Possible Supplier
                            </span>
                        )}
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-[#e2e8f0]/80 dark:bg-[#1e2030] text-slate-600 dark:text-slate-300">
                            {b.category || 'Store'}
                        </span>
                    </div>
                </div>

                <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black shrink-0 ${
                    b.distanceKm <= 5
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : b.distanceKm <= 15
                        ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        : 'bg-[#e2e8f0] dark:bg-[#1a1c2c] text-slate-700 dark:text-slate-300'
                }`}>
                    {b.distanceKm} km away
                </span>
            </div>

            <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                {b.location && (
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{b.location}</span>
                    </div>
                )}
                {b.phone && (
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{b.phone}</span>
                    </div>
                )}
                {b.website && (
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate text-pink-600 hover:underline">{b.website}</span>
                    </div>
                )}
            </div>

            {/* Action Buttons: [ View Details ] and [ Add as Potential Supplier ] */}
            <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-200/60 dark:border-white/[0.04]">
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onSelect(b);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#181a26] text-slate-700 dark:text-slate-300 hover:text-pink-600 text-[11px] font-bold shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.02),_2px_2px_5px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/[0.04] transition-all flex items-center gap-1 cursor-pointer"
                >
                    <span>View Details</span>
                    <ArrowRight className="w-3 h-3" />
                </button>

                {isOfficial ? (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onOrderOfficial(b);
                        }}
                        className="px-3 py-1.5 rounded-xl text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-[-2px_-2px_6px_rgba(255,255,255,0.2),_2px_2px_6px_rgba(37,99,235,0.4)]"
                        title="Official supplier: Create Purchase Order directly"
                    >
                        <ShoppingCart className="w-3 h-3" />
                        <span>Order(Official supplier)</span>
                    </button>
                ) : offersItem ? (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAdd(b);
                        }}
                        disabled={isSaving}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer ${
                            isSaved
                                ? 'bg-emerald-600 text-white shadow-[-2px_-2px_5px_rgba(255,255,255,0.2),_2px_2px_6px_rgba(16,185,129,0.3)]'
                                : 'bg-pink-600 hover:bg-pink-500 text-white shadow-[-2px_-2px_6px_rgba(255,255,255,0.2),_2px_2px_6px_rgba(244,63,94,0.4)]'
                        }`}
                    >
                        {isSaving ? (
                            <>
                                <i className="fas fa-spinner fa-spin mr-1" />
                                <span>Saving...</span>
                            </>
                        ) : isSaved ? (
                            <>
                                <Check className="w-3 h-3" />
                                <span>Saved Potential</span>
                            </>
                        ) : (
                            <>
                                <PlusCircle className="w-3 h-3" />
                                <span>Add as Potential Supplier</span>
                            </>
                        )}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onInquire(b);
                        }}
                        className="px-3 py-1.5 rounded-xl text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-[-2px_-2px_6px_rgba(255,255,255,0.2),_2px_2px_6px_rgba(245,158,11,0.4)]"
                        title={`Item not part of standard offer. Click to message ${b.name}`}
                    >
                        <MessageSquare className="w-3 h-3" />
                        <span>Inquire</span>
                    </button>
                )}
            </div>
        </div>
    );
});

export function FindSupplierModal({
    isOpen,
    onClose,
    request,
    suppliers: initialSuppliers = [],
    onOpenPOModal,
}: FindSupplierModalProps) {
    const [osmBusinesses, setOsmBusinesses] = useState<OSMStoreDetails[]>([]);
    const [dbSuppliers, setDbSuppliers] = useState<any[]>(initialSuppliers);
    const [loadingOverpass, setLoadingOverpass] = useState<boolean>(false);
    
    // Requested Products & Quantities State
    const [requestedProducts, setRequestedProducts] = useState<RequestedProductItem[]>([]);
    const [activeProductIndex, setActiveProductIndex] = useState<number>(0);
    const [isAddingProduct, setIsAddingProduct] = useState<boolean>(false);
    const [newProductName, setNewProductName] = useState<string>('');
    const [newProductQty, setNewProductQty] = useState<number>(1);
    const [newProductUnit, setNewProductUnit] = useState<string>('units');
    const [updatingQtyIdx, setUpdatingQtyIdx] = useState<number | null>(null);

    // Search parameter controls
    const [searchItemName, setSearchItemName] = useState<string>('');
    const [selectedLocation, setSelectedLocation] = useState<string>('Binondo, Manila');
    const [customLocationText, setCustomLocationText] = useState<string>('');
    const [isCustomLocation, setIsCustomLocation] = useState<boolean>(false);
    const [selectedRadiusKm, setSelectedRadiusKm] = useState<number>(10);
    
    // In-results search & filters
    const [resultsSearchTerm, setResultsSearchTerm] = useState<string>('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [distanceFilter, setDistanceFilter] = useState<string>('all'); // all | 5 | 10 | 25
    const [selectedBusiness, setSelectedBusiness] = useState<OSMStoreDetails | null>(null);
    const [isFullMap, setIsFullMap] = useState<boolean>(false);
    const [showSidebarInFullMap, setShowSidebarInFullMap] = useState<boolean>(false);
    const [showFiltersInFullMap, setShowFiltersInFullMap] = useState<boolean>(false);
    const [visibleCardsLimit, setVisibleCardsLimit] = useState<number>(30);
    const [activeDetailView, setActiveDetailView] = useState<boolean>(false);

    // View All modal state & filters
    const [isViewAllOpen, setIsViewAllOpen] = useState<boolean>(false);
    const [viewAllMatchFilter, setViewAllMatchFilter] = useState<string>('all'); // all | exact | category | possible
    const [viewAllSortBy, setViewAllSortBy] = useState<'distance' | 'name'>('distance');

    // Saving supplier state
    const [savingSupplierId, setSavingSupplierId] = useState<string | null>(null);
    const [addedSupplierIds, setAddedSupplierIds] = useState<Set<string>>(new Set());
    const [isBidAwarded, setIsBidAwarded] = useState<boolean>(false);
    const [awardedSupplierName, setAwardedSupplierName] = useState<string | null>(null);

    // Sourcing Inquire & Official PO Modal States
    const [messageModalSupplier, setMessageModalSupplier] = useState<any | null>(null);
    const [messageModalInitialText, setMessageModalInitialText] = useState<string>('');
    const [isMessageModalOpen, setIsMessageModalOpen] = useState<boolean>(false);
    const [internalPORequest, setInternalPORequest] = useState<any | null>(null);
    const [isInternalPOModalOpen, setIsInternalPOModalOpen] = useState<boolean>(false);

    // Initialize search terms and requested products when request changes
    useEffect(() => {
        if (!request) return;

        let initialProducts: RequestedProductItem[] = [];
        if (Array.isArray(request.items) && request.items.length > 0) {
            initialProducts = request.items.map((item: any, idx: number) => ({
                id: item.id || `item-${idx}-${Date.now()}`,
                name: item.name || item.item_name || 'Requested Item',
                quantity: Math.max(1, Number(item.quantity || item.quantity_requested || item.qty || 1)),
                unit: item.unit || 'units',
                category: item.category || (request as any).category || 'General',
            }));
        } else if (typeof (request as any).items === 'string') {
            try {
                const parsed = JSON.parse((request as any).items);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    initialProducts = parsed.map((item: any, idx: number) => ({
                        id: item.id || `item-${idx}-${Date.now()}`,
                        name: item.name || item.item_name || 'Requested Item',
                        quantity: Math.max(1, Number(item.quantity || item.quantity_requested || item.qty || 1)),
                        unit: item.unit || 'units',
                        category: item.category || (request as any).category || 'General',
                    }));
                }
            } catch {}
        }

        if (initialProducts.length === 0) {
            initialProducts = [{
                id: `item-0-${Date.now()}`,
                name: request.item_name || 'Procurement Item',
                quantity: Math.max(1, Number(request.quantity_requested || 1)),
                unit: request.unit || 'units',
                category: (request as any).category || 'General',
            }];
        }

        setRequestedProducts(initialProducts);
        setActiveProductIndex(0);
        setSearchItemName(initialProducts[0]?.name || request.item_name || '');
        // Default to Airship Express HQ in Binondo, Manila
        setSelectedLocation('Binondo, Manila');
        setSelectedRadiusKm(10);
        setIsCustomLocation(false);
        setActiveDetailView(false);
        setSelectedBusiness(null);
    }, [request?.id]);

    const handleUpdateProductQuantity = (index: number, newQty: number) => {
        const validQty = Math.max(1, isNaN(newQty) ? 1 : newQty);
        setRequestedProducts((prev) => {
            const copy = [...prev];
            if (copy[index]) {
                copy[index] = { ...copy[index], quantity: validQty };
            }
            return copy;
        });
    };

    const handleUpdateProductUnit = (index: number, newUnit: string) => {
        setRequestedProducts((prev) => {
            const copy = [...prev];
            if (copy[index]) {
                copy[index] = { ...copy[index], unit: newUnit };
            }
            return copy;
        });
    };

    const handleSelectActiveProduct = (index: number) => {
        if (requestedProducts[index]) {
            setActiveProductIndex(index);
            const targetName = requestedProducts[index].name;
            setSearchItemName(targetName);
            runOverpassSearch(selectedRadiusKm, undefined, targetName);
        }
    };

    const handleSaveProductUpdate = async (index: number) => {
        const prod = requestedProducts[index];
        if (!prod) return;
        setUpdatingQtyIdx(index);
        try {
            // Check if an existing draft PO is linked to this request or product to avoid duplicate rows
            const prodNameLower = prod.name.toLowerCase().trim();
            const reqIdStr = request?.id ? String(request.id).toLowerCase().trim() : '';
            const matchedUuid = reqIdStr.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0];

            let existingDraftPO: any = null;
            if (matchedUuid) {
                const { data: poByReq } = await supabase
                    .from('purchase_orders')
                    .select('*')
                    .eq('request_id', matchedUuid)
                    .ilike('status', 'draft')
                    .order('created_at', { ascending: false })
                    .limit(1);
                if (poByReq && poByReq.length > 0) {
                    existingDraftPO = poByReq[0];
                }
            }

            if (!existingDraftPO) {
                const { data: recentDrafts } = await supabase
                    .from('purchase_orders')
                    .select('*')
                    .ilike('status', 'draft')
                    .order('created_at', { ascending: false })
                    .limit(50);
                if (recentDrafts && recentDrafts.length > 0) {
                    existingDraftPO = recentDrafts.find((po: any) => {
                        const notes = (po.notes || '').toLowerCase();
                        if (reqIdStr && notes.includes(reqIdStr)) return true;
                        if (Array.isArray(po.items)) {
                            return po.items.some((it: any) => {
                                const name = String(it.name || it.item_name || '').toLowerCase().trim();
                                return name === prodNameLower;
                            });
                        }
                        return false;
                    });
                }
            }

            const itemObj = {
                item_name: prod.name,
                name: prod.name,
                description: `Updated quantity for ${prod.name}`,
                category: prod.category || (request as any)?.category || 'General Supplies',
                quantity: prod.quantity,
                quantity_ordered: prod.quantity,
                quantity_received: 0,
                unit: prod.unit || 'units',
                unit_price: 0,
                subtotal: 0,
                total: 0,
            };

            if (existingDraftPO) {
                // Update the existing draft PO rather than inserting a duplicate row
                const existingItems = Array.isArray(existingDraftPO.items) ? [...existingDraftPO.items] : [];
                const itemIndex = existingItems.findIndex((it: any) => {
                    const name = String(it.name || it.item_name || '').toLowerCase().trim();
                    return name === prodNameLower;
                });
                if (itemIndex >= 0) {
                    existingItems[itemIndex] = { ...existingItems[itemIndex], ...itemObj };
                } else {
                    existingItems.push(itemObj);
                }
                await supabase
                    .from('purchase_orders')
                    .update({
                        items: existingItems,
                        notes: `Draft PO updated for ${prod.name} (${prod.quantity} ${prod.unit})`,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingDraftPO.id);
            }
            toast.success(`Updated quantity for "${prod.name}" to ${prod.quantity} ${prod.unit}.`);
        } catch (err: any) {
            console.error('Error saving updated product draft PO:', err);
            toast.error('Failed to update: ' + (err?.message || 'Unknown error'));
        } finally {
            setUpdatingQtyIdx(null);
        }
    };

    const handleAddProduct = async () => {
        if (!newProductName.trim()) {
            toast.error('Please enter a product name.');
            return;
        }
        const newProd: RequestedProductItem = {
            id: `item-${Date.now()}`,
            name: newProductName.trim(),
            quantity: Math.max(1, Number(newProductQty) || 1),
            unit: newProductUnit.trim() || 'units',
            category: (request as any)?.category || 'General',
        };
        const updated = [...requestedProducts, newProd];
        setRequestedProducts(updated);
        setActiveProductIndex(updated.length - 1);
        setSearchItemName(newProd.name);
        setNewProductName('');
        setNewProductQty(1);
        setNewProductUnit('units');
        setIsAddingProduct(false);

        // Check if an existing draft purchase order is already present before inserting another
        try {
            const reqIdStr = request?.id ? String(request.id).toLowerCase().trim() : '';
            const matchedUuid = reqIdStr.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0];
            const newProdNameLower = newProd.name.toLowerCase().trim();

            let existingDraftPO: any = null;
            if (matchedUuid) {
                const { data: poByReq } = await supabase
                    .from('purchase_orders')
                    .select('*')
                    .eq('request_id', matchedUuid)
                    .ilike('status', 'draft')
                    .order('created_at', { ascending: false })
                    .limit(1);
                if (poByReq && poByReq.length > 0) {
                    existingDraftPO = poByReq[0];
                }
            }

            const itemObj = {
                item_name: newProd.name,
                name: newProd.name,
                description: `Added product: ${newProd.name}`,
                category: newProd.category,
                quantity: newProd.quantity,
                quantity_ordered: newProd.quantity,
                quantity_received: 0,
                unit: newProd.unit,
                unit_price: 0,
                subtotal: 0,
                total: 0,
            };

            if (existingDraftPO) {
                // Append item to the existing draft PO instead of inserting a whole new PO
                const existingItems = Array.isArray(existingDraftPO.items) ? [...existingDraftPO.items] : [];
                const itemIndex = existingItems.findIndex((it: any) => {
                    const name = String(it.name || it.item_name || '').toLowerCase().trim();
                    return name === newProdNameLower;
                });
                if (itemIndex >= 0) {
                    existingItems[itemIndex] = { ...existingItems[itemIndex], ...itemObj };
                } else {
                    existingItems.push(itemObj);
                }
                await supabase
                    .from('purchase_orders')
                    .update({
                        items: existingItems,
                        notes: `Draft PO updated with added product: ${newProd.name}`,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingDraftPO.id);
            }
        } catch (e) {
            console.warn('Error checking/saving draft PO for added product:', e);
        }

        toast.success(`Added "${newProd.name}" (${newProd.quantity} ${newProd.unit}) to requested products list.`);
        runOverpassSearch(selectedRadiusKm, undefined, newProd.name);
    };

    const handleRemoveProduct = (index: number) => {
        if (requestedProducts.length <= 1) {
            toast.warning('A request must have at least one product.');
            return;
        }
        const updated = requestedProducts.filter((_, i) => i !== index);
        setRequestedProducts(updated);
        const nextIndex = Math.min(activeProductIndex, updated.length - 1);
        setActiveProductIndex(nextIndex);
        setSearchItemName(updated[nextIndex]?.name || '');
        runOverpassSearch(selectedRadiusKm, undefined, updated[nextIndex]?.name);
    };

    // 1. Fetch existing DB suppliers to identify suppliers already linked to THIS request & check if bid awarded
    useEffect(() => {
        if (!isOpen || !request) return;

        const loadDbSuppliers = async () => {
            try {
                const { data } = await supabase
                    .from('suppliers')
                    .select('*')
                    .order('name', { ascending: true });
                if (data) {
                    setDbSuppliers(data);
                    // Mark suppliers already added for THIS specific request & specific item
                    const reqIdStr = String(request.id).toLowerCase().trim();
                    const reqNumStr = request.request_number ? String(request.request_number).toLowerCase().trim() : '';

                    const activeItem = requestedProducts[activeProductIndex];
                    const currentItemId = (activeItem?.id || (activeItem as any)?.item_id || '').toLowerCase().trim();
                    const currentItemName = searchItemName || activeItem?.name || request.item_name || '';
                    const currentItemLower = currentItemName.toLowerCase().trim();

                    const thisItemSupplierSet = new Set<string>();
                    let winnerName: string | null = null;

                    data.forEach((s) => {
                        const sNotes = (s.notes || '').toLowerCase();
                        const sProducts = (s.products || '').toLowerCase();
                        const sReqId = String(s.purchase_request_id || '').toLowerCase().trim();
                        const isLinkedToThisReq = sNotes && (
                            sNotes.includes(`request id: ${reqIdStr}`) ||
                            sNotes.includes(reqIdStr) ||
                            (reqNumStr && sNotes.includes(reqNumStr)) ||
                            (sReqId && (sReqId === reqIdStr || sReqId === reqNumStr))
                        );

                        if (isLinkedToThisReq) {
                            let isLinkedToThisItem = false;
                            if (currentItemId && sNotes.includes(currentItemId)) {
                                isLinkedToThisItem = true;
                            } else if (currentItemLower && (sNotes.includes(`item: ${currentItemLower}`) || sProducts.includes(currentItemLower) || (!sNotes.includes('item:') && sNotes.includes(currentItemLower)))) {
                                isLinkedToThisItem = true;
                            } else if (requestedProducts.length <= 1 && !sNotes.includes('item:')) {
                                isLinkedToThisItem = true;
                            }

                            if (isLinkedToThisItem) {
                                thisItemSupplierSet.add(s.name.toLowerCase().trim());
                                if (s.notes) {
                                    const match = s.notes.match(/OSM ID:\s*(?:node|way|relation)?\/?([0-9]+)/i);
                                    if (match && match[1]) thisItemSupplierSet.add(match[1]);
                                }
                            }
                        }
                    });

                    // Check ONLY supplier_quotations for this specific request and item with accepted status
                    const { data: quotes } = await supabase
                        .from('supplier_quotations')
                        .select('supplier_name, status, request_number, request_id, item_name')
                        .ilike('status', '%accept%');

                    if (quotes) {
                        quotes.forEach((q: any) => {
                            const qNum = String(q.request_number || '').trim().toLowerCase();
                            const qId = String(q.request_id || '').trim().toLowerCase();
                            const qItem = String(q.item_name || '').trim().toLowerCase();
                            const matchesReq = (reqNumStr && qNum === reqNumStr) || (reqIdStr && qId === reqIdStr) || (reqNumStr && qId === reqNumStr);
                            const matchesItem = !currentItemLower || !qItem || qItem.includes(currentItemLower) || currentItemLower.includes(qItem);
                            if (matchesReq && matchesItem) {
                                winnerName = q.supplier_name;
                            }
                        });
                    }

                    if (winnerName) {
                        setIsBidAwarded(true);
                        setAwardedSupplierName(winnerName);
                    } else {
                        setIsBidAwarded(false);
                        setAwardedSupplierName(null);
                    }

                    setAddedSupplierIds(thisItemSupplierSet);
                }
            } catch (err) {
                console.error('Error fetching database suppliers:', err);
            }
        };

        loadDbSuppliers();
    }, [isOpen, request?.id, activeProductIndex, searchItemName, requestedProducts]);

    // Calculate total saved potential suppliers for this request
    const totalSavedForThisRequest = useMemo(() => {
        if (!request || !dbSuppliers) return addedSupplierIds.size;
        const reqIdStr = String(request.id || '').toLowerCase().trim();
        const reqNumStr = String(request.request_number || '').toLowerCase().trim();
        const matched = dbSuppliers.filter(s => {
            const sNotes = (s.notes || '').toLowerCase();
            const sReqId = String(s.purchase_request_id || '').toLowerCase().trim();
            return (
                (reqIdStr && sNotes.includes(reqIdStr)) ||
                (reqNumStr && sNotes.includes(reqNumStr)) ||
                (sReqId && (sReqId === reqIdStr || sReqId === reqNumStr))
            );
        }).length;
        const localAdded = Array.from(addedSupplierIds).filter(id => isNaN(Number(id))).length;
        return Math.max(matched, localAdded);
    }, [request, dbSuppliers, addedSupplierIds]);

    // 2. Query OpenStreetMap through Overpass API
    const runOverpassSearch = async (
        overrideRadius?: number,
        overrideLocation?: string,
        overrideItem?: string
    ) => {
        if (!request) return;
        setLoadingOverpass(true);
        try {
            const queryTarget = typeof overrideItem === 'string'
                ? overrideItem.trim()
                : (searchItemName.trim() || request.item_name || '');

            const locationQuery = typeof overrideLocation === 'string'
                ? overrideLocation
                : (isCustomLocation ? (customLocationText || 'Quezon City') : selectedLocation);

            const radius = typeof overrideRadius === 'number'
                ? overrideRadius
                : selectedRadiusKm;

            const resolvedCoords = resolveDestinationCoords(locationQuery);

            const realBusinesses = await searchOpenStreetMapOverpass({
                requestedItem: queryTarget,
                category: (request as any).category || (request.items && request.items[0]?.category) || '',
                locationName: locationQuery,
                radiusKm: radius,
                hqCoord: resolvedCoords,
            });

            setOsmBusinesses(realBusinesses);
            if (realBusinesses.length > 0) {
                setSelectedBusiness(realBusinesses[0]);
            } else {
                setSelectedBusiness(null);
            }
        } catch (err) {
            console.warn('Overpass search notice:', err);
            toast.error('Unable to fetch OpenStreetMap stores. Please check location or radius.');
        } finally {
            setLoadingOverpass(false);
        }
    };

    // Trigger search when modal opens
    useEffect(() => {
        if (!isOpen || !request) return;
        runOverpassSearch();
    }, [isOpen, request?.id]);

    const currentSearchCoords = useMemo(() => {
        const locationQuery = isCustomLocation ? (customLocationText || 'Quezon City') : selectedLocation;
        return resolveDestinationCoords(locationQuery);
    }, [isCustomLocation, customLocationText, selectedLocation]);

    // 3. Merge live OSM real businesses with database suppliers
    const allBusinesses = useMemo<OSMStoreDetails[]>(() => {
        return mergeOSMWithDatabaseSuppliers(osmBusinesses, dbSuppliers, currentSearchCoords, selectedRadiusKm);
    }, [osmBusinesses, dbSuppliers, currentSearchCoords, selectedRadiusKm]);

    // Filter businesses based on search term, category, and radius
    const filteredBusinesses = useMemo(() => {
        return allBusinesses.filter((b) => {
            if (resultsSearchTerm.trim()) {
                const term = resultsSearchTerm.toLowerCase();
                const matchName = b.name?.toLowerCase().includes(term);
                const matchCategory = b.category?.toLowerCase().includes(term);
                const matchLocation = b.location?.toLowerCase().includes(term);
                const matchProducts = b.products?.toLowerCase().includes(term);
                if (!matchName && !matchCategory && !matchLocation && !matchProducts) {
                    return false;
                }
            }

            if (categoryFilter !== 'all') {
                if ((b.category || '').toLowerCase() !== categoryFilter.toLowerCase()) {
                    return false;
                }
            }

            if (distanceFilter !== 'all') {
                const maxKm = parseFloat(distanceFilter);
                if (!isNaN(maxKm) && b.distanceKm > maxKm) {
                    return false;
                }
            }

            return true;
        });
    }, [allBusinesses, resultsSearchTerm, categoryFilter, distanceFilter]);

    // Filtered and sorted businesses for View All modal
    const viewAllBusinesses = useMemo(() => {
        let list = [...allBusinesses];
        if (resultsSearchTerm.trim()) {
            const term = resultsSearchTerm.toLowerCase();
            list = list.filter((b) => {
                const matchName = b.name?.toLowerCase().includes(term);
                const matchCategory = b.category?.toLowerCase().includes(term);
                const matchLocation = b.location?.toLowerCase().includes(term);
                const matchProducts = b.products?.toLowerCase().includes(term);
                return matchName || matchCategory || matchLocation || matchProducts;
            });
        }

        if (categoryFilter !== 'all') {
            list = list.filter((b) => (b.category || '').toLowerCase() === categoryFilter.toLowerCase());
        }

        if (distanceFilter !== 'all') {
            const maxKm = parseFloat(distanceFilter);
            if (!isNaN(maxKm)) {
                list = list.filter((b) => b.distanceKm <= maxKm);
            }
        }

        if (viewAllMatchFilter !== 'all') {
            list = list.filter((b) => b.matchLevel === viewAllMatchFilter);
        }

        if (viewAllSortBy === 'distance') {
            list.sort((a, b) => a.distanceKm - b.distanceKm);
        } else if (viewAllSortBy === 'name') {
            list.sort((a, b) => a.name.localeCompare(b.name));
        }

        return list;
    }, [allBusinesses, resultsSearchTerm, categoryFilter, distanceFilter, viewAllMatchFilter, viewAllSortBy]);

    // Auto-select first business if none selected
    useEffect(() => {
        if (filteredBusinesses.length > 0 && !selectedBusiness) {
            setSelectedBusiness(filteredBusinesses[0]);
        }
    }, [filteredBusinesses, selectedBusiness]);

    // Reset pagination limit on filter change
    useEffect(() => {
        setVisibleCardsLimit(30);
    }, [resultsSearchTerm, categoryFilter, distanceFilter, selectedLocation, selectedRadiusKm]);

    if (!isOpen || !request) return null;

    const requestedItems = Array.isArray(request.items) && request.items.length > 0
        ? request.items
        : [{
            name: request.item_name,
            quantity: request.quantity_requested || 1,
            unit: request.unit || 'units',
            category: (request as any).category || 'Others',
            specs: (request as any).specifications || (request as any).specs || '',
        }];

    const handleSelectBusiness = (b: OSMStoreDetails) => {
        setSelectedBusiness(b);
        setActiveDetailView(true);
    };

    const handleSelectBusinessById = (id: string | number) => {
        const found = allBusinesses.find((b) => String(b.id) === String(id));
        if (found) {
            setSelectedBusiness(found);
            setActiveDetailView(true);
        }
    };

    // Active current item name and category
    const currentActiveItem = requestedProducts[activeProductIndex] || {
        id: (request as any)?.item_id || request?.id || '',
        name: searchItemName || request.item_name || 'Requested Item',
        item_name: searchItemName || request.item_name || 'Requested Item',
        quantity: request.quantity_requested || 1,
        unit: request.unit || 'units',
        category: (request as any)?.category || 'General',
    };
    const currentItemNameForOffer = currentActiveItem.name || searchItemName || request.item_name || '';
    const currentItemCatForOffer = currentActiveItem.category || (request as any)?.category || '';

    // Handle Official Supplier Direct Order -> Create Purchase Order Modal
    const handleOrderFromOfficialSupplier = (business: OSMStoreDetails, matchedOfficial?: any) => {
        const officialSup = matchedOfficial || findOfficialSupplierMatch(business, dbSuppliers);
        const targetSup = officialSup || {
            id: String(business.id).replace(/^db-supplier-/, ''),
            name: business.name,
            category: business.category,
            contact_person: business.contact_person,
            phone: business.phone,
            email: business.email,
        };

        const activeItem = currentActiveItem;
        const itemName = activeItem.name || activeItem.item_name || 'Supplies';

        if (onOpenPOModal) {
            onClose();
            onOpenPOModal(activeItem, targetSup);
        } else {
            setInternalPORequest({
                id: `official_po_${Date.now()}`,
                request_number: request?.request_number || undefined,
                supplier_id: String(targetSup.id),
                supplier_name: targetSup.name,
                description: `Replenishment purchase order for ${itemName}`,
                department: activeItem.category || 'General Supplies',
                amount: 0,
                allowEditItems: true,
                items: [
                    {
                        name: itemName,
                        item_name: itemName,
                        quantity: activeItem.quantity || 1,
                        unit: activeItem.unit || 'units',
                        unit_price: Number(targetSup.price || 0),
                        total: 0,
                    }
                ]
            });
            setIsInternalPOModalOpen(true);
        }
    };

    // Handle Inquire when item is not part of supplier's offer
    const handleInquireSupplier = async (business: OSMStoreDetails) => {
        if (!business || !request) return;

        const itemName = currentActiveItem.name || searchItemName || request.item_name || 'Requested Item';
        const qty = currentActiveItem.quantity || request.quantity_requested || 1;
        const unit = currentActiveItem.unit || request.unit || 'units';

        const inquiryText = `Hi ${business.name}, we would like to inquire about sourcing "${itemName}" (${qty} ${unit}). Could you let us know if your company can supply this item and provide quotation/pricing details? Thank you!`;

        // Check if supplier is already in DB
        let targetSupplier = findOfficialSupplierMatch(business, dbSuppliers) || dbSuppliers.find(s => {
            const rawId = String(business.id || '').replace(/^db-supplier-/, '').trim();
            if (rawId && String(s.id) === rawId) return true;
            const bName = (business.name || '').toLowerCase().trim();
            const sName = (s.name || '').toLowerCase().trim();
            return bName && sName && (bName === sName || sName.includes(bName) || bName.includes(sName));
        });

        // If not in DB, create a lead record in suppliers table so messages can be sent
        if (!targetSupplier || !targetSupplier.id) {
            try {
                const { data: newSupp, error: insertErr } = await supabase
                    .from('suppliers')
                    .insert({
                        name: business.name.trim(),
                        category: business.category || 'Potential Supplier',
                        contact_person: business.contact_person || 'Sales Desk',
                        phone: business.phone || '+63 2 8000 0000',
                        email: business.email || null,
                        location: business.location || 'Metro Manila, Philippines',
                        products: business.products || `${business.category || 'General'} Goods`,
                        notes: `Source: OpenStreetMap | Lead for Inquiry: ${itemName}`,
                        is_active: false,
                    })
                    .select()
                    .single();

                if (!insertErr && newSupp) {
                    targetSupplier = newSupp;
                    setDbSuppliers(prev => [...prev, newSupp]);
                }
            } catch (err) {
                console.error('Error creating supplier lead for inquiry:', err);
            }
        }

        const supplierForModal = targetSupplier || {
            id: String(business.id).replace(/^db-supplier-/, '') || `sup-${Date.now()}`,
            name: business.name,
            contact_person: business.contact_person || 'Sales Desk',
            phone: business.phone || '',
            email: business.email || '',
            location: business.location || '',
            category: business.category || 'Potential Supplier',
            products: business.products || '',
            is_active: false,
        };

        setMessageModalSupplier(supplierForModal);
        setMessageModalInitialText(inquiryText);
        setIsMessageModalOpen(true);
    };

    // Handle "Add as Potential Supplier"
    const handleAddAsPotentialSupplier = async (business: OSMStoreDetails) => {
        if (!business || !business.name || !request) return;

        if (isBidAwarded) {
            toast.warning('Bid has already been awarded for this requisition. Adding new potential suppliers is disabled.');
            return;
        }

        setSavingSupplierId(String(business.id));
        try {
            const activeItem = requestedProducts[activeProductIndex] || {
                id: (request as any)?.item_id || request?.id || '',
                name: searchItemName || request.item_name || 'Requested Item',
                quantity: request.quantity_requested || 1,
                unit: request.unit || 'units',
                category: (request as any).category || 'General',
            };
            const currentItemName = activeItem.name || searchItemName || request.item_name || '';

            // Build formatted products string with quantities for the active item
            const formattedProductsWithQty = `${activeItem.quantity || 1} ${activeItem.unit || 'units'} of ${currentItemName}`;

            const res = await addPotentialSupplier({
                supplier: {
                    name: business.name,
                    category: business.category || 'Potential Supplier',
                    contact_person: business.contact_person || business.operator || 'Store Contact',
                    phone: business.phone || '',
                    email: business.email || '',
                    location: business.location || 'Metro Manila, Philippines',
                    products: formattedProductsWithQty || business.products || `${business.category} Supplies`,
                    website: business.website || '',
                    osm_id: business.osmId,
                    osm_type: business.osmType,
                    tags: business.tags,
                },
                requestId: request.id,
                itemId: activeItem.id || (activeItem as any).item_id,
                itemName: currentItemName,
            });

            if (res.success) {
                toast.success(res.message || `"${business.name}" saved as Potential Supplier for ${currentItemName}.`);

                setAddedSupplierIds((prev) => {
                    const next = new Set(prev);
                    next.add(business.name.toLowerCase().trim());
                    if (business.osmId) next.add(String(business.osmId));
                    next.add(String(business.id));
                    return next;
                });
            } else if ((res as any).alreadyExistsInThisRequest) {
                toast.warning(`Duplicate Supplier: "${business.name}" is already listed for "${currentItemName}" under this request (#${request.request_number || request.id}).`);
            } else {
                toast.error(res.error || 'Failed to save potential supplier.');
            }
        } catch (err: any) {
            console.error('Error adding potential supplier:', err);
            toast.error(err?.message || 'Failed to save potential supplier.');
        } finally {
            setSavingSupplierId(null);
        }
    };

    const isBusinessAlreadySaved = (b: OSMStoreDetails) => {
        if (!b) return false;
        return (
            addedSupplierIds.has(b.name.toLowerCase().trim()) ||
            (b.osmId && addedSupplierIds.has(String(b.osmId))) ||
            addedSupplierIds.has(String(b.id))
        );
    };

    const activeCenterCoords = resolveDestinationCoords(
        isCustomLocation ? (customLocationText || 'Quezon City') : selectedLocation
    );

    return (
        <Portal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/65 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
                {/* Main Modal Shell */}
                <div 
                    className={`bg-[#ebf0f7] dark:bg-[#12141f] shadow-none border border-slate-200/80 dark:border-white/10 flex flex-col min-h-0 overflow-hidden my-auto transition-all duration-300 ${
                        isFullMap 
                            ? 'fixed inset-1 sm:inset-2 w-[calc(100vw-8px)] sm:w-[calc(100vw-16px)] h-[calc(100vh-8px)] sm:h-[calc(100vh-16px)] max-w-none max-h-none rounded-2xl sm:rounded-3xl z-[60]' 
                            : 'w-full max-w-[1540px] h-[95vh] max-h-[960px] rounded-[32px]'
                    }`}
                >
                    {/* Modal Top Header */}
                    <div className={`px-4 sm:px-6 ${isFullMap ? 'py-2.5' : 'py-4'} border-b border-white/80 dark:border-white/[0.05] bg-[#ebf0f7]/80 dark:bg-[#141624]/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0`}>
                        <div className="flex items-center gap-3">
                            <div className={`${isFullMap ? 'w-9 h-9' : 'w-11 h-11'} rounded-2xl bg-pink-600 text-white flex items-center justify-center shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(219,39,119,0.4)] shrink-0`}>
                                <Compass className={isFullMap ? "w-4 h-4" : "w-5 h-5"} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className={`${isFullMap ? 'text-sm sm:text-base' : 'text-base sm:text-lg'} font-black text-slate-900 dark:text-white tracking-tight`}>
                                        FIND POTENTIAL SUPPLIERS
                                    </h2>
                                    {/* Saved suppliers counter & link to /procurement?stage=3 */}
                                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#ebf0f7] dark:bg-[#181a28] border border-white/80 dark:border-white/[0.05] shadow-[-2px_-2px_5px_rgba(255,255,255,0.85),_2px_2px_5px_rgba(163,177,198,0.35)] dark:shadow-[-1px_-1px_3px_rgba(255,255,255,0.02),_2px_2px_5px_rgba(0,0,0,0.6)]">
                                        <Store className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
                                        <span className="text-[11px] font-black text-slate-800 dark:text-slate-100">
                                            {totalSavedForThisRequest} Saved
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
                                    {isFullMap ? (
                                        <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl text-[10px] font-black bg-pink-500/10 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                                            <span>PR: {request.request_number || (request.id ? `PR-${String(request.id).slice(0, 8)}` : 'PR-GENERAL')}</span>
                                            <span className="text-slate-400">•</span>
                                            <span>{searchItemName || request.item_name}</span>
                                        </span>
                                    ) : (
                                        <span className="px-2.5 py-0.5 rounded-xl text-[10px] font-black bg-[#e2e8f0] dark:bg-[#1c1e2e] text-pink-600 dark:text-pink-400 shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4),_inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5),_inset_-1px_-1px_3px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04]">
                                            OpenStreetMap Overpass API
                                        </span>
                                    )}
                                </div>
                                {!isFullMap && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                        Discover and evaluate real nearby businesses for pending purchase request • Request remains <strong className="text-amber-600 dark:text-amber-400 font-bold">Pending</strong>
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Top Controls */}
                        <div className="flex items-center gap-2">
                            {isFullMap && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setShowSidebarInFullMap((prev) => !prev)}
                                        className={`px-3 py-1.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-white/60 dark:border-white/[0.04] ${
                                            showSidebarInFullMap
                                                ? 'bg-pink-600 text-white shadow-md'
                                                : 'bg-[#ebf0f7] dark:bg-[#161826] text-slate-700 dark:text-slate-300 hover:text-pink-600'
                                        }`}
                                        title="Toggle Stores Directory Drawer"
                                    >
                                        <Store className="w-3.5 h-3.5" />
                                        <span>Stores List ({filteredBusinesses.length})</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setShowFiltersInFullMap((prev) => !prev)}
                                        className={`px-3 py-1.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-white/60 dark:border-white/[0.04] ${
                                            showFiltersInFullMap
                                                ? 'bg-pink-600 text-white shadow-md'
                                                : 'bg-[#ebf0f7] dark:bg-[#161826] text-slate-700 dark:text-slate-300 hover:text-pink-600'
                                        }`}
                                        title="Toggle Search & Radius Filters"
                                    >
                                        <Filter className="w-3.5 h-3.5" />
                                        <span>Filters ({selectedRadiusKm}km)</span>
                                    </button>
                                </>
                            )}

                            <button
                                type="button"
                                onClick={() => {
                                    setIsFullMap((prev) => !prev);
                                    setShowSidebarInFullMap(false);
                                }}
                                className="p-2 sm:px-3 sm:py-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-600 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_3px_3px_8px_rgba(0,0,0,0.6)] active:shadow-[inset_2px_2px_4px_rgba(163,177,198,0.4)] dark:active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)] transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-white/60 dark:border-white/[0.04]"
                                title={isFullMap ? 'Exit Full Map (Split View)' : 'Maximize Map View'}
                            >
                                {isFullMap ? (
                                    <>
                                        <Minimize2 className="w-4 h-4 text-pink-500" />
                                        <span className="hidden sm:inline">Split View</span>
                                    </>
                                ) : (
                                    <>
                                        <Maximize2 className="w-4 h-4" />
                                        <span className="hidden sm:inline">Full Map</span>
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={onClose}
                                className="p-2 sm:p-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_3px_3px_8px_rgba(0,0,0,0.6)] active:shadow-[inset_2px_2px_4px_rgba(163,177,198,0.4)] dark:active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)] transition-all cursor-pointer border border-white/60 dark:border-white/[0.04]"
                                aria-label="Close modal"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Awarded Bid Notice Banner (Only in Split View) */}
                    {!isFullMap && isBidAwarded && (
                        <div className="px-6 py-3 bg-amber-500/10 dark:bg-amber-500/15 border-b border-amber-500/30 flex items-center gap-3 text-amber-900 dark:text-amber-200 text-xs shrink-0 animate-in fade-in-50 duration-200">
                            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                            <p className="leading-snug">
                                <strong>Bid Already Awarded:</strong> The procurement evaluation for this requisition is complete and awarded to <strong>{awardedSupplierName || 'the winning supplier'}</strong>. Sourcing and adding new potential suppliers for this requisition is closed.
                            </p>
                        </div>
                    )}

                    {/* Purchase Request Overview Header Card (Only in Split View) */}
                    {!isFullMap && (
                        <div className="px-6 py-2.5 border-b border-white/80 dark:border-white/[0.05] bg-[#e6ecf5] dark:bg-[#141624] flex items-center justify-between gap-4 flex-wrap text-xs shrink-0">
                            <div className="flex items-center gap-4 flex-wrap">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Purchase Request</span>
                                    <strong className="text-slate-900 dark:text-slate-100 font-mono font-extrabold text-sm">
                                        {request.request_number || (request.id ? `PR-${String(request.id).slice(0, 8)}` : 'PR-GENERAL')}
                                    </strong>
                                </div>

                                <div className="h-7 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block"></div>

                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Products</span>
                                    <span className="font-extrabold text-slate-900 dark:text-slate-100">
                                        {requestedProducts.length} {requestedProducts.length === 1 ? 'Product' : 'Products'}
                                    </span>
                                </div>

                                <div className="h-7 w-px bg-slate-300 dark:bg-slate-700 hidden md:block"></div>

                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Department</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                        {request.department || 'Office / General'}
                                    </span>
                                </div>

                                {request.purpose && (
                                    <>
                                        <div className="h-7 w-px bg-slate-300 dark:bg-slate-700 hidden lg:block"></div>
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Purpose</span>
                                            <span className="font-medium text-slate-600 dark:text-slate-300 truncate max-w-[180px] inline-block align-bottom" title={request.purpose}>
                                                {request.purpose}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <StatusBadge tone="amber" dot size="xs">
                                    Status: Pending
                                </StatusBadge>
                            </div>
                        </div>
                    )}

                    {/* Interactive Requested Products & Quantity Sourcing Manager (Only in Split View) */}
                    {!isFullMap && (
                        <div className="px-6 py-3 border-b border-white/80 dark:border-white/[0.05] bg-[#ebf0f7] dark:bg-[#131522] space-y-2.5 shrink-0">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <Boxes className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                        Requested Products & Quantities
                                    </span>
                                    <span className="text-[11px] text-slate-500 font-medium">
                                        (Adjust quantities or add products for supplier proposals)
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setIsAddingProduct((prev) => !prev)}
                                    className="px-3 py-1 rounded-xl text-xs font-bold bg-[#ebf0f7] dark:bg-[#161826] text-pink-600 dark:text-pink-400 hover:text-pink-700 shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.02),_2px_2px_5px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/[0.04] flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                                >
                                    <PlusCircle className="w-3.5 h-3.5" />
                                    <span>{isAddingProduct ? 'Cancel' : '+ Add Product'}</span>
                                </button>
                            </div>

                            {/* Inline Add Product Form */}
                            {isAddingProduct && (
                                <div className="p-3 rounded-2xl bg-[#e2e8f0]/70 dark:bg-[#181a2b] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.3),_inset_-2px_-2px_5px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/70 dark:border-white/[0.04] grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center animate-in fade-in-50 duration-200">
                                    <div className="sm:col-span-5">
                                        <input
                                            type="text"
                                            value={newProductName}
                                            onChange={(e) => setNewProductName(e.target.value)}
                                            placeholder="Product Name (e.g., Pilot G2 Pens)..."
                                            className="w-full px-3 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#131522] text-xs font-bold text-slate-900 dark:text-white border border-white/60 dark:border-white/[0.04] shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.6)] focus:outline-none focus:ring-1 focus:ring-pink-500"
                                        />
                                    </div>
                                    <div className="sm:col-span-3 flex items-center gap-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Qty:</label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={newProductQty}
                                            onChange={(e) => setNewProductQty(Math.max(1, parseInt(e.target.value) || 1))}
                                            className="w-full px-2.5 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#131522] text-xs font-bold text-slate-900 dark:text-white border border-white/60 dark:border-white/[0.04] shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.6)] focus:outline-none focus:ring-1 focus:ring-pink-500"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <select
                                            value={newProductUnit}
                                            onChange={(e) => setNewProductUnit(e.target.value)}
                                            className="w-full px-2 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#131522] text-xs font-bold text-slate-900 dark:text-white border border-white/60 dark:border-white/[0.04] focus:outline-none focus:ring-1 focus:ring-pink-500 cursor-pointer"
                                        >
                                            {COMMON_UNITS.map((u) => (
                                                <option key={u} value={u}>{u}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="sm:col-span-2 flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={handleAddProduct}
                                            className="w-full py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black shadow-[-2px_-2px_4px_rgba(255,255,255,0.3),_2px_2px_6px_rgba(219,39,119,0.4)] transition-all cursor-pointer text-center"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* List of Product Chips with Stepper & Sourcing Action */}
                            <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
                                {requestedProducts.map((prod, idx) => {
                                    const isActive = idx === activeProductIndex;
                                    return (
                                        <div
                                            key={prod.id || idx}
                                            className={`shrink-0 p-2.5 rounded-2xl border transition-all flex items-center gap-2.5 shadow-none ${
                                                isActive
                                                    ? 'bg-pink-50/70 dark:bg-pink-950/30 border-2 border-pink-500'
                                                    : 'bg-white dark:bg-[#161826] border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                            }`}
                                        >
                                            {/* Product Name & Active Selector */}
                                            <button
                                                type="button"
                                                onClick={() => handleSelectActiveProduct(idx)}
                                                className="text-left cursor-pointer group"
                                                title="Click to search OpenStreetMap for this item"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`text-xs font-black ${isActive ? 'text-pink-600 dark:text-pink-400' : 'text-slate-800 dark:text-slate-200 group-hover:text-pink-500'}`}>
                                                        {prod.name}
                                                    </span>
                                                    {isActive && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-ping"></span>
                                                    )}
                                                </div>
                                            </button>

                                            {/* Quantity Stepper */}
                                            <div className="flex items-center bg-[#e2e8f0] dark:bg-[#12141f] rounded-xl px-1.5 py-0.5 shadow-[inset_1px_1px_2px_rgba(163,177,198,0.4)] dark:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.6)]">
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateProductQuantity(idx, prod.quantity - 1)}
                                                    className="w-5 h-5 rounded-lg flex items-center justify-center text-slate-500 hover:text-pink-600 font-bold text-xs cursor-pointer active:scale-90"
                                                    title="Decrease quantity"
                                                >
                                                    -
                                                </button>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={prod.quantity}
                                                    onChange={(e) => handleUpdateProductQuantity(idx, parseInt(e.target.value) || 1)}
                                                    className="w-12 text-center bg-transparent text-xs font-black text-slate-900 dark:text-white focus:outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateProductQuantity(idx, prod.quantity + 1)}
                                                    className="w-5 h-5 rounded-lg flex items-center justify-center text-slate-500 hover:text-pink-600 font-bold text-xs cursor-pointer active:scale-90"
                                                    title="Increase quantity"
                                                >
                                                    +
                                                </button>
                                            </div>

                                            {/* Unit Selector */}
                                            <select
                                                value={prod.unit}
                                                onChange={(e) => handleUpdateProductUnit(idx, e.target.value)}
                                                className="px-1.5 py-0.5 text-[11px] font-bold bg-[#e2e8f0] dark:bg-[#12141f] text-slate-700 dark:text-slate-300 rounded-lg border-0 focus:outline-none cursor-pointer"
                                            >
                                                {COMMON_UNITS.map((u) => (
                                                    <option key={u} value={u}>{u}</option>
                                                ))}
                                            </select>

                                            {/* Update Quantity Action Button */}
                                            <button
                                                type="button"
                                                disabled={updatingQtyIdx === idx}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSaveProductUpdate(idx);
                                                }}
                                                className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-pink-600 hover:bg-pink-500 text-white shadow-[-1px_-1px_2px_rgba(255,255,255,0.4),_1px_1px_3px_rgba(219,39,119,0.4)] active:scale-95 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                                                title="Save updated quantity as Draft PO"
                                            >
                                                {updatingQtyIdx === idx ? (
                                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <Check className="w-3 h-3" />
                                                )}
                                                <span>Update</span>
                                            </button>

                                            {/* Quick Search OSM Button */}
                                            <button
                                                type="button"
                                                onClick={() => handleSelectActiveProduct(idx)}
                                                className={`p-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                                    isActive
                                                        ? 'bg-pink-600 text-white shadow-[-1px_-1px_3px_rgba(255,255,255,0.4),_1px_1px_4px_rgba(219,39,119,0.4)]'
                                                        : 'bg-[#e2e8f0] dark:bg-[#1a1d2e] text-slate-600 dark:text-slate-300 hover:text-pink-500'
                                                }`}
                                                title="Search suppliers for this item"
                                            >
                                                <Compass className="w-3.5 h-3.5" />
                                            </button>

                                            {/* Delete Button (if > 1 item) */}
                                            {requestedProducts.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveProduct(idx)}
                                                    className="p-1 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer transition-all"
                                                    title="Remove this product"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Interactive Search Controls Bar */}
                    {(!isFullMap || showFiltersInFullMap) && (
                        <div className="p-4 border-b border-white/80 dark:border-white/[0.05] bg-[#ebf0f7] dark:bg-[#131522] space-y-3 shrink-0 animate-in fade-in duration-200">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                                {/* 1. Requested Item Query */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center justify-between">
                                        <span className="flex items-center gap-1">
                                            <Tag className="w-3 h-3 text-pink-500" />
                                            <span>Target Item Query</span>
                                        </span>
                                        {requestedProducts[activeProductIndex] && (
                                            <span className="text-pink-600 dark:text-pink-400 font-mono font-bold text-[10px]">
                                                Req: {requestedProducts[activeProductIndex].quantity} {requestedProducts[activeProductIndex].unit}
                                            </span>
                                        )}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={searchItemName}
                                            onChange={(e) => setSearchItemName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    runOverpassSearch(selectedRadiusKm, undefined, searchItemName);
                                                }
                                            }}
                                            placeholder="e.g. A4 Bond Paper, Printer, Tires... (Press Enter)"
                                            className="w-full px-3.5 py-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.03)] border border-white/60 dark:border-white/[0.03] text-xs font-bold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                        />
                                    </div>
                                </div>

                                {/* 2. Search Location */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                        <MapPin className="w-3 h-3 text-pink-500" />
                                        <span>Search Location</span>
                                    </label>
                                    {isCustomLocation ? (
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="text"
                                                value={customLocationText}
                                                onChange={(e) => setCustomLocationText(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        runOverpassSearch(selectedRadiusKm, customLocationText);
                                                    }
                                                }}
                                                placeholder="Enter Philippine city... (Press Enter)"
                                                className="w-full px-3.5 py-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.03)] border border-white/60 dark:border-white/[0.03] text-xs font-bold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setIsCustomLocation(false)}
                                                className="px-2 py-2 rounded-xl text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                                                title="Back to presets"
                                            >
                                                Presets
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1">
                                            <select
                                                value={selectedLocation}
                                                onChange={(e) => {
                                                    if (e.target.value === '__custom__') {
                                                        setIsCustomLocation(true);
                                                        setCustomLocationText('');
                                                    } else {
                                                        setSelectedLocation(e.target.value);
                                                        runOverpassSearch(selectedRadiusKm, e.target.value);
                                                    }
                                                }}
                                                className="w-full px-3.5 py-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.03)] border border-white/60 dark:border-white/[0.03] text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40 cursor-pointer"
                                            >
                                                {LOCATION_PRESETS.map((loc) => (
                                                    <option key={loc.value} value={loc.value}>
                                                        {loc.label}
                                                    </option>
                                                ))}
                                                <option value="__custom__">+ Custom Location...</option>
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {/* 3. Search Radius */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                            <Compass className="w-3 h-3 text-pink-500" />
                                            <span>Radius ({selectedRadiusKm} km)</span>
                                        </label>
                                        <span className="text-[9px] font-black text-pink-600 dark:text-pink-400">Up to 500 km</span>
                                    </div>
                                    <div className="flex items-center gap-1 flex-wrap sm:flex-nowrap">
                                        {[
                                            { label: '10 km', val: 10 },
                                            { label: '25 km', val: 25 },
                                            { label: '50 km', val: 50 },
                                            { label: '100 km', val: 100 },
                                            { label: '250 km', val: 250 },
                                            { label: '500 km', val: 500 },
                                        ].map((r) => (
                                            <button
                                                key={r.val}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedRadiusKm(r.val);
                                                    runOverpassSearch(r.val);
                                                }}
                                                className={`flex-1 py-1.5 px-0.5 rounded-xl text-[11px] font-black transition-all cursor-pointer text-center ${
                                                    selectedRadiusKm === r.val
                                                        ? 'bg-pink-600 text-white shadow-[-2px_-2px_5px_rgba(255,255,255,0.3),_2px_2px_6px_rgba(219,39,119,0.4)]'
                                                        : 'bg-[#ebf0f7] dark:bg-[#161826] text-slate-600 dark:text-slate-300 shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.02),_2px_2px_5px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/[0.04]'
                                                }`}
                                            >
                                                {r.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 4. Trigger Search Button */}
                                <div>
                                    <button
                                        type="button"
                                        onClick={() => runOverpassSearch()}
                                        disabled={loadingOverpass}
                                        className="w-full py-2 px-4 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black shadow-[-2px_-2px_6px_rgba(255,255,255,0.25),_3px_3px_10px_rgba(219,39,119,0.45)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                                    >
                                        <Search className={`w-3.5 h-3.5 ${loadingOverpass ? 'animate-spin' : ''}`} />
                                        <span>{loadingOverpass ? 'Searching OSM...' : 'Search Suppliers'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Modal Body: Left Directory & Right Leaflet Map */}
                    <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden relative">
                        {/* Left Side: Results List or Detailed Business View */}
                        <div 
                            className={`flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-white/80 dark:border-white/[0.05] bg-[#ebf0f7] dark:bg-[#12141f] overflow-hidden transition-all duration-300 ${
                                isFullMap 
                                    ? showSidebarInFullMap
                                        ? 'w-full sm:w-[440px] absolute left-0 top-0 bottom-0 z-30 shadow-2xl bg-[#ebf0f7]/95 dark:bg-[#12141f]/95 backdrop-blur-xl border-r h-full animate-in slide-in-from-left duration-200' 
                                        : 'hidden' 
                                    : 'w-full lg:w-[540px] xl:w-[590px] h-[400px] lg:h-full shrink-0'
                            }`}
                        >
                            {/* View Switch: Results List vs Business Detail View */}
                            {activeDetailView && selectedBusiness ? (
                                /* Detailed Business View */
                                <div className="flex-1 min-h-0 flex flex-col overflow-y-auto p-4 space-y-4 animate-in fade-in slide-in-from-left duration-200 overscroll-contain">
                                    <div className="flex items-center justify-between">
                                        <button
                                            type="button"
                                            onClick={() => setActiveDetailView(false)}
                                            className="px-3 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-600 dark:text-slate-300 hover:text-pink-600 text-xs font-bold shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.02),_2px_2px_5px_rgba(0,0,0,0.6)] flex items-center gap-1 cursor-pointer"
                                        >
                                            <ChevronLeft className="w-3.5 h-3.5" />
                                            <span>Back to Results</span>
                                        </button>
                                        <span className="text-[10px] font-mono text-slate-400">
                                            OSM ID: {selectedBusiness.osmType || 'node'}/{selectedBusiness.osmId || selectedBusiness.id}
                                        </span>
                                    </div>

                                    {/* Business Profile Card */}
                                    <div className="p-5 rounded-2xl bg-white dark:bg-[#161826] border border-slate-200 dark:border-slate-800 shadow-none space-y-3.5">
                                        <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-200/80 dark:border-slate-800">
                                            <div>
                                                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                                                    {selectedBusiness.name}
                                                </h3>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400">
                                                        {selectedBusiness.category || 'Commercial Store'}
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                                        OpenStreetMap Verified
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-slate-100 dark:bg-[#1f2233] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                                                {selectedBusiness.distanceKm} km away
                                            </span>
                                        </div>

                                        {/* Business Details Grid */}
                                        <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                                            {selectedBusiness.location && (
                                                <div className="flex items-start gap-2">
                                                    <MapPin className="w-4 h-4 text-pink-500 shrink-0 mt-0.5" />
                                                    <div>
                                                        <strong className="text-slate-800 dark:text-slate-200 block">Address:</strong>
                                                        <span>{selectedBusiness.location}</span>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2">
                                                <Compass className="w-4 h-4 text-pink-500 shrink-0" />
                                                <div>
                                                    <strong className="text-slate-800 dark:text-slate-200">Coordinates:</strong>{' '}
                                                    <span className="font-mono text-[11px]">{selectedBusiness.coords.lat.toFixed(5)}, {selectedBusiness.coords.lng.toFixed(5)}</span>
                                                </div>
                                            </div>

                                            {selectedBusiness.operator && (
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="w-4 h-4 text-pink-500 shrink-0" />
                                                    <div>
                                                        <strong className="text-slate-800 dark:text-slate-200">Operator / Brand:</strong>{' '}
                                                        <span>{selectedBusiness.operator}</span>
                                                    </div>
                                                </div>
                                            )}

                                            {selectedBusiness.phone && (
                                                <div className="flex items-center gap-2">
                                                    <Phone className="w-4 h-4 text-pink-500 shrink-0" />
                                                    <div>
                                                        <strong className="text-slate-800 dark:text-slate-200">Phone:</strong>{' '}
                                                        <a href={`tel:${selectedBusiness.phone}`} className="text-pink-600 font-mono font-bold hover:underline">
                                                            {selectedBusiness.phone}
                                                        </a>
                                                    </div>
                                                </div>
                                            )}

                                            {selectedBusiness.website && (
                                                <div className="flex items-center gap-2">
                                                    <Globe className="w-4 h-4 text-pink-500 shrink-0" />
                                                    <div>
                                                        <strong className="text-slate-800 dark:text-slate-200">Website:</strong>{' '}
                                                        <a href={selectedBusiness.website} target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:underline inline-flex items-center gap-1">
                                                            {selectedBusiness.website} <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    </div>
                                                </div>
                                            )}

                                            {selectedBusiness.openingHours && (
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-4 h-4 text-pink-500 shrink-0" />
                                                    <div>
                                                        <strong className="text-slate-800 dark:text-slate-200">Opening Hours:</strong>{' '}
                                                        <span>{selectedBusiness.openingHours}</span>
                                                    </div>
                                                </div>
                                            )}

                                            {selectedBusiness.products && (
                                                <div className="pt-1.5 border-t border-slate-200/80 dark:border-slate-800">
                                                    <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">What They Supply:</strong>
                                                    <p className="text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-[#131522] p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800">
                                                        {selectedBusiness.products}
                                                    </p>
                                                </div>
                                            )}

                                            {/* External Verification Links (OpenStreetMap & Navigation) */}
                                            <div className="pt-2 flex items-center gap-2 border-t border-slate-200/80 dark:border-slate-800">
                                                <a
                                                    href={
                                                        selectedBusiness.osmId && /^[0-9]+$/.test(String(selectedBusiness.osmId))
                                                            ? `https://www.openstreetmap.org/${selectedBusiness.osmType || 'node'}/${selectedBusiness.osmId}`
                                                            : `https://www.openstreetmap.org/search?query=${encodeURIComponent(selectedBusiness.name + ' ' + selectedBusiness.location)}`
                                                    }
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex-1 py-1.5 px-2.5 rounded-xl bg-slate-100 dark:bg-[#1b1e2e] text-slate-700 dark:text-slate-300 hover:text-pink-600 text-[11px] font-bold border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                                                >
                                                    <Globe className="w-3.5 h-3.5 text-pink-500" />
                                                    <span>View on OpenStreetMap</span>
                                                    <ExternalLink className="w-3 h-3 opacity-60" />
                                                </a>

                                                <a
                                                    href={`https://www.google.com/maps/dir/?api=1&origin=14.6017,120.9721&destination=${selectedBusiness.coords.lat},${selectedBusiness.coords.lng}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex-1 py-1.5 px-2.5 rounded-xl bg-slate-100 dark:bg-[#1b1e2e] text-slate-700 dark:text-slate-300 hover:text-pink-600 text-[11px] font-bold border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                                                >
                                                    <Navigation className="w-3.5 h-3.5 text-blue-500" />
                                                    <span>Route from HQ</span>
                                                    <ExternalLink className="w-3 h-3 opacity-60" />
                                                </a>
                                            </div>
                                        </div>

                                        {/* Action Button: Dynamic based on Official / Offers Item / Inquire */}
                                        <div className="pt-2 border-t border-slate-200/60 dark:border-white/[0.04]">
                                            {(() => {
                                                const officialSup = findOfficialSupplierMatch(selectedBusiness, dbSuppliers);
                                                const isOfficial = Boolean(officialSup);
                                                const offersItem = checkSupplierOffersItem(selectedBusiness, currentItemNameForOffer, currentItemCatForOffer, officialSup);
                                                const isAlreadySaved = isBusinessAlreadySaved(selectedBusiness);

                                                if (isOfficial) {
                                                    return (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOrderFromOfficialSupplier(selectedBusiness, officialSup)}
                                                            className="w-full py-2.5 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-[-2px_-2px_6px_rgba(255,255,255,0.25),_3px_3px_10px_rgba(37,99,235,0.45)]"
                                                            title="Official supplier: Create Purchase Order directly"
                                                        >
                                                            <ShoppingCart className="w-4 h-4" />
                                                            <span>Order (Official supplier)</span>
                                                        </button>
                                                    );
                                                }

                                                if (!offersItem) {
                                                    return (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleInquireSupplier(selectedBusiness)}
                                                            className="w-full py-2.5 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-[-2px_-2px_6px_rgba(255,255,255,0.25),_3px_3px_10px_rgba(245,158,11,0.4)]"
                                                            title={`Item not part of standard offer. Click to message ${selectedBusiness.name} about ${currentItemNameForOffer}`}
                                                        >
                                                            <MessageSquare className="w-4 h-4" />
                                                            <span>Inquire</span>
                                                        </button>
                                                    );
                                                }

                                                return (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAddAsPotentialSupplier(selectedBusiness)}
                                                        disabled={savingSupplierId === String(selectedBusiness.id)}
                                                        className={`w-full py-2.5 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                                            isAlreadySaved
                                                                ? 'bg-emerald-600 text-white shadow-[-2px_-2px_6px_rgba(255,255,255,0.25),_3px_3px_8px_rgba(16,185,129,0.4)]'
                                                                : 'bg-pink-600 hover:bg-pink-500 text-white shadow-[-2px_-2px_6px_rgba(255,255,255,0.25),_3px_3px_10px_rgba(219,39,119,0.45)]'
                                                        }`}
                                                    >
                                                        {savingSupplierId === String(selectedBusiness.id) ? (
                                                            <>
                                                                <i className="fas fa-spinner fa-spin mr-1"></i>
                                                                <span>Saving to Potential Suppliers...</span>
                                                            </>
                                                        ) : isAlreadySaved ? (
                                                            <>
                                                                <CheckCircle2 className="w-4 h-4" />
                                                                <span>Added to Potential Suppliers (Pending Evaluation)</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <PlusCircle className="w-4 h-4" />
                                                                <span>Add as Potential Supplier</span>
                                                            </>
                                                        )}
                                                    </button>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* Results List View */
                                <>
                                    {/* Search & Radius Filter inside results */}
                                    <div className="p-3.5 border-b border-white/80 dark:border-white/[0.05] bg-[#ebf0f7] dark:bg-[#131522] space-y-2.5 shrink-0">
                                        <div className="relative">
                                            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Filter businesses by name, address or products..."
                                                value={resultsSearchTerm}
                                                onChange={(e) => setResultsSearchTerm(e.target.value)}
                                                className="w-full pl-9 pr-8 py-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.03)] border border-white/60 dark:border-white/[0.03] text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/40 transition-all"
                                            />
                                            {resultsSearchTerm && (
                                                <button
                                                    type="button"
                                                    onClick={() => setResultsSearchTerm('')}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Distance Filter Chips */}
                                        <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                                            <div className="flex items-center gap-1 text-slate-500">
                                                <Compass className="w-3 h-3 text-pink-500" />
                                                <span className="text-[10px] font-bold">Filter Proximity:</span>
                                            </div>
                                            {[
                                                { label: 'All', val: 'all' },
                                                { label: '< 15 km', val: '15' },
                                                { label: '< 50 km', val: '50' },
                                                { label: '< 150 km', val: '150' },
                                                { label: '< 500 km', val: '500' },
                                            ].map((chip) => (
                                                <button
                                                    key={chip.val}
                                                    type="button"
                                                    onClick={() => setDistanceFilter(chip.val)}
                                                    className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold transition-all cursor-pointer ${
                                                        distanceFilter === chip.val
                                                            ? 'bg-pink-600 text-white shadow-[-2px_-2px_5px_rgba(255,255,255,0.3),_2px_2px_6px_rgba(244,63,94,0.4)]'
                                                            : 'bg-[#ebf0f7] dark:bg-[#161826] text-slate-600 dark:text-slate-300 shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.02),_2px_2px_5px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/[0.04]'
                                                    }`}
                                                >
                                                    {chip.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Match Summary Banner */}
                                    {filteredBusinesses.length > 0 && (
                                        <div className="mx-3.5 mt-2.5 px-3.5 py-2.5 rounded-2xl bg-pink-500/10 dark:bg-pink-950/20 border border-pink-500/20 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
                                            <Sparkles className="w-4 h-4 text-pink-500 shrink-0 mt-0.5" />
                                            <div className="space-y-0.5">
                                                <p className="font-black text-slate-900 dark:text-slate-100">
                                                    {filteredBusinesses.some(b => b.matchLevel === 'exact')
                                                        ? `🎯 Found Direct Store Matches & Possible Suppliers`
                                                        : `💡 Showing ${filteredBusinesses.length} Possible Suppliers near ${isCustomLocation ? (customLocationText || 'Custom Location') : selectedLocation}`}
                                                </p>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                    {filteredBusinesses.some(b => b.matchLevel === 'exact')
                                                        ? 'Direct store matches found for your requested item keywords.'
                                                        : `No exact store name for "${searchItemName || request.item_name}" — displaying real nearby stores able to supply related items.`}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Businesses Results List */}
                                    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5 overscroll-contain">
                                        <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-white/[0.04]">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                                                    {filteredBusinesses.some(b => b.matchLevel === 'exact') ? 'MATCHING SUPPLIERS' : 'POSSIBLE SUPPLIERS'}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                                                    {filteredBusinesses.length} {filteredBusinesses.length === 1 ? 'store' : 'stores'}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsViewAllOpen(true)}
                                                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#ebf0f7] dark:bg-[#161826] text-pink-600 dark:text-pink-400 hover:text-pink-700 shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.02),_2px_2px_5px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/[0.04] flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                                                    title="Open full-screen grid view of all matching suppliers"
                                                >
                                                    <Grid className="w-3.5 h-3.5" />
                                                    <span>View All ({allBusinesses.length})</span>
                                                </button>

                                                {isFullMap && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowSidebarInFullMap(false)}
                                                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-rose-500 cursor-pointer flex items-center gap-1 transition-all"
                                                        title="Hide Stores List"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                        <span>Hide</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {loadingOverpass && filteredBusinesses.length === 0 ? (
                                            <div className="py-16 text-center text-xs text-slate-400 space-y-2">
                                                <i className="fas fa-spinner fa-spin text-2xl text-pink-500"></i>
                                                <p className="font-bold text-slate-600 dark:text-slate-300">Searching OpenStreetMap Overpass API...</p>
                                                <p className="text-[11px] text-slate-400">Retrieving real registered businesses near {isCustomLocation ? customLocationText : selectedLocation}</p>
                                            </div>
                                        ) : filteredBusinesses.length === 0 ? (
                                            <div className="py-10 text-center text-xs text-slate-400 space-y-3 p-4">
                                                <AlertCircle className="w-8 h-8 mx-auto text-amber-500 mb-1" />
                                                <div className="space-y-1">
                                                    <p className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">No suppliers match active filter criteria</p>
                                                    <p className="text-[11px] text-slate-500">Your keyword or distance filter filtered out all {allBusinesses.length} possible businesses near {selectedLocation}.</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setResultsSearchTerm('');
                                                        setCategoryFilter('all');
                                                        setDistanceFilter('all');
                                                    }}
                                                    className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-md shadow-pink-500/30 transition-all cursor-pointer inline-flex items-center gap-1.5"
                                                >
                                                    <RefreshCw className="w-3.5 h-3.5" />
                                                    <span>Show All Possible Suppliers</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                {filteredBusinesses.slice(0, visibleCardsLimit).map((b, idx) => {
                                                    const offSup = findOfficialSupplierMatch(b, dbSuppliers);
                                                    const isOff = Boolean(offSup);
                                                    const offers = checkSupplierOffersItem(b, currentItemNameForOffer, currentItemCatForOffer, offSup);
                                                    return (
                                                        <BusinessCardItem
                                                            key={`${b.id}-${idx}`}
                                                            b={b}
                                                            isSelected={String(b.id) === String(selectedBusiness?.id)}
                                                            isSaved={isBusinessAlreadySaved(b)}
                                                            isSaving={savingSupplierId === String(b.id)}
                                                            isOfficial={isOff}
                                                            offersItem={offers}
                                                            onSelect={handleSelectBusiness}
                                                            onAdd={handleAddAsPotentialSupplier}
                                                            onOrderOfficial={(targetB) => handleOrderFromOfficialSupplier(targetB, offSup)}
                                                            onInquire={handleInquireSupplier}
                                                        />
                                                    );
                                                })}

                                                {filteredBusinesses.length > visibleCardsLimit && (
                                                    <div className="pt-2 pb-4 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => setVisibleCardsLimit((prev) => prev + 30)}
                                                            className="w-full py-2.5 px-4 rounded-2xl bg-white dark:bg-[#161826] text-pink-600 dark:text-pink-400 font-bold text-xs border border-pink-200 dark:border-pink-900/40 shadow-sm hover:bg-pink-50 dark:hover:bg-pink-950/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                                                        >
                                                            <span>Load More Stores ({filteredBusinesses.length - visibleCardsLimit} remaining)</span>
                                                            <ChevronDown className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Right Side: Leaflet Sourcing Map */}
                        <div className={`flex-1 min-h-[280px] lg:min-h-0 h-full relative ${isFullMap ? 'p-0' : 'p-3'} bg-[#0d0f17]`}>
                            <SupplierSourcingMap
                                suppliers={filteredBusinesses}
                                selectedSupplierId={selectedBusiness?.id || null}
                                onSelectSupplier={handleSelectBusinessById}
                                onAddPotentialSupplier={(sup) => {
                                    const orig = allBusinesses.find((b) => String(b.id) === String(sup.id)) || (sup as any);
                                    handleAddAsPotentialSupplier(orig);
                                }}
                                onOrderOfficialSupplier={(sup) => {
                                    const orig = allBusinesses.find((b) => String(b.id) === String(sup.id)) || (sup as any);
                                    handleOrderFromOfficialSupplier(orig);
                                }}
                                onInquireSupplier={(sup) => {
                                    const orig = allBusinesses.find((b) => String(b.id) === String(sup.id)) || (sup as any);
                                    handleInquireSupplier(orig);
                                }}
                                getSupplierActionState={(sup) => {
                                    const orig = allBusinesses.find((b) => String(b.id) === String(sup.id)) || (sup as any);
                                    const off = findOfficialSupplierMatch(orig, dbSuppliers);
                                    const offers = checkSupplierOffersItem(orig, currentItemNameForOffer, currentItemCatForOffer, off);
                                    const saved = isBusinessAlreadySaved(orig);
                                    return {
                                        isOfficial: Boolean(off),
                                        offersItem: offers,
                                        isSaved: saved,
                                    };
                                }}
                                hqCoord={activeCenterCoords}
                                radiusKm={selectedRadiusKm}
                                isFullScreen={isFullMap}
                                onToggleFullScreen={() => setIsFullMap((prev) => !prev)}
                                searchTerm={resultsSearchTerm}
                                onSearchChange={(term) => setResultsSearchTerm(term)}
                            />

                            {/* Floating Quick Action Pill in Full Map Mode when a supplier is selected */}
                            {isFullMap && selectedBusiness && (
                                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-auto">
                                    <div className="flex items-center gap-2.5 p-2 pl-4 pr-2 bg-slate-900/90 dark:bg-black/90 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-white truncate max-w-[180px] sm:max-w-xs">
                                                {selectedBusiness.name}
                                            </span>
                                            <span className="text-[10px] text-pink-400 font-semibold">
                                                {selectedBusiness.distanceKm} km away • {selectedBusiness.category || 'Store'}
                                            </span>
                                        </div>
                                        {(() => {
                                            const off = findOfficialSupplierMatch(selectedBusiness, dbSuppliers);
                                            const isOff = Boolean(off);
                                            const offers = checkSupplierOffersItem(selectedBusiness, currentItemNameForOffer, currentItemCatForOffer, off);
                                            const isSaved = isBusinessAlreadySaved(selectedBusiness);

                                            if (isOff) {
                                                return (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOrderFromOfficialSupplier(selectedBusiness, off)}
                                                        className="px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ml-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/30"
                                                    >
                                                        <ShoppingCart className="w-3.5 h-3.5" />
                                                        <span>Order(Official supplier)</span>
                                                    </button>
                                                );
                                            }

                                            if (!offers) {
                                                return (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleInquireSupplier(selectedBusiness)}
                                                        className="px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ml-1 bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/30"
                                                    >
                                                        <MessageSquare className="w-3.5 h-3.5" />
                                                        <span>Inquire</span>
                                                    </button>
                                                );
                                            }

                                            return (
                                                <button
                                                    type="button"
                                                    onClick={() => handleAddAsPotentialSupplier(selectedBusiness)}
                                                    disabled={savingSupplierId === String(selectedBusiness.id)}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ml-1 ${
                                                        isSaved
                                                            ? 'bg-emerald-600 text-white'
                                                            : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white shadow-lg shadow-pink-500/30'
                                                    }`}
                                                >
                                                    {isSaved ? (
                                                        <>
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                            <span>Added</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <PlusCircle className="w-3.5 h-3.5" />
                                                            <span>Add as Potential</span>
                                                        </>
                                                    )}
                                                </button>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Modal Footer (hidden in Full Map mode to maximize map canvas) */}
                    {!isFullMap && (
                        <div className="px-6 py-4 border-t border-white/80 dark:border-white/[0.05] bg-[#ebf0f7] dark:bg-[#141624] flex items-center justify-between gap-3 shrink-0 flex-wrap">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                <Building2 className="w-4 h-4 text-pink-500" />
                                <span>
                                    Search Anchor: <strong>{activeCenterCoords.name}</strong> ({activeCenterCoords.latitude.toFixed(4)}, {activeCenterCoords.longitude.toFixed(4)})
                                </span>
                            </div>

                            <div className="flex items-center gap-2.5">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-5 py-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-700 dark:text-slate-300 font-bold text-xs shadow-[-3px_-3px_8px_rgba(255,255,255,0.85),_3px_3px_8px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_3px_3px_8px_rgba(0,0,0,0.65)] hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-all cursor-pointer border border-white/60 dark:border-white/[0.04]"
                                >
                                    Close
                                </button>

                                {selectedBusiness && (() => {
                                    const off = findOfficialSupplierMatch(selectedBusiness, dbSuppliers);
                                    const isOff = Boolean(off);
                                    const offers = checkSupplierOffersItem(selectedBusiness, currentItemNameForOffer, currentItemCatForOffer, off);
                                    const isSaved = isBusinessAlreadySaved(selectedBusiness);

                                    if (isOff) {
                                        return (
                                            <button
                                                type="button"
                                                onClick={() => handleOrderFromOfficialSupplier(selectedBusiness, off)}
                                                className="px-5 py-2.5 rounded-2xl text-xs font-black shadow-[-2px_-2px_6px_rgba(255,255,255,0.25),_3px_3px_10px_rgba(37,99,235,0.45)] transition-all flex items-center gap-1.5 cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white"
                                            >
                                                <ShoppingCart className="w-4 h-4" />
                                                <span>Order (Official supplier)</span>
                                            </button>
                                        );
                                    }

                                    if (!offers) {
                                        return (
                                            <button
                                                type="button"
                                                onClick={() => handleInquireSupplier(selectedBusiness)}
                                                className="px-5 py-2.5 rounded-2xl text-xs font-black shadow-[-2px_-2px_6px_rgba(255,255,255,0.25),_3px_3px_10px_rgba(245,158,11,0.45)] transition-all flex items-center gap-1.5 cursor-pointer bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950"
                                            >
                                                <MessageSquare className="w-4 h-4" />
                                                <span>Inquire</span>
                                            </button>
                                        );
                                    }

                                    return (
                                        <button
                                            type="button"
                                            onClick={() => handleAddAsPotentialSupplier(selectedBusiness)}
                                            disabled={savingSupplierId === String(selectedBusiness.id)}
                                            className={`px-5 py-2.5 rounded-2xl text-xs font-black shadow-[-2px_-2px_6px_rgba(255,255,255,0.25),_3px_3px_10px_rgba(244,63,94,0.45)] transition-all flex items-center gap-1.5 cursor-pointer ${
                                                isSaved
                                                    ? 'bg-emerald-600 text-white'
                                                    : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white'
                                            }`}
                                        >
                                            {isSaved ? (
                                                <>
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    <span>Saved as Potential Supplier</span>
                                                </>
                                            ) : (
                                                <>
                                                    <PlusCircle className="w-4 h-4" />
                                                    <span>Add "{selectedBusiness.name}" as Potential Supplier</span>
                                                </>
                                            )}
                                        </button>
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* View All Matching Suppliers Full Modal */}
            {isViewAllOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
                    <div className="bg-[#ebf0f7] dark:bg-[#12141f] rounded-[32px] shadow-[-16px_-16px_36px_rgba(255,255,255,0.9),_20px_20px_48px_rgba(0,0,0,0.85)] border border-white/90 dark:border-white/[0.08] flex flex-col w-full max-w-6xl h-[92vh] max-h-[900px] overflow-hidden my-auto animate-in zoom-in-95 duration-200">
                        {/* View All Header */}
                        <div className="px-6 py-4 border-b border-white/80 dark:border-white/[0.05] bg-[#ebf0f7]/90 dark:bg-[#141624]/90 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-pink-600 text-white flex items-center justify-center shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(219,39,119,0.4)] shrink-0">
                                    <Grid className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                            ALL SOURCED & MATCHING SUPPLIERS
                                        </h2>
                                        <span className="px-2.5 py-0.5 rounded-xl text-xs font-black bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                                            {viewAllBusinesses.length} of {allBusinesses.length} {allBusinesses.length === 1 ? 'store' : 'stores'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Sourced OpenStreetMap businesses near <strong>{isCustomLocation ? (customLocationText || 'Custom Location') : selectedLocation}</strong> (Radius: {selectedRadiusKm} km)
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsViewAllOpen(false)}
                                className="p-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_3px_3px_8px_rgba(0,0,0,0.6)] active:shadow-[inset_2px_2px_4px_rgba(163,177,198,0.4)] transition-all cursor-pointer border border-white/60 dark:border-white/[0.04]"
                                aria-label="Close View All Modal"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Filter Controls Bar within View All */}
                        <div className="p-4 border-b border-white/80 dark:border-white/[0.05] bg-[#ebf0f7] dark:bg-[#131522] space-y-3 shrink-0">
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                                {/* Search Filter */}
                                <div className="sm:col-span-5 relative">
                                    <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Filter by store name, address, or products..."
                                        value={resultsSearchTerm}
                                        onChange={(e) => setResultsSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-8 py-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.03)] border border-white/60 dark:border-white/[0.03] text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                    />
                                    {resultsSearchTerm && (
                                        <button
                                            type="button"
                                            onClick={() => setResultsSearchTerm('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Match Level Filter Tabs */}
                                <div className="sm:col-span-4 flex items-center bg-[#e2e8f0] dark:bg-[#161826] p-1 rounded-2xl shadow-[inset_1px_1px_3px_rgba(163,177,198,0.3)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]">
                                    {[
                                        { label: 'All', val: 'all' },
                                        { label: 'Direct Matches', val: 'exact' },
                                        { label: 'Category', val: 'category' },
                                        { label: 'Possible', val: 'possible' },
                                    ].map((tab) => (
                                        <button
                                            key={tab.val}
                                            type="button"
                                            onClick={() => setViewAllMatchFilter(tab.val)}
                                            className={`flex-1 py-1 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                                                viewAllMatchFilter === tab.val
                                                    ? 'bg-pink-600 text-white shadow-xs'
                                                    : 'text-slate-600 dark:text-slate-400 hover:text-pink-600'
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Sort By Toggle */}
                                <div className="sm:col-span-3 flex items-center justify-end gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                        <ArrowUpDown className="w-3 h-3 text-pink-500" />
                                        <span>Sort:</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setViewAllSortBy('distance')}
                                        className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                                            viewAllSortBy === 'distance'
                                                ? 'bg-pink-600 text-white shadow-sm'
                                                : 'bg-[#ebf0f7] dark:bg-[#161826] text-slate-600 dark:text-slate-300 border border-white/60 dark:border-white/[0.04]'
                                        }`}
                                    >
                                        Proximity
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewAllSortBy('name')}
                                        className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                                            viewAllSortBy === 'name'
                                                ? 'bg-pink-600 text-white shadow-sm'
                                                : 'bg-[#ebf0f7] dark:bg-[#161826] text-slate-600 dark:text-slate-300 border border-white/60 dark:border-white/[0.04]'
                                        }`}
                                    >
                                        Name A-Z
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* View All Grid of Suppliers */}
                        <div className="flex-1 min-h-0 overflow-y-auto p-5 overscroll-contain">
                            {viewAllBusinesses.length === 0 ? (
                                <div className="py-20 text-center text-xs text-slate-400 space-y-3">
                                    <AlertCircle className="w-10 h-10 mx-auto text-amber-500 mb-1" />
                                    <p className="font-extrabold text-slate-800 dark:text-slate-200 text-base">No matching suppliers found</p>
                                    <p className="text-xs text-slate-500 max-w-sm mx-auto">Try clearing your search terms or relaxing match level filters.</p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setResultsSearchTerm('');
                                            setViewAllMatchFilter('all');
                                            setDistanceFilter('all');
                                        }}
                                        className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                                    >
                                        Reset Filters
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                                    {viewAllBusinesses.map((b, idx) => {
                                        const isSelected = String(b.id) === String(selectedBusiness?.id);
                                        const isSaved = isBusinessAlreadySaved(b);

                                        return (
                                            <div
                                                key={`viewall-${b.id}-${idx}`}
                                                className={`p-4 sm:p-5 rounded-2xl transition-all flex flex-col justify-between space-y-3.5 shadow-none ${
                                                    isSelected
                                                        ? 'bg-pink-50/60 dark:bg-pink-950/20 border-2 border-pink-500 ring-2 ring-pink-500/20'
                                                        : 'bg-white dark:bg-[#161826] border border-slate-200 dark:border-slate-800 hover:border-pink-300 dark:hover:border-pink-800'
                                                }`}
                                            >
                                                {/* Top Card Header */}
                                                <div className="space-y-1.5">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <h3 className="text-sm font-black text-slate-900 dark:text-white leading-snug">
                                                            {b.name}
                                                        </h3>
                                                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black shrink-0 ${
                                                            b.distanceKm <= 5
                                                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                                                : b.distanceKm <= 15
                                                                ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                                                : 'bg-[#e2e8f0] dark:bg-[#1a1c2c] text-slate-700 dark:text-slate-300'
                                                        }`}>
                                                            {b.distanceKm} km away
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {b.matchLevel === 'exact' ? (
                                                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-pink-500 text-white shadow-xs shadow-pink-500/40 inline-flex items-center gap-1">
                                                                <Sparkles className="w-2.5 h-2.5" />
                                                                Direct Match
                                                            </span>
                                                        ) : b.matchLevel === 'category' ? (
                                                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 inline-flex items-center gap-1">
                                                                <Tag className="w-2.5 h-2.5" />
                                                                Category Match
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 inline-flex items-center gap-1">
                                                                <Compass className="w-2.5 h-2.5" />
                                                                Possible Supplier
                                                            </span>
                                                        )}
                                                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-[#e2e8f0]/80 dark:bg-[#1e2030] text-slate-600 dark:text-slate-300">
                                                            {b.category || 'Commercial Store'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Details */}
                                                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 bg-slate-50 dark:bg-[#131522] p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800">
                                                    {b.location && (
                                                        <div className="flex items-start gap-2">
                                                            <MapPin className="w-3.5 h-3.5 text-pink-500 shrink-0 mt-0.5" />
                                                            <span className="line-clamp-2">{b.location}</span>
                                                        </div>
                                                    )}
                                                    {b.phone && (
                                                        <div className="flex items-center gap-2">
                                                            <Phone className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                                                            <a href={`tel:${b.phone}`} className="font-mono text-pink-600 dark:text-pink-400 font-bold hover:underline">
                                                                {b.phone}
                                                            </a>
                                                        </div>
                                                    )}
                                                    {b.website && (
                                                        <div className="flex items-center gap-2">
                                                            <Globe className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                                                            <a href={b.website} target="_blank" rel="noopener noreferrer" className="truncate text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1">
                                                                <span>{b.website}</span>
                                                                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                                            </a>
                                                        </div>
                                                    )}
                                                    {b.products && (
                                                        <div className="pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                            <strong>Supplies:</strong> {b.products}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Card Bottom Actions */}
                                                <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-200/60 dark:border-white/[0.04]">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            handleSelectBusiness(b);
                                                            setIsViewAllOpen(false);
                                                        }}
                                                        className="px-3 py-2 rounded-xl bg-[#ebf0f7] dark:bg-[#181a26] text-slate-700 dark:text-slate-300 hover:text-pink-600 text-xs font-bold shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.02),_2px_2px_5px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/[0.04] transition-all flex items-center gap-1.5 cursor-pointer"
                                                    >
                                                        <Navigation className="w-3.5 h-3.5 text-pink-500" />
                                                        <span>Pin on Map</span>
                                                    </button>

                                                    {(() => {
                                                        const off = findOfficialSupplierMatch(b, dbSuppliers);
                                                        const isOff = Boolean(off);
                                                        const offers = checkSupplierOffersItem(b, currentItemNameForOffer, currentItemCatForOffer, off);

                                                        if (isOff) {
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setIsViewAllOpen(false);
                                                                        handleOrderFromOfficialSupplier(b, off);
                                                                    }}
                                                                    className="px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-[-2px_-2px_5px_rgba(255,255,255,0.2),_2px_2px_6px_rgba(37,99,235,0.3)]"
                                                                >
                                                                    <ShoppingCart className="w-3.5 h-3.5" />
                                                                    <span>Order(Official supplier)</span>
                                                                </button>
                                                            );
                                                        }

                                                        if (!offers) {
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setIsViewAllOpen(false);
                                                                        handleInquireSupplier(b);
                                                                    }}
                                                                    className="px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-[-2px_-2px_5px_rgba(255,255,255,0.2),_2px_2px_6px_rgba(245,158,11,0.3)]"
                                                                >
                                                                    <MessageSquare className="w-3.5 h-3.5" />
                                                                    <span>Inquire</span>
                                                                </button>
                                                            );
                                                        }

                                                        return (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAddAsPotentialSupplier(b)}
                                                                disabled={savingSupplierId === String(b.id)}
                                                                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                                                                    isSaved
                                                                        ? 'bg-emerald-600 text-white shadow-[-2px_-2px_5px_rgba(255,255,255,0.2),_2px_2px_6px_rgba(16,185,129,0.3)]'
                                                                        : 'bg-pink-600 hover:bg-pink-500 text-white shadow-[-2px_-2px_5px_rgba(255,255,255,0.2),_2px_2px_6px_rgba(244,63,94,0.4)]'
                                                                }`}
                                                            >
                                                                {savingSupplierId === String(b.id) ? (
                                                                    <>
                                                                        <i className="fas fa-spinner fa-spin mr-1" />
                                                                        <span>Saving...</span>
                                                                    </>
                                                                ) : isSaved ? (
                                                                    <>
                                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                                        <span>Saved Potential</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <PlusCircle className="w-3.5 h-3.5" />
                                                                        <span>Add as Potential</span>
                                                                    </>
                                                                )}
                                                            </button>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* View All Footer */}
                        <div className="px-6 py-3.5 border-t border-white/80 dark:border-white/[0.05] bg-[#ebf0f7] dark:bg-[#141624] flex items-center justify-between gap-3 shrink-0">
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                                Showing <strong>{viewAllBusinesses.length}</strong> suppliers for Purchase Request #{request.request_number || request.id}
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsViewAllOpen(false)}
                                className="px-5 py-2 rounded-xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-700 dark:text-slate-300 font-bold text-xs shadow-[-3px_-3px_8px_rgba(255,255,255,0.85),_3px_3px_8px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_3px_3px_8px_rgba(0,0,0,0.65)] hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-all cursor-pointer border border-white/60 dark:border-white/[0.04]"
                            >
                                Close View
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal for Inquiring Directly with Supplier for specific item */}
            {isMessageModalOpen && (
                <SupplierMessageModal
                    isOpen={isMessageModalOpen}
                    onClose={() => {
                        setIsMessageModalOpen(false);
                        setMessageModalSupplier(null);
                        setMessageModalInitialText('');
                    }}
                    supplier={messageModalSupplier}
                    initialMessage={messageModalInitialText}
                />
            )}

            {/* Modal for Creating Purchase Order with Official Supplier */}
            {isInternalPOModalOpen && (
                <PurchaseOrderModal
                    isOpen={isInternalPOModalOpen}
                    onClose={() => {
                        setIsInternalPOModalOpen(false);
                        setInternalPORequest(null);
                    }}
                    request={internalPORequest}
                    suppliers={dbSuppliers}
                />
            )}
        </Portal>
    );
}
