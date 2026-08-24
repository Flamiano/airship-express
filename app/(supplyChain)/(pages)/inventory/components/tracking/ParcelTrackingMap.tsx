// app/(supplyChain)/(pages)/inventory/components/tracking/ParcelTrackingMap.tsx

'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GeoCoordinate } from '../../utils/geo-locations';

export interface ParcelTrackingMapProps {
    trackingNumber: string;
    barcode?: string;
    status: string;
    courier?: string;
    origin: GeoCoordinate;
    destination: GeoCoordinate;
    currentLocation: GeoCoordinate;
    currentCoord: [number, number];
    expectedDelivery: string;
    completedRoute: [number, number][];
    remainingRoute: [number, number][];
}

/**
 * Custom Origin Marker DivIcon (HQ - Binondo, Manila)
 */
function createOriginIcon() {
    return L.divIcon({
        className: 'airship-origin-marker-wrapper',
        html: `
            <div class="relative flex items-center justify-center cursor-pointer group">
                <div class="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg border-2 border-white ring-2 ring-pink-500/40 transform transition-transform group-hover:scale-110">
                    <i class="fas fa-building text-[11px] text-pink-400"></i>
                </div>
                <div class="absolute -bottom-1 w-2 h-2 bg-slate-900 rotate-45 border-r border-b border-white"></div>
            </div>
        `,
        iconSize: [32, 36],
        iconAnchor: [16, 36],
        popupAnchor: [0, -36],
    });
}

/**
 * Custom Destination Marker DivIcon
 */
function createDestinationIcon() {
    return L.divIcon({
        className: 'airship-dest-marker-wrapper',
        html: `
            <div class="relative flex items-center justify-center cursor-pointer group">
                <div class="w-8 h-8 rounded-full bg-pink-600 text-white flex items-center justify-center shadow-lg border-2 border-white ring-2 ring-pink-400/40 transform transition-transform group-hover:scale-110">
                    <i class="fas fa-map-marker-alt text-xs text-white"></i>
                </div>
                <div class="absolute -bottom-1 w-2 h-2 bg-pink-600 rotate-45 border-r border-b border-white"></div>
            </div>
        `,
        iconSize: [32, 36],
        iconAnchor: [16, 36],
        popupAnchor: [0, -36],
    });
}

/**
 * Custom Parcel Box Marker DivIcon (Animated current location)
 */
