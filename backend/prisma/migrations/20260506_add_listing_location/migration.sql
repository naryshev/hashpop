-- AlterTable: add city + lat/lng to Listing for approximate location display
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "locationLat" DOUBLE PRECISION;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "locationLng" DOUBLE PRECISION;
