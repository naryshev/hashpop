/** Round to 2 decimal places (~1 km) so stored/displayed coords stay neighborhood-scale. */
export function roundCoordForPrivacy(n: number): number | null {
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}
