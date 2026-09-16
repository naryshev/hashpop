"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Map, { NavigationControl, type MapRef } from "react-map-gl/maplibre";
import type { MapLayerMouseEvent } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { CARTO_DARK_FALLBACK_STYLE_URL, DARK_MAP_STYLE_URL, MAP_CANVAS_BG } from "../lib/mapTiles";

type Props = {
  latitude: number;
  longitude: number;
  zoom: number;
  interactive?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  children?: ReactNode;
};

function isStyleLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return /failed to load style|load style|openfreemap\.org\/styles/i.test(msg);
}

export default function DarkMap({
  latitude,
  longitude,
  zoom,
  interactive = true,
  onMapClick,
  children,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const didMount = useRef(false);
  const [styleUrl, setStyleUrl] = useState(DARK_MAP_STYLE_URL);
  const [usedFallback, setUsedFallback] = useState(false);

  const onError = useCallback(
    (event: { error?: Error }) => {
      if (usedFallback || !isStyleLoadError(event.error)) return;
      setUsedFallback(true);
      setStyleUrl(CARTO_DARK_FALLBACK_STYLE_URL);
    },
    [usedFallback],
  );

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    mapRef.current?.flyTo({
      center: [longitude, latitude],
      zoom,
      duration: 600,
    });
  }, [latitude, longitude, zoom]);

  const handleClick = useCallback(
    (event: MapLayerMouseEvent) => {
      if (!onMapClick) return;
      const target = event.originalEvent.target as HTMLElement | null;
      if (target?.closest?.(".maplibregl-ctrl")) return;
      onMapClick(event.lngLat.lat, event.lngLat.lng);
    },
    [onMapClick],
  );

  return (
    <Map
      ref={mapRef}
      initialViewState={{ latitude, longitude, zoom }}
      mapStyle={styleUrl}
      style={{
        width: "100%",
        height: "100%",
        background: MAP_CANVAS_BG,
        cursor: interactive ? "grab" : "default",
      }}
      attributionControl
      dragPan={interactive}
      dragRotate={false}
      scrollZoom={interactive}
      doubleClickZoom={interactive}
      touchZoomRotate={interactive}
      keyboard={interactive}
      onError={onError}
      onClick={onMapClick ? handleClick : undefined}
      RTLTextPlugin={false}
    >
      {interactive ? <NavigationControl position="bottom-right" showCompass={false} /> : null}
      {children}
    </Map>
  );
}
