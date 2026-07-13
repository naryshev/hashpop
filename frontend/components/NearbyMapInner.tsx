"use client";

import { MapContainer, TileLayer, Circle, CircleMarker, Popup } from "react-leaflet";
import Link from "next/link";
import { listingHref } from "../lib/listingUrl";
import { formatPriceForDisplay } from "../lib/formatPrice";

export type NearbyItem = {
  id: string;
  title: string | null;
  price: string | null;
  lat: number;
  lng: number;
};

type Props = {
  center: [number, number];
  userPos: [number, number] | null;
  items: NearbyItem[];
};

export default function NearbyMapInner({ center, userPos, items }: Props) {
  return (
    <MapContainer
      center={center}
      zoom={11}
      scrollWheelZoom
      className="h-full w-full"
      // Inline style beats leaflet.css's default #ddd canvas, which otherwise
      // flashes light while the dark tiles are still downloading.
      style={{ background: "#0b111b" }}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={20}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />

      {userPos && (
        <>
          <Circle
            center={userPos}
            radius={1200}
            pathOptions={{ color: "#14a4ff", fillColor: "#14a4ff", fillOpacity: 0.15, weight: 1 }}
          />
          <CircleMarker
            center={userPos}
            radius={7}
            pathOptions={{ color: "#ffffff", fillColor: "#14a4ff", fillOpacity: 1, weight: 2 }}
          />
        </>
      )}

      {items.map((it) => (
        <CircleMarker
          key={it.id}
          center={[it.lat, it.lng]}
          radius={9}
          pathOptions={{ color: "#0b111b", fillColor: "#00ffa3", fillOpacity: 1, weight: 2 }}
        >
          <Popup>
            <div className="min-w-[140px]">
              <div className="text-sm font-semibold text-white">{it.title || "Listing"}</div>
              {it.price && (
                <div className="text-xs font-bold text-[#00ffa3]">
                  {formatPriceForDisplay(it.price)} ℏ
                </div>
              )}
              <Link
                href={listingHref(it.id)}
                className="mt-1 inline-block text-xs font-semibold text-[#00ffa3] underline underline-offset-2"
              >
                View listing →
              </Link>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
