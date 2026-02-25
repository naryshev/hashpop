"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListingMedia } from "../components/ListingMedia";
import { ConnectWalletButton } from "../components/ConnectWalletButton";
import { formatPriceForDisplay } from "../lib/formatPrice";
import { formatHbarWithUsd } from "../lib/hbarUsd";
import { useHbarUsd } from "../hooks/useHbarUsd";
import { getApiUrl } from "../lib/apiUrl";
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

function isActiveStatus(status?: string): boolean {
  return normalizeListingStatus(status) === "LISTED";
}

function getStatusBadge(status?: string): { label: string; className: string; glowClass: string } {
  const normalized = normalizeListingStatus(status);
  if (normalized === "LISTED") {
    return {
      label: "ACTIVE",
      className: "bg-emerald-500/20 border-emerald-400/40 text-emerald-200",
      glowClass: "shadow-[0_0_24px_rgba(52,211,153,0.32)]",
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

type ListingRecord = {
  id: string;
  title?: string;
  description?: string;
  createdAt?: string;
  price?: string | number;
  reservePrice?: string | number;
  status?: string;
  imageUrl?: string | null;
  mediaUrls?: string[] | null;
  itemType?: "listing";
};

type HomeStackItem = CardStackItem & {
  listing?: ListingRecord;
  statusClass?: string;
  statusLabel?: string;
  priceLabel?: string;
};

export default function Home() {
  const router = useRouter();
  const [listings, setListings] = useState<ListingRecord[]>([]);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const [listingsLoading, setListingsLoading] = useState(true);
  const usdRate = useHbarUsd();
  const [cardWidth, setCardWidth] = useState(520);
  const [cardHeight, setCardHeight] = useState(360);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setIsMobileViewport(width < 640);
      if (width < 640) {
        // Mobile: keep all hero content (including CTA + dots) inside one viewport.
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

  const fetchListings = useCallback(() => {
    setListingsLoading(true);
    setListingsError(null);
    fetch(`${getApiUrl()}/api/listings`)
      .then((res) => {
        if (!res.ok) {
          return res.json().then((body: { error?: string }) => {
            throw new Error(body?.error || (res.status === 503 ? "Backend or database unavailable." : "Failed to load listings."));
          }).catch((e: Error) => {
            if (e instanceof SyntaxError) throw new Error(res.status === 503 ? "Backend or database unavailable." : "Failed to load listings.");
            throw e;
          });
        }
        return res.json();
      })
      .then((data: { listings?: ListingRecord[] }) => {
        const list = (data.listings || []).map((l) => ({ ...l, itemType: "listing" as const }));
        setListings(list.sort((a, b) => {
          const aActive = isActiveStatus(a.status);
          const bActive = isActiveStatus(b.status);
          if (aActive !== bActive) return aActive ? -1 : 1;
          return new Date((b.createdAt as string) || 0).getTime() - new Date((a.createdAt as string) || 0).getTime();
        }).slice(0, 8));
      })
      .catch((e) => {
        setListings([]);
        setListingsError(e instanceof Error ? e.message : "Failed to load listings.");
      })
      .finally(() => {
        setListingsLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const stackItems = useMemo<HomeStackItem[]>(() => {
    return listings.map((item) => {
      const badge = getStatusBadge(item.status);
      return {
        id: item.id,
        title: item.title || formatListingId(item.id) || "Untitled",
        description: "Tap to view listing details",
        href: `/listing/${encodeURIComponent(item.id)}`,
        listing: item,
        statusLabel: badge.label,
        statusClass: `${badge.className} ${badge.glowClass}`,
        priceLabel: formatHbarWithUsd(formatPriceForDisplay(String(item.price ?? item.reservePrice ?? "0")), usdRate),
      };
    });
  }, [listings, usdRate]);

  return (
    <main
      className="h-screen overflow-hidden"
      style={{
        backgroundColor: "#071b38",
      }}
    >
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
                  className="relative h-20 w-auto max-h-24 bg-transparent object-contain object-left drop-shadow-[0_12px_24px_rgba(0,0,0,0.35)] sm:h-24"
                />
              </Link>
            </div>

            <div className="mt-4 text-center sm:mt-5">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/85">Trade • Collect • Verify</p>
              <h1 className="mt-2 text-2xl font-black text-white sm:text-4xl">Trade Verifiably on the Hashgraph</h1>
              <p className="mx-auto mt-2 max-w-2xl text-sm text-silver sm:text-base">
                Swipe through featured listings.
              </p>
            </div>

            <div className="mt-3 flex justify-center">
              <ConnectWalletButton className="btn-frost-cta h-12 border-emerald-200/70 px-6 text-sm font-extrabold uppercase tracking-[0.08em] disabled:opacity-60">
                Connect Wallet
              </ConnectWalletButton>
            </div>

            <div
              className="mt-1 flex-1 min-h-0 flex flex-col sm:mt-3"
            >
              {listingsLoading ? (
                <div className="flex h-full min-h-[330px] items-center justify-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/40 border-t-transparent" aria-label="Loading listings" />
                </div>
              ) : stackItems.length > 0 ? (
                <CardStack
                  items={stackItems}
                  cardWidth={cardWidth}
                  cardHeight={cardHeight}
                  initialIndex={0}
                  autoAdvance={!isMobileViewport}
                  intervalMs={2500}
                  pauseOnHover
                  showDots
                  maxVisible={7}
                  overlap={0.5}
                  spreadDeg={52}
                  className="mx-auto -mt-4 sm:mt-0"
                  renderCard={(item, { active }) => {
                    const cardContent = (
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
                          <span className={`absolute left-4 top-4 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide ${item.statusClass}`}>
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
                    );
                    return (
                      <div
                        className={active && item.href ? "h-full w-full cursor-pointer" : "h-full w-full"}
                        onClick={() => {
                          if (active && item.href) router.push(item.href);
                        }}
                      >
                        {cardContent}
                      </div>
                    );
                  }}
                />
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
