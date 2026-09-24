import { describe, expect, it } from "vitest";
import { parseViewMode, viewModeQueryValue } from "../marketplaceView";

describe("parseViewMode", () => {
  it("defaults a bare or unknown view to the mediaTrust grid", () => {
    expect(parseViewMode(null)).toBe("grid");
    expect(parseViewMode("")).toBe("grid");
    expect(parseViewMode("mosaic")).toBe("grid");
    expect(parseViewMode("grid")).toBe("grid");
  });

  it("keeps editorial and feed available as explicit modes", () => {
    expect(parseViewMode("editorial")).toBe("editorial");
    expect(parseViewMode("feed")).toBe("feed");
  });
});

describe("viewModeQueryValue", () => {
  it("omits the view param for the grid default and keeps other modes explicit", () => {
    expect(viewModeQueryValue("grid")).toBeNull();
    expect(viewModeQueryValue("editorial")).toBe("editorial");
    expect(viewModeQueryValue("feed")).toBe("feed");
  });
});
