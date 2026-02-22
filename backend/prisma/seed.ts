import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL || "postgres://hedera:hedera@localhost:5432/marketplace";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

/**
 * Seed = wipe marketplace only. Add listings manually or extend this script to create data.
 */
async function main() {
  await prisma.sale.deleteMany({});
  await prisma.bid.deleteMany({});
  await prisma.wishlistItem.deleteMany({});
  await prisma.listing.deleteMany({});
  await prisma.auction.deleteMany({});
  console.log("Marketplace wiped (listings, auctions, bids, sales, wishlist). Add listings manually.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
