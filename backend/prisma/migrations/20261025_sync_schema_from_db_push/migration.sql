-- Columns and indexes that schema.prisma already had, and that `prisma db push`
-- was creating on boot, with no migration of their own.
--
-- Generated from:
--   prisma migrate diff --from-schema <schema of the five historical migrations>
--   --to-schema prisma/schema.prisma --script
--
-- Statements are idempotent. Production was synced with `db push`, so these
-- objects already exist. After the P3005 baseline, `migrate deploy` runs this
-- file; a plain ADD COLUMN would fail and the updatedAt backfill after it
-- would not run.
--
-- This migration is not in the startup baseline list. It is applied, not
-- marked applied.

ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "disputeOpenedAt" TIMESTAMP(3);
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "disputeOpenedBy" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "disputeReason" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "disputeStatus" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "onChainConfirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "variants" JSONB;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "kycAddressLine1" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "kycAddressLine2" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "kycCity" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "kycCountry" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "kycDateOfBirth" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "kycIdNumber" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "kycIdType" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "kycLegalName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "kycPostalCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "kycRegion" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "kycStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "kycSubmittedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "publicKey" TEXT;

ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "encrypted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "nonce" TEXT;

CREATE TABLE IF NOT EXISTS "ShippingAddress" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyer" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingAddress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ShippingAddress_listingId_idx" ON "ShippingAddress"("listingId");
CREATE UNIQUE INDEX IF NOT EXISTS "ShippingAddress_listingId_buyer_key" ON "ShippingAddress"("listingId", "buyer");
CREATE INDEX IF NOT EXISTS "Sale_listingId_idx" ON "Sale"("listingId");
CREATE INDEX IF NOT EXISTS "Sale_buyer_idx" ON "Sale"("buyer");
