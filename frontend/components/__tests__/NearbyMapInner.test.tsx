import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import NearbyMapInner from "../NearbyMapInner";
import type { NearbyListing } from "../../lib/nearbyListings";

vi.mock("../AreaDisc", () => ({
  AreaDisc: () => {
    throw new Error("Nearby discovery must not render a privacy disc");
  },
}));

vi.mock("../DarkMap", () => ({
  default: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dark-map">{children}</div>
  ),
}));

vi.mock("react-map-gl/maplibre", () => ({
  Marker: ({
    children,
    longitude,
    latitude,
    onClick,
  }: {
    children?: React.ReactNode;
    longitude: number;
    latitude: number;
    onClick?: (event: { originalEvent: { stopPropagation: () => void } }) => void;
  }) => (
    <div
      data-testid="marker-hit"
      data-lng={longitude}
      data-lat={latitude}
      onClick={() => onClick?.({ originalEvent: { stopPropagation: () => undefined } })}
    >
      {children}
    </div>
  ),
  Popup: () => {
    throw new Error("Nearby pins do not use a rating popup");
  },
}));

const item: NearbyListing = {
  id: "lst-1",
  title: "Sony WH-1000XM5",
  subtitle: null,
  description: null,
  price: "5",
  lat: 37.78,
  lng: -122.42,
  imageUrl: null,
  mediaUrls: [],
  category: "Headphones & Audio",
  condition: "Like new",
  city: "San Francisco",
  requireEscrow: true,
};

let root: Root | undefined;
let host: HTMLElement | undefined;

describe("NearbyMapInner price pins", () => {
  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
    host?.remove();
    root = undefined;
    host = undefined;
  });

  it("places an exact ℏ price pin and does not render a privacy disc", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const onSelect = vi.fn();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(
        createElement(NearbyMapInner, {
          center: [37.78, -122.42],
          zoom: 13,
          userPos: [37.77, -122.41],
          items: [item],
          activeId: null,
          onSelect,
          onViewChange: () => undefined,
        }),
      );
    });

    const pin = document.querySelector('[data-testid="nearby-price-pin"]');
    expect(pin?.getAttribute("aria-label")).toBe("Sony WH-1000XM5, 5 ℏ");
    expect(pin?.textContent).toContain("ℏ");
    expect(pin?.textContent).not.toMatch(/★|⭐/);
    const marker = pin?.closest("[data-lng]");
    expect(marker?.getAttribute("data-lng")).toBe("-122.42");
    expect(marker?.getAttribute("data-lat")).toBe("37.78");
    expect(document.querySelector('[data-testid="dark-map"]')).toBeTruthy();

    await act(async () => {
      pin?.closest<HTMLElement>('[data-testid="marker-hit"]')?.click();
    });
    expect(onSelect).toHaveBeenCalledWith("lst-1");
  });
});
