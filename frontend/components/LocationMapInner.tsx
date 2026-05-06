"use client";

import { MapContainer, TileLayer, Circle } from "react-leaflet";

type Props = {
  lat: number;
  lng: number;
};

export default function LocationMapInner({ lat, lng }: Props) {
  return (
    <div className="relative w-full overflow-hidden rounded-glass border border-white/10">
      <MapContainer
        center={[lat, lng]}
        zoom={12}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        touchZoom={false}
        zoomControl={false}
        attributionControl={false}
        className="aspect-[16/7] w-full"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <Circle
          center={[lat, lng]}
          radius={1500}
          pathOptions={{
            color: "#34d399",
            fillColor: "#34d399",
            fillOpacity: 0.35,
            weight: 1,
          }}
        />
      </MapContainer>
    </div>
  );
}
