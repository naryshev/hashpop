"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "../lib/apiUrl";
import { useHashpackWallet } from "../lib/hashpackWallet";
import {
  buildDealNotifications,
  DEAL_UPDATES_SEEN_EVENT,
  dealDotTone,
  markDealUpdatesSeen,
  readDealUpdatesSeenAt,
  unreadDealNotifications,
  type DealNotification,
} from "../lib/dealNotifications";

const POLL_MS = 30_000;

export { markDealUpdatesSeen };

type OffersPayload = {
  received?: Parameters<typeof buildDealNotifications>[0]["receivedOffers"];
  sent?: Parameters<typeof buildDealNotifications>[0]["sentOffers"];
};

type PurchasesPayload = {
  purchases?: Parameters<typeof buildDealNotifications>[0]["purchases"];
};

type RatingsPayload = {
  ratings?: Parameters<typeof buildDealNotifications>[0]["ratings"];
};

async function jsonIfOk<T>(res: PromiseSettledResult<Response>): Promise<T | null> {
  if (res.status !== "fulfilled" || !res.value.ok) return null;
  try {
    return (await res.value.json()) as T;
  } catch {
    return null;
  }
}

export function useDealNotifications(): {
  items: DealNotification[];
  unseen: DealNotification[];
  tone: "mint" | "red" | null;
  loading: boolean;
} {
  const { address } = useHashpackWallet();
  const [items, setItems] = useState<DealNotification[]>([]);
  const [seenAt, setSeenAt] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSeenAt(readDealUpdatesSeenAt());
    const onSeen = () => setSeenAt(readDealUpdatesSeenAt());
    window.addEventListener(DEAL_UPDATES_SEEN_EVENT, onSeen);
    return () => window.removeEventListener(DEAL_UPDATES_SEEN_EVENT, onSeen);
  }, []);

  useEffect(() => {
    if (!address) {
      setItems([]);
      setLoading(false);
      return;
    }

    let stopped = false;
    let first = true;
    const api = getApiUrl();
    const lower = address.toLowerCase();

    const refresh = async () => {
      if (first) setLoading(true);
      try {
        const [oRes, pRes, rRes] = await Promise.allSettled([
          fetch(`${api}/api/user/${encodeURIComponent(lower)}/offers`),
          fetch(`${api}/api/user/${encodeURIComponent(lower)}/purchases`),
          fetch(`${api}/api/ratings/${encodeURIComponent(lower)}`),
        ]);
        if (stopped) return;
        const offers = await jsonIfOk<OffersPayload>(oRes);
        const purchases = await jsonIfOk<PurchasesPayload>(pRes);
        const ratings = await jsonIfOk<RatingsPayload>(rRes);
        if (stopped) return;
        setItems(
          buildDealNotifications({
            address: lower,
            receivedOffers: offers?.received ?? [],
            sentOffers: offers?.sent ?? [],
            purchases: purchases?.purchases ?? [],
            ratings: ratings?.ratings ?? [],
          }),
        );
        first = false;
      } catch {
        // keep current
      } finally {
        if (!stopped) setLoading(false);
      }
    };

    void refresh();
    const iv = setInterval(() => void refresh(), POLL_MS);
    return () => {
      stopped = true;
      clearInterval(iv);
    };
  }, [address]);

  const unseen = unreadDealNotifications(items, seenAt);
  return {
    items,
    unseen,
    tone: dealDotTone(unseen),
    loading,
  };
}
