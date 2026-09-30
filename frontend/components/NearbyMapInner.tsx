"use client";

import { Marker } from "react-map-gl/maplibre";
import type { MapViewSnapshot } from "../lib/mapTiles";
import { nearbyPinLabel, type NearbyListing } from "../lib/nearbyListings";
import { cn } from "../lib/utils";
import DarkMap from "./DarkMap";

type Props = {
  center: [number, number];
  zoom: number;
  keepZoom?: boolean;
  padding?: { top: number; right: number; bottom: number; left: number };
  userPos: [number, number] | null;
  items: NearbyListing[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onViewChange: (view: MapViewSnapshot) => void;
  onMapClick?: () => void;
};

/**
 * Nearby discovery map. Exact coordinates, labeled with the ℏ price.
 * LocationPickerMap stays a ~5 km privacy disc and must not use these pins.
 */
export default function NearbyMapInner({
  center,
  zoom,
  keepZoom = false,
  padding,
  userPos,
  items,
  activeId,
  onSelect,
  onViewChange,
  onMapClick,
}: Props) {
  return (
    <DarkMap
      latitude={center[0]}
      longitude={center[1]}
      zoom={zoom}
      keepZoom={keepZoom}
      padding={padding}
      navigation={false}
      onViewChange={onViewChange}
      onMapClick={onMapClick}
      interactive
    >
      {userPos ? (
        <Marker longitude={userPos[1]} latitude={userPos[0]} anchor="center">
          <span
            className="block h-3.5 w-3.5 rounded-full border-2 border-[#0b111b] bg-chrome shadow-[0_0_0_6px_rgba(0,255,163,0.28)]"
            aria-label="Your location"
          />
        </Marker>
      ) : null}

      {items.map((item) => {
        const amount = nearbyPinLabel(item.price).replace(/\s*ℏ\s*$/, "");
        const active = item.id === activeId;
        const name = item.title || "Listing";
        return (
          <Marker
            key={item.id}
            longitude={item.lng}
            latitude={item.lat}
            anchor="bottom"
            onClick={(event) => {
              event.originalEvent.stopPropagation();
              onSelect(item.id);
            }}
          >
            <button
              type="button"
              data-testid="nearby-price-pin"
              data-active={active ? "true" : "false"}
              aria-label={`${name}, ${amount} ℏ`}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(item.id);
              }}
              className="group relative flex flex-col items-center"
            >
              <span
                className={cn(
                  "whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-bold leading-none shadow-[0_6px_16px_rgba(0,0,0,0.35)]",
                  active
                    ? "border-chrome bg-chrome text-[#04150f]"
                    : "border-white/15 bg-[#121a29]/95 text-chrome",
                )}
              >
                {amount} <span className="italic">ℏ</span>
              </span>
              <span
                aria-hidden
                className={cn(
                  "-mt-px h-2 w-2 rotate-45 border-b border-r",
                  active ? "border-chrome bg-chrome" : "border-white/15 bg-[#121a29]",
                )}
              />
            </button>
          </Marker>
        );
      })}
    </DarkMap>
  );
}
