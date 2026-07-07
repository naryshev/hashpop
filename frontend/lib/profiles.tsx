"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getApiUrl } from "./apiUrl";

export type PublicProfile = {
  address: string;
  displayName: string | null;
  avatarUrl: string | null;
  /** Username from the user's HashPack wallet profile, if they've set one. */
  hashpackName: string | null;
  /** Profile-picture URL from the user's HashPack wallet profile, if set. */
  hashpackAvatarUrl: string | null;
  kycVerified: boolean;
  ratingAverage: number | null;
  ratingCount: number;
};

type ProfilesContextValue = {
  cache: Record<string, PublicProfile>;
  request: (addresses: string[]) => void;
};

const ProfilesContext = createContext<ProfilesContextValue | null>(null);

function normalize(address: string | null | undefined): string {
  return (address ?? "").trim().toLowerCase();
}

/**
 * Caches public profile data (display name, avatar, KYC, rating) so display
 * names and trust signals can be rendered anywhere a raw wallet address
 * appears. Requests are batched per tick to avoid N round-trips when many
 * cards mount at once.
 */
export function ProfilesProvider({ children }: { children: React.ReactNode }) {
  const [cache, setCache] = useState<Record<string, PublicProfile>>({});
  const cacheRef = useRef(cache);
  cacheRef.current = cache;
  const pendingRef = useRef<Set<string>>(new Set());
  const inFlightRef = useRef<Set<string>>(new Set());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    flushTimerRef.current = null;
    const batch = Array.from(pendingRef.current);
    pendingRef.current.clear();
    if (batch.length === 0) return;
    batch.forEach((a) => inFlightRef.current.add(a));
    try {
      const res = await fetch(
        `${getApiUrl()}/api/users/profiles?addresses=${encodeURIComponent(batch.join(","))}`,
      );
      if (res.ok) {
        const data = (await res.json()) as { profiles?: Record<string, PublicProfile> };
        if (data.profiles) {
          setCache((prev) => ({ ...prev, ...data.profiles }));
        }
      }
    } catch {
      // Leave uncached; consumers fall back to the raw address.
    } finally {
      batch.forEach((a) => inFlightRef.current.delete(a));
    }
  }, []);

  const request = useCallback(
    (addresses: string[]) => {
      let scheduled = false;
      for (const raw of addresses) {
        const addr = normalize(raw);
        if (!addr) continue;
        if (cacheRef.current[addr] || inFlightRef.current.has(addr)) continue;
        pendingRef.current.add(addr);
        scheduled = true;
      }
      if (scheduled && flushTimerRef.current == null) {
        flushTimerRef.current = setTimeout(() => void flush(), 50);
      }
    },
    [flush],
  );

  const value = useMemo<ProfilesContextValue>(() => ({ cache, request }), [cache, request]);

  return <ProfilesContext.Provider value={value}>{children}</ProfilesContext.Provider>;
}

function useProfilesContext(): ProfilesContextValue {
  const ctx = useContext(ProfilesContext);
  if (ctx) return ctx;
  // No-op fallback when rendered outside the provider (SSR / tests).
  return { cache: {}, request: () => {} };
}

/** Resolve a single address to its public profile (undefined while loading). */
export function useProfile(address: string | null | undefined): PublicProfile | undefined {
  const { cache, request } = useProfilesContext();
  const addr = normalize(address);
  useEffect(() => {
    if (addr) request([addr]);
  }, [addr, request]);
  return addr ? cache[addr] : undefined;
}

/** Resolve many addresses at once; returns the current cache keyed by address. */
export function useProfiles(addresses: (string | null | undefined)[]): Record<string, PublicProfile> {
  const { cache, request } = useProfilesContext();
  const key = addresses.map(normalize).filter(Boolean).sort().join(",");
  useEffect(() => {
    if (key) request(key.split(","));
  }, [key, request]);
  return cache;
}

/**
 * Display name = the HashPack wallet username, or nothing. Site-level custom
 * usernames are intentionally not shown — identity is the wallet: HashPack
 * name when set, Hedera account id (0.0.x) otherwise.
 */
export function profileDisplayName(profile: PublicProfile | undefined): string | null {
  const hp = profile?.hashpackName?.trim();
  return hp ? hp : null;
}

/**
 * Resolve the best avatar URL for a profile, in order: Hashpop-uploaded
 * avatar → HashPack profile picture → null.
 */
export function profileAvatarUrl(profile: PublicProfile | undefined): string | null {
  const own = profile?.avatarUrl?.trim();
  if (own) return own;
  const hp = profile?.hashpackAvatarUrl?.trim();
  return hp ? hp : null;
}
