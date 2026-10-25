"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { BadgeCheck, CircleCheck, MapPin, Shield } from "lucide-react";
import { ListingMedia } from "./ListingMedia";
import { WishlistButton } from "./WishlistButton";
import { TrustStrip } from "./TrustStrip";
import { formatListingId, listingHref } from "../lib/listingUrl";
import { formatPriceForDisplay } from "../lib/formatPrice";
import { gridStatusCapsule, gridTrustChips, type GridTrustChip } from "../lib/mediaTrust";
import { material } from "../lib/materials";
import { profileAvatarUrl, profileDisplayName, useProfile } from "../lib/profiles";
import { cn } from "../lib/utils";

export type ListingCardItem = {
  id: string;
  title?: string | null;
  price?: string;
  seller?: string;
  imageUrl?: string | null;
  mediaUrls?: string[];
  status?: string;
  watchlistCount?: number;
  /** Existing listing flag. False = meetup, true = escrow. Omitted = no fulfillment chip. */
  requireEscrow?: boolean | null;
  /** Meetup-with-contract. With requireEscrow, both Meetup and Protected chips show. */
  meetup?: boolean | null;
  /** Preformatted distance. Omitted when unknown — never invent km. */
  distanceLabel?: string | null;
  category?: string | null;
  condition?: string | null;
  itemType?: "listing";
};

export function listingCardMeta(category?: string | null, condition?: string | null): string {
  return [category?.trim(), condition?.trim()].filter(Boolean).join(" • ");
}

export type ListingCardVariant = "glass" | "softTrust" | "mediaTrust";

export function formatSellerDisplay(seller?: string): string {
  if (!seller) return "";
  if (/^\d+\.\d+\.\d+$/.test(seller)) return seller;
  if (seller.startsWith("0x") && seller.length > 12)
    return `${seller.slice(0, 6)}…${seller.slice(-4)}`;
  return seller;
}

/** Seller identity line: avatar + display name (or wallet) + verified badge. */
export function SellerInline({ seller, size = 16 }: { seller?: string; size?: number }) {
  const profile = useProfile(seller);
  if (!seller) return null;
  const name = profileDisplayName(profile);
  const avatar = profileAvatarUrl(profile);
  return (
    <span className="flex min-w-0 items-center gap-1 truncate">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt=""
          className="shrink-0 rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : null}
      {name ? (
        <span className="truncate text-silver/60">{name}</span>
      ) : (
        <span className="truncate font-mono text-silver/50">{formatSellerDisplay(seller)}</span>
      )}
      {profile?.kycVerified && (
        <BadgeCheck size={12} className="shrink-0 text-chrome" aria-label="KYC verified" />
      )}
    </span>
  );
}

function listingStatus(status?: string): "sold" | "pending" | "active" {
  const value = String(status || "")
    .trim()
    .toUpperCase();
  if (value === "SOLD") return "sold";
  if (value === "LOCKED") return "pending";
  return "active";
}

const statusCapsule = {
  active: "rounded-full bg-chrome px-2.5 py-1 text-[10px] font-bold text-[#052018]",
  pending: "rounded-full bg-amber-400 px-2.5 py-1 text-[10px] font-bold text-[#241505]",
  sold: "rounded-full bg-rose-500 px-2.5 py-1 text-[10px] font-bold text-white",
} as const;

const statusLabel = {
  active: "Active",
  pending: "Pending",
  sold: "Sold",
} as const;

const chipGlyph = {
  completion: CircleCheck,
  meetup: MapPin,
  escrow: Shield,
} as const;

/**
 * How many chips to mount before measuring. Compact cards use tighter chips
 * so three can fit at 390px; anything that still overflows is dropped whole
 * in layout (never clipped).
 */
export function chipCapForDensity(_compact: boolean, total: number): number {
  if (total <= 0) return 0;
  return total;
}

