import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import type { Logger } from "pino";

const MARKETPLACE_ABI = [
  "function buyNowWithED25519(bytes32 listingId, address buyerAlias, uint256 price, uint256 deadline, bytes32 messageHash, bytes signature) external payable",
];
const ESCROW_ABI = [
  "function confirmReceiptWithED25519(bytes32 listingId, address buyerAlias, uint256 deadline, bytes32 messageHash, bytes signature) external",
];
const AUCTION_HOUSE_ABI = [
  "function placeBidWithED25519(bytes32 auctionId, address bidderAlias, uint256 bidAmount, uint256 deadline, bytes32 messageHash, bytes signature) external payable",
];

export function relayRouter(log: Logger): Router {
  const router = Router();
  const rpcUrl = process.env.HEDERA_RPC_URL || process.env.MARKETPLACE_RPC || "https://testnet.hashio.io/api";
  const marketplaceAddress = process.env.MARKETPLACE_ADDRESS;
  const escrowAddress = process.env.ESCROW_ADDRESS;
  const auctionHouseAddress = process.env.AUCTION_HOUSE_ADDRESS;
  const relayerKey = process.env.RELAYER_PRIVATE_KEY;

  if (!relayerKey) {
    log.warn("RELAYER_PRIVATE_KEY not set; ED25519 relay endpoints will return 503");
  }

  function getWallet(): ethers.Wallet | null {
    if (!relayerKey) return null;
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    return new ethers.Wallet(relayerKey, provider);
  }

  /**
   * POST /api/relay/buy
   * Body: { listingId: string (hex 0x...), buyerAlias: string (0x...), price: string (wei), deadline: number, messageHash: string (0x...), signature: string (0x...) }
   */
  router.post("/buy", async (req: Request, res: Response) => {
    const wallet = getWallet();
    if (!wallet || !marketplaceAddress) {
      return res.status(503).json({ error: "Relay not configured" });
    }
    try {
      const { listingId, buyerAlias, price, deadline, messageHash, signature } = req.body;
      if (!listingId || !buyerAlias || price == null || !deadline || !messageHash || !signature) {
        return res.status(400).json({ error: "Missing listingId, buyerAlias, price, deadline, messageHash, or signature" });
      }
      const contract = new ethers.Contract(marketplaceAddress, MARKETPLACE_ABI, wallet);
      const tx = await contract.buyNowWithED25519(
        listingId,
        buyerAlias,
        price,
        deadline,
        messageHash,
        signature,
        { value: price }
      );
      const receipt = await tx.wait();
      return res.json({ success: true, txHash: receipt.hash });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err }, "Relay buy failed");
      return res.status(500).json({ error: "Relay failed", details: message });
    }
  });

  /**
   * POST /api/relay/confirm-receipt
   * Body: { listingId, buyerAlias, deadline, messageHash, signature }
   */
  router.post("/confirm-receipt", async (req: Request, res: Response) => {
    const wallet = getWallet();
    if (!wallet || !escrowAddress) {
      return res.status(503).json({ error: "Relay not configured" });
    }
    try {
      const { listingId, buyerAlias, deadline, messageHash, signature } = req.body;
      if (!listingId || !buyerAlias || !deadline || !messageHash || !signature) {
        return res.status(400).json({ error: "Missing listingId, buyerAlias, deadline, messageHash, or signature" });
      }
      const contract = new ethers.Contract(escrowAddress, ESCROW_ABI, wallet);
      const tx = await contract.confirmReceiptWithED25519(listingId, buyerAlias, deadline, messageHash, signature);
      const receipt = await tx.wait();
      return res.json({ success: true, txHash: receipt.hash });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err }, "Relay confirm-receipt failed");
      return res.status(500).json({ error: "Relay failed", details: message });
    }
  });

  /**
   * GET /api/relay/account-alias?accountId=0.0.12345
   * Returns the EVM alias (0x...) for a Hedera account from the mirror node.
   */
  router.get("/account-alias", async (req: Request, res: Response) => {
    const accountId = req.query.accountId as string;
    if (!accountId || !/^0\.0\.\d+$/.test(accountId)) {
      return res.status(400).json({ error: "Invalid accountId; use format 0.0.XXXXX" });
    }
    const mirrorUrl = process.env.MIRROR_URL || "https://testnet.mirrornode.hedera.com";
    try {
      const r = await fetch(`${mirrorUrl}/api/v1/accounts/${accountId}`);
      if (!r.ok) return res.status(404).json({ error: "Account not found" });
      const data = await r.json();
      const alias = data.alias;
      if (!alias || typeof alias !== "string" || !alias.startsWith("0x")) {
        return res.status(404).json({ error: "No EVM alias for this account (ECDSA/alias required)" });
      }
      return res.json({ accountId, evmAlias: alias });
    } catch (err: unknown) {
      log.error({ err }, "Account alias lookup failed");
      return res.status(500).json({ error: "Lookup failed" });
    }
  });

  /**
   * POST /api/relay/place-bid
   * Body: { auctionId, bidderAlias, bidAmount, deadline, messageHash, signature }
   */
  router.post("/place-bid", async (req: Request, res: Response) => {
    const wallet = getWallet();
    if (!wallet || !auctionHouseAddress) {
      return res.status(503).json({ error: "Relay not configured" });
    }
    try {
      const { auctionId, bidderAlias, bidAmount, deadline, messageHash, signature } = req.body;
      if (!auctionId || !bidderAlias || bidAmount == null || !deadline || !messageHash || !signature) {
        return res.status(400).json({ error: "Missing auctionId, bidderAlias, bidAmount, deadline, messageHash, or signature" });
      }
      const contract = new ethers.Contract(auctionHouseAddress, AUCTION_HOUSE_ABI, wallet);
      const tx = await contract.placeBidWithED25519(
        auctionId,
        bidderAlias,
        bidAmount,
        deadline,
        messageHash,
        signature,
        { value: bidAmount }
      );
      const receipt = await tx.wait();
      return res.json({ success: true, txHash: receipt.hash });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err }, "Relay place-bid failed");
      return res.status(500).json({ error: "Relay failed", details: message });
    }
  });

  return router;
}
