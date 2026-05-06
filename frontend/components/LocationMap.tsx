"use client";

import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

const LocationMapInner = dynamic(() => import("./LocationMapInner"), {
  ssr: false,
  loading: () => (
    <div className="aspect-[16/7] w-full rounded-glass border border-white/10 bg-white/5 flex items-center justify-center text-silver text-sm">
      Loading map…
    </div>
  ),
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
      <p className="text-xs text-silver mt-2">
        {city ? <span className="text-white/80">{city} · </span> : null}
        Map is approximate to keep seller&apos;s location private.
      </p>
    </div>
  );
}
