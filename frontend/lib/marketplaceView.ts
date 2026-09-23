export type ViewMode = "grid" | "feed" | "editorial";

/**
 * Bare `/marketplace` (and any unknown `?view`) is the soft-trust grid.
 * Editorial and feed stay available as explicit toggles.
 */
export function parseViewMode(value: string | null): ViewMode {
  if (value === "feed" || value === "editorial") return value;
  return "grid";
}

/** Grid is the default URL, so selecting it clears `?view`. */
export function viewModeQueryValue(mode: ViewMode): string | null {
  return mode === "grid" ? null : mode;
}
