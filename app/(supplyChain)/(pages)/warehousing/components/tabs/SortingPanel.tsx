"use client";
import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { supabase } from "../../../../lib/services/client/supabase";
import { useDebounce } from "../../../../hooks/useDebounce";
import { toast } from "sonner";
import { useConfirm } from "../../../../components/ui/ConfirmModal";
import Portal from "../../../../components/client/Portal";
import { Pagination } from "../../../../components/global/pagination";
import { TableContentLoader } from "../../../../components/global/Loader";
import { CrudActionButton } from "../../../../components/ui/CrudActionButton";
import { AppButton } from "../../../../components/ui/AppButton";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { Clipboard, Eye } from "lucide-react";
import { useUserRole } from "../../../../components/global/UnauthorizedEmptyState";
interface Parcel {
    id: number;
    barcode: string;
    tracking_number: string;
    destination: string | null;
    courier: string | null;
    status: string;
    created_at: string;
    sender_name: string | null;
    scanned_by?: string | null;
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
    couriers: {
        name: string;
        count: number;
    }[];
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
} // badge color
const getStatusBadge = (status: string): string => {
    switch (status) {
        case 'received':
            return 'bg-pink-50 text-pink-700 border-pink-200/80 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800/50 shadow-2xs font-semibold';
        case 'pending':
            return 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50 shadow-2xs font-semibold';
        case 'dispatched':
            return 'bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/50 shadow-2xs font-semibold';
        case 'delivered':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50 shadow-2xs font-semibold';
        default:
            return 'bg-slate-100 text-slate-700 border-slate-200/80 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/60 shadow-2xs font-semibold';
    }
}; // status label
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
}; // animated component
const AnimatedRegionContent = memo(({ region, children }: {
    region: RegionGroup;
    children: React.ReactNode;
}) => {
    return (<div className={`overflow-hidden transition-all duration-300 ease-in-out ${region.expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="border-t border-slate-100">
                {children}
            </div>
        </div>);
});
AnimatedRegionContent.displayName = 'AnimatedRegionContent';
export default function SortingPanel() {
    const { role: userRole, userId: currentUserId, isPrivileged, isLoaded } = useUserRole();
    const [parcels, setParcels] = useState<Parcel[]>([]);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
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
    const [allParcelsList, setAllParcelsList] = useState<Parcel[]>([]);
    const [groupedParcels, setGroupedParcels] = useState<GroupedParcel[]>([]);
    const [viewParcel, setViewParcel] = useState<Parcel | null>(null);
    const [showViewModal, setShowViewModal] = useState(false);
    const [existingQrCodes, setExistingQrCodes] = useState<ExistingQrCodes>({
        cityQrMap: new Map(),
        courierQrMap: new Map()
    });
    const limit = 10;
    const { confirm } = useConfirm();
    const debouncedSearch = useDebounce(searchTerm, 300); // sanitize qr
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
    }; // rand qr
    const generateRandomCode = useCallback(() => {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }, []); // check qr
    const allHaveAllQr = useCallback(() => {
        const list = selectedParcelIds.size > 0
            ? allParcelsList.filter(p => selectedParcelIds.has(p.id))
            : (allParcelsList.length > 0 ? allParcelsList : parcels);
        return list.length > 0 && list.every(p => p.bulk_qr_code && p.bulk_qr_city && p.bulk_qr_courier);
    }, [selectedParcelIds, allParcelsList, parcels]); // existing qr
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
        const targetList = selectedParcelIds.size > 0
            ? allParcelsList.filter(p => selectedParcelIds.has(p.id))
            : allParcelsList.length > 0
                ? allParcelsList
                : parcels;

        if (targetList.length === 0) {
            toast.warning('No parcels found to generate bulk QR');
            return;
        }
        if (targetList.every(p => p.bulk_qr_code && p.bulk_qr_city && p.bulk_qr_courier)) {
            toast.info(`All ${targetList.length} parcels already have all QR codes`, { duration: 3000 });
            return;
        }
        const warningMessage = (<div className="space-y-3 text-left text-sm text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <i className="fas fa-exclamation-triangle"></i>
                    BEFORE YOU CONTINUE
                </p>{/* batch summary */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60 text-xs space-y-1">
                    <p className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <i className="fas fa-boxes text-slate-400 dark:text-slate-500"></i>
                        Batch Summary:
                    </p>
                    <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-0.5">
                        <li>Items: <span className="font-semibold text-slate-900 dark:text-white">{targetList.length} parcel{targetList.length > 1 ? 's' : ''}</span></li>
                        <li>Action: Assign shared Global, City, and Courier QR codes</li>
                    </ul>
                </div>{/* note */}
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
                    Proceed with generating QR codes for {targetList.length} parcel{targetList.length > 1 ? 's' : ''}?
                </p>
            </div>);
        const confirmed = await confirm({
            title: "Generate All Bulk QR Codes",
            message: warningMessage,
            confirmText: "Generate Now",
            cancelText: "Cancel",
            confirmVariant: "success",
        });
        if (!confirmed)
            return;
        setGeneratingAllBulk(true);
        const toastId = toast.loading(`Generating all bulk QR codes for ${targetList.length} parcels...`);
        try { // build qr maps
            const existingMaps = buildExistingQrMaps(targetList);
            const generatedCityQrs = new Map<string, string>();
            const generatedCourierQrs = new Map<string, string>(); // main global qr
            const existingGlobalQr = targetList.find(p => p.bulk_qr_code)?.bulk_qr_code;
            const globalQrCode = existingGlobalQr || `BULK-${generateRandomCode()}`; // group qr
            const cityGroups: Record<string, number[]> = {};
            const courierGroups: Record<string, number[]> = {};
            const globalIds: number[] = [];
            targetList.forEach((parcel) => {
                if (!parcel.bulk_qr_code) {
                    globalIds.push(parcel.id);
                } // group city
                if (!parcel.bulk_qr_city) {
                    const cityKey = sanitizeForQr(parcel.city || 'UNASSIGNED'); // check city qr
                    let cityQr = existingMaps.cityQrMap.get(cityKey) || generatedCityQrs.get(cityKey);
                    if (!cityQr) {
                        cityQr = `BULK-${cityKey || 'CITY'}-${generateRandomCode()}`;
                        generatedCityQrs.set(cityKey, cityQr);
                    }
                    if (!cityGroups[cityQr]) {
                        cityGroups[cityQr] = [];
                    }
                    cityGroups[cityQr].push(parcel.id);
                } // group courier
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
            }); // update global qr
            if (globalIds.length > 0) {
                const { error: globalError } = await supabase
                    .from('parcels')
                    .update({ bulk_qr_code: globalQrCode })
                    .in('id', globalIds);
                if (globalError)
                    throw globalError;
            } // update city qr
            for (const [qrCode, ids] of Object.entries(cityGroups)) {
                const { error: cityError } = await supabase
                    .from('parcels')
                    .update({ bulk_qr_city: qrCode })
                    .in('id', ids);
                if (cityError)
                    throw cityError;
            } // update courier qr
            for (const [qrCode, ids] of Object.entries(courierGroups)) {
                const { error: courierError } = await supabase
                    .from('parcels')
                    .update({ bulk_qr_courier: qrCode })
                    .in('id', ids);
                if (courierError)
                    throw courierError;
            }
            toast.success(`All bulk QR codes generated for ${targetList.length} parcels!`, {
                id: toastId,
                duration: 4000,
                action: {
                    label: 'Copy Global QR',
                    onClick: () => copyToClipboard(globalQrCode)
                }
            });
            fetchData();
        }
        catch (error) {
            console.error('Error generating all bulk QR codes:', error);
            toast.error('Failed to generate all bulk QR codes', {
                id: toastId,
                duration: 5000,
            });
        }
        finally {
            setGeneratingAllBulk(false);
        }
    };

    // Helper to group parcels by region, city, courier, and date in-memory
    const processSortingParcels = useCallback((parcelsList: Parcel[], preserveExpandedMap?: Map<string, boolean>) => {
        // 1. Group by Region and City
        const regionsMap = new Map<string, Map<string, {
            parcels: Parcel[];
            couriers: Map<string, number>;
            bulkQrCode: string | null;
            bulkQrCity: string | null;
        }>>();

        // 2. Courier stats
        const courierStatsMap = new Map<string, { parcels: Parcel[]; bulkQrCode: string | null }>();

        // 3. Date groups
        const dateGroupsMap = new Map<string, Parcel[]>();

        parcelsList.forEach(parcel => {
            const region = parcel.region || 'Unassigned Region';
            const city = parcel.city || 'Unassigned City';
            const courier = parcel.courier || 'Unassigned Courier';

            // Region & City Map
            if (!regionsMap.has(region)) {
                regionsMap.set(region, new Map());
            }
            const regionCities = regionsMap.get(region)!;
            if (!regionCities.has(city)) {
                regionCities.set(city, {
                    parcels: [],
                    couriers: new Map(),
                    bulkQrCode: parcel.bulk_qr_code || null,
                    bulkQrCity: parcel.bulk_qr_city || null
                });
            }
            const cityData = regionCities.get(city)!;
            cityData.parcels.push(parcel);
            cityData.couriers.set(courier, (cityData.couriers.get(courier) || 0) + 1);
            if (parcel.bulk_qr_code && !cityData.bulkQrCode) cityData.bulkQrCode = parcel.bulk_qr_code;
            if (parcel.bulk_qr_city && !cityData.bulkQrCity) cityData.bulkQrCity = parcel.bulk_qr_city;

            // Courier stats
            if (!courierStatsMap.has(courier)) {
                courierStatsMap.set(courier, { parcels: [], bulkQrCode: parcel.bulk_qr_courier || null });
            }
            const courierData = courierStatsMap.get(courier)!;
            courierData.parcels.push(parcel);
            if (parcel.bulk_qr_courier && !courierData.bulkQrCode) courierData.bulkQrCode = parcel.bulk_qr_courier;

            // Date groups
            const dateStr = new Date(parcel.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            if (!dateGroupsMap.has(dateStr)) {
                dateGroupsMap.set(dateStr, []);
            }
            dateGroupsMap.get(dateStr)!.push(parcel);
        });

        // Convert Region Map to RegionGroup[]
        const regionGroupsData: RegionGroup[] = Array.from(regionsMap.entries()).map(([region, citiesMap]) => {
            const cities: CityGroup[] = Array.from(citiesMap.entries()).map(([city, data]) => ({
                city,
                total: data.parcels.length,
                couriers: Array.from(data.couriers.entries()).map(([name, count]) => ({ name, count })),
                parcels: data.parcels,
                hasBulkQr: Boolean(data.bulkQrCode || data.bulkQrCity),
                bulkQrCode: data.bulkQrCode,
                bulkQrCity: data.bulkQrCity
            }));
            const total = cities.reduce((sum, c) => sum + c.total, 0);
            const isExpanded = preserveExpandedMap?.has(region) ? Boolean(preserveExpandedMap.get(region)) : false;
            return {
                region,
                total,
                cities,
                expanded: isExpanded
            };
        });

        // Convert all cities across regions to CityGroup[] for city view
        const allCitiesMap = new Map<string, {
            parcels: Parcel[];
            couriers: Map<string, number>;
            bulkQrCode: string | null;
            bulkQrCity: string | null;
        }>();
        parcelsList.forEach(parcel => {
            const city = parcel.city || 'Unassigned City';
            const courier = parcel.courier || 'Unassigned Courier';
            if (!allCitiesMap.has(city)) {
                allCitiesMap.set(city, {
                    parcels: [],
                    couriers: new Map(),
                    bulkQrCode: parcel.bulk_qr_code || null,
                    bulkQrCity: parcel.bulk_qr_city || null
                });
            }
            const data = allCitiesMap.get(city)!;
            data.parcels.push(parcel);
            data.couriers.set(courier, (data.couriers.get(courier) || 0) + 1);
            if (parcel.bulk_qr_code && !data.bulkQrCode) data.bulkQrCode = parcel.bulk_qr_code;
            if (parcel.bulk_qr_city && !data.bulkQrCity) data.bulkQrCity = parcel.bulk_qr_city;
        });

        const cityGroupsData: CityGroup[] = Array.from(allCitiesMap.entries()).map(([city, data]) => ({
            city,
            total: data.parcels.length,
            couriers: Array.from(data.couriers.entries()).map(([name, count]) => ({ name, count })),
            parcels: data.parcels,
            hasBulkQr: Boolean(data.bulkQrCode || data.bulkQrCity),
            bulkQrCode: data.bulkQrCode,
            bulkQrCity: data.bulkQrCity
        }));

        // Convert Courier stats to CourierStats[]
        const courierStatsData: CourierStats[] = Array.from(courierStatsMap.entries()).map(([name, data]) => ({
            name,
            count: data.parcels.length,
            parcels: data.parcels,
            hasBulkQr: Boolean(data.bulkQrCode),
            bulkQrCode: data.bulkQrCode
        }));

        // Convert Date groups to GroupedParcel[]
        const groupedArray: GroupedParcel[] = Array.from(dateGroupsMap.entries()).map(([date, parcels]) => ({
            date,
            parcels
        }));

        return {
            regionGroupsData,
            cityGroupsData,
            courierStatsData,
            groupedArray
        };
    }, []);

    // fetch data
    const fetchData = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) {
                setLoading(true);
            }
            const offset = (page - 1) * limit;
            let query = supabase
                .from('parcels')
                .select('*', { count: 'exact' })
                .eq('status', 'received')
                .order('created_at', { ascending: false });

            if (!isPrivileged && currentUserId) {
                query = query.eq('scanned_by', currentUserId);
            }

            if (debouncedSearch) {
                const searchPattern = `%${debouncedSearch}%`;
                query = query.or(`barcode.ilike.${searchPattern},tracking_number.ilike.${searchPattern},destination.ilike.${searchPattern},city.ilike.${searchPattern},customer_name.ilike.${searchPattern},sender_name.ilike.${searchPattern},courier.ilike.${searchPattern}`);
            }
            if (locationCityFilter) {
                query = query.ilike('city', `%${locationCityFilter}%`);
            }
            if (locationRegionFilter) {
                query = query.ilike('region', `%${locationRegionFilter}%`);
            }
            query = query.range(offset, offset + limit - 1);
            const { data: parcelsData, error: parcelsError, count } = await query;
            if (parcelsError)
                throw parcelsError;
            setParcels(parcelsData || []);
            setFilteredParcels(parcelsData || []);
            setTotalItems(count || 0);
            setTotalPages(Math.ceil((count || 0) / limit));
            if (parcelsData) {
                const maps = buildExistingQrMaps(parcelsData);
                setExistingQrCodes(maps);
            }

            let allQuery = supabase
                .from('parcels')
                .select('*')
                .eq('status', 'received')
                .order('created_at', { ascending: false });

            if (!isPrivileged && currentUserId) {
                allQuery = allQuery.eq('scanned_by', currentUserId);
            }

            if (debouncedSearch) {
                const searchPattern = `%${debouncedSearch}%`;
                allQuery = allQuery.or(`barcode.ilike.${searchPattern},tracking_number.ilike.${searchPattern},destination.ilike.${searchPattern},city.ilike.${searchPattern},customer_name.ilike.${searchPattern},sender_name.ilike.${searchPattern},courier.ilike.${searchPattern}`);
            }

            if (locationCityFilter) {
                allQuery = allQuery.ilike('city', `%${locationCityFilter}%`);
            }
            if (locationRegionFilter) {
                allQuery = allQuery.ilike('region', `%${locationRegionFilter}%`);
            }
            const { data: allParcels, error: allError } = await allQuery;
            if (allError)
                throw allError;

            let citiesQuery = supabase
                .from('parcels')
                .select('city')
                .eq('status', 'received')
                .not('city', 'is', null);

            if (!isPrivileged && currentUserId) {
                citiesQuery = citiesQuery.eq('scanned_by', currentUserId);
            }

            const { data: allCitiesData } = await citiesQuery;
            const cities = [...new Set((allCitiesData || []).map(p => p.city).filter(Boolean))] as string[];
            setAllCities(cities.sort());

            let regionsQuery = supabase
                .from('parcels')
                .select('region')
                .eq('status', 'received')
                .not('region', 'is', null);

            if (!isPrivileged && currentUserId) {
                regionsQuery = regionsQuery.eq('scanned_by', currentUserId);
            }

            const { data: allRegionsData } = await regionsQuery;
            const regions = [...new Set((allRegionsData || []).map(p => p.region).filter(Boolean))] as string[];
            setAllRegions(regions.sort());

            setAllParcelsList(allParcels || []);
            const derived = processSortingParcels(allParcels || []);
            setRegionGroups(derived.regionGroupsData);
            setCityGroups(derived.cityGroupsData);
            setCourierStats(derived.courierStatsData);
            setGroupedParcels(derived.groupedArray);
            if (locationCityFilter) {
                setViewMode("city");
            }
            else if (locationRegionFilter) {
                setViewMode("region");
            }
        }
        catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load sorting data');
        }
        finally {
            if (showLoading) {
                setLoading(false);
            }
            setInitialLoading(false);
        }
    }, [page, debouncedSearch, locationRegionFilter, locationCityFilter, buildExistingQrMaps, processSortingParcels, isPrivileged, currentUserId]);

    // Smooth Realtime Handler - updates in-memory state without re-fetching or page refreshing!
    const handleRealtimeParcelChange = useCallback((payload: any) => {
        const eventType = payload.eventType;
        const newRecord = payload.new as Parcel;
        const oldRecord = payload.old as { id: number };

        if (!isPrivileged && currentUserId && newRecord) {
            if (newRecord.scanned_by?.toLowerCase() !== currentUserId.toLowerCase()) {
                if (eventType === 'UPDATE') {
                    setAllParcelsList(prevAll => {
                        const nextAll = prevAll.filter(p => p.id !== newRecord.id);
                        setRegionGroups(prevRegions => {
                            const preserveMap = new Map(prevRegions.map(r => [r.region, r.expanded]));
                            const derived = processSortingParcels(nextAll, preserveMap);
                            setCityGroups(derived.cityGroupsData);
                            setCourierStats(derived.courierStatsData);
                            setGroupedParcels(derived.groupedArray);
                            return derived.regionGroupsData;
                        });
                        setFilteredParcels(prev => prev.filter(p => p.id !== newRecord.id));
                        setParcels(prev => prev.filter(p => p.id !== newRecord.id));
                        setTotalItems(nextAll.length);
                        return nextAll;
                    });
                }
                return;
            }
        }

        setAllParcelsList(prevAll => {
            let nextAll: Parcel[];
            if (eventType === 'INSERT') {
                if (!newRecord || newRecord.status !== 'received') return prevAll;
                if (prevAll.some(p => p.id === newRecord.id)) {
                    nextAll = prevAll.map(p => p.id === newRecord.id ? { ...p, ...newRecord } : p);
                } else {
                    nextAll = [newRecord, ...prevAll];
                    toast.info(`New parcel received in sorting: ${newRecord.barcode || newRecord.tracking_number || newRecord.id}`, { duration: 3000 });
                }
            } else if (eventType === 'UPDATE') {
                if (!newRecord) return prevAll;
                if (newRecord.status !== 'received') {
                    nextAll = prevAll.filter(p => p.id !== newRecord.id);
                } else {
                    if (prevAll.some(p => p.id === newRecord.id)) {
                        nextAll = prevAll.map(p => p.id === newRecord.id ? { ...p, ...newRecord } : p);
                    } else {
                        nextAll = [newRecord, ...prevAll];
                    }
                }
            } else if (eventType === 'DELETE') {
                if (!oldRecord?.id) return prevAll;
                nextAll = prevAll.filter(p => p.id !== oldRecord.id);
            } else {
                return prevAll;
            }

            // In-memory recomputation of all grouping views - zero flicker, zero page refresh!
            setRegionGroups(prevRegions => {
                const preserveMap = new Map(prevRegions.map(r => [r.region, r.expanded]));
                const derived = processSortingParcels(nextAll, preserveMap);
                setCityGroups(derived.cityGroupsData);
                setCourierStats(derived.courierStatsData);
                setGroupedParcels(derived.groupedArray);
                return derived.regionGroupsData;
            });

            setFilteredParcels(prevFiltered => {
                if (eventType === 'INSERT') {
                    if (!newRecord || newRecord.status !== 'received') return prevFiltered;
                    if (prevFiltered.some(p => p.id === newRecord.id)) return prevFiltered;
                    return [newRecord, ...prevFiltered];
                } else if (eventType === 'UPDATE') {
                    if (!newRecord || newRecord.status !== 'received') {
                        return prevFiltered.filter(p => p.id !== newRecord?.id);
                    }
                    return prevFiltered.map(p => p.id === newRecord.id ? { ...p, ...newRecord } : p);
                } else if (eventType === 'DELETE') {
                    return prevFiltered.filter(p => p.id !== oldRecord?.id);
                }
                return prevFiltered;
            });

            setParcels(prevParcels => {
                if (eventType === 'INSERT') {
                    if (!newRecord || newRecord.status !== 'received') return prevParcels;
                    if (prevParcels.some(p => p.id === newRecord.id)) return prevParcels;
                    return [newRecord, ...prevParcels];
                } else if (eventType === 'UPDATE') {
                    if (!newRecord || newRecord.status !== 'received') {
                        return prevParcels.filter(p => p.id !== newRecord?.id);
                    }
                    return prevParcels.map(p => p.id === newRecord.id ? { ...p, ...newRecord } : p);
                } else if (eventType === 'DELETE') {
                    return prevParcels.filter(p => p.id !== oldRecord?.id);
                }
                return prevParcels;
            });

            setTotalItems(nextAll.length);
            return nextAll;
        });
    }, [processSortingParcels, isPrivileged, currentUserId]);

    useEffect(() => {
        fetchData(true);
    }, [fetchData]);

    useEffect(() => {
        const subscription = supabase
            .channel('sorting_tab_realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'parcels',
            }, (payload) => {
                handleRealtimeParcelChange(payload);
            })
            .subscribe();
        return () => {
            subscription.unsubscribe();
        };
    }, [handleRealtimeParcelChange]); // toggle region
    const toggleRegion = (regionName: string) => {
        setRegionGroups(prev => prev.map(region => region.region === regionName
            ? { ...region, expanded: !region.expanded }
            : region));
    }; // expand all
    const expandAllRegions = () => {
        setRegionGroups(prev => prev.map(region => ({
            ...region,
            expanded: true
        })));
    }; // collapse all
    const collapseAllRegions = () => {
        setRegionGroups(prev => prev.map(region => ({
            ...region,
            expanded: false
        })));
    }; // show city
    const handleViewCityParcels = (city: string, parcels: Parcel[]) => {
        setSelectedParcels(parcels);
        setShowModal(true);
    }; // show courier
    const handleViewCourierParcels = (courierName: string) => {
        const courier = courierStats.find(c => c.name === courierName);
        if (courier) {
            setCourierParcels(courier.parcels);
            setSelectedCourier(courierName);
            setShowCourierModal(true);
        }
    }; // view parcel
    const handleViewParcel = (parcel: Parcel) => {
        setViewParcel(parcel);
        setShowViewModal(true);
    };

    // check if current user can delete a parcel (Admin/Manager/Executive can delete any; Operator can only delete their own scanned parcels)
    const canDeleteParcel = useCallback((parcel: Parcel) => {
        if (isPrivileged) return true;
        if (!currentUserId) return false;
        return parcel.scanned_by?.toLowerCase() === currentUserId.toLowerCase();
    }, [isPrivileged, currentUserId]);

    // delete
    const handleDeleteParcel = async (parcelId: number, barcode: string) => {
        const confirmed = await confirm({
            title: "Delete Parcel",
            message: `Are you sure you want to delete parcel ${barcode}? This action cannot be undone.`,
            confirmText: "Delete",
            cancelText: "Cancel",
            confirmVariant: "danger",
        });
        if (!confirmed)
            return;
        const toastId = toast.loading('Deleting parcel...');
        try {
            const { error } = await supabase
                .from('parcels')
                .delete()
                .eq('id', parcelId);
            if (error)
                throw error;
            toast.success(`Parcel ${barcode} deleted successfully!`, {
                id: toastId,
                duration: 3000,
            }); // remove selected
            setSelectedParcelIds(prev => {
                const updated = new Set(prev);
                updated.delete(parcelId);
                return updated;
            });
            fetchData();
        }
        catch (error) {
            console.error('Error deleting parcel:', error);
            toast.error('Failed to delete parcel', {
                id: toastId,
                duration: 5000,
            });
        }
    }; // bulk delete
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
        if (!confirmed)
            return;
        setDeleting(true);
        const toastId = toast.loading(`Deleting ${selectedParcelIds.size} parcels...`);
        try {
            const ids = Array.from(selectedParcelIds);
            const { error } = await supabase
                .from('parcels')
                .delete()
                .in('id', ids);
            if (error)
                throw error;
            toast.success(`Successfully deleted ${ids.length} parcels!`, {
                id: toastId,
                duration: 3000,
            });
            setSelectedParcelIds(new Set());
            fetchData();
        }
        catch (error) {
            console.error('Error deleting parcels:', error);
            toast.error('Failed to delete parcels', {
                id: toastId,
                duration: 5000,
            });
        }
        finally {
            setDeleting(false);
        }
    }; // select all
    const allParcelsInGroups = useMemo(() => {
        const list: Parcel[] = [];
        groupedParcels.forEach(g => {
            list.push(...g.parcels);
        });
        return list;
    }, [groupedParcels]);

    const selectableParcels = useMemo(() => {
        return allParcelsInGroups.filter(canDeleteParcel);
    }, [allParcelsInGroups, canDeleteParcel]);

    const totalGroupedParcelsCount = allParcelsInGroups.length;
    const selectableCount = selectableParcels.length;

    const isAllSelected = useMemo(() => {
        if (selectableCount === 0) return false;
        return selectableParcels.every((p: Parcel) => selectedParcelIds.has(p.id));
    }, [selectableParcels, selectedParcelIds, selectableCount]);

    const isSomeSelected = useMemo(() => {
        return selectedParcelIds.size > 0 && !isAllSelected;
    }, [selectedParcelIds, isAllSelected]);

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = new Set<number>();
            const listToSelect = allParcelsList.length > 0 ? allParcelsList : allParcelsInGroups;
            listToSelect.filter(canDeleteParcel).forEach((p: Parcel) => allIds.add(p.id));
            filteredParcels.filter(canDeleteParcel).forEach((p: Parcel) => allIds.add(p.id));
            setSelectedParcelIds(allIds);
        }
        else {
            setSelectedParcelIds(new Set());
        }
    }; // select one
    const handleSelectParcel = (id: number, checked: boolean) => {
        const newSelected = new Set(selectedParcelIds);
        if (checked) {
            newSelected.add(id);
        }
        else {
            newSelected.delete(id);
        }
        setSelectedParcelIds(newSelected);
    }; // page nav
    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
        }
    }; // badge color
    const getCourierColor = (name: string, index: number): string => {
        const colors: {
            [key: string]: string;
        } = {
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
    }; // city qr
    const handleGenerateCityBulkQr = async (city: string, parcels: Parcel[]) => {
        if (parcels.length === 0) {
            toast.warning('No parcels in this city');
            return;
        }
        const allHaveBulkQr = parcels.every(p => p.bulk_qr_city);
        if (allHaveBulkQr) {
            toast.info(`All parcels in ${city} already have city bulk QR codes`, { duration: 3000 });
            return;
        } // reuse city qr
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
                    if (error)
                        throw error;
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
                }
                catch (error) {
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
        if (!confirmed)
            return;
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
            if (error)
                throw error;
            toast.success(`City bulk QR generated for ${parcels.length} parcels in ${city}!`, {
                id: toastId,
                duration: 4000,
                action: {
                    label: 'Copy QR',
                    onClick: () => copyToClipboard(bulkQrCode)
                }
            });
            fetchData();
        }
        catch (error) {
            console.error('Error generating city bulk QR:', error);
            toast.error('Failed to generate city bulk QR code', {
                id: toastId,
                duration: 5000,
            });
        }
        finally {
            setGeneratingBulk(false);
        }
    }; // courier qr
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
        } // reuse courier qr
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
                    if (error)
                        throw error;
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
                }
                catch (error) {
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
        if (!confirmed)
            return;
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
            if (error)
                throw error;
            toast.success(`Courier bulk QR generated for ${courier.parcels.length} parcels (${courierName})!`, {
                id: toastId,
                duration: 4000,
                action: {
                    label: 'Copy QR',
                    onClick: () => copyToClipboard(bulkQrCode)
                }
            });
            fetchData();
        }
        catch (error) {
            console.error('Error generating courier bulk QR:', error);
            toast.error('Failed to generate courier bulk QR code', {
                id: toastId,
                duration: 5000,
            });
        }
        finally {
            setGeneratingBulk(false);
        }
    }; // bulk qr modal
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
        if (!confirmed)
            return;
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
            if (error)
                throw error;
            toast.success(`Bulk QR generated for ${selectedParcels.length} parcels!`, {
                id: toastId,
                duration: 4000,
                action: {
                    label: 'Copy QR',
                    onClick: () => copyToClipboard(bulkQrCode)
                }
            });
            fetchData();
        }
        catch (error) {
            console.error('Error generating bulk QR:', error);
            toast.error('Failed to generate bulk QR code', {
                id: toastId,
                duration: 5000,
            });
        }
        finally {
            setGeneratingBulk(false);
        }
    }; // copy qr
    const handleCopyTableQr = (text: string | null | undefined, e: React.MouseEvent) => {
        e.stopPropagation();
        if (text) {
            copyToClipboard(text);
        }
    };
    if (initialLoading) {
        return (<div data-panel="sorting" className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                <div className="space-y-5">{/* header skeleton */}
                    <div className="flex flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                            <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
                            <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div>
                            <div className="h-10 w-10 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                        </div>
                    </div>{/* search skeleton */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        <div className="relative flex-1 min-w-[180px]">
                            <div className="h-10 w-full bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                        </div>
                        <div className="h-10 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                        <div className="h-10 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                        <div className="h-10 w-48 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                    </div>{/* cards skeleton */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (<div key={i} className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-6 w-6 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
                                        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                                    </div>
                                    <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div>
                                </div>
                                <div className="space-y-2.5">
                                    {[1, 2, 3].map((j) => (<div key={j} className="space-y-1">
                                            <div className="flex justify-between">
                                                <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                                                <div className="h-3 w-8 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div>
                                        </div>))}
                                </div>
                            </div>))}
                    </div>{/* table skeleton */}
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
                                {[1, 2, 3, 4, 5].map((i) => (<div key={i} className="flex items-center gap-4">
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
                                    </div>))}
                            </div>
                        </div>
                    </div>{/* courier skeleton */}
                    <div className="text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="h-7 w-7 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
                            <div className="h-5 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:gap-4">
                            {[1, 2, 3, 4].map((i) => (<div key={i} className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                                        <div className="h-5 w-8 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div>
                                    </div>
                                    <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                                    <div className="mt-4 flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                        <div className="h-8 w-full bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
                                        <div className="h-8 w-full bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
                                    </div>
                                </div>))}
                        </div>
                    </div>
                </div>
            </div>);
    }
    const displayData = viewMode === "city" ? cityGroups : regionGroups;
    return (<div data-panel="sorting" className="p-4 sm:p-6 space-y-4 sm:space-y-6">
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
                        <button type="button" onClick={() => fetchData(true)} disabled={loading} aria-label="Refresh data" className="p-2 rounded-xl text-slate-500 hover:text-pink-600 dark:text-slate-400 dark:hover:text-pink-400 bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200/70 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 transition-all cursor-pointer disabled:opacity-60">
                            <i className={`fas fa-sync-alt text-xs ${loading ? 'fa-spin text-pink-500' : ''}`}></i>
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative flex-1 min-w-[180px]">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
                            {loading || searchTerm !== debouncedSearch ? (
                                <i className="fas fa-spinner fa-spin text-pink-500 text-xs"></i>
                            ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                                </svg>
                            )}
                        </div>
                        <input type="text" className="w-full h-10 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl pl-9 pr-8 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.35),inset_-1px_-1px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 dark:focus:border-pink-500 transition-all font-medium" placeholder="Search by barcode, tracking, or destination..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
                        {searchTerm && (<button type="button" onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-[#e8edf5] dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </button>)}
                    </div>

                    <div className="relative">
                        <select className="appearance-none bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] focus:outline-none focus:border-pink-500 transition-all cursor-pointer min-w-[130px]" value={locationRegionFilter} onChange={(e) => {
            setLocationRegionFilter(e.target.value);
            setLocationCityFilter('');
        }}>
                            <option value="" className="dark:bg-slate-900 dark:text-slate-200">All Regions</option>
                            {allRegions.map((region) => (<option key={region} value={region} className="dark:bg-slate-900 dark:text-slate-200">
                                    {region}
                                </option>))}
                        </select>
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                            </svg>
                        </div>
                    </div>

                    <div className="relative">
                        <select className="appearance-none bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] focus:outline-none focus:border-pink-500 transition-all cursor-pointer min-w-[130px]" value={locationCityFilter} onChange={(e) => {
            setLocationCityFilter(e.target.value);
            if (e.target.value) {
                setLocationRegionFilter('');
            }
        }}>
                            <option value="" className="dark:bg-slate-900 dark:text-slate-200">All Cities</option>
                            {allCities.map((city) => (<option key={city} value={city} className="dark:bg-slate-900 dark:text-slate-200">
                                    {city}
                                </option>))}
                        </select>
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                            </svg>
                        </div>
                    </div>

                    <AppButton
                        type="button"
                        variant="neutral"
                        size="md"
                        onClick={() => handleSelectAll(!isAllSelected)}
                        disabled={selectableCount === 0}
                        title={selectableCount === 0 ? "No parcels available to select" : isAllSelected ? "Deselect all parcels across all dates" : "Bulk select all parcels across all dates"}
                    >
                        <i className={`fas ${isAllSelected ? 'fa-check-square' : isSomeSelected ? 'fa-minus-square text-pink-500' : 'fa-square'}`} />
                        <span>{isAllSelected ? `Deselect All (${selectedParcelIds.size})` : `Bulk Select All (${selectableCount})`}</span>
                    </AppButton>

                    <AppButton
                        type="button"
                        variant="success"
                        size="md"
                        onClick={handleGenerateAllBulkQr}
                        disabled={generatingAllBulk || (allParcelsList.length === 0 && parcels.length === 0) || allHaveAllQr()}
                    >
                        {generatingAllBulk ? (<>
                                <i className="fas fa-spinner fa-spin"/>
                                <span>Generating...</span>
                            </>) : allHaveAllQr() ? (<>
                                <i className="fas fa-check-circle"/>
                                <span>{selectedParcelIds.size > 0 ? "Selected QR Ready" : "All QR Ready"}</span>
                            </>) : (<>
                                <i className="fas fa-qrcode"/>
                                <span>{selectedParcelIds.size > 0 ? `Generate QR for Selected (${selectedParcelIds.size})` : "Generate All QR (Global, City, Courier)"}</span>
                            </>)}
                    </AppButton>

                    {selectedParcelIds.size > 0 && (<AppButton type="button" variant="danger" size="md" onClick={handleBulkDelete} disabled={deleting}>
                            {deleting ? (<i className="fas fa-spinner fa-spin"/>) : (<i className="fas fa-trash"/>)}
                            <span>Delete {selectedParcelIds.size}</span>
                        </AppButton>)}
                </div>

                <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <svg className="w-4 h-4 text-pink-500 dark:text-pink-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                                </svg>
                                {viewMode === "city" ? "City Distribution" : "Destination Distribution"}
                            </h2>
                            {viewMode === "region" && regionGroups.length > 0 && (<div className="inline-flex items-center gap-1 rounded-full bg-slate-50 dark:bg-slate-900 p-1 border border-slate-200/90 dark:border-slate-800 shadow-[inset_0_1px_0_#ffffff,0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)]">
                                    <button type="button" onClick={expandAllRegions} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-pink-600 dark:text-pink-400 transition-all hover:bg-white dark:hover:bg-slate-800 hover:text-pink-700 dark:hover:text-pink-300 hover:shadow-xs cursor-pointer active:scale-95">
                                        <i className="fas fa-angles-down text-[9px]"></i>
                                        <span>Expand All</span>
                                    </button>

                                    <span className="h-3 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true"/>

                                    <button type="button" onClick={collapseAllRegions} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 transition-all hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 hover:shadow-xs cursor-pointer active:scale-95">
                                        <i className="fas fa-angles-up text-[9px]"></i>
                                        <span>Collapse All</span>
                                    </button>
                                </div>)}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                {viewMode === "city" ? `${cityGroups.length} cities` : `${regionGroups.length} regions`}
                            </span>
                            {viewMode === "region" && (<span className="text-xs text-slate-400 dark:text-slate-500">
                                    ({regionGroups.filter(r => r.expanded).length} expanded)
                                </span>)}
                        </div>
                    </div>

                    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4 transition-opacity duration-200 ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
                        {displayData.length > 0 ? (viewMode === "city" ? ((displayData as CityGroup[]).map((city) => (<div key={city.city} className="group relative flex flex-col justify-between rounded-2xl border border-white/80 dark:border-[#2c2d3c] bg-[#f0f3f8] dark:bg-[#191a24] p-4 shadow-[4px_4px_12px_rgba(166,175,195,0.35),-4px_-4px_12px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_14px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.03)] transition-all duration-200 hover:-translate-y-0.5">
                                        <div>
                                            <div className="flex items-center justify-between gap-2 mb-3">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-500 dark:text-pink-400">
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                                                        </svg>
                                                    </div>
                                                    <span className="font-bold text-slate-900 dark:text-white text-sm truncate" title={city.city}>
                                                        {city.city}
                                                    </span>
                                                </div>
                                                <StatusBadge tone="pink" size="xs">
                                                    {city.total} total
                                                </StatusBadge>
                                            </div>

                                            <div className="space-y-2.5 my-2">
                                                {city.couriers.length > 0 ? (city.couriers.map((courier, idx) => {
                const percentage = city.total > 0 ? Math.min(100, Math.max(0, (courier.count / city.total) * 100)) : 0;
                const barColor = getCourierColor(courier.name, idx);
                return (<div key={courier.name} className="space-y-1">
                                                                <div className="flex justify-between items-center text-xs">
                                                                    <span className="font-medium text-slate-600 dark:text-slate-400 truncate mr-2">{courier.name}</span>
                                                                    <span className="font-bold text-slate-800 dark:text-slate-200 shrink-0">{courier.count}</span>
                                                                </div>
                                                                <div className="w-full bg-[#ebf0f7] dark:bg-[#14151c] rounded-full h-1.5 overflow-hidden shadow-[inset_1px_1px_2px_rgba(0,0,0,0.15)]">
                                                                    <div className={`${barColor} h-full rounded-full transition-all duration-500 ease-out`} style={{ width: `${percentage}%` }}/>
                                                                </div>
                                                            </div>);
            })) : (<div className="text-xs text-slate-400 dark:text-slate-500 py-2 italic text-center rounded-lg bg-[#ebf0f7]/60 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800">
                                                        No courier assigned
                                                    </div>)}
                                            </div>

                                            {city.bulkQrCity && (<div className="mt-2 flex items-center justify-between rounded-lg bg-[#ebf0f7] dark:bg-[#14151c] px-2.5 py-1.5 border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.2)]">
                                                    <span className="truncate text-[10px] font-mono font-medium text-slate-600 dark:text-slate-400 max-w-[130px]">
                                                        {city.bulkQrCity}
                                                    </span>
                                                    <button type="button" onClick={() => copyToClipboard(city.bulkQrCity!)} className="group/cardcityqr inline-flex items-center rounded-full p-1.5 text-[10px] font-mono font-semibold bg-[#e0f2fe] hover:bg-[#bae6fd] text-sky-900 border border-sky-300/90 shadow-[0_2px_6px_rgba(14,165,233,0.16),inset_0_1px_0_#ffffff] dark:bg-[#0c2a3a] dark:hover:bg-[#13374b] dark:text-sky-200 dark:border-[#1b4e68] dark:shadow-[0_3px_8px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all duration-300 ease-in-out cursor-pointer active:scale-95" title="Copy City QR">
                                                        <Clipboard className="w-3.5 h-3.5 shrink-0 text-sky-600 dark:text-sky-400"/>
                                                        <span className="max-w-0 overflow-hidden opacity-0 group-hover/cardcityqr:max-w-[120px] group-hover/cardcityqr:opacity-100 group-hover/cardcityqr:ml-1.5 transition-all duration-300 ease-in-out whitespace-nowrap font-bold">
                                                            {city.bulkQrCity}
                                                        </span>
                                                    </button>
                                                </div>)}
                                        </div>

                                        <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2">
                                            <button type="button" onClick={() => handleViewCityParcels(city.city, city.parcels)} className="group/viewcity inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold bg-[#ffe6f0] hover:bg-[#ffd9e8] text-pink-700 border border-pink-300/90 shadow-[0_2px_6px_rgba(244,63,94,0.16),inset_0_1px_0_#ffffff] dark:bg-[#341427] dark:hover:bg-[#421932] dark:text-pink-200 dark:border-[#67224c] dark:shadow-[0_3px_8px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all duration-300 ease-in-out cursor-pointer active:scale-95" title="View parcels">
                                                <Eye className="w-3.5 h-3.5 shrink-0 text-pink-600 dark:text-pink-400"/>
                                                <span className="max-w-0 overflow-hidden opacity-0 group-hover/viewcity:max-w-[100px] group-hover/viewcity:opacity-100 group-hover/viewcity:ml-1.5 transition-all duration-300 ease-in-out whitespace-nowrap font-bold">
                                                    View parcels
                                                </span>
                                            </button>

                                            <div className="flex items-center gap-1.5">
                                                <StatusBadge tone={city.hasBulkQr ? 'emerald' : 'neutral'} icon={city.hasBulkQr ? 'fas fa-check-circle' : 'fas fa-qrcode'} size="xs" interactive={!city.hasBulkQr} disabled={generatingBulk || city.parcels.length === 0 || city.hasBulkQr} onClick={() => handleGenerateCityBulkQr(city.city, city.parcels)}>
                                                    {city.hasBulkQr ? 'City QR Ready' : 'City Bulk QR'}
                                                </StatusBadge>
                                            </div>
                                        </div>
                                    </div>))) : ((displayData as RegionGroup[]).map((region) => (<div key={region.region} className="h-fit rounded-2xl border border-white/80 dark:border-[#2c2d3c] bg-[#f0f3f8] dark:bg-[#191a24] shadow-[4px_4px_12px_rgba(166,175,195,0.35),-4px_-4px_12px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_14px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.03)] transition-all duration-200 overflow-hidden">
                                        <div className="flex items-center justify-between p-3.5 cursor-pointer bg-[#f0f3f8] dark:bg-[#191a24] hover:bg-[#e8edf5] dark:hover:bg-[#20212f] transition-colors select-none" onClick={() => toggleRegion(region.region)}>
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#ebf0f7] dark:bg-[#14151c] text-slate-500 dark:text-slate-400 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3)]">
                                                    <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${region.expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
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
                                                <StatusBadge tone="pink" size="xs">
                                                    {region.total}
                                                </StatusBadge>
                                            </div>
                                        </div>

                                        <AnimatedRegionContent region={region}>
                                            <div className="p-2 pt-0 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/40">
                                                <div className="space-y-1 pt-1.5">
                                                    {region.cities.map((city) => (<div key={city.city} className="flex items-center justify-between gap-2 rounded-xl p-2 hover:bg-white dark:hover:bg-slate-800 hover:shadow-xs transition-all border border-transparent hover:border-slate-200/60 dark:hover:border-slate-700/60 group/city">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate">
                                                                    {city.city}
                                                                </span>
                                                                <StatusBadge tone="neutral" size="xs">
                                                                    {city.total}
                                                                </StatusBadge>
                                                            </div>

                                                            <div className="flex items-center gap-1 shrink-0">
                                                                 <button type="button" onClick={() => handleViewCityParcels(city.city, city.parcels)} className="group/viewregioncity inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#ffe6f0] hover:bg-[#ffd9e8] text-pink-700 border border-pink-300/90 shadow-[0_2px_6px_rgba(244,63,94,0.16),inset_0_1px_0_#ffffff] dark:bg-[#341427] dark:hover:bg-[#421932] dark:text-pink-200 dark:border-[#67224c] dark:shadow-[0_3px_8px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all duration-300 ease-in-out cursor-pointer active:scale-95" title="View parcels">
                                                                     <Eye className="w-3 h-3 shrink-0 text-pink-600 dark:text-pink-400"/>
                                                                     <span className="max-w-0 overflow-hidden opacity-0 group-hover/viewregioncity:max-w-[80px] group-hover/viewregioncity:opacity-100 group-hover/viewregioncity:ml-1 transition-all duration-300 ease-in-out whitespace-nowrap font-bold">
                                                                         View
                                                                     </span>
                                                                 </button>
                                                                <StatusBadge tone={city.hasBulkQr ? 'emerald' : 'neutral'} icon={city.hasBulkQr ? 'fas fa-check-circle' : 'fas fa-qrcode'} size="xs" interactive={!city.hasBulkQr} disabled={generatingBulk || city.parcels.length === 0 || city.hasBulkQr} onClick={() => handleGenerateCityBulkQr(city.city, city.parcels)}>
                                                                    {city.hasBulkQr ? 'QR' : 'City QR'}
                                                                </StatusBadge>
                                                                {city.bulkQrCity && (<button type="button" onClick={() => copyToClipboard(city.bulkQrCity!)} className="group/regioncityqr inline-flex items-center rounded-full p-1.5 text-[10px] font-mono font-semibold bg-[#e0f2fe] hover:bg-[#bae6fd] text-sky-900 border border-sky-300/90 shadow-[0_2px_6px_rgba(14,165,233,0.16),inset_0_1px_0_#ffffff] dark:bg-[#0c2a3a] dark:hover:bg-[#13374b] dark:text-sky-200 dark:border-[#1b4e68] dark:shadow-[0_3px_8px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all duration-300 ease-in-out cursor-pointer active:scale-95" title="Copy City QR">
                                                                        <Clipboard className="w-3.5 h-3.5 shrink-0 text-sky-600 dark:text-sky-400"/>
                                                                        <span className="max-w-0 overflow-hidden opacity-0 group-hover/regioncityqr:max-w-[120px] group-hover/regioncityqr:opacity-100 group-hover/regioncityqr:ml-1.5 transition-all duration-300 ease-in-out whitespace-nowrap font-bold">
                                                                            {city.bulkQrCity}
                                                                        </span>
                                                                    </button>)}
                                                            </div>
                                                        </div>))}
                                                </div>
                                            </div>
                                        </AnimatedRegionContent>
                                    </div>)))) : (<div className="col-span-full relative overflow-hidden rounded-3xl border border-white/80 dark:border-[#2c2d3c] bg-[#f0f3f8] dark:bg-[#191a24] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] py-12 px-6 text-center">
                                 <div className="relative z-10 max-w-sm mx-auto space-y-3">
                                     <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] text-pink-600 dark:text-pink-400 border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] mx-auto">
                                         <i className="fas fa-map-marked-alt text-xl"></i>
                                     </div>
                                     <div className="space-y-1">
                                         <h4 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">No Destination Groups Found</h4>
                                         <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                                             {searchTerm || locationRegionFilter || locationCityFilter 
                                                 ? 'No destinations match the active search or location filters.'
                                                 : 'No received parcels currently awaiting destination assignment.'}
                                         </p>
                                     </div>
                                     {(searchTerm || locationRegionFilter || locationCityFilter) && (
                                         <button
                                             onClick={() => {
                                                 setSearchTerm('');
                                                 setLocationRegionFilter('');
                                                 setLocationCityFilter('');
                                             }}
                                             className="inline-flex items-center gap-2 rounded-2xl bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-800 dark:text-slate-200 border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:shadow-[1px_1px_3px_rgba(166,175,195,0.5),-1px_-1px_3px_rgba(255,255,255,0.9)] px-3.5 py-2 text-xs font-bold transition-all cursor-pointer active:scale-95"
                                         >
                                             <i className="fas fa-undo-alt text-[10px]"></i>
                                             <span>Clear all filters</span>
                                         </button>
                                     )}
                                 </div>
                             </div>)}
                    </div>
                </div>                {/* container */}
                <div className="flex-1 overflow-y-auto max-h-[600px] p-4 space-y-5 bg-[#ebf0f7]/40 dark:bg-[#12131b]/30 rounded-3xl border border-white/70 dark:border-white/[0.04]">
                    {!loading && groupedParcels.length > 0 && (
                        <div className="flex items-center justify-between px-5 py-3 rounded-2xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[4px_4px_12px_rgba(166,175,195,0.3),-4px_-4px_12px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_14px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.03)] transition-colors">
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="bulk-select-all-warehousing"
                                    checked={isAllSelected}
                                    disabled={selectableCount === 0}
                                    ref={(el) => {
                                        if (el) el.indeterminate = isSomeSelected;
                                    }}
                                    onChange={(e) => handleSelectAll(e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent disabled:opacity-35 disabled:cursor-not-allowed"
                                    title={selectableCount === 0 ? "No parcels available to select" : undefined}
                                />
                                <label htmlFor="bulk-select-all-warehousing" className={`text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 ${selectableCount === 0 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                                    <span>Select All Parcels Across All Dates</span>
                                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-[#ebf0f7] dark:bg-[#12131b] px-2.5 py-0.5 rounded-full border border-white/80 dark:border-white/[0.05]">
                                        {selectableCount} selectable / {totalGroupedParcelsCount} total ({groupedParcels.length} {groupedParcels.length === 1 ? 'date group' : 'date groups'})
                                    </span>
                                </label>
                            </div>
                            <div className="flex items-center gap-3">
                                {selectedParcelIds.size > 0 && (
                                    <span className="text-xs font-bold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/40 px-2.5 py-1 rounded-full border border-pink-200 dark:border-pink-800/40">
                                        {selectedParcelIds.size} of {selectableCount} selected
                                    </span>
                                )}
                                <button
                                    type="button"
                                    disabled={selectableCount === 0}
                                    onClick={() => handleSelectAll(!isAllSelected)}
                                    className="text-xs font-bold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 transition-colors px-3 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.3),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.6)] cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {isAllSelected ? 'Deselect All' : 'Select All Dates'}
                                </button>
                            </div>
                        </div>
                    )}
                    {loading ? (<TableContentLoader />) : groupedParcels.length > 0 ? (groupedParcels.map((group) => {
                            const groupSelectable = group.parcels.filter(canDeleteParcel);
                            const isGroupAllSelected = groupSelectable.length > 0 && groupSelectable.every(p => selectedParcelIds.has(p.id));
                            return (<div key={group.date} className="rounded-3xl border border-white/90 dark:border-white/[0.08] overflow-hidden shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-4px_-4px_12px_rgba(255,255,255,0.03)] bg-[#f0f3f8] dark:bg-[#161722] transition-colors">{/* date header */}
                                <div className="bg-[#ebf0f7]/90 dark:bg-[#12131b]/90 px-5 py-3.5 border-b border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={isGroupAllSelected}
                                            disabled={groupSelectable.length === 0}
                                            title={groupSelectable.length === 0 ? "No parcels in this group scanned by you" : undefined}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                const ids = groupSelectable.map(p => p.id);
                                                const newSelected = new Set(selectedParcelIds);
                                                if (checked) {
                                                    ids.forEach(id => newSelected.add(id));
                                                }
                                                else {
                                                    ids.forEach(id => newSelected.delete(id));
                                                }
                                                setSelectedParcelIds(newSelected);
                                            }}
                                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent disabled:opacity-35 disabled:cursor-not-allowed"
                                        />
                                        <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                            <span className="w-7 h-7 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.35),inset_-1px_-1px_2px_rgba(255,255,255,0.9)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.6)] inline-flex items-center justify-center text-pink-500 dark:text-pink-400 text-xs">
                                                <i className="fas fa-calendar-day"></i>
                                            </span>
                                            {group.date}
                                        </h3>
                                    </div>
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-[#ebf0f7] dark:bg-[#12131b] px-3 py-1 rounded-full border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                        {groupSelectable.length < group.parcels.length ? `${groupSelectable.length}/${group.parcels.length} selectable` : `${group.parcels.length} ${group.parcels.length === 1 ? 'parcel' : 'parcels'}`}
                                    </span>
                                </div>{/* table */}
                                <div className="overflow-x-auto">
                                    <table className="table-pro w-full">
                                        <thead>
                                            <tr className="bg-[#ebf0f7]/70 dark:bg-[#12131b]/60 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider font-extrabold border-b border-slate-200/60 dark:border-white/[0.04]">
                                                <th className="w-10 text-center py-3.5 px-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={isGroupAllSelected}
                                                        disabled={groupSelectable.length === 0}
                                                        title={groupSelectable.length === 0 ? "No parcels in this group scanned by you" : undefined}
                                                        onChange={(e) => {
                                                            const checked = e.target.checked;
                                                            const ids = groupSelectable.map(p => p.id);
                                                            const newSelected = new Set(selectedParcelIds);
                                                            if (checked) {
                                                                ids.forEach(id => newSelected.add(id));
                                                            }
                                                            else {
                                                                ids.forEach(id => newSelected.delete(id));
                                                            }
                                                            setSelectedParcelIds(newSelected);
                                                        }}
                                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent disabled:opacity-35 disabled:cursor-not-allowed"
                                                    />
                                                </th>
                                                <th className="w-10 text-center py-3.5 px-4">#</th>
                                                <th className="py-3.5 px-4">Barcode</th>
                                                <th className="py-3.5 px-4">Tracking</th>
                                                <th className="py-3.5 px-4">Sender</th>
                                                <th className="py-3.5 px-4">Customer</th>
                                                <th className="py-3.5 px-4">Customer Number</th>
                                                <th className="py-3.5 px-4">Destination</th>
                                                <th className="py-3.5 px-4">Courier</th>
                                                <th className="py-3.5 px-4">Status</th>
                                                <th className="py-3.5 px-4">Time</th>
                                                <th className="text-center py-3.5 px-4">Global QR</th>
                                                <th className="text-center py-3.5 px-4">City QR</th>
                                                <th className="text-center py-3.5 px-4">Courier QR</th>
                                                <th className="text-right! w-[120px] min-w-[120px] py-3.5 px-4">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200/50 dark:divide-white/[0.04]">
                                            {group.parcels.map((parcel, index) => {
                const isSelected = selectedParcelIds.has(parcel.id);
                const isDeletable = canDeleteParcel(parcel);
                return (<tr key={parcel.id} className={`hover:bg-[#ebf0f7]/70 dark:hover:bg-[#14151e]/70 transition-colors duration-150 group ${isSelected ? 'bg-pink-50/50 dark:bg-pink-950/30' : ''}`}>
                                                        <td data-label="Select" className="text-center py-3.5 px-4">
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                disabled={!isDeletable}
                                                                title={isDeletable ? undefined : "You can only select and delete parcels scanned by you"}
                                                                onChange={() => {
                                                                    if (!isDeletable) return;
                                                                    const newSelected = new Set(selectedParcelIds);
                                                                    if (newSelected.has(parcel.id)) {
                                                                        newSelected.delete(parcel.id);
                                                                    }
                                                                    else {
                                                                        newSelected.add(parcel.id);
                                                                    }
                                                                    setSelectedParcelIds(newSelected);
                                                                }}
                                                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent disabled:opacity-35 disabled:cursor-not-allowed"
                                                            />
                                                        </td>
                                                        <td data-label="#" className="text-center text-slate-400 dark:text-slate-500 font-mono text-[11px] py-3.5 px-4">
                                                            {index + 1}
                                                        </td>
                                                        <td data-label="Barcode" className="whitespace-nowrap py-3.5 px-4">
                                                            <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200 font-bold bg-[#ebf0f7] dark:bg-[#12131b] px-2.5 py-1 rounded-xl border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                                                {parcel.barcode}
                                                            </span>
                                                        </td>
                                                        <td data-label="Tracking" className="font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap py-3.5 px-4 font-bold">
                                                            {parcel.tracking_number}
                                                        </td>
                                                        <td data-label="Sender" className="text-slate-800 dark:text-slate-200 font-bold whitespace-nowrap py-3.5 px-4">
                                                            {parcel.sender_name || 'N/A'}
                                                        </td>
                                                        <td data-label="Customer" className="text-slate-800 dark:text-slate-200 font-bold whitespace-nowrap py-3.5 px-4">
                                                            {parcel.customer_name || 'N/A'}
                                                        </td>
                                                        <td data-label="Customer Number" className="text-slate-800 dark:text-slate-200 font-bold whitespace-nowrap py-3.5 px-4">
                                                            {parcel.customer_number || 'N/A'}
                                                        </td>
                                                        <td data-label="Destination" className="text-slate-600 dark:text-slate-300 whitespace-nowrap truncate max-w-3 py-3.5 px-4">
                                                            {parcel.destination || 'N/A'}
                                                        </td>
                                                        <td data-label="Courier" className="text-slate-700 dark:text-slate-300 font-bold whitespace-nowrap py-3.5 px-4">
                                                            {parcel.courier || 'N/A'}
                                                        </td>
                                                        <td data-label="Status" className="whitespace-nowrap py-3.5 px-4">
                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadge(parcel.status)}`}>
                                                                {getStatusLabel(parcel.status)}
                                                            </span>
                                                        </td>
                                                        <td data-label="Time" className="text-slate-400 dark:text-slate-500 text-[11px] font-mono whitespace-nowrap py-3.5 px-4">
                                                            {new Date(parcel.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </td>{/* qr cells */}
                                                        <td data-label="Global QR" className="text-center py-3.5 px-4">
                                                            {parcel.bulk_qr_code ? (<button type="button" onClick={(e) => handleCopyTableQr(parcel.bulk_qr_code!, e)} className="group/globalqr inline-flex items-center rounded-full p-1.5 text-[10px] font-mono font-bold bg-[#e6f8ef] hover:bg-[#d5f3e4] text-emerald-800 border border-emerald-300/90 shadow-[0_2px_6px_rgba(16,185,129,0.16),inset_0_1px_0_#ffffff] dark:bg-[#0f2c1f] dark:hover:bg-[#153a29] dark:text-emerald-200 dark:border-[#1d573c] dark:shadow-[0_3px_8px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all duration-300 ease-in-out cursor-pointer active:scale-95" title="Copy Global QR">
                                                                    <Clipboard className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"/>
                                                                    <span className="max-w-0 overflow-hidden opacity-0 group-hover/globalqr:max-w-[120px] group-hover/globalqr:opacity-100 group-hover/globalqr:ml-1.5 transition-all duration-300 ease-in-out whitespace-nowrap font-bold">
                                                                        {parcel.bulk_qr_code}
                                                                    </span>
                                                                </button>) : (<span className="text-slate-300 dark:text-slate-600 text-[10px]">—</span>)}
                                                        </td>

                                                        <td data-label="City QR" className="text-center py-3.5 px-4">
                                                            {parcel.bulk_qr_city ? (<button type="button" onClick={(e) => handleCopyTableQr(parcel.bulk_qr_city!, e)} className="group/cityqr inline-flex items-center rounded-full p-1.5 text-[10px] font-mono font-bold bg-[#e0f2fe] hover:bg-[#bae6fd] text-sky-900 border border-sky-300/90 shadow-[0_2px_6px_rgba(14,165,233,0.16),inset_0_1px_0_#ffffff] dark:bg-[#0c2a3a] dark:hover:bg-[#13374b] dark:text-sky-200 dark:border-[#1b4e68] dark:shadow-[0_3px_8px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all duration-300 ease-in-out cursor-pointer active:scale-95" title="Copy City QR">
                                                                    <Clipboard className="w-3.5 h-3.5 shrink-0 text-sky-600 dark:text-sky-400"/>
                                                                    <span className="max-w-0 overflow-hidden opacity-0 group-hover/cityqr:max-w-[120px] group-hover/cityqr:opacity-100 group-hover/cityqr:ml-1.5 transition-all duration-300 ease-in-out whitespace-nowrap font-bold">
                                                                        {parcel.bulk_qr_city}
                                                                    </span>
                                                                </button>) : (<span className="text-slate-300 dark:text-slate-600 text-[10px]">—</span>)}
                                                        </td>

                                                        <td data-label="Courier QR" className="text-center py-3.5 px-4">
                                                            {parcel.bulk_qr_courier ? (<button type="button" onClick={(e) => handleCopyTableQr(parcel.bulk_qr_courier!, e)} className="group/courierqr inline-flex items-center rounded-full p-1.5 text-[10px] font-mono font-bold bg-[#f3e8ff] hover:bg-[#e9d5ff] text-purple-900 border border-purple-300/90 shadow-[0_2px_6px_rgba(168,85,247,0.16),inset_0_1px_0_#ffffff] dark:bg-[#2e1065] dark:hover:bg-[#3b0764] dark:text-purple-200 dark:border-[#581c87] dark:shadow-[0_3px_8px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all duration-300 ease-in-out cursor-pointer active:scale-95" title="Copy Courier QR">
                                                                    <Clipboard className="w-3.5 h-3.5 shrink-0 text-purple-600 dark:text-purple-400"/>
                                                                    <span className="max-w-0 overflow-hidden opacity-0 group-hover/courierqr:max-w-[120px] group-hover/courierqr:opacity-100 group-hover/courierqr:ml-1.5 transition-all duration-300 ease-in-out whitespace-nowrap font-bold">
                                                                        {parcel.bulk_qr_courier}
                                                                    </span>
                                                                </button>) : (<span className="text-slate-300 dark:text-slate-600 text-[10px]">—</span>)}
                                                        </td>

                                                        <td data-label="Actions" className="text-right whitespace-nowrap w-[120px] min-w-[120px] py-3.5 px-4">
                                                            <div className="flex items-center justify-end gap-2.5">
                                                                <CrudActionButton action="view" ariaLabel={`View parcel ${parcel.barcode}`} title="View Parcel" onClick={() => handleViewParcel(parcel)}/>
                                                                <CrudActionButton action="delete" ariaLabel={`Delete parcel ${parcel.barcode}`} title={canDeleteParcel(parcel) ? "Delete Parcel" : "You can only delete parcels scanned by you"} disabled={!canDeleteParcel(parcel)} onClick={() => canDeleteParcel(parcel) && handleDeleteParcel(parcel.id, parcel.barcode)}/>
                                                            </div>
                                                        </td>
                                                    </tr>);
            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>); })) : (<div className="relative overflow-hidden rounded-3xl border border-white/80 dark:border-[#2c2d3c] bg-[#f0f3f8] dark:bg-[#191a24] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] py-14 px-6 text-center">
                            <div className="relative z-10 max-w-sm mx-auto space-y-3">
                                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] text-pink-600 dark:text-pink-400 border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] mx-auto">
                                    <i className="fas fa-boxes-stacked text-xl"></i>
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">No Received Parcels in Sorting</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                                        {searchTerm || locationRegionFilter || locationCityFilter
                                            ? 'No parcels match your active search or filter parameters.'
                                            : 'Parcels accepted from Inbound Receiving will appear here automatically for QR code assignment and sorting.'}
                                    </p>
                                </div>
                                {(searchTerm || locationRegionFilter || locationCityFilter) ? (
                                    <button
                                        onClick={() => {
                                            setSearchTerm('');
                                            setLocationRegionFilter('');
                                            setLocationCityFilter('');
                                        }}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-800 dark:text-slate-200 border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:shadow-[1px_1px_3px_rgba(166,175,195,0.5),-1px_-1px_3px_rgba(255,255,255,0.9)] px-3.5 py-2 text-xs font-bold transition-all cursor-pointer active:scale-95"
                                    >
                                        <i className="fas fa-undo-alt text-[10px]"></i>
                                        <span>Clear filters</span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => fetchData(true)}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/70 dark:border-[#2a2b38] text-slate-700 dark:text-slate-200 hover:text-pink-600 dark:hover:text-pink-400 shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:shadow-[1px_1px_3px_rgba(166,175,195,0.5),-1px_-1px_3px_rgba(255,255,255,0.9)] px-3.5 py-2 text-xs font-bold transition-all cursor-pointer active:scale-95"
                                    >
                                        <i className="fas fa-sync-alt text-[10px]"></i>
                                        <span>Refresh Sorting</span>
                                    </button>
                                )}
                            </div>
                        </div>)}
                </div>
                {totalItems > 0 && (<div className="flex-shrink-0 pagination-container-class flex flex-col sm:flex-row items-center justify-between gap-4 py-3.5 px-5 bg-[#ebf0f7]/40 dark:bg-[#12131b]/30 rounded-2xl border border-white/70 dark:border-white/[0.04]">
                        <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
                            Showing {parcels.length} of {totalItems} parcels
                        </div>
                        <Pagination currentPage={page} totalPages={totalPages} onPageChange={handlePageChange}/>
                    </div>)}
            </div>{/* courier summary */}
            <div className="bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] rounded-3xl p-6  dark:shadow-[14px_14px_40px_rgba(0,0,0,0.8),-4px_-4px_12px_rgba(255,255,255,0.03)] transition-all">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-5 pb-3.5 border-b border-slate-200/60 dark:border-white/[0.06]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] text-pink-500 dark:text-pink-400 flex items-center justify-center border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)]">
                            <i className="fas fa-truck text-xs"></i>
                        </div>
                        <div>
                            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                                Courier Pickup Summary
                            </h3>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                Aggregated parcel queues and batch dispatch readiness
                            </p>
                        </div>
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-[#ebf0f7] dark:bg-[#12131b] px-3 py-1 rounded-full border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)] flex items-center gap-1.5">
                        <i className="far fa-clock text-slate-400 dark:text-slate-500"></i>
                        <span>Ready for pickup</span>
                    </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {courierStats.length > 0 ? (courierStats.map((courier) => {
            const hasQr = courier.hasBulkQr;
            const qrCode = courier.bulkQrCourier;
            return (<div key={courier.name} className={`group relative flex flex-col justify-between rounded-3xl border bg-[#f0f3f8] dark:bg-[#191a24] p-5 transition-all duration-200 hover:-translate-y-1 shadow-[6px_6px_18px_rgba(166,175,195,0.35),-6px_-6px_18px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[6px_6px_20px_rgba(0,0,0,0.6),-3px_-3px_8px_rgba(255,255,255,0.03)] ${hasQr
                    ? 'border-emerald-300/80 dark:border-emerald-500/30'
                    : 'border-white/80 dark:border-[#2c2d3c]'}`}>
                                    <div>
                                        <div className="mb-3 flex items-center justify-between gap-2">
                                            <span className="truncate text-sm font-extrabold tracking-tight text-slate-900 dark:text-white" title={courier.name}>
                                                {courier.name}
                                            </span>
                                            <span className="inline-flex items-center rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] px-3 py-1 text-xs font-extrabold text-pink-600 dark:text-pink-400 border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3)]">
                                                {courier.count} {courier.count === 1 ? 'item' : 'items'}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 text-[11px] font-bold">
                                            <span className={`h-2 w-2 rounded-full ${hasQr ? 'bg-emerald-500 ring-2 ring-emerald-100 dark:ring-emerald-950' : 'bg-amber-500 ring-2 ring-amber-100 dark:ring-amber-950'}`}/>
                                            <span className={hasQr ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-slate-600 dark:text-slate-400'}>
                                                {hasQr ? 'Courier QR Ready' : 'Ready for pickup'}
                                            </span>
                                        </div>

                                        {hasQr && qrCode && (<div className="mt-3.5 flex items-center justify-between rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] px-3 py-2 border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)]">
                                                <span className="truncate text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 max-w-[130px]">
                                                    {qrCode}
                                                </span>
                                                <button type="button" onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(qrCode);
                    }} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono font-bold bg-[#f3e8ff] hover:bg-[#e9d5ff] text-purple-900 border border-purple-300/90 shadow-[0_2px_6px_rgba(168,85,247,0.16),inset_0_1px_0_#ffffff] dark:bg-[#2e1065] dark:hover:bg-[#3b0764] dark:text-purple-200 dark:border-[#581c87] dark:shadow-[0_3px_8px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all duration-200 ease-in-out cursor-pointer active:scale-95" title="Copy Courier QR">
                                                    <Clipboard className="w-3 h-3 shrink-0 text-purple-600 dark:text-purple-400"/>
                                                    <span>Copy</span>
                                                </button>
                                            </div>)}
                                    </div>

                                    <div className="mt-4.5 flex flex-col gap-2 pt-3 border-t border-slate-200/60 dark:border-white/[0.04]">
                                        <button type="button" onClick={() => handleViewCourierParcels(courier.name)} className="w-full inline-flex items-center justify-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-bold bg-[#f0f3f8] dark:bg-[#1d1e28] text-pink-700 dark:text-pink-300 border border-white/80 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:shadow-[1px_1px_3px_rgba(166,175,195,0.5),-1px_-1px_3px_rgba(255,255,255,0.9)] transition-all duration-200 ease-in-out cursor-pointer active:scale-95" title="View parcels">
                                            <Eye className="w-3.5 h-3.5 shrink-0 text-pink-600 dark:text-pink-400"/>
                                            <span>View parcels</span>
                                        </button>

                                        <button type="button" onClick={() => handleGenerateCourierBulkQr(courier.name)} disabled={generatingBulk || courier.parcels.length === 0 || hasQr} className={`w-full inline-flex items-center justify-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-bold transition-all duration-200 ease-in-out cursor-pointer active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${hasQr
                    ? 'bg-[#ebf0f7] dark:bg-[#14151c] text-emerald-800 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-600/30 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]'
                    : 'bg-[#f0f3f8] dark:bg-[#1d1e28] text-emerald-700 dark:text-emerald-300 border border-white/80 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] hover:shadow-[1px_1px_3px_rgba(166,175,195,0.5),-1px_-1px_3px_rgba(255,255,255,0.9)]'}`}>
                                            <i className={`fas ${hasQr ? 'fa-check-circle text-emerald-600 dark:text-emerald-400' : 'fa-qrcode'} text-xs shrink-0`}/>
                                            <span>
                                                {hasQr ? 'Courier QR Ready' : 'Generate Courier QR'}
                                            </span>
                                        </button>
                                    </div>
                                </div>);
        })) : (<div className="col-span-full relative overflow-hidden rounded-3xl border border-white/80 dark:border-[#2c2d3c] bg-[#f0f3f8] dark:bg-[#191a24] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] py-12 px-6 text-center">
                            <div className="relative z-10 max-w-sm mx-auto space-y-3">
                                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] text-amber-600 dark:text-amber-400 border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] mx-auto">
                                    <i className="fas fa-truck-fast text-xl"></i>
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">No Active Courier Batches</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                                        Courier breakdown and bulk QR code generators will display here once received parcels are assigned to couriers.
                                    </p>
                                </div>
                            </div>
                        </div>)}
                </div>
            </div>            {/* city modal */}
            <Portal>
                {showModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
                        <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08]  dark:shadow-[14px_14px_40px_rgba(0,0,0,0.8),-4px_-4px_12px_rgba(255,255,255,0.03)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-200 overflow-hidden">

                            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/[0.06] p-5 sm:px-6">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] text-pink-500 dark:text-pink-400 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)]">
                                        <i className="fas fa-map-pin text-base"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                                            {selectedParcels.length > 0 ? selectedParcels[0]?.city || 'Parcels' : 'Parcels'}
                                        </h3>
                                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                            {selectedParcels.length} {selectedParcels.length === 1 ? 'parcel' : 'parcels'} found
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <AppButton type="button" variant="success" size="sm" onClick={handleGenerateBulkQr} disabled={generatingBulk || selectedParcels.length === 0 || selectedParcels.every((p) => p.bulk_qr_code)} loading={generatingBulk}>
                                        {!generatingBulk && <i className="fas fa-qrcode text-xs"></i>}
                                        <span>{generatingBulk ? 'Generating...' : 'Generate Bulk QR'}</span>
                                    </AppButton>

                                    <AppButton type="button" variant="neutral" size="icon-sm" onClick={() => {
                setShowModal(false);
                setSelectedParcels([]);
            }} aria-label="Close modal">
                                        <i className="fas fa-times text-xs"></i>
                                    </AppButton>
                                </div>
                            </div>

                            <div className="relative flex-1 overflow-y-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="sticky top-0 z-10 bg-[#ebf0f7]/95 dark:bg-[#12131b]/95 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 backdrop-blur-xs border-b border-slate-200/60 dark:border-white/[0.06]">
                                        <tr>
                                            <th className="py-3.5 px-4 sm:px-6">Barcode</th>
                                            <th className="py-3.5 px-3">Tracking</th>
                                            <th className="py-3.5 px-3">Courier</th>
                                            <th className="py-3.5 px-4 sm:px-6">Bulk QR (City)</th>
                                            <th className="py-3.5 px-4 sm:px-6 text-right">Bulk QR (Global)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200/50 dark:divide-white/[0.04] font-medium">
                                        {selectedParcels.map((parcel) => (<tr key={parcel.id} className="transition-colors hover:bg-[#ebf0f7]/70 dark:hover:bg-[#14151e]/70">
                                                <td className="py-3.5 px-4 sm:px-6 font-mono font-bold text-slate-900 dark:text-slate-100">
                                                    <span className="rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] px-2.5 py-1 border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)] text-slate-800 dark:text-slate-200">
                                                        {parcel.barcode}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-3 font-mono text-slate-500 dark:text-slate-400 font-bold">
                                                    {parcel.tracking_number}
                                                </td>
                                                <td className="py-3.5 px-3 font-bold text-slate-700 dark:text-slate-300">
                                                    {parcel.courier || 'N/A'}
                                                </td>
                                                <td className="py-3.5 px-4 sm:px-6">
                                                    {parcel.bulk_qr_city ? (<div className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 border border-emerald-200/60 dark:border-emerald-800/60 shadow-2xs">
                                                            <span className="font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-400 max-w-[100px] truncate">
                                                                {parcel.bulk_qr_city}
                                                            </span>
                                                            <button type="button" onClick={() => copyToClipboard(parcel.bulk_qr_city!)} className="rounded p-0.5 text-blue-600 dark:text-blue-400 transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer" title="Copy QR code">
                                                                <i className="fas fa-copy text-[10px]"></i>
                                                            </button>
                                                        </div>) : (<span className="text-slate-300 dark:text-slate-600 font-semibold">—</span>)}
                                                </td>
                                                <td className="py-3.5 px-4 sm:px-6 text-right">
                                                    {parcel.bulk_qr_code ? (<div className="inline-flex items-center justify-end gap-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 border border-emerald-200/60 dark:border-emerald-800/60 shadow-2xs">
                                                            <span className="font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-400 max-w-[100px] truncate">
                                                                {parcel.bulk_qr_code}
                                                            </span>
                                                            <button type="button" onClick={() => copyToClipboard(parcel.bulk_qr_code!)} className="rounded p-0.5 text-blue-600 dark:text-blue-400 transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer" title="Copy QR code">
                                                                <i className="fas fa-copy text-[10px]"></i>
                                                            </button>
                                                        </div>) : (<span className="text-slate-300 dark:text-slate-600 font-semibold">—</span>)}
                                                </td>
                                            </tr>))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/40 dark:bg-[#12131b]/30 p-4 sm:px-6">
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
                                <AppButton type="button" variant="neutral" size="sm" onClick={() => {
                setShowModal(false);
                setSelectedParcels([]);
            }}>
                                    Close
                                </AppButton>
                            </div>

                        </div>
                    </div>)}
            </Portal>{/* courier modal */}
            <Portal>
                {showCourierModal && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 dark:bg-slate-950/70 p-4 backdrop-blur-md animate-in fade-in duration-200">
                        <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08]  dark:shadow-[14px_14px_40px_rgba(0,0,0,0.8),-4px_-4px_12px_rgba(255,255,255,0.03)] animate-in slide-in-from-bottom-4 duration-300 overflow-hidden">

                            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/[0.06] px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] text-pink-500 dark:text-pink-400 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)]">
                                        <i className="fas fa-truck text-base"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                                            {selectedCourier || 'Courier Parcels'}
                                        </h3>
                                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                            {courierParcels.length} {courierParcels.length === 1 ? 'parcel' : 'parcels'} found
                                        </p>
                                    </div>
                                </div>

                                <AppButton type="button" variant="neutral" size="icon-sm" onClick={() => {
                setShowCourierModal(false);
                setCourierParcels([]);
                setSelectedCourier(null);
            }} aria-label="Close modal">
                                    <i className="fas fa-times text-xs"></i>
                                </AppButton>
                            </div>

                            <div className="flex-1 overflow-y-auto px-6 py-4">
                                {courierParcels.length > 0 ? (<div className="overflow-x-auto rounded-2xl border border-white/80 dark:border-white/[0.06] overflow-hidden">
                                        <table className="w-full text-left text-xs">
                                            <thead>
                                                <tr className="border-b border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/90 dark:bg-[#12131b]/90 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                                    <th scope="col" className="px-3.5 py-3">Barcode</th>
                                                    <th scope="col" className="px-3.5 py-3">Tracking</th>
                                                    <th scope="col" className="px-3.5 py-3">Destination</th>
                                                    <th scope="col" className="px-3.5 py-3">City</th>
                                                    <th scope="col" className="px-3.5 py-3">Bulk QR (Courier)</th>
                                                    <th scope="col" className="px-3.5 py-3">Bulk QR (Global)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200/50 dark:divide-white/[0.04]">
                                                {courierParcels.map((parcel) => (<tr key={parcel.id} className="transition-colors hover:bg-[#ebf0f7]/60 dark:hover:bg-[#14151e]/60">
                                                        <td className="whitespace-nowrap px-3.5 py-3 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                                                            <span className="bg-[#ebf0f7] dark:bg-[#12131b] px-2 py-0.5 rounded-lg border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                                                {parcel.barcode}
                                                            </span>
                                                        </td>
                                                        <td className="whitespace-nowrap px-3.5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400 font-bold">
                                                            {parcel.tracking_number}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3.5 py-3 font-bold text-slate-700 dark:text-slate-300">
                                                            {parcel.destination || <span className="text-slate-400 dark:text-slate-600">N/A</span>}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3.5 py-3 font-bold text-slate-700 dark:text-slate-300">
                                                            {parcel.city || <span className="text-slate-400 dark:text-slate-600">N/A</span>}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3.5 py-3">
                                                            {parcel.bulk_qr_courier ? (<div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/40 px-2 py-0.5 shadow-2xs">
                                                                    <span className="font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-400 max-w-[120px] truncate">
                                                                        {parcel.bulk_qr_courier}
                                                                    </span>
                                                                    <button type="button" onClick={() => copyToClipboard(parcel.bulk_qr_courier!)} className="rounded p-0.5 text-emerald-600 dark:text-emerald-400 transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/50 hover:text-emerald-800 dark:hover:text-emerald-300 cursor-pointer" title="Copy QR code">
                                                                        <i className="fas fa-copy text-[10px]"></i>
                                                                    </button>
                                                                </div>) : (<span className="text-slate-300 dark:text-slate-700 font-mono">—</span>)}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3.5 py-3">
                                                            {parcel.bulk_qr_code ? (<div className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200/80 dark:border-blue-800/60 bg-blue-50/60 dark:bg-blue-950/40 px-2 py-0.5 shadow-2xs">
                                                                    <span className="font-mono text-[10px] font-bold text-blue-700 dark:text-blue-400 max-w-[120px] truncate">
                                                                        {parcel.bulk_qr_code}
                                                                    </span>
                                                                    <button type="button" onClick={() => copyToClipboard(parcel.bulk_qr_code!)} className="rounded p-0.5 text-blue-600 dark:text-blue-400 transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer" title="Copy QR code">
                                                                        <i className="fas fa-copy text-[10px]"></i>
                                                                    </button>
                                                                </div>) : (<span className="text-slate-300 dark:text-slate-700 font-mono">—</span>)}
                                                        </td>
                                                    </tr>))}
                                            </tbody>
                                        </table>
                                    </div>) : (<div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="mb-2 rounded-full bg-[#ebf0f7] dark:bg-[#14151c] p-3 text-slate-400 dark:text-slate-500 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3)]">
                                            <i className="fas fa-box-open text-xl"></i>
                                        </div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No parcels found</p>
                                        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">There are no individual parcels attached to this courier.</p>
                                    </div>)}
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/40 dark:bg-[#12131b]/30 px-6 py-4">
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

                                <AppButton type="button" variant="primary" size="sm" onClick={() => {
                setShowCourierModal(false);
                setCourierParcels([]);
                setSelectedCourier(null);
            }}>
                                    Done
                                </AppButton>
                            </div>

                        </div>
                    </div>)}
            </Portal>{/* view modal */}
            <Portal>
                {showViewModal && viewParcel && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
                        <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08]  dark:shadow-[14px_14px_40px_rgba(0,0,0,0.8),-4px_-4px_12px_rgba(255,255,255,0.03)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-200 overflow-hidden">

                            {/* header */}
                            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/[0.06] p-5">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] text-blue-500 dark:text-blue-400 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)]">
                                        <i className="fas fa-box text-base"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                                            Parcel Details
                                        </h3>
                                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                            {viewParcel.barcode}
                                        </p>
                                    </div>
                                </div>

                                <AppButton type="button" variant="neutral" size="icon-sm" onClick={() => {
                setShowViewModal(false);
                setViewParcel(null);
            }} aria-label="Close modal">
                                        <i className="fas fa-times text-xs"></i>
                                    </AppButton>
                            </div>{/* content */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-5">{/* main info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-[#ebf0f7]/70 dark:bg-[#12131b]/60 rounded-2xl p-4 border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Barcode</label>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white mt-1 font-mono">{viewParcel.barcode}</p>
                                    </div>
                                    <div className="bg-[#ebf0f7]/70 dark:bg-[#12131b]/60 rounded-2xl p-4 border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Tracking Number</label>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white mt-1 font-mono">{viewParcel.tracking_number}</p>
                                    </div>
                                    <div className="bg-[#ebf0f7]/70 dark:bg-[#12131b]/60 rounded-2xl p-4 border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Sender</label>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">{viewParcel.sender_name || 'N/A'}</p>
                                    </div>
                                    <div className="bg-[#ebf0f7]/70 dark:bg-[#12131b]/60 rounded-2xl p-4 border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Courier</label>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">{viewParcel.courier || 'N/A'}</p>
                                    </div>
                                    <div className="bg-[#ebf0f7]/70 dark:bg-[#12131b]/60 rounded-2xl p-4 border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Destination</label>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">{viewParcel.destination || 'N/A'}</p>
                                    </div>
                                    <div className="bg-[#ebf0f7]/70 dark:bg-[#12131b]/60 rounded-2xl p-4 border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">City</label>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">{viewParcel.city || 'N/A'}</p>
                                    </div>
                                    <div className="bg-[#ebf0f7]/70 dark:bg-[#12131b]/60 rounded-2xl p-4 border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Region</label>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">{viewParcel.region || 'N/A'}</p>
                                    </div>
                                    <div className="bg-[#ebf0f7]/70 dark:bg-[#12131b]/60 rounded-2xl p-4 border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Status</label>
                                        <p className="mt-1">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusBadge(viewParcel.status)}`}>
                                                {getStatusLabel(viewParcel.status)}
                                            </span>
                                        </p>
                                    </div>
                                </div>{/* customer */}
                                {(viewParcel.customer_name || viewParcel.customer_number) && (<div className="bg-[#ebf0f7]/80 dark:bg-[#12131b]/70 rounded-2xl p-4 border border-blue-200/60 dark:border-blue-900/40 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                        <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2">Customer Information</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {viewParcel.customer_name && (<div>
                                                    <label className="text-[10px] font-bold text-blue-500 dark:text-blue-400">Name</label>
                                                    <p className="text-sm font-bold text-blue-900 dark:text-blue-100">{viewParcel.customer_name}</p>
                                                </div>)}
                                            {viewParcel.customer_number && (<div>
                                                    <label className="text-[10px] font-bold text-blue-500 dark:text-blue-400">Contact Number</label>
                                                    <p className="text-sm font-bold text-blue-900 dark:text-blue-100">{viewParcel.customer_number}</p>
                                                </div>)}
                                        </div>
                                    </div>)}{/* qr codes */}
                                {(viewParcel.bulk_qr_code || viewParcel.bulk_qr_city || viewParcel.bulk_qr_courier) && (<div className="bg-[#ebf0f7]/70 dark:bg-[#12131b]/60 rounded-2xl p-4 border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                        <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">QR Codes</h4>
                                        <div className="space-y-2">
                                            {viewParcel.bulk_qr_code && (<div className="flex items-center justify-between bg-[#f0f3f8] dark:bg-[#161722] rounded-xl px-3 py-2 border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">Global: {viewParcel.bulk_qr_code}</span>
                                                    <button type="button" onClick={() => copyToClipboard(viewParcel.bulk_qr_code!)} className="group/modalglobalqr inline-flex items-center rounded-full p-1.5 text-[10px] font-mono font-bold bg-[#e6f8ef] hover:bg-[#d5f3e4] text-emerald-800 border border-emerald-300/90 shadow-[0_2px_6px_rgba(16,185,129,0.16),inset_0_1px_0_#ffffff] dark:bg-[#0f2c1f] dark:hover:bg-[#153a29] dark:text-emerald-200 dark:border-[#1d573c] transition-all duration-300 ease-in-out cursor-pointer active:scale-95" title="Copy Global QR">
                                                        <Clipboard className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"/>
                                                        <span className="max-w-0 overflow-hidden opacity-0 group-hover/modalglobalqr:max-w-[120px] group-hover/modalglobalqr:opacity-100 group-hover/modalglobalqr:ml-1.5 transition-all duration-300 ease-in-out whitespace-nowrap font-bold">
                                                            Copy QR
                                                        </span>
                                                    </button>
                                                </div>)}
                                            {viewParcel.bulk_qr_city && (<div className="flex items-center justify-between bg-[#f0f3f8] dark:bg-[#161722] rounded-xl px-3 py-2 border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">City: {viewParcel.bulk_qr_city}</span>
                                                    <button type="button" onClick={() => copyToClipboard(viewParcel.bulk_qr_city!)} className="group/modalcityqr inline-flex items-center rounded-full p-1.5 text-[10px] font-mono font-bold bg-[#e0f2fe] hover:bg-[#bae6fd] text-sky-900 border border-sky-300/90 shadow-[0_2px_6px_rgba(14,165,233,0.16),inset_0_1px_0_#ffffff] dark:bg-[#0c2a3a] dark:hover:bg-[#13374b] dark:text-sky-200 dark:border-[#1b4e68] transition-all duration-300 ease-in-out cursor-pointer active:scale-95" title="Copy City QR">
                                                        <Clipboard className="w-3.5 h-3.5 shrink-0 text-sky-600 dark:text-sky-400"/>
                                                        <span className="max-w-0 overflow-hidden opacity-0 group-hover/modalcityqr:max-w-[120px] group-hover/modalcityqr:opacity-100 group-hover/modalcityqr:ml-1.5 transition-all duration-300 ease-in-out whitespace-nowrap font-bold">
                                                            Copy QR
                                                        </span>
                                                    </button>
                                                </div>)}
                                            {viewParcel.bulk_qr_courier && (<div className="flex items-center justify-between bg-[#f0f3f8] dark:bg-[#161722] rounded-xl px-3 py-2 border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">Courier: {viewParcel.bulk_qr_courier}</span>
                                                    <button type="button" onClick={() => copyToClipboard(viewParcel.bulk_qr_courier!)} className="group/modalcourierqr inline-flex items-center rounded-full p-1.5 text-[10px] font-mono font-bold bg-[#f3e8ff] hover:bg-[#e9d5ff] text-purple-900 border border-purple-300/90 shadow-[0_2px_6px_rgba(168,85,247,0.16),inset_0_1px_0_#ffffff] dark:bg-[#2e1065] dark:hover:bg-[#3b0764] dark:text-purple-200 dark:border-[#581c87] transition-all duration-300 ease-in-out cursor-pointer active:scale-95" title="Copy Courier QR">
                                                        <Clipboard className="w-3.5 h-3.5 shrink-0 text-purple-600 dark:text-purple-400"/>
                                                        <span className="max-w-0 overflow-hidden opacity-0 group-hover/modalcourierqr:max-w-[120px] group-hover/modalcourierqr:opacity-100 group-hover/modalcourierqr:ml-1.5 transition-all duration-300 ease-in-out whitespace-nowrap font-bold">
                                                            Copy QR
                                                        </span>
                                                    </button>
                                                </div>)}
                                        </div>
                                    </div>)}{/* time */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-500 dark:text-slate-400 bg-[#ebf0f7]/70 dark:bg-[#12131b]/60 rounded-2xl p-4 border border-white/80 dark:border-white/[0.05] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                    <div>
                                        <span className="font-bold text-slate-400 dark:text-slate-500">Created:</span>
                                        <span className="ml-2 font-mono font-bold">{new Date(viewParcel.created_at).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* footer */}
                            <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/40 dark:bg-[#12131b]/30 p-4 px-6">
                                <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusBadge(viewParcel.status)}`}>
                                        {getStatusLabel(viewParcel.status)}
                                    </span>
                                    <span className="text-xs font-bold font-mono text-slate-400 dark:text-slate-500">
                                        ID: {viewParcel.id}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <AppButton variant="neutral" size="sm" onClick={() => {
                setShowViewModal(false);
                setViewParcel(null);
            }}>
                                        Close
                                    </AppButton>
                                </div>
                            </div>
                        </div>
                    </div>)}
            </Portal>
        </div>);
}
