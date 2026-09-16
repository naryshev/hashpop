export type LngLatPolygonFeature = {
  type: "Feature";
  properties: Record<string, never>;
  geometry: { type: "Polygon"; coordinates: [number, number][][] };
};

/** Approximate geodesic disc as a GeoJSON polygon (equirectangular at this lat). */
export function areaDiscGeoJSON(
  lng: number,
  lat: number,
  radiusM: number,
  points = 64,
): LngLatPolygonFeature {
  const coords: [number, number][] = [];
  const latRad = (lat * Math.PI) / 180;
  const metersPerDegLat = 111_320;
  const metersPerDegLng = Math.max(111_320 * Math.cos(latRad), 1e-6);
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dLng = (radiusM * Math.sin(angle)) / metersPerDegLng;
    const dLat = (radiusM * Math.cos(angle)) / metersPerDegLat;
    coords.push([lng + dLng, lat + dLat]);
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [coords] },
  };
}
