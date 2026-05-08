-- CreateTable: Offer mirrors Marketplace contract's per-listing offers so the
-- seller's UI can display pending offers without waiting for the indexer.
CREATE TABLE IF NOT EXISTS "Offer" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyer" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Offer_listingId_buyer_key" ON "Offer"("listingId", "buyer");
CREATE INDEX IF NOT EXISTS "Offer_listingId_status_idx" ON "Offer"("listingId", "status");
CREATE INDEX IF NOT EXISTS "Offer_buyer_idx" ON "Offer"("buyer");
