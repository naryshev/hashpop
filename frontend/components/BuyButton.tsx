"use client";

import { useState, useMemo, useEffect } from "react";
import { marketplaceAbi, marketplaceAddress } from "../lib/contracts";
import { formatContractAmountToHbar, formatPriceForDisplay } from "../lib/formatPrice";
import { getTransactionErrorMessage } from "../lib/transactionError";
import { useHbarUsd } from "../hooks/useHbarUsd";
import { listingIdToBytes32 } from "../lib/bytes32";
import { useRobustContractWrite } from "../hooks/useRobustContractWrite";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { activeHederaChain } from "../lib/hederaChains";
import { parseUnits } from "viem";
import { readListingCompat } from "../lib/marketplaceRead";
import { getApiUrl } from "../lib/apiUrl";
import { getTransactionExplorerUrl } from "../lib/explorer";
import { OfferModal } from "./OfferModal";
import { ConfirmPurchaseSheet } from "./ConfirmPurchaseSheet";
import { ShippingAddressModal } from "./ShippingAddressModal";
import { useSignInModal } from "../lib/signInModal";
import { useHashPackConfirm } from "../lib/hashpackConfirm";
import { resolveContractIdDisplay } from "../lib/contractId";
import { useCart } from "../lib/cart";
import { useRouter } from "next/navigation";
import { listingCta } from "../lib/materials";
import { cn } from "../lib/utils";
import { variantPriceMismatchesListing } from "../lib/listingVariants";

