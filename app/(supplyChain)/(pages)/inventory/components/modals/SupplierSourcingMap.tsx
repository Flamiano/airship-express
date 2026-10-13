// app/(supplyChain)/(pages)/inventory/components/modals/SupplierSourcingMap.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, ZoomControl, useMap, useMapEvents, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AIRSHIP_HQ, GeoCoordinate } from '../../utils/geo-locations';
import { 
    Search, 
    Maximize2, 
    Minimize2, 
    Navigation, 
    Layers, 
    Building2, 
    Phone, 
    Mail, 
    MapPin, 
    Tag, 
    Sparkles, 
    Check, 
    X,
    Compass,
    Eye,
    Store,
    Activity
} from 'lucide-react';

export interface SourcedSupplierItem {
    id: string | number;
    name: string;
    category?: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    location?: string;
    is_active?: boolean;
    products?: string;
    coords: {
        lat: number;
        lng: number;
        displayName: string;
    };
    distanceKm: number;
}

interface SupplierSourcingMapProps {
    suppliers: SourcedSupplierItem[];
    selectedSupplierId: string | number | null;
    onSelectSupplier: (id: string | number) => void;
    onAddPotentialSupplier?: (supplier: SourcedSupplierItem) => void;
    hqCoord?: GeoCoordinate;
    radiusKm?: number;
    isFullScreen?: boolean;
    onToggleFullScreen?: () => void;
    searchTerm?: string;
    onSearchChange?: (term: string) => void;
}

/**
 * Cached Leaflet DivIcon singletons to prevent thrashing DOM recreation on every frame
 */
let cachedHQIcon: L.DivIcon | null = null;
let cachedSelectedIcon: L.DivIcon | null = null;
let cachedNearbyIcon: L.DivIcon | null = null;
let cachedStandardIcon: L.DivIcon | null = null;

function getHQIcon(): L.DivIcon {
    if (typeof window === 'undefined') return {} as L.DivIcon;
    if (!cachedHQIcon) {
        cachedHQIcon = L.divIcon({
            className: 'airship-hq-marker',
            html: `
                <div class="relative flex items-center justify-center cursor-pointer group">
                    <span class="absolute -inset-2 rounded-full bg-pink-500/30 pointer-events-none animate-pulse"></span>
                    <div class="relative w-9 h-9 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 text-white flex items-center justify-center shadow-[-2px_-2px_6px_rgba(255,255,255,0.2),_3px_3px_8px_rgba(0,0,0,0.7)] border-2 border-white/80 dark:border-slate-700 ring-2 ring-pink-500 transform group-hover:scale-105 transition-transform">
                        <i class="fas fa-building text-xs text-pink-400 drop-shadow"></i>
                    </div>
                    <div class="absolute -bottom-1 w-2.5 h-2.5 bg-slate-950 rotate-45 border-r-2 border-b-2 border-white/80 dark:border-slate-700"></div>
                </div>
            `,
            iconSize: [36, 40],
            iconAnchor: [18, 40],
            popupAnchor: [0, -40],
        });
    }
    return cachedHQIcon;
}

