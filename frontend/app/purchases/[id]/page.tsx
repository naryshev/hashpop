"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { getApiUrl } from "@/lib/apiUrl";
import { listingHref } from "@/lib/listingUrl";
import { useHashpackWallet } from "@/lib/hashpackWallet";
import { useHbarUsd } from "@/hooks/useHbarUsd";
import { useRobustContractWrite } from "@/hooks/useRobustContractWrite";
import { escrowAbi, escrowAddress } from "@/lib/contracts";
import { activeHederaChain } from "@/lib/hederaChains";
import { getTransactionErrorMessage } from "@/lib/transactionError";
import { getTransactionExplorerUrl } from "@/lib/explorer";
import { formatContractAmountToHbar, formatPriceForDisplay } from "@/lib/formatPrice";
import { getListingMediaUrls } from "@/lib/listingMedia";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { AddressDisplay } from "@/components/AddressDisplay";
import { ShippingAddressModal } from "@/components/ShippingAddressModal";

import { ItemRow } from "@/components/order/ItemRow";
import { ReleaseConfirmModal } from "@/components/order/ReleaseConfirmModal";
import { TxDetailSheet } from "@/components/order/TxDetailSheet";
import { TxPill } from "@/components/order/TxPill";
import { PHASE_LABEL, PHASE_TONE, type OrderRole } from "@/components/order/tokens";
import { Button } from "@/components/ui/Button";
import { Capsule } from "@/components/ui/Capsule";
import { material } from "@/lib/materials";
import { cn } from "@/lib/utils";
import {
  ESCROW_V2,
  EscrowView,
  orderStatusLine,
  phaseFor,
  type OrderPhase,
} from "@/lib/orderStatus";

type Listing = {
  id: string;
  seller: string;
  buyer?: string | null;
  price: string;
  status: string;
  requireEscrow?: boolean;
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
  shippedAt?: string | null;
  exchangeConfirmedAt?: string | null;
  title?: string | null;
  imageUrl?: string | null;
  mediaUrls?: string[];
  txHash?: string | null;
};

