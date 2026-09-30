import { describe, expect, it } from "vitest";
import { isUsaLatLng, isUsaZip, preferUsaPostalHits } from "../usaZip";

describe("USA ZIP filter", () => {
  it("accepts ZIP and ZIP+4 only", () => {
    expect(isUsaZip("90210")).toBe(true);
    expect(isUsaZip(" 02108 ")).toBe(true);
    expect(isUsaZip("94107-1234")).toBe(true);
    expect(isUsaZip("SW1A 1AA")).toBe(false);
    expect(isUsaZip("M5V 2T6")).toBe(false);
    expect(isUsaZip("9021")).toBe(false);
  });

  it("drops non-US geocoder hits", () => {
    const hits = preferUsaPostalHits([
      { label: "Beverly Hills, California", lat: 34.09, lng: -118.41, countryCode: "us" },
      { label: "Toronto, Ontario", lat: 43.65, lng: -79.38, countryCode: "ca" },
      { label: "London, England", lat: 51.5, lng: -0.12 },
      { label: "Austin, Texas, United States", lat: 30.27, lng: -97.74 },
    ]);
    expect(hits.map((hit) => hit.label)).toEqual([
      "Beverly Hills, California",
      "Austin, Texas, United States",
    ]);
    expect(isUsaLatLng(34.09, -118.41)).toBe(true);
    expect(isUsaLatLng(51.5, -0.12)).toBe(false);
  });
});
