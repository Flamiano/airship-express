"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";

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
  markers?: LeafletMarker[];
  paths?: LatLng[][];
  directionPath?: LatLng[][];
  initialPath?: LatLng[] | null;
  optimizedPath?: LatLng[] | null;
  routeColor?: string;
  coloredPaths?: Array<{ points: LatLng[]; color: string; label?: string }>;
  onlyColoredPaths?: boolean;
  className?: string;
  onMarkerClick?: (marker: LeafletMarker) => void;
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
  center,
  zoom = 11,
  markers = [],
  paths = [],
  directionPath = [],
  initialPath,
  optimizedPath,
  routeColor = "#b80049",
  coloredPaths = [],
  onlyColoredPaths = false,
  className = "w-full h-full min-h-[420px] rounded-2xl overflow-hidden shadow-inner border border-slate-200",
  onMarkerClick,
}: LeafletMapProps) {
  const PHILIPPINES_BOUNDS = L.latLngBounds(
    [4.5, 116.0],
    [21.5, 127.0],
  );
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const routesLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Initialize Leaflet Map instance
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      fadeAnimation: true,
      markerZoomAnimation: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
    });

    if (center) {
      map.setView([center.lat, center.lng], zoom);
    } else {
      map.fitBounds(PHILIPPINES_BOUNDS, {
        padding: [20, 20],
        maxZoom: 7,
      });
    }

    // Add zoom control in top-right corner
    L.control.zoom({ position: "topright" }).addTo(map);

    // Public OpenStreetMap basemap without a provider API key.
    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
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
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Only set view on initial load, don't auto-pan on center/zoom changes
    // User controls view manually
  }, [center, zoom]);

  // Update Markers with Glow and Blink Animations
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = markersLayerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    if (markers.length === 0) return;

    const bounds = L.latLngBounds([]);

    markers.forEach((m) => {
      if (!m.position || !Number.isFinite(m.position.lat) || !Number.isFinite(m.position.lng)) return;

      const latLng: [number, number] = [m.position.lat, m.position.lng];
      bounds.extend(latLng);

      const color = m.color || "#3b82f6";
      const icon = createGlowingIcon(color, m.label, m.isVehicle);

      const marker = L.marker(latLng, { icon });

      const popupText = typeof m.label === "string"
        ? m.label
        : m.meta?.title || m.meta?.subtitle || "Mission";

      if (popupText) {
        marker.bindPopup(`
          <div class="px-1 py-0.5 text-xs font-semibold text-slate-800">
            ${popupText}
          </div>
        `, {
          offset: L.point(0, -10),
          className: "animated-popup"
        });
      }

      if (onMarkerClick) {
        marker.on("click", () => onMarkerClick(m));
      }

      marker.addTo(layerGroup);
    });

    // Don't auto-fit to markers - user controls zoom manually
    // if (bounds.isValid()) {
    //   map.flyToBounds(bounds, {
    //     padding: [50, 50],
    //     maxZoom: 14,
    //     duration: 1.2,
    //     easeLinearity: 0.25,
    //   });
    // }
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
      coloredPaths.forEach(({ points, color }) => {
        const latLngs = points.map((pt) => [pt.lat, pt.lng] as [number, number]);
        if (latLngs.length > 1) {
          const glowHalo = L.polyline(latLngs, {
            color: color,
            weight: 10,
            opacity: 0.35,
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