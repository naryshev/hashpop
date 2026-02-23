require("dotenv/config");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const s3PublicUrl = (process.env.S3_PUBLIC_URL || "").replace(/\/$/, "");
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}
if (!s3PublicUrl) {
  throw new Error("S3_PUBLIC_URL is required.");
}

function rewriteUrl(url) {
  if (!url) return url;
  const m = String(url).match(/^https?:\/\/(?:localhost|127\.0\.0\.1):4000\/uploads\/([^?#]+)(?:[?#].*)?$/i);
  if (!m || !m[1]) return url;
  return `${s3PublicUrl}/uploads/${m[1]}`;
}

function rewriteUrls(urls) {
  if (!Array.isArray(urls)) return undefined;
  return urls.map((u) => rewriteUrl(u) || u);
}

async function main() {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });
  try {
    const [listings, auctions] = await Promise.all([
      prisma.listing.findMany({ select: { id: true, imageUrl: true, mediaUrls: true } }),
      prisma.auction.findMany({ select: { id: true, imageUrl: true, mediaUrls: true } }),
    ]);

    let listingUpdates = 0;
    for (const l of listings) {
      const imageUrl = rewriteUrl(l.imageUrl) || null;
      const mediaUrls = rewriteUrls(l.mediaUrls || []) || [];
      const changed =
        imageUrl !== (l.imageUrl || null) ||
        JSON.stringify(mediaUrls) !== JSON.stringify(l.mediaUrls || []);
      if (!changed) continue;
      await prisma.listing.update({
        where: { id: l.id },
        data: { imageUrl, mediaUrls },
      });
      listingUpdates += 1;
    }

    let auctionUpdates = 0;
    for (const a of auctions) {
      const imageUrl = rewriteUrl(a.imageUrl) || null;
      const mediaUrls = rewriteUrls(a.mediaUrls || []) || [];
      const changed =
        imageUrl !== (a.imageUrl || null) ||
        JSON.stringify(mediaUrls) !== JSON.stringify(a.mediaUrls || []);
      if (!changed) continue;
      await prisma.auction.update({
        where: { id: a.id },
        data: { imageUrl, mediaUrls },
      });
      auctionUpdates += 1;
    }

    console.log(JSON.stringify({ ok: true, listingUpdates, auctionUpdates }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
