"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { MapPin, Navigation, X } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { getApiUrl } from "../lib/apiUrl";
import { MobileTopBar } from "./MobileTopBar";
import type { NearbyItem } from "./NearbyMapInner";

const NearbyMapInner = dynamic(() => import("./NearbyMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-silver">
      Loading map…
    </div>
  ),
});

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
// Fallback center (continental US) when we have neither GPS nor an area yet.
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

  useEffect(() => setMounted(true), []);

  // Pull listings that have coordinates whenever the sheet opens.
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

  // Try geolocation each time the sheet opens.
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
    if (!q) return;
    setAreaSearching(true);
    setAreaError(null);
    try {
      const url = `${NOMINATIM_BASE}/search?format=json&addressdetails=0&limit=1&q=${encodeURIComponent(
        q,
      )}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { lat: string; lon: string }[];
      const hit = data?.[0];
      const lat = hit ? parseFloat(hit.lat) : NaN;
      const lng = hit ? parseFloat(hit.lon) : NaN;
      if (!isFiniteNum(lat) || !isFiniteNum(lng)) {
        setAreaError("Couldn't find that place. Try a city or ZIP code.");
        return;
      }
      setCenter([lat, lng]);
      setUserPos(null);
      setPhase("ready");
    } catch {
      setAreaError("Search failed. Try again.");
    } finally {
      setAreaSearching(false);
    }
  }, [areaInput]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      // Below the floating bottom nav (z-60) so the nav stays visible and
      // usable over the map, like on every other page.
      className="bg-app fixed inset-0 z-[50] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Items near you"
    >
      {/* Same offsets as the marketplace header (page container px-3 py-4)
          so the logo / bell / wallet pill sit identically across surfaces. */}
      <MobileTopBar className="px-3 pt-4" />
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-3">
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-[#00ffa3]" />
          <h2 className="text-base font-bold text-white">Items near you</h2>
          {phase === "ready" && (
            <span className="text-xs text-silver/70">{items.length} on map</span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white hover:bg-white/10"
        >
          <X size={18} />
        </button>
      </div>

      <div className="relative flex-1">
        {phase === "locating" && (
          <div className="flex h-full w-full items-center justify-center text-sm text-silver">
            Finding your location…
          </div>
        )}

        {phase === "need-area" && (
          <div className="mx-auto flex h-full w-full max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
            <Navigation size={28} className="text-[#00ffa3]" />
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
                placeholder="City or ZIP code"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-silver/50 focus:border-[#00ffa3]/40 focus:outline-none"
              />
              {areaError && <p className="mt-2 text-xs text-rose-300">{areaError}</p>}
              <button
                type="submit"
                disabled={!areaInput.trim() || areaSearching}
                className="mt-3 w-full rounded-full bg-[linear-gradient(110deg,#00b37a,#00ffa3,#00e5ff)] px-5 py-2.5 text-sm font-bold text-black disabled:opacity-60"
              >
                {areaSearching ? "Searching…" : "Show items here"}
              </button>
            </form>
          </div>
        )}

        {phase === "ready" && (
          <NearbyMapInner center={center} userPos={userPos} items={items} />
        )}
      </div>
    </div>,
    document.body,
  );
}
