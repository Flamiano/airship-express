"use client";

import { Fragment, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "./ThemeProvider";
import { coverageAreas, HQ } from "@/app/lib/coverage-areas";

function makeCityIcon(color: string) {
    return L.divIcon({
        className: "",
        html: `<span class="airship-city-pin" style="--pin-color:${color}"></span>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        popupAnchor: [0, -10],
    });
}

function makeHqIcon() {
    return L.divIcon({
        className: "",
        html: `<span class="airship-hq-pin"><span class="airship-hq-pin-pulse"></span></span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -14],
    });
}

/** Flies the map to the selected city whenever the legend selection changes.
 * Lives inside <MapContainer> so it can use react-leaflet's useMap() hook. */
function FlyToSelection({ target }: { target: { lat: number; lng: number } | null }) {
    const map = useMap();
    useEffect(() => {
        if (target) {
            map.flyTo([target.lat, target.lng], 13, { duration: 0.8 });
        }
    }, [target, map]);
    return null;
}

interface PHCoverageMapProps {
    selectedArea?: string | null;
    onSelectArea?: (name: string) => void;
}

export default function PHCoverageMap({ selectedArea, onSelectArea }: PHCoverageMapProps) {
    const { theme } = useTheme();
    const dark = theme === "dark";

    const icons = useMemo(
        () => Object.fromEntries(coverageAreas.map((a) => [a.name, makeCityIcon(a.color)])),
        []
    );
    const hqIcon = useMemo(makeHqIcon, []);

    const selectedCoords = useMemo(() => {
        const match = coverageAreas.find((a) => a.name === selectedArea);
        return match ? { lat: match.lat, lng: match.lng } : null;
    }, [selectedArea]);

    // CARTO's free basemap tiles — no API key required. Positron for light
    // mode, Dark Matter for dark mode, so the map follows the theme toggle.
    const tileUrl = dark
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

    return (
        <MapContainer
            center={[14.61, 121.0]}
            zoom={11}
            scrollWheelZoom={false}
            zoomControl={false}
            attributionControl={false}
            className="h-full w-full"
        >
            <TileLayer url={tileUrl} attribution="&copy; OpenStreetMap contributors &copy; CARTO" />

            <ZoomControl position="bottomright" />
            <FlyToSelection target={selectedCoords} />

            {/* dashed HQ ring, echoing the dashed-line motif used site-wide */}
            <Circle
                center={[HQ.lat, HQ.lng]}
                radius={9000}
                pathOptions={{
                    color: "#E5167E",
                    weight: 1.5,
                    dashArray: "4 6",
                    fillColor: "#E5167E",
                    fillOpacity: 0.04,
                }}
            />

            <Marker position={[HQ.lat, HQ.lng]} icon={hqIcon}>
                <Popup>
                    <div className="airship-popup">
                        <span className="airship-popup-code" style={{ color: "#E5167E" }}>
                            HQ
                        </span>
                        <strong>Airship Express</strong>
                        <span>Binondo, Manila</span>
                    </div>
                </Popup>
            </Marker>

            {coverageAreas.map((area) => {
                const isSelected = selectedArea === area.name;
                return (
                    <Fragment key={area.name}>
                        {/* colored coverage halo, brighter when selected from the legend */}
                        <Circle
                            center={[area.lat, area.lng]}
                            radius={isSelected ? 2200 : 1500}
                            pathOptions={{
                                color: area.color,
                                weight: isSelected ? 2 : 1.25,
                                dashArray: "3 5",
                                fillColor: area.color,
                                fillOpacity: isSelected ? 0.22 : 0.1,
                            }}
                        />
                        <Marker
                            position={[area.lat, area.lng]}
                            icon={icons[area.name]}
                            eventHandlers={{
                                click: () => onSelectArea?.(area.name),
                            }}
                        >
                            <Popup>
                                <div className="airship-popup">
                                    <span className="airship-popup-code" style={{ color: area.color }}>
                                        Serving
                                    </span>
                                    <span className="airship-popup-title">
                                        <span className="airship-popup-dot" style={{ background: area.color }} />
                                        <strong>{area.name}</strong>
                                    </span>
                                </div>
                            </Popup>
                        </Marker>
                    </Fragment>
                );
            })}
        </MapContainer>
    );
}