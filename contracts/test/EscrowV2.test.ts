import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { EscrowV2 } from "../typechain-types";

describe("EscrowV2", function () {
  let escrow: EscrowV2;
  let owner: any; // also granted MARKETPLACE_ROLE for direct createEscrow calls
  let arbiter: any;
  let seller: any;
  let buyer: any;
  let rando: any;

  const AMOUNT = ethers.parseEther("1.0");
  const DAY = 24 * 60 * 60;

  const lid = (s: string) => ethers.encodeBytes32String(s);

  async function createEscrow(id = "L1") {
    await escrow.createEscrow(lid(id), buyer.address, seller.address, AMOUNT, {
      value: AMOUNT,
    });
    return lid(id);
  }

  beforeEach(async function () {
    [owner, arbiter, seller, buyer, rando] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("EscrowV2");
    escrow = await Factory.deploy();
    await escrow.waitForDeployment();
    // Grant the test runner marketplace rights so we can create escrows directly.
    await escrow.setMarketplace(owner.address);
    await escrow.setArbiter(arbiter.address, true);
  });

  describe("createEscrow", function () {
    it("creates with correct state and deadlines", async function () {
      const id = await createEscrow();
      const e = await escrow.escrows(id);
      expect(e.buyer).to.equal(buyer.address);
      expect(e.seller).to.equal(seller.address);
      expect(e.amount).to.equal(AMOUNT);
      expect(e.state).to.equal(0); // AWAITING_SHIPMENT
      expect(e.disputed).to.equal(false);
      expect(e.shipDeadline - e.createdAt).to.equal(BigInt(7 * DAY));
    });

    it("rejects non-marketplace callers", async function () {
      await expect(
        escrow
          .connect(rando)
          .createEscrow(lid("X"), buyer.address, seller.address, AMOUNT, { value: AMOUNT }),
      ).to.be.reverted;
    });

    it("rejects value mismatch, duplicates and buyer==seller", async function () {
      await expect(
        escrow.createEscrow(lid("X"), buyer.address, seller.address, AMOUNT, {
          value: AMOUNT / 2n,
        }),
      ).to.be.revertedWith("Value mismatch");

      await createEscrow("DUP");
      await expect(
        escrow.createEscrow(lid("DUP"), buyer.address, seller.address, AMOUNT, {
          value: AMOUNT,
        }),
      ).to.be.revertedWith("Escrow exists");

      await expect(
        escrow.createEscrow(lid("SAME"), buyer.address, buyer.address, AMOUNT, {
          value: AMOUNT,
        }),
      ).to.be.revertedWith("Buyer is seller");
    });

    it("rejects while paused", async function () {
      await escrow.pause();
      await expect(
        escrow.createEscrow(lid("P"), buyer.address, seller.address, AMOUNT, { value: AMOUNT }),
      ).to.be.reverted;
    });
  });

  describe("markShipped", function () {
    it("seller can mark shipped", async function () {
      const id = await createEscrow();
      await expect(escrow.connect(seller).markShipped(id))
        .to.emit(escrow, "EscrowShipped")
        .withArgs(id, seller.address);
      const e = await escrow.escrows(id);
      expect(e.state).to.equal(1); // SHIPPED
      expect(e.shippedAt).to.be.greaterThan(0);
    });

    it("arbiter can mark shipped (settlement engine path)", async function () {
      const id = await createEscrow();
      await expect(escrow.connect(arbiter).markShipped(id))
        .to.emit(escrow, "EscrowShipped")
        .withArgs(id, arbiter.address);
    });

    it("buyer / random cannot mark shipped; double-mark reverts", async function () {
      const id = await createEscrow();
      await expect(escrow.connect(buyer).markShipped(id)).to.be.revertedWith(
        "Not seller or arbiter",
      );
      await expect(escrow.connect(rando).markShipped(id)).to.be.revertedWith(
        "Not seller or arbiter",
      );
      await escrow.connect(seller).markShipped(id);
      await expect(escrow.connect(seller).markShipped(id)).to.be.revertedWith("Invalid state");
    });
  });

  describe("confirmReceipt (buyer early release)", function () {
    it("releases to seller from SHIPPED", async function () {
      const id = await createEscrow();
      await escrow.connect(seller).markShipped(id);
      await expect(escrow.connect(buyer).confirmReceipt(id)).to.changeEtherBalance(
        seller,
        AMOUNT,
      );
      expect((await escrow.escrows(id)).state).to.equal(2); // COMPLETE
    });

    it("releases from AWAITING_SHIPMENT too (local pickup, no tracking)", async function () {
      const id = await createEscrow();
      await expect(escrow.connect(buyer).confirmReceipt(id)).to.changeEtherBalance(
        seller,
        AMOUNT,
      );
    });

    it("only the buyer; never twice", async function () {
      const id = await createEscrow();
      await expect(escrow.connect(rando).confirmReceipt(id)).to.be.revertedWith("Not buyer");
      await escrow.connect(buyer).confirmReceipt(id);
      await expect(escrow.connect(buyer).confirmReceipt(id)).to.be.revertedWith("Invalid state");
    });
  });

  describe("arbiter release / refund", function () {
    it("arbiter releases to seller", async function () {
      const id = await createEscrow();
      await escrow.connect(arbiter).markShipped(id);
      await expect(escrow.connect(arbiter).release(id)).to.changeEtherBalance(seller, AMOUNT);
      expect((await escrow.escrows(id)).state).to.equal(2);
    });

    it("arbiter refunds buyer", async function () {
      const id = await createEscrow();
      await expect(escrow.connect(arbiter).refund(id)).to.changeEtherBalance(buyer, AMOUNT);
      expect((await escrow.escrows(id)).state).to.equal(3); // REFUNDED
    });

    it("non-arbiter cannot release or refund", async function () {
      const id = await createEscrow();
      await expect(escrow.connect(seller).release(id)).to.be.reverted;
      await expect(escrow.connect(buyer).refund(id)).to.be.reverted;
    });

    it("finalized escrows cannot be touched again", async function () {
      const id = await createEscrow();
      await escrow.connect(arbiter).refund(id);
      await expect(escrow.connect(arbiter).release(id)).to.be.revertedWith("Invalid state");
      await expect(escrow.connect(arbiter).refund(id)).to.be.revertedWith("Invalid state");
      await expect(escrow.connect(seller).markShipped(id)).to.be.revertedWith("Invalid state");
    });
  });

  describe("resolveTimeout (permissionless)", function () {
    it("refunds the buyer when never shipped past the deadline", async function () {
      const id = await createEscrow();
      await expect(escrow.connect(rando).resolveTimeout(id)).to.be.revertedWith("Not timed out");
      await time.increase(7 * DAY + 1);
      await expect(escrow.connect(rando).resolveTimeout(id)).to.changeEtherBalance(
        buyer,
        AMOUNT,
      );
      expect((await escrow.escrows(id)).state).to.equal(3); // REFUNDED
    });

    it("releases to the seller after the auto-release window post-shipment", async function () {
      const id = await createEscrow();
      await escrow.connect(seller).markShipped(id);
      await expect(escrow.connect(rando).resolveTimeout(id)).to.be.revertedWith("Not timed out");
      await time.increase(14 * DAY + 1);
      await expect(escrow.connect(rando).resolveTimeout(id)).to.changeEtherBalance(
        seller,
        AMOUNT,
      );
      expect((await escrow.escrows(id)).state).to.equal(2); // COMPLETE
    });

    it("shipping resets the clock — no buyer refund after ship deadline once shipped", async function () {
      const id = await createEscrow();
      await time.increase(6 * DAY);
      await escrow.connect(seller).markShipped(id);
      await time.increase(2 * DAY); // past original ship deadline, within auto-release window
      await expect(escrow.connect(rando).resolveTimeout(id)).to.be.revertedWith("Not timed out");
    });
  });

  describe("disputes", function () {
    it("freezes permissionless timeouts until resolved", async function () {
      const id = await createEscrow();
      await escrow.connect(arbiter).setDisputed(id, true);
      await time.increase(8 * DAY);
      await expect(escrow.connect(rando).resolveTimeout(id)).to.be.revertedWith(
        "Dispute pending",
      );
      // Arbiter resolves in the buyer's favor.
      await expect(escrow.connect(arbiter).refund(id)).to.changeEtherBalance(buyer, AMOUNT);
    });

    it("hard-timeout refunds the buyer if a dispute is never resolved", async function () {
      const id = await createEscrow();
      await escrow.connect(seller).markShipped(id);
      await escrow.connect(arbiter).setDisputed(id, true);
      await time.increase(90 * DAY + 1);
      await expect(escrow.connect(rando).resolveTimeout(id)).to.changeEtherBalance(
        buyer,
        AMOUNT,
      );
    });

    it("only the arbiter can set disputes; unfreezing restores timeouts", async function () {
      const id = await createEscrow();
      await expect(escrow.connect(buyer).setDisputed(id, true)).to.be.reverted;
      await escrow.connect(arbiter).setDisputed(id, true);
      await escrow.connect(arbiter).setDisputed(id, false);
      await time.increase(7 * DAY + 1);
      await expect(escrow.connect(rando).resolveTimeout(id)).to.changeEtherBalance(
        buyer,
        AMOUNT,
      );
    });

    it("buyer can still self-release while disputed", async function () {
      const id = await createEscrow();
      await escrow.connect(arbiter).setDisputed(id, true);
      await expect(escrow.connect(buyer).confirmReceipt(id)).to.changeEtherBalance(
        seller,
        AMOUNT,
      );
    });
  });

  describe("window configuration", function () {
    it("admin can tune windows within bounds", async function () {
      await escrow.setWindows(3 * DAY, 10 * DAY, 60 * DAY);
      expect(await escrow.shipWindow()).to.equal(3 * DAY);
      expect(await escrow.autoReleaseWindow()).to.equal(10 * DAY);
      expect(await escrow.disputedHardTimeout()).to.equal(60 * DAY);
    });

    it("rejects out-of-bounds windows and non-admin callers", async function () {
      await expect(escrow.setWindows(0, 10 * DAY, 60 * DAY)).to.be.revertedWith(
        "shipWindow out of bounds",
      );
      await expect(escrow.setWindows(3 * DAY, 1 * DAY, 60 * DAY)).to.be.revertedWith(
        "autoRelease out of bounds",
      );
      await expect(escrow.setWindows(3 * DAY, 10 * DAY, 10 * DAY)).to.be.revertedWith(
        "hardTimeout out of bounds",
      );
      await expect(escrow.connect(rando).setWindows(3 * DAY, 10 * DAY, 60 * DAY)).to.be
        .reverted;
    });
  });
});
