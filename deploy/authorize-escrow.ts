/**
 * Run this if deploy:testnet hit 502 during "Authorizing contracts..."
 * Uses ESCROW_ADDRESS and MARKETPLACE_ADDRESS from .env or pass as env.
 */
import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const escrowAddr = process.env.ESCROW_ADDRESS || "0x55CF5adb83667Ced186aadfEA6b110F5de34276b";
  const marketplaceAddr =
    process.env.MARKETPLACE_ADDRESS || "0x36154aD65eA94f6A7C2E3F9347f665917c2D49B0";

  const escrow = await ethers.getContractAt("Escrow", escrowAddr);
  console.log("Granting Escrow MARKETPLACE_ROLE to Marketplace...");
  const tx1 = await escrow.setMarketplace(marketplaceAddr);
  await tx1.wait();
  console.log("Marketplace authorized. Done.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
