/**
 * Run this if deploy:testnet hit 502 during "Authorizing contracts..."
 * Uses ESCROW_ADDRESS, MARKETPLACE_ADDRESS, AUCTION_HOUSE_ADDRESS from .env or pass as env.
 */
import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const escrowAddr = process.env.ESCROW_ADDRESS || "0x55CF5adb83667Ced186aadfEA6b110F5de34276b";
  const marketplaceAddr = process.env.MARKETPLACE_ADDRESS || "0x36154aD65eA94f6A7C2E3F9347f665917c2D49B0";
  const auctionHouseAddr = process.env.AUCTION_HOUSE_ADDRESS || "0x28D7Ef2D060e0708fBa0313652a54D9Df3c25Be6";

  const escrow = await ethers.getContractAt("Escrow", escrowAddr);
  console.log("Granting Escrow MARKETPLACE_ROLE to Marketplace and AuctionHouse...");
  const tx1 = await escrow.setMarketplace(marketplaceAddr);
  await tx1.wait();
  console.log("Marketplace authorized.");
  const tx2 = await escrow.setMarketplace(auctionHouseAddr);
  await tx2.wait();
  console.log("AuctionHouse authorized. Done.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
