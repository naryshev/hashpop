"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { getApiUrl } from "@/lib/apiUrl";
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

import { Btn } from "@/components/order/Btn";
import { ItemRow } from "@/components/order/ItemRow";
import { Pill } from "@/components/order/Pill";
import { ReleaseConfirmModal } from "@/components/order/ReleaseConfirmModal";
import { TxDetailSheet } from "@/components/order/TxDetailSheet";
import { TxPill } from "@/components/order/TxPill";
import { HP, OrderRole } from "@/components/order/tokens";
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

const PHASE_BADGE: Record<OrderPhase, { c: string; fg: string; label: string }> = {
  paid: { c: HP.chrome, fg: "#000", label: "PAID" },
  shipped: { c: HP.amber, fg: "#000", label: "SHIPPED" },
  complete: { c: HP.chromeDeep, fg: "#fff", label: "COMPLETE" },
  refunded: { c: HP.rose, fg: "#fff", label: "REFUNDED" },
  disputed: { c: HP.rose, fg: "#fff", label: "ON HOLD" },
};

function shortAccount(addr: string | null | undefined): string {
  if (!addr) return "";
  if (addr.startsWith("0x")) return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  return addr;
}

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
      <main style={{ minHeight: "100vh", background: HP.bg, color: HP.fg, padding: 24 }}>
        <p style={{ color: HP.muted, fontSize: 13 }}>Loading order…</p>
      </main>
    );
  }

  if (!listing) {
    return (
      <main style={{ minHeight: "100vh", background: HP.bg, color: HP.fg, padding: 24 }}>
        <p style={{ fontWeight: 600 }}>Order not found.</p>
        <Link href="/purchases" style={{ color: HP.chrome, fontSize: 14 }}>
          ← Back to purchases
        </Link>
      </main>
    );
  }

  if (!address) {
    return (
      <main style={{ minHeight: "100vh", background: HP.bg, color: HP.fg, padding: 24 }}>
        <p style={{ fontSize: 14, color: HP.fg, fontWeight: 600, marginBottom: 12 }}>
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
      <main style={{ minHeight: "100vh", background: HP.bg, color: HP.fg, padding: 24 }}>
        <div
          style={{
            maxWidth: 480,
            margin: "48px auto 0",
            padding: 18,
            borderRadius: 14,
            border: `1px solid ${HP.borderSoft}`,
            background: "rgba(255,255,255,0.03)",
            textAlign: "center",
          }}
        >
          <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>This order is private</p>
          <p style={{ fontSize: 13, color: HP.muted, marginTop: 6 }}>
            Order and escrow details are only visible to the buyer and the seller.
          </p>
          <Link
            href="/marketplace"
            style={{ display: "inline-block", marginTop: 14, color: HP.chrome, fontSize: 13 }}
          >
            ← Back to marketplace
          </Link>
        </div>
      </main>
    );
  }

  const phase: OrderPhase = phaseFor(escrow?.state, escrow?.disputed);
  const badge = PHASE_BADGE[phase];
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
      ? releaseHash ?? listing.txHash ?? null
      : phase === "shipped"
        ? shipHash ?? listing.txHash ?? null
        : listing.txHash ?? null;
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
    <main
      style={{
        minHeight: "100vh",
        background: HP.bg,
        color: HP.fg,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <NavBar
          eyebrow={isBuyer ? "PURCHASE" : "SALE"}
          title={title}
          onBack={() => router.push("/purchases")}
        />

        <section
          style={{
            padding: "8px 18px 32px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
            <Pill c={badge.c} fg={badge.fg}>
              {badge.label}
            </Pill>
            <TxPill
              hash={stepTxHash}
              href={stepTxHref}
              pulsing={shipPending || releasePending}
              label={shipPending || releasePending ? "Submitting" : "On-chain"}
              onSelect={stepTxHash ? () => setTxSheetId(stepTxHash) : undefined}
            />
          </div>

          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: HP.fg,
                letterSpacing: "-0.01em",
              }}
            >
              {status.label}
            </div>
            <div style={{ fontSize: 13, color: HP.muted, marginTop: 4, lineHeight: 1.5 }}>
              {status.detail}
            </div>
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
          {isParty && role === "seller" && ESCROW_V2 && (phase === "paid" || phase === "shipped") && (
            <div
              style={{
                padding: 14,
                borderRadius: 14,
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${HP.borderSoft}`,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: HP.muted,
                }}
              >
                {phase === "paid" ? "Ship it — enter tracking" : "Update tracking"}
              </div>
              <input
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value)}
                placeholder="Tracking number *"
                style={{
                  background: HP.bgInput,
                  border: `1px solid ${HP.borderSoft}`,
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontSize: 13,
                  color: HP.fg,
                  outline: "none",
                }}
              />
              <input
                value={carrierInput}
                onChange={(e) => setCarrierInput(e.target.value)}
                placeholder="Carrier (e.g. USPS, UPS, FedEx)"
                style={{
                  background: HP.bgInput,
                  border: `1px solid ${HP.borderSoft}`,
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontSize: 13,
                  color: HP.fg,
                  outline: "none",
                }}
              />
              {trackingSaved && phase === "paid" ? (
                <p style={{ fontSize: 12, color: HP.chrome, margin: 0 }}>
                  Tracking saved — the shipment will be recorded on-chain automatically.
                </p>
              ) : (
                <Btn onClick={() => void saveTracking()} disabled={trackingSaving || !trackingInput.trim()}>
                  {trackingSaving
                    ? "Saving…"
                    : phase === "paid"
                      ? "Save tracking — mark as shipped"
                      : "Save tracking"}
                </Btn>
              )}
              {trackingError && (
                <p style={{ fontSize: 12, color: "#fda4af", margin: 0 }}>{trackingError}</p>
              )}
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
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: "rgba(244,63,94,0.08)",
                border: "1px solid rgba(244,63,94,0.3)",
                fontSize: 12,
                color: "#fda4af",
              }}
            >
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
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 18px 4px",
      }}
    >
      <button
        onClick={onBack}
        aria-label="Back"
        style={{
          width: 32,
          height: 32,
          borderRadius: 9999,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.04)",
          color: HP.fg,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
        <div
          style={{
            fontSize: 9,
            color: HP.muted,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.16em",
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            fontSize: 15,
            color: HP.fg,
            fontWeight: 700,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
      </div>
      <div
        aria-hidden
        style={{
          width: 32,
          height: 32,
          borderRadius: 9999,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.04)",
          color: HP.fg,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontWeight: 700,
          letterSpacing: 1,
        }}
      >
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
          <div style={{ fontSize: 12, color: HP.fg, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 600 }}>{shipTo.name}</div>
            <div style={{ color: HP.muted }}>
              {shipTo.line1}
              {shipTo.line2 ? `, ${shipTo.line2}` : ""}
            </div>
            <div style={{ color: HP.muted }}>
              {shipTo.city}
              {shipTo.region ? `, ${shipTo.region}` : ""} {shipTo.postalCode}, {shipTo.country}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: HP.muted, lineHeight: 1.5 }}>
            {isBuyer
              ? "No delivery address on file for this order."
              : "The buyer hasn't provided a delivery address yet — message them before shipping."}
            {isBuyer && onAddAddress && (
              <button
                type="button"
                onClick={onAddAddress}
                style={{
                  display: "block",
                  marginTop: 8,
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,255,163,0.4)",
                  background: "rgba(0,255,163,0.08)",
                  color: HP.chrome,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Add delivery address
              </button>
            )}
          </div>
        )}
        <div style={{ fontSize: 11, color: HP.muted, marginTop: 2 }}>
          Seller will add tracking when shipped.
        </div>
      </Row>
    );
  }

  if (phase === "shipped") {
    return (
      <div
        style={{
          padding: 14,
          borderRadius: 14,
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${HP.borderSoft}`,
        }}
      >
        <div
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: HP.muted,
            marginBottom: 8,
          }}
        >
          Tracking
        </div>
        {tracking ? (
          <div style={{ fontSize: 12, fontFamily: "ui-monospace,Menlo,monospace", color: HP.fg }}>
            {carrier ? `${carrier} · ` : ""}
            {tracking}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: HP.muted }}>
            Tracking not provided. Reach out to the seller for an update.
          </div>
        )}
      </div>
    );
  }

  if (phase === "refunded") {
    return (
      <div
        style={{
          padding: 18,
          borderRadius: 14,
          textAlign: "center",
          background: "linear-gradient(180deg,rgba(244,63,94,0.08),rgba(244,63,94,0.02))",
          border: "1px solid rgba(244,63,94,0.3)",
        }}
      >
        <div style={{ fontSize: 14, color: HP.fg, fontWeight: 600 }}>
          {hbar} ℏ returned to the buyer
        </div>
        <div style={{ fontSize: 11, color: HP.muted, marginTop: 4 }}>
          The escrow timed out before shipment, so the payment was refunded automatically.
        </div>
      </div>
    );
  }

  if (phase === "complete") {
    return (
      <div
        style={{
          padding: 18,
          borderRadius: 14,
          textAlign: "center",
          background: "linear-gradient(180deg,rgba(0,255,163,0.08),rgba(0,255,163,0.02))",
          border: "1px solid rgba(0,255,163,0.3)",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 6 }}>✓</div>
        <div style={{ fontSize: 14, color: HP.fg, fontWeight: 600 }}>
          {hbar} ℏ released to {sellerLabel}
        </div>
        {releasedTxHash ? (
          releaseHref ? (
            <a
              href={releaseHref}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 11,
                color: HP.muted,
                marginTop: 6,
                display: "inline-block",
                fontFamily: "ui-monospace,Menlo,monospace",
                textDecoration: "underline",
                textDecorationColor: "rgba(255,255,255,0.2)",
              }}
            >
              {releasedTxHash.slice(0, 18)}… ↗
            </a>
          ) : (
            <div
              style={{
                fontSize: 11,
                color: HP.muted,
                marginTop: 4,
                fontFamily: "ui-monospace,Menlo,monospace",
              }}
            >
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
    <div
      style={{
        padding: 14,
        borderRadius: 14,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: HP.muted,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13 }}>{children}</div>
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

  // Non-interactive status label (previously rendered as a dead button).
  const StatusNote = ({ children }: { children: React.ReactNode }) => (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.08)",
        fontSize: 12,
        color: "#a9b0bf",
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );

  if (phase === "paid") {
    if (isBuyer) return <Btn variant="ghost" onClick={onMessageSeller}>Message seller</Btn>;
    // With EscrowV2 the seller ships via the inline tracking form rendered
    // above this component — no extra button needed here.
    if (ESCROW_V2) return null;
    return (
      <Btn onClick={onMarkShipped} disabled={shipPending}>
        {shipPending ? "Submitting…" : "Mark shipped"}
      </Btn>
    );
  }
  if (phase === "shipped") {
    if (isBuyer) {
      // Optional early release — escrow auto-releases on the shown date anyway.
      return (
        <>
          <Btn onClick={onRequestRelease} disabled={releasePending}>
            {releasePending ? "Submitting…" : "Got it — release now"}
          </Btn>
          <Btn variant="ghost" onClick={onMessageSeller}>Message seller</Btn>
        </>
      );
    }
    // EscrowV2 sellers get the inline tracking form above.
    if (ESCROW_V2) return null;
    return <Btn variant="ghost" onClick={onUpdateTracking}>Update tracking</Btn>;
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
        <Btn
          variant="ghost"
          onClick={() => {
            window.open(releaseHref, "_blank", "noopener,noreferrer");
          }}
        >
          View receipt on HashScan ↗
        </Btn>
      );
    }
    return <StatusNote>Trade complete</StatusNote>;
  }
  return null;
}
