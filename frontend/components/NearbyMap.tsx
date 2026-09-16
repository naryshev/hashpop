"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { MapPin, Navigation, X } from "lucide-react";
import { getApiUrl } from "../lib/apiUrl";
import { SEARCH_UNAVAILABLE_COPY, probeGeocodeAvailable, searchGeocode } from "../lib/geocode";
import { MAP_LOADER_CLASS } from "../lib/mapTiles";
import { MobileTopBar } from "./MobileTopBar";
import type { NearbyItem } from "./NearbyMapInner";

const NearbyMapInner = dynamic(() => import("./NearbyMapInner"), {
  ssr: false,
  loading: () => <div className={`h-full w-full ${MAP_LOADER_CLASS}`}>Loading map…</div>,
});

const DEFAULT_CENTER: [number, number] = [39.5, -98.35];

type Phase = "locating" | "need-area" | "ready";

function isFiniteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function NearbyMap({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("locating");
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [items, setItems] = useState<NearbyItem[]>([]);
  const [areaInput, setAreaInput] = useState("");
  const [areaError, setAreaError] = useState<string | null>(null);
  const [areaSearching, setAreaSearching] = useState(false);
  const [searchAvailable, setSearchAvailable] = useState(true);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void probeGeocodeAvailable().then((ok) => {
      if (!cancelled) setSearchAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`${getApiUrl()}/api/listings`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { listings?: Record<string, unknown>[] }) => {
        if (cancelled) return;
        const list = (data.listings ?? [])
          .map((l) => ({
            id: String(l.id ?? ""),
            title: (l.title as string) ?? null,
            price: (l.price as string)?.toString?.() ?? (l.price as string) ?? null,
            lat: l.locationLat as number,
            lng: l.locationLng as number,
          }))
          .filter((l) => l.id && isFiniteNum(l.lat) && isFiniteNum(l.lng));
        setItems(list);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setPhase("locating");
    setAreaError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPhase("need-area");
      return;
    }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const p: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(p);
        setCenter(p);
        setPhase("ready");
      },
      () => {
        if (!cancelled) setPhase("need-area");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
    return () => {
      cancelled = true;
    };
  }, [open]);

  const submitArea = useCallback(async () => {
    const q = areaInput.trim();
    if (!q || !searchAvailable) return;
    setAreaSearching(true);
    setAreaError(null);
    try {
      const result = await searchGeocode(q);
      if (!result.available) {
        setSearchAvailable(false);
        setAreaError(SEARCH_UNAVAILABLE_COPY);
        return;
      }
      const hit = result.suggestions[0];
      if (!hit || !isFiniteNum(hit.lat) || !isFiniteNum(hit.lng)) {
        setAreaError("Couldn't find that place. Try a city or ZIP code.");
        return;
      }
      setCenter([hit.lat, hit.lng]);
      setUserPos(null);
      setPhase("ready");
    } catch {
      setAreaError("Search failed. Try again.");
    } finally {
      setAreaSearching(false);
    }
  }, [areaInput, searchAvailable]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="bg-app fixed inset-0 z-[50] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Items near you"
    >
      <MobileTopBar className="px-3 pt-4" />
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-3 py-3">
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-chrome" />
          <h2 className="text-base font-bold text-white">Items near you</h2>
          {phase === "ready" && (
            <span className="text-xs text-silver/70">{items.length} on map</span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-material-regular text-white hover:bg-white/10"
        >
          <X size={18} />
        </button>
      </div>

      <div className="relative flex-1 bg-bg">
        {phase === "locating" && (
          <div className={`h-full w-full ${MAP_LOADER_CLASS}`}>Finding your location…</div>
        )}

        {phase === "need-area" && (
          <div className="mx-auto flex h-full w-full max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
            <Navigation size={28} className="text-chrome" />
            <div>
              <p className="text-base font-semibold text-white">Where should we look?</p>
              <p className="mt-1 text-sm text-silver">
                Location access is off. Enter your city or ZIP code to see items nearby.
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitArea();
              }}
              className="w-full"
            >
              <input
                value={areaInput}
                onChange={(e) => setAreaInput(e.target.value)}
                disabled={!searchAvailable}
                placeholder={searchAvailable ? "City or ZIP code" : SEARCH_UNAVAILABLE_COPY}
                className="w-full rounded-[14px] border border-hairline bg-material-regular px-3 py-2.5 text-sm text-white placeholder:text-muted focus:border-chrome/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
              {areaError && <p className="mt-2 text-xs text-rose-300">{areaError}</p>}
              {!searchAvailable && !areaError && (
                <p className="mt-2 text-xs text-silver">{SEARCH_UNAVAILABLE_COPY}</p>
              )}
              <button
                type="submit"
                disabled={!searchAvailable || !areaInput.trim() || areaSearching}
                className="mt-3 w-full rounded-full bg-cta px-5 py-2.5 text-sm font-bold text-on-chrome disabled:opacity-60"
              >
                {areaSearching ? "Searching…" : "Show items here"}
              </button>
            </form>
          </div>
        )}

        {phase === "ready" && <NearbyMapInner center={center} userPos={userPos} items={items} />}
      </div>
    </div>,
    document.body,
  );
}
