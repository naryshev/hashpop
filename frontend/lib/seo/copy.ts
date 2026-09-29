/**
 * Hashpop SEO copy (positioning v2).
 *
 * Swap strings here. Page metadata, Open Graph, and JSON-LD read these
 * constants so Eng can update wording without hunting through routes.
 *
 * Positioning drawn from the product: peer-to-peer marketplace on Hedera,
 * meetup or on-chain escrow, settlement in HBAR.
 */
export const SEO_COPY = {
  siteName: "Hashpop",
  canonicalOrigin: "https://hashpop.io",
  defaultDescription:
    "Peer-to-peer marketplace on Hedera. Meet up or lock escrow, then settle in HBAR.",
  marketplaceTitle: "Marketplace · Hashpop",
  marketplaceDescription:
    "Peer-to-peer marketplace on Hedera with meetup and escrow trust. Buy and sell, then settle in HBAR.",
  listingTitle: (title: string) => `${title} · Hashpop`,
  listingFallbackTitle: "Listing · Hashpop",
  listingFallbackDescription:
    "Peer-to-peer listing on Hashpop. Meetup or escrow trust on Hedera, settled in HBAR.",
  categoriesTitle: "Browse Categories · Hashpop",
  categoriesDescription:
    "Browse the Hashpop marketplace by category — electronics, vehicles, fashion, collectibles and more.",
  helpTitle: "Help Center · Hashpop",
  helpDescription:
    "Hashpop help center: how escrow works, what HBAR is, connecting HashPack, disputes, returns and more.",
  supportTitle: "Support · Hashpop",
  supportDescription:
    "Get Hashpop support for a listing, escrow, or meetup. Open a ticket with the steps and wallet details.",
  privacyTitle: "Privacy Policy · Hashpop",
  privacyDescription: "Privacy Policy for the Hashpop peer-to-peer marketplace on Hedera.",
  termsTitle: "Terms of Service · Hashpop",
  termsDescription: "Terms of Service for the Hashpop peer-to-peer marketplace on Hedera.",
} as const;

/** Meta descriptions stay within a typical search-snippet length. */
export const META_DESCRIPTION_MAX = 160;

/** schema.org Offer currency. Listings are priced in HBAR (ℏ), not fiat. */
export const OFFER_PRICE_CURRENCY = "HBAR" as const;
