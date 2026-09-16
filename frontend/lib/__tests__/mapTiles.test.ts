import { describe, expect, it } from "vitest";
import { color } from "../designTokens";
import {
  CARTO_DARK_FALLBACK_STYLE_URL,
  DARK_MAP_STYLE_URL,
  KEY_GATED_TILE_HOST_RE,
  LISTING_AREA_RADIUS_M,
  LISTING_AREA_ZOOM,
  MAP_ATTRIBUTION,
  MAP_CANVAS_BG,
  OPENFREEMAP_DARK_STYLE_URL,
  PICKER_AREA_ZOOM,
  areaPaint,
  isKeyFreeBasemap,
  resolveDarkMapStyleUrl,
} from "../mapTiles";

describe("isKeyFreeBasemap", () => {
  it("accepts OpenFreeMap and Carto style URLs without key query params", () => {
    expect(isKeyFreeBasemap("https://tiles.openfreemap.org/styles/dark")).toBe(true);
    expect(
      isKeyFreeBasemap("https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"),
    ).toBe(true);
  });

  it("rejects browser key-gated vendors (Mapbox / Google / Stadia / MapTiler tiles)", () => {
    expect(
      isKeyFreeBasemap("https://api.mapbox.com/styles/v1/mapbox/dark-v11?access_token=pk"),
    ).toBe(false);
    expect(isKeyFreeBasemap("https://maps.googleapis.com/maps/api/js?key=AIza")).toBe(false);
    expect(
      isKeyFreeBasemap("https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png"),
    ).toBe(false);
    expect(isKeyFreeBasemap("https://api.maptiler.com/maps/dataviz-dark/style.json?key=abc")).toBe(
      false,
    );
  });
});

describe("shared dark map config", () => {
  it("uses OpenFreeMap dark as the primary style with no API-key query params", () => {
    expect(DARK_MAP_STYLE_URL).toBe("https://tiles.openfreemap.org/styles/dark");
    expect(DARK_MAP_STYLE_URL).not.toMatch(/[?&](key|api[_-]?key|access_token)=/i);
    expect(DARK_MAP_STYLE_URL).not.toMatch(KEY_GATED_TILE_HOST_RE);
    expect(isKeyFreeBasemap(DARK_MAP_STYLE_URL)).toBe(true);
  });

  it("falls back to Carto Dark Matter without embedding a tile API key", () => {
    expect(CARTO_DARK_FALLBACK_STYLE_URL).toContain("cartocdn.com");
    expect(CARTO_DARK_FALLBACK_STYLE_URL.toLowerCase()).toContain("dark");
    expect(CARTO_DARK_FALLBACK_STYLE_URL).not.toMatch(/[?&](key|api[_-]?key|access_token)=/i);
    expect(isKeyFreeBasemap(CARTO_DARK_FALLBACK_STYLE_URL)).toBe(true);
  });

  it("credits OSM and paints the app dark canvas", () => {
    expect(MAP_ATTRIBUTION.toLowerCase()).toContain("openstreetmap");
    expect(MAP_CANVAS_BG).toBe(color.bg);
    expect(MAP_CANVAS_BG).toBe("#0b111b");
  });

  it("uses a 2.5km mint area disc at neighborhood zoom (not street-level)", () => {
    expect(LISTING_AREA_RADIUS_M).toBe(2500);
    expect(LISTING_AREA_ZOOM).toBeGreaterThanOrEqual(11);
    expect(LISTING_AREA_ZOOM).toBeLessThanOrEqual(12);
    expect(PICKER_AREA_ZOOM).toBeGreaterThanOrEqual(11);
    expect(PICKER_AREA_ZOOM).toBeLessThanOrEqual(12);
    expect(areaPaint.fillOpacity).toBeGreaterThanOrEqual(0.2);
    expect(areaPaint.fillOpacity).toBeLessThanOrEqual(0.3);
    expect(areaPaint.color).toBe("#00ffa3");
    expect(areaPaint.fillColor).toBe("#00ffa3");
  });

  it("allows a key-free NEXT_PUBLIC_MAP_STYLE_URL override", () => {
    expect(resolveDarkMapStyleUrl({})).toBe(OPENFREEMAP_DARK_STYLE_URL);
    expect(
      resolveDarkMapStyleUrl({
        NEXT_PUBLIC_MAP_STYLE_URL: "https://tiles.openfreemap.org/styles/liberty",
      }),
    ).toBe("https://tiles.openfreemap.org/styles/liberty");
    expect(
      resolveDarkMapStyleUrl({
        NEXT_PUBLIC_MAP_STYLE_URL: "https://api.maptiler.com/maps/dark/style.json?key=secret",
      }),
    ).toBe(OPENFREEMAP_DARK_STYLE_URL);
  });
});
