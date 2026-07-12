"use client";

import { MobileTopBar } from "@/components/MobileTopBar";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingCart, Trash2 } from "lucide-react";

import { useCart } from "../../lib/cart";
import { listingHref } from "../../lib/listingUrl";
import { getApiUrl } from "../../lib/apiUrl";
import { formatPriceForDisplay } from "../../lib/formatPrice";
import { formatHbarWithUsd } from "../../lib/hbarUsd";
import { useHbarUsd } from "../../hooks/useHbarUsd";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { useSignInModal } from "../../lib/signInModal";
import { useRobustContractWrite } from "../../hooks/useRobustContractWrite";
import { marketplaceAbi, marketplaceAddress } from "../../lib/contracts";
import { readListingCompat } from "../../lib/marketplaceRead";
import { listingIdToBytes32 } from "../../lib/bytes32";
import { getTransactionErrorMessage } from "../../lib/transactionError";
import { activeHederaChain } from "../../lib/hederaChains";
import { getListingMediaUrls } from "../../lib/listingMedia";
import { ShippingAddressModal } from "../../components/ShippingAddressModal";
import { ConnectWalletButton } from "../../components/ConnectWalletButton";
import { parseUnits } from "viem";

type CartListing = {
  id: string;
  title?: string | null;
  price: string;
  status: string;
  seller: string;
  imageUrl?: string | null;
  mediaUrls?: string[];
};

type ItemState = "queued" | "signing" | "bought" | "failed";

