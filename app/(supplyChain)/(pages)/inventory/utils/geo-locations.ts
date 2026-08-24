// app/(supplyChain)/(pages)/inventory/utils/geo-locations.ts

export interface GeoCoordinate {
    name: string;
    latitude: number;
    longitude: number;
}

export interface ParcelTrackingInfo {
    trackingNumber: string;
    barcode?: string;
    status: string;
    courier: string;
    origin: GeoCoordinate;
    destination: GeoCoordinate;
    currentLocation: GeoCoordinate;
    progressPercentage: number;
    expectedDelivery: string;
    routeCoordinates: [number, number][]; // [lat, lng] array
    completedCoordinates: [number, number][];
    remainingCoordinates: [number, number][];
}

// Fixed Headquarters Origin: Binondo, Manila
export const AIRSHIP_HQ: GeoCoordinate = {
    name: 'Airship Express (HQ - Binondo, Manila)',
    latitude: 14.6017,
    longitude: 120.9721,
};

// Known Philippine cities and regional hubs coordinates
export const KNOWN_PHILIPPINE_LOCATIONS: Record<string, { lat: number; lng: number; displayName: string }> = {
    'binondo': { lat: 14.6017, lng: 120.9721, displayName: 'Binondo, Manila' },
    'manila': { lat: 14.5995, lng: 120.9842, displayName: 'Manila City' },
    'quezon city': { lat: 14.6760, lng: 121.0437, displayName: 'Quezon City' },
    'qc': { lat: 14.6760, lng: 121.0437, displayName: 'Quezon City' },
    'makati': { lat: 14.5547, lng: 121.0244, displayName: 'Makati City' },
    'pasig': { lat: 14.5764, lng: 121.0851, displayName: 'Pasig City' },
    'taguig': { lat: 14.5176, lng: 121.0509, displayName: 'Taguig City (BGC)' },
    'bgc': { lat: 14.5507, lng: 121.0494, displayName: 'Bonifacio Global City, Taguig' },
    'caloocan': { lat: 14.6488, lng: 120.9673, displayName: 'Caloocan City' },
    'mandaluyong': { lat: 14.5794, lng: 121.0359, displayName: 'Mandaluyong City' },
    'san juan': { lat: 14.6019, lng: 121.0355, displayName: 'San Juan City' },
    'marikina': { lat: 14.6507, lng: 121.1029, displayName: 'Marikina City' },
    'pasay': { lat: 14.5378, lng: 121.0014, displayName: 'Pasay City' },
    'valenzuela': { lat: 14.7011, lng: 120.9830, displayName: 'Valenzuela City' },
    'malabon': { lat: 14.6681, lng: 120.9567, displayName: 'Malabon City' },
    'navotas': { lat: 14.6667, lng: 120.9417, displayName: 'Navotas City' },
    'paranaque': { lat: 14.4793, lng: 121.0198, displayName: 'Parañaque City' },
    'parañaque': { lat: 14.4793, lng: 121.0198, displayName: 'Parañaque City' },
    'las pinas': { lat: 14.4445, lng: 120.9939, displayName: 'Las Piñas City' },
    'las piñas': { lat: 14.4445, lng: 120.9939, displayName: 'Las Piñas City' },
    'muntinlupa': { lat: 14.4081, lng: 121.0415, displayName: 'Muntinlupa City' },
    'alabang': { lat: 14.4253, lng: 121.0409, displayName: 'Alabang, Muntinlupa' },
    'antipolo': { lat: 14.5842, lng: 121.1763, displayName: 'Antipolo, Rizal' },
    'cainta': { lat: 14.5768, lng: 121.1218, displayName: 'Cainta, Rizal' },
    'taytay': { lat: 14.5422, lng: 121.1322, displayName: 'Taytay, Rizal' },
    'cavite': { lat: 14.4791, lng: 120.8967, displayName: 'Cavite' },
    'bacoor': { lat: 14.4306, lng: 120.9388, displayName: 'Bacoor, Cavite' },
    'imus': { lat: 14.4296, lng: 120.9367, displayName: 'Imus, Cavite' },
    'dasmarinas': { lat: 14.3294, lng: 120.9367, displayName: 'Dasmariñas, Cavite' },
    'dasmariñas': { lat: 14.3294, lng: 120.9367, displayName: 'Dasmariñas, Cavite' },
    'laguna': { lat: 14.2770, lng: 121.3496, displayName: 'Laguna' },
    'santa rosa': { lat: 14.3122, lng: 121.1114, displayName: 'Santa Rosa, Laguna' },
    'calamba': { lat: 14.2117, lng: 121.1656, displayName: 'Calamba, Laguna' },
    'bulacan': { lat: 14.7943, lng: 120.8799, displayName: 'Bulacan' },
    'meycauayan': { lat: 14.7350, lng: 120.9606, displayName: 'Meycauayan, Bulacan' },
    'san jose del monte': { lat: 14.8139, lng: 121.0453, displayName: 'San Jose del Monte, Bulacan' },
    'pampanga': { lat: 15.0794, lng: 120.6200, displayName: 'Pampanga' },
    'angeles': { lat: 15.1450, lng: 120.5887, displayName: 'Angeles City, Pampanga' },
    'san fernando': { lat: 15.0342, lng: 120.6844, displayName: 'San Fernando, Pampanga' },
    'cebu': { lat: 10.3157, lng: 123.8854, displayName: 'Cebu City' },
    'davao': { lat: 7.1907, lng: 125.4553, displayName: 'Davao City' },
    'iloilo': { lat: 10.7202, lng: 122.5621, displayName: 'Iloilo City' },
    'baguio': { lat: 16.4023, lng: 120.5960, displayName: 'Baguio City' },
    'batangas': { lat: 13.7565, lng: 121.0583, displayName: 'Batangas City' },
};

