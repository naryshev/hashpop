/**
 * Marketplace grid trust chips (Concept C soft-trust).
 *
 * Up to three chips from the same seller fields TrustStrip already maps
 * (`successfulCompletions`, `totalSales`) plus the listing's fulfillment
 * flags. KYC, deal counts, and stars are never grid chips.
 *
 * Order: completion % → Meetup → Escrow. Omit what does not apply.
 * Pending/Sold and an in-flight profile omit the whole row (no flicker).
 */

export type GridTrustKind = "completion" | "meetup" | "escrow";

/** Mint quiet fill starts here. Below this, a percent stays silver glass. */
export const COMPLETION_HIGH_BAND = 90;

export type GridTrustTone = "mint" | "silver";

export type GridTrustChip = {
  kind: GridTrustKind;
  label: string;
  tone: GridTrustTone;
};

export type GridTrustInput = {
  /** Profile batch still in flight. Omit every chip until it settles. */
  loading?: boolean;
  status?: string | null;
  /**
   * Existing listing flag. False = meetup. True = on-chain escrow.
   * Omitted = no fulfillment chip (do not invent a default).
   */
  requireEscrow?: boolean | null;
  /**
   * Explicit meetup capability. With `requireEscrow === true`, both
   * Meetup and Escrow show (meetup-with-contract).
   */
  meetup?: boolean | null;
  successfulCompletions?: number | null;
  totalSales?: number | null;
  /** Accepted so callers can pass the profile flag; never rendered. */
  kycVerified?: boolean | null;
};

export type GridStatusCapsule = "pending" | "sold";

/** Completion rate from TrustStrip's completion/sales pair. Null when there are no sales. */
export function completionPercent(
  successfulCompletions: number | null | undefined,
  totalSales: number | null | undefined,
): number | null {
  if (successfulCompletions == null || totalSales == null) return null;
  if (!Number.isFinite(successfulCompletions) || !Number.isFinite(totalSales)) return null;
  if (totalSales <= 0) return null;
  const pct = Math.round((successfulCompletions * 100) / totalSales);
  return Math.min(100, Math.max(0, pct));
}

/** Pending/Sold replace the trust row. Active is not a capsule on this grid. */
export function gridStatusCapsule(status?: string | null): GridStatusCapsule | null {
  const value = String(status || "")
    .trim()
    .toUpperCase();
  if (value === "SOLD") return "sold";
  if (value === "LOCKED") return "pending";
  return null;
}

export function gridTrustChips(input: GridTrustInput): GridTrustChip[] {
  if (input.loading) return [];
  if (gridStatusCapsule(input.status)) return [];

  const chips: GridTrustChip[] = [];
  const pct = completionPercent(input.successfulCompletions, input.totalSales);
  if (pct != null) {
    chips.push({
      kind: "completion",
      label: `${pct}%`,
      tone: pct >= COMPLETION_HIGH_BAND ? "mint" : "silver",
    });
  }

  const meetup = input.meetup === true || input.requireEscrow === false;
  const escrow = input.requireEscrow === true;
  if (meetup) chips.push({ kind: "meetup", label: "Meetup", tone: "silver" });
  if (escrow) chips.push({ kind: "escrow", label: "Escrow", tone: "silver" });
  return chips;
}
