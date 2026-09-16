import { describe, expect, it } from "vitest";
import { areaDiscGeoJSON } from "../areaDisc";
import { LISTING_AREA_RADIUS_M } from "../mapTiles";
import { roundCoordForPrivacy } from "../privacyCoords";

describe("roundCoordForPrivacy", () => {
  it("rounds to 2 decimal places (~1km) for neighborhood privacy", () => {
    expect(roundCoordForPrivacy(34.052234)).toBe(34.05);
    expect(roundCoordForPrivacy(-118.243683)).toBe(-118.24);
    expect(roundCoordForPrivacy(0.004)).toBe(0);
    expect(roundCoordForPrivacy(0.005)).toBe(0.01);
  });

  it("returns null for non-finite values", () => {
    expect(roundCoordForPrivacy(Number.NaN)).toBeNull();
    expect(roundCoordForPrivacy(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("areaDiscGeoJSON", () => {
  it("builds a closed polygon around the center at the listing privacy radius", () => {
    const lat = 34.05;
    const lng = -118.24;
    const feature = areaDiscGeoJSON(lng, lat, LISTING_AREA_RADIUS_M);
    const ring = feature.geometry.coordinates[0];
    expect(feature.geometry.type).toBe("Polygon");
    expect(ring.length).toBeGreaterThan(16);
    expect(ring[0]).toEqual(ring[ring.length - 1]);

    const lats = ring.map((c) => c[1]);
    const lngs = ring.map((c) => c[0]);
    const dLat = (Math.max(...lats) - Math.min(...lats)) / 2;
    const meters = dLat * 111_320;
    expect(meters).toBeGreaterThan(LISTING_AREA_RADIUS_M * 0.9);
    expect(meters).toBeLessThan(LISTING_AREA_RADIUS_M * 1.1);

    const centroidLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
    const centroidLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    expect(centroidLng).toBeCloseTo(lng, 1);
    expect(centroidLat).toBeCloseTo(lat, 1);
  });
});
