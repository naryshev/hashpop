import { describe, expect, it } from "vitest";
import { hrefWithoutNearbyView, isNearbyView } from "../nearbyView";

describe("nearby view query", () => {
  it("recognizes view=nearby and drops only that param", () => {
    expect(isNearbyView(new URLSearchParams("view=nearby"))).toBe(true);
    expect(isNearbyView(new URLSearchParams("q=bike"))).toBe(false);
    expect(hrefWithoutNearbyView("/marketplace", new URLSearchParams("view=nearby"))).toBe(
      "/marketplace",
    );
    expect(hrefWithoutNearbyView("/marketplace", new URLSearchParams("q=bike&view=nearby"))).toBe(
      "/marketplace?q=bike",
    );
    expect(hrefWithoutNearbyView("/marketplace", new URLSearchParams("q=bike"))).toBe(
      "/marketplace?q=bike",
    );
  });
});
