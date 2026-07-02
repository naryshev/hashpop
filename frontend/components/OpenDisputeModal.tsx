"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { getApiUrl } from "../lib/apiUrl";

const DISCORD_INVITE_URL = "https://discord.gg/VYt4WrYM7V";

type Props = {
  listingId: string;
  listingTitle: string;
  openerAddress: string;
  onClose: () => void;
  onOpened: () => void;
};

/**
 * Lets a buyer or seller open a dispute on an escrow transaction. Opening a
 * dispute freezes the order, notifies the counterparty, and routes a
 * structured ticket to Discord support.
 */
export function OpenDisputeModal({
  listingId,
  listingTitle,
  openerAddress,
  onClose,
  onOpened,
}: Props) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  const ticketTemplate = [
    "Hashpop Dispute",
    "",
    `Listing: ${listingTitle}`,
    `Listing ID: ${listingId}`,
    `Opened by: ${openerAddress}`,
    "",
    "What went wrong:",
    reason || "- ",
    "",
    "Desired resolution (refund / replacement / other):",
    "- ",
  ].join("\n");

  const submit = async () => {
    if (reason.trim().length < 5) {
      setError("Please describe the issue (at least 5 characters).");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `${getApiUrl()}/api/listing/${encodeURIComponent(listingId)}/dispute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ openerAddress, reason: reason.trim() }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Failed to open dispute.");
      }
      setSubmitted(true);
      onOpened();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open dispute.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(ticketTemplate);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Open a dispute"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/15 bg-[#15181f] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
          <AlertTriangle size={18} className="text-amber-300" />
          Open a dispute
        </h2>

        {!submitted ? (
          <>
            <p className="mt-1 text-xs text-silver">
              Opening a dispute freezes the escrow so funds aren&apos;t released, notifies the other
              party, and creates a support ticket. Only do this if there&apos;s a real problem with
              the transaction.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Describe what went wrong (e.g. item not received, item not as described)…"
              className="mt-4 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-silver/50"
            />
            {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="text-sm text-silver hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || reason.trim().length < 5}
                className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
              >
                {submitting ? "Opening…" : "Open dispute"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 rounded-lg border border-emerald-400/30 bg-emerald-400/[0.06] px-3 py-2 text-sm text-emerald-200">
              Dispute opened. Escrow is frozen and the other party has been notified.
            </p>
            <p className="mt-3 text-xs text-silver">
              Finish by opening a ticket in Discord and pasting the details below so support can help
              resolve it.
            </p>
            <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-3 text-[11px] leading-relaxed text-silver">
              {ticketTemplate}
            </pre>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => void copyTemplate()}
                className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs text-white hover:bg-white/10"
              >
                {copied ? "Copied" : "Copy details"}
              </button>
              <a
                href={DISCORD_INVITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white"
              >
                Open ticket in Discord
              </a>
              <button type="button" onClick={onClose} className="text-sm text-silver hover:text-white">
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
