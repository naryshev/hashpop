"use client";

import { useEffect, useState } from "react";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { getApiUrl } from "../lib/apiUrl";

const POLL_INTERVAL = 15_000;

export function useUnreadCount() {
  const { address } = useHashpackWallet();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!address) {
      setCount(0);
      return;
    }

    let cancelled = false;

    const fetch_ = () => {
      fetch(`${getApiUrl()}/api/messages/unread-count?address=${encodeURIComponent(address)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { count?: number } | null) => {
          if (!cancelled) setCount(data?.count ?? 0);
        })
        .catch(() => {});
    };

    fetch_();
    const id = setInterval(fetch_, POLL_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [address]);

  return count;
}
