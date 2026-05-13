"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { useHashpackWallet } from "@/lib/hashpackWallet";
import { getApiUrl } from "@/lib/apiUrl";
import { formatPriceForDisplay } from "@/lib/formatPrice";
import { listingHref } from "@/lib/listingUrl";

type Kind = "sale" | "purchase" | "offer" | "message" | "review";

const KIND_LABEL: Record<Kind, string> = {
  sale: "Sales",
  purchase: "Purchases",
  offer: "Offers",
  message: "Messages",
  review: "Reviews",
};

const KIND_COLOR: Record<Kind, string> = {
  sale: "#00ffa3",
  purchase: "#38bdf8",
  offer: "#fbbf24",
  message: "#a78bfa",
  review: "#f472b6",
};

type ActivityEvent = {
  id: string;
  kind: Kind;
  when: Date;
  title: string;
  subtitle?: string;
  counterparty?: string;
  href?: string;
  amountHbar?: string;
  status?: string;
};

type SaleRow = {
  id: string;
  listingId?: string | null;
  buyer?: string;
  seller?: string;
  amount?: string;
  createdAt?: string;
  role?: "buyer" | "seller";
  listing?: { title?: string | null; status?: string | null; shippedAt?: string | null; exchangeConfirmedAt?: string | null } | null;
};

type OfferRow = {
  id: string;
  listingId?: string | null;
  buyer?: string;
  amount?: string;
  status?: string;
  createdAt?: string;
  listing?: { title?: string | null; seller?: string | null } | null;
};

type InboxConversation = {
  otherAddress: string;
  listingId?: string | null;
  lastMessage: { id: string; fromAddress: string; toAddress: string; body: string; encrypted?: boolean; createdAt: string };
  preview: string;
};

type RatingRow = {
  id?: string;
  reviewerAddress: string;
  saleId?: string;
  score: number;
  comment?: string | null;
  createdAt: string;
};

