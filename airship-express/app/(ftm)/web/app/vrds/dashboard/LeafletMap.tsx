"use client";

import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from "react-leaflet";
import type { LatLngExpression } from "leaflet";

type MapMarker = {
  id: string;
  position: { lat: number; lng: number };
  color?: string;
  label?: string;
};

type Props = {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  paths?: { lat: number; lng: number }[][];
  routeColor?: string;
};

export default function LeafletMap({
  center,
  zoom = 10,
  markers = [],
  paths = [],
  routeColor = "#b80049",
}: Props) {
  return (
    <MapContainer
      className="h-full w-full"
      center={[center.lat, center.lng] as LatLngExpression}
      zoom={zoom}
      minZoom={3}
      scrollWheelZoom
      zoomControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Circle
        center={[14.5995, 120.9842]}
        radius={10500}
        pathOptions={{
          color: "#ed147d",
          weight: 2,
          dashArray: "5 6",
          fillColor: "#ed147d",
          fillOpacity: 0.08,
        }}
      />
      {paths.map((path, index) => (
        <Polyline
          key={index}
          positions={path.map((point) => [point.lat, point.lng] as LatLngExpression)}
          pathOptions={{ color: routeColor, opacity: 0.85, weight: 3 }}
        />
      ))}
      {markers.map((marker) => (
        <CircleMarker
          key={marker.id}
          center={[marker.position.lat, marker.position.lng]}
          radius={7}
          pathOptions={{
            color: "#ffffff",
            weight: 2,
            fillColor: marker.color || "#b80049",
            fillOpacity: 1,
          }}
        >
          {marker.label && (
            <Tooltip direction="top" offset={[0, -4]}>
              {marker.label}
            </Tooltip>
          )}
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
