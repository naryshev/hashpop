/** Client listing reads must end. A hung request cannot leave "Loading…" up. */
export const LISTING_CLIENT_FETCH_TIMEOUT_MS = 8_000;
export const LISTING_CLIENT_MAX_ATTEMPTS = 5;
export const LISTING_CLIENT_RETRY_DELAY_MS = 1_600;

export type LoadedListing = { id: string };

export type ListingLoadSettlement =
  | { phase: "ready"; listing: LoadedListing }
  | { phase: "missing" }
  | { phase: "unavailable" };

type ListingResponse = {
  status: number;
  ok: boolean;
  json: () => Promise<unknown>;
};

type FetchLike = (url: string, init: { signal: AbortSignal }) => Promise<ListingResponse>;

async function fetchListingAttempt(
  url: string,
  timeoutMs: number,
  fetchImpl: FetchLike,
): Promise<ListingLoadSettlement> {
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (res.status === 404) return { phase: "missing" };
    if (!res.ok) return { phase: "unavailable" };
    const data = (await res.json()) as { listing?: LoadedListing | null };
    if (!data?.listing?.id) return { phase: "unavailable" };
    return { phase: "ready", listing: data.listing };
  } catch {
    return { phase: "unavailable" };
  }
}

/**
 * Confirmed 404 settles immediately. Transient failures retry, and each
 * attempt aborts on timeout so the caller always gets a terminal phase.
 */
export async function resolveListingRefresh(options: {
  url: string;
  timeoutMs: number;
  maxAttempts: number;
  retryDelayMs: number;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
}): Promise<ListingLoadSettlement> {
  const fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
  const sleep =
    options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const attempts = Math.max(1, options.maxAttempts);
  let last: ListingLoadSettlement = { phase: "unavailable" };
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await sleep(options.retryDelayMs);
    last = await fetchListingAttempt(options.url, options.timeoutMs, fetchImpl);
    if (last.phase === "ready" || last.phase === "missing") return last;
  }
  return last;
}
