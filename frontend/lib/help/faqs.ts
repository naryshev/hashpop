export const DISCORD_INVITE_URL = "https://discord.gg/VYt4WrYM7V";

export type Faq = { q: string; a: string; tags?: string };

export const FAQS: { category: string; items: Faq[] }[] = [
  {
    category: "Getting started",
    items: [
      {
        q: "How do I connect HashPack?",
        a: 'Click "Connect wallet" and approve the pairing request in the HashPack browser extension or mobile app. On desktop, install the HashPack extension first. On mobile, use the QR code or deep link to open the HashPack app and approve. If nothing happens within a few seconds on desktop, HashPack likely isn\'t installed — use the "Install HashPack" link or pair via QR code.',
      },
      {
        q: "What is HBAR and how do I get it?",
        a: "HBAR is the native cryptocurrency of the Hedera network, used to pay for listings, purchases, and network (gas) fees on Hashpop. You can buy HBAR on most major exchanges and withdraw it to your HashPack wallet. You'll need a small amount of HBAR to cover network fees even when listing items.",
      },
      {
        q: "Do I need an account or password?",
        a: "No. Hashpop is wallet-first — your HashPack wallet is your identity. There are no passwords. You can optionally set a display name, avatar, and bio on your profile so buyers see a friendly name instead of your wallet address.",
      },
    ],
  },
  {
    category: "Buying & protected payments",
    items: [
      {
        q: "How do protected payments work?",
        a: "When a listing offers a protected payment, your HBAR is held by an on-chain smart contract instead of going straight to the seller. Hashpop does not hold the funds. The seller ships the item and adds tracking; once you confirm receipt, the contract releases the funds to the seller. If the seller never ships, the payment auto-refunds you after the timeout. Protection is optional and set per listing.",
      },
      {
        q: 'What does "PENDING" status mean?',
        a: "PENDING means the listing has been created but its on-chain transaction hasn't been confirmed yet. This is usually resolved within a few seconds. Once confirmed, the listing flips to ACTIVE and can be purchased.",
      },
      {
        q: "How do I confirm I received an item?",
        a: 'Open Purchases → Bought, find the order, and click "Confirm receipt" once the item arrives. On a listing with a protected payment, this releases the funds to the seller. If you don\'t act, the payment auto-releases after the timeout.',
      },
      {
        q: "What is the return policy?",
        a: "Hashpop is a peer-to-peer marketplace for private sales, so there is no platform-wide return guarantee. When a listing offers a protected payment, non-delivery is covered: if the seller doesn't ship, the smart contract refunds you. For item disputes after delivery, open a dispute so both parties and support can review.",
      },
    ],
  },
  {
    category: "Selling & shipping",
    items: [
      {
        q: "How do I add tracking after a sale?",
        a: 'Open Purchases → Sold (or the order detail page), click "Mark as shipped", and enter the carrier and tracking number. The buyer immediately sees the tracking info with a link to the carrier\'s tracking page, and the order tracker advances to "Awaiting confirmation".',
      },
      {
        q: "What makes a good listing?",
        a: "Listings need at least one photo, a clear title, a price above zero, and a category. A description is optional. Listings that add more photos and a pinned location tend to sell faster and build more trust. You can also add priced options (color, storage, condition) on one listing.",
      },
    ],
  },
  {
    category: "Trust & disputes",
    items: [
      {
        q: "How do I dispute a transaction?",
        a: "If something goes wrong after the seller marks an item as shipped, open the order and click \"Open dispute\". This freezes the protected payment, notifies both parties, and creates a structured support ticket so the team can help resolve it. Don't confirm receipt if you haven't received the item.",
      },
      {
        q: "What is KYC verification and why verify?",
        a: "KYC (Know Your Customer) verification confirms your identity. Verified users get a verified badge on their profile and listings, which builds buyer trust and can unlock listing higher-value items. Start verification from your profile page — your details are private and used only for verification.",
      },
      {
        q: "How do ratings work?",
        a: "After a transaction completes, both the buyer and seller can leave each other a 1–5 star rating and an optional comment. Ratings are public and appear on profiles and listing cards so you can gauge who you're trading with.",
      },
    ],
  },
];
