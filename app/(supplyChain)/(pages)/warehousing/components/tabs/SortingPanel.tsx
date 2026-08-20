"use client";

import { useState, useEffect, useCallback, useRef, memo } from "react";
import { supabase } from "@/app/(supplyChain)/lib/services/client/supabase";
import { useDebounce } from "@/app/(supplyChain)/hooks/useDebounce";
import { toast } from "sonner";
import { useConfirm } from "@/app/(supplyChain)/components/ui/ConfirmModal";
import { PageSkeleton } from "@/app/(supplyChain)/components/ui/SkeletonLoader";
import Portal from "@/app/(supplyChain)/components/client/Portal";
import { Pagination } from "@/app/(supplyChain)/components/global/pagination";
import { TableContentLoader } from "@/app/(supplyChain)/components/global/Loader";

interface Parcel {
    id: number;
    barcode: string;
    tracking_number: string;
    destination: string | null;
    courier: string | null;
    status: string;
    created_at: string;
    sender_name: string | null;
    bulk_qr_code?: string | null;
    bulk_qr_city?: string | null;
    bulk_qr_courier?: string | null;
    region?: string | null;
    city?: string | null;
    customer_name?: string | null;
    customer_number?: string | null;
}

interface CityGroup {
    city: string;
    total: number;
    couriers: { name: string; count: number }[];
    parcels: Parcel[];
    hasBulkQr: boolean;
    bulkQrCode: string | null;
    bulkQrCity: string | null;
}

interface RegionGroup {
    region: string;
    total: number;
    cities: CityGroup[];
    expanded: boolean;
}

interface CourierStats {
    name: string;
    count: number;
    parcels: Parcel[];
    hasBulkQr: boolean;
    bulkQrCode?: string | null;
    bulkQrCourier?: string | null;
}

interface GroupedParcel {
    date: string;
    parcels: Parcel[];
}

interface ExistingQrCodes {
    cityQrMap: Map<string, string>;
    courierQrMap: Map<string, string>;
}

// Get status badge color
const getStatusBadge = (status: string): string => {
    switch (status) {
        case 'received':
            return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/40';
        case 'pending':
            return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/40';
        case 'dispatched':
            return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/40';
        case 'delivered':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40';
        default:
            return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700/40';
    }
};

// Get status label
const getStatusLabel = (status: string): string => {
    switch (status) {
        case 'received':
            return 'Received';
        case 'pending':
            return 'Pending';
        case 'dispatched':
            return 'Dispatched';
        case 'delivered':
            return 'Delivered';
        default:
            return status.charAt(0).toUpperCase() + status.slice(1);
    }
};

