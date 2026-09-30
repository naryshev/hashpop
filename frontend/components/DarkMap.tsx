"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Map, { NavigationControl, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  CARTO_DARK_FALLBACK_STYLE_URL,
  DARK_MAP_STYLE_URL,
  MAP_CANVAS_BG,
  type MapViewSnapshot,
} from "../lib/mapTiles";

type Props = {
  latitude: number;
  longitude: number;
  zoom: number;
  interactive?: boolean;
  /** When true, recenters keep the user's current zoom. Default frames `zoom`. */
  keepZoom?: boolean;
  /** Nearby hides this; the sheet covers the bottom-right corner. */
  navigation?: boolean;
  /** Shifts the camera focal point into the visible map, above the sheet. */
  padding?: { top: number; right: number; bottom: number; left: number };
  onViewChange?: (view: MapViewSnapshot) => void;
  children?: ReactNode;
};

function isStyleLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return /failed to load style|load style|openfreemap\.org\/styles/i.test(msg);
}

function snapshotFromMap(target: {
  getBounds: () => {
    getWest: () => number;
    getSouth: () => number;
    getEast: () => number;
    getNorth: () => number;
  };
  getCenter: () => { lat: number; lng: number };
}): MapViewSnapshot {
  const bounds = target.getBounds();
  const center = target.getCenter();
  return {
    bounds: {
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    },
    center: { lat: center.lat, lng: center.lng },
  };
}

export default function DarkMap({
  latitude,
  longitude,
  zoom,
  interactive = true,
  keepZoom = false,
  navigation = true,
  padding,
  onViewChange,
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

  const publishView = useCallback(
    (target: Parameters<typeof snapshotFromMap>[0]) => {
      onViewChange?.(snapshotFromMap(target));
    },
    [onViewChange],
  );

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const map = mapRef.current?.getMap();
    if (!map) return;
    map.flyTo({
      center: [longitude, latitude],
      zoom: keepZoom ? map.getZoom() : zoom,
      padding: map.getPadding(),
      duration: 600,
    });
  }, [keepZoom, latitude, longitude, zoom]);

  useEffect(() => {
    if (!padding) return;
    mapRef.current?.getMap()?.setPadding(padding);
  }, [padding]);

  return (
    <Map
      ref={mapRef}
      initialViewState={{ latitude, longitude, zoom, padding }}
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
      onLoad={(event) => publishView(event.target)}
      onMoveEnd={(event) => publishView(event.target)}
      RTLTextPlugin={false}
    >
      {interactive && navigation ? (
        <NavigationControl position="bottom-right" showCompass={false} />
      ) : null}
      {children}
    </Map>
  );
}
