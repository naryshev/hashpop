/**
 * Hedera mirror timestamps are `seconds.nanoseconds` with 9 fractional digits.
 * parseFloat drops digits past ~15 significant figures, so `gt:` built from
 * the number is still less than the original timestamp and the same log is
 * returned on every poll.
 */
export function normalizeMirrorTimestamp(raw: unknown): string | null {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw <= 0) return null;
    if (raw > 1e15) return nanosToStamp(BigInt(Math.round(raw)));
    return nanosToStamp(BigInt(Math.round(raw * 1e9)));
  }
  const text = String(raw).trim();
  if (!text || text === "0") return null;
  if (text.includes(".")) {
    const [sec, frac = ""] = text.split(".");
    if (!/^\d+$/.test(sec) || !/^\d*$/.test(frac)) return null;
    const nanos = (frac + "000000000").slice(0, 9);
    return `${sec.replace(/^0+(?=\d)/, "")}.${nanos}`;
  }
  if (!/^\d+$/.test(text)) return null;
  const whole = BigInt(text);
  if (whole > 10n ** 15n) return nanosToStamp(whole);
  return `${text.replace(/^0+(?=\d)/, "")}.000000000`;
}

export function mirrorTimestampFromEvent(
  event: { timestamp?: unknown } | null | undefined,
): string | null {
  if (!event || event.timestamp == null || event.timestamp === "") return null;
  return normalizeMirrorTimestamp(event.timestamp);
}

export function advanceMirrorCursor(current: string, next: string | null): string {
  if (!next) return current || "0";
  const currentNorm = !current || current === "0" ? null : normalizeMirrorTimestamp(current);
  if (!currentNorm) return next;
  return compareStamps(next, currentNorm) > 0 ? next : currentNorm;
}

export function mirrorLogQuery(since: number | string): Record<string, string | number> {
  const cursor =
    typeof since === "number" ? (since > 0 ? normalizeMirrorTimestamp(since) : null) : since;
  const normalized = !cursor || cursor === "0" ? null : normalizeMirrorTimestamp(cursor);
  if (!normalized) return { limit: 100, order: "desc" };
  return { limit: 100, timestamp: `gt:${normalized}`, order: "asc" };
}

function nanosToStamp(nanos: bigint): string {
  const sec = nanos / 1_000_000_000n;
  const frac = (nanos % 1_000_000_000n).toString().padStart(9, "0");
  return `${sec.toString()}.${frac}`;
}

function compareStamps(left: string, right: string): number {
  const [leftSec, leftFrac] = left.split(".");
  const [rightSec, rightFrac] = right.split(".");
  const secCmp = BigInt(leftSec) - BigInt(rightSec);
  if (secCmp !== 0n) return secCmp > 0n ? 1 : -1;
  const fracCmp = BigInt(leftFrac || "0") - BigInt(rightFrac || "0");
  if (fracCmp !== 0n) return fracCmp > 0n ? 1 : -1;
  return 0;
}
