"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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
  className?: string;
  onMarkerClick?: (marker: LeafletMarker) => void;
}

/**
 * Creates custom HTML divIcon with glowing aura and blinking beacon ring
 */
function createGlowingIcon(color: string = "#3b82f6", label?: React.ReactNode) {
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
      <div class="marker-pin-dot" style="background-color: ${color}; color: ${color};"></div>
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
  className = "w-full h-full min-h-[420px] rounded-2xl overflow-hidden shadow-inner border border-slate-200",
  onMarkerClick,
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const routesLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const [hoveredMarker, setHoveredMarker] = useState<LeafletMarker | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

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
    }).setView(
      center ? [center.lat, center.lng] : [14.5995, 120.9745],
      center ? zoom : 11,
    );

    // Add zoom control in top-right corner
    L.control.zoom({ position: "topright" }).addTo(map);

    // Clean, modern vector light basemap (CartoDB Positron)
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 25,
        subdomains: "abcd",
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      }
    ).addTo(map);

    markersLayerGroupRef.current = L.layerGroup().addTo(map);
    routesLayerGroupRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
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
      const icon = createGlowingIcon(color, m.label);

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

      // Add hover events for modal using Leaflet events
      marker.on("mouseover", () => {
        setHoveredMarker(m);
        setTimeout(() => {
          const markerElement = marker.getElement();
          if (markerElement) {
            const rect = markerElement.getBoundingClientRect();
            setHoverPosition({
              x: rect.left + window.scrollX + rect.width / 2,
              y: rect.top + window.scrollY - 10
            });
          }
        }, 0);
      });

      marker.on("mouseout", () => {
        setHoveredMarker(null);
      });

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

    // If coloredPaths provided, draw those with their specific colors
    if (coloredPaths.length > 0) {
      coloredPaths.forEach(({ points, color }) => {
        const latLngs = points.map((pt) => [pt.lat, pt.lng] as [number, number]);
        if (latLngs.length > 1) {
          // 1. Layer 1: Outer Glowing Aura Polyline
          const glowHalo = L.polyline(latLngs, {
            color: color,
            weight: 10,
            opacity: 0.35,
            lineCap: "round",
            lineJoin: "round",
            className: "glow-path-layer",
          });

          // 2. Layer 2: Main Solid Line
          const mainLine = L.polyline(latLngs, {
            color: color,
            weight: 4,
            opacity: 0.9,
            lineCap: "round",
            lineJoin: "round",
          });

          // 3. Layer 3: Moving Animated Dash Stream
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
    } else {
      // Legacy behavior: use regular paths/directionPath
      const pathsToDraw: Array<{ points: LatLng[]; isOptimized: boolean }> = [];

      const routeInput = paths.length > 0 ? paths : directionPath;

      if (optimizedPath && optimizedPath.length > 1) {
        pathsToDraw.push({ points: optimizedPath, isOptimized: true });
      } else if (initialPath && initialPath.length > 1) {
        pathsToDraw.push({ points: initialPath, isOptimized: false });
      } else if (routeInput.length > 0) {
        routeInput.forEach((p) => {
          if (p && p.length > 1) pathsToDraw.push({ points: p, isOptimized: true });
        });
      }

      pathsToDraw.forEach(({ points, isOptimized }) => {
        const latLngs = points.map((pt) => [pt.lat, pt.lng] as [number, number]);

        if (isOptimized) {
          // 1. Layer 1: Outer Glowing Aura Polyline
          const glowHalo = L.polyline(latLngs, {
            color: routeColor,
            weight: 10,
            opacity: 0.35,
            lineCap: "round",
            lineJoin: "round",
            className: "glow-path-layer",
          });

          // 2. Layer 2: Main Solid Line
          const mainLine = L.polyline(latLngs, {
            color: routeColor,
            weight: 4,
            opacity: 0.9,
            lineCap: "round",
            lineJoin: "round",
          });

          // 3. Layer 3: Moving Animated Dash Stream
          const flowingDash = L.polyline(latLngs, {
            color: "#ffffff",
            weight: 2,
            opacity: 0.95,
            className: "animated-route-flow",
          });

          glowHalo.addTo(layerGroup);
          mainLine.addTo(layerGroup);
          flowingDash.addTo(layerGroup);
        } else {
          // Unoptimized / Initial preview path (Dashed subtle line)
          const previewLine = L.polyline(latLngs, {
            color: "#64748b",
            weight: 3,
            opacity: 0.7,
            dashArray: "6, 8",
            lineCap: "round",
          });
          previewLine.addTo(layerGroup);
        }
      });
    }
  }, [directionPath, initialPath, optimizedPath, paths, routeColor, coloredPaths]);

  return (
    <>
      <div style={{ position: "relative", display: "block", width: "100%", height: "100%", minHeight: "100%" }}>
        <div ref={mapContainerRef} className={className} style={{ width: "100%", height: "100%" }} />
      </div>
      
      {/* Hover Modal - Bottom right corner for better visibility */}
      {hoveredMarker && (
        <div 
          className="fixed z-[9000] pointer-events-none bottom-6 right-6"
        >
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 p-4 w-80 pointer-events-auto max-h-96 overflow-y-auto">
            {hoveredMarker.isHub && (
              <div className="inline-block px-2 py-1 bg-pink-100 text-pink-700 text-[10px] font-bold rounded-full mb-2">
                ORIGIN HUB
              </div>
            )}
            
            <div className="space-y-2">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  {hoveredMarker.meta?.title || hoveredMarker.meta?.subtitle || "Mission"}
                </h4>
                {hoveredMarker.meta?.subtitle && (
                  <p className="text-xs text-slate-600">{hoveredMarker.meta.subtitle}</p>
                )}
              </div>

              {hoveredMarker.meta?.details && (
                <div className="text-xs text-slate-600 space-y-1">
                  {hoveredMarker.meta.details}
                </div>
              )}

              {!hoveredMarker.meta?.details && (
                <div className="pt-2 border-t border-slate-200 text-xs text-slate-500 font-mono space-y-1">
                  <div>
                    <span className="text-slate-400">Lat:</span> {hoveredMarker.position.lat.toFixed(6)}
                  </div>
                  <div>
                    <span className="text-slate-400">Lng:</span> {hoveredMarker.position.lng.toFixed(6)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}