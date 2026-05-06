"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Circle, useMap, useMapEvents } from "react-leaflet";

type Props = {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
  previewLat?: number | null;
  previewLng?: number | null;
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

function Recenter({
  lat,
  lng,
  previewLat,
  previewLng,
}: {
  lat: number | null;
  lng: number | null;
  previewLat: number | null;
  previewLng: number | null;
}) {
  const map = useMap();
  // Committed value takes priority over preview so dropping a pin or picking a
  // suggestion doesn't get overridden by a stale preview.
  const targetLat = lat ?? previewLat;
  const targetLng = lng ?? previewLng;
  useEffect(() => {
    if (targetLat != null && targetLng != null) {
      map.flyTo([targetLat, targetLng], Math.max(map.getZoom(), 11), { duration: 0.6 });
    }
  }, [targetLat, targetLng, map]);
  return null;
}

export default function LocationPickerMap({
  lat,
  lng,
  onPick,
  previewLat = null,
  previewLng = null,
}: Props) {
  const initialLat = lat ?? previewLat;
  const initialLng = lng ?? previewLng;
  const center: [number, number] =
    initialLat != null && initialLng != null ? [initialLat, initialLng] : DEFAULT_CENTER;
  const zoom = initialLat != null && initialLng != null ? 12 : DEFAULT_ZOOM;
  return (
    <div className="relative w-full overflow-hidden rounded-glass border border-white/10">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        className="aspect-[16/9] w-full cursor-crosshair"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <ClickHandler onPick={onPick} />
        <Recenter lat={lat} lng={lng} previewLat={previewLat} previewLng={previewLng} />
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
