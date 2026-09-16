import { describe, expect, it } from "vitest";
import {
  GEOCODE_DEBOUNCE_MS,
  GEOCODE_ENDPOINT,
  SEARCH_UNAVAILABLE_COPY,
  geocodeRequestUrl,
  parseGeocodeResponse,
} from "../geocode";
import { maptilerForwardUrl, parseMaptilerFeatures, shortPlaceLabel } from "../maptilerGeocode";

describe("geocode client helpers", () => {
  it("builds the Next proxy URL with optional proximity bias", () => {
    expect(GEOCODE_ENDPOINT).toBe("/api/geocode");
    expect(GEOCODE_DEBOUNCE_MS).toBeGreaterThanOrEqual(300);
    expect(geocodeRequestUrl("Los Angeles")).toBe("/api/geocode?q=Los+Angeles");
    expect(geocodeRequestUrl("90210", { lat: 34.05, lng: -118.24 })).toBe(
      "/api/geocode?q=90210&lat=34.05&lng=-118.24",
    );
  });

  it("treats 503 payloads as search unavailable", () => {
    expect(SEARCH_UNAVAILABLE_COPY).toBe("Search unavailable");
    expect(parseGeocodeResponse({ available: false, error: "Search unavailable" }, 503)).toEqual({
      available: false,
      suggestions: [],
      error: SEARCH_UNAVAILABLE_COPY,
    });
    expect(
      parseGeocodeResponse(
        {
          available: true,
          suggestions: [{ label: "Los Angeles, California", lat: 34.05, lng: -118.24 }],
        },
        200,
      ).suggestions,
    ).toHaveLength(1);
  });
});

describe("MapTiler proxy helpers", () => {
  it("puts the query in the path and the key in the query string", () => {
    const url = maptilerForwardUrl("Los Angeles", "test-key", { lat: 34.05, lng: -118.24 });
    expect(url.startsWith("https://api.maptiler.com/geocoding/Los%20Angeles.json?")).toBe(true);
    expect(url).toContain("key=test-key");
    expect(url).toContain("proximity=-118.24%2C34.05");
    expect(url).toContain("limit=5");
  });

  it("parses MapTiler features into rounded city-scale hits", () => {
    const hits = parseMaptilerFeatures({
      features: [
        {
          place_name: "Los Angeles, California, United States",
          center: [-118.243683, 34.052234],
        },
        { place_name: "bad", center: ["x", "y"] },
      ],
    });
    expect(hits).toEqual([{ label: "Los Angeles, California", lat: 34.05, lng: -118.24 }]);
  });

  it("shortens place names to city, region", () => {
    expect(shortPlaceLabel("Austin, Texas, United States")).toBe("Austin, Texas");
  });
});
