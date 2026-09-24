"use client";

import { useEffect, useState } from "react";
import { useHashpackWallet } from "../lib/hashpackWallet";

import { getApiUrl } from "../lib/apiUrl";
import { material } from "../lib/materials";
import { cn } from "../lib/utils";

type WishlistButtonProps = {
  itemId: string;
  itemType: "listing";
  className?: string;
  /** When true, show compact icon only (e.g. on cards) */
  compact?: boolean;
  /**
   * Soft-trust photo heart: translucent glass when off.
   * Wishlist-on stays the mint fill. Default keeps the solid disc.
   */
  surface?: "default" | "glass";
};

export function WishlistButton({
  itemId,
  itemType,
  className = "",
  compact = true,
  surface = "default",
}: WishlistButtonProps) {
  const { address } = useHashpackWallet();
  const [inWishlist, setInWishlist] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address || !itemId) return;
    fetch(`${getApiUrl()}/api/wishlist?address=${encodeURIComponent(address)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { items?: { itemId: string }[] }) => {
        setInWishlist((data.items || []).some((i) => i.itemId === itemId));
      })
      .catch(() => {});
  }, [address, itemId]);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!address || !itemId || loading) return;
    setLoading(true);
    try {
      if (inWishlist) {
        await fetch(
          `${getApiUrl()}/api/wishlist?address=${encodeURIComponent(address)}&itemId=${encodeURIComponent(itemId)}`,
          { method: "DELETE" },
        );
        setInWishlist(false);
      } else {
        await fetch(`${getApiUrl()}/api/wishlist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, itemId, itemType }),
        });
        setInWishlist(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={!address || loading}
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
          inWishlist
            ? "bg-chrome text-[#04150f]"
            : surface === "glass"
              ? cn(material.chrome, "text-white")
              : cn(material.thick, "border border-hairline text-white hover:border-white/30"),
          className,
        )}
        aria-label={inWishlist ? "In wishlist" : "Add to wishlist"}
      >
        {inWishlist ? "✓" : "♡"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!address || loading}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
        inWishlist
          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
          : "border-white/20 bg-white/5 text-silver hover:text-white hover:bg-white/10"
      } ${className}`}
      aria-label={inWishlist ? "In wishlist" : "Add to wishlist"}
    >
      {inWishlist ? "✓ In wishlist" : "+ Add to wishlist"}
    </button>
  );
}
