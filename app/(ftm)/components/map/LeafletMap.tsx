"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  METRO_MANILA_MAP_CENTER,
  METRO_MANILA_MAP_DEFAULT_ZOOM,
  METRO_MANILA_MAP_MIN_ZOOM,
  OPENSTREETMAP_TILE_MAX_ZOOM,
} from "../../lib/metroManilaGeo";

type LatLng = { lat: number; lng: number };

export type MapMarker = {
  id: string;
  position: LatLng;
  color?: string;
  label?: string;
};

export type LeafletMarker = {
  id: string;
  position: LatLng;
  color?: string;
  label?: React.ReactNode;
  radius?: number;
  isHub?: boolean;
  isVehicle?: boolean;
  meta?: {
    title?: string;
    subtitle?: string;
    details?: React.ReactNode;
  };
};

interface LeafletMapProps {
  center?: LatLng;
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  zoomSnap?: number;
  zoomDelta?: number;
  markers?: LeafletMarker[];
  paths?: LatLng[][];
  directionPath?: LatLng[][];
  initialPath?: LatLng[] | null;
  optimizedPath?: LatLng[] | null;
  focusKey?: string | null;
  focusPoints?: LatLng[];
  focusZoom?: number;
  focusMaxZoom?: number;
  routeColor?: string;
  coloredPaths?: Array<{ points: LatLng[]; color: string; label?: string; dashArray?: string }>;
  onlyColoredPaths?: boolean;
  className?: string;
  onMarkerClick?: (marker: LeafletMarker) => void;
  onMapClick?: (position: LatLng) => void;
}

/**
 * Creates custom HTML divIcon with glowing aura and blinking beacon ring
 */
