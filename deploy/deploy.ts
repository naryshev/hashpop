import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  const platformFeeBps = Number(process.env.PLATFORM_FEE_BPS || "300");
  if (!Number.isInteger(platformFeeBps) || platformFeeBps < 0 || platformFeeBps > 1000) {
    throw new Error("PLATFORM_FEE_BPS must be an integer between 0 and 1000");
  }
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Platform fee (bps):", platformFeeBps);

  // Deploy Escrow
  const Escrow = await ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy();
  console.log("Escrow deployed to:", await escrow.getAddress());

  // Deploy Treasury
  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy();
  console.log("Treasury deployed to:", await treasury.getAddress());

  // Deploy Reputation
  const Reputation = await ethers.getContractFactory("Reputation");
  const reputation = await Reputation.deploy();
  console.log("Reputation deployed to:", await reputation.getAddress());

  // Deploy Marketplace
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(
    await escrow.getAddress(),
    await treasury.getAddress(),
    await reputation.getAddress(),
    platformFeeBps
  );
  console.log("Marketplace deployed to:", await marketplace.getAddress());

  // Deploy AuctionHouse
  const AuctionHouse = await ethers.getContractFactory("AuctionHouse");
  const auctionHouse = await AuctionHouse.deploy(
    await escrow.getAddress(),
    await treasury.getAddress(),
    platformFeeBps
  );
  console.log("AuctionHouse deployed to:", await auctionHouse.getAddress());

  // Grant Escrow MARKETPLACE_ROLE to both Marketplace and AuctionHouse (deployer has admin on Escrow)
  console.log("\nAuthorizing contracts...");
  await escrow.setMarketplace(await marketplace.getAddress());
  await escrow.setMarketplace(await auctionHouse.getAddress());
  console.log("Authorization complete");

  console.log("\n=== Deployment Summary ===");
  console.log("Escrow:", await escrow.getAddress());
  console.log("Treasury:", await treasury.getAddress());
  console.log("Reputation:", await reputation.getAddress());
  console.log("Marketplace:", await marketplace.getAddress());
  console.log("AuctionHouse:", await auctionHouse.getAddress());
  console.log("\nAdd to backend .env: ESCROW_ADDRESS=" + (await escrow.getAddress()));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
