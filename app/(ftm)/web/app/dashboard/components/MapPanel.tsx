// @ts-nocheck
"use client";

import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import type { DashboardVehicle } from "../page";

export default function MapPanel({ vehicles }: { vehicles: DashboardVehicle[] }) {
  const locatedVehicles = vehicles.filter((vehicle) => vehicle.locationLat != null && vehicle.locationLng != null);
  const positions = locatedVehicles.map((vehicle) => [Number(vehicle.locationLat), Number(vehicle.locationLng)] as LatLngExpression);
  const center = positions[0] || ([14.5995, 120.9842] as LatLngExpression);

  return (
    <div className="absolute inset-0 z-0">
      <MapContainer
        center={center}
        zoom={4}
        scrollWheelZoom
        className="w-full h-full"
        style={{ background: "#f5faff" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {locatedVehicles.map((vehicle) => (
          <CircleMarker
            key={vehicle.id || vehicle.plateNumber}
            center={[Number(vehicle.locationLat), Number(vehicle.locationLng)]}
            radius={7}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: "#b80049",
              fillOpacity: 0.9,
            }}
          >
            <Popup>
              <div className="font-semibold text-text">{vehicle.plateNumber || vehicle.id || "Vehicle"}</div>
              <div className="text-text-muted">{vehicle.vehicleType || "Vehicle"}</div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      {locatedVehicles.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center">
          <div className="rounded-md border border-border bg-white/90 px-4 py-2 text-xs text-text-muted shadow-sm backdrop-blur-sm">
            No live vehicle locations available
          </div>
        </div>
      )}
    </div>
  );
}
