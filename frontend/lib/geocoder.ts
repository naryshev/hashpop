/**
 * Server-side geocoder for `/api/geocode`.
 *
 * MapTiler is the only implementation. `GEOCODER` is a swap hook for later
 * (Photon) — do not add Photon here; unknown values still resolve to MapTiler.
 */
export const GEOCODER_MAPTILER = "maptiler" as const;

export type GeocoderId = typeof GEOCODER_MAPTILER;

export function resolveGeocoder(
  env: { GEOCODER?: string } = typeof process === "undefined"
    ? {}
    : { GEOCODER: process.env.GEOCODER },
): GeocoderId {
  const raw = env.GEOCODER?.trim().toLowerCase();
  if (!raw || raw === GEOCODER_MAPTILER) return GEOCODER_MAPTILER;
  return GEOCODER_MAPTILER;
}
