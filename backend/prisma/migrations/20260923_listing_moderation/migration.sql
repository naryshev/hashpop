-- Phase 2a trust queue. Kept off chain `status` so indexer upserts cannot unhide.
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "moderationStatus" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "moderationReason" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "moderationNote" TEXT;
CREATE INDEX IF NOT EXISTS "Listing_moderationStatus_idx" ON "Listing"("moderationStatus");
