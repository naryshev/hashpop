// Hedera Mirror Node REST API client for transaction detail lookups.
// Powers the in-app tx detail sheet on the order/escrow screen so users
// don't have to bounce out to HashScan for basic on-chain metadata.

import { activeHederaChain } from "./hederaChains";

const MAINNET = "https://mainnet.mirrornode.hedera.com";
const TESTNET = "https://testnet.mirrornode.hedera.com";

function mirrorBase(): string {
  return activeHederaChain.id === 295 ? MAINNET : TESTNET;
}

/**
 * Convert a Hedera transaction id from the display form `0.0.x@s.ns` to the
 * Mirror REST form `0.0.x-s-ns`. EVM-style 0x… hashes are returned unchanged
 * (the contracts-results endpoint accepts both).
 */
export function normalizeTxId(id: string): string {
  const s = id.trim();
  if (!s) return s;
  if (s.startsWith("0x")) return s;
  // 0.0.x@s.ns  →  0.0.x-s-ns
  const m = /^(\d+\.\d+\.\d+)@(\d+)\.(\d+)$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return s;
}

export type MirrorTransfer = {
  account: string;
  amount: number; // tinybar
  is_approval?: boolean;
};

export type MirrorTransaction = {
  transaction_id: string;
  name?: string; // CONTRACTCALL, CRYPTOTRANSFER, …
  consensus_timestamp?: string; // "1775529804.598506376"
  result?: string; // SUCCESS, …
  charged_tx_fee?: number; // tinybar
  max_fee?: string; // tinybar (string)
  valid_duration_seconds?: string;
  node?: string;
  memo_base64?: string;
  transfers?: MirrorTransfer[];
  transaction_hash?: string;
};

export type MirrorContractResult = {
  contract_id?: string;
  hash?: string;
  block_hash?: string;
  block_number?: number;
  gas_used?: number;
  gas_limit?: number;
  gas_price?: string;
  status?: string; // "0x1"
  from?: string;
  to?: string;
  function_parameters?: string;
  result?: string; // "SUCCESS"
  timestamp?: string;
};

