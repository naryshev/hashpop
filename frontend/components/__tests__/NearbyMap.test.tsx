import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NearbyMap } from "../NearbyMap";

vi.mock("next/dynamic", () => ({
  default: () =>
    function MockNearbyMapInner() {
      return <div data-testid="nearby-map-canvas" />;
    },
}));

vi.mock("../../lib/apiUrl", () => ({
  getApiUrl: () => "http://api.test",
}));

vi.mock("../../lib/geocode", () => ({
  GEOCODE_DEBOUNCE_MS: 0,
  SEARCH_UNAVAILABLE_COPY: "Search unavailable",
  probeGeocodeAvailable: async () => true,
  searchGeocode: async () => ({ available: true, suggestions: [] }),
}));

vi.mock("../../lib/profiles", () => ({
  useProfiles: () => ({}),
  useProfile: () => undefined,
  profileDisplayName: () => null,
  profileAvatarUrl: () => null,
}));

vi.mock("../ListingCard", () => ({
  ListingCard: ({
    item,
  }: {
    item: {
      title?: string | null;
      category?: string | null;
      condition?: string | null;
      distanceLabel?: string | null;
      price?: string;
    };
  }) => (
    <article data-testid="nearby-card" data-variant="softTrust">
      <h2>{item.title}</h2>
      <p>
        {item.category} • {item.condition}
      </p>
      <p>{item.price} ℏ</p>
      <p>{item.distanceLabel}</p>
    </article>
  ),
}));

let root: Root | undefined;
let host: HTMLElement | undefined;

describe("Nearby map chrome", () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
    host?.remove();
    root = undefined;
    host = undefined;
  });

  it("shows search, current location, list toggle, filters, and a soft-trust sheet", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          listings: [
            {
              id: "lst-1",
              title: "Sony WH-1000XM5",
              price: "5",
              locationLat: 37.78,
              locationLng: -122.42,
              category: "Headphones & Audio",
              condition: "Like new",
              requireEscrow: false,
            },
          ],
        }),
      })),
    );
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (success: PositionCallback) => {
          success({
            coords: { latitude: 37.78, longitude: -122.42 },
          } as GeolocationPosition);
        },
      },
    });

    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(createElement(NearbyMap, { open: true, onClose: () => undefined }));
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      document.querySelector('[data-testid="nearby-search"]')?.getAttribute("placeholder"),
    ).toBe("Search nearby…");
    expect(
      document.querySelector('[data-testid="nearby-current-location"]')?.textContent,
    ).toContain("Current location");
    expect(document.querySelector('[data-testid="nearby-list-toggle"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="nearby-filter-type"]')?.textContent).toContain(
      "Type",
    );
    expect(document.querySelector('[data-testid="nearby-filter-price"]')?.textContent).toContain(
      "Price",
    );
    expect(document.querySelector('[data-testid="nearby-filter-price"]')?.textContent).toContain(
      "ℏ",
    );
    expect(
      document.querySelector('[data-testid="nearby-filter-condition"]')?.textContent,
    ).toContain("Condition");
    expect(document.querySelector('[data-testid="nearby-count"]')?.textContent).toBe(
      "1 listing nearby",
    );
    expect(
      document.querySelector('[data-testid="nearby-card"][data-variant="softTrust"]'),
    ).toBeTruthy();
    expect(document.body.textContent).toContain("Sony WH-1000XM5");
    expect(document.body.textContent).not.toMatch(/★|⭐/);
  });
});
