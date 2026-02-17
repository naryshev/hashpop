import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function stringToBytes32Hex(s: string): string {
  const hex = Buffer.from(s, "utf8").toString("hex");
  return "0x" + hex.padEnd(64, "0");
}

async function main() {
  const seller = "0xf765d0042429cbcda59fb0b3c31b64bf7a551b65";

  const listings = [
    { id: stringToBytes32Hex("SAMPLE1"), price: "1.5", title: "Sample Listing 1" },
    { id: stringToBytes32Hex("SAMPLE2"), price: "2.0", title: "Sample Listing 2" },
    { id: stringToBytes32Hex("SAMPLE3"), price: "0.5", title: "Sample Listing 3" },
  ];

  for (const { id, price, title: _ } of listings) {
    await prisma.listing.upsert({
      where: { id },
      create: { id, seller, price, status: "LISTED" },
      update: { seller, price, status: "LISTED" },
    });
  }

  console.log("Seeded", listings.length, "test listings.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
