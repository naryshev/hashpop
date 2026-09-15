/**
 * Unread = distinct threads whose latest message is inbound and newer than
 * the last time that thread was opened. Not a sum of messages.
 */

export const THREADS_READ_KEY = "hashpop.threads.read.v1";
export const THREADS_READ_EVENT = "hashpop:threads-read";

export type InboxThread = {
  otherAddress: string;
  listingId?: string | null;
  lastMessage?: {
    fromAddress?: string;
    createdAt?: string;
  } | null;
};

export function threadKey(otherAddress: string, listingId?: string | null): string {
  return `${otherAddress.toLowerCase()}::${listingId ?? ""}`;
}

export function readLastReadMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(THREADS_READ_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

export function markThreadRead(otherAddress: string, listingId?: string | null): void {
  if (typeof window === "undefined") return;
  const map = readLastReadMap();
  map[threadKey(otherAddress, listingId)] = Date.now();
  try {
    window.localStorage.setItem(THREADS_READ_KEY, JSON.stringify(map));
  } catch {
    // storage full/blocked — badge just stays until it works
  }
  window.dispatchEvent(new Event(THREADS_READ_EVENT));
}

export function countUnreadThreads(
  conversations: InboxThread[],
  myAddress: string,
  lastRead: Record<string, number> = {},
): number {
  const me = myAddress.trim().toLowerCase();
  if (!me) return 0;
  let n = 0;
  for (const c of conversations) {
    const m = c.lastMessage;
    if (!m?.createdAt) continue;
    if ((m.fromAddress || "").toLowerCase() === me) continue;
    const t = new Date(m.createdAt).getTime();
    if (!Number.isFinite(t)) continue;
    const seen = lastRead[threadKey(c.otherAddress, c.listingId)] ?? 0;
    if (t > seen) n += 1;
  }
  return n;
}