function parseDate(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayLabel(d: Date | null): string {
  if (!d) return "Unknown";
  const now = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return "Today";
  if (sameDay(d, y)) return "Yesterday";
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays < 7) return "This week";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function timeStamp(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function shortAddr(a?: string): string {
  if (!a) return "";
  if (/^\d+\.\d+\.\d+$/.test(a)) return a;
  if (a.startsWith("0x") && a.length > 12) return `${a.slice(0, 6)}…${a.slice(-4)}`;
  return a;
}

export default function ActivityPage() {
  const { address, accountId } = useHashpackWallet();
  const userKey = address ?? accountId ?? "";
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState<Record<Kind, boolean>>({
    sale: true,
    purchase: true,
    offer: true,
    message: true,
    review: true,
  });

  useEffect(() => {
    if (!userKey) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ac = new AbortController();
    const api = getApiUrl();
    const lower = userKey.toLowerCase();

    Promise.allSettled([
      fetch(`${api}/api/user/${lower}/purchases`, { signal: ac.signal }).then((r) => r.json()),
      fetch(`${api}/api/user/${lower}/offers`, { signal: ac.signal }).then((r) => r.json()),
      fetch(`${api}/api/messages/inbox?address=${lower}`, { signal: ac.signal }).then((r) => r.json()),
      fetch(`${api}/api/ratings/${lower}`, { signal: ac.signal }).then((r) => r.json()),
    ])
      .then(([pRes, oRes, mRes, rRes]) => {
        if (ac.signal.aborted) return;
        const next: ActivityEvent[] = [];

        if (pRes.status === "fulfilled") {
          const purchases: SaleRow[] = pRes.value?.purchases ?? [];
          for (const s of purchases) {
            const when = parseDate(s.createdAt);
            if (!when) continue;
            const isSeller = s.role === "seller";
            const title = s.listing?.title || "Listing";
            const counterparty = isSeller ? s.buyer : s.seller;
            next.push({
              id: `${isSeller ? "sale" : "purchase"}-${s.id}`,
              kind: isSeller ? "sale" : "purchase",
              when,
              title: isSeller ? `Sold "${title}"` : `Bought "${title}"`,
              subtitle: s.listing?.status ? `Order ${s.listing.status.toLowerCase()}` : undefined,
              counterparty: counterparty ?? undefined,
              href: s.listingId ? `/purchases/${s.id}` : undefined,
              amountHbar: s.amount ? formatPriceForDisplay(s.amount) : undefined,
              status: s.listing?.status ?? undefined,
            });
            const shippedAt = parseDate(s.listing?.shippedAt ?? undefined);
            if (shippedAt) {
              next.push({
                id: `ship-${s.id}`,
                kind: isSeller ? "sale" : "purchase",
                when: shippedAt,
                title: isSeller ? `Marked "${title}" as shipped` : `"${title}" shipped`,
                counterparty: counterparty ?? undefined,
                href: `/purchases/${s.id}`,
              });
            }
            const completedAt = parseDate(s.listing?.exchangeConfirmedAt ?? undefined);
            if (completedAt) {
              next.push({
                id: `done-${s.id}`,
                kind: isSeller ? "sale" : "purchase",
                when: completedAt,
                title: isSeller ? `Escrow released for "${title}"` : `Received "${title}"`,
                counterparty: counterparty ?? undefined,
                href: `/purchases/${s.id}`,
              });
            }
          }
        }

        if (oRes.status === "fulfilled") {
          const received: OfferRow[] = oRes.value?.received ?? [];
          const sent: OfferRow[] = oRes.value?.sent ?? [];
          for (const o of received) {
            const when = parseDate(o.createdAt);
            if (!when) continue;
            const title = o.listing?.title || "Listing";
            const status = (o.status ?? "ACTIVE").toLowerCase();
            const lead =
              status === "accepted"
                ? `Accepted offer on "${title}"`
                : status === "rejected"
                  ? `Rejected offer on "${title}"`
                  : status === "cancelled"
                    ? `Offer on "${title}" cancelled`
                    : `New offer on "${title}"`;
            next.push({
              id: `offer-r-${o.id}`,
              kind: "offer",
              when,
              title: lead,
              counterparty: o.buyer,
              href: o.listingId ? listingHref(o.listingId) : undefined,
              amountHbar: o.amount ? formatPriceForDisplay(o.amount) : undefined,
              status: o.status,
            });
          }
          for (const o of sent) {
            const when = parseDate(o.createdAt);
            if (!when) continue;
            const title = o.listing?.title || "Listing";
            const status = (o.status ?? "ACTIVE").toLowerCase();
            const lead =
              status === "accepted"
                ? `Your offer on "${title}" was accepted`
                : status === "rejected"
                  ? `Your offer on "${title}" was rejected`
                  : status === "cancelled"
                    ? `You cancelled your offer on "${title}"`
                    : `You made an offer on "${title}"`;
            next.push({
              id: `offer-s-${o.id}`,
              kind: "offer",
              when,
              title: lead,
              counterparty: o.listing?.seller ?? undefined,
              href: o.listingId ? listingHref(o.listingId) : undefined,
              amountHbar: o.amount ? formatPriceForDisplay(o.amount) : undefined,
              status: o.status,
            });
          }
        }

        if (mRes.status === "fulfilled") {
          const convos: InboxConversation[] = mRes.value?.conversations ?? [];
          for (const c of convos) {
            const when = parseDate(c.lastMessage?.createdAt);
            if (!when) continue;
            const inbound = c.lastMessage.fromAddress?.toLowerCase() !== lower;
            const params = new URLSearchParams({ openThread: c.otherAddress });
            if (c.listingId) params.set("listingId", c.listingId);
            next.push({
              id: `msg-${c.otherAddress}-${c.listingId ?? ""}-${c.lastMessage.id}`,
              kind: "message",
              when,
              title: inbound ? "New message" : "You replied",
              subtitle: c.preview,
              counterparty: c.otherAddress,
              href: `/messages?${params.toString()}`,
            });
          }
        }

        if (rRes.status === "fulfilled") {
          const ratings: RatingRow[] = rRes.value?.ratings ?? [];
          for (const r of ratings) {
            const when = parseDate(r.createdAt);
            if (!when) continue;
            next.push({
              id: `rating-${r.id ?? `${r.reviewerAddress}-${r.saleId}`}`,
              kind: "review",
              when,
              title: `Received a ${r.score}-star review`,
              subtitle: r.comment || undefined,
              counterparty: r.reviewerAddress,
              href: userKey ? `/profile/${userKey}` : undefined,
            });
          }
        }

        next.sort((a, b) => b.when.getTime() - a.when.getTime());
        setEvents(next);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => ac.abort();
  }, [userKey]);

  const counts = useMemo(() => {
    const c: Record<Kind, number> = { sale: 0, purchase: 0, offer: 0, message: 0, review: 0 };
    for (const e of events) c[e.kind]++;
    return c;
  }, [events]);

  const visible = events.filter((e) => enabled[e.kind]);

  const groups = useMemo(() => {
    const out = new Map<string, ActivityEvent[]>();
    for (const e of visible) {
      const key = dayLabel(e.when);
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push(e);
    }
    return out;
  }, [visible]);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-[-0.01em] text-white">Activity</h1>
          <p className="mt-1 text-xs text-silver">
            {userKey ? "Sales, purchases, offers, messages, and reviews." : "Connect your wallet to view activity."}
          </p>
        </div>

        {!userKey ? (
          <div className="rounded-glass-lg border border-white/10 bg-[#0e1422] p-6">
            <p className="mb-3 font-medium text-white">Wallet not connected.</p>
            <ConnectWalletButton />
          </div>
        ) : (
          <div className="grid gap-7 md:grid-cols-[1fr_260px]">
            <section>
              {loading ? (
                <p className="text-sm text-silver">Loading activity…</p>
              ) : visible.length === 0 ? (
                <p className="text-sm text-silver">No activity yet. Sales, offers, and messages will show up here.</p>
              ) : (
                Array.from(groups.entries()).map(([day, rows]) => (
                  <section key={day} className="mb-7">
                    <div className="border-b border-white/10 pb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-silver">
                      {day}
                    </div>
                    <ul>
                      {rows.map((e) => {
                        const accent = KIND_COLOR[e.kind];
                        const row = (
                          <div className="flex gap-4">
                            <div
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold uppercase"
                              style={{
                                background: `${accent}22`,
                                border: `1px solid ${accent}66`,
                                color: accent,
                              }}
                            >
                              {e.kind[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[13px] font-semibold text-white">{e.title}</div>
                              {e.subtitle ? (
                                <div className="mt-0.5 line-clamp-1 text-[12px] text-silver">{e.subtitle}</div>
                              ) : null}
                              <div className="mt-1 flex flex-wrap items-center gap-2.5 text-[11px] text-silver">
                                <span className="font-mono">{e.counterparty ? shortAddr(e.counterparty) : "—"}</span>
                                {e.amountHbar ? (
                                  <span className="text-chrome">{e.amountHbar} ℏ</span>
                                ) : null}
                                {e.status ? (
                                  <span className="uppercase tracking-wide text-[10px]">{e.status}</span>
                                ) : null}
                              </div>
                            </div>
                            <div className="shrink-0 font-mono text-[11px] text-silver">{timeStamp(e.when)}</div>
                          </div>
                        );
                        return (
                          <li key={e.id} className="border-b border-white/[0.03] py-3.5 last:border-0">
                            {e.href ? (
                              <Link href={e.href} className="block hover:opacity-90">
                                {row}
                              </Link>
                            ) : (
                              row
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))
              )}
            </section>

            <aside>
              <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-silver">
                Filter by type
              </div>
              {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                <label
                  key={k}
                  className="flex cursor-pointer items-center gap-2.5 py-2 text-[12px] text-white"
                >
                  <span
                    className="flex h-[14px] w-[14px] items-center justify-center rounded-[3px] text-[10px] font-bold text-black"
                    style={{ background: enabled[k] ? "#00ffa3" : "rgba(255,255,255,0.06)" }}
                  >
                    {enabled[k] ? "✓" : ""}
                  </span>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={enabled[k]}
                    onChange={(e) => setEnabled((prev) => ({ ...prev, [k]: e.target.checked }))}
                  />
                  <span className="h-2 w-2 rounded-full" style={{ background: KIND_COLOR[k] }} />
                  <span className="flex-1">{KIND_LABEL[k]}</span>
                  <span className="font-mono text-[11px] text-silver">{counts[k]}</span>
                </label>
              ))}
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
