"use client";

import dynamic from "next/dynamic";
import { MAP_LOADER_CLASS } from "../lib/mapTiles";

const LocationMapInner = dynamic(() => import("./LocationMapInner"), {
  ssr: false,
  loading: () => <div className={`aspect-[16/7] ${MAP_LOADER_CLASS}`}>Loading map…</div>,
});

type Props = {
  lat: number;
  lng: number;
  city?: string | null;
  className?: string;
};

export function LocationMap({ lat, lng, city, className }: Props) {
  return (
    <div className={className}>
      <LocationMapInner lat={lat} lng={lng} />
      <p className="mt-2 text-xs text-silver">
        {city ? <span className="text-white/80">{city} · </span> : null}
        Map is approximate to keep the seller&apos;s location private.
      </p>
    </div>
  );
}
