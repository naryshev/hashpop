import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { siteViewport, viewportMetaContent } from "../viewport";

describe("site viewport", () => {
  it("matches the zoomable cover viewport and omits scale locks", () => {
    expect(viewportMetaContent()).toBe("width=device-width, initial-scale=1, viewport-fit=cover");
    expect(siteViewport).not.toHaveProperty("maximumScale");
    expect(siteViewport).not.toHaveProperty("userScalable");
    expect(siteViewport.viewportFit).toBe("cover");
  });

  it("keeps text fields at 16px so iOS can zoom instead of locking it", () => {
    const cssPath = join(dirname(fileURLToPath(import.meta.url)), "../../../app/globals.css");
    const css = readFileSync(cssPath, "utf8");
    expect(css).toContain("font-size: 16px");
    expect(css).toContain("input.text-sm");
    expect(css).toContain("textarea.text-sm");
    expect(css).not.toMatch(/user-scalable\s*:\s*no/);
  });
});