export default function CartPage() {
  const cart = useCart();
  const { address } = useHashpackWallet();
  const { openSignIn } = useSignInModal();
  const usdRate = useHbarUsd();
  const chainId = activeHederaChain.id;

  const [listings, setListings] = useState<Record<string, CartListing | null>>({});
  const [loading, setLoading] = useState(true);
  const [addressGateOpen, setAddressGateOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const { send } = useRobustContractWrite();

  // Load listing details for everything in the cart. null = failed to load.
  useEffect(() => {
    let cancelled = false;
    if (cart.ids.length === 0) {
      setListings({});
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all(
      cart.ids.map((id) =>
        fetch(`${getApiUrl()}/api/listing/${encodeURIComponent(id)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d: { listing?: CartListing } | null) => [id, d?.listing ?? null] as const)
          .catch(() => [id, null] as const),
      ),
    ).then((pairs) => {
      if (cancelled) return;
      setListings(Object.fromEntries(pairs));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // Re-fetch only when the set of ids changes, not on every cart re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.ids.join("|")]);

  const rows = cart.ids.map((id) => ({ id, listing: listings[id] }));
  const me = (address ?? "").toLowerCase();
  const buyable = rows.filter(
    (r) =>
      r.listing &&
      (r.listing.status || "").toUpperCase() === "LISTED" &&
      r.listing.seller.toLowerCase() !== me,
  );
  const unavailable = rows.filter(
    (r) => r.listing !== undefined && (!r.listing || (r.listing.status || "").toUpperCase() !== "LISTED"),
  );
  const ownListings = rows.filter(
    (r) => r.listing && r.listing.seller.toLowerCase() === me && me !== "",
  );

  const totalHbar = useMemo(
    () =>
      buyable.reduce((sum, r) => {
        const n = Number(formatPriceForDisplay(r.listing!.price || "0"));
        return Number.isNaN(n) ? sum : sum + n;
      }, 0),
    [buyable],
  );

  /** Buy one listing on-chain — mirrors the single-item BuyButton flow. */
  const buyOne = useCallback(
    async (listing: CartListing) => {
      const idBytes = listingIdToBytes32(listing.id);
      let priceWei = 0n;
      let status = 0;
      try {
        const latest = await readListingCompat(idBytes);
        priceWei = latest.price ?? 0n;
        status = Number(latest.status ?? 0);
      } catch {
        // chain read failed — fall back to the API price below
      }
      if (priceWei <= 0n || status === 0) {
        priceWei = parseUnits(String(listing.price || "0"), 8);
        if (priceWei <= 0n) throw new Error("Listing is no longer available to buy.");
      }
      const txHash = await send({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: "buyNow",
        args: [idBytes],
        value: priceWei,
      });
      await fetch(`${getApiUrl()}/api/sync-purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash, listingId: listing.id }),
      }).catch(() => {});
    },
    [send],
  );

  /** After the shipping address is on file: buy each item, one signature at a time. */
  const runCheckout = useCallback(async () => {
    setCheckingOut(true);
    setCheckoutError(null);
    setItemStates(Object.fromEntries(buyable.map((r) => [r.id, "queued" as ItemState])));
    for (const row of buyable) {
      setItemStates((s) => ({ ...s, [row.id]: "signing" }));
      try {
        await buyOne(row.listing!);
        setItemStates((s) => ({ ...s, [row.id]: "bought" }));
        cart.remove(row.id);
      } catch (e) {
        setItemStates((s) => ({ ...s, [row.id]: "failed" }));
        setCheckoutError(
          getTransactionErrorMessage(e, { chainId }) ||
            (e instanceof Error ? e.message : "Purchase failed."),
        );
        break; // remaining items stay in the cart for a retry
      }
    }
    setCheckingOut(false);
  }, [buyable, buyOne, cart, chainId]);

  const startCheckout = () => {
    if (!address) {
      openSignIn({ title: "Sign in to check out" });
      return;
    }
    if (buyable.length === 0) return;
    setAddressGateOpen(true);
  };

  const stateChip = (id: string) => {
    const st = itemStates[id];
    if (!st || st === "queued") return null;
    const map: Record<ItemState, { label: string; cls: string }> = {
      queued: { label: "Queued", cls: "text-silver border-white/15 bg-white/5" },
      signing: { label: "Confirm in wallet…", cls: "text-blue-200 border-blue-400/40 bg-blue-400/10" },
      bought: { label: "Purchased ✓", cls: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10" },
      failed: { label: "Failed — try again", cls: "text-rose-300 border-rose-400/40 bg-rose-400/10" },
    };
    const c = map[st];
    return (
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${c.cls}`}>
        {c.label}
      </span>
    );
  };

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
        <MobileTopBar className="mb-4" />
        <div className="flex items-center gap-2">
          <ShoppingCart size={18} className="text-chrome" />
          <h1 className="text-lg font-bold text-white">Cart</h1>
          {cart.count > 0 && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-silver">
              {cart.count}
            </span>
          )}
        </div>

        {cart.count === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <p className="font-medium text-white">Your cart is empty.</p>
            <p className="mt-2 text-sm text-silver">
              Add items from any listing and check out when you&apos;re ready.
            </p>
            <Link
              href="/marketplace"
              className="btn-frost-cta mt-4 inline-block px-6 text-sm"
            >
              Browse the marketplace
            </Link>
          </div>
        ) : loading ? (
          <p className="text-sm text-silver">Loading cart…</p>
        ) : (
          <>
            <ul className="space-y-2">
              {rows.map(({ id, listing }) => {
                const thumb = listing ? getListingMediaUrls(listing)[0] ?? null : null;
                const gone =
                  !listing || (listing.status || "").toUpperCase() !== "LISTED";
                const own = !!listing && me !== "" && listing.seller.toLowerCase() === me;
                return (
                  <li
                    key={id}
                    className={`glass-card flex items-center gap-3 rounded-xl border border-white/10 p-3 ${
                      gone ? "opacity-60" : ""
                    }`}
                  >
                    <Link
                      href={listingHref(id)}
                      className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white/5"
                    >
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xl text-white/20">
                          □
                        </div>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={listingHref(id)}
                        className="block truncate text-sm font-semibold text-white hover:text-chrome"
                      >
                        {listing?.title || "Listing"}
                      </Link>
                      {listing && (
                        <p className="mt-0.5 text-sm font-semibold text-chrome">
                          {formatHbarWithUsd(formatPriceForDisplay(listing.price || "0"), usdRate)}
                        </p>
                      )}
                      {gone && (
                        <p className="mt-0.5 text-xs text-amber-300/90">
                          No longer available — remove it to check out.
                        </p>
                      )}
                      {own && (
                        <p className="mt-0.5 text-xs text-amber-300/90">
                          This is your own listing.
                        </p>
                      )}
                    </div>
                    {stateChip(id)}
                    <button
                      type="button"
                      onClick={() => cart.remove(id)}
                      disabled={checkingOut}
                      aria-label="Remove from cart"
                      className="shrink-0 rounded-full p-2 text-silver hover:bg-white/10 hover:text-rose-300 disabled:opacity-40"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Summary + checkout */}
            <div className="glass-card rounded-xl border border-white/10 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-silver">
                  Total ({buyable.length} item{buyable.length === 1 ? "" : "s"})
                </span>
                <span className="text-base font-bold text-white">
                  {formatHbarWithUsd(String(totalHbar), usdRate)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-silver/60">
                Each item is a separate on-chain purchase — you&apos;ll confirm{" "}
                {buyable.length === 1 ? "one transaction" : `${buyable.length} transactions`} in
                your wallet, one at a time.
              </p>
              {!address ? (
                <div className="mt-3">
                  <ConnectWalletButton />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startCheckout}
                  disabled={checkingOut || buyable.length === 0}
                  className="btn-frost-cta mt-3 w-full disabled:opacity-50"
                >
                  {checkingOut
                    ? "Checking out…"
                    : buyable.length === 0
                      ? "Nothing available to buy"
                      : "Checkout"}
                </button>
              )}
              {checkoutError && (
                <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                  <p className="text-sm text-red-300/90">{checkoutError}</p>
                  <p className="mt-1 text-xs text-silver/70">
                    Purchased items were removed from the cart; the rest are still here — hit
                    Checkout to retry.
                  </p>
                </div>
              )}
              {(unavailable.length > 0 || ownListings.length > 0) && buyable.length > 0 && (
                <p className="mt-2 text-[11px] text-amber-300/80">
                  Unavailable and own-listing items are skipped at checkout.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <ShippingAddressModal
        open={addressGateOpen}
        listingIds={buyable.map((r) => r.id)}
        buyerAddress={address ?? ""}
        ctaLabel="Save & start checkout"
        onConfirmed={() => {
          setAddressGateOpen(false);
          void runCheckout();
        }}
        onClose={() => setAddressGateOpen(false)}
      />
    </main>
  );
}