/**
 * Resolve destination string to geographic coordinates
 */
export function resolveDestinationCoords(destinationName: string | null | undefined): GeoCoordinate {
    if (!destinationName || !destinationName.trim()) {
        return {
            name: 'Quezon City',
            latitude: 14.6760,
            longitude: 121.0437,
        };
    }

    const clean = destinationName.toLowerCase().trim();

    // Check exact or partial key match
    for (const [key, loc] of Object.entries(KNOWN_PHILIPPINE_LOCATIONS)) {
        if (clean === key || clean.includes(key) || key.includes(clean)) {
            return {
                name: destinationName,
                latitude: loc.lat,
                longitude: loc.lng,
            };
        }
    }

    // Pseudo-deterministic coordinates offset around Metro Manila for unknown custom addresses
    let hash = 0;
    for (let i = 0; i < destinationName.length; i++) {
        hash = (hash << 5) - hash + destinationName.charCodeAt(i);
        hash |= 0;
    }
    const latOffset = ((Math.abs(hash) % 100) / 1000) * (hash % 2 === 0 ? 1 : -1);
    const lngOffset = ((Math.abs(hash * 31) % 100) / 1000) * (hash % 3 === 0 ? 1 : -1);

    return {
        name: destinationName,
        latitude: 14.5800 + latOffset,
        longitude: 121.0300 + lngOffset,
    };
}

/**
 * Map delivery status to a progress percentage along the journey.
 * Rules:
 * - received, sorting, ready_for_pickup -> 0% (Parcel is at HQ in Binondo, Manila)
 * - picked_up, in_transit, out_for_delivery, delivered -> Parcel moves along the route outside HQ
 */
export function getStatusProgress(status: string): number {
    const s = status ? status.toLowerCase().replace(/-/g, '_').trim() : 'received';
    switch (s) {
        case 'received':
            return 0;
        case 'sorting':
            return 0;
        case 'ready_for_pickup':
        case 'ready':
            return 0;
        case 'picked_up':
            return 35;
        case 'in_transit':
            return 65;
        case 'out_for_delivery':
            return 85;
        case 'delivered':
            return 100;
        case 'returned':
        case 'cancelled':
            return 100;
        default:
            return 0;
    }
}

/**
 * Generate fallback road curve if OSRM is offline or unreachable
 */
export function generateFallbackRoute(
    origin: GeoCoordinate,
    dest: GeoCoordinate,
    numPoints: number = 30
): [number, number][] {
    const coords: [number, number][] = [];
    const midLat = (origin.latitude + dest.latitude) / 2 + 0.012;
    const midLng = (origin.longitude + dest.longitude) / 2 - 0.008;

    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        // Quadratic Bezier curve to simulate realistic road bend
        const lat = (1 - t) * (1 - t) * origin.latitude + 2 * (1 - t) * t * midLat + t * t * dest.latitude;
        const lng = (1 - t) * (1 - t) * origin.longitude + 2 * (1 - t) * t * midLng + t * t * dest.longitude;
        coords.push([lat, lng]);
    }
    return coords;
}

