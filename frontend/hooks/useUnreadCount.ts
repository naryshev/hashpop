"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "../lib/apiUrl";
import { useHashpackWallet } from "../lib/hashpackWallet";
import {
  countUnreadThreads,
  readLastReadMap,
  THREADS_READ_EVENT,
  type InboxThread,
} from "../lib/unreadThreads";

const POLL_MS = 15_000;

/**
 * Distinct unread threads for the messages dock badge. Polls inbox and
 * subtracts locally last-read threads. Not a total-message count.
 */
export function useUnreadCount(): number {
  const { address } = useHashpackWallet();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!address) {
      setCount(0);
      return;
    }

    let stopped = false;

    const refresh = async () => {
      try {
        const res = await fetch(
          `${getApiUrl()}/api/messages/inbox?address=${encodeURIComponent(address)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { conversations?: InboxThread[] };
        if (stopped) return;
        setCount(countUnreadThreads(data.conversations ?? [], address, readLastReadMap()));
      } catch {
        // network hiccup — keep current count
      }
    };

    void refresh();
    const iv = setInterval(() => void refresh(), POLL_MS);
    const onRead = () => void refresh();
    window.addEventListener(THREADS_READ_EVENT, onRead);
    return () => {
      stopped = true;
      clearInterval(iv);
      window.removeEventListener(THREADS_READ_EVENT, onRead);
    };
  }, [address]);

  return count;
}
