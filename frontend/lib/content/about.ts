/**
 * /about copy. Swap wording here. `{ESCROW}` is filled from `BRAND.escrowTerm`.
 * Counsel fallback for that term is "on-chain hold".
 *
 * Facts Daniel has not confirmed live in `ABOUT_UNCONFIRMED` with
 * `confirmed: false`. They stay out of the page and out of FAQPage JSON-LD
 * until that flag is true. The surrounding answer still publishes.
 */

export const BRAND = {
  escrowTerm: "escrow",
  /** Sentence-start form of `escrowTerm`. `{ESCROW_CAP}` maps here. */
  escrowTermCap: "Escrow",
} as const;

export function applyEscrowTerm(text: string): string {
  return text
    .replaceAll("{ESCROW_CAP}", BRAND.escrowTermCap)
    .replaceAll("{ESCROW}", BRAND.escrowTerm);
}

export const ABOUT_UNCONFIRMED = [
  {
    id: "dispute-resolution",
    confirmed: false as const,
    text: "Dispute resolution: who decides, timelines, refund path — Daniel to confirm before publishing",
  },
  {
    id: "other-wallets",
    confirmed: false as const,
    text: "List other supported wallets if any.",
  },
  {
    id: "hashpop-fee",
    confirmed: false as const,
    text: "Hashpop fee — Daniel to confirm the number; put it here plainly.",
  },
] as const;

export type AboutSpan =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string }
  | { type: "unconfirmed"; confirmed: boolean; text: string };

export type PublishedSpan =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string };

export type PublishedAboutFaq = {
  question: string;
  answerText: string;
  links: { href: string; text: string }[];
  spans: PublishedSpan[];
};

export function renderAboutSpans(spans: readonly AboutSpan[]): {
  text: string;
  links: { href: string; text: string }[];
} {
  let text = "";
  const links: { href: string; text: string }[] = [];
  for (const span of spans) {
    if (span.type === "unconfirmed") {
      if (!span.confirmed) continue;
      text += applyEscrowTerm(span.text);
      continue;
    }
    const value = applyEscrowTerm(span.text);
    text += value;
    if (span.type === "link") links.push({ href: span.href, text: value });
  }
  return { text, links };
}

const disputeFact = ABOUT_UNCONFIRMED[0];
const walletsFact = ABOUT_UNCONFIRMED[1];
const feeFact = ABOUT_UNCONFIRMED[2];

/**
 * /how-it-works, /sell, and /listing/create are not routes on main.
 * The deal answer links to /help. The sell sentence stays plain text.
 */
const ABOUT_FAQS: { question: string; answer: AboutSpan[] }[] = [
  {
    question: "Is it safe to pay for things in crypto?",
    answer: [
      {
        type: "text",
        text: "Paying a stranger directly in crypto is risky, and consumer guides are right to warn about it: once it's sent, it's gone. Hashpop changes the order. On listings with {ESCROW}, your HBAR goes into an on-chain contract first; the seller can see it's there, and it only releases when you confirm you got the item. Look for the {ESCROW} badge before you pay. You can also check the seller's completed deals and reviews before you pay. No marketplace can promise zero risk, so start small with new trading partners and read our ",
      },
      { type: "link", href: "/help", text: "help center" },
      { type: "text", text: " if anything feels off." },
    ],
  },
  {
    question: "Who holds my money while a deal is open, and what if it goes wrong?",
    answer: [
      {
        type: "text",
        text: "You pay, the HBAR locks in the contract, the seller ships or meets you, and you confirm to release it. If the item never shows up or isn't as described, don't confirm; open a dispute from the deal instead. ",
      },
      {
        type: "unconfirmed",
        confirmed: disputeFact.confirmed,
        text: `${disputeFact.text}. `,
      },
      { type: "text", text: "Step-by-step details live in " },
      { type: "link", href: "/help", text: "How it works" },
      { type: "text", text: "." },
    ],
  },
  {
    question: "What wallet do I need?",
    answer: [
      {
        type: "text",
        text: "A Hedera wallet. We support HashPack, the most popular one: install it, add a little HBAR, and connect. There are no passwords to create, and your wallet address is your account.",
      },
      {
        type: "unconfirmed",
        confirmed: walletsFact.confirmed,
        text: ` ${walletsFact.text}`,
      },
    ],
  },
  {
    question: "What does it cost?",
    answer: [
      {
        type: "unconfirmed",
        confirmed: feeFact.confirmed,
        text: `${feeFact.text} `,
      },
      {
        type: "text",
        text: "Every transaction also pays a small Hedera network fee, which is usually a fraction of a cent. USD values shown on Hashpop are approximate, based on the current HBAR price; all payments are made in HBAR.",
      },
    ],
  },
  {
    question: "How do local meetups work?",
    answer: [
      { type: "text", text: "Find listings near you with Nearby on the " },
      { type: "link", href: "/marketplace", text: "marketplace" },
      {
        type: "text",
        text: ", agree on a time in chat, and, if the listing offers {ESCROW}, lock the payment before you go. Meet somewhere public and well lit, check the item in person, then confirm to release. If it's not what was promised, walk away without confirming.",
      },
    ],
  },
  {
    question: "Can I sell items for crypto on Hashpop?",
    answer: [
      {
        type: "text",
        text: "Yes. Connect your wallet, snap a few photos, write an honest description and set a price in HBAR. You get paid when the buyer confirms. See Selling on Hashpop for what you can and can't list.",
      },
    ],
  },
  {
    question: "Where do I get help with an order or my account?",
    answer: [
      { type: "text", text: "Our " },
      { type: "link", href: "/help", text: "help center" },
      {
        type: "text",
        text: " covers wallets, orders, disputes and account questions in detail.",
      },
    ],
  },
];

