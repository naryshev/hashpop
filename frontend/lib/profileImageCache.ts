import { getApiUrl } from "./apiUrl";

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

export function getProfileImage(address: string): Promise<string | null> {
  const key = address.toLowerCase();
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);
  if (inflight.has(key)) return inflight.get(key)!;
  const p = fetch(`${getApiUrl()}/api/user/${encodeURIComponent(key)}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { profileImageUrl?: string | null } | null) => {
      const url = d?.profileImageUrl ?? null;
      cache.set(key, url);
      return url;
    })
    .catch(() => {
      cache.set(key, null);
      return null;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function invalidateProfileImage(address: string) {
  cache.delete(address.toLowerCase());
}
