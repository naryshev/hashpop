"use client";

import { useEffect, useRef, useState } from "react";
import { HP } from "./tokens";
import {
  consensusToDate,
  fetchMirrorContractResult,
  fetchMirrorTransaction,
  MirrorContractResult,
  MirrorTransaction,
  tinybarToHbar,
} from "@/lib/mirrorTx";

type Sheet = {
  open: boolean;
  txId: string | null;
  hashscanHref?: string | null;
  onClose: () => void;
};

export function TxDetailSheet({ open, txId, hashscanHref, onClose }: Sheet) {
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !txId) return null;

  const consensus = consensusToDate(tx?.consensus_timestamp);
  const status = (cc?.result ?? tx?.result ?? "").toUpperCase();
  const isSuccess = status === "SUCCESS";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-sheet-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(4,6,12,0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        zIndex: 60,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 0,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "88vh",
          overflow: "auto",
          background: HP.glassCard,
          border: `1px solid ${HP.border}`,
          borderRadius: "18px 18px 0 0",
          padding: "16px 18px 24px",
          color: HP.fg,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          boxShadow: "0 -24px 48px rgba(0,0,0,0.5)",
        }}
      >
        {/* Drag handle */}
        <div
          aria-hidden
          style={{
            width: 36,
            height: 4,
            borderRadius: 4,
            background: "rgba(255,255,255,0.18)",
            margin: "0 auto 4px",
          }}
        />

        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <div id="tx-sheet-title" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", color: HP.muted, textTransform: "uppercase" }}>
            Transaction
          </div>
          {status && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.06em",
                padding: "2px 7px",
                borderRadius: 9999,
                background: isSuccess ? "rgba(0,255,163,0.14)" : "rgba(244,63,94,0.14)",
                color: isSuccess ? HP.chrome : "#fda4af",
                border: `1px solid ${isSuccess ? "rgba(0,255,163,0.4)" : "rgba(244,63,94,0.4)"}`,
              }}
            >
              {status}
            </span>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              marginLeft: "auto",
              width: 28,
              height: 28,
              borderRadius: 9999,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              color: HP.fg,
              cursor: "pointer",
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            fontFamily: "ui-monospace,Menlo,monospace",
            fontSize: 12,
            color: HP.fg,
            wordBreak: "break-all",
            lineHeight: 1.45,
          }}
        >
          {txId}
        </div>

        {loading && <Loading />}
        {error && (
          <div style={{ fontSize: 12, color: "#fda4af" }}>
            {error}
            {hashscanHref ? (
              <>
                {" "}
                <a href={hashscanHref} target="_blank" rel="noreferrer" style={{ color: HP.chrome }}>
                  Open on HashScan ↗
                </a>
              </>
            ) : null}
          </div>
        )}

        {!loading && (tx || cc) && (
          <>
            <Section title="Summary">
              <KV label="Type" value={tx?.name ? friendlyType(tx.name) : cc ? "Contract call" : "—"} />
              <KV
                label="Consensus at"
                value={consensus ? consensus.toLocaleString() : "—"}
              />
              <KV label="Block" value={cc?.block_number != null ? `#${cc.block_number}` : "—"} />
              <KV label="Node" value={tx?.node ?? "—"} />
              {tx?.transaction_hash && (
                <KV label="Hash" value={tx.transaction_hash} mono wrap />
              )}
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
                {cc.from && <KV label="From" value={cc.from} mono wrap />}
                {cc.to && <KV label="To" value={cc.to} mono wrap />}
              </Section>
            )}

            <Section title="Fees">
              <KV
                label="Charged"
                value={tx?.charged_tx_fee != null ? `${tinybarToHbar(tx.charged_tx_fee)} ℏ` : "—"}
              />
              <KV
                label="Max fee"
                value={tx?.max_fee ? `${tinybarToHbar(tx.max_fee)} ℏ` : "—"}
              />
              <KV
                label="Valid duration"
                value={tx?.valid_duration_seconds ? `${tx.valid_duration_seconds}s` : "—"}
              />
            </Section>

            {tx?.transfers && tx.transfers.length > 0 && (
              <Section title="Transfers">
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {tx.transfers.map((t, i) => (
                    <div
                      key={`${t.account}-${i}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 12,
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "ui-monospace,Menlo,monospace",
                          color: HP.fg,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t.account}
                      </span>
                      <span
                        style={{
                          color: t.amount < 0 ? "#fda4af" : HP.chrome,
                          fontFamily: "ui-monospace,Menlo,monospace",
                          flexShrink: 0,
                        }}
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
          <div style={{ fontSize: 12, color: HP.muted }}>
            Mirror node hasn&apos;t indexed this transaction yet. Try again in a few seconds.
          </div>
        )}

        {hashscanHref && (
          <a
            href={hashscanHref}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 12,
              color: HP.chrome,
              alignSelf: "flex-end",
              textDecoration: "none",
              padding: "8px 4px",
            }}
          >
            View on HashScan ↗
          </a>
        )}
      </div>
    </div>
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
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${HP.borderSoft}`,
        background: "rgba(255,255,255,0.03)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: HP.muted,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
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
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        fontSize: 12,
        alignItems: wrap ? "flex-start" : "center",
      }}
    >
      <span style={{ color: HP.muted, flexShrink: 0 }}>{label}</span>
      <span
        style={{
          color: HP.fg,
          textAlign: "right",
          fontFamily: mono ? "ui-monospace,Menlo,monospace" : "system-ui",
          wordBreak: wrap ? "break-all" : undefined,
          minWidth: 0,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Loading() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        color: HP.muted,
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 9999,
          background: HP.chrome,
          animation: "hp-pulse 1.2s ease-in-out infinite",
        }}
      />
      Loading on-chain details…
    </div>
  );
}