export function BuyButton({
  listingId,
  price: _price,
  variantPrice,
  inWishlist = false,
  onToggleWishlist,
  wishlistDisabled = false,
  onPurchaseComplete,
  onMessage,
  onOfferSubmitted,
  descriptionSlot,
}: {
  listingId: string;
  price: string;
  /** Selected SKU absolute price; when set, display and payment use this amount. */
  variantPrice?: string;
  inWishlist?: boolean;
  onToggleWishlist?: () => void;
  wishlistDisabled?: boolean;
  onPurchaseComplete?: (txHash?: string) => void;
  onMessage?: () => void;
  onOfferSubmitted?: (txHash: string, amountHbar: string) => void;
  /** Rendered between the price and Purchase (description, then callouts). */
  descriptionSlot?: React.ReactNode;
}) {
  const idBytes = useMemo(() => listingIdToBytes32(listingId), [listingId]);

  const { address } = useHashpackWallet();
  const chainId = activeHederaChain.id;
  const isWrongNetwork = false;
  const [onChainListing, setOnChainListing] = useState<
    { price: bigint; status: number } | undefined
  >(undefined);
  const [chainReadFailed, setChainReadFailed] = useState(false);

  function parsePriceWei(raw: unknown): bigint {
    if (raw == null) return 0n;
    if (typeof raw === "bigint") return raw;
    if (typeof raw === "number") return BigInt(Math.floor(raw));
    if (typeof raw === "string") return BigInt(raw);
    const o = raw as { _hex?: string; value?: string; toString?: () => string };
    if (o._hex) return BigInt(o._hex);
    if (o.value != null) return BigInt(o.value);
    if (typeof o.toString === "function") return BigInt(o.toString());
    return 0n;
  }
  const [notOnChain, setNotOnChain] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void readListingCompat(idBytes)
      .then((data) => {
        if (!cancelled) {
          const p = parsePriceWei(data.price);
          const s = Number(data.status ?? 0);
          if (p === 0n && s === 0) {
            setOnChainListing(undefined);
            setChainReadFailed(true);
            setNotOnChain(true);
          } else {
            setOnChainListing({ price: p, status: s });
            setChainReadFailed(false);
            setNotOnChain(false);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOnChainListing(undefined);
          setChainReadFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [idBytes]);
  const priceWei = parsePriceWei(onChainListing?.price);
  const hasPrice = priceWei > 0n;
  const hasApiPrice = !!_price && _price !== "0";
  const isLegacyWeiListing = priceWei >= 10n ** 15n;

  const { send, isPending, error: writeError } = useRobustContractWrite();
  const isConfirming = false;
  const [isSuccess, setIsSuccess] = useState(false);
  const [lastTxId, setLastTxId] = useState<string | null>(null);

  const [buyAttempted, setBuyAttempted] = useState(false);
  const displayError = writeError;
  const [actionError, setActionError] = useState<string | null>(null);
  const errorMessage = actionError ?? getTransactionErrorMessage(displayError, { chainId });
  const explorerUrl = getTransactionExplorerUrl(lastTxId, chainId);

  const [offerModalOpen, setOfferModalOpen] = useState(false);
  // Demo-video flow: shipping address → "Confirm purchase" sheet → wallet.
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Payment is gated on a valid shipping address: the modal must save one to
  // the backend before buy()/the offer form can run. "next" is what happens
  // after the address is confirmed.
  const [shippingGate, setShippingGate] = useState<null | "buy" | "offer">(null);
  const { openSignIn } = useSignInModal();
  const { setDetail: setConfirmDetail } = useHashPackConfirm();
  const cart = useCart();
  const router = useRouter();
  const inCart = cart.has(listingId);

  useEffect(() => {
    if (!errorMessage && !isSuccess) return;
  }, [listingId, isSuccess, errorMessage, isWrongNetwork, hasPrice, buyAttempted]);

  const buy = async () => {
    try {
      setIsSuccess(false);
      setLastTxId(null);
      setActionError(null);
      setBuyAttempted(true);
      let latestPrice = 0n;
      let latestStatus = 0;
      try {
        const latest = await readListingCompat(idBytes);
        latestPrice = parsePriceWei(latest.price);
        latestStatus = Number(latest.status ?? 0);
      } catch {
        // Chain read failed — fall through to API fallback below.
      }
      if (latestPrice <= 0n || latestStatus === 0) {
        const apiPrice = parseUnits(String(_price || "0"), 8);
        if (apiPrice > 0n) {
          latestPrice = apiPrice;
          latestStatus = 1;
        } else {
          throw new Error("Listing is no longer available to buy. Please refresh.");
        }
      }
      const onChainHbar = formatContractAmountToHbar(latestPrice.toString());
      if (variantPriceMismatchesListing(variantPrice, onChainHbar)) {
        throw new Error(
          "This option’s price doesn’t match the on-chain listing. Purchase is disabled until the seller updates the on-chain price.",
        );
      }
      const variantPay =
        variantPrice && Number(variantPrice) > 0 ? parseUnits(String(variantPrice), 8) : 0n;
      if (variantPay > 0n) {
        latestPrice = variantPay;
      }
      if (latestPrice >= 10n ** 15n) {
        throw new Error(
          "This listing uses a legacy on-chain price format and cannot be purchased as-is. Ask the seller to edit price and save again, or recreate the listing.",
        );
      }
      // Context line for the wallet-confirm overlay, matching the demo
      // video: "escrow 0.0.88231 · locking 100 ℏ". Resolved from cache in
      // most cases (the confirm sheet already looked it up).
      const payHbarForDetail = formatPriceForDisplay(variantPrice || _price || "0");
      const contractIdForDetail = await resolveContractIdDisplay(marketplaceAddress).catch(
        () => null,
      );
      setConfirmDetail(
        contractIdForDetail
          ? `escrow ${contractIdForDetail} · locking ${payHbarForDetail} ℏ`
          : `locking ${payHbarForDetail} ℏ`,
      );
      const txHash = await send({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: "buyNow",
        args: [idBytes],
        value: latestPrice,
      });
      setLastTxId(txHash);
      await fetch(`${getApiUrl()}/api/sync-purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash, listingId }),
      }).catch(() => {});
      setIsSuccess(true);
      onPurchaseComplete?.(txHash ?? lastTxId ?? undefined);
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Unable to prepare buy transaction. Please refresh and retry.";
      setActionError(msg);
    }
  };

  const usdRate = useHbarUsd();
  const listingHbar =
    onChainListing && priceWei > 0n
      ? formatContractAmountToHbar(priceWei.toString())
      : formatPriceForDisplay(_price);
  const variantBlocked = variantPriceMismatchesListing(variantPrice, listingHbar);
  const canBuy =
    (hasPrice || chainReadFailed || hasApiPrice) &&
    !isWrongNetwork &&
    !isPending &&
    !isConfirming &&
    !isLegacyWeiListing &&
    !variantBlocked;

  const priceHbarDisplay = formatPriceForDisplay(variantPrice || _price || "0");
  const priceUsd =
    usdRate && usdRate > 0 && !Number.isNaN(Number(priceHbarDisplay))
      ? (Number(priceHbarDisplay) * usdRate).toFixed(2)
      : null;
  const hasCallout = notOnChain || isLegacyWeiListing || variantBlocked;
  const purchaseOffset = descriptionSlot || hasCallout ? "mt-3" : "mt-4";

  return (
    <div className="mx-auto w-full max-w-[360px]">
      <p className="flex items-baseline gap-2 text-left">
        <span className="text-[34px] font-bold leading-none tracking-tight text-chrome">
          {priceHbarDisplay} <span className="italic">ℏ</span>
        </span>
        {priceUsd && <span className="text-[15px] text-silver/70">(${priceUsd})</span>}
      </p>

      {descriptionSlot ? <div className="mt-4">{descriptionSlot}</div> : null}

      {notOnChain && (
        <p
          className={cn(
            "rounded-[14px] border border-amber-400/25 bg-amber-400/10 px-3 py-2.5 text-[13px] leading-snug text-amber-200/90",
            descriptionSlot ? "mt-2" : "mt-4",
          )}
        >
          This listing does not exist on the smart contract yet. The seller&apos;s creation
          transaction may not have completed successfully.
        </p>
      )}
      {isLegacyWeiListing && (
        <p
          className={cn(
            "rounded-[14px] border border-amber-400/25 bg-amber-400/10 px-3 py-2.5 text-[13px] leading-snug text-amber-200/90",
            descriptionSlot || notOnChain ? "mt-2" : "mt-4",
          )}
        >
          This listing uses a legacy price format. The seller needs to edit and save the price
          before it can be purchased.
        </p>
      )}
      {variantBlocked && (
        <p
          className={cn(
            "rounded-[14px] border border-amber-400/25 bg-amber-400/10 px-3 py-2.5 text-[13px] leading-snug text-amber-200/90",
            descriptionSlot || notOnChain || isLegacyWeiListing ? "mt-2" : "mt-4",
          )}
        >
          This option is {formatPriceForDisplay(variantPrice || "0")} ℏ, but the on-chain listing is{" "}
          {listingHbar} ℏ. Purchase is disabled until they match — the contract can only collect the
          on-chain price.
        </p>
      )}

      <button
        type="button"
        onClick={() => {
          if (!address) {
            openSignIn({ title: "Sign in to buy" });
            return;
          }
          if (canBuy) setShippingGate("buy");
        }}
        disabled={!!address && !canBuy}
        className={cn(listingCta.filled, purchaseOffset)}
      >
        {isPending ? "Confirm in wallet\u2026" : "Purchase"}
      </button>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            if (!address) {
              openSignIn({
                title: "Sign in to make an offer",
                onConnected: () => setShippingGate("offer"),
              });
              return;
            }
            // Offers escrow funds up-front, so they need an address too.
            setShippingGate("offer");
          }}
          className={listingCta.tinted}
        >
          Offer
        </button>
        <button type="button" onClick={onMessage} className={listingCta.tinted}>
          Message
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          if (inCart) {
            router.push("/cart");
          } else {
            cart.add(listingId);
          }
        }}
        className={cn(inCart ? listingCta.cartIn : listingCta.cart, "mt-2")}
      >
        {inCart ? "View cart" : "Add to cart"}
      </button>

      <button
        type="button"
        onClick={onToggleWishlist}
        disabled={wishlistDisabled}
        className={cn(listingCta.wishlist, "mt-2", inWishlist && "text-chrome hover:text-chrome")}
        aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
      >
        {inWishlist ? "In wishlist" : "Add to wishlist"}
      </button>

      {isSuccess && (
        <div className="mt-2 flex items-center gap-3 rounded-[14px] border border-[#00ffa3]/25 bg-[#00ffa3]/10 px-4 py-3">
          <div className="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-[#00ffa3] border-t-transparent" />
          <p className="text-sm text-chrome">Purchase confirmed — loading confirmation…</p>
        </div>
      )}
      {errorMessage && (
        <div className="mt-2 space-y-2 rounded-[14px] border border-rose-500/30 bg-rose-500/10 px-3 py-2">
          <p className="break-words text-sm text-rose-300/90">{errorMessage}</p>
          <a
            href="https://docs.hashpack.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-rose-200/90 underline hover:text-rose-100"
          >
            HashPack docs – connection help
          </a>
        </div>
      )}

      <ShippingAddressModal
        open={shippingGate !== null}
        listingId={listingId}
        buyerAddress={address ?? ""}
        ctaLabel={
          shippingGate === "offer" ? "Save & continue to offer" : "Save & continue to payment"
        }
        onConfirmed={() => {
          const next = shippingGate;
          setShippingGate(null);
          if (next === "buy") setConfirmOpen(true);
          if (next === "offer") setOfferModalOpen(true);
        }}
        onClose={() => setShippingGate(null)}
      />

      <ConfirmPurchaseSheet
        open={confirmOpen}
        listingId={listingId}
        priceHbar={variantPrice || _price || "0"}
        contractAddress={marketplaceAddress}
        confirming={isPending}
        onConfirm={() => {
          void buy().finally(() => setConfirmOpen(false));
        }}
        onClose={() => setConfirmOpen(false)}
      />

      <OfferModal
        open={offerModalOpen}
        onClose={() => setOfferModalOpen(false)}
        listingId={listingId}
        askingPriceHbar={variantPrice || _price || "0"}
        onOfferSubmitted={onOfferSubmitted}
      />
    </div>
  );
}