// Memoized animated component
const AnimatedRegionContent = memo(({
    region,
    children
}: {
    region: RegionGroup;
    children: React.ReactNode
}) => {
    return (
        <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${region.expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                }`}
        >
            <div className="border-t border-slate-100">
                {children}
            </div>
        </div>
    );
});

AnimatedRegionContent.displayName = 'AnimatedRegionContent';

export default function SortingPanel() {
    const [parcels, setParcels] = useState<Parcel[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [locationSearch, setLocationSearch] = useState("");
    const [locationRegionFilter, setLocationRegionFilter] = useState("");
    const [locationCityFilter, setLocationCityFilter] = useState("");
    const [regionGroups, setRegionGroups] = useState<RegionGroup[]>([]);
    const [cityGroups, setCityGroups] = useState<CityGroup[]>([]);
    const [viewMode, setViewMode] = useState<"region" | "city">("region");
    const [courierStats, setCourierStats] = useState<CourierStats[]>([]);
    const [selectedParcels, setSelectedParcels] = useState<Parcel[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [generatingBulk, setGeneratingBulk] = useState(false);
    const [selectedCourier, setSelectedCourier] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [filteredParcels, setFilteredParcels] = useState<Parcel[]>([]);
    const [showCourierModal, setShowCourierModal] = useState(false);
    const [courierParcels, setCourierParcels] = useState<Parcel[]>([]);
    const [selectedParcelIds, setSelectedParcelIds] = useState<Set<number>>(new Set());
    const [deleting, setDeleting] = useState(false);
    const [allCities, setAllCities] = useState<string[]>([]);
    const [allRegions, setAllRegions] = useState<string[]>([]);
    const [generatingAllBulk, setGeneratingAllBulk] = useState(false);
    const [groupedParcels, setGroupedParcels] = useState<GroupedParcel[]>([]);
    const [viewParcel, setViewParcel] = useState<Parcel | null>(null);
    const [showViewModal, setShowViewModal] = useState(false);
    const [existingQrCodes, setExistingQrCodes] = useState<ExistingQrCodes>({
        cityQrMap: new Map(),
        courierQrMap: new Map()
    });
    const limit = 10;
    const { confirm } = useConfirm();

    const debouncedSearch = useDebounce(searchTerm, 300);

    // Helper function to sanitize string for QR code
    const sanitizeForQr = useCallback((text: string): string => {
        return text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20) || 'DEFAULT';
    }, []);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast.success('QR Code copied to clipboard!', { duration: 2000 });
        }).catch(() => {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            toast.success('QR Code copied to clipboard!', { duration: 2000 });
        });
    };

    // Generate random code for bulk QR
    const generateRandomCode = useCallback(() => {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }, []);

    // Check if all parcels have all QR codes
    const allHaveAllQr = useCallback(() => {
        return parcels.length > 0 && parcels.every(p => p.bulk_qr_code && p.bulk_qr_city && p.bulk_qr_courier);
    }, [parcels]);

    // Get existing QR codes from all parcels
    const buildExistingQrMaps = useCallback((parcelsList: Parcel[]) => {
        const cityMap = new Map<string, string>();
        const courierMap = new Map<string, string>();

        parcelsList.forEach(p => {
            if (p.city && p.bulk_qr_city) {
                const key = sanitizeForQr(p.city);
                if (!cityMap.has(key)) {
                    cityMap.set(key, p.bulk_qr_city);
                }
            }
            if (p.courier && p.bulk_qr_courier) {
                const key = sanitizeForQr(p.courier);
                if (!courierMap.has(key)) {
                    courierMap.set(key, p.bulk_qr_courier);
                }
            }
        });

        return { cityQrMap: cityMap, courierQrMap: courierMap };
    }, [sanitizeForQr]);

    const handleGenerateAllBulkQr = async () => {
        if (parcels.length === 0) {
            toast.warning('No parcels found to generate bulk QR');
            return;
        }

        if (allHaveAllQr()) {
            toast.info(`All ${parcels.length} parcels already have all QR codes`, { duration: 3000 });
            return;
        }

        const warningMessage = (
            <div className="space-y-3 text-left text-sm text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <i className="fas fa-exclamation-triangle"></i>
                    BEFORE YOU CONTINUE
                </p>

                {/* Batch Summary Box */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60 text-xs space-y-1">
                    <p className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <i className="fas fa-boxes text-slate-400 dark:text-slate-500"></i>
                        Batch Summary:
                    </p>
                    <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-0.5">
                        <li>Items: <span className="font-semibold text-slate-900 dark:text-white">{parcels.length} parcel{parcels.length > 1 ? 's' : ''}</span></li>
                        <li>Action: Assign shared Global, City, and Courier QR codes</li>
                    </ul>
                </div>

                {/* Note & Recommendation */}
                <div className="space-y-2 text-xs">
                    <p className="flex items-start gap-2">
                        <i className="fas fa-info-circle text-blue-500 dark:text-blue-400 mt-0.5 text-xs"></i>
                        <span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">Important:</span> Generating now locks this Global QR. Parcels added later today will receive a <strong>DIFFERENT</strong> Global QR.
                        </span>
                    </p>
                    <p className="flex items-start gap-2">
                        <i className="fas fa-clock text-amber-500 dark:text-amber-400 mt-0.5 text-xs"></i>
                        <span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">Recommendation:</span> If more parcels are expected, wait until end of day (e.g., after 6:00 PM) to group them under one Global QR.
                        </span>
                    </p>
                </div>

                <p className="pt-1 font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <i className="fas fa-qrcode text-emerald-500 dark:text-emerald-400"></i>
                    Proceed with generating QR codes for {parcels.length} parcel{parcels.length > 1 ? 's' : ''}?
                </p>
            </div>
        );

        const confirmed = await confirm({
            title: "Generate All Bulk QR Codes",
            message: warningMessage,
            confirmText: "Generate Now",
            cancelText: "Cancel",
            confirmVariant: "success",
        });

        if (!confirmed) return;

        setGeneratingAllBulk(true);
        const toastId = toast.loading(`Generating all bulk QR codes for ${parcels.length} parcels...`);

        try {
            // Build existing QR maps from all parcels
            const existingMaps = buildExistingQrMaps(parcels);
            const generatedCityQrs = new Map<string, string>();
            const generatedCourierQrs = new Map<string, string>();

            // Find or assign the main Global QR Code
            const existingGlobalQr = parcels.find(p => p.bulk_qr_code)?.bulk_qr_code;
            const globalQrCode = existingGlobalQr || `BULK-${generateRandomCode()}`;

            // Group parcels by their QR code combinations for batch updates
            const cityGroups: Record<string, number[]> = {};
            const courierGroups: Record<string, number[]> = {};
            const globalIds: number[] = [];

            parcels.forEach((parcel) => {
                // Track which parcels need global QR
                if (!parcel.bulk_qr_code) {
                    globalIds.push(parcel.id);
                }

                // Group by city for city QR
                if (!parcel.bulk_qr_city) {
                    const cityKey = sanitizeForQr(parcel.city || 'UNASSIGNED');
                    // Check if we already have a QR for this city
                    let cityQr = existingMaps.cityQrMap.get(cityKey) || generatedCityQrs.get(cityKey);
                    if (!cityQr) {
                        cityQr = `BULK-${cityKey || 'CITY'}-${generateRandomCode()}`;
                        generatedCityQrs.set(cityKey, cityQr);
                    }
                    if (!cityGroups[cityQr]) {
                        cityGroups[cityQr] = [];
                    }
                    cityGroups[cityQr].push(parcel.id);
                }

                // Group by courier for courier QR
                if (!parcel.bulk_qr_courier) {
                    const courierKey = sanitizeForQr(parcel.courier || 'UNASSIGNED');
                    let courierQr = existingMaps.courierQrMap.get(courierKey) || generatedCourierQrs.get(courierKey);
                    if (!courierQr) {
                        courierQr = `BULK-${courierKey || 'COURIER'}-${generateRandomCode()}`;
                        generatedCourierQrs.set(courierKey, courierQr);
                    }
                    if (!courierGroups[courierQr]) {
                        courierGroups[courierQr] = [];
                    }
                    courierGroups[courierQr].push(parcel.id);
                }
            });

            // 1. Update Global QR for all parcels that don't have it
            if (globalIds.length > 0) {
                const { error: globalError } = await supabase
                    .from('parcels')
                    .update({ bulk_qr_code: globalQrCode })
                    .in('id', globalIds);

                if (globalError) throw globalError;
            }

            // 2. Update City QR for each city group
            for (const [qrCode, ids] of Object.entries(cityGroups)) {
                const { error: cityError } = await supabase
                    .from('parcels')
                    .update({ bulk_qr_city: qrCode })
                    .in('id', ids);

                if (cityError) throw cityError;
            }

            // 3. Update Courier QR for each courier group
            for (const [qrCode, ids] of Object.entries(courierGroups)) {
                const { error: courierError } = await supabase
                    .from('parcels')
                    .update({ bulk_qr_courier: qrCode })
                    .in('id', ids);

                if (courierError) throw courierError;
            }

            toast.success(`All bulk QR codes generated for ${parcels.length} parcels!`, {
                id: toastId,
                duration: 4000,
                action: {
                    label: 'Copy Global QR',
                    onClick: () => copyToClipboard(globalQrCode)
                }
            });

            fetchData();

        } catch (error) {
            console.error('Error generating all bulk QR codes:', error);
            toast.error('Failed to generate all bulk QR codes', {
                id: toastId,
                duration: 5000,
            });
        } finally {
            setGeneratingAllBulk(false);
        }
    };

    // fetch data from supabase with pagination
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);

            const offset = (page - 1) * limit;

            let query = supabase
                .from('parcels')
                .select('*', { count: 'exact' })
                .eq('status', 'received')
                .order('created_at', { ascending: false });

            if (debouncedSearch) {
                query = query.or(
                    `barcode.ilike.%${debouncedSearch}%,tracking_number.ilike.%${debouncedSearch}%,destination.ilike.%${debouncedSearch}%,city.ilike.%${debouncedSearch}%`
                );
            }

            if (locationCityFilter) {
                query = query.ilike('city', `%${locationCityFilter}%`);
            }

            if (locationRegionFilter) {
                query = query.ilike('region', `%${locationRegionFilter}%`);
            }

            query = query.range(offset, offset + limit - 1);

            const { data: parcelsData, error: parcelsError, count } = await query;

            if (parcelsError) throw parcelsError;

            setParcels(parcelsData || []);
            setFilteredParcels(parcelsData || []);
            setTotalItems(count || 0);
            setTotalPages(Math.ceil((count || 0) / limit));

            // Build existing QR maps from all parcels
            if (parcelsData) {
                const maps = buildExistingQrMaps(parcelsData);
                setExistingQrCodes(maps);
            }

            let allQuery = supabase
                .from('parcels')
                .select('*')
                .eq('status', 'received');

            if (locationCityFilter) {
                allQuery = allQuery.ilike('city', `%${locationCityFilter}%`);
            }

            if (locationRegionFilter) {
                allQuery = allQuery.ilike('region', `%${locationRegionFilter}%`);
            }

            const { data: allParcels, error: allError } = await allQuery;

            if (allError) throw allError;

            const { data: allCitiesData } = await supabase
                .from('parcels')
                .select('city')
                .eq('status', 'received')
                .not('city', 'is', null);

            const cities = [...new Set((allCitiesData || []).map(p => p.city).filter(Boolean))] as string[];
            setAllCities(cities.sort());

            const { data: allRegionsData } = await supabase
                .from('parcels')
                .select('region')
                .eq('status', 'received')
                .not('region', 'is', null);

            const regions = [...new Set((allRegionsData || []).map(p => p.region).filter(Boolean))] as string[];
            setAllRegions(regions.sort());

            const regionMap: Record<string, Record<string, CityGroup>> = {};

            (allParcels || []).forEach((p: any) => {
                const region = p.region || 'N/A';
                const city = p.city || 'N/A';

                if (!regionMap[region]) {
                    regionMap[region] = {};
                }

                if (!regionMap[region][city]) {
                    regionMap[region][city] = {
                        city: city,
                        total: 0,
                        couriers: [],
                        parcels: [],
                        hasBulkQr: false,
                        bulkQrCode: null,
                        bulkQrCity: null
                    };
                }

                const cityGroup = regionMap[region][city];
                cityGroup.total += 1;
                cityGroup.parcels.push(p);

                if (p.courier) {
                    const existingCourier = cityGroup.couriers.find(c => c.name === p.courier);
                    if (existingCourier) {
                        existingCourier.count += 1;
                    } else {
                        cityGroup.couriers.push({ name: p.courier, count: 1 });
                    }
                }

                if (p.bulk_qr_city) {
                    cityGroup.hasBulkQr = true;
                    cityGroup.bulkQrCode = p.bulk_qr_city;
                    cityGroup.bulkQrCity = p.bulk_qr_city;
                }
            });

            const regionGroupsData: RegionGroup[] = Object.entries(regionMap).map(([region, citiesMap]) => {
                const citiesData = Object.values(citiesMap);
                const total = citiesData.reduce((sum, c) => sum + c.total, 0);

                return {
                    region,
                    total,
                    cities: citiesData,
                    expanded: false
                };
            });

            regionGroupsData.sort((a, b) => b.total - a.total);

            setRegionGroups(regionGroupsData);

            const allCitiesMap: Record<string, CityGroup> = {};
            (allParcels || []).forEach((p: any) => {
                const city = p.city || 'NA';
                if (!allCitiesMap[city]) {
                    allCitiesMap[city] = {
                        city: city,
                        total: 0,
                        couriers: [],
                        parcels: [],
                        hasBulkQr: false,
                        bulkQrCode: null,
                        bulkQrCity: null
                    };
                }

                const cityGroup = allCitiesMap[city];
                cityGroup.total += 1;
                cityGroup.parcels.push(p);

                if (p.courier) {
                    const existingCourier = cityGroup.couriers.find(c => c.name === p.courier);
                    if (existingCourier) {
                        existingCourier.count += 1;
                    } else {
                        cityGroup.couriers.push({ name: p.courier, count: 1 });
                    }
                }

                if (p.bulk_qr_city) {
                    cityGroup.hasBulkQr = true;
                    cityGroup.bulkQrCode = p.bulk_qr_city;
                    cityGroup.bulkQrCity = p.bulk_qr_city;
                }
            });

            const cityGroupsData = Object.values(allCitiesMap);
            cityGroupsData.sort((a, b) => b.total - a.total);
            setCityGroups(cityGroupsData);

            const courierMap: Record<string, { count: number; parcels: Parcel[]; hasBulkQr: boolean; bulkQrCode?: string | null; bulkQrCourier?: string | null }> = {};
            (allParcels || []).forEach((p: any) => {
                if (p.courier) {
                    if (!courierMap[p.courier]) {
                        courierMap[p.courier] = { count: 0, parcels: [], hasBulkQr: false, bulkQrCode: null, bulkQrCourier: null };
                    }
                    courierMap[p.courier].count += 1;
                    courierMap[p.courier].parcels.push(p);

                    if (p.bulk_qr_courier) {
                        courierMap[p.courier].hasBulkQr = true;
                        courierMap[p.courier].bulkQrCode = p.bulk_qr_courier;
                        courierMap[p.courier].bulkQrCourier = p.bulk_qr_courier;
                    }
                }
            });

            const courierStatsData = Object.entries(courierMap)
                .map(([name, data]) => ({
                    name,
                    count: data.count,
                    parcels: data.parcels,
                    hasBulkQr: data.hasBulkQr,
                    bulkQrCode: data.bulkQrCode,
                    bulkQrCourier: data.bulkQrCourier
                }))
                .sort((a, b) => b.count - a.count);

            setCourierStats(courierStatsData);

            const grouped = (allParcels || []).reduce((acc: Record<string, Parcel[]>, p: any) => {
                const date = new Date(p.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                if (!acc[date]) acc[date] = [];
                acc[date].push(p);
                return acc;
            }, {});

            const groupedArray = Object.entries(grouped).map(([date, parcels]) => ({
                date,
                parcels
            }));

            groupedArray.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setGroupedParcels(groupedArray);

            if (locationCityFilter) {
                setViewMode("city");
            } else if (locationRegionFilter) {
                setViewMode("region");
            } else {
                setViewMode("region");
            }

        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load sorting data');
        } finally {
            setLoading(false);
        }
    }, [page, debouncedSearch, locationRegionFilter, locationCityFilter, buildExistingQrMaps]);

    useEffect(() => {
        fetchData();

        const subscription = supabase
            .channel('sorting_updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'parcels',
                    filter: 'status=eq.received',
                },
                () => {
                    fetchData();
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [fetchData]);

    // Toggle region expansion
    const toggleRegion = (regionName: string) => {
        setRegionGroups(prev => prev.map(region =>
            region.region === regionName
                ? { ...region, expanded: !region.expanded }
                : region
        ));
    };

    // Expand all regions
    const expandAllRegions = () => {
        setRegionGroups(prev => prev.map(region => ({
            ...region,
            expanded: true
        })));
    };

    // Collapse all regions
    const collapseAllRegions = () => {
        setRegionGroups(prev => prev.map(region => ({
            ...region,
            expanded: false
        })));
    };

    // Show parcels for a specific city
    const handleViewCityParcels = (city: string, parcels: Parcel[]) => {
        setSelectedParcels(parcels);
        setShowModal(true);
    };

    // Show parcels for a specific courier
    const handleViewCourierParcels = (courierName: string) => {
        const courier = courierStats.find(c => c.name === courierName);
        if (courier) {
            setCourierParcels(courier.parcels);
            setSelectedCourier(courierName);
            setShowCourierModal(true);
        }
    };

    // View parcel details - opens view modal
    const handleViewParcel = (parcel: Parcel) => {
        setViewParcel(parcel);
        setShowViewModal(true);
    };

    // Delete single parcel
    const handleDeleteParcel = async (parcelId: number, barcode: string) => {
        const confirmed = await confirm({
            title: "Delete Parcel",
            message: `Are you sure you want to delete parcel ${barcode}? This action cannot be undone.`,
            confirmText: "Delete",
            cancelText: "Cancel",
            confirmVariant: "danger",
        });

        if (!confirmed) return;

        const toastId = toast.loading('Deleting parcel...');

        try {
            const { error } = await supabase
                .from('parcels')
                .delete()
                .eq('id', parcelId);

            if (error) throw error;

            toast.success(`Parcel ${barcode} deleted successfully!`, {
                id: toastId,
                duration: 3000,
            });

            // Remove from selected parcels if it was selected
            setSelectedParcelIds(prev => {
                const updated = new Set(prev);
                updated.delete(parcelId);
                return updated;
            });

            fetchData();

        } catch (error) {
            console.error('Error deleting parcel:', error);
            toast.error('Failed to delete parcel', {
                id: toastId,
                duration: 5000,
            });
        }
    };

    // Handle bulk delete
    const handleBulkDelete = async () => {
        if (selectedParcelIds.size === 0) {
            toast.warning('No parcels selected for deletion');
            return;
        }

        const confirmed = await confirm({
            title: "Delete Selected Parcels",
            message: `Are you sure you want to delete ${selectedParcelIds.size} parcel(s)? This action cannot be undone.`,
            confirmText: "Delete",
            cancelText: "Cancel",
            confirmVariant: "danger",
        });

        if (!confirmed) return;

        setDeleting(true);
        const toastId = toast.loading(`Deleting ${selectedParcelIds.size} parcels...`);

        try {
            const ids = Array.from(selectedParcelIds);
            const { error } = await supabase
                .from('parcels')
                .delete()
                .in('id', ids);

            if (error) throw error;

            toast.success(`Successfully deleted ${ids.length} parcels!`, {
                id: toastId,
                duration: 3000,
            });

            setSelectedParcelIds(new Set());
            fetchData();

        } catch (error) {
            console.error('Error deleting parcels:', error);
            toast.error('Failed to delete parcels', {
                id: toastId,
                duration: 5000,
            });
        } finally {
            setDeleting(false);
        }
    };

    // Handle select all checkbox
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const ids = new Set(filteredParcels.map(p => p.id));
            setSelectedParcelIds(ids);
        } else {
            setSelectedParcelIds(new Set());
        }
    };

    // Handle individual checkbox
    const handleSelectParcel = (id: number, checked: boolean) => {
        const newSelected = new Set(selectedParcelIds);
        if (checked) {
            newSelected.add(id);
        } else {
            newSelected.delete(id);
        }
        setSelectedParcelIds(newSelected);
    };

    // Handle page navigation
    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
        }
    };

    // Get color for courier badges
    const getCourierColor = (name: string, index: number): string => {
        const colors: { [key: string]: string } = {
            'Lazada': 'bg-pink-500',
            'Shopee': 'bg-indigo-500',
            'J&T Express': 'bg-emerald-500',
            'Flash Express': 'bg-amber-500',
            'LBC Express': 'bg-purple-500',
            'Air21': 'bg-cyan-500',
            'JRS Express': 'bg-rose-500',
            'GrabExpress': 'bg-teal-500',
            'DHL': 'bg-yellow-500',
            'FedEx': 'bg-blue-500'
        };
        return colors[name] || ['bg-pink-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-cyan-500', 'bg-rose-500'][index % 7];
    };

    // Generate city bulk QR
    const handleGenerateCityBulkQr = async (city: string, parcels: Parcel[]) => {
        if (parcels.length === 0) {
            toast.warning('No parcels in this city');
            return;
        }

        const allHaveBulkQr = parcels.every(p => p.bulk_qr_city);
        if (allHaveBulkQr) {
            toast.info(`All parcels in ${city} already have city bulk QR codes`, { duration: 3000 });
            return;
        }

        // Check if we can reuse existing city QR
        const sanitizedCity = sanitizeForQr(city);
        const existingCityQr = existingQrCodes.cityQrMap.get(sanitizedCity);

        if (existingCityQr) {
            const confirmed = await confirm({
                title: `Reuse City QR for ${city}`,
                message: `Found existing city QR code: ${existingCityQr}. Use this for ${parcels.length} parcels?`,
                confirmText: "Reuse QR",
                cancelText: "Generate New",
                confirmVariant: "success",
            });

            if (confirmed) {
                setGeneratingBulk(true);
                const toastId = toast.loading(`Applying existing city QR for ${city}...`);

                try {
                    const ids = parcels.map(p => p.id);
                    const { error } = await supabase
                        .from('parcels')
                        .update({ bulk_qr_city: existingCityQr })
                        .in('id', ids);

                    if (error) throw error;

                    toast.success(`Existing city QR applied to ${parcels.length} parcels!`, {
                        id: toastId,
                        duration: 4000,
                        action: {
                            label: 'Copy QR',
                            onClick: () => copyToClipboard(existingCityQr)
                        }
                    });

                    fetchData();
                    setGeneratingBulk(false);
                    return;
                } catch (error) {
                    console.error('Error applying existing city QR:', error);
                    toast.error('Failed to apply existing city QR', {
                        id: toastId,
                        duration: 5000,
                    });
                    setGeneratingBulk(false);
                    return;
                }
            }
        }

        const confirmed = await confirm({
            title: `Generate City Bulk QR for ${city}`,
            message: `Generate a bulk QR code for ${parcels.length} parcels in ${city}?`,
            confirmText: "Generate",
            cancelText: "Cancel",
            confirmVariant: "success",
        });

        if (!confirmed) return;

        setGeneratingBulk(true);
        const toastId = toast.loading(`Generating city bulk QR for ${city}...`);

        try {
            const randomCode = generateRandomCode();
            const sanitized = sanitizeForQr(city);
            const bulkQrCode = `BULK-${sanitized || 'CITY'}-${randomCode}`;

            const ids = parcels.map(p => p.id);
            const { error } = await supabase
                .from('parcels')
                .update({ bulk_qr_city: bulkQrCode })
                .in('id', ids);

            if (error) throw error;

            toast.success(`City bulk QR generated for ${parcels.length} parcels in ${city}!`, {
                id: toastId,
                duration: 4000,
                action: {
                    label: 'Copy QR',
                    onClick: () => copyToClipboard(bulkQrCode)
                }
            });

            fetchData();

        } catch (error) {
            console.error('Error generating city bulk QR:', error);
            toast.error('Failed to generate city bulk QR code', {
                id: toastId,
                duration: 5000,
            });
        } finally {
            setGeneratingBulk(false);
        }
    };

    // Generate courier bulk QR
    const handleGenerateCourierBulkQr = async (courierName: string) => {
        const courier = courierStats.find(c => c.name === courierName);
        if (!courier || courier.parcels.length === 0) {
            toast.warning('No parcels for this courier');
            return;
        }

        if (courier.hasBulkQr) {
            toast.info(`This courier already has a courier bulk QR code: ${courier.bulkQrCode}`, {
                duration: 3000,
                action: {
                    label: 'Copy',
                    onClick: () => copyToClipboard(courier.bulkQrCode || '')
                }
            });
            return;
        }

        // Check if we can reuse existing courier QR
        const sanitizedCourier = sanitizeForQr(courierName);
        const existingCourierQr = existingQrCodes.courierQrMap.get(sanitizedCourier);

        if (existingCourierQr) {
            const confirmed = await confirm({
                title: `Reuse Courier QR for ${courierName}`,
                message: `Found existing courier QR code: ${existingCourierQr}. Use this for ${courier.parcels.length} parcels?`,
                confirmText: "Reuse QR",
                cancelText: "Generate New",
                confirmVariant: "success",
            });

            if (confirmed) {
                setGeneratingBulk(true);
                const toastId = toast.loading(`Applying existing courier QR for ${courierName}...`);

                try {
                    const ids = courier.parcels.map(p => p.id);
                    const { error } = await supabase
                        .from('parcels')
                        .update({ bulk_qr_courier: existingCourierQr })
                        .in('id', ids);

                    if (error) throw error;

                    toast.success(`Existing courier QR applied to ${courier.parcels.length} parcels!`, {
                        id: toastId,
                        duration: 4000,
                        action: {
                            label: 'Copy QR',
                            onClick: () => copyToClipboard(existingCourierQr)
                        }
                    });

                    fetchData();
                    setGeneratingBulk(false);
                    return;
                } catch (error) {
                    console.error('Error applying existing courier QR:', error);
                    toast.error('Failed to apply existing courier QR', {
                        id: toastId,
                        duration: 5000,
                    });
                    setGeneratingBulk(false);
                    return;
                }
            }
        }

        const confirmed = await confirm({
            title: `Generate Courier Bulk QR for ${courierName}`,
            message: `Generate a bulk QR code for ${courier.parcels.length} parcels from ${courierName}?`,
            confirmText: "Generate",
            cancelText: "Cancel",
            confirmVariant: "success",
        });

        if (!confirmed) return;

        setGeneratingBulk(true);
        const toastId = toast.loading(`Generating courier bulk QR for ${courierName}...`);

        try {
            const randomCode = generateRandomCode();
            const sanitized = sanitizeForQr(courierName);
            const bulkQrCode = `BULK-${sanitized || 'COURIER'}-${randomCode}`;

            const ids = courier.parcels.map(p => p.id);
            const { error } = await supabase
                .from('parcels')
                .update({ bulk_qr_courier: bulkQrCode })
                .in('id', ids);

            if (error) throw error;

            toast.success(`Courier bulk QR generated for ${courier.parcels.length} parcels (${courierName})!`, {
                id: toastId,
                duration: 4000,
                action: {
                    label: 'Copy QR',
                    onClick: () => copyToClipboard(bulkQrCode)
                }
            });

            fetchData();

        } catch (error) {
            console.error('Error generating courier bulk QR:', error);
            toast.error('Failed to generate courier bulk QR code', {
                id: toastId,
                duration: 5000,
            });
        } finally {
            setGeneratingBulk(false);
        }
    };

    // Generate bulk QR for selected parcels in modal
    const handleGenerateBulkQr = async () => {
        if (selectedParcels.length === 0) {
            toast.warning('No parcels selected');
            return;
        }

        const allHaveBulkQr = selectedParcels.every(p => p.bulk_qr_code);
        if (allHaveBulkQr) {
            toast.info(`All selected parcels already have bulk QR codes`, { duration: 3000 });
            return;
        }

        const confirmed = await confirm({
            title: "Generate Bulk QR",
            message: `Generate a bulk QR code for ${selectedParcels.length} parcels?`,
            confirmText: "Generate",
            cancelText: "Cancel",
            confirmVariant: "success",
        });

        if (!confirmed) return;

        setGeneratingBulk(true);
        const toastId = toast.loading('Generating bulk QR code...');

        try {
            const randomCode = generateRandomCode();
            const bulkQrCode = `BULK-${randomCode}`;

            const ids = selectedParcels.map(p => p.id);
            const { error } = await supabase
                .from('parcels')
                .update({ bulk_qr_code: bulkQrCode })
                .in('id', ids);

            if (error) throw error;

            toast.success(`Bulk QR generated for ${selectedParcels.length} parcels!`, {
                id: toastId,
                duration: 4000,
                action: {
                    label: 'Copy QR',
                    onClick: () => copyToClipboard(bulkQrCode)
                }
            });

            fetchData();

        } catch (error) {
            console.error('Error generating bulk QR:', error);
            toast.error('Failed to generate bulk QR code', {
                id: toastId,
                duration: 5000,
            });
        } finally {
            setGeneratingBulk(false);
        }
    };

    // Add a new function to copy QR from table rows
    const handleCopyTableQr = (text: string | null | undefined, e: React.MouseEvent) => {
        e.stopPropagation();
        if (text) {
            copyToClipboard(text);
        }
    };

    if (loading) {
        return (
            <div data-panel="sorting" className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                <div className="space-y-5">
                    {/* Header Skeleton */}
                    <div className="flex flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                            <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
                            <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div>
                            <div className="h-10 w-10 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                        </div>
                    </div>

                    {/* Search Bar Skeleton */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        <div className="relative flex-1 min-w-[180px]">
                            <div className="h-10 w-full bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                        </div>
                        <div className="h-10 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                        <div className="h-10 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                        <div className="h-10 w-48 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                    </div>

                    {/* Cards Grid Skeleton */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <div key={i} className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-6 w-6 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
                                        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                                    </div>
                                    <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div>
                                </div>
                                <div className="space-y-2.5">
                                    {[1, 2, 3].map((j) => (
                                        <div key={j} className="space-y-1">
                                            <div className="flex justify-between">
                                                <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                                                <div className="h-3 w-8 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Table Skeleton */}
                    <div className="flex-1 overflow-y-auto max-h-[600px] p-4 space-y-5 bg-slate-50/30 dark:bg-slate-950/40">
                        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                            <div className="bg-slate-50/80 dark:bg-slate-800/40 px-4 py-2.5 border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-4 w-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                                    <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                                </div>
                                <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div>
                            </div>
                            <div className="p-4 space-y-3">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className="flex items-center gap-4">
                                        <div className="h-4 w-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                                        <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                                        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                                        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                                        <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                                        <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                                        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                                        <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                                        <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                                        <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                                        <div className="h-4 w-12 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                                        <div className="flex gap-1">
                                            <div className="h-6 w-6 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                                            <div className="h-6 w-6 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Courier Summary Skeleton */}
                    <div className="text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="h-7 w-7 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
                            <div className="h-5 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:gap-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                                        <div className="h-5 w-8 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div>
                                    </div>
                                    <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                                    <div className="mt-4 flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                        <div className="h-8 w-full bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
                                        <div className="h-8 w-full bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const displayData = viewMode === "city" ? cityGroups : regionGroups;

    return (
        <div data-panel="sorting" className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="space-y-5">
                <div className="flex flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
                            <i className="fas fa-sort text-pink-500 dark:text-pink-400"></i>
                            <span>Courier Sorting</span>
                        </h1>
                        <span className="inline-flex items-center text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-3 py-1 rounded-full border border-slate-200/60 dark:border-slate-700/60">
                            <i className="fas fa-box mr-1.5 text-slate-400 dark:text-slate-500"></i> {totalItems} parcels received
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-3 py-1 rounded-full border border-slate-200/60 dark:border-slate-700/60">
                            <i className="far fa-calendar-alt text-slate-400 dark:text-slate-500 mr-1.5"></i> {new Date().toISOString().split('T')[0]}
                        </span>
                        <button
                            type="button"
                            onClick={fetchData}
                            aria-label="Refresh data"
                            className="p-2 rounded-xl text-slate-500 hover:text-pink-600 dark:text-slate-400 dark:hover:text-pink-400 bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200/70 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 transition-all cursor-pointer"
                        >
                            <i className="fas fa-sync-alt text-xs"></i>
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative flex-1 min-w-[180px]">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-8 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 dark:focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all font-medium"
                            placeholder="Search by barcode, tracking, or destination..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    <div className="relative">
                        <select
                            className="appearance-none bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl pl-3 pr-8 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all cursor-pointer min-w-[130px]"
                            value={locationRegionFilter}
                            onChange={(e) => {
                                setLocationRegionFilter(e.target.value);
                                setLocationCityFilter('');
                            }}
                        >
                            <option value="" className="dark:bg-slate-900 dark:text-slate-200">All Regions</option>
                            {allRegions.map((region) => (
                                <option key={region} value={region} className="dark:bg-slate-900 dark:text-slate-200">
                                    {region}
                                </option>
                            ))}
                        </select>
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>

                    <div className="relative">
                        <select
                            className="appearance-none bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl pl-3 pr-8 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all cursor-pointer min-w-[130px]"
                            value={locationCityFilter}
                            onChange={(e) => {
                                setLocationCityFilter(e.target.value);
                                if (e.target.value) {
                                    setLocationRegionFilter('');
                                }
                            }}
                        >
                            <option value="" className="dark:bg-slate-900 dark:text-slate-200">All Cities</option>
                            {allCities.map((city) => (
                                <option key={city} value={city} className="dark:bg-slate-900 dark:text-slate-200">
                                    {city}
                                </option>
                            ))}
                        </select>
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>

                    <button
                        onClick={handleGenerateAllBulkQr}
                        disabled={generatingAllBulk || parcels.length === 0 || allHaveAllQr()}
                        className="h-10 inline-flex items-center gap-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {generatingAllBulk ? (
                            <>
                                <i className="fas fa-spinner fa-spin"></i>
                                <span>Generating...</span>
                            </>
                        ) : allHaveAllQr() ? (
                            <>
                                <i className="fas fa-check-circle"></i>
                                <span>All QR Ready</span>
                            </>
                        ) : (
                            <>
                                <i className="fas fa-qrcode"></i>
                                <span>Generate All QR (Global, City, Courier)</span>
                            </>
                        )}
                    </button>

                    {selectedParcelIds.size > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            disabled={deleting}
                            className="h-10 inline-flex items-center gap-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold text-xs transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {deleting ? (
                                <i className="fas fa-spinner fa-spin"></i>
                            ) : (
                                <i className="fas fa-trash"></i>
                            )}
                            Delete {selectedParcelIds.size}
                        </button>
                    )}
                </div>

                <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <svg className="w-4 h-4 text-pink-500 dark:text-pink-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {viewMode === "city" ? "City Distribution" : "Destination Distribution"}
                            </h2>
                            {viewMode === "region" && regionGroups.length > 0 && (
                                <div className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100/80 dark:bg-slate-800/80 p-0.5 border border-slate-200/60 dark:border-slate-700/60">
                                    <button
                                        type="button"
                                        onClick={expandAllRegions}
                                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-pink-600 dark:text-pink-400 transition-all hover:bg-white dark:hover:bg-slate-700 hover:text-pink-700 dark:hover:text-pink-300 hover:shadow-xs cursor-pointer"
                                    >
                                        <i className="fas fa-angles-down text-[9px]"></i>
                                        <span>Expand All</span>
                                    </button>

                                    <span className="h-3.5 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />

                                    <button
                                        type="button"
                                        onClick={collapseAllRegions}
                                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 transition-all hover:bg-white dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200 hover:shadow-xs cursor-pointer"
                                    >
                                        <i className="fas fa-angles-up text-[9px]"></i>
                                        <span>Collapse All</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                {viewMode === "city" ? `${cityGroups.length} cities` : `${regionGroups.length} regions`}
                            </span>
                            {viewMode === "region" && (
                                <span className="text-xs text-slate-400 dark:text-slate-500">
                                    ({regionGroups.filter(r => r.expanded).length} expanded)
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
                        {displayData.length > 0 ? (
                            viewMode === "city" ? (
                                (displayData as CityGroup[]).map((city) => (
                                    <div
                                        key={city.city}
                                        className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between gap-2 mb-3">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400">
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        </svg>
                                                    </div>
                                                    <span className="font-bold text-slate-900 dark:text-white text-sm truncate" title={city.city}>
                                                        {city.city}
                                                    </span>
                                                </div>
                                                <span className="inline-flex items-center rounded-full bg-pink-500 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-2xs shrink-0">
                                                    {city.total} total
                                                </span>
                                            </div>

                                            <div className="space-y-2.5 my-2">
                                                {city.couriers.length > 0 ? (
                                                    city.couriers.map((courier, idx) => {
                                                        const percentage = city.total > 0 ? Math.min(100, Math.max(0, (courier.count / city.total) * 100)) : 0;
                                                        const barColor = getCourierColor(courier.name, idx);

                                                        return (
                                                            <div key={courier.name} className="space-y-1">
                                                                <div className="flex justify-between items-center text-xs">
                                                                    <span className="font-medium text-slate-600 dark:text-slate-400 truncate mr-2">{courier.name}</span>
                                                                    <span className="font-bold text-slate-800 dark:text-slate-200 shrink-0">{courier.count}</span>
                                                                </div>
                                                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                                                    <div
                                                                        className={`${barColor} h-full rounded-full transition-all duration-500 ease-out`}
                                                                        style={{ width: `${percentage}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="text-xs text-slate-400 dark:text-slate-500 py-2 italic text-center rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800">
                                                        No courier assigned
                                                    </div>
                                                )}
                                            </div>

                                            {city.bulkQrCity && (
                                                <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1.5 border border-slate-100 dark:border-slate-800">
                                                    <span className="truncate text-[10px] font-mono font-medium text-slate-600 dark:text-slate-400 max-w-[130px]">
                                                        {city.bulkQrCity}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyToClipboard(city.bulkQrCity!)}
                                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors p-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                                                        title="Copy QR code"
                                                    >
                                                        <i className="fas fa-copy text-xs"></i>
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleViewCityParcels(city.city, city.parcels)}
                                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-pink-600 dark:text-pink-400 transition-colors hover:text-pink-700 dark:hover:text-pink-300 hover:underline cursor-pointer"
                                            >
                                                <span>View parcels</span>
                                                <svg className="w-3 h-3 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                </svg>
                                            </button>

                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleGenerateCityBulkQr(city.city, city.parcels)}
                                                    disabled={generatingBulk || city.parcels.length === 0 || city.hasBulkQr}
                                                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-all cursor-pointer ${city.hasBulkQr
                                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 cursor-default'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed'
                                                        }`}
                                                >
                                                    <i className={`fas ${city.hasBulkQr ? 'fa-check-circle text-emerald-600 dark:text-emerald-400' : 'fa-qrcode'} text-[10px]`}></i>
                                                    <span>{city.hasBulkQr ? 'City QR Ready' : 'City Bulk QR'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                (displayData as RegionGroup[]).map((region) => (
                                    <div
                                        key={region.region}
                                        className="h-fit rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm overflow-hidden"
                                    >
                                        <div
                                            className="flex items-center justify-between p-3.5 cursor-pointer bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors select-none"
                                            onClick={() => toggleRegion(region.region)}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                                    <svg
                                                        className={`w-3.5 h-3.5 transition-transform duration-200 ${region.expanded ? 'rotate-90' : ''}`}
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                        strokeWidth="2.5"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </div>
                                                <span className="font-bold text-slate-900 dark:text-white text-sm truncate" title={region.region}>
                                                    {region.region}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                                    {region.cities.length} {region.cities.length === 1 ? 'city' : 'cities'}
                                                </span>
                                                <span className="inline-flex items-center rounded-full bg-pink-500 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-2xs">
                                                    {region.total}
                                                </span>
                                            </div>
                                        </div>

                                        <AnimatedRegionContent region={region}>
                                            <div className="p-2 pt-0 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/40">
                                                <div className="space-y-1 pt-1.5">
                                                    {region.cities.map((city) => (
                                                        <div
                                                            key={city.city}
                                                            className="flex items-center justify-between gap-2 rounded-xl p-2 hover:bg-white dark:hover:bg-slate-800 hover:shadow-xs transition-all border border-transparent hover:border-slate-200/60 dark:hover:border-slate-700/60 group/city"
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate">
                                                                    {city.city}
                                                                </span>
                                                                <span className="inline-flex items-center rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                                                                    {city.total}
                                                                </span>
                                                            </div>

                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleViewCityParcels(city.city, city.parcels)}
                                                                    className="rounded px-2 py-0.5 text-[10px] font-semibold text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/40 hover:text-pink-700 dark:hover:text-pink-300 transition-colors cursor-pointer"
                                                                >
                                                                    View
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleGenerateCityBulkQr(city.city, city.parcels)}
                                                                    disabled={generatingBulk || city.parcels.length === 0 || city.hasBulkQr}
                                                                    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${city.hasBulkQr
                                                                        ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 cursor-default'
                                                                        : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300'
                                                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                                                >
                                                                    <i className={`fas ${city.hasBulkQr ? 'fa-check-circle' : 'fa-qrcode'}`}></i>
                                                                    <span>{city.hasBulkQr ? 'QR' : 'City QR'}</span>
                                                                </button>
                                                                {city.bulkQrCity && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => copyToClipboard(city.bulkQrCity!)}
                                                                        className="rounded p-0.5 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                                                                        title="Copy QR code"
                                                                    >
                                                                        <i className="fas fa-copy text-[10px]"></i>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </AnimatedRegionContent>
                                    </div>
                                ))
                            )
                        ) : (
                            <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-gradient-to-b from-slate-50/80 to-white dark:from-slate-900/50 dark:to-slate-900 py-16 px-6 text-center">
                                <div className="relative mb-4">
                                    <div className="absolute inset-0 blur-2xl bg-pink-200/30 dark:bg-pink-900/10 rounded-full"></div>
                                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-pink-50 dark:bg-pink-950/50 text-pink-500 dark:text-pink-400 shadow-sm ring-1 ring-pink-500/10 dark:ring-pink-500/20">
                                        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                </div>
                                <p className="text-base font-bold text-slate-900 dark:text-white">No destinations found</p>
                                <p className="mt-1.5 max-w-xs text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    {searchTerm || locationRegionFilter || locationCityFilter ? (
                                        <>
                                            Try adjusting your search or filter criteria
                                            <span className="block text-xs text-slate-400 dark:text-slate-500 mt-1">
                                                No parcels match the current {searchTerm && 'search term'}{searchTerm && (locationRegionFilter || locationCityFilter) && ' and '}{locationRegionFilter && 'region filter'}{locationRegionFilter && locationCityFilter && ' and '}{locationCityFilter && 'city filter'}
                                            </span>
                                        </>
                                    ) : (
                                        'No received parcels available for sorting at this time.'
                                    )}
                                </p>
                                {(searchTerm || locationRegionFilter || locationCityFilter) && (
                                    <button
                                        onClick={() => {
                                            setSearchTerm('');
                                            setLocationRegionFilter('');
                                            setLocationCityFilter('');
                                        }}
                                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                                    >
                                        <i className="fas fa-undo-alt text-[10px]"></i>
                                        <span>Clear all filters</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Scrollable Content Container - Table with delete and bulk delete */}
                <div className="flex-1 overflow-y-auto max-h-[600px] p-4 space-y-5 bg-slate-50/30 dark:bg-slate-950/40">
                    {loading ? (
                        <TableContentLoader />
                    ) : groupedParcels.length > 0 ? (
                        groupedParcels.map((group) => (
                            <div key={group.date} className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-2xs bg-white dark:bg-slate-900 transition-colors">

                                {/* Date Group Header with Selection Info */}
                                <div className="bg-slate-50/80 dark:bg-slate-800/40 px-4 py-2.5 border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={group.parcels.length > 0 && group.parcels.every(p => selectedParcelIds.has(p.id))}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                const ids = group.parcels.map(p => p.id);
                                                const newSelected = new Set(selectedParcelIds);
                                                if (checked) {
                                                    ids.forEach(id => newSelected.add(id));
                                                } else {
                                                    ids.forEach(id => newSelected.delete(id));
                                                }
                                                setSelectedParcelIds(newSelected);
                                            }}
                                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                                        />
                                        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-lg bg-pink-50 dark:bg-pink-500/10 border border-pink-100 dark:border-pink-500/20 inline-flex items-center justify-center text-pink-500 dark:text-pink-400 text-[11px]">
                                                <i className="fas fa-calendar-day"></i>
                                            </span>
                                            {group.date}
                                        </h3>
                                    </div>
                                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-950/80 px-2.5 py-0.5 rounded-full border border-slate-200/60 dark:border-slate-800 shadow-2xs">
                                        {group.parcels.length} {group.parcels.length === 1 ? 'parcel' : 'parcels'}
                                    </span>
                                </div>

                                {/* Table View with Checkboxes and Delete Actions */}
                                <div className="overflow-x-auto">
                                    <table className="table-pro w-full">
                                        <thead>
                                            <tr>
                                                <th className="w-10 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={group.parcels.length > 0 && group.parcels.every(p => selectedParcelIds.has(p.id))}
                                                        onChange={(e) => {
                                                            const checked = e.target.checked;
                                                            const ids = group.parcels.map(p => p.id);
                                                            const newSelected = new Set(selectedParcelIds);
                                                            if (checked) {
                                                                ids.forEach(id => newSelected.add(id));
                                                            } else {
                                                                ids.forEach(id => newSelected.delete(id));
                                                            }
                                                            setSelectedParcelIds(newSelected);
                                                        }}
                                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                                                    />
                                                </th>
                                                <th className="w-10 text-center">#</th>
                                                <th>Barcode</th>
                                                <th>Tracking</th>
                                                <th>Sender</th>
                                                <th>Customer</th>
                                                <th>Customer Number</th>
                                                <th>Destination</th>
                                                <th>Courier</th>
                                                <th>Status</th>
                                                <th>Time</th>
                                                <th className="text-center">Global QR</th>
                                                <th className="text-center">City QR</th>
                                                <th className="text-center">Courier QR</th>
                                                <th className="text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.parcels.map((parcel, index) => {
                                                const isSelected = selectedParcelIds.has(parcel.id);
                                                return (
                                                    <tr
                                                        key={parcel.id}
                                                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors duration-150 group ${isSelected ? 'bg-pink-50/30 dark:bg-pink-950/20' : ''
                                                            }`}
                                                    >
                                                        <td data-label="Select" className="text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => {
                                                                    const newSelected = new Set(selectedParcelIds);
                                                                    if (newSelected.has(parcel.id)) {
                                                                        newSelected.delete(parcel.id);
                                                                    } else {
                                                                        newSelected.add(parcel.id);
                                                                    }
                                                                    setSelectedParcelIds(newSelected);
                                                                }}
                                                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                                                            />
                                                        </td>
                                                        <td data-label="#" className="text-center text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                                                            {index + 1}
                                                        </td>
                                                        <td data-label="Barcode" className="whitespace-nowrap">
                                                            <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200 font-bold bg-slate-100 dark:bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700/50">
                                                                {parcel.barcode}
                                                            </span>
                                                        </td>
                                                        <td data-label="Tracking" className="font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                            {parcel.tracking_number}
                                                        </td>
                                                        <td data-label="Sender" className="text-slate-800 dark:text-slate-200 font-semibold whitespace-nowrap">
                                                            {parcel.sender_name || 'N/A'}
                                                        </td>
                                                        <td data-label="Customer" className="text-slate-800 dark:text-slate-200 font-semibold whitespace-nowrap">
                                                            {parcel.customer_name || 'N/A'}
                                                        </td>
                                                        <td data-label="Customer Number" className="text-slate-800 dark:text-slate-200 font-semibold whitespace-nowrap">
                                                            {parcel.customer_number || 'N/A'}
                                                        </td>
                                                        <td data-label="Destination" className="text-slate-600 dark:text-slate-300 whitespace-nowrap truncate max-w-3">
                                                            {parcel.destination || 'N/A'}
                                                        </td>
                                                        <td data-label="Courier" className="text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                                                            {parcel.courier || 'N/A'}
                                                        </td>
                                                        <td data-label="Status" className="whitespace-nowrap">
                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getStatusBadge(parcel.status)}`}>
                                                                {getStatusLabel(parcel.status)}
                                                            </span>
                                                        </td>
                                                        <td data-label="Time" className="text-slate-400 dark:text-slate-500 text-[11px] font-mono whitespace-nowrap">
                                                            {new Date(parcel.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </td>

                                                        {/* QR Code Cells */}
                                                        <td data-label="Global QR" className="text-center">
                                                            {parcel.bulk_qr_code ? (
                                                                <button
                                                                    onClick={(e) => handleCopyTableQr(parcel.bulk_qr_code, e)}
                                                                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-md border border-emerald-200/60 dark:border-emerald-800/60 transition-all cursor-pointer"
                                                                    title="Copy Global QR"
                                                                >
                                                                    <i className="fas fa-copy text-[9px]"></i>
                                                                    <span className="max-w-[60px] truncate">{parcel.bulk_qr_code}</span>
                                                                </button>
                                                            ) : (
                                                                <span className="text-slate-300 dark:text-slate-600 text-[10px]">—</span>
                                                            )}
                                                        </td>

                                                        <td data-label="City QR" className="text-center">
                                                            {parcel.bulk_qr_city ? (
                                                                <button
                                                                    onClick={(e) => handleCopyTableQr(parcel.bulk_qr_city, e)}
                                                                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md border border-blue-200/60 dark:border-blue-800/60 transition-all cursor-pointer"
                                                                    title="Copy City QR"
                                                                >
                                                                    <i className="fas fa-copy text-[9px]"></i>
                                                                    <span className="max-w-[60px] truncate">{parcel.bulk_qr_city}</span>
                                                                </button>
                                                            ) : (
                                                                <span className="text-slate-300 dark:text-slate-600 text-[10px]">—</span>
                                                            )}
                                                        </td>

                                                        <td data-label="Courier QR" className="text-center">
                                                            {parcel.bulk_qr_courier ? (
                                                                <button
                                                                    onClick={(e) => handleCopyTableQr(parcel.bulk_qr_courier, e)}
                                                                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-md border border-purple-200/60 dark:border-purple-800/60 transition-all cursor-pointer"
                                                                    title="Copy Courier QR"
                                                                >
                                                                    <i className="fas fa-copy text-[9px]"></i>
                                                                    <span className="max-w-[60px] truncate">{parcel.bulk_qr_courier}</span>
                                                                </button>
                                                            ) : (
                                                                <span className="text-slate-300 dark:text-slate-600 text-[10px]">—</span>
                                                            )}
                                                        </td>

                                                        <td data-label="Actions" className="text-right whitespace-nowrap">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <button
                                                                    onClick={() => handleViewParcel(parcel)}
                                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50/50 dark:bg-blue-500/10 hover:bg-blue-100/70 dark:hover:bg-blue-500/20 active:scale-95 rounded-lg transition-all border border-blue-100 dark:border-blue-500/20 shadow-2xs cursor-pointer"
                                                                    title="View Parcel"
                                                                >
                                                                    <i className="fas fa-eye text-[10px]"></i>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteParcel(parcel.id, parcel.barcode)}
                                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 bg-rose-50/50 dark:bg-rose-500/10 hover:bg-rose-100/70 dark:hover:bg-rose-500/20 active:scale-95 rounded-lg transition-all border border-rose-100 dark:border-rose-500/20 shadow-2xs cursor-pointer"
                                                                    title="Delete Parcel"
                                                                >
                                                                    <i className="fas fa-trash text-[10px]"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto mb-3 shadow-inner">
                                <i className="fas fa-box-open text-xl"></i>
                            </div>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No parcels found</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs mx-auto">Try adjusting your search query or active filter parameters</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Courier Pickup Summary */}
            <div className="text-slate-900 dark:text-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-pink-50 dark:bg-pink-950/40 flex items-center justify-center">
                            <i className="fas fa-truck text-pink-500 dark:text-pink-400 text-xs"></i>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                            Courier Pickup Summary
                        </h3>
                    </div>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-200/60 dark:border-slate-700/60">
                        <i className="far fa-clock text-slate-400 dark:text-slate-500 mr-1"></i> Ready for pickup
                    </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:gap-4">
                    {courierStats.length > 0 ? (
                        courierStats.map((courier) => {
                            const hasQr = courier.hasBulkQr;
                            const qrCode = courier.bulkQrCourier;

                            return (
                                <div
                                    key={courier.name}
                                    className={`group relative flex flex-col justify-between rounded-2xl border bg-white dark:bg-slate-900 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${hasQr
                                        ? 'border-emerald-200 dark:border-emerald-900/60 hover:border-emerald-300 dark:hover:border-emerald-700/60 hover:shadow-emerald-500/5'
                                        : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-slate-500/5'
                                        }`}
                                >
                                    <div>
                                        <div className="mb-2 flex items-center justify-between gap-2">
                                            <span className="truncate text-sm font-bold tracking-tight text-slate-800 dark:text-white" title={courier.name}>
                                                {courier.name}
                                            </span>
                                            <span className="inline-flex items-center rounded-full bg-pink-50 dark:bg-pink-950/40 px-2.5 py-0.5 text-xs font-bold text-pink-600 dark:text-pink-400 ring-1 ring-inset ring-pink-500/10 dark:ring-pink-500/20">
                                                {courier.count}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5 text-[11px] font-medium">
                                            <span
                                                className={`h-2 w-2 rounded-full ${hasQr ? 'bg-emerald-500 ring-2 ring-emerald-100 dark:ring-emerald-950' : 'bg-amber-500 ring-2 ring-amber-100 dark:ring-amber-950'
                                                    }`}
                                            />
                                            <span className={hasQr ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}>
                                                {hasQr ? 'Courier QR Ready' : 'Ready for pickup'}
                                            </span>
                                        </div>

                                        {hasQr && qrCode && (
                                            <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1.5 border border-slate-100 dark:border-slate-800">
                                                <span className="truncate text-[11px] font-mono font-medium text-slate-600 dark:text-slate-400 max-w-[130px]">
                                                    {qrCode}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        copyToClipboard(qrCode);
                                                    }}
                                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors p-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                                    title="Copy QR code"
                                                >
                                                    <i className="fas fa-copy text-xs"></i>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-4 flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                        <button
                                            type="button"
                                            onClick={() => handleViewCourierParcels(courier.name)}
                                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all hover:bg-pink-50 dark:hover:bg-pink-950/40 hover:text-pink-600 dark:hover:text-pink-400 group/btn"
                                        >
                                            <span>View parcels</span>
                                            <i className="fas fa-arrow-right text-[10px] text-slate-400 dark:text-slate-500 group-hover/btn:text-pink-500 group-hover/btn:translate-x-0.5 transition-all"></i>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleGenerateCourierBulkQr(courier.name)}
                                            disabled={generatingBulk || courier.parcels.length === 0 || hasQr}
                                            className={`w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${hasQr
                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 cursor-default border border-emerald-200/60 dark:border-emerald-800/60'
                                                : 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none'
                                                }`}
                                        >
                                            <i className={`fas ${hasQr ? 'fa-check-circle text-emerald-600 dark:text-emerald-400' : 'fa-qrcode'} text-xs`}></i>
                                            <span>{hasQr ? 'Courier QR Generated' : 'Generate Courier QR'}</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-gradient-to-b from-slate-50/80 to-white dark:from-slate-900/50 dark:to-slate-900 py-14 px-6 text-center">
                            <div className="relative mb-3">
                                <div className="absolute inset-0 blur-2xl bg-amber-200/30 dark:bg-amber-900/10 rounded-full"></div>
                                <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-500 dark:text-amber-400 shadow-sm ring-1 ring-amber-500/10 dark:ring-amber-500/20">
                                    <i className="fas fa-truck text-xl"></i>
                                </div>
                            </div>
                            <p className="text-base font-bold text-slate-900 dark:text-white">No couriers available</p>
                            <p className="mt-1.5 max-w-sm text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                There are currently no couriers with pending parcels ready for pickup.
                            </p>
                            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                                <i className="fas fa-info-circle text-slate-300 dark:text-slate-600"></i>
                                <span>Parcels will appear here when assigned to a courier</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* City Parcels Modal */}
            <Portal>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-2xl dark:shadow-black/70 border border-slate-200/80 dark:border-slate-800 animate-in zoom-in-95 slide-in-from-bottom-4 duration-200">

                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-4 sm:px-6">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400 border border-pink-100 dark:border-pink-900/30">
                                        <i className="fas fa-map-pin text-base"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                            {selectedParcels.length > 0 ? selectedParcels[0]?.city || 'Parcels' : 'Parcels'}
                                        </h3>
                                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                            {selectedParcels.length} {selectedParcels.length === 1 ? 'parcel' : 'parcels'} found
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleGenerateBulkQr}
                                        disabled={generatingBulk || selectedParcels.length === 0 || selectedParcels.every((p) => p.bulk_qr_code)}
                                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-emerald-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer"
                                    >
                                        {generatingBulk ? (
                                            <>
                                                <i className="fas fa-spinner fa-spin text-xs"></i>
                                                <span>Generating...</span>
                                            </>
                                        ) : (
                                            <>
                                                <i className="fas fa-qrcode text-xs"></i>
                                                <span>Generate Bulk QR</span>
                                            </>
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowModal(false);
                                            setSelectedParcels([]);
                                        }}
                                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/30 cursor-pointer"
                                        aria-label="Close modal"
                                    >
                                        <i className="fas fa-times text-sm"></i>
                                    </button>
                                </div>
                            </div>

                            <div className="relative flex-1 overflow-y-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 backdrop-blur-xs border-b border-slate-200/80 dark:border-slate-800">
                                        <tr>
                                            <th className="py-3 px-4 sm:px-6">Barcode</th>
                                            <th className="py-3 px-3">Tracking</th>
                                            <th className="py-3 px-3">Courier</th>
                                            <th className="py-3 px-4 sm:px-6">Bulk QR (City)</th>
                                            <th className="py-3 px-4 sm:px-6 text-right">Bulk QR (Global)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                                        {selectedParcels.map((parcel) => (
                                            <tr key={parcel.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                                                <td className="py-3 px-4 sm:px-6 font-mono font-bold text-slate-900 dark:text-slate-100">
                                                    <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 border border-slate-200/60 dark:border-slate-700/60 text-slate-800 dark:text-slate-200">
                                                        {parcel.barcode}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400">
                                                    {parcel.tracking_number}
                                                </td>
                                                <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">
                                                    {parcel.courier || 'N/A'}
                                                </td>
                                                <td className="py-3 px-4 sm:px-6">
                                                    {parcel.bulk_qr_city ? (
                                                        <div className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 border border-emerald-200/60 dark:border-emerald-800/60">
                                                            <span className="font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 max-w-[100px] truncate">
                                                                {parcel.bulk_qr_city}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => copyToClipboard(parcel.bulk_qr_city!)}
                                                                className="rounded p-0.5 text-blue-600 dark:text-blue-400 transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer"
                                                                title="Copy QR code"
                                                            >
                                                                <i className="fas fa-copy text-[10px]"></i>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300 dark:text-slate-600 font-semibold">—</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 sm:px-6 text-right">
                                                    {parcel.bulk_qr_code ? (
                                                        <div className="inline-flex items-center justify-end gap-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 border border-emerald-200/60 dark:border-emerald-800/60">
                                                            <span className="font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 max-w-[100px] truncate">
                                                                {parcel.bulk_qr_code}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => copyToClipboard(parcel.bulk_qr_code!)}
                                                                className="rounded p-0.5 text-blue-600 dark:text-blue-400 transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer"
                                                                title="Copy QR code"
                                                            >
                                                                <i className="fas fa-copy text-[10px]"></i>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300 dark:text-slate-600 font-semibold">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4 sm:px-6">
                                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
                                        {selectedParcels.filter((p) => p.bulk_qr_code).length} of {selectedParcels.length} with global QR
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
                                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400"></span>
                                        {selectedParcels.filter((p) => p.bulk_qr_city).length} with city QR
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setSelectedParcels([]);
                                    }}
                                    className="rounded-xl px-5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-xs cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>

                        </div>
                    </div>
                )}
            </Portal>

            {/* Courier Parcels Modal */}
            <Portal>
                {showCourierModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200/80 dark:border-slate-800 animate-in slide-in-from-bottom-4 duration-300 overflow-hidden">

                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400 border border-pink-100 dark:border-pink-900/30">
                                        <i className="fas fa-truck text-base"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                            {selectedCourier || 'Courier Parcels'}
                                        </h3>
                                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                            {courierParcels.length} {courierParcels.length === 1 ? 'parcel' : 'parcels'} found
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCourierModal(false);
                                        setCourierParcels([]);
                                        setSelectedCourier(null);
                                    }}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none cursor-pointer"
                                    aria-label="Close modal"
                                >
                                    <i className="fas fa-xmark text-sm"></i>
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto px-6 py-4">
                                {courierParcels.length > 0 ? (
                                    <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                                        <table className="w-full text-left text-xs">
                                            <thead>
                                                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                    <th scope="col" className="px-3 py-2.5">Barcode</th>
                                                    <th scope="col" className="px-3 py-2.5">Tracking</th>
                                                    <th scope="col" className="px-3 py-2.5">Destination</th>
                                                    <th scope="col" className="px-3 py-2.5">City</th>
                                                    <th scope="col" className="px-3 py-2.5">Bulk QR (Courier)</th>
                                                    <th scope="col" className="px-3 py-2.5">Bulk QR (Global)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900">
                                                {courierParcels.map((parcel) => (
                                                    <tr key={parcel.id} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                                                            {parcel.barcode}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                                                            {parcel.tracking_number}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                                                            {parcel.destination || <span className="text-slate-400 dark:text-slate-600">N/A</span>}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                                                            {parcel.city || <span className="text-slate-400 dark:text-slate-600">N/A</span>}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-2.5">
                                                            {parcel.bulk_qr_courier ? (
                                                                <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/40 px-2 py-0.5">
                                                                    <span className="font-mono text-[10px] font-medium text-emerald-700 dark:text-emerald-400 max-w-[120px] truncate">
                                                                        {parcel.bulk_qr_courier}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => copyToClipboard(parcel.bulk_qr_courier!)}
                                                                        className="rounded p-0.5 text-emerald-600 dark:text-emerald-400 transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/50 hover:text-emerald-800 dark:hover:text-emerald-300 cursor-pointer"
                                                                        title="Copy QR code"
                                                                    >
                                                                        <i className="fas fa-copy text-[10px]"></i>
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-300 dark:text-slate-700 font-mono">—</span>
                                                            )}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-2.5">
                                                            {parcel.bulk_qr_code ? (
                                                                <div className="inline-flex items-center gap-1.5 rounded-md border border-blue-200/80 dark:border-blue-800/60 bg-blue-50/60 dark:bg-blue-950/40 px-2 py-0.5">
                                                                    <span className="font-mono text-[10px] font-medium text-blue-700 dark:text-blue-400 max-w-[120px] truncate">
                                                                        {parcel.bulk_qr_code}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => copyToClipboard(parcel.bulk_qr_code!)}
                                                                        className="rounded p-0.5 text-blue-600 dark:text-blue-400 transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer"
                                                                        title="Copy QR code"
                                                                    >
                                                                        <i className="fas fa-copy text-[10px]"></i>
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-300 dark:text-slate-700 font-mono">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="mb-2 rounded-full bg-slate-100 dark:bg-slate-800 p-3 text-slate-400 dark:text-slate-500">
                                            <i className="fas fa-box-open text-xl"></i>
                                        </div>
                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No parcels found</p>
                                        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">There are no individual parcels attached to this courier.</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80 px-6 py-3.5">
                                <div className="flex items-center gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
                                        {courierParcels.filter((p) => p.bulk_qr_courier).length} with courier QR
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40">
                                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400"></span>
                                        {courierParcels.filter((p) => p.bulk_qr_code).length} with global QR
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCourierModal(false);
                                        setCourierParcels([]);
                                        setSelectedCourier(null);
                                    }}
                                    className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 shadow-2xs cursor-pointer"
                                >
                                    Done
                                </button>
                            </div>

                        </div>
                    </div>
                )}
            </Portal>

            {/* View Parcel Modal */}
            <Portal>
                {showViewModal && viewParcel && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-2xl dark:shadow-black/70 border border-slate-200/80 dark:border-slate-800 animate-in zoom-in-95 slide-in-from-bottom-4 duration-200">

                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-5">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-500 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                                        <i className="fas fa-box text-base"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                            Parcel Details
                                        </h3>
                                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                            {viewParcel.barcode}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowViewModal(false);
                                        setViewParcel(null);
                                    }}
                                    className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                                    aria-label="Close modal"
                                >
                                    <i className="fas fa-times text-sm"></i>
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-5">
                                {/* Main Info Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Barcode</label>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white mt-1 font-mono">{viewParcel.barcode}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Tracking Number</label>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white mt-1 font-mono">{viewParcel.tracking_number}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Sender</label>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">{viewParcel.sender_name || 'N/A'}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Courier</label>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">{viewParcel.courier || 'N/A'}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Destination</label>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">{viewParcel.destination || 'N/A'}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">City</label>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">{viewParcel.city || 'N/A'}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Region</label>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">{viewParcel.region || 'N/A'}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Status</label>
                                        <p className="mt-1">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(viewParcel.status)}`}>
                                                {getStatusLabel(viewParcel.status)}
                                            </span>
                                        </p>
                                    </div>
                                </div>

                                {/* Customer Info */}
                                {(viewParcel.customer_name || viewParcel.customer_number) && (
                                    <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl p-4 border border-blue-100 dark:border-blue-900/30">
                                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2">Customer Information</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {viewParcel.customer_name && (
                                                <div>
                                                    <label className="text-[10px] font-medium text-blue-500 dark:text-blue-400">Name</label>
                                                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">{viewParcel.customer_name}</p>
                                                </div>
                                            )}
                                            {viewParcel.customer_number && (
                                                <div>
                                                    <label className="text-[10px] font-medium text-blue-500 dark:text-blue-400">Contact Number</label>
                                                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">{viewParcel.customer_number}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* QR Codes */}
                                {(viewParcel.bulk_qr_code || viewParcel.bulk_qr_city || viewParcel.bulk_qr_courier) && (
                                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">QR Codes</h4>
                                        <div className="space-y-2">
                                            {viewParcel.bulk_qr_code && (
                                                <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-800">
                                                    <span className="text-xs font-mono text-slate-600 dark:text-slate-400">Global: {viewParcel.bulk_qr_code}</span>
                                                    <button
                                                        onClick={() => copyToClipboard(viewParcel.bulk_qr_code!)}
                                                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                                                        title="Copy QR code"
                                                    >
                                                        <i className="fas fa-copy text-xs"></i>
                                                    </button>
                                                </div>
                                            )}
                                            {viewParcel.bulk_qr_city && (
                                                <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-800">
                                                    <span className="text-xs font-mono text-slate-600 dark:text-slate-400">City: {viewParcel.bulk_qr_city}</span>
                                                    <button
                                                        onClick={() => copyToClipboard(viewParcel.bulk_qr_city!)}
                                                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                                                        title="Copy QR code"
                                                    >
                                                        <i className="fas fa-copy text-xs"></i>
                                                    </button>
                                                </div>
                                            )}
                                            {viewParcel.bulk_qr_courier && (
                                                <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-800">
                                                    <span className="text-xs font-mono text-slate-600 dark:text-slate-400">Courier: {viewParcel.bulk_qr_courier}</span>
                                                    <button onClick={() => copyToClipboard(viewParcel.bulk_qr_courier!)}
                                                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                                                        title="Copy QR code"
                                                    >
                                                        <i className="fas fa-copy text-xs"></i>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Timestamps */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                                    <div>
                                        <span className="font-medium text-slate-400 dark:text-slate-500">Created:</span>
                                        <span className="ml-2 font-mono">{new Date(viewParcel.created_at).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4">
                                <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(viewParcel.status)}`}>
                                        {getStatusLabel(viewParcel.status)}
                                    </span>
                                    <span className="text-xs text-slate-400 dark:text-slate-500">
                                        ID: {viewParcel.id}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            setShowViewModal(false);
                                            setViewParcel(null);
                                        }}
                                        className="rounded-xl px-5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-xs cursor-pointer"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>

                        </div>
                    </div>
                )}
            </Portal>
        </div>
    );
}