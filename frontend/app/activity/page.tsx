"use client";

import { useEffect, useMemo, useState } from "react";

import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { TxDetailSheet } from "@/components/order/TxDetailSheet";
import { useHashpackWallet } from "@/lib/hashpackWallet";
import { activeHederaChain } from "@/lib/hederaChains";
import { getTransactionExplorerUrl } from "@/lib/explorer";
import {
  AccountTransaction,
  consensusToDate,
  deltaForAccount,
  fetchAccountTransactions,
  tinybarToHbar,
} from "@/lib/mirrorTx";

type Kind = "received" | "sent" | "contract" | "other";

const KIND_LABEL: Record<Kind, string> = {
  received: "Received",
  sent: "Sent",
  contract: "Contract calls",
  other: "Other",
};

const KIND_COLOR: Record<Kind, string> = {
  received: "#00ffa3",
  sent: "#fbbf24",
  contract: "#a78bfa",
  other: "#71717a",
};

function classify(tx: AccountTransaction, accountId: string): Kind {
  const name = (tx.name ?? "").toLowerCase();
  if (name === "contractcall" || name === "contract_call") return "contract";
  if (name === "cryptotransfer" || name === "crypto_transfer") {
    const d = deltaForAccount(tx, accountId);
    if (d > 0) return "received";
    if (d < 0) return "sent";
  }
  return "other";
}

function describe(tx: AccountTransaction, accountId: string, kind: Kind): string {
  if (kind === "contract") {
    return `Contract call · ${tx.entity_id ?? "—"}`;
  }
  const d = deltaForAccount(tx, accountId);
  if (kind === "received") return `Received ${tinybarToHbar(d)} ℏ`;
  if (kind === "sent") return `Sent ${tinybarToHbar(Math.abs(d))} ℏ`;
  return tx.name
    ? tx.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Activity";
}

function counterparty(tx: AccountTransaction, accountId: string): string | null {
  if (!tx.transfers) return null;
  const others = tx.transfers
    .filter((t) => t.account !== accountId && Math.abs(Number(t.amount)) > 0)
    .sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)));
  return others[0]?.account ?? null;
}

function dayLabel(d: Date | null): string {
  if (!d) return "Unknown";
  const now = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return "Today";
  if (sameDay(d, y)) return "Yesterday";
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays < 7) return "This week";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function timeStamp(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function ActivityPage() {
  const { accountId } = useHashpackWallet();
  const [txs, setTxs] = useState<AccountTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState<Record<Kind, boolean>>({
    received: true,
    sent: true,
    contract: true,
    other: true,
  });
  const [openTxId, setOpenTxId] = useState<string | null>(null);
  const chainId = activeHederaChain.id;

  useEffect(() => {
    if (!accountId) {
      setLoading(false);
      setTxs([]);
      return;
    }
    setLoading(true);
    const ac = new AbortController();
    fetchAccountTransactions(accountId, { max: 100, pageSize: 50, signal: ac.signal })
      .then((data) => {
        if (!ac.signal.aborted) setTxs(data);
      })
      .catch(() => {
        if (!ac.signal.aborted) setTxs([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [accountId]);

  const decorated = useMemo(
    () =>
      txs.map((tx) => ({
        tx,
        kind: classify(tx, accountId ?? ""),
        when: consensusToDate(tx.consensus_timestamp),
      })),
    [txs, accountId],
  );

  const counts = useMemo(() => {
    const c: Record<Kind, number> = { received: 0, sent: 0, contract: 0, other: 0 };
    for (const row of decorated) c[row.kind]++;
    return c;
  }, [decorated]);

  const visible = decorated.filter((row) => enabled[row.kind]);

  const groups = useMemo(() => {
    const out = new Map<string, typeof visible>();
    for (const row of visible) {
      const key = dayLabel(row.when);
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push(row);
    }
    return out;
  }, [visible]);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-[-0.01em] text-white">Activity</h1>
          <p className="mt-1 text-xs text-silver">
            {accountId ? `All on-chain events for ${accountId}` : "Connect your wallet to view activity."}
          </p>
        </div>

        {!accountId ? (
          <div className="rounded-glass-lg border border-white/10 bg-[#0e1422] p-6">
            <p className="mb-3 font-medium text-white">Wallet not connected.</p>
            <ConnectWalletButton />
          </div>
        ) : (
          <div className="grid gap-7 md:grid-cols-[1fr_260px]">
            <main>
              {loading ? (
                <p className="text-sm text-silver">Loading on-chain history…</p>
              ) : visible.length === 0 ? (
                <p className="text-sm text-silver">No events match the current filters.</p>
              ) : (
                Array.from(groups.entries()).map(([day, rows]) => (
                  <section key={day} className="mb-7">
                    <div className="border-b border-white/10 pb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-silver">
                      {day}
                    </div>
                    <ul>
                      {rows.map(({ tx, kind, when }, i) => {
                        const accent = KIND_COLOR[kind];
                        const cp = counterparty(tx, accountId);
                        return (
                          <li
                            key={tx.transaction_id + i}
                            className="flex gap-4 border-b border-white/[0.03] py-3.5 last:border-0"
                          >
                            <div
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold uppercase"
                              style={{
                                background: `${accent}22`,
                                border: `1px solid ${accent}66`,
                                color: accent,
                              }}
                            >
                              {kind[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[13px] font-semibold text-white">
                                {describe(tx, accountId, kind)}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2.5 text-[11px] font-mono text-silver">
                                {cp ? <span>{cp}</span> : <span>—</span>}
                                <button
                                  type="button"
                                  onClick={() => setOpenTxId(tx.transaction_id)}
                                  className="text-chrome hover:underline"
                                >
                                  {tx.transaction_id.length > 22
                                    ? `${tx.transaction_id.slice(0, 18)}…`
                                    : tx.transaction_id}{" "}
                                  ›
                                </button>
                              </div>
                            </div>
                            <div className="shrink-0 font-mono text-[11px] text-silver">
                              {timeStamp(when)}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))
              )}
            </main>

            <aside>
              <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-silver">
                Filter by type
              </div>
              {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                <label
                  key={k}
                  className="flex cursor-pointer items-center gap-2.5 py-2 text-[12px] text-white"
                >
                  <span
                    className="flex h-[14px] w-[14px] items-center justify-center rounded-[3px] text-[10px] font-bold text-black"
                    style={{
                      background: enabled[k] ? "#00ffa3" : "rgba(255,255,255,0.06)",
                    }}
                  >
                    {enabled[k] ? "✓" : ""}
                  </span>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={enabled[k]}
                    onChange={(e) => setEnabled((prev) => ({ ...prev, [k]: e.target.checked }))}
                  />
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: KIND_COLOR[k] }}
                  />
                  <span className="flex-1">{KIND_LABEL[k]}</span>
                  <span className="font-mono text-[11px] text-silver">{counts[k]}</span>
                </label>
              ))}
            </aside>
          </div>
        )}
      </div>

      <TxDetailSheet
        open={!!openTxId}
        txId={openTxId}
        hashscanHref={getTransactionExplorerUrl(openTxId, chainId)}
        onClose={() => setOpenTxId(null)}
      />
    </main>
  );
}
