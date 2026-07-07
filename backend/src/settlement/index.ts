import { ethers } from "ethers";
import type { PrismaClient } from "../generated/prisma/client";
import type { Logger } from "pino";

/**
 * Settlement engine — moves escrow complexity off the user and onto the
 * platform. Runs alongside the indexer and periodically sweeps in-flight
 * (LOCKED) listings:
 *
 * Phase 1 (v1 Escrow, default):
 *   - Calls the permissionless `resolveTimeout` on any expired escrow, so
 *     no-ship refunds and post-shipment auto-releases happen without anyone
 *     clicking a button. Skips listings with an open dispute.
 *
 * Phase 2 (EscrowV2, ESCROW_V2=true + arbiter key):
 *   - markShipped when the seller saves a tracking number (no seller wallet
 *     tx needed).
 *   - Mirrors DB dispute state on-chain via setDisputed, freezing the
 *     timeout rails while support reviews.
 *   - Sweeps `resolveTimeout` for the contract's built-in rails: no-ship →
 *     refund buyer, shipped + auto-release window → pay seller, disputed +
 *     hard timeout → refund buyer.
 *   A delivery-verification adapter (carrier API) can later call `release()`
 *   as soon as delivery + inspection window is confirmed; until then the
 *   contract's time-based auto-release is the fallback.
 *
 * Env:
 *   ESCROW_ADDRESS, HEDERA_RPC_URL       required
 *   ESCROW_V2=true                       enable EscrowV2 mode
 *   ESCROW_ARBITER_KEY | SETTLEMENT_KEY  signer key (arbiter in v2 mode;
 *                                        any funded key works for v1
 *                                        permissionless timeouts)
 *   SETTLEMENT_INTERVAL_MS               sweep interval (default 60000)
 */

const ESCROW_V1_ABI = [
  "function escrows(bytes32) view returns (address buyer, address seller, uint256 amount, uint256 createdAt, uint256 timeoutAt, uint8 state)",
  "function resolveTimeout(bytes32 listingId)",
];

const ESCROW_V2_ABI = [
  "function escrows(bytes32) view returns (address buyer, address seller, uint256 amount, uint256 createdAt, uint256 shipDeadline, uint256 shippedAt, uint8 state, bool disputed)",
  "function markShipped(bytes32 listingId)",
  "function setDisputed(bytes32 listingId, bool disputed)",
  "function resolveTimeout(bytes32 listingId)",
  "function autoReleaseWindow() view returns (uint256)",
  "function disputedHardTimeout() view returns (uint256)",
];

// v1: AWAITING_SHIPMENT=0, AWAITING_CONFIRMATION=1, COMPLETE=2
// v2: AWAITING_SHIPMENT=0, SHIPPED=1, COMPLETE=2, REFUNDED=3
const AWAITING_SHIPMENT = 0;

const SWEEP_BATCH = 50;

function listingIdToBytes32(id: string): string {
  if (!id || typeof id !== "string") return "0x" + "0".repeat(64);
  if (id.startsWith("0x")) {
    const body = id.slice(2).toLowerCase();
    if (/^[0-9a-f]*$/.test(body) && body.length > 0 && body.length <= 64) {
      return "0x" + body.padEnd(64, "0");
    }
  }
  const hex = Buffer.from(id, "utf8").toString("hex").padEnd(64, "0").slice(0, 64);
  return "0x" + hex;
}

type InFlightListing = {
  id: string;
  trackingNumber: string | null;
  disputeStatus: string | null;
};

