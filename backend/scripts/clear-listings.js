/**
 * Wipe marketplace data in production/runtime environments.
 * Uses plain Node.js so it can run in Railway's container without ts-node.
 */
require("dotenv/config");
const path = require("path");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const connectionString =
  process.env.DATABASE_URL || "postgres://hedera:hedera@localhost:5432/marketplace";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const STATE_FILE = path.join(process.cwd(), ".indexer-state.json");

async function main() {
  const sales = await prisma.sale.deleteMany({});
  const bids = await prisma.bid.deleteMany({});
  const wishlist = await prisma.wishlistItem.deleteMany({});
  const listings = await prisma.listing.deleteMany({});
  const auctions = await prisma.auction.deleteMany({});

  console.log("Marketplace wiped:");
  console.log(
    `  ${listings.count} listing(s), ${auctions.count} auction(s), ${bids.count} bid(s), ${sales.count} sale(s), ${wishlist.count} wishlist item(s)`
  );

  const nowSec = Math.floor(Date.now() / 1000);
  const state = { lastProcessedTimestamp: nowSec, lastProcessedBlock: 999999999 };
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state), "utf8");
    console.log("Indexer state updated so backend won't re-add these listings from chain.");
  } catch (e) {
    console.warn("Could not write", STATE_FILE, "(backend may re-index after restart):", e);
  }

  console.log("Done. Add new listings manually or run db:seed to seed data.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
