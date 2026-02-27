"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ListingMedia } from "../components/ListingMedia";
import { formatPriceForDisplay } from "../lib/formatPrice";
import { formatHbarWithUsd } from "../lib/hbarUsd";
import { useHbarUsd } from "../hooks/useHbarUsd";
import { CardStack, type CardStackItem } from "../components/ui/card-stack";
import { Sparkles } from "lucide-react";

function formatListingId(id: string): string {
  if (!id || !id.startsWith("0x") || id.length !== 66) return id;
  try {
    const hex = id.slice(2).replace(/0+$/, "");
    if (hex.length % 2) return id;
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    const str = new TextDecoder().decode(bytes);
    return /^[\x20-\x7e]+$/.test(str) ? str : `${id.slice(0, 10)}…`;
  } catch {
    return `${id.slice(0, 10)}…`;
  }
}

function normalizeListingStatus(status?: string): string {
  return String(status || "").trim().toUpperCase();
}

function getStatusBadge(status?: string): { label: string; className: string; glowClass: string; pulseDot?: boolean } {
  const normalized = normalizeListingStatus(status);
  if (normalized === "LISTED") {
    return {
      label: "ACTIVE",
      className:
        "bg-green-500/10 text-green-600 border-green-500/20 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30",
      glowClass: "shadow-[0_0_24px_rgba(52,211,153,0.32)]",
      pulseDot: true,
    };
  }
  if (normalized === "LOCKED") {
    return {
      label: "LOCKED",
      className: "bg-amber-500/20 border-amber-400/40 text-amber-200",
      glowClass: "shadow-[0_0_24px_rgba(251,191,36,0.3)]",
    };
  }
  if (normalized === "CANCELLED") {
    return {
      label: "CANCELLED",
      className: "bg-zinc-500/20 border-zinc-300/40 text-zinc-200",
      glowClass: "shadow-[0_0_24px_rgba(161,161,170,0.28)]",
    };
  }
  return {
    label: "SOLD",
    className: "bg-rose-500/20 border-rose-400/40 text-rose-200",
    glowClass: "shadow-[0_0_24px_rgba(251,113,133,0.28)]",
  };
}

export type ListingRecord = {
  id: string;
  title?: string;
  description?: string;
  createdAt?: string;
  price?: string | number;
  reservePrice?: string | number;
  status?: string;
  imageUrl?: string | null;
  mediaUrls?: string[] | null;
  seller?: string;
  itemType?: "listing";
};

type HomeStackItem = CardStackItem & {
  listing?: ListingRecord;
  statusClass?: string;
  statusLabel?: string;
  statusPulseDot?: boolean;
  priceLabel?: string;
};

function formatSellerLabel(seller?: string): string {
  if (!seller) return "by 0.0.xxxx";
  const trimmed = seller.trim();
  const accountMatch = /^(\d+)\.(\d+)\.(\d+)$/.exec(trimmed);
  if (accountMatch) {
    return `by ${accountMatch[1]}.${accountMatch[2]}.${accountMatch[3]}`;
  }
  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
    const hex = trimmed.slice(2);
    if (hex.length === 40) {
      const shard = BigInt(`0x${hex.slice(0, 8)}`);
      const realm = BigInt(`0x${hex.slice(8, 24)}`);
      const num = BigInt(`0x${hex.slice(24, 40)}`);
      if (shard === 0n && realm === 0n) {
        return `by ${shard.toString()}.${realm.toString()}.${num.toString()}`;
      }
      return `by ${trimmed.slice(0, 8)}…${trimmed.slice(-4)}`;
    }
    const accountNum = BigInt(`0x${hex}`);
    return `by 0.0.${accountNum.toString()}`;
  }
  return `by ${trimmed}`;
}

