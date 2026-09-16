"use client";

import { useState } from "react";
import { Marker, Popup } from "react-map-gl/maplibre";
import Link from "next/link";
import { listingHref } from "../lib/listingUrl";
import { formatPriceForDisplay } from "../lib/formatPrice";
import { NEARBY_CENTER_RADIUS_M, NEARBY_DEFAULT_ZOOM } from "../lib/mapTiles";
import { AreaDisc } from "./AreaDisc";
import DarkMap from "./DarkMap";

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
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = items.find((it) => it.id === activeId) ?? null;

  return (
    <DarkMap latitude={center[0]} longitude={center[1]} zoom={NEARBY_DEFAULT_ZOOM} interactive>
      <AreaDisc
        id="nearby-center"
        lat={center[0]}
        lng={center[1]}
        radiusM={NEARBY_CENTER_RADIUS_M}
      />

      {userPos ? (
        <Marker longitude={userPos[1]} latitude={userPos[0]} anchor="center">
          <span
            className="block h-2.5 w-2.5 rounded-full border-2 border-white bg-chrome"
            aria-label="Your location"
          />
        </Marker>
      ) : null}

      {items.map((it) => (
        <Marker
          key={it.id}
          longitude={it.lng}
          latitude={it.lat}
          anchor="center"
          onClick={(event) => {
            event.originalEvent.stopPropagation();
            setActiveId(it.id);
          }}
        >
          <button
            type="button"
            aria-label={it.title || "Listing"}
            className="block h-2.5 w-2.5 rounded-full border-2 border-bg bg-chrome"
          />
        </Marker>
      ))}

      {active ? (
        <Popup
          longitude={active.lng}
          latitude={active.lat}
          anchor="bottom"
          onClose={() => setActiveId(null)}
          closeOnClick={false}
          offset={12}
        >
          <div className="min-w-[140px]">
            <div className="text-sm font-semibold text-white">{active.title || "Listing"}</div>
            {active.price ? (
              <div className="text-xs font-bold text-chrome">
                {formatPriceForDisplay(active.price)} ℏ
              </div>
            ) : null}
            <Link
              href={listingHref(active.id)}
              className="mt-1 inline-block text-xs font-semibold text-chrome underline underline-offset-2"
            >
              View listing →
            </Link>
          </div>
        </Popup>
      ) : null}
    </DarkMap>
  );
}
