/**
 * Format listing createdAt for display (date and time).
 */
export function formatListingDate(createdAt: string | Date | null | undefined): string {
  if (createdAt == null) return "—";
  const d = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}
