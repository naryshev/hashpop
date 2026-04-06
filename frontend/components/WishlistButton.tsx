"use client";

import { useEffect, useState } from "react";
import { useHashpackWallet } from "../lib/hashpackWallet";

import { getApiUrl } from "../lib/apiUrl";

type WishlistButtonProps = {
  itemId: string;
  itemType: "listing";
  className?: string;
  /** When true, show compact icon only (e.g. on cards) */
  compact?: boolean;
};

export function WishlistButton({
  itemId,
  itemType,
  className = "",
  compact = true,
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
        className={`w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 ${inWishlist ? "bg-emerald-600/90" : "bg-black/60 hover:bg-black/80"} ${className}`}
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
