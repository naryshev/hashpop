import { roundCoordForPrivacy } from "./privacyCoords";

export type GeocodeHit = {
  label: string;
  lat: number;
  lng: number;
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
): string {
  const url = new URL(`https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json`);
  url.searchParams.set("key", key);
  url.searchParams.set("limit", "5");
  url.searchParams.set("language", "en");
  url.searchParams.set("types", "place,locality,municipality,postal_code,region,neighbourhood");
  if (proximity && Number.isFinite(proximity.lat) && Number.isFinite(proximity.lng)) {
    url.searchParams.set("proximity", `${proximity.lng},${proximity.lat}`);
  }
  return url.toString();
}

export function parseMaptilerFeatures(data: unknown): GeocodeHit[] {
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
    hits.push({ label, lat, lng });
  }
  return hits;
}
