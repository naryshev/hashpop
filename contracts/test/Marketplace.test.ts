import { expect } from "chai";
import { ethers } from "hardhat";
import { Marketplace, Escrow, Treasury, Reputation } from "../typechain-types";

describe("Marketplace", function () {
  let marketplace: Marketplace;
  let escrow: Escrow;
  let treasury: Treasury;
  let reputation: Reputation;
  let owner: any;
  let seller: any;
  let buyer: any;

  beforeEach(async function () {
    [owner, seller, buyer] = await ethers.getSigners();

    const EscrowFactory = await ethers.getContractFactory("Escrow");
    escrow = await EscrowFactory.deploy();
    await escrow.deployed();

    const TreasuryFactory = await ethers.getContractFactory("Treasury");
    treasury = await TreasuryFactory.deploy();
    await treasury.deployed();

    const ReputationFactory = await ethers.getContractFactory("Reputation");
    reputation = await ReputationFactory.deploy();
    await reputation.deployed();

    const MarketplaceFactory = await ethers.getContractFactory("Marketplace");
    marketplace = await MarketplaceFactory.deploy(
      escrow.address,
      treasury.address,
      reputation.address,
      300 // 3% fee
    );
    await marketplace.deployed();
  });

  it("Should create a listing", async function () {
    const listingId = ethers.utils.formatBytes32String("LIST1");
    const price = ethers.utils.parseEther("1.0");

    await expect(marketplace.connect(seller).createListing(listingId, price))
      .to.emit(marketplace, "ItemListed")
      .withArgs(listingId, seller.address, price);
  });

  it("Should allow buy now", async function () {
    const listingId = ethers.utils.formatBytes32String("LIST1");
    const price = ethers.utils.parseEther("1.0");

    await marketplace.connect(seller).createListing(listingId, price);
    await expect(
      marketplace.connect(buyer).buyNow(listingId, { value: price })
    )
      .to.emit(marketplace, "ItemPurchased")
      .withArgs(listingId, buyer.address, seller.address, price);
  });
});
