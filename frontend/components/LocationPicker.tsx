"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  GEOCODE_DEBOUNCE_MS,
  SEARCH_UNAVAILABLE_COPY,
  probeGeocodeAvailable,
  searchGeocode,
  type GeocodeHit,
} from "../lib/geocode";
import { MAP_LOADER_CLASS } from "../lib/mapTiles";
import { roundCoordForPrivacy } from "../lib/privacyCoords";

const LocationPickerMap = dynamic(() => import("./LocationPickerMap"), {
  ssr: false,
  loading: () => <div className={`aspect-[16/9] ${MAP_LOADER_CLASS}`}>Loading map…</div>,
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

export function LocationPicker({ value, onChange }: Props) {
  const [query, setQuery] = useState(value.city ?? "");
  const [suggestions, setSuggestions] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [showList, setShowList] = useState(false);
  const [searchAvailable, setSearchAvailable] = useState(true);
  const [geoProximity, setGeoProximity] = useState<{ lat: number; lng: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(value.city ?? "");
  }, [value.city]);

  useEffect(() => {
    let cancelled = false;
    void probeGeocodeAvailable().then((ok) => {
      if (!cancelled) setSearchAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!cancelled) {
          setGeoProximity({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      },
      () => {},
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchAvailable) {
      setSuggestions([]);
      return;
    }
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    if (trimmed === (value.city ?? "")) return;
    const proximity =
      value.lat != null && value.lng != null
        ? { lat: value.lat, lng: value.lng }
        : (geoProximity ?? undefined);
    debounceRef.current = setTimeout(async () => {
      try {
        setSearching(true);
        const result = await searchGeocode(trimmed, proximity);
        if (!result.available) {
          setSearchAvailable(false);
          setSuggestions([]);
          return;
        }
        setSuggestions(result.suggestions.slice(0, 5));
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, GEOCODE_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, value.city, value.lat, value.lng, searchAvailable, geoProximity]);

  const pick = (hit: GeocodeHit) => {
    const lat = roundCoordForPrivacy(hit.lat);
    const lng = roundCoordForPrivacy(hit.lng);
    if (lat == null || lng == null) return;
    setQuery(hit.label);
    setSuggestions([]);
    setShowList(false);
    onChange({ city: hit.label, lat, lng });
  };

  const handleMapPick = (lat: number, lng: number) => {
    const rLat = roundCoordForPrivacy(lat);
    const rLng = roundCoordForPrivacy(lng);
    if (rLat == null || rLng == null) return;
    onChange({ city: value.city, lat: rLat, lng: rLng });
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
          disabled={!searchAvailable}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowList(true);
          }}
          onFocus={() => setShowList(true)}
          onBlur={() => {
            blurTimeoutRef.current = setTimeout(() => setShowList(false), 150);
          }}
          className="w-full rounded-[14px] border border-hairline bg-material-regular px-3 py-2.5 text-sm text-white placeholder:text-muted focus:border-chrome/40 focus:outline-none focus:ring-1 focus:ring-chrome/40 disabled:cursor-not-allowed disabled:opacity-60"
          placeholder={searchAvailable ? "Search city or ZIP" : SEARCH_UNAVAILABLE_COPY}
        />
        {(value.lat != null || query) && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-1 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center text-xs text-silver hover:text-white"
            aria-label="Clear location"
          >
            Clear
          </button>
        )}
        {showList && searchAvailable && suggestions.length > 0 && (
          <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-[14px] border border-hairline bg-material-thick shadow-lg">
            {suggestions.map((s, i) => (
              <li key={`${s.lat}-${s.lng}-${i}`}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(s);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-silver hover:bg-white/10 hover:text-white"
                >
                  {s.label}
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
        {searchAvailable
          ? "Approximate area only — exact address stays private."
          : SEARCH_UNAVAILABLE_COPY}
      </p>
      <LocationPickerMap lat={value.lat} lng={value.lng} onPick={handleMapPick} />
      {value.lat != null && value.lng != null && (
        <p className="text-xs text-silver">
          Approximate location
          {value.city ? <span className="text-white/80"> · {value.city}</span> : null}
        </p>
      )}
    </div>
  );
}
