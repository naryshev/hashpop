"use client";

import { useMemo, useState } from "react";

const TICKET_TEMPLATE = [
  "Hashpop Support Ticket",
  "",
  "Issue summary:",
  "- ",
  "",
  "What happened (steps):",
  "1) ",
  "2) ",
  "3) ",
  "",
  "Expected result:",
  "- ",
  "",
  "Actual result / error:",
  "- ",
  "",
  "Listing ID / Transaction ID (if applicable):",
  "- ",
  "",
  "Wallet address:",
  "- ",
  "",
  "Network (testnet/mainnet):",
  "- ",
  "",
  "Best contact for updates (Discord @name, email, or X):",
  "- ",
].join("\n");

/** Copy button + template. The rest of /support is server-rendered. */
export function SupportTicketTemplate() {
  const [copied, setCopied] = useState(false);
  const ticketTemplate = useMemo(() => TICKET_TEMPLATE, []);

  const copyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(ticketTemplate);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="glass-card p-5 rounded-xl border border-white/10">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-white font-semibold">Ticket details template</h2>
        <button
          type="button"
          onClick={() => void copyTemplate()}
          className="btn-frost-cta text-xs px-3 py-2"
        >
          {copied ? "Copied" : "Copy template"}
        </button>
      </div>
      <p className="text-sm text-silver mt-2">
        Include as much detail as possible so support can reproduce the issue and update you.
      </p>
      <pre className="mt-4 whitespace-pre-wrap text-xs leading-relaxed text-silver bg-black/30 border border-white/10 rounded-lg p-4 overflow-x-auto">
        {ticketTemplate}
      </pre>
    </section>
  );
}
