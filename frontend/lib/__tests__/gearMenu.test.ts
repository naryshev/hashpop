import { describe, expect, it } from "vitest";
import { placeGearMenu } from "../gearMenu";

describe("placeGearMenu", () => {
  it("opens below the button and keeps an 8px inset from the right edge", () => {
    const placed = placeGearMenu(
      { top: 8, right: 386, bottom: 52, left: 342 },
      { width: 208, height: 236 },
      { width: 390, height: 800 },
    );
    expect(placed).toEqual({ top: 56, left: 174, maxHeight: null });
    expect(placed.left).toBeGreaterThanOrEqual(8);
    expect(placed.left + 208).toBeLessThanOrEqual(390 - 8);
    expect(placed.top + 236).toBeLessThanOrEqual(800 - 8);
  });

  it("flips above the button when the menu would leave the viewport", () => {
    const placed = placeGearMenu(
      { top: 340, right: 1244, bottom: 384, left: 1200 },
      { width: 208, height: 236 },
      { width: 1280, height: 400 },
    );
    expect(placed).toEqual({ top: 100, left: 1036, maxHeight: null });
    expect(placed.top).toBeGreaterThanOrEqual(8);
    expect(placed.top + 236).toBeLessThanOrEqual(400 - 8);
  });

  it("shifts right when the button sits too close to the left edge", () => {
    const placed = placeGearMenu(
      { top: 8, right: 48, bottom: 52, left: 4 },
      { width: 208, height: 100 },
      { width: 390, height: 800 },
    );
    expect(placed).toEqual({ top: 56, left: 8, maxHeight: null });
  });

  it("shifts a menu that fits the viewport instead of scrolling it", () => {
    const placed = placeGearMenu(
      { top: 100, right: 300, bottom: 140, left: 256 },
      { width: 208, height: 180 },
      { width: 390, height: 220 },
    );
    expect(placed).toEqual({ top: 8, left: 92, maxHeight: null });
    expect(placed.top + 180).toBeLessThanOrEqual(220 - 8);
  });

  it("scrolls only when the menu is taller than the viewport", () => {
    const placed = placeGearMenu(
      { top: 90, right: 344, bottom: 134, left: 300 },
      { width: 208, height: 300 },
      { width: 390, height: 220 },
    );
    expect(placed).toEqual({ top: 8, left: 136, maxHeight: 204 });
    expect(placed.top + (placed.maxHeight ?? 0)).toBe(220 - 8);
  });
});
