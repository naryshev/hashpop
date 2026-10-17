/** Viewport box used to keep the gear menu on screen. */
export type GearMenuBox = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type GearMenuPlacement = {
  top: number;
  left: number;
  /** Set only when the menu must scroll inside the viewport. */
  maxHeight: number | null;
};

const GAP = 4;

/**
 * Anchor the gear menu to its button. Prefer opening below; flip above when
 * that side has more room; shift so the menu stays inside the viewport.
 * Internal scrolling is only used when the menu is taller than the viewport.
 */
export function placeGearMenu(
  anchor: GearMenuBox,
  menu: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = 8,
): GearMenuPlacement {
  const width = Math.max(0, menu.width);
  const height = Math.max(0, menu.height);
  const minLeft = margin;
  const maxLeft = Math.max(margin, viewport.width - margin - width);
  const left = Math.min(Math.max(anchor.right - width, minLeft), maxLeft);

  const minTop = margin;
  const maxBottom = viewport.height - margin;
  const belowTop = anchor.bottom + GAP;
  const spaceBelow = maxBottom - belowTop;
  const spaceAbove = anchor.top - GAP - minTop;
  const openBelow = spaceBelow >= height || spaceBelow >= spaceAbove;
  let top = openBelow ? belowTop : anchor.top - GAP - height;

  if (height <= maxBottom - minTop) {
    if (top < minTop) top = minTop;
    if (top + height > maxBottom) top = Math.max(minTop, maxBottom - height);
    return { top, left, maxHeight: null };
  }

  return { top: minTop, left, maxHeight: Math.max(0, maxBottom - minTop) };
}
