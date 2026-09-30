import { Router, Request, Response } from "express";
import type { Logger } from "pino";

export function relayRouter(log: Logger): Router {
  const router = Router();

  /**
   * GET /api/relay/account-id?evmAddress=0x...
   * Returns the Hedera account ID (0.0.xxxxx) for an EVM address from the mirror node.
   */
  router.get("/account-id", async (req: Request, res: Response) => {
    const evmAddress = req.query.evmAddress as string;
    if (
      !evmAddress ||
      typeof evmAddress !== "string" ||
      !/^0x[a-fA-F0-9]{40}$/.test(evmAddress.trim())
    ) {
      return res.status(400).json({ error: "Invalid evmAddress; use 0x followed by 40 hex chars" });
    }
    const mirrorUrl = process.env.MIRROR_URL || "https://testnet.mirrornode.hedera.com";
    try {
      const r = await fetch(`${mirrorUrl}/api/v1/accounts/${evmAddress.trim().toLowerCase()}`);
      if (!r.ok) return res.status(404).json({ error: "Account not found for this EVM address" });
      const data = await r.json();
      const first = Array.isArray(data.accounts) && data.accounts[0] ? data.accounts[0] : data;
      const accountId =
        first.account ?? first.account_id ?? first.id ?? data.account ?? data.account_id ?? data.id;
      const normalized =
        typeof accountId === "string" && /^0\.0\.\d+$/.test(accountId)
          ? accountId
          : typeof accountId === "number"
            ? `0.0.${accountId}`
            : null;
      if (!normalized) {
        return res.status(404).json({ error: "No Hedera account ID for this address" });
      }
      return res.json({ accountId: normalized, evmAddress: evmAddress.trim().toLowerCase() });
    } catch (err: unknown) {
      log.error({ err }, "Account ID lookup failed");
      return res.status(500).json({ error: "Lookup failed" });
    }
  });

  return router;
}
