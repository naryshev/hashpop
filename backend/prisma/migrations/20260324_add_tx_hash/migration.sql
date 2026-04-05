-- AlterTable: add txHash to Listing
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "txHash" TEXT;

-- AlterTable: add txHash to Sale
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "txHash" TEXT;
