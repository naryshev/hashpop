/**
 * Marketplace grid trust chip (B+C hybrid).
 *
 * One chip, chosen from the same seller fields TrustStrip already maps
 * (`successfulCompletions`, `totalSales`) plus the listing's existing
 * `requireEscrow` flag. KYC is never the grid chip.
 *
 * Priority: completion % → Meetup → Escrow → omit.
 * Pending/Sold and an in-flight profile omit the chip (no flicker).
 */

export type GridTrustKind = "completion" | "meetup" | "escrow";

export type GridTrustChip = {
  kind: GridTrustKind;
  label: string;
};

export type GridTrustInput = {
  /** Profile batch still in flight. Omit every chip until it settles. */
  loading?: boolean;
  status?: string | null;
  requireEscrow?: boolean | null;
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

/** Pending/Sold replace the trust chip. Active is not a capsule on this grid. */
export function gridStatusCapsule(status?: string | null): GridStatusCapsule | null {
  const value = String(status || "")
    .trim()
    .toUpperCase();
  if (value === "SOLD") return "sold";
  if (value === "LOCKED") return "pending";
  return null;
}

export function gridTrustChip(input: GridTrustInput): GridTrustChip | null {
  if (input.loading) return null;
  if (gridStatusCapsule(input.status)) return null;

  const pct = completionPercent(input.successfulCompletions, input.totalSales);
  if (pct != null) return { kind: "completion", label: `${pct}%` };

  if (input.requireEscrow === false) return { kind: "meetup", label: "Meetup" };
  if (input.requireEscrow === true) return { kind: "escrow", label: "Escrow" };
  return null;
}
