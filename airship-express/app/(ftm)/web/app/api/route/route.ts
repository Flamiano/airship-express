import { NextRequest, NextResponse } from "next/server";

type LatLng = { lat: number; lng: number };
type OsrmRoute = { points: LatLng[]; distance: number; duration: number };
const routeCache = new Map<string, OsrmRoute>();

function getLatLng(point: unknown): { lat: number; lng: number } | null {
  if (!point || typeof point !== "object") return null;
  const value = point as Record<string, unknown>;
  const lat = Number(value.lat ?? value.latitude);
  const lng = Number(value.lng ?? value.lon ?? value.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

function validateWaypoints(rawPoints: unknown) {
  const invalid: Array<{ index: number; value: unknown; reason: string }> = [];
  const points: LatLng[] = [];

  if (!Array.isArray(rawPoints)) {
    return { points, invalid };
  }

  rawPoints.forEach((point, index) => {
    const normalized = getLatLng(point);
    if (!normalized) {
      invalid.push({
        index,
        value: point,
        reason: `Stop ${index + 1} has invalid coordinates: ${JSON.stringify(point)}`,
      });
      return;
    }

    points.push(normalized);
  });

  return { points, invalid };
}

async function requestRoute(points: LatLng[]): Promise<OsrmRoute | null> {
  const coordinates = points.map((point) => `${point.lng},${point.lat}`).join(";");
  if (!coordinates) return null;

  const cacheKey = coordinates;
  const cached = routeCache.get(cacheKey);
  if (cached) return cached;

  const endpoints = [
    "https://router.project-osrm.org/route/v1/driving/",
    "https://routing.openstreetmap.de/routed-car/route/v1/driving/",
  ];

  for (const endpoint of endpoints) {
    try {
      const url = new URL(`${endpoint}${coordinates}`);
      url.searchParams.set("overview", "full");
      url.searchParams.set("geometries", "geojson");
      url.searchParams.set("steps", "true");
      url.searchParams.set("annotations", "true");
      url.searchParams.set("alternatives", "false");

      console.error("OSRM route request:", url.toString());
      console.error("OSRM coordinates:", coordinates);

      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });

      const responseBody = await response.text();
      const parsedBody = responseBody ? JSON.parse(responseBody) : null;
      console.error("OSRM response:", response.status, parsedBody);

      if (!response.ok || parsedBody?.code !== "Ok") {
        continue;
      }

      const route = parsedBody?.routes?.[0];
      const geometry = route?.geometry?.coordinates;
      if (!Array.isArray(geometry) || geometry.length < 2) continue;

      const parsedRoute = {
        points: geometry.map(([lng, lat]: [number, number]) => ({ lat, lng })),
        distance: Number(route.distance || 0),
        duration: Number(route.duration || 0),
      };
      routeCache.set(cacheKey, parsedRoute);
      return parsedRoute;
    } catch (error) {
      console.error("OSRM route request failed:", error);
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { points, invalid } = validateWaypoints(body?.waypoints);

    if (invalid.length > 0) {
      return NextResponse.json({
        error: invalid[0].reason,
        invalidStops: invalid,
      }, { status: 400 });
    }

    if (points.length < 2) {
      return NextResponse.json({ error: "Two valid route coordinates are required" }, { status: 400 });
    }

    const deduped = points.filter((point, index) => {
      if (index === 0) return true;
      const previous = points[index - 1];
      return point.lat !== previous.lat || point.lng !== previous.lng;
    });

    const route = await requestRoute(deduped);
    if (!route) {
      return NextResponse.json({
        error: "OSRM could not route the complete route. The request contained invalid or unusable coordinates.",
        coordinates: deduped,
        pointsCount: deduped.length,
      }, { status: 502 });
    }

    return NextResponse.json({
      polyline: route.points,
      distanceKm: Number((route.distance / 1000).toFixed(2)),
      durationMin: Math.ceil(route.duration / 60),
    });
  } catch (error) {
    console.error("OSRM request failed or timed out:", error);
    return NextResponse.json({ error: "OSRM request failed or timed out" }, { status: 502 });
  }
}
