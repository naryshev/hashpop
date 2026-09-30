import { describe, expect, it } from "vitest";
import {
  NEARBY_SHEET_LIMIT,
  filterNearbyListings,
  formatNearbyDistance,
  isInsideBounds,
  nearbyCountLabel,
  nearbyPinLabel,
  parseNearbyListing,
  selectNearbySheet,
  type NearbyListing,
} from "../nearbyListings";

function listing(
  partial: Partial<NearbyListing> & Pick<NearbyListing, "id" | "lat" | "lng">,
): NearbyListing {
  return {
    title: partial.title ?? partial.id,
    subtitle: null,
    description: null,
    price: partial.price ?? "10",
    imageUrl: null,
    mediaUrls: [],
    category: partial.category ?? "Headphones & Audio",
    condition: partial.condition ?? "Used",
    city: partial.city ?? "San Francisco",
    ...partial,
  };
}

const baseCriteria = {
  query: "",
  listingType: "all" as const,
  priceBand: "any" as const,
  condition: "",
};

describe("nearby price pins", () => {
  it("labels the pin with the ℏ price and never a star rating", () => {
    expect(nearbyPinLabel("5")).toBe("5 ℏ");
    expect(nearbyPinLabel("12.5")).toBe("12.5 ℏ");
    expect(nearbyPinLabel("5")).not.toMatch(/★|⭐|star/i);
  });
});

describe("nearby sheet", () => {
  it("formats distance in miles", () => {
    expect(formatNearbyDistance(0.8 * 1609.344)).toBe("0.8 mi");
    expect(formatNearbyDistance(10)).toBe("< 0.1 mi");
    expect(formatNearbyDistance(20 * 1609.344)).toBe("20 mi");
  });

  it("counts listings nearby", () => {
    expect(nearbyCountLabel(0)).toBe("0 listings nearby");
    expect(nearbyCountLabel(1)).toBe("1 listing nearby");
    expect(nearbyCountLabel(48)).toBe("48 listings nearby");
  });

  it("keeps the 50 closest listings inside the map area", () => {
    const listings = Array.from({ length: 60 }, (_, index) =>
      listing({
        id: `near-${index}`,
        lat: 37.7 + index * 0.01,
        lng: -122.4,
        price: String(index + 1),
      }),
    );
    const result = selectNearbySheet(listings, {
      ...baseCriteria,
      bounds: { west: -123, south: 37, east: -122, north: 39 },
      focus: { lat: 37.7, lng: -122.4 },
    });
    expect(result.totalInArea).toBe(60);
    expect(result.items).toHaveLength(NEARBY_SHEET_LIMIT);
    expect(result.items[0]?.id).toBe("near-0");
    expect(result.items[1]?.distanceMeters).toBeGreaterThan(result.items[0]?.distanceMeters ?? 0);
    expect(result.items.some((item) => item.id === "near-59")).toBe(false);
  });

  it("drops listings outside the current map bounds", () => {
    const result = selectNearbySheet(
      [
        listing({ id: "in", lat: 37.78, lng: -122.41 }),
        listing({ id: "out", lat: 40.7, lng: -74.0 }),
      ],
      {
        ...baseCriteria,
        bounds: { west: -123, south: 37, east: -122, north: 38 },
        focus: { lat: 37.78, lng: -122.41 },
      },
    );
    expect(result.totalInArea).toBe(1);
    expect(result.items.map((item) => item.id)).toEqual(["in"]);
    expect(isInsideBounds(40.7, -74, { west: -123, south: 37, east: -122, north: 38 })).toBe(false);
  });

  it("filters by search, type, price band, and condition", () => {
    const listings = [
      listing({
        id: "phones",
        lat: 1,
        lng: 1,
        title: "Sony WH-1000XM5",
        category: "Headphones & Audio",
        condition: "Like new",
        price: "5",
      }),
      listing({
        id: "software",
        lat: 1.1,
        lng: 1,
        title: "License key",
        category: "Software",
        condition: "New",
        price: "40",
      }),
      listing({
        id: "bike",
        lat: 1.2,
        lng: 1,
        title: "City bike",
        category: "Bicycles & E-Bikes",
        condition: "Used",
        price: "250",
      }),
    ];
    expect(
      filterNearbyListings(listings, { ...baseCriteria, query: "sony" }).map((item) => item.id),
    ).toEqual(["phones"]);
    expect(
      filterNearbyListings(listings, { ...baseCriteria, listingType: "digital" }).map(
        (item) => item.id,
      ),
    ).toEqual(["software"]);
    expect(
      filterNearbyListings(listings, { ...baseCriteria, priceBand: "under-25" }).map(
        (item) => item.id,
      ),
    ).toEqual(["phones"]);
    expect(
      filterNearbyListings(listings, { ...baseCriteria, condition: "Used" }).map((item) => item.id),
    ).toEqual(["bike"]);
    expect(
      filterNearbyListings(listings, {
        ...baseCriteria,
        distanceBand: "1",
        focus: { lat: 1, lng: 1 },
      }).map((item) => item.id),
    ).toEqual(["phones"]);
  });

  it("parses listing coordinates and ignores rows without a point", () => {
    expect(parseNearbyListing({ id: "a", locationLat: 1, locationLng: 2, price: "9" })?.id).toBe(
      "a",
    );
    expect(parseNearbyListing({ id: "b", title: "No place" })).toBeNull();
  });
});
