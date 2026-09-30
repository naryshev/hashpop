import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import LocationPickerMap from "../LocationPickerMap";

vi.mock("../DarkMap", () => ({
  default: ({ children, zoom }: { children?: React.ReactNode; zoom: number }) => (
    <div data-testid="picker-map" data-zoom={zoom}>
      {children}
    </div>
  ),
}));

vi.mock("react-map-gl/maplibre", () => ({
  Marker: () => {
    throw new Error("Location privacy map must not render an exact pin");
  },
  Popup: () => {
    throw new Error("Location privacy map must not render a pin popup");
  },
  Source: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="privacy-area">{children}</div>
  ),
  Layer: () => null,
}));

let root: Root | undefined;
let host: HTMLElement | undefined;

describe("LocationPickerMap privacy blob", () => {
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

  it("draws a country-zoom area disc and no exact pin", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(createElement(LocationPickerMap, { lat: 37.77, lng: -122.42 }));
    });
    expect(document.querySelector('[data-testid="privacy-area"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="picker-map"]')?.getAttribute("data-zoom")).toBe(
      "7",
    );
    expect(document.querySelector('[data-testid="nearby-price-pin"]')).toBeNull();
  });
});