function getSupplierIcon(isSelected: boolean, distanceKm: number): L.DivIcon {
    if (typeof window === 'undefined') return {} as L.DivIcon;
    if (isSelected) {
        if (!cachedSelectedIcon) {
            cachedSelectedIcon = L.divIcon({
                className: 'airship-supplier-marker is-selected',
                html: `
                    <div class="relative flex items-center justify-center cursor-pointer group">
                        <span class="absolute -inset-2 rounded-full bg-pink-500/40 pointer-events-none animate-pulse"></span>
                        <div class="relative w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 ring-4 ring-pink-400/80 scale-125 z-50 text-white flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-md transform transition-all">
                            <i class="fas fa-store text-[11px] text-white"></i>
                        </div>
                        <div class="absolute -bottom-1 w-2 h-2 bg-rose-600 rotate-45 border-r border-b border-white dark:border-slate-800"></div>
                    </div>
                `,
                iconSize: [32, 36],
                iconAnchor: [16, 36],
                popupAnchor: [0, -36],
            });
        }
        return cachedSelectedIcon;
    }

    if (distanceKm <= 5) {
        if (!cachedNearbyIcon) {
            cachedNearbyIcon = L.divIcon({
                className: 'airship-supplier-marker is-nearby',
                html: `
                    <div class="relative flex items-center justify-center cursor-pointer group">
                        <div class="relative w-7 h-7 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 ring-2 ring-emerald-300/80 text-white flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-sm transform group-hover:scale-110 transition-transform">
                            <i class="fas fa-store text-[10px] text-white"></i>
                        </div>
                        <div class="absolute -bottom-1 w-2 h-2 bg-teal-700 rotate-45 border-r border-b border-white dark:border-slate-800"></div>
                    </div>
                `,
                iconSize: [28, 32],
                iconAnchor: [14, 32],
                popupAnchor: [0, -32],
            });
        }
        return cachedNearbyIcon;
    }

    if (!cachedStandardIcon) {
        cachedStandardIcon = L.divIcon({
            className: 'airship-supplier-marker',
            html: `
                <div class="relative flex items-center justify-center cursor-pointer group">
                    <div class="relative w-7 h-7 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 ring-2 ring-slate-400/60 text-white flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-sm transform group-hover:scale-110 transition-transform">
                        <i class="fas fa-store text-[10px] text-white"></i>
                    </div>
                    <div class="absolute -bottom-1 w-2 h-2 bg-slate-900 rotate-45 border-r border-b border-white dark:border-slate-800"></div>
                </div>
            `,
            iconSize: [28, 32],
            iconAnchor: [14, 32],
            popupAnchor: [0, -32],
        });
    }
    return cachedStandardIcon;
}

/**
 * Map View Controller for Panning / Zooming to Selected Supplier or Fitting Bounds
 * Also triggers invalidateSize whenever Full Screen / Split Screen toggles!
 */
