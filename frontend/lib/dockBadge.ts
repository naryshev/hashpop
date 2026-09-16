/** Display cap for dock badges. 10 and above render as `9+`. */
export const DOCK_BADGE_CAP = 9;

/**
 * Format a dock badge count. Hide at 0 (and below); cap display at `9+`.
 * Pill layout is for two-character labels (`9+`); single digits stay circular.
 */
export function formatDockBadgeCount(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return count > DOCK_BADGE_CAP ? "9+" : String(Math.floor(count));
}

export function dockBadgeIsPill(label: string): boolean {
  return label.length >= 2;
}
