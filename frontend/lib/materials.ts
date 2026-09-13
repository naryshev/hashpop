/**
 * Shared iOS 27 Liquid Glass tokens (web approximation).
 * Values live in CSS vars / Tailwind theme; these class strings are the
 * single consumption point for TabBar, Sheet, and first-port surfaces.
 */
export const material = {
  regular: "backdrop-blur-material bg-material-regular border border-hairline",
  thick: "backdrop-blur-material-thick bg-material-thick",
  chrome: "backdrop-blur-material bg-material-chrome border border-hairline",
  scrim: "bg-scrim",
  hairline: "border-hairline",
} as const;
