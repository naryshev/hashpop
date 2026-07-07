/**
 * Collapsed order-status model. The old UI walked users through a 4-step
 * escrow stepper; the redesigned flow shows a single status line with dates
 * and lets the backend settlement engine (EscrowV2) do the work.
 *
 * Set NEXT_PUBLIC_ESCROW_V2=true when the backend points at EscrowV2 — the
 * seller then never signs a wallet transaction after listing (saving a
 * tracking number is enough; the arbiter marks shipment on-chain).
 */

export const ESCROW_V2 = process.env.NEXT_PUBLIC_ESCROW_V2 === "true";

export type EscrowStateName =
  | "AWAITING_SHIPMENT"
  | "AWAITING_CONFIRMATION" // v1
  | "SHIPPED" // v2
  | "COMPLETE"
  | "REFUNDED" // v2
  | "UNKNOWN";

export type EscrowView = {
  buyer: string;
  seller: string;
  amount: string;
  createdAt: number;
  /** Operative deadline (unix s) for the current state — ship-by or auto-release. */
  timeoutAt: number;
  state: EscrowStateName;
  v2?: boolean;
  shippedAt?: number;
  disputed?: boolean;
};

export type OrderPhase = "paid" | "shipped" | "complete" | "refunded" | "disputed";

export function phaseFor(state: EscrowStateName | undefined, disputed?: boolean): OrderPhase {
  if (disputed) return "disputed";
  switch (state) {
    case "COMPLETE":
      return "complete";
    case "REFUNDED":
      return "refunded";
    case "SHIPPED":
    case "AWAITING_CONFIRMATION":
      return "shipped";
    default:
      return "paid";
  }
}

/** "Jul 13" — deadline dates are near-term so the year is noise. */
export function formatDeadline(unixSeconds: number | undefined): string | null {
  if (!unixSeconds || unixSeconds <= 0) return null;
  try {
    return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

export type StatusLine = {
  /** e.g. "Paid" */
  label: string;
  /** One sentence with the operative date, e.g. "Seller has until Jul 13 to ship." */
  detail: string;
  tone: "waiting" | "active" | "complete" | "refunded" | "disputed";
};

export function orderStatusLine(opts: {
  phase: OrderPhase;
  role: "buyer" | "seller" | "observer";
  timeoutAt?: number;
  isEscrow?: boolean;
}): StatusLine {
  const { phase, role } = opts;
  const date = formatDeadline(opts.timeoutAt);

  if (phase === "disputed") {
    return {
      label: "On hold",
      detail: "A dispute is under review — escrow timers are frozen until it's resolved.",
      tone: "disputed",
    };
  }

  if (phase === "paid") {
    if (role === "seller") {
      return {
        label: "Paid",
        detail: date
          ? `Ship and add tracking by ${date}, or the buyer is refunded automatically.`
          : "Ship and add tracking, or the buyer is refunded automatically.",
        tone: "active",
      };
    }
    return {
      label: "Paid",
      detail: date
        ? `Seller has until ${date} to ship — after that you're refunded automatically.`
        : "Waiting on the seller to ship. If they don't, you're refunded automatically.",
      tone: "waiting",
    };
  }

  if (phase === "shipped") {
    if (role === "seller") {
      return {
        label: "Shipped",
        detail: date
          ? `Funds release to you around ${date}, sooner if the buyer confirms delivery.`
          : "Funds release to you automatically, sooner if the buyer confirms delivery.",
        tone: "waiting",
      };
    }
    return {
      label: "Shipped",
      detail: date
        ? `The seller is paid on ${date} unless you report a problem first.`
        : "The seller is paid automatically unless you report a problem first.",
      tone: "active",
    };
  }

  if (phase === "refunded") {
    return {
      label: "Refunded",
      detail:
        role === "seller"
          ? "The escrow timed out and the buyer's payment was returned."
          : "Your payment was returned in full.",
      tone: "refunded",
    };
  }

  // complete
  if (opts.isEscrow === false) {
    return {
      label: "Complete",
      detail:
        role === "seller"
          ? "The buyer paid you directly — no escrow on this sale."
          : "You paid the seller directly — no escrow on this sale.",
      tone: "complete",
    };
  }
  return {
    label: "Complete",
    detail:
      role === "seller"
        ? "Funds were released from escrow to your wallet."
        : "Funds were released to the seller. Trade closed.",
    tone: "complete",
  };
}
