/**
 * Homepage title, H1, and description. One module so a later legal pass
 * can swap the wording in a single place. User-facing copy says
 * "protected payments" until a lawyer reviews the escrow wording.
 */
export const HOMEPAGE_SEO = {
  title: "Hashpop – P2P Hedera Marketplace | Protected HBAR Payments",
  h1: "Buy and sell real stuff on Hedera, with protected HBAR payments",
  description:
    "Buy and sell real stuff on Hedera with wallet reputation, encrypted deal chat, and protected HBAR payments. Meetups with a contract.",
  /** WebSite node in the root JSON-LD graph. Marketplace page meta stays on SEO_COPY. */
  websiteDescription:
    "Browse listings settled in HBAR — protected payments, wallet chat, and portable reputation. Meet locally with a contract or ship.",
} as const;
