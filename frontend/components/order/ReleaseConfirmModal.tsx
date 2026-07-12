"use client";

import { useEffect } from "react";
import { Btn } from "./Btn";
import { HP } from "./tokens";

export function ReleaseConfirmModal({
  open,
  amount,
  sellerLabel,
  submitting,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  amount: string;
  sellerLabel: React.ReactNode;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submitting, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="release-confirm-title"
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
        padding: 16,
      }}
      onClick={() => {
        if (!submitting) onCancel();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          background: HP.glassCard,
          border: `1px solid ${HP.border}`,
          borderRadius: 18,
          padding: 20,
          color: HP.fg,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          marginBottom: 24,
          boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
        }}
      >
        <div>
          <div
            id="release-confirm-title"
            style={{ fontSize: 18, fontWeight: 800, color: HP.fg, letterSpacing: "-0.01em" }}
          >
            Release {amount} ℏ?
          </div>
          <div style={{ fontSize: 13, color: HP.muted, marginTop: 6, lineHeight: 1.5 }}>
            This pays the seller from escrow and closes the trade on-chain.{" "}
            <strong style={{ color: HP.fg }}>It cannot be undone.</strong> Only release after
            you&apos;ve received and inspected the item.
          </div>
        </div>

        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${HP.borderSoft}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
          }}
        >
          <span style={{ color: HP.muted }}>To seller</span>
          <span style={{ color: HP.fg, fontFamily: "ui-monospace,Menlo,monospace" }}>
            {sellerLabel}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Btn onClick={onConfirm} disabled={submitting}>
            {submitting ? "Submitting…" : `Yes, release ${amount} ℏ`}
          </Btn>
          <Btn variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Btn>
        </div>
      </div>
    </div>
  );
}
