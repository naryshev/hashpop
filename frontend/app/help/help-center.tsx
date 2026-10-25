"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Search, LifeBuoy } from "lucide-react";
import { DISCORD_INVITE_URL, type Faq } from "../../lib/help/faqs";

export default function HelpCenter({ faqs }: { faqs: { category: string; items: Faq[] }[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return faqs;
    return faqs
      .map((group) => ({
        category: group.category,
        items: group.items.filter(
          (f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [faqs, query]);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-normal text-white sm:text-3xl">
            <LifeBuoy className="text-chrome" size={26} />
            Help Center
          </h1>
          <p className="mt-2 text-sm text-silver">
            Answers to common questions about protected payments, HBAR, HashPack, disputes and more.
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
              <section
                key={group.category}
                id={group.category === "Selling & shipping" ? "selling" : undefined}
              >
                <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-silver">
                  {group.category}
                </h2>
                <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-white/[0.02]">
                  {group.items.map((f) => (
                    <details key={`${group.category}-${f.q}`} className="group">
                      <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left [&::-webkit-details-marker]:hidden">
                        <span className="text-sm font-medium text-white">{f.q}</span>
                        <ChevronDown
                          size={16}
                          className="shrink-0 text-silver transition-transform group-open:rotate-180"
                        />
                      </summary>
                      <p className="px-4 pb-4 text-sm leading-relaxed text-silver">{f.a}</p>
                    </details>
                  ))}
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
