"use client";

import { useMemo, useState } from "react";

const DISCORD_INVITE_URL = "https://discord.gg/VYt4WrYM7V";

export default function SupportPage() {
  const [copied, setCopied] = useState(false);

  const ticketTemplate = useMemo(
    () =>
      [
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
      ].join("\n"),
    [],
  );

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
    <main className="min-h-screen slide-in-right">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <section className="rounded-2xl border border-white/15 bg-gradient-to-br from-[#5865F2]/30 via-[#0d1222] to-[#0f4f76]/40 p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-200/90">Hashpop Support</p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-white">
            Help & Contact on Discord
          </h1>
          <p className="mt-3 text-silver max-w-2xl">
            Join our Discord to speak with support, open a ticket, and receive status updates from
            the team.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-frost-cta"
            >
              Join Hashpop Discord
            </a>
            <a
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-frost border-white/20"
            >
              Open Ticket in Discord
            </a>
          </div>
          <p className="mt-4 text-xs text-silver/90 break-all">
            Invite link:{" "}
            <a
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-chrome hover:text-white underline"
            >
              {DISCORD_INVITE_URL}
            </a>
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="glass-card p-5 rounded-xl border border-white/10">
            <h2 className="text-white font-semibold">Direct support chat</h2>
            <p className="text-sm text-silver mt-2">
              After joining Discord, go to the support area and post your issue so the team can
              respond quickly.
            </p>
            <a
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-frost-cta mt-4 inline-block"
            >
              Open Discord Support
            </a>
          </div>
          <div className="glass-card p-5 rounded-xl border border-white/10">
            <h2 className="text-white font-semibold">Open a ticket</h2>
            <p className="text-sm text-silver mt-2">
              Open a support ticket in Discord and paste the template below so we have issue details
              and contact info to send updates.
            </p>
            <a
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-frost mt-4 inline-block border-white/20"
            >
              Open Ticket Flow
            </a>
          </div>
        </section>

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
      </div>
    </main>
  );
}