function createParcelIcon() {
    return L.divIcon({
        className: 'airship-parcel-marker-wrapper',
        html: `
            <div class="relative flex items-center justify-center cursor-pointer">
                <!-- Pulse animation rings -->
                <span class="absolute -inset-2.5 rounded-full bg-pink-500/30 animate-ping opacity-75 pointer-events-none"></span>
                <span class="absolute -inset-1.5 rounded-full bg-pink-500/40 pointer-events-none animate-pulse"></span>
                
                <!-- Package Box Icon Badge -->
                <div class="relative w-9 h-9 rounded-2xl bg-gradient-to-tr from-pink-600 to-rose-500 text-white flex items-center justify-center shadow-xl border-2 border-white ring-2 ring-pink-500/60 transform hover:scale-110 transition-transform">
                    <i class="fas fa-box text-sm text-white drop-shadow-xs"></i>
                </div>
            </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -20],
    });
}

/**
 * Auto-fits map view bounds to include origin, parcel, and destination
 */
function MapBoundsManager({
    originCoord,
    destCoord,
    currentCoord,
    route,
}: {
    originCoord: [number, number];
    destCoord: [number, number];
    currentCoord: [number, number];
    route: [number, number][];
}) {
    const map = useMap();

    useEffect(() => {
        if (!map) return;

        const bounds = L.latLngBounds([originCoord, destCoord, currentCoord]);
        if (route && route.length > 0) {
            route.forEach((pt) => bounds.extend(pt));
        }

        if (bounds.isValid()) {
            map.fitBounds(bounds, {
                padding: [45, 45],
                maxZoom: 15,
                animate: true,
                duration: 0.8,
            });
        }
    }, [map, originCoord, destCoord, currentCoord, route]);

    return null;
}

export default function ParcelTrackingMap({
    trackingNumber,
    barcode,
    status,
    courier = 'Airship Express',
    origin,
    destination,
    currentLocation,
    currentCoord,
    expectedDelivery,
    completedRoute,
    remainingRoute,
}: ParcelTrackingMapProps) {
    const originIcon = useMemo(() => createOriginIcon(), []);
    const destIcon = useMemo(() => createDestinationIcon(), []);
    const parcelIcon = useMemo(() => createParcelIcon(), []);

    const originLatLng: [number, number] = [origin.latitude, origin.longitude];
    const destLatLng: [number, number] = [destination.latitude, destination.longitude];

    const allRoutePoints = useMemo(() => {
        return [...completedRoute, ...remainingRoute];
    }, [completedRoute, remainingRoute]);

    const parcelMarkerRef = useRef<L.Marker>(null);

    // Auto open popup when map mounts
    useEffect(() => {
        const timer = setTimeout(() => {
            if (parcelMarkerRef.current) {
                parcelMarkerRef.current.openPopup();
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [trackingNumber]);

    return (
        <div className="w-full h-full min-h-[300px] relative rounded-xl overflow-hidden shadow-inner border border-slate-200/80 dark:border-slate-800">
            <MapContainer
                center={currentCoord}
                zoom={12}
                scrollWheelZoom={true}
                zoomControl={false}
                className="w-full h-full min-h-[300px] z-0"
            >
                {/* OpenStreetMap Tile Layer */}
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />

                <ZoomControl position="bottomright" />

                {/* Auto Bounds Manager */}
                <MapBoundsManager
                    originCoord={originLatLng}
                    destCoord={destLatLng}
                    currentCoord={currentCoord}
                    route={allRoutePoints}
                />

                {/* 1. Completed Route Polyline (Solid Pink #EC4899) */}
                {completedRoute.length > 1 && (
                    <Polyline
                        positions={completedRoute}
                        pathOptions={{
                            color: '#EC4899',
                            weight: 5,
                            opacity: 0.95,
                            lineCap: 'round',
                            lineJoin: 'round',
                        }}
                    />
                )}

                {/* 2. Remaining Route Polyline (Dashed Slate) */}
                {remainingRoute.length > 1 && (
                    <Polyline
                        positions={remainingRoute}
                        pathOptions={{
                            color: '#64748B',
                            weight: 3.5,
                            dashArray: '6, 8',
                            opacity: 0.7,
                            lineCap: 'round',
                            lineJoin: 'round',
                        }}
                    />
                )}

                {/* 3. Origin Marker (Airship HQ - Binondo) */}
                <Marker position={originLatLng} icon={originIcon}>
                    <Popup>
                        <div className="text-xs p-1 space-y-1 font-sans min-w-[170px]">
                            <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                <i className="fas fa-building text-pink-500"></i>
                                <span>Origin / HQ</span>
                            </div>
                            <p className="text-[11px] text-slate-600 font-medium">{origin.name}</p>
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                                Dispatch Hub
                            </span>
                        </div>
                    </Popup>
                </Marker>

                {/* 4. Destination Marker */}
                <Marker position={destLatLng} icon={destIcon}>
                    <Popup>
                        <div className="text-xs p-1 space-y-1 font-sans min-w-[170px]">
                            <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                <i className="fas fa-flag-checkered text-pink-600"></i>
                                <span>Destination</span>
                            </div>
                            <p className="text-[11px] text-slate-600 font-medium">{destination.name}</p>
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-pink-50 text-pink-700 border border-pink-200">
                                Final Delivery Point
                            </span>
                        </div>
                    </Popup>
                </Marker>

                {/* 5. Custom Parcel Marker at Current Location */}
                <Marker ref={parcelMarkerRef} position={currentCoord} icon={parcelIcon} zIndexOffset={1000}>
                    <Popup>
                        <div className="text-xs font-sans space-y-2 p-1 min-w-[220px]">
                            {/* Header */}
                            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                    <span className="w-5 h-5 rounded-lg bg-pink-100 text-pink-600 inline-flex items-center justify-center text-[10px]">
                                        <i className="fas fa-box"></i>
                                    </span>
                                    <span className="font-mono">{trackingNumber}</span>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-50 text-pink-600 border border-pink-200">
                                    {status.replace(/_/g, ' ').toUpperCase()}
                                </span>
                            </div>

                            {/* Details List */}
                            <div className="space-y-1 text-[11px] text-slate-600">
                                <div className="flex justify-between">
                                    <span className="text-slate-400 font-medium">Courier:</span>
                                    <span className="font-semibold text-slate-800">{courier}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400 font-medium">Origin:</span>
                                    <span className="font-semibold text-slate-800 text-right truncate max-w-[130px]">{origin.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400 font-medium">Destination:</span>
                                    <span className="font-semibold text-slate-800 text-right truncate max-w-[130px]">{destination.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400 font-medium">Current Location:</span>
                                    <span className="font-semibold text-pink-600 text-right truncate max-w-[130px]">{currentLocation.name}</span>
                                </div>
                                <div className="flex justify-between pt-1 border-t border-slate-100">
                                    <span className="text-slate-400 font-medium">Expected Delivery:</span>
                                    <span className="font-semibold text-slate-800">{expectedDelivery}</span>
                                </div>
                            </div>
                        </div>
                    </Popup>
                </Marker>
            </MapContainer>
        </div>
    );
}
