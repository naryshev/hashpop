"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Search, LifeBuoy } from "lucide-react";

const DISCORD_INVITE_URL = "https://discord.gg/VYt4WrYM7V";

type Faq = { q: string; a: string; tags?: string };

const FAQS: { category: string; items: Faq[] }[] = [
  {
    category: "Getting started",
    items: [
      {
        q: "How do I connect HashPack?",
        a: "Click \"Connect wallet\" and approve the pairing request in the HashPack browser extension or mobile app. On desktop, install the HashPack extension first. On mobile, use the QR code or deep link to open the HashPack app and approve. If nothing happens within a few seconds on desktop, HashPack likely isn't installed — use the \"Install HashPack\" link or pair via QR code.",
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
    category: "Buying & escrow",
    items: [
      {
        q: "How does escrow work?",
        a: "When you buy an item that requires escrow, your HBAR is locked in the Hashpop smart contract instead of going straight to the seller. The seller ships the item and adds tracking; once you confirm receipt, the funds are released to the seller. If the seller never ships, escrow auto-refunds you after the timeout window.",
      },
      {
        q: "What does \"PENDING\" status mean?",
        a: "PENDING means the listing has been created but its on-chain transaction hasn't been confirmed yet. This is usually resolved within a few seconds. Once confirmed, the listing flips to ACTIVE and can be purchased.",
      },
      {
        q: "How do I confirm I received an item?",
        a: "Open Purchases → Bought, find the order, and click \"Confirm receipt\" once the item arrives. This releases the escrowed payment to the seller. If you don't act, escrow auto-releases after the timeout.",
      },
      {
        q: "What is the return policy?",
        a: "Hashpop is a peer-to-peer marketplace for private sales, so there is no platform-wide return guarantee. Escrow protects you against non-delivery: if the seller doesn't ship, you're refunded. For item disputes after delivery, open a dispute so both parties and support can review.",
      },
    ],
  },
  {
    category: "Selling & shipping",
    items: [
      {
        q: "How do I add tracking after a sale?",
        a: "Open Purchases → Sold (or the order detail page), click \"Mark as shipped\", and enter the carrier and tracking number. The buyer immediately sees the tracking info with a link to the carrier's tracking page, and the escrow tracker advances to \"Awaiting confirmation\".",
      },
      {
        q: "What makes a good listing?",
        a: "Listings must have at least one photo, a clear title, a price above zero, a category, and a description of at least 20 words. Listings that meet the higher \"Listing health\" targets (3+ photos, a detailed 60+ word description, a pinned location) tend to sell faster and build more trust.",
      },
    ],
  },
  {
    category: "Trust & disputes",
    items: [
      {
        q: "How do I dispute a transaction?",
        a: "If something goes wrong after the seller marks an item as shipped, open the order and click \"Open dispute\". This freezes the escrow, notifies both parties, and creates a structured support ticket so the team can help resolve it. Don't confirm receipt if you haven't received the item.",
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

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQS;
    return FAQS.map((group) => ({
      category: group.category,
      items: group.items.filter(
        (f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q),
      ),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            <LifeBuoy className="text-chrome" size={26} />
            Help Center
          </h1>
          <p className="mt-2 text-sm text-silver">
            Answers to common questions about escrow, HBAR, HashPack, disputes and more.
          </p>
        </header>

        <div className="relative mb-6">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-silver/60"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help articles…"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-silver/50 focus:border-white/20 focus:outline-none"
          />
        </div>

        <div className="space-y-8">
          {filtered.length === 0 ? (
            <p className="text-silver">No articles matched “{query}”.</p>
          ) : (
            filtered.map((group) => (
              <section key={group.category}>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-silver">
                  {group.category}
                </h2>
                <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-white/[0.02]">
                  {group.items.map((f) => {
                    const id = `${group.category}-${f.q}`;
                    const isOpen = open === id;
                    return (
                      <div key={id}>
                        <button
                          type="button"
                          onClick={() => setOpen(isOpen ? null : id)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                          aria-expanded={isOpen}
                        >
                          <span className="text-sm font-medium text-white">{f.q}</span>
                          <ChevronDown
                            size={16}
                            className={`shrink-0 text-silver transition-transform ${isOpen ? "rotate-180" : ""}`}
                          />
                        </button>
                        {isOpen && (
                          <p className="px-4 pb-4 text-sm leading-relaxed text-silver">{f.a}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
          <p className="text-sm font-semibold text-white">Still need help?</p>
          <p className="mt-1 text-xs text-silver">
            Reach the team on Discord for direct support and to open a ticket.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <a
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-frost-cta"
            >
              Join Hashpop Discord
            </a>
            <Link href="/support" className="btn-frost border-white/20">
              Contact options
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
