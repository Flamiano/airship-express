"use client";

import dynamic from "next/dynamic";
import type { DashboardVehicle } from "../page";
import type { LeafletMarker } from "../../components/LeafletMap";

const LeafletMap = dynamic(() => import("../../components/LeafletMap"), { ssr: false });

const HUB_POS = { lat: 14.5995, lng: 120.9842 };

export default function MapPanel({ vehicles }: { vehicles: DashboardVehicle[] }) {
  const markers: LeafletMarker[] = vehicles
    .filter((vehicle) => vehicle.locationLat != null && vehicle.locationLng != null)
    .map((vehicle) => ({
      id: `vehicle-${vehicle.id || vehicle.plateNumber || "unknown"}`,
      position: { lat: Number(vehicle.locationLat), lng: Number(vehicle.locationLng) },
      color: "#b80049",
      label: vehicle.plateNumber || vehicle.id || "Vehicle",
      radius: 7,
      meta: {
        title: vehicle.plateNumber || vehicle.id || "Vehicle",
        subtitle: vehicle.vehicleType || "Vehicle",
        details: (
          <div className="space-y-1 text-sm text-slate-600">
            <div>Status: {vehicle.status || "Unknown"}</div>
            <div>Location: {Number(vehicle.locationLat).toFixed(6)}, {Number(vehicle.locationLng).toFixed(6)}</div>
          </div>
        ),
      },
    }));

  return (
    <div className="relative h-full w-full">
      <LeafletMap center={HUB_POS} zoom={4} markers={markers} routeColor="#b80049" />
      {markers.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center">
          <div className="rounded-md border border-slate-200 bg-white/90 px-4 py-2 text-xs text-slate-500 shadow-sm backdrop-blur-sm">
            No live vehicle locations available
          </div>
        </div>
      )}
    </div>
  );
}