export function startSettlementEngine(prisma: PrismaClient, log: Logger): void {
  const escrowAddr = process.env.ESCROW_ADDRESS;
  const rpcUrl = process.env.HEDERA_RPC_URL;
  const isV2 = process.env.ESCROW_V2 === "true";
  const signerKeyRaw = (
    process.env.ESCROW_ARBITER_KEY ||
    process.env.SETTLEMENT_KEY ||
    ""
  ).trim();
  const intervalMs = Math.max(15_000, Number(process.env.SETTLEMENT_INTERVAL_MS || 60_000));

  if (!escrowAddr || !rpcUrl) {
    log.info("Settlement engine disabled: ESCROW_ADDRESS / HEDERA_RPC_URL not set");
    return;
  }
  if (!signerKeyRaw) {
    log.info(
      "Settlement engine disabled: set ESCROW_ARBITER_KEY (or SETTLEMENT_KEY) to enable automatic settlements",
    );
    return;
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
  const signerKey = signerKeyRaw.startsWith("0x") ? signerKeyRaw : `0x${signerKeyRaw}`;
  let signer: ethers.Wallet;
  try {
    signer = new ethers.Wallet(signerKey, provider);
  } catch (err) {
    log.error({ err }, "Settlement engine disabled: invalid signer key");
    return;
  }
  const escrow = new ethers.Contract(escrowAddr, isV2 ? ESCROW_V2_ABI : ESCROW_V1_ABI, signer);

  log.info(
    { escrowAddr, mode: isV2 ? "v2 (arbiter)" : "v1 (timeout keeper)", signer: signer.address, intervalMs },
    "Settlement engine started",
  );

  let sweeping = false;
  const sweep = async () => {
    if (sweeping) return;
    sweeping = true;
    try {
      // LOCKED = purchase made / offer accepted, escrow potentially in flight.
      const listings = (await prisma.listing.findMany({
        where: { status: "LOCKED" },
        select: { id: true, trackingNumber: true, disputeStatus: true },
        orderBy: { updatedAt: "asc" },
        take: SWEEP_BATCH,
      })) as InFlightListing[];
      if (listings.length === 0) return;

      const now = Math.floor(Date.now() / 1000);
      for (const listing of listings) {
        try {
          if (isV2) {
            await settleV2(listing, now);
          } else {
            await settleV1(listing, now);
          }
        } catch (err) {
          log.warn({ err, listingId: listing.id }, "Settlement sweep failed for listing");
        }
      }
    } catch (err) {
      log.warn({ err }, "Settlement sweep failed");
    } finally {
      sweeping = false;
    }
  };

  /** Mark the listing settled in the DB once the escrow reaches a final state. */
  const finalizeListing = async (listingId: string, released: boolean, buyer?: string) => {
    await prisma.listing.updateMany({
      where: { id: listingId },
      data: {
        status: released ? "SOLD" : "REFUNDED",
        exchangeConfirmedAt: new Date(),
        ...(buyer && buyer !== ethers.ZeroAddress ? { buyer: buyer.toLowerCase() } : {}),
      } as any,
    });
    // Close any open dispute — the escrow is settled either way.
    await prisma.listing.updateMany({
      where: { id: listingId, disputeStatus: "OPEN" },
      data: { disputeStatus: "RESOLVED" } as any,
    });
    log.info({ listingId, outcome: released ? "released" : "refunded" }, "Escrow settled");
  };

  const settleV1 = async (listing: InFlightListing, now: number) => {
    const idBytes = listingIdToBytes32(listing.id);
    const e = await escrow.escrows(idBytes);
    const [buyer, , , , timeoutAt, stateNum] = e;
    if (!buyer || buyer === ethers.ZeroAddress) return; // no escrow (direct sale)
    const state = Number(stateNum);
    if (state === 2) {
      // COMPLETE on-chain but DB still LOCKED — reconcile. v1 ends both the
      // refund and release paths at COMPLETE, so treat it as released.
      await finalizeListing(listing.id, true, buyer);
      return;
    }
    // Don't auto-settle a listing that support is actively reviewing.
    if (listing.disputeStatus === "OPEN") return;
    if (now < Number(timeoutAt)) return;

    // Pre-tx state decides the outcome: AWAITING_SHIPMENT → refund,
    // AWAITING_CONFIRMATION → release (both end at COMPLETE on-chain).
    const willRelease = state !== AWAITING_SHIPMENT;
    const tx = await escrow.resolveTimeout(idBytes);
    await tx.wait();
    await finalizeListing(listing.id, willRelease, buyer);
  };

  const settleV2 = async (listing: InFlightListing, now: number) => {
    const idBytes = listingIdToBytes32(listing.id);
    const e = await escrow.escrows(idBytes);
    const [buyer, , , createdAt, shipDeadline, shippedAt, stateNum, disputed] = e;
    if (!buyer || buyer === ethers.ZeroAddress) return; // no escrow (direct sale)
    const state = Number(stateNum);

    if (state === 2 || state === 3) {
      // Finalized on-chain (buyer confirmReceipt, another keeper, …) but the
      // DB still shows LOCKED — reconcile.
      await finalizeListing(listing.id, state === 2, buyer);
      return;
    }

    // Mirror the DB dispute flag on-chain so the timeout rails freeze while
    // support reviews and unfreeze once the dispute is closed.
    const dbDisputed = listing.disputeStatus === "OPEN";
    if (dbDisputed !== Boolean(disputed)) {
      const tx = await escrow.setDisputed(idBytes, dbDisputed);
      await tx.wait();
      log.info({ listingId: listing.id, disputed: dbDisputed }, "Escrow dispute flag synced");
    }

    // Seller saved a tracking number → record shipment on-chain (arbiter
    // signs; the seller never sends a transaction).
    if (state === AWAITING_SHIPMENT && listing.trackingNumber && !dbDisputed) {
      const tx = await escrow.markShipped(idBytes);
      await tx.wait();
      log.info(
        { listingId: listing.id, tracking: listing.trackingNumber },
        "Escrow marked shipped from tracking number",
      );
      return; // fresh state next sweep
    }

    // Contract timeout rails: no-ship refund, post-shipment auto-release,
    // disputed hard-timeout refund. resolveTimeout picks the branch on-chain;
    // we just precompute whether it is due and what the outcome will be.
    let due = false;
    let willRelease = false;
    if (dbDisputed || disputed) {
      const hardTimeout = Number(await escrow.disputedHardTimeout());
      due = now >= Number(createdAt) + hardTimeout;
      willRelease = false;
    } else if (state === AWAITING_SHIPMENT) {
      due = now >= Number(shipDeadline);
      willRelease = false;
    } else {
      const autoRelease = Number(await escrow.autoReleaseWindow());
      due = now >= Number(shippedAt) + autoRelease;
      willRelease = true;
    }
    if (!due) return;

    const tx = await escrow.resolveTimeout(idBytes);
    await tx.wait();
    await finalizeListing(listing.id, willRelease, buyer);
  };

  void sweep();
  setInterval(() => void sweep(), intervalMs);
}
