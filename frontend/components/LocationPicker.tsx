"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

const LocationPickerMap = dynamic(() => import("./LocationPickerMap"), {
  ssr: false,
  loading: () => (
    <div className="aspect-[16/7] w-full rounded-glass border border-white/10 bg-white/5 flex items-center justify-center text-silver text-sm">
      Loading map…
    </div>
  ),
});

export type LocationValue = {
  city: string | null;
  lat: number | null;
  lng: number | null;
};

type Props = {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
};

type Suggestion = {
  display_name: string;
  lat: string;
  lon: string;
};

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

export function LocationPicker({ value, onChange }: Props) {
  const [query, setQuery] = useState(value.city ?? "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [showList, setShowList] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(value.city ?? "");
  }, [value.city]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    if (trimmed === (value.city ?? "")) return;
    debounceRef.current = setTimeout(async () => {
      try {
        setSearching(true);
        const url = `${NOMINATIM_BASE}/search?format=json&addressdetails=0&limit=5&featuretype=city&q=${encodeURIComponent(trimmed)}`;
        const res = await fetch(url, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Suggestion[];
        setSuggestions(Array.isArray(data) ? data.slice(0, 5) : []);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, value.city]);

  const pick = (s: Suggestion) => {
    const lat = Math.round(parseFloat(s.lat) * 100) / 100;
    const lng = Math.round(parseFloat(s.lon) * 100) / 100;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const cityLabel = s.display_name.split(",").slice(0, 2).join(", ");
      setQuery(cityLabel);
      setSuggestions([]);
      setShowList(false);
      onChange({ city: cityLabel, lat, lng });
    }
  };

  const handleMapPick = async (lat: number, lng: number) => {
    const rLat = Math.round(lat * 100) / 100;
    const rLng = Math.round(lng * 100) / 100;
    let cityLabel: string | null = value.city ?? null;
    try {
      const res = await fetch(
        `${NOMINATIM_BASE}/reverse?format=json&zoom=10&lat=${rLat}&lon=${rLng}`,
        { headers: { Accept: "application/json" } },
      );
      if (res.ok) {
        const data = (await res.json()) as {
          display_name?: string;
          address?: {
            city?: string;
            town?: string;
            village?: string;
            state?: string;
            country?: string;
          };
        };
        const a = data.address || {};
        const place = a.city || a.town || a.village;
        cityLabel =
          [place, a.state, a.country].filter(Boolean).join(", ") ||
          (data.display_name ? data.display_name.split(",").slice(0, 2).join(", ") : null);
      }
    } catch {
      // network failures shouldn't block pin drop — keep prior city label
    }
    setQuery(cityLabel ?? "");
    onChange({ city: cityLabel, lat: rLat, lng: rLng });
  };

  const clear = () => {
    setQuery("");
    setSuggestions([]);
    onChange({ city: null, lat: null, lng: null });
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowList(true);
          }}
          onFocus={() => setShowList(true)}
          onBlur={() => {
            blurTimeoutRef.current = setTimeout(() => setShowList(false), 150);
          }}
          className="input-frost w-full"
          placeholder="Search for a city (e.g. Los Angeles)"
        />
        {(value.lat != null || query) && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-silver hover:text-white px-2"
            aria-label="Clear location"
          >
            Clear
          </button>
        )}
        {showList && suggestions.length > 0 && (
          <ul className="absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-auto rounded-glass border border-white/15 bg-[#0b1220]/95 backdrop-blur-md shadow-lg">
            {suggestions.map((s, i) => (
              <li key={`${s.lat}-${s.lon}-${i}`}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(s);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-silver hover:bg-white/10 hover:text-white"
                >
                  {s.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {searching && (
          <p className="absolute right-14 top-1/2 -translate-y-1/2 text-xs text-silver/70">…</p>
        )}
      </div>
      <p className="text-xs text-silver/70">
        Pick a city above, or click the map to drop a pin. Coordinates are rounded to ~1km for
        privacy.
      </p>
      <LocationPickerMap lat={value.lat} lng={value.lng} onPick={handleMapPick} />
      {value.lat != null && value.lng != null && (
        <p className="text-xs text-silver">
          Approximate location set
          {value.city ? <span className="text-white/80"> · {value.city}</span> : null}
        </p>
      )}
    </div>
  );
}
