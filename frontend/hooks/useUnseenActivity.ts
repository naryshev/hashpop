"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "../lib/apiUrl";
import { useHashpackWallet } from "../lib/hashpackWallet";

/**
 * Lightweight "you have new activity" signal for the notification bells.
 * Polls the inbox and the user's sales/purchases and reports true when
 * anything is newer than the last time the user opened Activity or Messages —
 * an inbound message, an item they sold, or an item they bought. Seen-state
 * lives in localStorage — no schema, no extra endpoints.
 */

const SEEN_KEY = "hashpop.activity.seen.v1";
const SEEN_EVENT = "hashpop:activity-seen";
const POLL_MS = 90_000;

export function markActivitySeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, String(Date.now()));
  } catch {
    // ignore — the dot just stays until storage works
  }
  window.dispatchEvent(new Event(SEEN_EVENT));
}

export function useUnseenActivity(): boolean {
  const { address } = useHashpackWallet();
  const [unseen, setUnseen] = useState(false);

  useEffect(() => {
    if (!address) {
      setUnseen(false);
      return;
    }
    let stopped = false;
    const lower = address.toLowerCase();

    const newerThanSeen = (iso: string | undefined, seen: number) => {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      return Number.isFinite(t) && t > seen;
    };

    const check = async () => {
      try {
        let seen = 0;
        try {
          seen = Number(window.localStorage.getItem(SEEN_KEY) || 0);
        } catch {
          // ignore
        }

        const [msgRes, saleRes] = await Promise.allSettled([
          fetch(`${getApiUrl()}/api/messages/inbox?address=${encodeURIComponent(address)}`),
          fetch(`${getApiUrl()}/api/user/${encodeURIComponent(address)}/purchases`),
        ]);

        let has = false;

        if (msgRes.status === "fulfilled" && msgRes.value.ok) {
          const data = (await msgRes.value.json()) as {
            conversations?: Array<{
              lastMessage?: { fromAddress?: string; createdAt?: string } | null;
            }>;
          };
          has = (data.conversations ?? []).some((c) => {
            const m = c.lastMessage;
            if (!m) return false;
            if ((m.fromAddress || "").toLowerCase() === lower) return false; // own reply
            return newerThanSeen(m.createdAt, seen);
          });
        }

        // A sale (you're the seller) or purchase newer than last-seen also
        // lights the bell — that's how the seller learns their item sold.
        if (!has && saleRes.status === "fulfilled" && saleRes.value.ok) {
          const data = (await saleRes.value.json()) as {
            purchases?: Array<{ createdAt?: string }>;
          };
          has = (data.purchases ?? []).some((p) => newerThanSeen(p.createdAt, seen));
        }

        if (!stopped) setUnseen(has);
      } catch {
        // network hiccup — keep current state
      }
    };

    void check();
    const iv = setInterval(() => void check(), POLL_MS);
    const onSeen = () => setUnseen(false);
    window.addEventListener(SEEN_EVENT, onSeen);
    return () => {
      stopped = true;
      clearInterval(iv);
      window.removeEventListener(SEEN_EVENT, onSeen);
    };
  }, [address]);

  return unseen;
}
