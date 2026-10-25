/** Query that opens the Nearby overlay. The overlay has no route of its own. */
export const NEARBY_VIEW_PARAM = "view";
export const NEARBY_VIEW_VALUE = "nearby";

export function isNearbyView(params: { get(name: string): string | null }): boolean {
  return params.get(NEARBY_VIEW_PARAM) === NEARBY_VIEW_VALUE;
}

/** Same path, with `view=nearby` removed. Other params stay. */
export function hrefWithoutNearbyView(pathname: string, params: { toString(): string }): string {
  const next = new URLSearchParams(params.toString());
  if (next.get(NEARBY_VIEW_PARAM) !== NEARBY_VIEW_VALUE) {
    const current = params.toString();
    return current ? `${pathname}?${current}` : pathname;
  }
  next.delete(NEARBY_VIEW_PARAM);
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
