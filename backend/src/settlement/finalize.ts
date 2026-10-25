import { ethers } from "ethers";
import type { PrismaClient } from "../generated/prisma/client";

/**
 * Move a listing out of LOCKED only. A second sweep, or a row the indexer
 * already finalized, updates zero rows and does not log.
 */
export async function finalizeLockedListing(
  prisma: PrismaClient,
  log: { info: (obj: object, msg: string) => void },
  listingId: string,
  released: boolean,
  buyer?: string,
): Promise<number> {
  const updated = await prisma.listing.updateMany({
    where: { id: listingId, status: "LOCKED" },
    data: {
      status: released ? "SOLD" : "REFUNDED",
      exchangeConfirmedAt: new Date(),
      ...(buyer && buyer !== ethers.ZeroAddress ? { buyer: buyer.toLowerCase() } : {}),
    },
  });
  if (updated.count === 0) return 0;
  await prisma.listing.updateMany({
    where: { id: listingId, disputeStatus: "OPEN" },
    data: { disputeStatus: "RESOLVED" },
  });
  log.info({ listingId, outcome: released ? "released" : "refunded" }, "Escrow settled");
  return updated.count;
}
