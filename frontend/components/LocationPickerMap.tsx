"use client";

import { AreaDisc } from "./AreaDisc";
import DarkMap from "./DarkMap";
import {
  LISTING_AREA_RADIUS_M,
  MAP_FRAME_CLASS,
  PICKER_AREA_ZOOM,
  PICKER_EMPTY_ZOOM,
} from "../lib/mapTiles";

type Props = {
  lat: number | null;
  lng: number | null;
  onPick?: (lat: number, lng: number) => void;
};

const DEFAULT_LAT = 20;
const DEFAULT_LNG = 0;

export default function LocationPickerMap({ lat, lng, onPick }: Props) {
  const hasArea = lat != null && lng != null;
  return (
    <div className={MAP_FRAME_CLASS}>
      <div className="aspect-[16/9] w-full">
        <DarkMap
          latitude={hasArea ? lat : DEFAULT_LAT}
          longitude={hasArea ? lng : DEFAULT_LNG}
          zoom={hasArea ? PICKER_AREA_ZOOM : PICKER_EMPTY_ZOOM}
          interactive
          onMapClick={onPick}
        >
          {hasArea ? (
            <AreaDisc id="picker-area" lat={lat} lng={lng} radiusM={LISTING_AREA_RADIUS_M} />
          ) : null}
        </DarkMap>
      </div>
    </div>
  );
}