/**
 * Fetch actual driving route from OSRM public API
 */
export async function fetchOSRMRoute(
    origin: GeoCoordinate,
    dest: GeoCoordinate
): Promise<[number, number][]> {
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${dest.longitude},${dest.latitude}?overview=full&geometries=geojson`;
        const res = await fetch(url, {
            headers: {
                Accept: 'application/json',
            },
            cache: 'force-cache',
        });

        if (!res.ok) {
            throw new Error(`OSRM fetch error status: ${res.status}`);
        }

        const data = await res.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const geojsonCoords: [number, number][] = data.routes[0].geometry.coordinates;
            // Convert [lng, lat] to [lat, lng] for Leaflet
            return geojsonCoords.map(([lng, lat]) => [lat, lng]);
        }
        return generateFallbackRoute(origin, dest);
    } catch (err) {
        console.warn('Using fallback route curve due to OSRM error:', err);
        return generateFallbackRoute(origin, dest);
    }
}

/**
 * Get parcel location name based on status/progress and destination.
 * Statuses at HQ:
 * - received -> "Airship Express HQ (Binondo, Manila)"
 * - sorting -> "Airship Express HQ Sorting Bay (Binondo, Manila)"
 * - ready_for_pickup -> "Airship Express HQ Dispatch Hub (Binondo, Manila)"
 * Statuses outside HQ:
 * - picked_up -> "Picked Up - Dispatched from HQ"
 * - in_transit -> "In Transit to [Destination]"
 * - out_for_delivery -> "Out for Delivery ([Destination])"
 * - delivered -> "Delivered at Destination ([Destination])"
 */
export function getLocalityFromProgress(
    progress: number,
    originName: string,
    destName: string,
    status?: string
): string {
    const s = status ? status.toLowerCase().replace(/-/g, '_').trim() : '';

    if (s === 'received') return 'Airship Express HQ (Binondo, Manila)';
    if (s === 'sorting') return 'Airship Express HQ Sorting Bay (Binondo, Manila)';
    if (s === 'ready_for_pickup' || s === 'ready') return 'Airship Express HQ Dispatch Hub (Binondo, Manila)';
    if (s === 'picked_up') return 'Picked Up - Dispatched from HQ';
    if (s === 'in_transit') return `In Transit to ${destName}`;
    if (s === 'out_for_delivery') return `Out for Delivery (${destName})`;
    if (s === 'delivered') return `Delivered at Destination (${destName})`;

    if (progress <= 0) return 'Airship Express HQ (Binondo, Manila)';
    if (progress <= 35) return 'Dispatched from Binondo HQ';
    if (progress <= 75) return `In Transit to ${destName}`;
    if (progress < 100) return `Out for Delivery (${destName})`;
    return `Delivered at Destination (${destName})`;
}

/**
 * Slice route into completed vs remaining coordinates based on progress percentage
 */
export function splitRouteByProgress(
    route: [number, number][],
    progressPercent: number
): {
    completed: [number, number][];
    remaining: [number, number][];
    currentCoord: [number, number];
} {
    if (!route || route.length === 0) {
        const defaultCoord: [number, number] = [AIRSHIP_HQ.latitude, AIRSHIP_HQ.longitude];
        return {
            completed: [defaultCoord],
            remaining: [defaultCoord],
            currentCoord: defaultCoord,
        };
    }

    if (progressPercent <= 0) {
        return {
            completed: [route[0]],
            remaining: route,
            currentCoord: route[0],
        };
    }

    if (progressPercent >= 100) {
        return {
            completed: route,
            remaining: [route[route.length - 1]],
            currentCoord: route[route.length - 1],
        };
    }

    const indexFloat = (progressPercent / 100) * (route.length - 1);
    const index = Math.floor(indexFloat);
    const fraction = indexFloat - index;

    const currPoint = route[index];
    const nextPoint = route[Math.min(index + 1, route.length - 1)];

    // Interpolated exact current position
    const currentCoord: [number, number] = [
        currPoint[0] + (nextPoint[0] - currPoint[0]) * fraction,
        currPoint[1] + (nextPoint[1] - currPoint[1]) * fraction,
    ];

    const completed = [...route.slice(0, index + 1), currentCoord];
    const remaining = [currentCoord, ...route.slice(index + 1)];

    return { completed, remaining, currentCoord };
}
