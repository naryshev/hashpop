import { color } from "./designTokens";

/** OpenFreeMap dark — key-free vector style for MapLibre. */
export const OPENFREEMAP_DARK_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

/**
 * Carto Dark Matter GL style — last-resort fallback if OpenFreeMap is unreachable.
 * No API key is embedded. Carto's public raster CDN currently watermarks
 * "API KEY REQUIRED"; this vector style is used instead of that raster.
 */
export const CARTO_DARK_FALLBACK_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export const KEY_GATED_TILE_HOST_RE =
  /mapbox\.com|googleapis\.com|google\.com\/maps|stadiamaps\.com|maptiler\.com/i;

export function isKeyFreeBasemap(url: string): boolean {
  if (/[?&](key|api[_-]?key|access_token)=/i.test(url)) return false;
  if (KEY_GATED_TILE_HOST_RE.test(url)) return false;
  return true;
}

export function resolveDarkMapStyleUrl(
  env: { NEXT_PUBLIC_MAP_STYLE_URL?: string } = typeof process === "undefined"
    ? {}
    : { NEXT_PUBLIC_MAP_STYLE_URL: process.env.NEXT_PUBLIC_MAP_STYLE_URL },
): string {
  const override = env.NEXT_PUBLIC_MAP_STYLE_URL?.trim();
  if (override && isKeyFreeBasemap(override)) return override;
  return OPENFREEMAP_DARK_STYLE_URL;
}

export const DARK_MAP_STYLE_URL = resolveDarkMapStyleUrl();

export const MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://openfreemap.org/">OpenFreeMap</a>';

export const MAP_CANVAS_BG = color.bg;

/** Product lock: ~5 km privacy blob on listing picker + detail, and Nearby center. */
export const LISTING_AREA_RADIUS_M = 5000;

/**
 * Country-scale zoom so a 5 km mint disc reads as a small soft blob.
 * Listing detail + create picker share this; Nearby is one step tighter
 * so listing dots stay usable. Radius stays LISTING_AREA_RADIUS_M.
 */
export const COUNTRY_AREA_ZOOM = 7;
export const LISTING_AREA_ZOOM = COUNTRY_AREA_ZOOM;
export const PICKER_AREA_ZOOM = COUNTRY_AREA_ZOOM;
export const NEARBY_DEFAULT_ZOOM = 8;
export const PICKER_EMPTY_ZOOM = 3;

/** Nearby user/search center uses the same 5 km mint disc (not per listing). */
export const NEARBY_CENTER_RADIUS_M = LISTING_AREA_RADIUS_M;

export const areaPaint = {
  color: color.chrome,
  fillColor: color.chrome,
  fillOpacity: 0.25,
  weight: 1.25,
} as const;

export const MAP_FRAME_CLASS =
  "relative w-full overflow-hidden rounded-[14px] border border-hairline bg-bg";

export const MAP_LOADER_CLASS =
  "flex w-full items-center justify-center rounded-[14px] border border-hairline bg-material-regular text-sm text-silver";
