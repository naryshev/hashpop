-- CreateTable
CREATE TABLE IF NOT EXISTS "Listing" (
    "id" TEXT NOT NULL,
    "seller" TEXT NOT NULL,
    "buyer" TEXT,
    "price" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requireEscrow" BOOLEAN NOT NULL DEFAULT false,
    "trackingNumber" TEXT,
    "trackingCarrier" TEXT,
    "shippedAt" TIMESTAMP(3),
    "exchangeConfirmedAt" TIMESTAMP(3),
    "title" TEXT,
    "subtitle" TEXT,
    "description" TEXT,
    "category" TEXT,
    "condition" TEXT,
    "yearOfProduction" TEXT,
    "originalBox" TEXT,
    "originalPapers" TEXT,
    "imageUrl" TEXT,
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Auction" (
    "id" TEXT NOT NULL,
    "seller" TEXT NOT NULL,
    "reservePrice" TEXT NOT NULL,
    "startTime" BIGINT NOT NULL,
    "endTime" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "condition" TEXT,
    "yearOfProduction" TEXT,
    "originalBox" TEXT,
    "originalPapers" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Bid" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "bidder" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Sale" (
    "id" TEXT NOT NULL,
    "listingId" TEXT,
    "auctionId" TEXT,
    "buyer" TEXT NOT NULL,
    "seller" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "totalSales" INTEGER NOT NULL DEFAULT 0,
    "successfulCompletions" INTEGER NOT NULL DEFAULT 0,
    "refunds" INTEGER NOT NULL DEFAULT 0,
    "timeouts" INTEGER NOT NULL DEFAULT 0,
    "reputationScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Rating" (
    "id" TEXT NOT NULL,
    "reviewerAddress" TEXT NOT NULL,
    "ratedAddress" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "listingId" TEXT,
    "auctionId" TEXT,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "listingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WishlistItem" (
    "id" TEXT NOT NULL,
    "userAddress" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Rating_ratedAddress_idx" ON "Rating"("ratedAddress");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Rating_reviewerAddress_idx" ON "Rating"("reviewerAddress");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Rating_reviewerAddress_saleId_key" ON "Rating"("reviewerAddress", "saleId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_address_key" ON "User"("address");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WishlistItem_userAddress_itemId_key" ON "WishlistItem"("userAddress", "itemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WishlistItem_userAddress_idx" ON "WishlistItem"("userAddress");

-- AddForeignKey (idempotent with DO NOTHING approach)
DO $$ BEGIN
    ALTER TABLE "Bid" ADD CONSTRAINT "Bid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Sale" ADD CONSTRAINT "Sale_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Sale" ADD CONSTRAINT "Sale_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
