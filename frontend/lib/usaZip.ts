import type { GeocodeHit } from "./geocode";

/** USPS ZIP or ZIP+4. Other countries' postal codes are not accepted. */
const US_ZIP = /^\d{5}(?:-\d{4})?$/;

const FOREIGN_PLACE =
  /\b(canada|mexico|ontario|quebec|british columbia|united kingdom|england|france|germany|spain|italy|china|japan|australia|brazil)\b/i;

export function isUsaZip(value: string): boolean {
  return US_ZIP.test(value.trim());
}

/**
 * Rough US bounding boxes. Not sufficient alone (southern Canada overlaps),
 * so callers also require a US country code or a United States place name.
 */
export function isUsaLatLng(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat >= 24.5 && lat <= 49.5 && lng >= -125 && lng <= -66.5) return true;
  if (lat >= 51 && lat <= 71.5 && lng >= -170 && lng <= -129) return true;
  if (lat >= 18.5 && lat <= 22.5 && lng >= -161 && lng <= -154) return true;
  if (lat >= 17.8 && lat <= 18.6 && lng >= -67.5 && lng <= -65.2) return true;
  return false;
}

export function looksLikeUnitedStates(label: string): boolean {
  return /united states|\busa\b|u\.s\.a/i.test(label);
}

/** Keep US postal hits. Drop explicit non-US countries and foreign place names. */
export function preferUsaPostalHits(hits: GeocodeHit[]): GeocodeHit[] {
  return hits.filter((hit) => {
    const code = hit.countryCode?.toLowerCase();
    if (code) return code === "us";
    if (FOREIGN_PLACE.test(hit.label)) return false;
    if (looksLikeUnitedStates(hit.label)) return true;
    return isUsaLatLng(hit.lat, hit.lng);
  });
}
