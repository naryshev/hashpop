import { roundCoordForPrivacy } from "./privacyCoords";

export type GeocodeHit = {
  label: string;
  lat: number;
  lng: number;
  countryCode?: string;
};

export function shortPlaceLabel(placeName: string): string {
  return placeName
    .split(",")
    .slice(0, 2)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

export function maptilerForwardUrl(
  query: string,
  key: string,
  proximity?: { lat: number; lng: number },
  options?: { country?: "us"; types?: string },
): string {
  const url = new URL(`https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json`);
  url.searchParams.set("key", key);
  url.searchParams.set("limit", "5");
  url.searchParams.set("language", "en");
  url.searchParams.set(
    "types",
    options?.types ?? "place,locality,municipality,postal_code,region,neighbourhood",
  );
  if (options?.country) url.searchParams.set("country", options.country);
  if (proximity && Number.isFinite(proximity.lat) && Number.isFinite(proximity.lng)) {
    url.searchParams.set("proximity", `${proximity.lng},${proximity.lat}`);
  }
  return url.toString();
}

function featureCountryCode(feature: object): string | null {
  const props = (feature as { properties?: unknown }).properties;
  if (!props || typeof props !== "object") return null;
  const raw =
    (props as { country_code?: unknown }).country_code ?? (props as { country?: unknown }).country;
  if (typeof raw !== "string" || !raw.trim()) return null;
  return raw.trim().toLowerCase();
}

export function parseMaptilerFeatures(data: unknown, options?: { country?: "us" }): GeocodeHit[] {
  if (!data || typeof data !== "object") return [];
  const features = (data as { features?: unknown }).features;
  if (!Array.isArray(features)) return [];
  const hits: GeocodeHit[] = [];
  for (const feature of features) {
    if (!feature || typeof feature !== "object") continue;
    const placeName = (feature as { place_name?: unknown }).place_name;
    const center = (feature as { center?: unknown }).center;
    if (typeof placeName !== "string" || !Array.isArray(center) || center.length < 2) continue;
    const lng = roundCoordForPrivacy(Number(center[0]));
    const lat = roundCoordForPrivacy(Number(center[1]));
    const label = shortPlaceLabel(placeName);
    if (lat == null || lng == null || !label) continue;
    const countryCode = featureCountryCode(feature);
    if (options?.country === "us") {
      if (countryCode && countryCode !== "us") continue;
      if (!countryCode && !/united states/i.test(placeName)) continue;
    }
    hits.push({
      label,
      lat,
      lng,
      ...(countryCode ? { countryCode } : options?.country === "us" ? { countryCode: "us" } : {}),
    });
  }
  return hits;
}
