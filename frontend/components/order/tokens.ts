import { color, gradient } from "@/lib/designTokens";
import type { CapsuleTone } from "@/components/ui/Capsule";
import type { OrderPhase } from "@/lib/orderStatus";

export type OrderState = "paid" | "shipped" | "delivered" | "released" | "disputed";
export type OrderRole = "buyer" | "seller";

export const STATE_LABEL: Record<OrderState, string> = {
  paid: "Escrow funded",
  shipped: "In transit",
  delivered: "Delivered",
  released: "Complete",
  disputed: "In dispute",
};

export const PHASE_LABEL: Record<OrderPhase, string> = {
  paid: STATE_LABEL.paid,
  shipped: STATE_LABEL.shipped,
  complete: STATE_LABEL.released,
  refunded: "Refunded",
  disputed: STATE_LABEL.disputed,
};

export const PHASE_TONE: Record<OrderPhase, CapsuleTone> = {
  paid: "mint",
  shipped: "warning",
  complete: "deep",
  refunded: "danger",
  disputed: "danger",
};

/** Thin HP shim — values come from the shared semantic map. Prefer Tailwind. */
export const HP = {
  bg: color.bg,
  fg: color.fg,
  muted: color.muted,
  chrome: color.chrome,
  chromeDeep: color.chromeDeep,
  chromeBright: color.chromeBright,
  rose: color.danger,
  amber: color.warning,
  cta: gradient.cta,
} as const;
