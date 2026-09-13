"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Capsule } from "@/components/ui/Capsule";
import { listingCta, material } from "@/lib/materials";
import { cn } from "@/lib/utils";
import {
  consensusToDate,
  fetchMirrorContractResult,
  fetchMirrorTransaction,
  MirrorContractResult,
  MirrorTransaction,
  tinybarToHbar,
} from "@/lib/mirrorTx";

type SheetProps = {
  open: boolean;
  txId: string | null;
  hashscanHref?: string | null;
  onClose: () => void;
};

/**
 * Long-zero EVM address → "0.0.N". Mirror-node contract results report
 * from/to as 20-byte EVM addresses; Hedera-native accounts encode
 * shard/realm/num in them, and we never display raw 0x addresses.
 */
function evmToAccountDisplay(evm: string): string {
  const m = /^0x([0-9a-fA-F]{40})$/.exec((evm || "").trim());
  if (!m) return evm;
  const hex = m[1];
  if (!hex.slice(0, 24).match(/^0+$/)) {
    return `${evm.slice(0, 6)}…${evm.slice(-4)}`;
  }
  return `0.0.${BigInt(`0x${hex.slice(24)}`).toString()}`;
}

export function TxDetailSheet({ open, txId, hashscanHref, onClose }: SheetProps) {
  const [tx, setTx] = useState<MirrorTransaction | null>(null);
  const [cc, setCc] = useState<MirrorContractResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open || !txId) return;
    setTx(null);
    setCc(null);
    setError(null);
    setLoading(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    Promise.allSettled([
      fetchMirrorTransaction(txId, ac.signal),
      fetchMirrorContractResult(txId, ac.signal),
    ])
      .then(([t, c]) => {
        if (ac.signal.aborted) return;
        if (t.status === "fulfilled") setTx(t.value);
        if (c.status === "fulfilled") setCc(c.value);
        if (t.status === "rejected" && c.status === "rejected") {
          setError("Couldn't load transaction details.");
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [open, txId]);

  const consensus = consensusToDate(tx?.consensus_timestamp);
  const status = (cc?.result ?? tx?.result ?? "").toUpperCase();
  const isSuccess = status === "SUCCESS";

  return (
    <Sheet
      open={open && !!txId}
      onClose={onClose}
      detent="large"
      title="Transaction"
      ariaLabel="Transaction"
      trailing={
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-fg"
        >
          <X size={18} />
        </button>
      }
      footer={
        hashscanHref ? (
          <a
            href={hashscanHref}
            target="_blank"
            rel="noreferrer"
            className={cn(listingCta.tinted, "no-underline")}
          >
            View on HashScan ↗
          </a>
        ) : undefined
      }
    >
      {status && (
        <div className="mb-3">
          <Capsule tone={isSuccess ? "mint" : "danger"}>{isSuccess ? "Success" : "Failed"}</Capsule>
        </div>
      )}

      {txId && <p className="break-all font-mono text-xs leading-snug text-fg">{txId}</p>}

      {loading && <Loading />}
      {error && (
        <p className="text-xs text-rose-300">
          {error}
          {hashscanHref ? (
            <>
              {" "}
              <a href={hashscanHref} target="_blank" rel="noreferrer" className="text-chrome">
                Open on HashScan ↗
              </a>
            </>
          ) : null}
        </p>
      )}

      {!loading && (tx || cc) && (
        <>
          <Section title="Summary">
            <KV
              label="Type"
              value={tx?.name ? friendlyType(tx.name) : cc ? "Contract call" : "—"}
            />
            <KV label="Consensus at" value={consensus ? consensus.toLocaleString() : "—"} />
            <KV label="Block" value={cc?.block_number != null ? `#${cc.block_number}` : "—"} />
            <KV label="Node" value={tx?.node ?? "—"} />
            {tx?.transaction_hash && <KV label="Hash" value={tx.transaction_hash} mono wrap />}
          </Section>

          {cc && (
            <Section title="Contract">
              <KV label="Contract" value={cc.contract_id ?? "—"} mono />
              <KV
                label="Gas used"
                value={
                  cc.gas_used != null
                    ? `${cc.gas_used.toLocaleString()}${cc.gas_limit ? ` / ${cc.gas_limit.toLocaleString()}` : ""}`
                    : "—"
                }
              />
              {cc.from && <KV label="From" value={evmToAccountDisplay(cc.from)} mono />}
              {cc.to && <KV label="To" value={evmToAccountDisplay(cc.to)} mono />}
            </Section>
          )}

          <Section title="Fees">
            <KV
              label="Charged"
              value={tx?.charged_tx_fee != null ? `${tinybarToHbar(tx.charged_tx_fee)} ℏ` : "—"}
            />
            <KV label="Max fee" value={tx?.max_fee ? `${tinybarToHbar(tx.max_fee)} ℏ` : "—"} />
            <KV
              label="Valid duration"
              value={tx?.valid_duration_seconds ? `${tx.valid_duration_seconds}s` : "—"}
            />
          </Section>

          {tx?.transfers && tx.transfers.length > 0 && (
            <Section title="Transfers">
              <div className="flex flex-col gap-1.5">
                {tx.transfers.map((t, i) => (
                  <div
                    key={`${t.account}-${i}`}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate font-mono text-fg">{t.account}</span>
                    <span
                      className={cn(
                        "shrink-0 font-mono",
                        t.amount < 0 ? "text-rose-300" : "text-chrome",
                      )}
                    >
                      {t.amount > 0 ? "+" : ""}
                      {tinybarToHbar(t.amount)} ℏ
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}

      {!loading && !tx && !cc && !error && (
        <p className="text-xs text-muted">
          Mirror node hasn&apos;t indexed this transaction yet. Try again in a few seconds.
        </p>
      )}
    </Sheet>
  );
}

function friendlyType(name: string): string {
  return name
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={cn(material.regular, "mt-3 flex flex-col gap-2 rounded-control p-3")}>
      <div className="text-[10px] font-bold text-muted">{title}</div>
      {children}
    </div>
  );
}

function KV({
  label,
  value,
  mono = false,
  wrap = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  wrap?: boolean;
}) {
  return (
    <div
      className={cn("flex justify-between gap-3 text-xs", wrap ? "items-start" : "items-center")}
    >
      <span className="shrink-0 text-muted">{label}</span>
      <span className={cn("min-w-0 text-right text-fg", mono && "font-mono", wrap && "break-all")}>
        {value}
      </span>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <span className="h-2.5 w-2.5 animate-[hp-pulse_1.2s_ease-in-out_infinite] rounded-full bg-chrome" />
      Loading on-chain details…
    </div>
  );
}
