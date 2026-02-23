import { run } from "hardhat";

async function main() {
  const addresses = {
    escrow: process.env.ESCROW_ADDRESS || "",
    treasury: process.env.TREASURY_ADDRESS || "",
    reputation: process.env.REPUTATION_ADDRESS || "",
    marketplace: process.env.MARKETPLACE_ADDRESS || "",
    auctionHouse: process.env.AUCTION_HOUSE_ADDRESS || "",
  };

  console.log("Verifying contracts...");

  // Verify each contract
  for (const [name, address] of Object.entries(addresses)) {
    if (!address) {
      console.log(`Skipping ${name} - no address provided`);
      continue;
    }

    try {
      await run("verify:verify", {
        address: address,
        constructorArguments: [],
      });
      console.log(`✓ ${name} verified`);
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log(`✓ ${name} already verified`);
      } else {
        console.error(`✗ ${name} verification failed:`, error.message);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
