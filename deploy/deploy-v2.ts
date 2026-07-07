/**
 * Deploys the EscrowV2 stack: EscrowV2 + a paired Marketplace/AuctionHouse
 * (the Marketplace pins its escrow at construction, so upgrading escrow means
 * redeploying both). Reuses existing Treasury/Reputation when their addresses
 * are provided via env, otherwise deploys fresh ones.
 *
 * All transactions carry explicit gas overrides: Hashio's mainnet relay
 * rejects eth_estimateGas with INSUFFICIENT_TX_FEE, so estimation is skipped
 * entirely (this is how the 2026-07 mainnet deployment ran).
 *
 * Env:
 *   PLATFORM_FEE_BPS   platform fee in bps (default 300)
 *   TREASURY_ADDRESS   reuse an existing Treasury (optional)
 *   REPUTATION_ADDRESS reuse an existing Reputation (optional)
 *   ARBITER_ADDRESS    settlement engine key to grant ARBITER_ROLE (optional)
 *   HEDERA_GAS_PRICE   gas price in wei (default 1300 gwei; check with
 *                      eth_gasPrice against the relay before deploying)
 */
import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const GAS_PRICE = Number(process.env.HEDERA_GAS_PRICE || 1300000000000);
// Largest deploy (Marketplace) measures ~2.2M gas; 2.8M gives ~27% headroom.
const DEPLOY_OV = { gasLimit: 2800000, gasPrice: GAS_PRICE };
const CALL_OV = { gasLimit: 200000, gasPrice: GAS_PRICE };

async function main() {
  const [deployer] = await ethers.getSigners();
  const platformFeeBps = Number(process.env.PLATFORM_FEE_BPS || "300");
  if (!Number.isInteger(platformFeeBps) || platformFeeBps < 0 || platformFeeBps > 1000) {
    throw new Error("PLATFORM_FEE_BPS must be an integer between 0 and 1000");
  }
  console.log("Deploying EscrowV2 stack with account:", deployer.address);
  console.log("Platform fee (bps):", platformFeeBps, "| gas price:", GAS_PRICE);

  const EscrowV2 = await ethers.getContractFactory("EscrowV2");
  const escrow = await EscrowV2.deploy(DEPLOY_OV);
  await escrow.waitForDeployment();
  console.log("EscrowV2 deployed to:", await escrow.getAddress());

  let treasuryAddr = process.env.TREASURY_ADDRESS;
  if (!treasuryAddr) {
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(DEPLOY_OV);
    await treasury.waitForDeployment();
    treasuryAddr = await treasury.getAddress();
    console.log("Treasury deployed to:", treasuryAddr);
  } else {
    console.log("Reusing Treasury:", treasuryAddr);
  }

  let reputationAddr = process.env.REPUTATION_ADDRESS;
  if (!reputationAddr) {
    const Reputation = await ethers.getContractFactory("Reputation");
    const reputation = await Reputation.deploy(DEPLOY_OV);
    await reputation.waitForDeployment();
    reputationAddr = await reputation.getAddress();
    console.log("Reputation deployed to:", reputationAddr);
  } else {
    console.log("Reusing Reputation:", reputationAddr);
  }

  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(
    await escrow.getAddress(),
    treasuryAddr,
    reputationAddr,
    platformFeeBps,
    DEPLOY_OV,
  );
  await marketplace.waitForDeployment();
  console.log("Marketplace deployed to:", await marketplace.getAddress());

  const AuctionHouse = await ethers.getContractFactory("AuctionHouse");
  const auctionHouse = await AuctionHouse.deploy(
    await escrow.getAddress(),
    treasuryAddr,
    platformFeeBps,
    DEPLOY_OV,
  );
  await auctionHouse.waitForDeployment();
  console.log("AuctionHouse deployed to:", await auctionHouse.getAddress());

  console.log("\nAuthorizing contracts...");
  // First setMarketplace call also records the completion callback.
  await (await escrow.setMarketplace(await marketplace.getAddress(), CALL_OV)).wait();
  await (await escrow.setMarketplace(await auctionHouse.getAddress(), CALL_OV)).wait();
  console.log("Marketplace + AuctionHouse authorized on EscrowV2");

  const arbiterAddr = process.env.ARBITER_ADDRESS;
  if (arbiterAddr) {
    await (await escrow.setArbiter(arbiterAddr, true, CALL_OV)).wait();
    console.log("Arbiter authorized:", arbiterAddr);
  } else {
    console.log("No ARBITER_ADDRESS set — grant later with escrow.setArbiter(addr, true)");
  }

  console.log("\n=== Deployment Summary ===");
  console.log("EscrowV2:", await escrow.getAddress());
  console.log("Treasury:", treasuryAddr);
  console.log("Reputation:", reputationAddr);
  console.log("Marketplace:", await marketplace.getAddress());
  console.log("AuctionHouse:", await auctionHouse.getAddress());
  console.log("\nBackend env:");
  console.log("  ESCROW_ADDRESS=" + (await escrow.getAddress()));
  console.log("  MARKETPLACE_ADDRESS=" + (await marketplace.getAddress()));
  console.log("  AUCTION_HOUSE_ADDRESS=" + (await auctionHouse.getAddress()));
  console.log("  ESCROW_V2=true");
  console.log("  ESCROW_ARBITER_KEY=<arbiter private key>");
  console.log("Frontend env: NEXT_PUBLIC_ESCROW_V2=true");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
