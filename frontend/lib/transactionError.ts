const HEDERA_TESTNET_CHAIN_ID = 296;
const HEDERA_MAINNET_CHAIN_ID = 295;

function getHederaNetworkLabel(chainId?: number): string {
  if (chainId === HEDERA_MAINNET_CHAIN_ID) return "Hedera Mainnet";
  if (chainId === HEDERA_TESTNET_CHAIN_ID) return "Hedera Testnet";
  return "Hedera";
}

function extractTxHash(message: string): string | null {
  const evmMatch = message.match(/0x[a-fA-F0-9]{64}/);
  if (evmMatch?.[0]) return evmMatch[0];
  const hederaTxIdMatch = message.match(/\d+\.\d+\.\d+@\d+\.\d+\.\d+/);
  return hederaTxIdMatch?.[0] ?? null;
}

/**
 * One place to turn wallet/contract errors into a short user-facing message.
 * Pass chainId (e.g. 296 for Hedera Testnet) to show "HBAR" instead of "ETH" in the message.
 */
export function getTransactionErrorMessage(
  error: unknown,
  options?: { chainId?: number }
): string {
  if (error == null) return "";
  const msg = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  const cause = error instanceof Error && error.cause != null
    ? (typeof (error.cause as Error).message === "string" ? (error.cause as Error).message : "")
    : "";
  const o = error as Record<string, unknown>;
  const short = typeof o?.shortMessage === "string" ? o.shortMessage : "";
  const dataReason = o?.data && typeof o.data === "object" && typeof (o.data as { reason?: string }).reason === "string"
    ? (o.data as { reason: string }).reason
    : "";
  const combined = [msg, cause, short, dataReason].filter(Boolean).join(" — ").trim();

  const onHedera =
    options?.chainId === HEDERA_TESTNET_CHAIN_ID || options?.chainId === HEDERA_MAINNET_CHAIN_ID;
  const clean = (s: string) =>
    onHedera ? s.replace(/\b(\d+(?:\.\d+)?)\s*ETH\b/gi, "$1 HBAR") : s;

  if (combined && !/^(error!?|transaction failed|rejected|user denied)$/i.test(combined)) {
    if (/transactiontimeouterror|receipt timeout|timed out waiting for transaction receipt/i.test(combined)) {
      const networkLabel = getHederaNetworkLabel(options?.chainId);
      const hash = extractTxHash(combined);
      const hashSuffix = hash ? ` Transaction reference: ${hash}.` : "";
      return clean(
        `Transaction confirmation is taking too long on ${networkLabel}. Check Mirror Node or your wallet activity before retrying.${hashSuffix}`
      );
    }
    if (/transactionreverterror|reverted on-chain|transaction reverted/i.test(combined)) {
      return clean(
        "Transaction was mined but reverted on-chain. Check listing state, balance, and network before retrying."
      );
    }
    if (/USER_REJECT|user reject|rejected by user/i.test(combined)) {
      return clean(
        "Transaction was rejected. Try again, or reconnect your wallet and ensure you’re on the correct Hedera network."
      );
    }
    if (/session expired|session not found|missing or invalid.*session/i.test(combined)) {
      return clean(
        "Wallet session expired. Disconnect and reconnect your wallet, then retry the transaction."
      );
    }
    if (/indexed database|indexeddb|connection to index|quotaexceedederror/i.test(combined)) {
      return clean(
        "Wallet storage error. In HashPack: refresh the app, clear site data and re-pair, then retry."
      );
    }
    if (/request expired|request timeout/i.test(combined)) {
      return clean(
        "Wallet request expired before approval. Reconnect your wallet, reopen the transaction flow, and approve promptly in HashPack."
      );
    }
    if (/must have been frozen before calculating the hash|try calling [`'"]?freeze/i.test(combined)) {
      return clean(
        "Wallet transaction was not finalized correctly before signing. Please retry. If it repeats, disconnect/reconnect HashPack and try again."
      );
    }
    if (/body\.data was not set in the protobuf/i.test(combined)) {
      return clean(
        "Wallet transaction payload was malformed before signing. Please retry once. If it repeats, disconnect/reconnect HashPack and refresh the page."
      );
    }
    if (/not seller/i.test(combined)) {
      return clean(
        "Only the listing seller can perform this action. Reconnect the wallet that created this listing and try again."
      );
    }
    if (/\blisting is locked\b|\blocked in escrow\b/i.test(combined)) {
      return clean(
        "This listing is locked in escrow and cannot be edited or deleted until the transaction is completed."
      );
    }
    if (/\blist is locked\b/i.test(combined)) {
      return clean(
        "Wallet transaction payload became immutable before signing. Please retry. If it keeps happening, reconnect HashPack and try again."
      );
    }
    if (/price mismatch/i.test(combined)) {
      return clean(
        "Price mismatch: the contract expects the exact listing price in HBAR. " +
          "If the seller recently changed the price, refresh the page. Otherwise reconnect your wallet, ensure you’re on the correct Hedera network, and retry."
      );
    }
    return clean(combined);
  }
  if (combined) return clean(combined);
  return "Transaction failed. Try again or ensure your wallet is on the correct Hedera network.";
}
