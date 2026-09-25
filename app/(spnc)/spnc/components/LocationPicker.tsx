"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { X, Search, MapPin, Loader2, Satellite, Map as MapIcon } from "lucide-react";

// Leaflet needs the browser's window object, so load the map client-side only
const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });

type Props = {
  isDark: boolean;
  initialLabel?: string;
  initialPosition?: [number, number] | null;
  otherPosition?: [number, number] | null;
  onSelect: (label: string, position: [number, number]) => void;
  onClose: () => void;
};

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
};

type LayerType = "street" | "satellite";

export default function LocationPicker({ isDark, initialLabel, initialPosition, otherPosition, onSelect, onClose }: Props) {
  const [query, setQuery] = useState(initialLabel || "");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [position, setPosition] = useState<[number, number]>(initialPosition || [14.5995, 120.9842]); // default: Manila
  const [selectedLabel, setSelectedLabel] = useState(initialLabel || "");
  const [layerType, setLayerType] = useState<LayerType>("street");
  const [zoomToSearchResult, setZoomToSearchResult] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function searchPlaces(searchQuery: string, moveToMap = false) {
    if (!searchQuery.trim() || searchQuery === selectedLabel) {
      setResults([]);
      return;
    }

    setResults([]);
    setSearching(true);
    try {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`,
    {
      headers: { "Accept-Language": "en" }
    }
  );

  const data = await res.json();
    
      if (moveToMap && data.length > 0) {
        pickResult(data[0], true);
      } else {
        setResults(data);
      }
    } catch (err) {
      console.error("Nominatim search failed:", err);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  // Debounced search-as-you-type against Nominatim (free, no API key)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query === selectedLabel) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => searchPlaces(query), 400);
  }, [query, selectedLabel]);

  function pickResult(r: NominatimResult, isSearchResult = false) {
    setPosition([parseFloat(r.lat), parseFloat(r.lon)]);
    setSelectedLabel(r.display_name);
    setQuery(r.display_name);
    setResults([]);
    setZoomToSearchResult(isSearchResult);
  }

  function clearSearch() {
    setQuery("");
    setResults([]);
    setSelectedLabel("");
  }

  async function reverseGeocode(lat: number, lon: number) {
    try {
      const res = await fetch(
  `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
  {
    headers: { "Accept-Language": "en" }
  }
      );
      const data = await res.json();
      const label = data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      setSelectedLabel(label);
      setQuery(label);
    } catch (err) {
      console.error("Reverse geocode failed:", err);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div
        className={`flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border ${
          isDark ? "border-[#23303D] bg-[#121B26]" : "border-gray-200 bg-white"
        }`}
      >
        <div className="flex items-center justify-between border-b p-4">
          <h3 className={`text-lg font-semibold ${isDark ? "text-[#F2F1EC]" : "text-gray-900"}`}>
            Pick a location
          </h3>
          <button type="button" onClick={onClose} className={isDark ? "text-[#8FA0AF]" : "text-gray-400"}>
            <X size={20} />
          </button>
        </div>

        <div className="relative z-[1000] border-b p-4">
          <div
            className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
              isDark ? "border-[#2C4356] bg-[#0B1220]" : "border-gray-300 bg-white"
            }`}
          >
            <Search size={16} className={isDark ? "text-[#8FA0AF]" : "text-gray-400"} />
            <input
              type="text"
              placeholder="Search for a place or address…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  searchPlaces(query, true);
                }
              }}
              className={`w-full bg-transparent text-sm outline-none ${
                isDark ? "text-[#F2F1EC] placeholder:text-[#4B5A68]" : "text-gray-900 placeholder:text-gray-400"
              }`}
            />
            {query && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear search"
                className={`shrink-0 transition ${
                  isDark ? "text-[#4B5A68] hover:text-[#8FA0AF]" : "text-gray-300 hover:text-gray-500"
                }`}
              >
                <X size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={() => searchPlaces(query, true)}
              disabled={searching || !query.trim()}
              className="shrink-0 rounded-md bg-[#F2419B] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#F55CAB] disabled:cursor-not-allowed disabled:bg-[#4B5A68]"
            >
              {searching ? <Loader2 size={16} className="animate-spin" /> : "Search"}
            </button>
          </div>

          {results.length > 0 && (
            <div
              className={`absolute left-4 right-4 z-[1001] mt-1 max-h-48 overflow-y-auto rounded-md border shadow-lg ${
                isDark ? "border-[#2C4356] bg-[#121B26]" : "border-gray-300 bg-white"
              }`}
            >
              {results.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickResult(r)}
                  className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition ${
                    isDark ? "text-[#C7D1DA] hover:bg-[#1A2530]" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <MapPin size={14} className="mt-0.5 shrink-0" />
                  {r.display_name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative h-96 w-full">
          <button
            type="button"
            onClick={() => setLayerType((t) => (t === "street" ? "satellite" : "street"))}
            className={`absolute top-3 right-3 z-[500] flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold shadow-md transition ${
              isDark
                ? "bg-[#121B26] text-[#F2F1EC] hover:bg-[#1A2530]"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {layerType === "street" ? (
              <>
                <Satellite size={14} />
                Satellite
              </>
            ) : (
              <>
                <MapIcon size={14} />
                Street
              </>
            )}
          </button>

          <MapClickLayer
            position={position}
            otherPosition={otherPosition}
            zoomToSearchResult={zoomToSearchResult}
            layerType={layerType}
            onPick={(lat, lon) => {
              setPosition([lat, lon]);
              setZoomToSearchResult(false);
              reverseGeocode(lat, lon);
            }}
          />
        </div>

        <div className={`flex items-center justify-between gap-3 border-t p-4 ${isDark ? "border-[#23303D]" : "border-gray-200"}`}>
          <p className={`truncate text-sm ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
            {selectedLabel || "Search or click the map to select a location"}
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`rounded-md border px-4 py-2 text-sm font-medium ${
                isDark ? "border-[#2C4356] text-[#C7D1DA]" : "border-gray-300 text-gray-600"
              }`}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedLabel}
              onClick={() => onSelect(selectedLabel, position)}
              className="rounded-md bg-[#F2419B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#F55CAB] disabled:cursor-not-allowed disabled:bg-[#4B5A68]"
            >
              Use this location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Small client-only wrapper so we can use react-leaflet hooks safely with next/dynamic
function MapClickLayer({
  position,
  otherPosition,
  zoomToSearchResult,
  layerType,
  onPick,
}: {
  position: [number, number];
  otherPosition?: [number, number] | null;
  zoomToSearchResult: boolean;
  layerType: LayerType;
  onPick: (lat: number, lon: number) => void;
}) {
  const [Comp, setComp] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const L = await import("leaflet");
      const RL = await import("react-leaflet");
      await import("leaflet/dist/leaflet.css");

      // Fix default marker icon paths (common Leaflet + bundler issue)
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      function ClickHandler({ onCurrentPick }: { onCurrentPick: (lat: number, lon: number) => void }) {
        RL.useMapEvents({
          click(e: any) {
            onCurrentPick(e.latlng.lat, e.latlng.lng);
          },
        });
        return null;
      }

      function MapPosition({
        currentPosition,
        otherCurrentPosition,
        shouldZoomToSearchResult,
      }: {
        currentPosition: [number, number];
        otherCurrentPosition?: [number, number] | null;
        shouldZoomToSearchResult: boolean;
      }) {
        const map = RL.useMap();

        useEffect(() => {
          if (otherCurrentPosition && !shouldZoomToSearchResult) {
            map.fitBounds([currentPosition, otherCurrentPosition], { padding: [30, 30] });
          } else {
            map.flyTo(currentPosition, 17, { duration: 1.2 });
          }
        }, [map, currentPosition, otherCurrentPosition, shouldZoomToSearchResult]);

        return null;
      }

      if (mounted) {
        setComp(() => ({
          currentPosition,
          otherCurrentPosition,
          shouldZoomToSearchResult,
          onCurrentPick,
          currentLayerType,
        }: {
          currentPosition: [number, number];
          otherCurrentPosition?: [number, number] | null;
          shouldZoomToSearchResult: boolean;
          onCurrentPick: (lat: number, lon: number) => void;
          currentLayerType: LayerType;
        }) => (
          <RL.MapContainer center={currentPosition} zoom={13} style={{ height: "100%", width: "100%" }}>
            {currentLayerType === "satellite" ? (
              <RL.TileLayer
                attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            ) : (
              <RL.TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            )}
            <RL.Marker position={currentPosition} />
            {otherCurrentPosition && <RL.Marker position={otherCurrentPosition} />}
            <MapPosition
              currentPosition={currentPosition}
              otherCurrentPosition={otherCurrentPosition}
              shouldZoomToSearchResult={shouldZoomToSearchResult}
            />
            <ClickHandler onCurrentPick={onCurrentPick} />
          </RL.MapContainer>
        ));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!Comp) {
    return <div className="flex h-full items-center justify-center text-sm text-gray-400">Loading map…</div>;
  }

  return (
    <Comp
      currentPosition={position}
      otherCurrentPosition={otherPosition}
      shouldZoomToSearchResult={zoomToSearchResult}
      onCurrentPick={onPick}
      currentLayerType={layerType}
    />
  );
}
