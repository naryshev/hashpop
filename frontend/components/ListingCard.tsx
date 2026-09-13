"use client";

import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { ListingMedia } from "./ListingMedia";
import { WishlistButton } from "./WishlistButton";
import { formatListingId, listingHref } from "../lib/listingUrl";
import { formatPriceForDisplay } from "../lib/formatPrice";
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
  itemType?: "listing";
};

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
 * Shared marketplace listing cell. Compact = mobile 2-up; regular = desktop grid.
 */
export function ListingCard({
  item,
  density = "regular",
}: {
  item: ListingCardItem;
  density?: "compact" | "regular";
}) {
  const compact = density === "compact";
  const status = listingStatus(item.status);

  return (
    <Link
      href={listingHref(item.id)}
      className={cn(
        material.regular,
        "flex flex-col overflow-hidden transition-colors hover:border-chrome/40",
        compact ? "rounded-[20px]" : "rounded-[16px]",
      )}
    >
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
      <div className="flex flex-1 flex-col p-3">
        <h2 className="line-clamp-2 text-[15px] font-semibold leading-snug text-white">
          {item.title || formatListingId(item.id) || "Untitled"}
        </h2>
        {item.seller && (
          <div className="mt-1 text-[12px] text-silver/60">
            <SellerInline seller={item.seller} size={compact ? 16 : 18} />
          </div>
        )}
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
  );
}
