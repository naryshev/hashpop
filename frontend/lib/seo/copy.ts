/**
 * Paste-ready SEO P0 strings. Swap wording here only.
 * Research copy is verbatim — do not paraphrase in routes.
 */
export const SEO_COPY = {
  siteName: "Hashpop",
  canonicalOrigin: "https://hashpop.io",
  rootTitle: "Hashpop — Reputation, chat & protected payments on your wallet",
  rootDescription:
    "Buy and sell real stuff on Hedera with wallet reputation, encrypted deal chat, and optional protected payments in HBAR. Meetups with a contract.",
  marketplaceTitle: "Marketplace · Hashpop",
  marketplaceDescription:
    "Browse listings settled in HBAR — optional protected payments, wallet chat, and portable reputation. Meet locally with a contract or ship.",
  marketplaceOgDescription:
    "P2P marketplace on Hedera: optional protected payments, chat, and reputation on your wallet.",
  /** `{title} · {price} ℏ · Hashpop` */
  listingTitle: (title: string, priceHbar: string) => `${title} · ${priceHbar} ℏ · Hashpop`,
  listingFallbackTitle: "Listing · Hashpop",
  /** Used when a listing has no description. */
  listingDescriptionFallback: (title: string, priceHbar: string, protectedPayment = false) =>
    protectedPayment
      ? `${title} for ${priceHbar} ℏ on Hashpop — on-chain protected payment.`
      : `${title} for ${priceHbar} ℏ on Hashpop — peer-to-peer on Hedera.`,
  categoriesTitle: "Browse Categories · Hashpop",
  categoriesDescription:
    "Shop Hashpop by category — electronics, vehicles, fashion, collectibles, and more. Optional protected payments and wallet reputation built in.",
  profileTitle: "Profile · Hashpop",
  profileDescription: "Public wallet profile on Hashpop.",
  helpTitle: "Help Center · Hashpop",
  helpDescription:
    "Hashpop help center: how protected payments work, what HBAR is, connecting HashPack, disputes, returns and more.",
  supportTitle: "Support · Hashpop",
  supportDescription:
    "Get Hashpop support for a listing, a protected payment, or a meetup. Open a ticket with the steps and wallet details.",
  privacyTitle: "Privacy Policy · Hashpop",
  privacyDescription: "Privacy Policy for the Hashpop peer-to-peer marketplace on Hedera.",
  termsTitle: "Terms of Service · Hashpop",
  termsDescription: "Terms of Service for the Hashpop peer-to-peer marketplace on Hedera.",
} as const;

/** First ~155 characters of a listing description. */
export const META_DESCRIPTION_MAX = 155;