function MapController({
    selectedSupplier,
    suppliers,
    hqCoord,
    radiusKm,
    triggerFitBounds,
    isFullScreen,
}: {
    selectedSupplier: SourcedSupplierItem | null;
    suppliers: SourcedSupplierItem[];
    hqCoord: GeoCoordinate;
    radiusKm?: number;
    triggerFitBounds: number;
    isFullScreen?: boolean;
}) {
    const map = useMap();

    // Trigger invalidateSize whenever layout / fullscreen mode changes so Leaflet expands instantly
    useEffect(() => {
        if (!map) return;
        const t1 = setTimeout(() => {
            try { map.invalidateSize(); } catch {}
        }, 60);
        const t2 = setTimeout(() => {
            try { map.invalidateSize(); } catch {}
        }, 250);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [map, isFullScreen]);

    // Pan to selected supplier smoothly
    useEffect(() => {
        if (!map || !selectedSupplier) return;
        map.flyTo([selectedSupplier.coords.lat, selectedSupplier.coords.lng], 15, {
            duration: 0.7,
            easeLinearity: 0.25,
        });
    }, [map, selectedSupplier]);

    // Fit bounds on request or on initial suppliers load or radius change
    useEffect(() => {
        if (!map) return;
        const bounds = L.latLngBounds([[hqCoord.latitude, hqCoord.longitude]]);
        suppliers.forEach((s) => {
            bounds.extend([s.coords.lat, s.coords.lng]);
        });

        // Extend bounds to encompass the search radius
        if (radiusKm && radiusKm > 0) {
            const delta = (radiusKm * 1000) / 111000;
            bounds.extend([hqCoord.latitude - delta, hqCoord.longitude - delta]);
            bounds.extend([hqCoord.latitude + delta, hqCoord.longitude + delta]);
        }

        if (bounds.isValid()) {
            map.fitBounds(bounds, {
                padding: [45, 45],
                maxZoom: 14,
                animate: true,
                duration: 0.7,
            });
        }
    }, [map, triggerFitBounds, suppliers.length, radiusKm, hqCoord.latitude, hqCoord.longitude]);

    return null;
}

/**
 * Highly Optimized Individual Supplier Marker
 * Memoized to prevent re-rendering unaffected pins during state transitions.
 * Popups are rendered STRICTLY ON-DEMAND when isSelected is true!
 */
interface SupplierMarkerProps {
    supplier: SourcedSupplierItem;
    isSelected: boolean;
    onSelect: (id: string | number) => void;
    onAddPotentialSupplier?: (supplier: SourcedSupplierItem) => void;
}

const MemoizedSupplierMarker = React.memo(function MemoizedSupplierMarker({
    supplier,
    isSelected,
    onSelect,
    onAddPotentialSupplier,
}: SupplierMarkerProps) {
    const icon = getSupplierIcon(isSelected, supplier.distanceKm);

    return (
        <Marker
            position={[supplier.coords.lat, supplier.coords.lng]}
            icon={icon}
            zIndexOffset={isSelected ? 1000 : 100}
            eventHandlers={{
                click: () => onSelect(supplier.id),
            }}
        >
            <Tooltip direction="top" offset={[0, -20]} opacity={0.92} permanent={false}>
                <span className="font-sans font-bold text-xs">
                    {supplier.name} ({supplier.distanceKm} km)
                </span>
            </Tooltip>

            {/* PERFORMANCE OPTIMIZATION: Only mount Popup when selected */}
            {isSelected && (
                <Popup className="airship-custom-popup" autoPan={false}>
                    <div className="text-xs font-sans space-y-2 p-1 min-w-[240px]">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-xs">
                                    {supplier.name}
                                </h4>
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-pink-600 dark:text-pink-400">
                                    <Tag className="w-3 h-3" />
                                    {supplier.category || 'Commercial Store'}
                                </span>
                            </div>
                            <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-50 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-800">
                                {supplier.distanceKm} km away
                            </span>
                        </div>

                        {/* Details */}
                        <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                            {supplier.location && (
                                <div className="flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span className="truncate">{supplier.location}</span>
                                </div>
                            )}
                            {supplier.contact_person && (
                                <div className="flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span className="truncate">Contact: {supplier.contact_person}</span>
                                </div>
                            )}
                            {supplier.phone && (
                                <div className="flex items-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>{supplier.phone}</span>
                                </div>
                            )}
                            {supplier.products && (
                                <div className="pt-1 text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">
                                    <strong>Supplies:</strong> {supplier.products}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => onSelect(supplier.id)}
                                className="flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-bold bg-[#ebf0f7] dark:bg-[#181a26] text-slate-800 dark:text-slate-200 hover:text-pink-600 shadow-sm border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                            >
                                View Details
                            </button>
                            {onAddPotentialSupplier && (
                                <button
                                    type="button"
                                    onClick={() => onAddPotentialSupplier(supplier)}
                                    className="flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-bold bg-pink-600 hover:bg-pink-500 text-white shadow-sm transition-all cursor-pointer"
                                >
                                    + Add Supplier
                                </button>
                            )}
                        </div>
                    </div>
                </Popup>
            )}
        </Marker>
    );
});

/**
 * Viewport-Optimized Marker Renderer:
 * Only renders pins that fall within the current map viewport bounds!
 * Automatically unmounts offscreen DOM nodes for high performance.
 */
function ViewportOptimizedMarkers({
    suppliers,
    selectedSupplierId,
    onSelectSupplier,
    onAddPotentialSupplier,
    onVisibleCountChange,
}: {
    suppliers: SourcedSupplierItem[];
    selectedSupplierId: string | number | null;
    onSelectSupplier: (id: string | number) => void;
    onAddPotentialSupplier?: (supplier: SourcedSupplierItem) => void;
    onVisibleCountChange: (count: number) => void;
}) {
    const map = useMap();
    const [bounds, setBounds] = useState<L.LatLngBounds | null>(() => {
        try {
            return map.getBounds();
        } catch {
            return null;
        }
    });

    useMapEvents({
        moveend: () => {
            try {
                setBounds(map.getBounds());
            } catch {}
        },
        zoomend: () => {
            try {
                setBounds(map.getBounds());
            } catch {}
        },
    });

    const visibleSuppliers = useMemo(() => {
        if (!bounds) return suppliers.slice(0, 80);
        const latBuffer = (bounds.getNorth() - bounds.getSouth()) * 0.15;
        const lngBuffer = (bounds.getEast() - bounds.getWest()) * 0.15;
        const bufferedBounds = L.latLngBounds(
            [bounds.getSouth() - latBuffer, bounds.getWest() - lngBuffer],
            [bounds.getNorth() + latBuffer, bounds.getEast() + lngBuffer]
        );

        const inBounds = suppliers.filter((supplier) => {
            if (String(supplier.id) === String(selectedSupplierId)) return true;
            return bufferedBounds.contains([supplier.coords.lat, supplier.coords.lng]);
        });

        // Cap to 90 closest in view to maintain buttery 60fps even when zoomed far out
        return inBounds.slice(0, 90);
    }, [suppliers, bounds, selectedSupplierId]);

    const prevCountRef = useRef<number>(-1);
    useEffect(() => {
        if (prevCountRef.current !== visibleSuppliers.length) {
            prevCountRef.current = visibleSuppliers.length;
            onVisibleCountChange(visibleSuppliers.length);
        }
    }, [visibleSuppliers.length, onVisibleCountChange]);

    return (
        <>
            {visibleSuppliers.map((supplier) => {
                const isSelected = String(supplier.id) === String(selectedSupplierId);
                return (
                    <MemoizedSupplierMarker
                        key={supplier.id}
                        supplier={supplier}
                        isSelected={isSelected}
                        onSelect={onSelectSupplier}
                        onAddPotentialSupplier={onAddPotentialSupplier}
                    />
                );
            })}
        </>
    );
}

export default function SupplierSourcingMap({
    suppliers,
    selectedSupplierId,
    onSelectSupplier,
    onAddPotentialSupplier,
    hqCoord = AIRSHIP_HQ,
    radiusKm = 10,
    isFullScreen = false,
    onToggleFullScreen,
    searchTerm = '',
    onSearchChange,
}: SupplierSourcingMapProps) {
    const [mapSearch, setMapSearch] = useState(searchTerm);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [triggerBounds, setTriggerBounds] = useState(0);
    const [inViewCount, setInViewCount] = useState<number>(suppliers.length);

    const hqIcon = useMemo(() => getHQIcon(), []);

    const selectedSupplier = useMemo(() => {
        return suppliers.find((s) => String(s.id) === String(selectedSupplierId)) || null;
    }, [suppliers, selectedSupplierId]);

    // Filter suppliers for map search jump list
    const filteredSearchList = useMemo(() => {
        if (!mapSearch.trim()) return [];
        const term = mapSearch.toLowerCase();
        return suppliers.filter(
            (s) =>
                s.name.toLowerCase().includes(term) ||
                (s.category && s.category.toLowerCase().includes(term)) ||
                (s.location && s.location.toLowerCase().includes(term)) ||
                (s.products && s.products.toLowerCase().includes(term))
        ).slice(0, 6);
    }, [suppliers, mapSearch]);

    const handleSearchInput = (val: string) => {
        setMapSearch(val);
        onSearchChange?.(val);
    };

    const handleSelectAndFocus = (supplier: SourcedSupplierItem) => {
        onSelectSupplier(supplier.id);
        setMapSearch(supplier.name);
        setIsSearchFocused(false);
    };

    const handleVisibleCountUpdate = useCallback((count: number) => {
        setInViewCount(count);
    }, []);

    return (
        <div className="w-full h-full relative rounded-3xl overflow-hidden shadow-[-6px_-6px_14px_rgba(255,255,255,0.7),_6px_6px_16px_rgba(163,177,198,0.45)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.02),_6px_6px_18px_rgba(0,0,0,0.8)] border border-white/60 dark:border-white/[0.06] bg-[#0f111a] flex flex-col">
            {/* Scoped Leaflet Popups & Tooltips styling in Neumorphism Dark */}
            <style
                dangerouslySetInnerHTML={{
                    __html: `
                    .dark .leaflet-popup-content-wrapper {
                        background-color: #12141f !important;
                        color: #f1f5f9 !important;
                        border: 1px solid rgba(255, 255, 255, 0.08) !important;
                        box-shadow: -4px -4px 12px rgba(255, 255, 255, 0.03), 8px 8px 24px rgba(0, 0, 0, 0.8) !important;
                        border-radius: 18px !important;
                    }
                    .dark .leaflet-popup-tip {
                        background-color: #12141f !important;
                        border: 1px solid rgba(255, 255, 255, 0.08) !important;
                    }
                    .dark .leaflet-popup-close-button {
                        color: #94a3b8 !important;
                        top: 8px !important;
                        right: 8px !important;
                    }
                    .dark .leaflet-tooltip {
                        background-color: #12141f !important;
                        border: 1px solid rgba(255, 255, 255, 0.08) !important;
                        color: #f1f5f9 !important;
                        box-shadow: -2px -2px 6px rgba(255, 255, 255, 0.02), 4px 4px 12px rgba(0, 0, 0, 0.7) !important;
                        border-radius: 10px !important;
                        font-family: inherit;
                        font-size: 11px;
                        font-weight: 700;
                    }
                `,
                }}
            />

            {/* Floating Map Controls Header with Neumorphic Styling */}
            <div className="absolute top-3.5 left-3.5 right-3.5 z-[1000] flex items-center justify-between gap-2.5 pointer-events-none">
                {/* Search Bar on Map (Neumorphic Inset) */}
                <div className="relative pointer-events-auto w-full max-w-sm">
                    <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[#ebf0f7]/95 dark:bg-[#141624]/95 backdrop-blur-md rounded-2xl border border-white/80 dark:border-white/[0.08] shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_8px_rgba(255,255,255,0.03),_4px_4px_12px_rgba(0,0,0,0.7)] transition-all focus-within:ring-2 focus-within:ring-pink-500/50">
                        <Search className="w-4 h-4 text-slate-400 shrink-0" />
                        <input
                            type="text"
                            placeholder="Search store by name, product or area..."
                            value={mapSearch}
                            onChange={(e) => handleSearchInput(e.target.value)}
                            onFocus={() => setIsSearchFocused(true)}
                            className="bg-transparent border-none outline-none text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 w-full"
                        />
                        {mapSearch && (
                            <button
                                type="button"
                                onClick={() => handleSearchInput('')}
                                className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 transition-colors cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Search Autocomplete Dropdown (Neumorphic Extruded) */}
                    {isSearchFocused && filteredSearchList.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-[#ebf0f7]/95 dark:bg-[#141624]/95 backdrop-blur-md rounded-2xl border border-white/80 dark:border-white/[0.08] shadow-[-4px_-4px_12px_rgba(255,255,255,0.8),_6px_6px_16px_rgba(163,177,198,0.5)] dark:shadow-[-3px_-3px_10px_rgba(255,255,255,0.03),_6px_6px_18px_rgba(0,0,0,0.8)] overflow-hidden divide-y divide-slate-200/60 dark:divide-slate-800/60 max-h-56 overflow-y-auto">
                            {filteredSearchList.map((sup) => (
                                <button
                                    key={sup.id}
                                    type="button"
                                    onClick={() => handleSelectAndFocus(sup)}
                                    className="w-full px-3.5 py-2.5 text-left text-xs hover:bg-pink-50 dark:hover:bg-pink-950/40 flex items-center justify-between gap-2 transition-colors group cursor-pointer"
                                >
                                    <div className="truncate">
                                        <div className="font-extrabold text-slate-800 dark:text-slate-100 group-hover:text-pink-600 dark:group-hover:text-pink-400 truncate">
                                            {sup.name}
                                        </div>
                                        <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">
                                            {sup.category || 'General'} • {sup.location || sup.coords.displayName}
                                        </div>
                                    </div>
                                    <span className="shrink-0 text-[10px] font-extrabold px-2.5 py-1 rounded-xl bg-[#e2e8f0] dark:bg-[#1a1c2d] text-slate-700 dark:text-slate-300 shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4),_inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5),_inset_-1px_-1px_3px_rgba(255,255,255,0.02)]">
                                        {sup.distanceKm} km
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right Map Action Buttons (Neumorphic Extruded Pills) */}
                <div className="flex items-center gap-2 pointer-events-auto">
                    {/* Recenter / Fit All */}
                    <button
                        type="button"
                        onClick={() => setTriggerBounds((prev) => prev + 1)}
                        className="p-2.5 rounded-2xl bg-[#ebf0f7]/95 dark:bg-[#141624]/95 backdrop-blur-md border border-white/80 dark:border-white/[0.08] shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_8px_rgba(255,255,255,0.03),_3px_3px_10px_rgba(0,0,0,0.7)] text-slate-700 dark:text-slate-200 hover:text-pink-600 dark:hover:text-pink-400 active:shadow-[inset_2px_2px_4px_rgba(163,177,198,0.4)] dark:active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)] transition-all cursor-pointer"
                        title="Fit all stores & HQ in view"
                    >
                        <Compass className="w-4 h-4" />
                    </button>

                    {/* Toggle Fullscreen / Maximize */}
                    {onToggleFullScreen && (
                        <button
                            type="button"
                            onClick={onToggleFullScreen}
                            className="p-2.5 rounded-2xl bg-[#ebf0f7]/95 dark:bg-[#141624]/95 backdrop-blur-md border border-white/80 dark:border-white/[0.08] shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_8px_rgba(255,255,255,0.03),_3px_3px_10px_rgba(0,0,0,0.7)] text-slate-700 dark:text-slate-200 hover:text-pink-600 dark:hover:text-pink-400 active:shadow-[inset_2px_2px_4px_rgba(163,177,198,0.4)] dark:active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)] transition-all cursor-pointer"
                            title={isFullScreen ? 'Exit Fullscreen Map' : 'View Fullscreen Map'}
                        >
                            {isFullScreen ? (
                                <Minimize2 className="w-4 h-4 text-pink-500" />
                            ) : (
                                <Maximize2 className="w-4 h-4" />
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Map Container */}
            <div className="w-full h-full flex-1 relative z-0">
                <MapContainer
                    center={[hqCoord.latitude, hqCoord.longitude]}
                    zoom={13}
                    scrollWheelZoom={true}
                    zoomControl={false}
                    className="w-full h-full min-h-[380px]"
                >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />

                    <ZoomControl position="bottomright" />

                    {/* Map controller */}
                    <MapController
                        selectedSupplier={selectedSupplier}
                        suppliers={suppliers}
                        hqCoord={hqCoord}
                        radiusKm={radiusKm}
                        triggerFitBounds={triggerBounds}
                        isFullScreen={isFullScreen}
                    />

                    {/* Search Radius Visual Boundary Circle */}
                    {radiusKm && radiusKm > 0 && (
                        <Circle
                            center={[hqCoord.latitude, hqCoord.longitude]}
                            radius={radiusKm * 1000}
                            pathOptions={{
                                color: '#ec4899',
                                fillColor: '#ec4899',
                                fillOpacity: 0.06,
                                weight: 1.5,
                                dashArray: '5, 6',
                            }}
                        />
                    )}

                    {/* HQ Marker */}
                    <Marker position={[hqCoord.latitude, hqCoord.longitude]} icon={hqIcon}>
                        <Popup className="airship-custom-popup">
                            <div className="text-xs p-1 space-y-1 font-sans min-w-[210px]">
                                <div className="flex items-center gap-1.5 font-extrabold text-slate-900 dark:text-slate-100 pb-1 border-b border-slate-200 dark:border-slate-800">
                                    <span className="w-5 h-5 rounded-lg bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 flex items-center justify-center text-[10px]">
                                        <i className="fas fa-building"></i>
                                    </span>
                                    <span>Airship Express HQ</span>
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                                    Binondo, Manila (Central Logistics Hub)
                                </p>
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-50 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-800">
                                    Origin for Proximity Calculations ({radiusKm} km Radius)
                                </span>
                            </div>
                        </Popup>
                    </Marker>

                    {/* Viewport-Optimized Supplier / Store Markers */}
                    <ViewportOptimizedMarkers
                        suppliers={suppliers}
                        selectedSupplierId={selectedSupplierId}
                        onSelectSupplier={onSelectSupplier}
                        onAddPotentialSupplier={onAddPotentialSupplier}
                        onVisibleCountChange={handleVisibleCountUpdate}
                    />
                </MapContainer>
            </div>

            {/* Bottom Status bar with Neumorphic Inset Badge */}
            <div className="px-4 py-2.5 bg-[#0e101a]/95 text-white backdrop-blur-md flex items-center justify-between text-[11px] border-t border-white/[0.06] shrink-0">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                        <Eye className="w-3.5 h-3.5 text-pink-400" />
                        Rendering <strong className="text-pink-400 font-mono font-bold">{inViewCount}</strong> in view of <strong className="text-white font-mono font-bold">{suppliers.length}</strong> stores
                    </span>
                </div>
                {selectedSupplier && (
                    <div className="text-pink-400 font-semibold truncate max-w-[220px]">
                        Target: {selectedSupplier.name} ({selectedSupplier.distanceKm} km)
                    </div>
                )}
            </div>
        </div>
    );
}
