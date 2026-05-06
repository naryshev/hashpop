"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Circle, useMap, useMapEvents } from "react-leaflet";

type Props = {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
};

const DEFAULT_CENTER: [number, number] = [34.05, -118.24];
const DEFAULT_ZOOM = 4;

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recenter({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lng != null) {
      map.flyTo([lat, lng], Math.max(map.getZoom(), 11), { duration: 0.6 });
    }
  }, [lat, lng, map]);
  return null;
}

export default function LocationPickerMap({ lat, lng, onPick }: Props) {
  const center: [number, number] = lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER;
  const zoom = lat != null && lng != null ? 12 : DEFAULT_ZOOM;
  return (
    <div className="relative w-full overflow-hidden rounded-glass border border-white/10">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        className="aspect-[16/9] w-full cursor-crosshair"
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <ClickHandler onPick={onPick} />
        <Recenter lat={lat} lng={lng} />
        {lat != null && lng != null && (
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
        )}
      </MapContainer>
    </div>
  );
}
