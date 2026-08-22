// app/(supplyChain)/(pages)/inventory/components/tracking/ParcelTrackingCard.tsx

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
    AIRSHIP_HQ,
    resolveDestinationCoords,
    getStatusProgress,
    fetchOSRMRoute,
    getLocalityFromProgress,
    splitRouteByProgress,
    GeoCoordinate,
} from '../../utils/geo-locations';
import { getStatusBadge, getStatusLabel, getStatusTone } from '../../utils/helpers';
import { StatusBadge } from '@/app/(supplyChain)/components/ui/StatusBadge';

// Dynamically import ParcelTrackingMap with SSR disabled to prevent browser API window/Leaflet errors
const DynamicParcelTrackingMap = dynamic(
    () => import('./ParcelTrackingMap'),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-[280px] bg-slate-100 dark:bg-slate-800/60 rounded-xl flex flex-col items-center justify-center gap-3 animate-pulse border border-slate-200/80 dark:border-slate-800">
                <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-950/40 text-pink-500 flex items-center justify-center">
                    <i className="fas fa-map-marked-alt text-lg animate-bounce"></i>
                </div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Loading delivery route map...</span>
            </div>
        ),
    }
);

export interface ParcelTrackingCardProps {
    parcel: {
        id: number;
        barcode: string;
        tracking_number: string;
        sender_name?: string | null;
        customer_name?: string | null;
        customer_number?: string | null;
        destination?: string | null;
        courier?: string | null;
        status: string;
        created_at: string;
        updated_at: string;
    };
}

export function ParcelTrackingCard({ parcel }: ParcelTrackingCardProps) {
    const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
    const [isLoadingRoute, setIsLoadingRoute] = useState<boolean>(true);

    const origin: GeoCoordinate = AIRSHIP_HQ;
    const destination: GeoCoordinate = useMemo(
        () => resolveDestinationCoords(parcel.destination),
        [parcel.destination]
    );

    const progressPercentage = useMemo(
        () => getStatusProgress(parcel.status),
        [parcel.status]
    );

    const courierName = parcel.courier || 'Airship Express';

    // Calculate expected delivery date (2 business days from creation or formatted)
    const expectedDelivery = useMemo(() => {
        const base = new Date(parcel.created_at || Date.now());
        const exp = new Date(base.getTime() + 2 * 24 * 60 * 60 * 1000);
        return exp.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    }, [parcel.created_at]);

    // Fetch OSRM Road geometry on mount/change
    useEffect(() => {
        let isMounted = true;
        setIsLoadingRoute(true);

        fetchOSRMRoute(origin, destination)
            .then((coords) => {
                if (isMounted) {
                    setRouteCoordinates(coords);
                    setIsLoadingRoute(false);
                }
            })
            .catch(() => {
                if (isMounted) {
                    setIsLoadingRoute(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [origin, destination]);

    // Split road into completed and remaining polylines
    const { completed, remaining, currentCoord } = useMemo(() => {
        return splitRouteByProgress(routeCoordinates, progressPercentage);
    }, [routeCoordinates, progressPercentage]);

    const currentLocationName = useMemo(() => {
        return getLocalityFromProgress(progressPercentage, origin.name, destination.name, parcel.status);
    }, [progressPercentage, origin.name, destination.name, parcel.status]);

    const currentLocation: GeoCoordinate = {
        name: currentLocationName,
        latitude: currentCoord[0],
        longitude: currentCoord[1],
    };

    const isDelivered = parcel.status === 'delivered';

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden p-4 sm:p-5 space-y-4 transition-all">
            {/* Header: "Parcel Tracking" & Status */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-pink-50 dark:bg-pink-950/40 border border-pink-100 dark:border-pink-900/40 text-pink-500 dark:text-pink-400 inline-flex items-center justify-center text-xs">
                            <i className="fas fa-route"></i>
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Parcel Tracking</h4>
                        <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700">
                            {parcel.tracking_number}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Courier Badge */}
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        <i className="fas fa-truck text-[11px] text-pink-500"></i>
                        <span>{courierName}</span>
                    </span>

                    {/* Status Badge */}
                    <StatusBadge
                        tone={getStatusTone(parcel.status)}
                        size="xs"
                        dot
                    >
                        {getStatusLabel(parcel.status)}
                    </StatusBadge>
                </div>
            </div>

            {/* Interactive Leaflet Map Container */}
            <div className="h-[280px] sm:h-[320px] w-full rounded-xl overflow-hidden relative">
                {isLoadingRoute && (
                    <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xs z-10 flex items-center justify-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                        <i className="fas fa-circle-notch fa-spin text-pink-500"></i>
                        <span>Calculating road route...</span>
                    </div>
                )}
                <DynamicParcelTrackingMap
                    trackingNumber={parcel.tracking_number}
                    barcode={parcel.barcode}
                    status={parcel.status}
                    courier={courierName}
                    origin={origin}
                    destination={destination}
                    currentLocation={currentLocation}
                    currentCoord={currentCoord}
                    expectedDelivery={expectedDelivery}
                    completedRoute={completed}
                    remainingRoute={remaining}
                />
            </div>

            {/* Visual Delivery Progress Indicator: Manila ━━━━━━━ 📦 ─ ─ ─ ─ ─ Quezon City */}
            <div className="bg-slate-50/70 dark:bg-slate-950/40 rounded-xl p-3 border border-slate-100 dark:border-slate-800/80 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                        <i className="fas fa-building text-pink-500 text-[10px]"></i>
                        <span className="truncate">Manila (Binondo)</span>
                    </div>

                    {/* Mid visual representation */}
                    <div className="flex-1 mx-3 flex items-center justify-center relative">
                        <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full relative overflow-hidden">
                            <div
                                className={`h-full transition-all duration-700 ease-out ${
                                    isDelivered ? 'bg-emerald-500' : 'bg-pink-500'
                                }`}
                                style={{ width: `${progressPercentage}%` }}
                            />
                        </div>
                        <div
                            className="absolute -top-2 transition-all duration-700 ease-out"
                            style={{ left: `calc(${progressPercentage}% - 8px)` }}
                        >
                            <span className="w-4 h-4 rounded-full bg-pink-600 text-white flex items-center justify-center text-[8px] shadow-sm ring-2 ring-white dark:ring-slate-900">
                                <i className="fas fa-box"></i>
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                        <i className="fas fa-map-marker-alt text-pink-500 text-[10px]"></i>
                        <span className="truncate">{destination.name}</span>
                    </div>
                </div>

                {/* Progress Stats Summary */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/60 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Current:</span>
                        <span className="text-pink-600 dark:text-pink-400 font-medium truncate max-w-[180px]">
                            {currentLocationName}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                            Progress: <strong className="text-slate-800 dark:text-slate-200 font-bold">{progressPercentage}%</strong>
                        </span>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                            Est. Delivery: <strong className="text-slate-800 dark:text-slate-200 font-medium">{expectedDelivery}</strong>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