const POLL_MS = 1500;
const MAX_POLLS = 10; // ~15s of mirror lag tolerated

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  const r = await fetch(url, { signal });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Mirror ${r.status}`);
  return (await r.json()) as T;
}

async function pollForJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  for (let i = 0; i < MAX_POLLS; i++) {
    if (signal?.aborted) return null;
    const data = await getJson<T>(url, signal);
    if (data) return data;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return null;
}

/**
 * Fetch transaction details from Mirror. Returns the first result entry
 * (Hedera lists every contract-call appearance under the same tx id).
 */
export async function fetchMirrorTransaction(
  rawId: string,
  signal?: AbortSignal,
): Promise<MirrorTransaction | null> {
  const id = normalizeTxId(rawId);
  if (!id) return null;
  const url = `${mirrorBase()}/api/v1/transactions/${encodeURIComponent(id)}`;
  const data = await pollForJson<{ transactions?: MirrorTransaction[] }>(url, signal);
  return data?.transactions?.[0] ?? null;
}

/** Fetch contract-call result (gas, block, status) by tx id or evm hash. */
export async function fetchMirrorContractResult(
  rawId: string,
  signal?: AbortSignal,
): Promise<MirrorContractResult | null> {
  const id = normalizeTxId(rawId);
  if (!id) return null;
  const url = `${mirrorBase()}/api/v1/contracts/results/${encodeURIComponent(id)}`;
  return await pollForJson<MirrorContractResult>(url, signal);
}

/** Convert "1775529804.598506376" → Date. */
export function consensusToDate(ts: string | undefined | null): Date | null {
  if (!ts) return null;
  const [secs, nanos] = ts.split(".");
  if (!secs) return null;
  const ms = Number(secs) * 1000 + Math.floor(Number(nanos ?? "0") / 1_000_000);
  if (Number.isNaN(ms)) return null;
  return new Date(ms);
}

/** Tinybar → "X.YYYYYYYY" HBAR (no padding zeros). */
export function tinybarToHbar(tinybar: number | string | null | undefined): string {
  if (tinybar == null) return "0";
  const n = typeof tinybar === "string" ? BigInt(tinybar) : BigInt(Math.abs(Math.trunc(Number(tinybar))));
  const sign = typeof tinybar === "number" && tinybar < 0 ? "-" : "";
  const div = 10n ** 8n;
  const whole = n / div;
  const frac = n % div;
  const fracStr = frac.toString().padStart(8, "0").replace(/0+$/, "");
  return fracStr ? `${sign}${whole}.${fracStr}` : `${sign}${whole}`;
}

// ─── Account-scoped tx history (for /activity + dashboard sparkline) ────────

export type AccountTransfer = {
  account: string;
  amount: number; // tinybar
  is_approval?: boolean;
};

export type AccountTransaction = {
  transaction_id: string;
  name?: string;
  consensus_timestamp?: string;
  result?: string;
  charged_tx_fee?: number;
  transfers?: AccountTransfer[];
  entity_id?: string | null;
};

/**
 * List recent transactions for an account, newest first. `limit` is per page;
 * we follow `links.next` until we've collected `max` records or run out.
 */
export async function fetchAccountTransactions(
  accountId: string,
  {
    max = 50,
    pageSize = 50,
    minTimestamp,
    signal,
  }: { max?: number; pageSize?: number; minTimestamp?: string; signal?: AbortSignal } = {},
): Promise<AccountTransaction[]> {
  const out: AccountTransaction[] = [];
  let url: string | null =
    `${mirrorBase()}/api/v1/transactions?account.id=${encodeURIComponent(accountId)}` +
    `&order=desc&limit=${Math.min(pageSize, 100)}` +
    (minTimestamp ? `&timestamp=gte:${minTimestamp}` : "");
  while (url && out.length < max) {
    const r: Response = await fetch(url, { signal });
    if (!r.ok) break;
    const data: { transactions?: AccountTransaction[]; links?: { next?: string | null } } =
      await r.json();
    if (data.transactions?.length) out.push(...data.transactions);
    const next = data.links?.next;
    url = next ? `${mirrorBase()}${next}` : null;
  }
  return out.slice(0, max);
}

/**
 * Pick out this account's signed delta in a transaction. Positive = received,
 * negative = sent. Returns 0 if the account doesn't appear in transfers.
 */
export function deltaForAccount(tx: AccountTransaction, accountId: string): number {
  if (!tx.transfers) return 0;
  let sum = 0;
  for (const t of tx.transfers) {
    if (t.account === accountId) sum += Number(t.amount) || 0;
  }
  return sum;
}

export type BalancePoint = { t: number; balance: number };

/**
 * Reconstruct a 30-day-ish balance series for an account, working backwards
 * from the current tinybar balance by undoing each transaction's net delta.
 * Returns oldest→newest points suitable for an SVG sparkline.
 */
export async function fetchBalanceSeries(
  accountId: string,
  currentBalanceTinybar: bigint,
  days = 30,
  signal?: AbortSignal,
): Promise<BalancePoint[]> {
  const sinceSec = Math.floor(Date.now() / 1000) - days * 86400;
  const txs = await fetchAccountTransactions(accountId, {
    max: 250,
    pageSize: 100,
    minTimestamp: `${sinceSec}.0`,
    signal,
  });
  // txs are newest→oldest; iterate that way to walk balance backwards.
  let bal = Number(currentBalanceTinybar);
  const points: BalancePoint[] = [{ t: Date.now(), balance: bal }];
  for (const tx of txs) {
    const delta = deltaForAccount(tx, accountId);
    bal -= delta;
    const ts = consensusToDate(tx.consensus_timestamp)?.getTime();
    if (ts) points.push({ t: ts, balance: bal });
  }
  // Anchor the left edge of the window so the chart spans the full range
  // even when the account has been quiet.
  points.push({ t: sinceSec * 1000, balance: bal });
  return points.reverse(); // oldest → newest
}
