export const GEOCODE_ENDPOINT = "/api/geocode";
export const GEOCODE_DEBOUNCE_MS = 350;
export const SEARCH_UNAVAILABLE_COPY = "Search unavailable";

export type GeocodeHit = {
  label: string;
  lat: number;
  lng: number;
};

export type GeocodeResult = {
  available: boolean;
  suggestions: GeocodeHit[];
  error?: string;
};

export function geocodeRequestUrl(query: string, proximity?: { lat: number; lng: number }): string {
  const params = new URLSearchParams({ q: query.trim() });
  if (proximity && Number.isFinite(proximity.lat) && Number.isFinite(proximity.lng)) {
    params.set("lat", String(proximity.lat));
    params.set("lng", String(proximity.lng));
  }
  return `${GEOCODE_ENDPOINT}?${params.toString()}`;
}

export function parseGeocodeResponse(body: unknown, status: number): GeocodeResult {
  if (status === 503) {
    return { available: false, suggestions: [], error: SEARCH_UNAVAILABLE_COPY };
  }
  if (!body || typeof body !== "object") {
    return { available: true, suggestions: [] };
  }
  const available = (body as { available?: unknown }).available !== false;
  const raw = (body as { suggestions?: unknown }).suggestions;
  const suggestions: GeocodeHit[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const label = (item as { label?: unknown }).label;
      const lat = Number((item as { lat?: unknown }).lat);
      const lng = Number((item as { lng?: unknown }).lng);
      if (typeof label !== "string" || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      suggestions.push({ label, lat, lng });
    }
  }
  return { available, suggestions };
}

export async function probeGeocodeAvailable(): Promise<boolean> {
  try {
    const res = await fetch(GEOCODE_ENDPOINT, { headers: { Accept: "application/json" } });
    return res.status !== 503;
  } catch {
    return false;
  }
}

export async function searchGeocode(
  query: string,
  proximity?: { lat: number; lng: number },
): Promise<GeocodeResult> {
  const res = await fetch(geocodeRequestUrl(query, proximity), {
    headers: { Accept: "application/json" },
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return parseGeocodeResponse(body, res.status);
}