/** One line of chips. Only whole chips that fit are rendered. */
function TrustChipRow({ chips, compact }: { chips: GridTrustChip[]; compact: boolean }) {
  const cap = chipCapForDensity(compact, chips.length);
  const chipKey = chips.map((chip) => `${chip.kind}:${chip.label}`).join("|");
  const [count, setCount] = useState(cap);
  const [prevKey, setPrevKey] = useState(chipKey);
  const rowRef = useRef<HTMLDivElement>(null);

  if (chipKey !== prevKey || count > cap) {
    setPrevKey(chipKey);
    setCount(cap);
  }

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const bounds = row.getBoundingClientRect();
    if (bounds.width <= 0) return;
    let fit = 0;
    for (const child of row.children) {
      const right = (child as HTMLElement).getBoundingClientRect().right;
      if (right > bounds.right - 0.5) break;
      fit += 1;
    }
    if (fit < count) setCount(fit);
  }, [count, chipKey]);

  useEffect(() => {
    const fonts = document.fonts;
    if (!fonts) return;
    let cancel = false;
    fonts.ready.then(() => {
      if (!cancel) setCount(cap);
    });
    return () => {
      cancel = true;
    };
  }, [cap, chipKey]);

  const shown = chips.slice(0, count);

  return (
    <div
      ref={rowRef}
      data-testid="trust-chip-row"
      className={cn(
        "mt-1.5 flex w-full min-w-0 flex-nowrap items-center",
        compact ? "h-5 gap-1" : "h-6 gap-1",
      )}
    >
      {shown.map((chip) => {
        const Glyph = chipGlyph[chip.kind];
        return (
          <span
            key={chip.kind}
            data-testid="grid-trust-chip"
            className={cn(
              "inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-semibold leading-none",
              compact ? "h-5 gap-0.5 px-1 text-[10px]" : "h-6 gap-1 px-2 text-[11px]",
              chip.tone === "mint"
                ? "border border-[#00ffa3]/25 bg-[#00ffa3]/10 text-chrome"
                : cn(material.thick, "border border-white/10 text-silver"),
            )}
            aria-label={chip.kind === "completion" ? `Seller completion ${chip.label}` : chip.label}
          >
            <Glyph size={compact ? 10 : 12} aria-hidden className="shrink-0" />
            {chip.label}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Concept C soft-trust tile. Grid densities keep the inset 4:3 photo.
 * `nearby` is a short horizontal row for the Nearby sheet only (Lyft/Skyscanner density).
 * Compact = mobile 2-up (20px radius); regular = desktop grid (18px).
 */
function SoftTrustCard({
  item,
  density,
  priority = false,
}: {
  item: ListingCardItem;
  density: "compact" | "regular" | "nearby";
  priority?: boolean;
}) {
  const nearby = density === "nearby";
  const compact = density === "compact";
  const profile = useProfile(item.seller);
  const capsule = gridStatusCapsule(item.status);
  const chips = gridTrustChips({
    loading: Boolean(item.seller) && profile === undefined,
    status: item.status,
    requireEscrow: item.requireEscrow,
    meetup: item.meetup,
    successfulCompletions: profile?.successfulCompletions,
    totalSales: profile?.totalSales,
    kycVerified: profile?.kycVerified,
  });
  const distance = item.distanceLabel?.trim() ?? "";
  const meta = listingCardMeta(item.category, item.condition);
  const title = item.title || formatListingId(item.id) || "Untitled";

  if (nearby) {
    return (
      <article
        data-variant="softTrust"
        data-density="nearby"
        className={cn(
          material.regular,
          "relative flex h-[104px] flex-row items-stretch overflow-hidden rounded-[16px] border-white/12",
        )}
      >
        <Link href={listingHref(item.id)} className="flex min-w-0 flex-1 flex-row items-stretch">
          <div
            data-testid="soft-trust-media"
            data-media="nearby"
            className="relative h-full w-[88px] shrink-0 overflow-hidden bg-[#0b111b]"
          >
            <ListingMedia listing={item} bleed priority={priority} sizes="88px" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center px-2.5 py-1.5">
            <div className="flex items-start gap-1">
              <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight text-white">
                {title}
              </h2>
              <span aria-hidden="true" className="h-11 w-11 shrink-0" />
            </div>
            {meta ? (
              <p data-testid="listing-card-meta" className="truncate text-[11px] text-silver/75">
                {meta}
              </p>
            ) : null}
            {capsule ? (
              <div className="mt-1 flex h-5 items-center">
                <span className={statusCapsule[capsule]}>{statusLabel[capsule]}</span>
              </div>
            ) : chips.length > 0 ? (
              <TrustChipRow chips={chips} compact />
            ) : null}
            <div className="mt-0.5 flex items-baseline justify-between gap-2">
              <p className="font-mono text-[14px] font-bold text-chrome">
                {formatPriceForDisplay(item.price || "0")}
                <span className="italic">{"\u2009ℏ"}</span>
              </p>
              {distance ? (
                <span
                  data-testid="listing-distance"
                  className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-white/70"
                >
                  <MapPin size={12} aria-hidden className="shrink-0 text-chrome" />
                  {distance}
                </span>
              ) : null}
            </div>
          </div>
        </Link>
        <div className="absolute right-2.5 top-1.5 z-10">
          <WishlistButton itemId={item.id} itemType="listing" compact surface="neutral" />
        </div>
      </article>
    );
  }

  return (
    <article
      data-variant="softTrust"
      className={cn(
        material.regular,
        "relative flex h-full flex-col overflow-hidden border-white/12 shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition-transform active:scale-[0.98]",
        compact ? "rounded-[20px]" : "rounded-[18px]",
      )}
    >
      <Link href={listingHref(item.id)} className="flex min-w-0 flex-1 flex-col">
        <div className="px-1.5 pt-1.5">
          <div
            data-testid="soft-trust-media"
            data-media="grid"
            className="relative aspect-[4/3] overflow-hidden rounded-[14px] bg-[#0b111b]"
          >
            <ListingMedia
              listing={item}
              bleed
              priority={priority}
              sizes="(max-width: 768px) 46vw, (max-width: 1280px) 30vw, 320px"
              slideshow={compact ? undefined : "hover"}
            />
          </div>
        </div>
        <div
          className={cn(
            "flex w-full min-w-0 flex-1 flex-col pb-[11px] pt-2",
            compact ? "px-2" : "px-2.5",
          )}
        >
          <h2 className="line-clamp-2 min-h-9 text-[13px] font-semibold leading-snug text-white">
            {title}
          </h2>
          {meta ? (
            <p
              data-testid="listing-card-meta"
              className="mt-0.5 truncate text-[12px] text-silver/75"
            >
              {meta}
            </p>
          ) : null}
          {capsule ? (
            <div className="mt-1.5 flex h-6 items-center">
              <span className={statusCapsule[capsule]}>{statusLabel[capsule]}</span>
            </div>
          ) : chips.length > 0 ? (
            <TrustChipRow chips={chips} compact={compact} />
          ) : null}
          <div className="mt-auto flex items-baseline justify-between gap-2 pt-1.5">
            <p
              className={cn(
                "font-mono font-bold text-chrome",
                compact ? "text-[14px]" : "text-[15px]",
              )}
            >
              {formatPriceForDisplay(item.price || "0")}
              <span className="italic">{"\u2009ℏ"}</span>
            </p>
            {distance ? (
              <span
                data-testid="listing-distance"
                className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-white/70"
              >
                <MapPin size={12} aria-hidden className="shrink-0 text-chrome" />
                {distance}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
      <div className="absolute right-3 top-3 z-10">
        <WishlistButton itemId={item.id} itemType="listing" compact surface="neutral" />
      </div>
    </article>
  );
}

/**
 * Shared marketplace listing cell. Compact = mobile 2-up; regular = desktop grid.
 * `softTrust` (and the `mediaTrust` alias) is the Concept C grid tile.
 * Default `glass` stays the body-slab card (profile grids and anything that
 * is not the marketplace grid).
 */
export function ListingCard({
  item,
  density = "regular",
  variant = "glass",
  priority = false,
}: {
  item: ListingCardItem;
  density?: "compact" | "regular" | "nearby";
  variant?: ListingCardVariant;
  /** Mark the route's LCP photo. Only the first visible card should set this. */
  priority?: boolean;
}) {
  if (variant === "softTrust" || variant === "mediaTrust") {
    return <SoftTrustCard item={item} density={density} priority={priority} />;
  }

  const compact = density === "compact";
  const status = listingStatus(item.status);

  return (
    <article
      className={cn(
        material.regular,
        "relative flex flex-col overflow-hidden transition-colors hover:border-chrome/40",
        compact ? "rounded-[20px]" : "rounded-[16px]",
      )}
    >
      <Link href={listingHref(item.id)} className="flex flex-1 flex-col">
        <div className="relative bg-[#0b111b]">
          <ListingMedia
            listing={item}
            className="w-full"
            aspectRatio="square"
            slideshow={compact ? undefined : "hover"}
            cardSize
            compactHeight={compact ? "170px" : "220px"}
          />
          <span className={cn("absolute left-2.5 top-2.5 z-10", statusCapsule[status])}>
            {statusLabel[status]}
          </span>
        </div>
        <div className="flex flex-1 flex-col p-3 pb-1">
          <h2 className="line-clamp-2 text-[15px] font-semibold leading-snug text-white">
            {item.title || formatListingId(item.id) || "Untitled"}
          </h2>
          <div className="mt-2 flex items-center justify-between">
            <p className="font-mono text-[17px] font-bold text-chrome">
              {formatPriceForDisplay(item.price || "0")}
              <span className="italic">{"\u2009ℏ"}</span>
            </p>
            {(item.watchlistCount ?? 0) > 0 && (
              <span className="text-[11px] text-silver/50">♡ {item.watchlistCount}</span>
            )}
          </div>
        </div>
      </Link>
      <div className="absolute right-1 top-1 z-10">
        <WishlistButton itemId={item.id} itemType="listing" compact />
      </div>
      {item.seller && (
        <div className="px-3 pb-3">
          <TrustStrip density="inline" address={item.seller} />
        </div>
      )}
    </article>
  );
}
