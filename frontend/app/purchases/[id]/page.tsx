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

import { Btn } from "@/components/order/Btn";
import { ItemRow } from "@/components/order/ItemRow";
import { Pill } from "@/components/order/Pill";
import { ReleaseConfirmModal } from "@/components/order/ReleaseConfirmModal";
import { Stepper } from "@/components/order/Stepper";
import { TxDetailSheet } from "@/components/order/TxDetailSheet";
import { TxPill } from "@/components/order/TxPill";
import { HP, OrderRole, OrderState, STATE_BADGE, STATE_LABEL } from "@/components/order/tokens";

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

type EscrowState = "AWAITING_SHIPMENT" | "AWAITING_CONFIRMATION" | "COMPLETE" | "REFUNDED";

type Escrow = {
  buyer: string;
  seller: string;
  amount: string;
  createdAt: number;
  timeoutAt: number;
  state: EscrowState;
};

function toBytes32(listingId: string): `0x${string}` {
  if (listingId.startsWith("0x") && listingId.length === 66) return listingId as `0x${string}`;
  const hex = Array.from(new TextEncoder().encode(listingId))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex.padEnd(64, "0").slice(0, 64)}` as `0x${string}`;
}

// Contract has 3 escrow states; the design has 5. Disputed is not supported on-chain
// so we omit it. AWAITING_CONFIRMATION maps to "delivered" — that's the screen where
// the buyer's release CTA appears in the design.
function mapEscrowState(s: EscrowState | undefined): OrderState {
  if (s === "COMPLETE") return "released";
  if (s === "AWAITING_CONFIRMATION") return "delivered";
  return "paid";
}

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
  const [escrow, setEscrow] = useState<Escrow | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [txSheetId, setTxSheetId] = useState<string | null>(null);

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
        setEscrow(e as Escrow | null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

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

  const state: OrderState = mapEscrowState(escrow?.state);
  const badge = STATE_BADGE[state];

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

  // Tx for the on-chain pill: payment tx for paid; in-session hash for delivered/released.
  const stepTxHash =
    state === "released"
      ? releaseHash ?? null
      : state === "delivered"
        ? shipHash ?? null
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

  const bodyCopy = bodyFor(state, role);
  const sellerLabel = listing.seller ? shortAccount(listing.seller) : "seller";

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
          <Stepper state={state} />

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
              {STATE_LABEL[state]}
            </div>
            <div style={{ fontSize: 13, color: HP.muted, marginTop: 4, lineHeight: 1.5 }}>
              {bodyCopy}
            </div>
          </div>

          <ItemRow
            title={title}
            image={thumb}
            seller={shortAccount(listing.seller)}
            priceHbar={hbarDisplay}
            priceUsd={usdLabel}
          />

          <StatusBlock
            state={state}
            buyer={buyerLower}
            tracking={listing.trackingNumber}
            carrier={listing.trackingCarrier}
            releasedTxHash={releaseHash}
            releaseHref={getTransactionExplorerUrl(releaseHash, chainId)}
            sellerLabel={sellerLabel}
            hbar={hbarDisplay}
          />

          {!isParty && (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: `1px solid ${HP.borderSoft}`,
                background: "rgba(255,255,255,0.03)",
                fontSize: 12,
                color: HP.muted,
              }}
            >
              You are viewing this order as an observer.
            </div>
          )}

          <Actions
            state={state}
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
        sellerLabel={shortAccount(listing.seller)}
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

// ─── Copy ───────────────────────────────────────────────────────────────────

function bodyFor(state: OrderState, role: OrderRole): string {
  if (role === "buyer") {
    return (
      {
        paid: "Your payment is locked in the escrow contract. The seller has been notified to ship.",
        shipped: "Marked shipped — tracking attached. Tap to release once it arrives and you've inspected it.",
        delivered: "Take a moment to inspect. Once you tap Release, the seller is paid.",
        released: "All done. The funds are with the seller and the trade is sealed on-chain.",
        disputed: "Escrow is paused. Add evidence and an arbiter will decide within 24h.",
      } as Record<OrderState, string>
    )[state];
  }
  return (
    {
      paid: "The buyer has funded escrow. Ship the item and confirm on-chain when you do.",
      shipped: "Tracking submitted. The buyer will release funds after they inspect the item.",
      delivered: "Carrier confirms delivery. Funds release when the buyer taps to confirm.",
      released: "Funds settled to your wallet. Trade is closed.",
      disputed: "The buyer has opened a dispute. Reply with proof of shipment and condition.",
    } as Record<OrderState, string>
  )[state];
}

// ─── Status block ───────────────────────────────────────────────────────────

function StatusBlock({
  state,
  buyer,
  tracking,
  carrier,
  releasedTxHash,
  releaseHref,
  sellerLabel,
  hbar,
}: {
  state: OrderState;
  buyer: string;
  tracking?: string | null;
  carrier?: string | null;
  releasedTxHash: string | null;
  releaseHref: string | null;
  sellerLabel: string;
  hbar: string;
}) {
  if (state === "paid") {
    return (
      <Row label="Shipping to">
        <div style={{ color: HP.fg, fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12 }}>
          {buyer || "—"}
        </div>
        <div style={{ fontSize: 11, color: HP.muted, marginTop: 2 }}>
          Seller will add tracking when shipped.
        </div>
      </Row>
    );
  }

  if (state === "shipped" || state === "delivered") {
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
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
          {[
            { t: "Shipment confirmed by seller", done: true },
            { t: "In transit", done: true },
            { t: "Delivered", done: state === "delivered" },
            { t: "Buyer confirms receipt", done: false },
          ].map((e, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 9999,
                  background: e.done ? HP.chrome : "rgba(255,255,255,0.15)",
                }}
              />
              <span style={{ color: e.done ? HP.fg : HP.muted }}>{e.t}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (state === "released") {
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
  state,
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
  state: OrderState;
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

  if (state === "paid") {
    if (isBuyer) return <Btn variant="ghost" onClick={onMessageSeller}>Message seller</Btn>;
    return (
      <Btn onClick={onMarkShipped} disabled={shipPending}>
        {shipPending ? "Submitting…" : "Mark shipped"}
      </Btn>
    );
  }
  if (state === "shipped") {
    if (isBuyer) {
      return (
        <>
          <Btn variant="ghost" onClick={onMessageSeller}>Message seller</Btn>
        </>
      );
    }
    return <Btn variant="ghost" onClick={onUpdateTracking}>Update tracking</Btn>;
  }
  if (state === "delivered") {
    if (isBuyer) {
      return (
        <Btn onClick={onRequestRelease} disabled={releasePending}>
          {releasePending ? "Submitting…" : "Release funds"}
        </Btn>
      );
    }
    return <StatusNote>Waiting on buyer release</StatusNote>;
  }
  if (state === "released") {
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
