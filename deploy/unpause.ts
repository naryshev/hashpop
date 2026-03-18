import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const marketplaceAddress = process.env.MARKETPLACE_ADDRESS;
  if (!marketplaceAddress) {
    throw new Error("MARKETPLACE_ADDRESS not set in .env");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  const marketplace = await ethers.getContractAt("Marketplace", marketplaceAddress, deployer);

  const paused = await (marketplace as any).paused();
  console.log("Contract paused:", paused);

  if (!paused) {
    console.log("Contract is not paused — nothing to do.");
    return;
  }

  console.log("Unpausing marketplace...");
  const tx = await (marketplace as any).unpause();
  await tx.wait();
  console.log("Done. Marketplace is unpaused. Tx:", tx.hash);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