function toBytes32(listingId: string): `0x${string}` {
  if (listingId.startsWith("0x") && listingId.length === 66) return listingId as `0x${string}`;
  const hex = Array.from(new TextEncoder().encode(listingId))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex.padEnd(64, "0").slice(0, 64)}` as `0x${string}`;
}

type ShipToAddress = {
  name: string;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
};

export default function PurchaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = (params?.id as string) || "";
  const { address } = useHashpackWallet();
  const usdRate = useHbarUsd();
  const chainId = activeHederaChain.id;

  const [listing, setListing] = useState<Listing | null>(null);
  const [escrow, setEscrow] = useState<EscrowView | null>(null);
  const [shipTo, setShipTo] = useState<ShipToAddress | null>(null);
  const [loading, setLoading] = useState(true);
  // Inline tracking entry (seller, EscrowV2): saving tracking IS the shipping
  // flow — the settlement engine records the shipment on-chain.
  const [trackingInput, setTrackingInput] = useState("");
  const [carrierInput, setCarrierInput] = useState("");
  const [trackingSaving, setTrackingSaving] = useState(false);
  const [trackingSaved, setTrackingSaved] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [txSheetId, setTxSheetId] = useState<string | null>(null);
  const [addrModalOpen, setAddrModalOpen] = useState(false);

  const idBytes = useMemo(() => toBytes32(id), [id]);

  const {
    send: sendShip,
    isPending: shipPending,
    error: shipError,
    lastHash: shipHash,
  } = useRobustContractWrite();
  const {
    send: sendRelease,
    isPending: releasePending,
    error: releaseError,
    lastHash: releaseHash,
  } = useRobustContractWrite();

  const refetch = useCallback(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetch(`${getApiUrl()}/api/listing/${encodeURIComponent(id)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then((d: { listing: Listing }) => d.listing)
        .catch(() => null),
      fetch(`${getApiUrl()}/api/escrow/${encodeURIComponent(id)}`)
        .then((r) => (r.ok ? r.json() : r.status === 404 ? null : Promise.reject(r)))
        .catch(() => null),
    ])
      .then(([l, e]) => {
        setListing(l);
        setEscrow(e as EscrowView | null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    setTrackingInput(listing?.trackingNumber ?? "");
    setCarrierInput(listing?.trackingCarrier ?? "");
  }, [listing?.trackingNumber, listing?.trackingCarrier]);

  const saveTracking = async () => {
    if (!address || !trackingInput.trim()) {
      setTrackingError("Enter the tracking number first.");
      return;
    }
    setTrackingSaving(true);
    setTrackingError(null);
    try {
      const res = await fetch(
        `${getApiUrl()}/api/listing/${encodeURIComponent(listing?.id ?? id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sellerAddress: address,
            trackingNumber: trackingInput.trim(),
            trackingCarrier: carrierInput.trim() || undefined,
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body?.error || "Failed to save tracking.");
      }
      setTrackingSaved(true);
      refetch();
    } catch (e) {
      setTrackingError(e instanceof Error ? e.message : "Failed to save tracking.");
    } finally {
      setTrackingSaving(false);
    }
  };

  // Delivery address collected at checkout — the buyer sees their own, the
  // seller sees the buyer's. Uses the canonical listing id from the API
  // response (the URL may carry the short ascii form).
  const canonicalId = listing?.id ?? id;
  const refreshShipTo = useCallback(() => {
    if (!canonicalId || !address) {
      setShipTo(null);
      return;
    }
    fetch(
      `${getApiUrl()}/api/listing/${encodeURIComponent(canonicalId)}/shipping-address?requester=${encodeURIComponent(address)}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { address?: ShipToAddress } | null) => setShipTo(data?.address ?? null))
      .catch(() => setShipTo(null));
  }, [canonicalId, address]);

  useEffect(() => {
    refreshShipTo();
  }, [refreshShipTo]);

  // After a successful on-chain write, refetch escrow state so the stepper advances.
  useEffect(() => {
    if (shipHash || releaseHash) {
      refetch();
    }
  }, [shipHash, releaseHash, refetch]);

  if (loading && !listing) {
    return (
      <main className="bg-app min-h-screen p-6 text-fg">
        <p className="text-[13px] text-muted">Loading order…</p>
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="bg-app min-h-screen p-6 text-fg">
        <p className="font-semibold">Order not found.</p>
        <Link href="/purchases" className="text-sm text-chrome">
          ← Back to purchases
        </Link>
      </main>
    );
  }

  if (!address) {
    return (
      <main className="bg-app min-h-screen p-6 text-fg">
        <p className="mb-3 text-sm font-semibold text-fg">
          Connect your wallet to view this order.
        </p>
        <ConnectWalletButton />
      </main>
    );
  }

  const sellerLower = (listing.seller || "").toLowerCase();
  const buyerLower = (escrow?.buyer || listing.buyer || "").toLowerCase();
  const me = address.toLowerCase();
  const role: OrderRole = me === sellerLower ? "seller" : "buyer";
  const isBuyer = role === "buyer";
  const isParty = me === sellerLower || me === buyerLower;

  // Order details (shipping address, tracking, escrow controls) are private
  // to the two parties. Everyone else gets a minimal gate screen.
  if (!isParty) {
    return (
      <main className="bg-app min-h-screen p-6 text-fg">
        <div
          className={cn(
            material.regular,
            "mx-auto mt-12 max-w-md rounded-control p-4.5 text-center",
          )}
        >
          <p className="m-0 text-[15px] font-bold">This order is private</p>
          <p className="mt-1.5 text-[13px] text-muted">
            Order and escrow details are only visible to the buyer and the seller.
          </p>
          <Link href="/marketplace" className="mt-3.5 inline-block text-[13px] text-chrome">
            ← Back to marketplace
          </Link>
        </div>
      </main>
    );
  }

  const phase: OrderPhase = phaseFor(escrow?.state, escrow?.disputed);
  const status = orderStatusLine({
    phase,
    role,
    timeoutAt: escrow?.timeoutAt,
    isEscrow: listing.requireEscrow !== false,
  });

  // Amounts. Escrow's `amount` is the on-chain stored amount (tinybar or wei).
  // Fall back to the listing price for the not-yet-funded edge case.
  const hbarDisplay = escrow
    ? formatContractAmountToHbar(escrow.amount)
    : formatPriceForDisplay(listing.price);
  const usdLabel = (() => {
    if (!usdRate || usdRate <= 0) return null;
    const n = Number(hbarDisplay);
    if (Number.isNaN(n)) return null;
    const usd = n * usdRate;
    return usd >= 0.01 ? `$${usd.toFixed(2)}` : usd > 0 ? `$${usd.toFixed(4)}` : null;
  })();

  const title = listing.title || "Order";
  const media = getListingMediaUrls(listing);
  const thumb = media[0] ?? null;

  // Tx for the on-chain pill: payment tx for paid; in-session hash afterwards.
  const stepTxHash =
    phase === "complete"
      ? (releaseHash ?? listing.txHash ?? null)
      : phase === "shipped"
        ? (shipHash ?? listing.txHash ?? null)
        : (listing.txHash ?? null);
  const stepTxHref = getTransactionExplorerUrl(stepTxHash, chainId);

  const errorMessage = getTransactionErrorMessage(shipError ?? releaseError, { chainId });

  const onMarkShipped = async () => {
    if (!escrow) return;
    await sendShip({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "confirmShipment",
      args: [idBytes],
    });
  };

  const onConfirmRelease = async () => {
    await sendRelease({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "confirmReceipt",
      args: [idBytes],
    });
    await fetch(`${getApiUrl()}/api/sync-escrow-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: id }),
    }).catch(() => {});
    setConfirmOpen(false);
  };

  // Never render raw 0x addresses — resolve to HashPack name / 0.0.x.
  const sellerLabel: React.ReactNode = listing.seller ? (
    <AddressDisplay address={listing.seller} showVerified={false} />
  ) : (
    "seller"
  );

  return (
    <main className="bg-app min-h-screen text-fg">
      <div className="mx-auto max-w-md">
        <NavBar
          eyebrow={isBuyer ? "Purchase" : "Sale"}
          title={title}
          onBack={() => router.push(listingHref(listing?.id ?? id))}
        />

        <section className="flex flex-col gap-3.5 px-[18px] pb-8 pt-2">
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <Capsule tone={PHASE_TONE[phase]}>{PHASE_LABEL[phase]}</Capsule>
            <TxPill
              hash={stepTxHash}
              href={stepTxHref}
              pulsing={shipPending || releasePending}
              label={shipPending || releasePending ? "Submitting" : "On-chain"}
              onSelect={stepTxHash ? () => setTxSheetId(stepTxHash) : undefined}
            />
          </div>

          <div>
            <div className="text-[22px] font-extrabold tracking-tight text-fg">{status.label}</div>
            <div className="mt-1 text-[13px] leading-relaxed text-muted">{status.detail}</div>
          </div>

          <ItemRow
            title={title}
            image={thumb}
            seller={
              listing.seller ? (
                <AddressDisplay address={listing.seller} showVerified={false} />
              ) : (
                "seller"
              )
            }
            priceHbar={hbarDisplay}
            priceUsd={usdLabel}
          />

          <StatusBlock
            phase={phase}
            isBuyer={isBuyer}
            shipTo={shipTo}
            onAddAddress={isBuyer ? () => setAddrModalOpen(true) : undefined}
            tracking={listing.trackingNumber}
            carrier={listing.trackingCarrier}
            releasedTxHash={releaseHash}
            releaseHref={getTransactionExplorerUrl(releaseHash, chainId)}
            sellerLabel={sellerLabel}
            hbar={hbarDisplay}
          />

          {/* Seller + EscrowV2: tracking entry lives right here — saving it is
              the entire shipping flow (the settlement engine records the
              shipment on-chain; no wallet transaction). */}
          {isParty &&
            role === "seller" &&
            ESCROW_V2 &&
            (phase === "paid" || phase === "shipped") && (
              <div className={cn(material.regular, "flex flex-col gap-2 rounded-control p-3.5")}>
                <div className="text-[10px] font-bold text-muted">
                  {phase === "paid" ? "Ship it — enter tracking" : "Update tracking"}
                </div>
                <input
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                  placeholder="Tracking number *"
                  className="rounded-[10px] border border-hairline bg-bg px-3 py-2.5 text-[13px] text-fg outline-none focus:border-chrome/40"
                />
                <input
                  value={carrierInput}
                  onChange={(e) => setCarrierInput(e.target.value)}
                  placeholder="Carrier (e.g. USPS, UPS, FedEx)"
                  className="rounded-[10px] border border-hairline bg-bg px-3 py-2.5 text-[13px] text-fg outline-none focus:border-chrome/40"
                />
                {trackingSaved && phase === "paid" ? (
                  <p className="m-0 text-xs text-chrome">
                    Tracking saved — the shipment will be recorded on-chain automatically.
                  </p>
                ) : (
                  <Button
                    onClick={() => void saveTracking()}
                    disabled={trackingSaving || !trackingInput.trim()}
                  >
                    {trackingSaving
                      ? "Saving…"
                      : phase === "paid"
                        ? "Save tracking — mark as shipped"
                        : "Save tracking"}
                  </Button>
                )}
                {trackingError && <p className="m-0 text-xs text-rose-300">{trackingError}</p>}
              </div>
            )}

          <Actions
            phase={phase}
            role={role}
            isParty={isParty}
            shipPending={shipPending}
            releasePending={releasePending}
            onMarkShipped={onMarkShipped}
            onRequestRelease={() => setConfirmOpen(true)}
            releaseHref={getTransactionExplorerUrl(releaseHash, chainId)}
            onMessageSeller={() =>
              router.push(
                `/messages?openThread=${encodeURIComponent(listing.seller || "")}&listingId=${encodeURIComponent(id)}`,
              )
            }
            onUpdateTracking={() => router.push(`/listing/${encodeURIComponent(id)}`)}
          />

          {errorMessage && (
            <div className="rounded-control border border-danger/30 bg-danger/10 p-3 text-xs text-rose-300">
              {errorMessage}
            </div>
          )}
        </section>
      </div>

      <ReleaseConfirmModal
        open={confirmOpen}
        amount={hbarDisplay}
        sellerLabel={sellerLabel}
        submitting={releasePending}
        onConfirm={onConfirmRelease}
        onCancel={() => setConfirmOpen(false)}
      />

      <TxDetailSheet
        open={!!txSheetId}
        txId={txSheetId}
        hashscanHref={getTransactionExplorerUrl(txSheetId, chainId)}
        onClose={() => setTxSheetId(null)}
      />

      {/* Buyer can (re)save a delivery address post-purchase if none is on
          file — the seller immediately sees it on their side of this page. */}
      <ShippingAddressModal
        open={addrModalOpen}
        listingId={listing?.id ?? id}
        buyerAddress={address ?? ""}
        ctaLabel="Save delivery address"
        onConfirmed={() => {
          setAddrModalOpen(false);
          refreshShipTo();
        }}
        onClose={() => setAddrModalOpen(false)}
      />
    </main>
  );
}

// ─── Nav bar ────────────────────────────────────────────────────────────────

function NavBar({
  eyebrow,
  title,
  onBack,
}: {
  eyebrow: string;
  title: string;
  onBack: () => void;
}) {
  const chip =
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-white/[0.04] text-fg";
  return (
    <div className="flex items-center gap-3 px-[18px] pb-1 pt-3.5">
      <button type="button" onClick={onBack} aria-label="Back" className={chip}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <div className="min-w-0 flex-1 text-center">
        <div className="text-[9px] font-semibold text-muted">{eyebrow}</div>
        <div className="truncate text-[15px] font-bold text-fg">{title}</div>
      </div>
      <div aria-hidden className={cn(chip, "font-bold")}>
        ⋯
      </div>
    </div>
  );
}

// ─── Status block ───────────────────────────────────────────────────────────

function StatusBlock({
  phase,
  isBuyer,
  shipTo,
  onAddAddress,
  tracking,
  carrier,
  releasedTxHash,
  releaseHref,
  sellerLabel,
  hbar,
}: {
  phase: OrderPhase;
  isBuyer: boolean;
  shipTo: ShipToAddress | null;
  onAddAddress?: () => void;
  tracking?: string | null;
  carrier?: string | null;
  releasedTxHash: string | null;
  releaseHref: string | null;
  sellerLabel: React.ReactNode;
  hbar: string;
}) {
  if (phase === "paid") {
    return (
      <Row label="Shipping to">
        {shipTo ? (
          <div className="text-xs leading-relaxed text-fg">
            <div className="font-semibold">{shipTo.name}</div>
            <div className="text-muted">
              {shipTo.line1}
              {shipTo.line2 ? `, ${shipTo.line2}` : ""}
            </div>
            <div className="text-muted">
              {shipTo.city}
              {shipTo.region ? `, ${shipTo.region}` : ""} {shipTo.postalCode}, {shipTo.country}
            </div>
          </div>
        ) : (
          <div className="text-xs leading-relaxed text-muted">
            {isBuyer
              ? "No delivery address on file for this order."
              : "The buyer hasn't provided a delivery address yet — message them before shipping."}
            {isBuyer && onAddAddress && (
              <button
                type="button"
                onClick={onAddAddress}
                className="mt-2 block rounded-[10px] border border-chrome/40 bg-chrome/10 px-3.5 py-2 text-xs font-bold text-chrome"
              >
                Add delivery address
              </button>
            )}
          </div>
        )}
        <div className="mt-0.5 text-[11px] text-muted">Seller will add tracking when shipped.</div>
      </Row>
    );
  }

  if (phase === "shipped") {
    return (
      <div className={cn(material.regular, "rounded-control p-3.5")}>
        <div className="mb-2 text-[10px] font-bold text-muted">Tracking</div>
        {tracking ? (
          <div className="font-mono text-xs text-fg">
            {carrier ? `${carrier} · ` : ""}
            {tracking}
          </div>
        ) : (
          <div className="text-xs text-muted">
            Tracking not provided. Reach out to the seller for an update.
          </div>
        )}
      </div>
    );
  }

  if (phase === "refunded") {
    return (
      <div className="rounded-control border border-danger/30 bg-danger/10 p-4.5 text-center">
        <div className="text-sm font-semibold text-fg">{hbar} ℏ returned to the buyer</div>
        <div className="mt-1 text-[11px] text-muted">
          The escrow timed out before shipment, so the payment was refunded automatically.
        </div>
      </div>
    );
  }

  if (phase === "complete") {
    return (
      <div className="rounded-control border border-chrome/30 bg-chrome/10 p-4.5 text-center">
        <div className="mb-1.5 text-4xl">✓</div>
        <div className="text-sm font-semibold text-fg">
          {hbar} ℏ released to {sellerLabel}
        </div>
        {releasedTxHash ? (
          releaseHref ? (
            <a
              href={releaseHref}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-block font-mono text-[11px] text-muted underline"
            >
              {releasedTxHash.slice(0, 18)}… ↗
            </a>
          ) : (
            <div className="mt-1 font-mono text-[11px] text-muted">
              {releasedTxHash.slice(0, 18)}…
            </div>
          )
        ) : null}
      </div>
    );
  }

  return null;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={cn(material.regular, "rounded-control p-3.5")}>
      <div className="mb-1.5 text-[10px] font-bold text-muted">{label}</div>
      <div className="text-[13px]">{children}</div>
    </div>
  );
}

// ─── Actions ────────────────────────────────────────────────────────────────

function Actions({
  phase,
  role,
  isParty,
  shipPending,
  releasePending,
  onMarkShipped,
  onRequestRelease,
  releaseHref,
  onMessageSeller,
  onUpdateTracking,
}: {
  phase: OrderPhase;
  role: OrderRole;
  isParty: boolean;
  shipPending: boolean;
  releasePending: boolean;
  onMarkShipped: () => void;
  onRequestRelease: () => void;
  releaseHref: string | null;
  onMessageSeller: () => void;
  onUpdateTracking: () => void;
}) {
  if (!isParty) return null;
  const isBuyer = role === "buyer";

  const StatusNote = ({ children }: { children: React.ReactNode }) => (
    <div
      className={cn(
        material.regular,
        "rounded-control px-3.5 py-2.5 text-center text-xs text-muted",
      )}
    >
      {children}
    </div>
  );

  if (phase === "paid") {
    if (isBuyer)
      return (
        <Button variant="gray" onClick={onMessageSeller}>
          Message seller
        </Button>
      );
    if (ESCROW_V2) return null;
    return (
      <Button onClick={onMarkShipped} disabled={shipPending}>
        {shipPending ? "Submitting…" : "Mark shipped"}
      </Button>
    );
  }
  if (phase === "shipped") {
    if (isBuyer) {
      return (
        <div className="flex flex-col gap-2">
          <Button onClick={onRequestRelease} disabled={releasePending}>
            {releasePending ? "Submitting…" : "Got it — release now"}
          </Button>
          <Button variant="gray" onClick={onMessageSeller}>
            Message seller
          </Button>
        </div>
      );
    }
    if (ESCROW_V2) return null;
    return (
      <Button variant="gray" onClick={onUpdateTracking}>
        Update tracking
      </Button>
    );
  }
  if (phase === "disputed") {
    return <StatusNote>Escrow is on hold while the dispute is reviewed.</StatusNote>;
  }
  if (phase === "refunded") {
    return <StatusNote>Payment was returned to the buyer.</StatusNote>;
  }
  if (phase === "complete") {
    if (releaseHref) {
      return (
        <Button
          variant="gray"
          onClick={() => {
            window.open(releaseHref, "_blank", "noopener,noreferrer");
          }}
        >
          View receipt on HashScan ↗
        </Button>
      );
    }
    return <StatusNote>Trade complete</StatusNote>;
  }
  return null;
}
