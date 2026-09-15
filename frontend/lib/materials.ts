/**
 * Shared iOS 27 Liquid Glass tokens (web approximation).
 * Values live in CSS vars / Tailwind theme; these class strings are the
 * single consumption point for TabBar, Sheet, and first-port surfaces.
 */
export const material = {
  regular: "backdrop-blur-material bg-material-regular border border-hairline",
  thick: "backdrop-blur-material-thick bg-material-thick",
  chrome: "backdrop-blur-material bg-material-chrome border border-hairline",
  scrim: "bg-scrim",
  hairline: "border-hairline",
} as const;

/** ≥44px circular glass control (thumb ×, reorder chevrons). */
export const glassChip = `${material.regular} flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-30`;

/** Listing CTA block + ConfirmPurchaseSheet footer. Sentence-case labels at call sites. */
export const listingCta = {
  filled:
    "btn-mint flex h-[52px] w-full items-center justify-center rounded-[14px] text-[15px] font-bold",
  tinted:
    "flex h-12 w-full items-center justify-center rounded-[14px] border border-[#00ffa3]/25 bg-[#00ffa3]/10 text-[15px] font-bold text-chrome transition-colors hover:bg-[#00ffa3]/15",
  cart: `${material.regular} flex h-11 w-full items-center justify-center rounded-[14px] text-[15px] font-medium text-white/85 transition-colors hover:bg-white/[0.12]`,
  cartIn:
    "backdrop-blur-material bg-material-regular flex h-11 w-full items-center justify-center rounded-[14px] border border-chrome/50 text-[15px] font-medium text-chrome transition-colors hover:bg-[#00ffa3]/10",
  wishlist:
    "w-full py-2 text-center text-[13px] font-medium text-white/50 transition-colors hover:text-white/80 disabled:opacity-40",
} as const;
