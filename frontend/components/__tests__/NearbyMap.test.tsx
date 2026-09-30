import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NearbyMap } from "../NearbyMap";

const { searchGeocode } = vi.hoisted(() => ({
  searchGeocode: vi.fn(async () => ({ available: true, suggestions: [] as unknown[] })),
}));

vi.mock("next/dynamic", () => ({
  default: () =>
    function MockNearbyMapInner(props: { onMapClick?: () => void }) {
      return (
        <button type="button" data-testid="nearby-map-canvas" onClick={() => props.onMapClick?.()}>
          map
        </button>
      );
    },
}));

vi.mock("../../lib/apiUrl", () => ({
  getApiUrl: () => "http://api.test",
}));

vi.mock("../../lib/geocode", () => ({
  GEOCODE_DEBOUNCE_MS: 0,
  SEARCH_UNAVAILABLE_COPY: "Search unavailable",
  probeGeocodeAvailable: async () => true,
  searchGeocode: (...args: unknown[]) => searchGeocode(...args),
}));

vi.mock("../../lib/profiles", () => ({
  useProfiles: () => ({}),
  useProfile: () => undefined,
  profileDisplayName: () => null,
  profileAvatarUrl: () => null,
}));

vi.mock("../ListingCard", () => ({
  ListingCard: ({
    density,
    item,
  }: {
    density?: string;
    item: {
      title?: string | null;
      category?: string | null;
      condition?: string | null;
      distanceLabel?: string | null;
      price?: string;
    };
  }) => (
    <article data-testid="nearby-card" data-variant="softTrust" data-density={density}>
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

function setInput(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

async function renderNearby() {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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
}

describe("Nearby map chrome", () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    searchGeocode.mockReset();
    searchGeocode.mockResolvedValue({ available: true, suggestions: [] });
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
    host?.remove();
    root = undefined;
    host = undefined;
  });

  it("puts ZIP search in the sheet, a locate FAB on the map, and shorter cards", async () => {
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

    await renderNearby();

    const sheet = document.querySelector('[data-testid="nearby-sheet"]') as HTMLElement;
    const zip = document.querySelector('[data-testid="nearby-zip"]') as HTMLInputElement;
    expect(sheet.contains(zip)).toBe(true);
    expect(zip.getAttribute("placeholder")).toBe("Current location");
    expect(document.querySelector('[data-testid="nearby-locate-fab"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="nearby-menu-toggle"]')).toBeTruthy();
    expect(document.body.textContent).not.toContain("Search nearby");

    expect(sheet.dataset.sheetDetent).toBe("peek");
    await act(async () => {
      document.querySelector<HTMLElement>('[data-testid="nearby-menu-toggle"]')?.click();
    });
    expect(document.querySelector('[data-testid="nearby-filter-type"]')?.textContent).toContain(
      "Type",
    );
    expect(document.querySelector('[data-testid="nearby-filter-price"]')?.textContent).toContain(
      "ℏ",
    );
    await act(async () => {
      document.querySelector<HTMLElement>('[data-testid="nearby-menu-toggle"]')?.click();
    });
    expect(document.querySelector('[data-testid="nearby-count"]')?.textContent).toBe(
      "1 listing nearby",
    );
    const card = document.querySelector('[data-testid="nearby-card"]') as HTMLElement;
    expect(card.dataset.density).toBe("nearby");
    expect(document.body.textContent).toContain("Sony WH-1000XM5");
    expect(document.body.textContent).not.toMatch(/★|⭐/);

    await act(async () => {
      document.querySelector<HTMLElement>('[data-testid="nearby-sheet-handle"]')?.click();
    });
    expect(sheet.dataset.sheetDetent).toBe("hidden");
    expect(document.querySelector('[data-testid="nearby-card"]')).toBeNull();
    expect(document.querySelector('[data-testid="nearby-zip"]')).toBeNull();
    expect(document.querySelector('[data-testid="nearby-locate-fab"]')).toBeTruthy();

    await act(async () => {
      document.querySelector<HTMLElement>('[data-testid="nearby-map-canvas"]')?.click();
    });
    expect(sheet.dataset.sheetDetent).toBe("peek");
    expect(document.querySelector('[data-testid="nearby-card"]')).toBeTruthy();
  });

  it("accepts only US ZIPs in the in-sheet search", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ listings: [] }),
      })),
    );
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (_success: PositionCallback, error?: PositionErrorCallback) => {
          error?.({ code: 1 } as GeolocationPositionError);
        },
      },
    });
    searchGeocode.mockResolvedValue({
      available: true,
      suggestions: [
        {
          label: "Beverly Hills, California",
          lat: 34.09,
          lng: -118.41,
          countryCode: "us",
        },
        { label: "Toronto, Ontario", lat: 43.65, lng: -79.38, countryCode: "ca" },
      ],
    });

    await renderNearby();

    const zip = document.querySelector('[data-testid="nearby-zip"]') as HTMLInputElement;
    expect(zip.getAttribute("placeholder")).toBe("Location off");
    expect(document.querySelector('[data-testid="nearby-locate-fab"]')).toBeTruthy();

    await act(async () => {
      document.querySelector<HTMLElement>('[data-testid="nearby-menu-toggle"]')?.click();
    });
    expect(document.querySelector('[data-testid="nearby-menu"]')?.textContent).toContain(
      "US ZIP codes only",
    );
    await act(async () => {
      setInput(zip, "SW1A");
    });
    expect(document.body.textContent).toContain("US ZIP codes only");
    expect(searchGeocode).not.toHaveBeenCalled();

    await act(async () => {
      setInput(zip, "90210");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(searchGeocode).toHaveBeenCalledWith("90210", undefined, { country: "us" });
    expect(document.body.textContent).toContain("Beverly Hills, California");
    expect(document.body.textContent).not.toContain("Toronto, Ontario");

    await act(async () => {
      const hit = [...document.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Beverly Hills"),
      );
      hit?.click();
    });
    expect(document.querySelector('[data-testid="nearby-zip"]')?.getAttribute("placeholder")).toBe(
      "Beverly Hills",
    );
    expect(document.querySelector('[data-testid="nearby-menu"]')).toBeNull();
  });
});
