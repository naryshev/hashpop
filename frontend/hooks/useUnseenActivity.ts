"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "../lib/apiUrl";
import { useHashpackWallet } from "../lib/hashpackWallet";

/**
 * Lightweight "you have new messages" signal for the notification bells.
 * Polls the inbox and reports true when any conversation's last message is
 * inbound and newer than the last time the user opened Activity or Messages.
 * Seen-state lives in localStorage — no schema, no extra endpoints.
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

    const check = async () => {
      try {
        const res = await fetch(
          `${getApiUrl()}/api/messages/inbox?address=${encodeURIComponent(address)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          conversations?: Array<{
            lastMessage?: { fromAddress?: string; createdAt?: string } | null;
          }>;
        };
        let seen = 0;
        try {
          seen = Number(window.localStorage.getItem(SEEN_KEY) || 0);
        } catch {
          // ignore
        }
        const has = (data.conversations ?? []).some((c) => {
          const m = c.lastMessage;
          if (!m?.createdAt) return false;
          if ((m.fromAddress || "").toLowerCase() === lower) return false; // own reply
          const t = new Date(m.createdAt).getTime();
          return Number.isFinite(t) && t > seen;
        });
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
