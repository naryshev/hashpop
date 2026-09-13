/**
 * Shared semantic tokens for the iOS 27 pass. Hex lives here (and in the
 * matching CSS vars). Tailwind theme and order/tokens.ts consume these —
 * do not introduce new hex at call sites.
 */
export const color = {
  bg: "#0b111b",
  fg: "#edf2ff",
  muted: "#a9b0bf",
  chrome: "#00ffa3",
  chromeDeep: "#00b37a",
  chromeBright: "#00e5ff",
  danger: "#f43f5e",
  warning: "#fbbf24",
  onChrome: "#04150f",
  onWarning: "#241505",
} as const;

export const gradient = {
  cta: "linear-gradient(110deg,#00b37a 0%,#00ffa3 50%,#00e5ff 100%)",
} as const;

export const radius = {
  control: "14px",
  sheet: "28px",
} as const;
