"use client";

import { useState } from "react";
import { Marker, Popup } from "react-map-gl/maplibre";
import Link from "next/link";
import { listingHref } from "../lib/listingUrl";
import { formatPriceForDisplay } from "../lib/formatPrice";
import { color } from "../lib/designTokens";
import { NEARBY_DEFAULT_ZOOM } from "../lib/mapTiles";
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

const USER_AREA_RADIUS_M = 1200;

export default function NearbyMapInner({ center, userPos, items }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = items.find((it) => it.id === activeId) ?? null;

  return (
    <DarkMap latitude={center[0]} longitude={center[1]} zoom={NEARBY_DEFAULT_ZOOM} interactive>
      {userPos ? (
        <>
          <AreaDisc
            id="user-area"
            lat={userPos[0]}
            lng={userPos[1]}
            radiusM={USER_AREA_RADIUS_M}
            color={color.chromeBright}
            fillOpacity={0.15}
          />
          <Marker longitude={userPos[1]} latitude={userPos[0]} anchor="center">
            <span
              className="block h-3.5 w-3.5 rounded-full border-2 border-white"
              style={{ background: color.chromeBright }}
              aria-label="Your location"
            />
          </Marker>
        </>
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
