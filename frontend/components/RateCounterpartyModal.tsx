"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Star } from "lucide-react";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { getApiUrl } from "../lib/apiUrl";

type Props = {
  saleId: string;
  ratedAddress: string;
  /** Whether the rater is rating the "seller" or "buyer" — for copy only. */
  counterpartyRole: "seller" | "buyer";
  onClose: () => void;
  onRated: () => void;
};

/**
 * Prompts a sale participant to rate their counterparty (1–5 stars + optional
 * comment). The score is signed with the wallet so the backend can verify the
 * reviewer, matching the signature scheme used for public-key registration.
 */
export function RateCounterpartyModal({
  saleId,
  ratedAddress,
  counterpartyRole,
  onClose,
  onRated,
}: Props) {
  const { hashconnect, accountId, address } = useHashpackWallet();
  const [score, setScore] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (score < 1 || score > 5) {
      setError("Pick a rating from 1 to 5 stars.");
      return;
    }
    if (!hashconnect || !accountId || !address) {
      setError("Connect your wallet to leave a rating.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const reviewer = address.toLowerCase();
      const rated = ratedAddress.toLowerCase();
      const message = `hashpop.rate:${saleId}:${rated}:${score}`;
      const signResult = await (hashconnect as unknown as {
        signMessages: (accountId: string, messages: string[]) => Promise<unknown>;
      }).signMessages(accountId, [message]);
      const signature = Array.isArray(signResult)
        ? (signResult[0] as string)
        : ((signResult as { signedMessages?: string[] })?.signedMessages?.[0] ??
          (signResult as string));
      if (!signature || typeof signature !== "string") {
        throw new Error("Could not get a signature from your wallet.");
      }

      const res = await fetch(`${getApiUrl()}/api/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewerAddress: reviewer,
          ratedAddress: rated,
          saleId,
          score,
          comment: comment.trim() || undefined,
          signature,
        }),
      });
      if (res.status === 409) {
        // Already rated — treat as success so the prompt clears.
        onRated();
        onClose();
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Failed to submit rating.");
      }
      onRated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit rating.");
    } finally {
      setSubmitting(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Rate ${counterpartyRole}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#15181f] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-white">Rate your {counterpartyRole}</h2>
        <p className="mt-1 text-xs text-silver">
          Your rating is public and helps other traders. You can only rate once per transaction.
        </p>

        <div className="mt-4 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setScore(n)}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              className="p-0.5"
            >
              <Star
                size={28}
                className={
                  (hover || score) >= n ? "fill-amber-400 text-amber-400" : "text-white/25"
                }
              />
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Add a comment (optional)"
          className="mt-4 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-silver/50"
        />

        {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}

        <div className="mt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-silver hover:text-white"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || score < 1}
            className="rounded-md bg-[#00ffa3] px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit rating"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
