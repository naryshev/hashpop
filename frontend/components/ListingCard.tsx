"use client";

import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { ListingMedia } from "./ListingMedia";
import { WishlistButton } from "./WishlistButton";
import { TrustStrip } from "./TrustStrip";
import { formatListingId, listingHref } from "../lib/listingUrl";
import { formatPriceForDisplay } from "../lib/formatPrice";
import { gridStatusCapsule, gridTrustChip } from "../lib/mediaTrust";
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
  itemType?: "listing";
};

export type ListingCardVariant = "glass" | "mediaTrust";

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

/**
 * Photo tile: chrome is overlay only. One trust chip, or a Pending/Sold capsule.
 * Compact = mobile 2-up (16px radius); regular = desktop grid (14px).
 */
function MediaTrustCard({
  item,
  density,
}: {
  item: ListingCardItem;
  density: "compact" | "regular";
}) {
  const compact = density === "compact";
  const profile = useProfile(item.seller);
  const capsule = gridStatusCapsule(item.status);
  const chip = gridTrustChip({
    loading: Boolean(item.seller) && profile === undefined,
    status: item.status,
    requireEscrow: item.requireEscrow,
    successfulCompletions: profile?.successfulCompletions,
    totalSales: profile?.totalSales,
    kycVerified: profile?.kycVerified,
  });

  return (
    <article
      data-variant="mediaTrust"
      className={cn(
        "relative overflow-hidden border border-white/10 bg-[#0b111b]",
        compact ? "rounded-[16px]" : "rounded-[14px]",
      )}
    >
      <Link href={listingHref(item.id)} className="relative block aspect-[3/4]">
        <ListingMedia listing={item} bleed slideshow={compact ? undefined : "hover"} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2.5 pb-2.5 pt-14">
          <h2
            className={cn(
              "line-clamp-2 font-semibold leading-snug text-white",
              compact ? "text-[13px]" : "text-[14px]",
            )}
          >
            {item.title || formatListingId(item.id) || "Untitled"}
          </h2>
          <p
            className={cn("mt-0.5 font-bold text-chrome", compact ? "text-[15px]" : "text-[16px]")}
          >
            {formatPriceForDisplay(item.price || "0")} <span className="italic">ℏ</span>
          </p>
        </div>
        <div className="absolute left-2 top-2 z-10">
          {capsule ? (
            <span className={statusCapsule[capsule]}>{statusLabel[capsule]}</span>
          ) : chip ? (
            <span
              data-testid="grid-trust-chip"
              className={cn(
                "inline-flex h-[22px] max-w-[9rem] items-center rounded-full px-2 text-[11px] font-semibold leading-none",
                chip.tone === "mint"
                  ? "border border-[#00ffa3]/25 bg-[#00ffa3]/10 text-chrome backdrop-blur-material-thick"
                  : cn(material.thick, "border border-white/10 text-silver"),
              )}
              aria-label={
                chip.kind === "completion" ? `Seller completion ${chip.label}` : chip.label
              }
            >
              {chip.label}
            </span>
          ) : null}
        </div>
      </Link>
      <div className="absolute right-2 top-2 z-10">
        <WishlistButton itemId={item.id} itemType="listing" compact />
      </div>
    </article>
  );
}

/**
 * Shared marketplace listing cell. Compact = mobile 2-up; regular = desktop grid.
 * `mediaTrust` is the B+C hybrid grid tile. Default `glass` stays the body-slab card
 * (profile grids and anything that is not the marketplace grid).
 */
export function ListingCard({
  item,
  density = "regular",
  variant = "glass",
}: {
  item: ListingCardItem;
  density?: "compact" | "regular";
  variant?: ListingCardVariant;
}) {
  if (variant === "mediaTrust") {
    return <MediaTrustCard item={item} density={density} />;
  }

  const compact = density === "compact";
  const status = listingStatus(item.status);

  return (
    <article
      className={cn(
        material.regular,
        "flex flex-col overflow-hidden transition-colors hover:border-chrome/40",
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
          <div className="absolute right-1 top-1 z-10">
            <WishlistButton itemId={item.id} itemType="listing" compact />
          </div>
        </div>
        <div className="flex flex-1 flex-col p-3 pb-1">
          <h2 className="line-clamp-2 text-[15px] font-semibold leading-snug text-white">
            {item.title || formatListingId(item.id) || "Untitled"}
          </h2>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[17px] font-bold text-chrome">
              {formatPriceForDisplay(item.price || "0")} <span className="italic">ℏ</span>
            </p>
            {(item.watchlistCount ?? 0) > 0 && (
              <span className="text-[11px] text-silver/50">♡ {item.watchlistCount}</span>
            )}
          </div>
        </div>
      </Link>
      {item.seller && (
        <div className="px-3 pb-3">
          <TrustStrip density="inline" address={item.seller} />
        </div>
      )}
    </article>
  );
}