function createGlowingIcon(color: string = "#3b82f6", label?: React.ReactNode, isVehicle = false) {
  const safeLabel = typeof label === "string" || typeof label === "number" ? String(label) : "";
  const lowerLabel = safeLabel.toLowerCase();
  const isOrigin = lowerLabel.includes("origin");
  const isDest = lowerLabel.includes("destination");

  // Extract number or stop index if available
  const matchNum = safeLabel.match(/^\d+/);
  const stopNum = matchNum ? matchNum[0] : isOrigin ? "A" : isDest ? "B" : "•";

  const html = `
    <div class="leaflet-glow-marker" style="color: ${color}; pointer-events: auto;">
      <div class="marker-ping-ring"></div>
      ${isVehicle
        ? `<div class="marker-vehicle-icon flex items-center justify-center rounded-full border-2 border-white shadow-lg" style="background-color: ${color}; color: white; width: 30px; height: 30px; transform: translate(-3px, -3px);"><span class="material-symbols-outlined" style="font-size: 17px; line-height: 1;">local_shipping</span></div>`
        : `<div class="marker-pin-dot" style="background-color: ${color}; color: ${color};"></div>`}
      <div class="marker-badge-pulse flex items-center justify-center absolute -top-5 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-lg border border-white/80 whitespace-nowrap"
           style="background-color: ${color};">
        ${stopNum}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "custom-glowing-leaflet-marker",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export default function LeafletMap({
  center = METRO_MANILA_MAP_CENTER,
  zoom = METRO_MANILA_MAP_DEFAULT_ZOOM,
  minZoom = METRO_MANILA_MAP_MIN_ZOOM,
  maxZoom = OPENSTREETMAP_TILE_MAX_ZOOM,
  zoomSnap = 0.25,
  zoomDelta = 0.5,
  markers = [],
  paths = [],
  directionPath = [],
  initialPath,
  optimizedPath,
  focusKey,
  focusPoints = [],
  focusZoom,
  focusMaxZoom = 14,
  routeColor = "#b80049",
  coloredPaths = [],
  onlyColoredPaths = false,
  className = "w-full h-full min-h-[420px] rounded-2xl overflow-hidden shadow-inner border border-slate-200",
  onMarkerClick,
  onMapClick,
}: LeafletMapProps) {
  const supportedMaxZoom = Math.min(maxZoom, OPENSTREETMAP_TILE_MAX_ZOOM);
  const supportedMinZoom = Math.min(minZoom, supportedMaxZoom);
  const hasInitialFocusPoints = focusPoints.length > 0;
  const initialMapOptionsRef = useRef({
    center: hasInitialFocusPoints ? center : METRO_MANILA_MAP_CENTER,
    zoom: hasInitialFocusPoints ? zoom : METRO_MANILA_MAP_DEFAULT_ZOOM,
    minZoom: supportedMinZoom,
    maxZoom: supportedMaxZoom,
    zoomSnap,
    zoomDelta,
  });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const routesLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const markerInstancesRef = useRef(new Map<string, L.Marker>());
  const markerIconsRef = useRef(new Map<string, string>());
  const markerPopupsRef = useRef(new Map<string, string>());
  const focusedKeyRef = useRef<string | null>(null);
  const focusPointsRef = useRef(focusPoints);
  const [mapReady, setMapReady] = useState(false);
  const onMapClickRef = useRef(onMapClick);
  const onMarkerClickRef = useRef(onMarkerClick);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
  }, [onMarkerClick]);

  useEffect(() => {
    focusPointsRef.current = focusPoints;
  }, [focusPoints]);

  // Initialize Leaflet Map instance
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const markerInstances = markerInstancesRef.current;
    const markerIcons = markerIconsRef.current;
    const markerPopups = markerPopupsRef.current;
    const initialMapOptions = initialMapOptionsRef.current;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      fadeAnimation: true,
      markerZoomAnimation: true,
      zoomAnimation: true,
      minZoom: initialMapOptions.minZoom,
      maxZoom: initialMapOptions.maxZoom,
      zoomSnap: initialMapOptions.zoomSnap,
      zoomDelta: initialMapOptions.zoomDelta,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
    });

    if (initialMapOptions.center) {
      map.setView(
        [initialMapOptions.center.lat, initialMapOptions.center.lng],
        Math.min(
          initialMapOptions.maxZoom,
          Math.max(initialMapOptions.minZoom, initialMapOptions.zoom)
        )
      );
    } else {
      map.fitBounds(L.latLngBounds([4.5, 116.0], [21.5, 127.0]), {
        padding: [20, 20],
        maxZoom: 7,
      });
    }

    // Add zoom control in top-right corner
    L.control.zoom({ position: "topright" }).addTo(map);

    // Public OpenStreetMap basemap without a provider API key.
    L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: initialMapOptions.maxZoom,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }
    ).addTo(map);

    markersLayerGroupRef.current = L.layerGroup().addTo(map);
    routesLayerGroupRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    setMapReady(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerInstances.clear();
      markerIcons.clear();
      markerPopups.clear();
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady || !onMapClick) return;
    const handleClick = (event: L.LeafletMouseEvent) => {
      onMapClickRef.current?.({ lat: event.latlng.lat, lng: event.latlng.lng });
    };
    map.on("click", handleClick);
    return () => { map.off("click", handleClick); };
  }, [mapReady, onMapClick]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady || !focusKey || focusedKeyRef.current === focusKey) return;
    const points = focusPointsRef.current.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
    if (!points.length) return;
    focusedKeyRef.current = focusKey;
    if (points.length === 1) {
      const targetZoom = focusZoom ?? Math.max(map.getZoom(), 14);
      map.flyTo(
        [points[0].lat, points[0].lng],
        Math.min(supportedMaxZoom, Math.max(supportedMinZoom, targetZoom)),
        { duration: 0.9 }
      );
      return;
    }
    map.flyToBounds(L.latLngBounds(points.map((point) => [point.lat, point.lng] as [number, number])), {
      padding: [56, 56],
      maxZoom: Math.min(focusMaxZoom, supportedMaxZoom),
      duration: 0.9,
    });
  }, [focusKey, mapReady, focusMaxZoom, focusZoom, supportedMaxZoom, supportedMinZoom]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Only set view on initial load, don't auto-pan on center/zoom changes
    // User controls view manually
  }, [center, zoom]);

  // Update existing markers in place so live GPS fixes move smoothly.
  useEffect(() => {
    const layerGroup = markersLayerGroupRef.current;
    if (!mapInstanceRef.current || !layerGroup) return;

    const activeIds = new Set<string>();

    markers.forEach((m) => {
      if (!m.position || !Number.isFinite(m.position.lat) || !Number.isFinite(m.position.lng)) return;

      const latLng: [number, number] = [m.position.lat, m.position.lng];
      const color = m.color || "#3b82f6";
      const labelKey = typeof m.label === "string" || typeof m.label === "number" ? String(m.label) : "";
      const iconKey = `${color}:${labelKey}:${Boolean(m.isVehicle)}`;
      const popupText = typeof m.label === "string"
        ? m.label
        : m.meta?.title || m.meta?.subtitle || "Mission";
      let marker = markerInstancesRef.current.get(m.id);

      if (!marker) {
        marker = L.marker(latLng, { icon: createGlowingIcon(color, m.label, m.isVehicle) }).addTo(layerGroup);
        markerInstancesRef.current.set(m.id, marker);
        markerIconsRef.current.set(m.id, iconKey);
        marker.getElement()?.style.setProperty("transition", "transform 1s linear");
      } else {
        const currentPosition = marker.getLatLng();
        if (currentPosition.lat !== latLng[0] || currentPosition.lng !== latLng[1]) marker.setLatLng(latLng);
        marker.getElement()?.style.setProperty("transition", "transform 1s linear");
        if (markerIconsRef.current.get(m.id) !== iconKey) {
          marker.setIcon(createGlowingIcon(color, m.label, m.isVehicle));
          markerIconsRef.current.set(m.id, iconKey);
          marker.getElement()?.style.setProperty("transition", "transform 1s linear");
        }
      }
      activeIds.add(m.id);

      if (popupText && markerPopupsRef.current.get(m.id) !== popupText) {
        marker.bindPopup(`
          <div class="px-1 py-0.5 text-xs font-semibold text-slate-800">
            ${popupText}
          </div>
        `, {
          offset: L.point(0, -10),
          className: "animated-popup"
        });
        markerPopupsRef.current.set(m.id, popupText);
      }

      marker.off("click");
      marker.on("click", () => onMarkerClickRef.current?.(m));
    });

    markerInstancesRef.current.forEach((marker, id) => {
      if (activeIds.has(id)) return;
      layerGroup.removeLayer(marker);
      markerInstancesRef.current.delete(id);
      markerIconsRef.current.delete(id);
      markerPopupsRef.current.delete(id);
    });
  }, [markers, onMarkerClick]);

  // Render Polylines with Flowing Animations and Glowing Halos
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = routesLayerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    const explicitRoute = optimizedPath && optimizedPath.length > 1
      ? optimizedPath
      : initialPath && initialPath.length > 1
      ? initialPath
      : null;

    if (explicitRoute) {
      const latLngs = explicitRoute.map((pt) => [pt.lat, pt.lng] as [number, number]);

      const glowHalo = L.polyline(latLngs, {
        color: routeColor,
        weight: 10,
        opacity: 0.35,
        lineCap: "round",
        lineJoin: "round",
        className: "glow-path-layer",
      });

      const mainLine = L.polyline(latLngs, {
        color: routeColor,
        weight: 4,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
      });

      const flowingDash = L.polyline(latLngs, {
        color: "#ffffff",
        weight: 2,
        opacity: 0.95,
        className: "animated-route-flow",
      });

      glowHalo.addTo(layerGroup);
      mainLine.addTo(layerGroup);
      flowingDash.addTo(layerGroup);
      return;
    }

    if (coloredPaths.length > 0) {
      coloredPaths.forEach(({ points, color, dashArray }) => {
        const latLngs = points.map((pt) => [pt.lat, pt.lng] as [number, number]);
        if (latLngs.length > 1) {
          const glowHalo = L.polyline(latLngs, {
            color: color,
            weight: 10,
            opacity: dashArray ? 0.12 : 0.35,
            lineCap: "round",
            lineJoin: "round",
            className: "glow-path-layer",
          });

          const mainLine = L.polyline(latLngs, {
            color: color,
            weight: 4,
            opacity: 0.9,
            lineCap: "round",
            lineJoin: "round",
            dashArray,
          });

          glowHalo.addTo(layerGroup);
          mainLine.addTo(layerGroup);
          if (!dashArray) {
            L.polyline(latLngs, {
              color: "#ffffff",
              weight: 2,
              opacity: 0.95,
              className: "animated-route-flow",
            }).addTo(layerGroup);
          }
        }
      });
      return;
    }

    if (onlyColoredPaths) return;

    const routeInput = paths.length > 0 ? paths : directionPath;
    if (routeInput.length === 0) return;

    routeInput.forEach((p) => {
      if (!p || p.length <= 1) return;
      const latLngs = p.map((pt) => [pt.lat, pt.lng] as [number, number]);
      const glowHalo = L.polyline(latLngs, {
        color: routeColor,
        weight: 10,
        opacity: 0.35,
        lineCap: "round",
        lineJoin: "round",
        className: "glow-path-layer",
      });

      const mainLine = L.polyline(latLngs, {
        color: routeColor,
        weight: 4,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
      });

      const flowingDash = L.polyline(latLngs, {
        color: "#ffffff",
        weight: 2,
        opacity: 0.95,
        className: "animated-route-flow",
      });

      glowHalo.addTo(layerGroup);
      mainLine.addTo(layerGroup);
      flowingDash.addTo(layerGroup);
    });
  }, [directionPath, initialPath, optimizedPath, paths, routeColor, coloredPaths, onlyColoredPaths, mapReady]);

  return (
    <div style={{ position: "relative", display: "block", width: "100%", height: "100%", minHeight: "100%" }}>
      <div ref={mapContainerRef} className={className} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}