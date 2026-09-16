"use client";

import { AreaDisc } from "./AreaDisc";
import DarkMap from "./DarkMap";
import { LISTING_AREA_RADIUS_M, LISTING_AREA_ZOOM, MAP_FRAME_CLASS } from "../lib/mapTiles";

type Props = {
  lat: number;
  lng: number;
};

export default function LocationMapInner({ lat, lng }: Props) {
  return (
    <div className={MAP_FRAME_CLASS}>
      <div className="aspect-[16/7] w-full">
        <DarkMap latitude={lat} longitude={lng} zoom={LISTING_AREA_ZOOM} interactive={false}>
          <AreaDisc id="listing-area" lat={lat} lng={lng} radiusM={LISTING_AREA_RADIUS_M} />
        </DarkMap>
      </div>
    </div>
  );
}
