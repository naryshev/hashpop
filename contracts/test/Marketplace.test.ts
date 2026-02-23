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
    await escrow.waitForDeployment();

    const TreasuryFactory = await ethers.getContractFactory("Treasury");
    treasury = await TreasuryFactory.deploy();
    await treasury.waitForDeployment();

    const ReputationFactory = await ethers.getContractFactory("Reputation");
    reputation = await ReputationFactory.deploy();
    await reputation.waitForDeployment();

    const MarketplaceFactory = await ethers.getContractFactory("Marketplace");
    marketplace = await MarketplaceFactory.deploy(
      await escrow.getAddress(),
      await treasury.getAddress(),
      await reputation.getAddress(),
      300 // 3% fee for other flows; direct non-escrow uses fixed 2%
    );
    await marketplace.waitForDeployment();
    await escrow.setMarketplace(await marketplace.getAddress());
  });

  it("Should create a listing", async function () {
    const listingId = ethers.encodeBytes32String("LIST1");
    const price = ethers.parseEther("1.0");

    await expect(marketplace.connect(seller).createListing(listingId, price, true))
      .to.emit(marketplace, "ItemListed")
      .withArgs(listingId, seller.address, price);
  });

  it("Should allow buy now", async function () {
    const listingId = ethers.encodeBytes32String("LIST1");
    const price = ethers.parseEther("1.0");

    await marketplace.connect(seller).createListing(listingId, price, true);
    await expect(
      marketplace.connect(buyer).buyNow(listingId, { value: price })
    )
      .to.emit(marketplace, "ItemPurchased")
      .withArgs(listingId, buyer.address, seller.address, price);
  });

  it("Should settle immediately without escrow and take 2% fee", async function () {
    const listingId = ethers.encodeBytes32String("LIST_DIRECT");
    const price = ethers.parseEther("1.0");
    const fee = (price * 200n) / 10000n;
    const sellerAmount = price - fee;

    await marketplace.connect(seller).createListing(listingId, price, false);
    const sellerBefore = await ethers.provider.getBalance(seller.address);
    const treasuryBefore = await ethers.provider.getBalance(await treasury.getAddress());

    await expect(marketplace.connect(buyer).buyNow(listingId, { value: price }))
      .to.emit(marketplace, "ItemPurchased")
      .withArgs(listingId, buyer.address, seller.address, price);

    const listing = await marketplace.listings(listingId);
    expect(Number(listing.status)).to.equal(3); // COMPLETED
    expect(await ethers.provider.getBalance(await treasury.getAddress())).to.equal(treasuryBefore + fee);
    expect(await ethers.provider.getBalance(seller.address)).to.equal(sellerBefore + sellerAmount);
  });

  it("Should update listing price and emit PriceUpdated", async function () {
    const listingId = ethers.encodeBytes32String("LIST2");
    const initialPrice = ethers.parseEther("1.0");
    const newPrice = ethers.parseEther("1.5");

    await marketplace.connect(seller).createListing(listingId, initialPrice, true);
    await expect(marketplace.connect(seller).updateListingPrice(listingId, newPrice))
      .to.emit(marketplace, "PriceUpdated")
      .withArgs(listingId, newPrice);

    const listing = await marketplace.listings(listingId);
    expect(listing.price).to.equal(newPrice);
  });

  it("Should reject listing price update from non-seller", async function () {
    const listingId = ethers.encodeBytes32String("LIST3");
    const initialPrice = ethers.parseEther("1.0");
    const newPrice = ethers.parseEther("2.0");

    await marketplace.connect(seller).createListing(listingId, initialPrice, true);
    await expect(
      marketplace.connect(buyer).updateListingPrice(listingId, newPrice)
    ).to.be.revertedWith("Not seller");
  });

  it("Should reject buy with stale price after seller price update", async function () {
    const listingId = ethers.encodeBytes32String("LIST4");
    const initialPrice = ethers.parseEther("1.0");
    const newPrice = ethers.parseEther("1.4");

    await marketplace.connect(seller).createListing(listingId, initialPrice, true);
    await marketplace.connect(seller).updateListingPrice(listingId, newPrice);

    await expect(
      marketplace.connect(buyer).buyNow(listingId, { value: initialPrice })
    ).to.be.revertedWith("Price mismatch");
  });

  it("Should reject duplicate buy attempts once listing is locked", async function () {
    const listingId = ethers.encodeBytes32String("LIST5");
    const price = ethers.parseEther("1.0");
    const secondBuyer = owner;

    await marketplace.connect(seller).createListing(listingId, price, true);
    await marketplace.connect(buyer).buyNow(listingId, { value: price });

    await expect(
      marketplace.connect(secondBuyer).buyNow(listingId, { value: price })
    ).to.be.revertedWith("Not listed");
  });

  it("Should keep listing LISTED when escrow creation reverts", async function () {
    const listingId = ethers.encodeBytes32String("LIST6");
    const price = ethers.parseEther("1.0");

    const marketplaceRole = await escrow.MARKETPLACE_ROLE();
    await escrow.revokeRole(marketplaceRole, await marketplace.getAddress());
    await marketplace.connect(seller).createListing(listingId, price, true);

    await expect(
      marketplace.connect(buyer).buyNow(listingId, { value: price })
    ).to.be.reverted;

    const listing = await marketplace.listings(listingId);
    expect(Number(listing.status)).to.equal(1); // LISTED
    expect(listing.escrowId).to.equal(ethers.ZeroHash);
  });

  it("Should create and cancel an offer with refund", async function () {
    const listingId = ethers.encodeBytes32String("LIST7");
    const price = ethers.parseEther("1.0");
    const offerAmount = ethers.parseEther("0.8");

    await marketplace.connect(seller).createListing(listingId, price, true);
    await expect(marketplace.connect(buyer).makeOffer(listingId, { value: offerAmount }))
      .to.emit(marketplace, "OfferMade")
      .withArgs(listingId, buyer.address, offerAmount);

    await expect(marketplace.connect(buyer).cancelOffer(listingId))
      .to.emit(marketplace, "OfferCancelled")
      .withArgs(listingId, buyer.address, offerAmount);
  });

  it("Should allow seller to accept active offer and lock listing", async function () {
    const listingId = ethers.encodeBytes32String("LIST8");
    const price = ethers.parseEther("1.0");
    const offerAmount = ethers.parseEther("0.75");

    await marketplace.connect(seller).createListing(listingId, price, true);
    await marketplace.connect(buyer).makeOffer(listingId, { value: offerAmount });

    await expect(marketplace.connect(seller).acceptOffer(listingId, buyer.address))
      .to.emit(marketplace, "OfferAccepted")
      .withArgs(listingId, buyer.address, offerAmount);

    const listing = await marketplace.listings(listingId);
    expect(Number(listing.status)).to.equal(2); // LOCKED
  });

  it("Should allow seller to reject active offer", async function () {
    const listingId = ethers.encodeBytes32String("LIST9");
    const price = ethers.parseEther("1.0");
    const offerAmount = ethers.parseEther("0.7");

    await marketplace.connect(seller).createListing(listingId, price, true);
    await marketplace.connect(buyer).makeOffer(listingId, { value: offerAmount });

    await expect(marketplace.connect(seller).rejectOffer(listingId, buyer.address))
      .to.emit(marketplace, "OfferRejected")
      .withArgs(listingId, buyer.address, offerAmount);
  });

  it("Should reject offer accept from non-seller", async function () {
    const listingId = ethers.encodeBytes32String("LIST10");
    const price = ethers.parseEther("1.0");
    const offerAmount = ethers.parseEther("0.6");

    await marketplace.connect(seller).createListing(listingId, price, true);
    await marketplace.connect(buyer).makeOffer(listingId, { value: offerAmount });

    await expect(
      marketplace.connect(owner).acceptOffer(listingId, buyer.address)
    ).to.be.revertedWith("Not seller");
  });

  it("Should mark listing COMPLETED when escrow completes", async function () {
    const listingId = ethers.encodeBytes32String("LIST11");
    const price = ethers.parseEther("1.0");

    await marketplace.connect(seller).createListing(listingId, price, true);
    await marketplace.connect(buyer).buyNow(listingId, { value: price });
    await escrow.connect(seller).confirmShipment(listingId);
    await escrow.connect(buyer).confirmReceipt(listingId);

    const listing = await marketplace.listings(listingId);
    expect(Number(listing.status)).to.equal(3); // COMPLETED
  });
});
