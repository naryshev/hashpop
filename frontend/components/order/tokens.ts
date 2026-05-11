// Hashpop "Mobile Order & Escrow" design tokens — mirror of `colors_and_type.css`
// from the design handoff bundle. Kept as a plain JS object so the inline
// styles in the order screen can match the prototype exactly.

export const HP = {
  bg: "#0b111b",
  bgCard: "#0e1422",
  bgElev: "#15181f",
  bgInput: "#0f1726",
  fg: "#edf2ff",
  muted: "#a9b0bf",
  dim: "rgba(255,255,255,0.55)",
  chrome: "#00ffa3",
  chromeDeep: "#00b37a",
  chromeBright: "#00e5ff",
  border: "rgba(74,94,131,0.4)",
  borderSoft: "rgba(255,255,255,0.08)",
  amber: "#fbbf24",
  orange: "#fb923c",
  rose: "#f43f5e",
  zinc: "#71717a",
  cta: "linear-gradient(110deg,#00b37a 0%,#00ffa3 50%,#00e5ff 100%)",
  glassCard: "linear-gradient(180deg,rgba(18,26,41,0.92),rgba(12,18,31,0.9))",
  glow: "0 0 24px rgba(0,255,163,0.25)",
} as const;

export type OrderState = "paid" | "shipped" | "delivered" | "released" | "disputed";
export type OrderRole = "buyer" | "seller";

export const STATE_LABEL: Record<OrderState, string> = {
  paid: "Escrow funded",
  shipped: "In transit",
  delivered: "Delivered",
  released: "Complete",
  disputed: "In dispute",
};

export const STATE_BADGE: Record<OrderState, { c: string; fg: string; label: string }> = {
  paid: { c: HP.chrome, fg: "#000", label: "PAID" },
  shipped: { c: HP.amber, fg: "#000", label: "SHIPPED" },
  delivered: { c: HP.chromeBright, fg: "#000", label: "DELIVERED" },
  released: { c: HP.chromeDeep, fg: "#fff", label: "RELEASED" },
  disputed: { c: HP.rose, fg: "#fff", label: "DISPUTED" },
};