export default function HomePageClient({
  initialListings,
  initialError,
}: {
  initialListings: ListingRecord[];
  initialError: string | null;
}) {
  const listings = initialListings;
  const listingsError = initialError;
  const usdRate = useHbarUsd();
  const [cardWidth, setCardWidth] = useState(520);
  const [cardHeight, setCardHeight] = useState(360);
  const [stackVisible, setStackVisible] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => setStackVisible(true));
    return () => window.cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setIsMobileViewport(width < 640);
      if (width < 640) {
        const cw = Math.min(270, width - 44);
        const ch = Math.min(250, Math.round(height * 0.32));
        setCardWidth(cw);
        setCardHeight(ch);
        return;
      }
      if (width < 1024) {
        setCardWidth(390);
        setCardHeight(340);
        return;
      }
      setCardWidth(520);
      setCardHeight(360);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const stackItems = useMemo<HomeStackItem[]>(() => {
    return listings.map((item) => {
      const badge = getStatusBadge(item.status);
      return {
        id: item.id,
        title: item.title || formatListingId(item.id) || "Untitled",
        description: formatSellerLabel(item.seller),
        href: `/listing/${encodeURIComponent(item.id)}`,
        listing: item,
        statusLabel: badge.label,
        statusClass: `${badge.className} ${badge.glowClass}`,
        statusPulseDot: badge.pulseDot,
        priceLabel: formatHbarWithUsd(formatPriceForDisplay(String(item.price ?? item.reservePrice ?? "0")), usdRate),
      };
    });
  }, [listings, usdRate]);

  return (
    <main className="h-screen overflow-hidden" style={{ backgroundColor: "#071b38" }}>
      <section className="relative flex h-full w-full flex-col overflow-hidden bg-[#0a2247] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.35)] sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_115%,rgba(69,232,145,0.36),transparent_45%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(72,170,255,0.18),transparent_42%)]" />
        <div className="relative z-10 flex h-full flex-col">
          <div className="flex items-start justify-center sm:justify-start">
            <Link href="/" className="inline-block" aria-label="Hashpop home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hashpop-cart-3d.PNG"
                alt="Hashpop cart logo"
                width={128}
                height={128}
                decoding="async"
                fetchPriority="high"
                className="relative h-24 w-auto max-h-28 bg-transparent object-contain object-left drop-shadow-[0_12px_24px_rgba(0,0,0,0.35)] sm:h-24"
              />
            </Link>
          </div>

          <div className="mt-4 text-center sm:mt-5">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/85">Verify • Trade • Collect</p>
            <h1 className="mt-2 text-2xl font-black text-white sm:text-4xl">Trade Verifiably on Hashpop</h1>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-silver sm:text-base">
              Swipe through featured listings powered by the Hashgraph.
            </p>
          </div>

          <div className="mt-3 flex justify-center">
            <Link
              href="/marketplace"
              className="btn-frost-cta inline-flex h-12 items-center border-emerald-200/70 px-6 text-sm font-extrabold uppercase tracking-[0.08em]"
            >
              Browse Listings
            </Link>
          </div>

          <div className="mt-1 flex flex-1 min-h-0 flex-col sm:mt-3">
            {stackItems.length > 0 ? (
              <div className={`transition-all duration-500 ease-out ${stackVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}>
                <CardStack
                  items={stackItems}
                  cardWidth={cardWidth}
                  cardHeight={cardHeight}
                  initialIndex={0}
                  autoAdvance={false}
                  intervalMs={2500}
                  pauseOnHover
                  showDots
                  maxVisible={7}
                  overlap={0.5}
                  spreadDeg={52}
                  className="mx-auto -mt-4 sm:mt-0"
                  renderCard={(item) => (
                    <div className="h-full w-full">
                      <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/15">
                        <div className="absolute inset-0 pointer-events-none">
                          {item.listing ? (
                            <ListingMedia
                              listing={item.listing}
                              className="h-full w-full object-cover"
                              navigation="arrows"
                              cardSize
                              compactHeight="100%"
                            />
                          ) : null}
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/5" />
                        {item.statusLabel && item.statusClass ? (
                          <span
                            className={`absolute left-4 top-4 rounded-full inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-bold tracking-wide ${item.statusClass}`}
                          >
                            {item.statusPulseDot ? (
                              <span className="inline-flex h-2 w-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_0_0_rgba(74,222,128,0.7)]" />
                            ) : null}
                            {item.statusLabel}
                          </span>
                        ) : null}
                        <div className="absolute inset-x-0 bottom-0 p-4">
                          <h2 className="line-clamp-2 text-base font-bold text-white sm:text-lg">{item.title}</h2>
                          <p className="mt-1 line-clamp-2 text-xs text-white/85">{item.description}</p>
                          {item.priceLabel ? (
                            <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">
                              <Sparkles className="h-3 w-3" />
                              {item.priceLabel}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )}
                />
              </div>
            ) : (
              <div className="flex h-full min-h-[330px] items-center justify-center">
                <p className="text-sm text-silver">No listings found in marketplace yet.</p>
              </div>
            )}
          </div>

          {listingsError ? (
            <p className="mt-2 text-center text-xs text-amber-300/95">
              {listingsError} Ensure backend and database are running.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
