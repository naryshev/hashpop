import type { Viewport } from "next";

/**
 * Zoom stays enabled. iOS input zoom is avoided by keeping text fields at
 * 16px (see globals.css), not by maximum-scale or user-scalable=no.
 * viewport-fit=cover keeps env(safe-area-inset-top) working for .hp-brand-safe-top.
 */
export const siteViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b111b",
};

export function viewportMetaContent(
  viewport: Pick<Viewport, "width" | "initialScale" | "viewportFit"> = siteViewport,
): string {
  return `width=${viewport.width}, initial-scale=${viewport.initialScale}, viewport-fit=${viewport.viewportFit}`;
}
