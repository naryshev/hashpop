/**
 * Homepage SEO body copy. Single swap point for the server-rendered prose.
 * Source: hashvinci, 2026-10-25. Render this text as-is; do not paraphrase
 * at the call site. The document title and H1 live in lib/seo/homepage.ts.
 */

import { HOMEPAGE_SEO } from "../lib/seo/homepage";

export const HOME_LEDE =
  "Hashpop is a peer-to-peer marketplace for physical goods, built on Hedera. Sign in with your wallet, chat with the other side, and, when the seller offers it, lock the money in a protected on-chain HBAR payment until the deal is done. No blind trust, and no platform holding your funds or your identity.";

export const HOME_SECTION_LABEL = "About Hashpop";

export const HOME_CTA = {
  href: "/marketplace",
  label: "Browse the marketplace",
} as const;

export type HomeRun =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "link"; href: "/marketplace" | "/categories" | "/help"; text: string };

export type HomeSection = {
  id: string;
  title: string;
  paragraphs?: HomeRun[][];
  steps?: HomeRun[][];
};

export const HOME_SECTIONS: HomeSection[] = [
  {
    id: "reputation",
    title: "Reputation. Chat. Protected payments. On your wallet.",
    paragraphs: [
      [
        {
          kind: "text",
          text: "Every completed deal builds your reputation, and that reputation lives with your wallet, not inside our database. Buyers can see a seller's completed deals, completion rate and reviews before they make an offer. Messages are encrypted and tied to the listing, so the whole deal stays in one place.",
        },
      ],
    ],
  },
  {
    id: "escrow",
    title: "How protected HBAR payments work",
    steps: [
      [
        { kind: "strong", text: "Make an offer or buy." },
        { kind: "text", text: " Pick something in the " },
        { kind: "link", href: "/marketplace", text: "marketplace" },
        { kind: "text", text: " and pay in HBAR." },
      ],
      [
        { kind: "strong", text: "If the listing offers protected payments:" },
        {
          kind: "text",
          text: " Your HBAR sits in an on-chain contract. The seller can see it's there, but neither side can touch it.",
        },
      ],
      [
        { kind: "strong", text: "Ship it or meet up." },
        {
          kind: "text",
          text: " The seller ships, or you meet in person with the contract already locked.",
        },
      ],
      [
        { kind: "strong", text: "Confirm and release." },
        {
          kind: "text",
          text: " Once you have the item, the protected payment releases the HBAR to the seller and both sides leave a review.",
        },
      ],
    ],
  },
  {
    id: "start",
    title: "Get started",
    paragraphs: [
      [
        {
          kind: "text",
          text: "Connect a Hedera wallet like HashPack, browse by ",
        },
        { kind: "link", href: "/categories", text: "category" },
        {
          kind: "text",
          text: ", and message a seller about anything you like. Selling is just as quick: snap a few photos, set a price in HBAR and publish. Questions about wallets, protected payments or disputes? The ",
        },
        { kind: "link", href: "/help", text: "help center" },
        { kind: "text", text: " has the answers." },
      ],
      [
        { kind: "text", text: "Buying close to home? Open " },
        { kind: "link", href: "/marketplace", text: "Nearby" },
        {
          kind: "text",
          text: " to find listings on a map and meet up with a protected payment already locked when the listing offers one. Selling? Your listings, sales and reviews all live on your public profile, so every deal you close makes the next one easier.",
        },
      ],
    ],
  },
];

function runText(run: HomeRun): string {
  return run.text;
}

/** Visible homepage words, used to keep the module near the ~300 word target. */
export function homeCopyWordCount(): number {
  const chunks = [
    HOMEPAGE_SEO.h1,
    HOME_LEDE,
    ...HOME_SECTIONS.flatMap((section) => [
      section.title,
      ...(section.paragraphs ?? []).flat().map(runText),
      ...(section.steps ?? []).flat().map(runText),
    ]),
    HOME_CTA.label,
  ];
  return chunks.join(" ").trim().split(/\s+/).filter(Boolean).length;
}
