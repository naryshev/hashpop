"use client";

import { useMemo } from "react";
import { Layer, Source } from "react-map-gl/maplibre";
import { areaDiscGeoJSON } from "../lib/areaDisc";
import { areaPaint } from "../lib/mapTiles";

type Props = {
  id: string;
  lat: number;
  lng: number;
  radiusM: number;
  color?: string;
  fillOpacity?: number;
};

export function AreaDisc({
  id,
  lat,
  lng,
  radiusM,
  color = areaPaint.color,
  fillOpacity = areaPaint.fillOpacity,
}: Props) {
  const data = useMemo(() => areaDiscGeoJSON(lng, lat, radiusM), [lat, lng, radiusM]);
  return (
    <Source id={id} type="geojson" data={data}>
      <Layer
        id={`${id}-fill`}
        type="fill"
        paint={{ "fill-color": color, "fill-opacity": fillOpacity }}
      />
      <Layer
        id={`${id}-line`}
        type="line"
        paint={{
          "line-color": color,
          "line-width": areaPaint.weight,
          "line-opacity": 0.9,
        }}
      />
    </Source>
  );
}