function publishedSpans(spans: readonly AboutSpan[]): PublishedSpan[] {
  const visible: PublishedSpan[] = [];
  for (const span of spans) {
    if (span.type === "unconfirmed") {
      if (!span.confirmed) continue;
      visible.push({ type: "text", text: applyEscrowTerm(span.text) });
      continue;
    }
    const text = applyEscrowTerm(span.text);
    if (span.type === "link") visible.push({ type: "link", text, href: span.href });
    else visible.push({ type: "text", text });
  }
  return visible;
}

export function publishedAboutFaqs(): PublishedAboutFaq[] {
  return ABOUT_FAQS.map((faq) => {
    const rendered = renderAboutSpans(faq.answer);
    return {
      question: applyEscrowTerm(faq.question),
      answerText: rendered.text,
      links: rendered.links,
      spans: publishedSpans(faq.answer),
    };
  });
}

export function aboutFaqPageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage" as const,
    mainEntity: publishedAboutFaqs().map((faq) => ({
      "@type": "Question" as const,
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer" as const,
        text: faq.answerText,
      },
    })),
  };
}

export const ABOUT_PAGE = {
  title: "About Hashpop – A Hedera Marketplace for Real Stuff",
  description: applyEscrowTerm(
    "Hashpop is a peer-to-peer Hedera marketplace where you buy and sell items for crypto, paid in HBAR through an on-chain {ESCROW} contract. Reputation, chat and meetups, all on your wallet.",
  ),
  h1: "Real stuff. Real people. Paid in HBAR.",
  lede: applyEscrowTerm(
    "Hashpop is a peer-to-peer Hedera marketplace for physical goods. Buy and sell items for crypto with people near you or across the country, with reputation, chat and an optional on-chain {ESCROW} contract, all tied to your wallet.",
  ),
  byline: "Hashpop",
  updated: "Updated Oct 2026",
  whyHeading: "Why we built it",
  why: [
    "If you've ever traded in a Discord, a Telegram group or a parking lot, you know the deal: someone has to go first, and sometimes they get burned. Big marketplaces fix that by holding your money and your identity. We think there's a better way.",
    "On Hashpop, the money can wait in a smart contract on Hedera instead of with us. Your track record lives with your wallet, so it comes with you. And when you meet up to hand something over, you can have a contract in place first.",
  ],
  pillarsHeading: "What we stand for",
  pillars: [
    {
      id: "reputation",
      icon: "shield",
      lead: "Reputation that leaves with you.",
      body: "Completed deals, completion rate and reviews are tied to your wallet, not locked in our database.",
    },
    {
      id: "chat",
      icon: "chat",
      lead: "Chat where the deal happens.",
      body: "Encrypted wallet-to-wallet messages pinned to the listing, so offers, meetups and updates stay in one thread.",
    },
    {
      id: "hold",
      icon: "lock",
      lead: applyEscrowTerm("{ESCROW_CAP} we never hold."),
      body: "When a listing offers it, payment locks in an on-chain contract until the buyer confirms. Hashpop never has custody of your funds.",
    },
    {
      id: "meetups",
      icon: "pin",
      lead: "Meetups with a contract.",
      body: "Lock the payment before you meet, instead of counting cash or trusting a screenshot.",
    },
  ],
  faqHeading: "Questions people ask before their first deal",
  finePrint:
    'Hashpop is provided "as is", with no warranties. We don\'t guarantee any listing, transaction or outcome, and nothing here is financial or legal advice.',
  cta: { href: "/marketplace", label: "Browse the marketplace" },
} as const;
