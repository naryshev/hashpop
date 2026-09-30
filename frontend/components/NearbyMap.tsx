"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { ChevronDown, LocateFixed, Search, SlidersHorizontal } from "lucide-react";
import { getApiUrl } from "../lib/apiUrl";
import {
  GEOCODE_DEBOUNCE_MS,
  SEARCH_UNAVAILABLE_COPY,
  probeGeocodeAvailable,
  searchGeocode,
  type GeocodeHit,
} from "../lib/geocode";
import { MAP_LOADER_CLASS, NEARBY_DEFAULT_ZOOM, type MapViewSnapshot } from "../lib/mapTiles";
import {
  NEARBY_PRICE_BANDS,
  nearbyCountLabel,
  parseNearbyListing,
  selectNearbySheet,
  filterNearbyListings,
  type NearbyListing,
  type NearbyPriceBand,
  type NearbySheetItem,
} from "../lib/nearbyListings";
import { isUsaZip, preferUsaPostalHits } from "../lib/usaZip";
import { LISTING_CONDITIONS } from "../lib/listingConditions";
import type { ListingType } from "../lib/marketplaceFilters";
import { material } from "../lib/materials";
import { useProfiles } from "../lib/profiles";
import { cn } from "../lib/utils";
import { ListingCard } from "./ListingCard";

const NearbyMapInner = dynamic(() => import("./NearbyMapInner"), {
  ssr: false,
  loading: () => <div className={`h-full w-full ${MAP_LOADER_CLASS}`}>Loading map…</div>,
});

const DEFAULT_CENTER = { lat: 39.5, lng: -98.35 };
const USA_ZIP_ONLY = "US ZIP codes only";
/** Digits of a ZIP or ZIP+4 while the user is still typing. */
const ZIP_IN_PROGRESS = /^\d{1,5}(?:-\d{0,4})?$/;

type Camera = {
  lat: number;
  lng: number;
  zoom: number;
  keepZoom: boolean;
};

type FilterId = "type" | "price" | "condition";
type SheetDetent = "hidden" | "peek" | "open";

const LISTING_TYPES: { id: ListingType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "physical", label: "Physical" },
  { id: "digital", label: "Digital" },
];

function locationLines(label: string | null, locating: boolean, hasUser: boolean) {
  if (label) {
    const parts = label
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    return {
      primary: parts[0] || label,
      subline: parts.slice(1).join(", ") || "United States",
    };
  }
  if (locating) return { primary: "Current location", subline: "Finding you…" };
  if (!hasUser) return { primary: "Current location", subline: "Location off" };
  return { primary: "Current location", subline: "Near you" };
}

function Chip({
  testId,
  label,
  pressed,
  open,
  onClick,
}: {
  testId: string;
  label: string;
  pressed: boolean;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-expanded={open}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[12px] font-semibold",
        pressed || open
          ? "border-chrome/40 bg-[#00ffa3]/10 text-chrome"
          : "border-white/10 bg-white/[0.04] text-white/90",
      )}
    >
      {label}
      <ChevronDown size={14} aria-hidden className={cn("opacity-70", open && "rotate-180")} />
    </button>
  );
}

function FilterMenu({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      role="listbox"
      aria-label={label}
      className="absolute left-0 top-[calc(100%+6px)] z-30 min-w-[10.5rem] rounded-2xl border border-white/10 bg-[#121a29] p-1 shadow-xl"
    >
      {children}
    </div>
  );
}

function MenuOption({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "block w-full rounded-xl px-3 py-2 text-left text-sm font-medium",
        selected ? "bg-[#00ffa3]/10 text-chrome" : "text-white hover:bg-white/5",
      )}
    >
      {children}
    </button>
  );
}

export function NearbyMap({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [locating, setLocating] = useState(false);
  const [camera, setCamera] = useState<Camera>({
    lat: DEFAULT_CENTER.lat,
    lng: DEFAULT_CENTER.lng,
    zoom: 3,
    keepZoom: false,
  });
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [listings, setListings] = useState<NearbyListing[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [mapView, setMapView] = useState<MapViewSnapshot | null>(null);
  const [query, setQuery] = useState("");
  const [listingType, setListingType] = useState<ListingType>("all");
  const [priceBand, setPriceBand] = useState<NearbyPriceBand>("any");
  const [condition, setCondition] = useState("");
  const [filter, setFilter] = useState<FilterId | null>(null);
  const [detent, setDetent] = useState<SheetDetent>("peek");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeHits, setPlaceHits] = useState<GeocodeHit[]>([]);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [searchAvailable, setSearchAvailable] = useState(true);
  const filterRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const dragStart = useRef<number | null>(null);
  const dragged = useRef(false);
  const [mapPadding, setMapPadding] = useState({ top: 16, right: 0, bottom: 340, left: 0 });

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
    setLoadError(false);
    fetch(`${getApiUrl()}/api/listings`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((data: { listings?: unknown[] }) => {
        if (cancelled) return;
        setListings((data.listings ?? []).map(parseNearbyListing).filter((item) => item != null));
      })
      .catch(() => {
        if (!cancelled) {
          setListings([]);
          setLoadError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLocating(true);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocating(false);
      return;
    }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const next: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(next);
        setCamera({
          lat: next[0],
          lng: next[1],
          zoom: NEARBY_DEFAULT_ZOOM,
          keepZoom: false,
        });
        setLocating(false);
      },
      () => {
        if (cancelled) return;
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (detent === "hidden" || !searchAvailable) return;
    const q = placeQuery.trim();
    if (!q) {
      setPlaceHits([]);
      setPlaceError(null);
      return;
    }
    if (!ZIP_IN_PROGRESS.test(q)) {
      setPlaceHits([]);
      setPlaceError(USA_ZIP_ONLY);
      return;
    }
    if (!isUsaZip(q)) {
      setPlaceHits([]);
      setPlaceError(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void searchGeocode(q, userPos ? { lat: userPos[0], lng: userPos[1] } : undefined, {
        country: "us",
      })
        .then((result) => {
          if (cancelled) return;
          if (!result.available) {
            setSearchAvailable(false);
            setPlaceError(SEARCH_UNAVAILABLE_COPY);
            setPlaceHits([]);
            return;
          }
          const hits = preferUsaPostalHits(result.suggestions).slice(0, 5);
          setPlaceHits(hits);
          setPlaceError(hits.length === 0 ? USA_ZIP_ONLY : null);
        })
        .catch(() => {
          if (!cancelled) setPlaceError("Search failed. Try again.");
        });
    }, GEOCODE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [detent, placeQuery, searchAvailable, userPos]);

  useEffect(() => {
    if (!filter) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && filterRef.current?.contains(target)) return;
      setFilter(null);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [filter]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && chromeRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [menuOpen]);

  const criteria = useMemo(
    () => ({ query, listingType, priceBand, condition }),
    [condition, listingType, priceBand, query],
  );
  const pins = useMemo(() => filterNearbyListings(listings, criteria), [criteria, listings]);
  const sheet = useMemo(
    () =>
      selectNearbySheet(listings, {
        ...criteria,
        bounds: mapView?.bounds ?? null,
        focus: mapView?.center ?? { lat: camera.lat, lng: camera.lng },
        pinId: activeId,
      }),
    [activeId, camera.lat, camera.lng, criteria, listings, mapView],
  );

  useEffect(() => {
    if (!open) return;
    const sheetEl = sheetRef.current;
    if (!sheetEl) return;
    const update = () => {
      const rect = sheetEl.getBoundingClientRect();
      const wide =
        typeof window.matchMedia === "function" && window.matchMedia("(min-width: 768px)").matches;
      const next = wide
        ? {
            top: 16,
            right: Math.max(0, Math.round(window.innerWidth - rect.left)),
            bottom: 24,
            left: 24,
          }
        : {
            top: 16,
            right: 0,
            bottom: Math.min(
              Math.max(0, Math.round(window.innerHeight - rect.top)),
              Math.max(0, window.innerHeight - 16 - 120),
            ),
            left: 0,
          };
      setMapPadding((prev) =>
        prev.top === next.top &&
        prev.right === next.right &&
        prev.bottom === next.bottom &&
        prev.left === next.left
          ? prev
          : next,
      );
    };
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(sheetEl);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [detent, mounted, open]);

  useProfiles(listings.map((listing) => listing.seller));

  useEffect(() => {
    if (!activeId || detent === "hidden") return;
    const escaped = window.CSS?.escape ? window.CSS.escape(activeId) : activeId;
    document.querySelector(`[data-nearby-card="${escaped}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeId, detent]);

  const selectListing = useCallback(
    (id: string) => {
      setActiveId(id);
      setDetent((current) => (current === "hidden" ? "peek" : current));
      const item = listings.find((listing) => listing.id === id);
      if (!item) return;
      setCamera((cameraNow) => ({
        lat: item.lat,
        lng: item.lng,
        zoom: cameraNow.zoom,
        keepZoom: true,
      }));
    },
    [listings],
  );

  const locateMe = useCallback(() => {
    setPlaceLabel(null);
    setPlaceQuery("");
    setPlaceHits([]);
    setPlaceError(null);
    setMenuOpen(false);
    if (userPos) {
      setCamera({
        lat: userPos[0],
        lng: userPos[1],
        zoom: NEARBY_DEFAULT_ZOOM,
        keepZoom: false,
      });
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setDetent((current) => (current === "hidden" ? "peek" : current));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(next);
        setCamera({
          lat: next[0],
          lng: next[1],
          zoom: NEARBY_DEFAULT_ZOOM,
          keepZoom: false,
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setDetent((current) => (current === "hidden" ? "peek" : current));
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 },
    );
  }, [userPos]);

  const choosePlace = useCallback((hit: GeocodeHit) => {
    setCamera({
      lat: hit.lat,
      lng: hit.lng,
      zoom: NEARBY_DEFAULT_ZOOM,
      keepZoom: false,
    });
    setPlaceLabel(hit.label);
    setMenuOpen(false);
    setPlaceHits([]);
    setPlaceQuery("");
    setPlaceError(null);
  }, []);

  const onMapClick = useCallback(() => {
    setDetent((current) => (current === "hidden" ? "peek" : "hidden"));
  }, []);

  const toggleFilter = (id: FilterId) => setFilter((current) => (current === id ? null : id));

  const onGrabPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragStart.current = event.clientY;
    dragged.current = false;
  };
  const onGrabPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStart.current == null) return;
    const delta = event.clientY - dragStart.current;
    dragStart.current = null;
    if (Math.abs(delta) < 36) return;
    dragged.current = true;
    setDetent((current) => {
      if (delta < 0) return current === "hidden" ? "peek" : "open";
      return current === "open" ? "peek" : "hidden";
    });
  };
  const onHandleClick = () => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    setDetent((current) =>
      current === "hidden" ? "peek" : current === "open" ? "peek" : "hidden",
    );
  };

  if (!mounted || !open) return null;

  const typeChip =
    listingType === "all" ? "Type" : listingType === "physical" ? "Physical" : "Digital";
  const priceChip = NEARBY_PRICE_BANDS.find((band) => band.id === priceBand)?.chip ?? "Price ℏ";
  const conditionChip = condition || "Condition";
  const place = locationLines(placeLabel, locating, userPos != null);
  const zipPlaceholder = placeLabel
    ? place.primary
    : locating
      ? "Finding you…"
      : userPos
        ? "Current location"
        : "Location off";

  return createPortal(
    <div
      className="fixed inset-0 z-[50] bg-bg"
      role="dialog"
      aria-modal="false"
      aria-label="Nearby"
      data-testid="nearby-root"
    >
      <div className="absolute inset-0">
        <NearbyMapInner
          center={[camera.lat, camera.lng]}
          zoom={camera.zoom}
          keepZoom={camera.keepZoom}
          padding={mapPadding}
          userPos={userPos}
          items={pins}
          activeId={activeId}
          onSelect={selectListing}
          onViewChange={setMapView}
          onMapClick={onMapClick}
        />
      </div>

      <button
        type="button"
        data-testid="nearby-locate-fab"
        aria-label="Current location"
        aria-busy={locating}
        onClick={locateMe}
        className={cn(
          material.regular,
          "absolute right-3 z-30 flex h-11 w-11 items-center justify-center rounded-full text-chrome shadow-[0_8px_24px_rgba(0,0,0,0.35)]",
          "top-[max(12px,env(safe-area-inset-top))]",
          detent !== "hidden" && "md:right-[428px]",
        )}
      >
        <LocateFixed size={18} aria-hidden />
      </button>

      <section
        ref={sheetRef}
        data-testid="nearby-sheet"
        data-sheet-detent={detent}
        aria-label="Nearby listings"
        className={cn(
          material.thick,
          "absolute z-20 flex min-h-0 flex-col border border-white/10 shadow-[0_-12px_40px_rgba(0,0,0,0.35)]",
          "bottom-[calc(env(safe-area-inset-bottom)+5rem)]",
          detent === "hidden"
            ? "inset-x-3 h-8 overflow-hidden rounded-full md:inset-x-auto md:bottom-4 md:right-4 md:h-10 md:w-14"
            : cn(
                "inset-x-3 rounded-t-sheet md:inset-x-auto md:bottom-4 md:right-4 md:top-[calc(env(safe-area-inset-top)+4rem)] md:w-[400px] md:rounded-sheet",
                detent === "open"
                  ? "top-[calc(env(safe-area-inset-top)+4rem)]"
                  : "h-[min(38dvh,340px)] md:h-auto",
              ),
        )}
      >
        <div
          data-testid="nearby-sheet-handle"
          className="flex shrink-0 cursor-grab justify-center pt-2 pb-1"
          onPointerDown={onGrabPointerDown}
          onPointerUp={onGrabPointerUp}
          onClick={onHandleClick}
        >
          <div className="h-[5px] w-9 rounded-full bg-white/25" />
        </div>

        {detent !== "hidden" && (
          <>
            <div ref={chromeRef} className="relative z-10 shrink-0 px-3 pb-2">
              <div
                data-testid="nearby-search-bar"
                className={cn(
                  material.regular,
                  "flex h-11 items-center gap-1 rounded-full pl-3 pr-1 text-white",
                )}
              >
                <Search size={16} aria-hidden className="shrink-0 text-silver" />
                <input
                  data-testid="nearby-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={zipPlaceholder}
                  aria-label="Search listings"
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-white/80"
                />
                <button
                  type="button"
                  data-testid="nearby-menu-toggle"
                  aria-expanded={menuOpen}
                  aria-label="Filters"
                  onClick={() => setMenuOpen((openNow) => !openNow)}
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white",
                    menuOpen ? "bg-[#00ffa3]/15 text-chrome" : "bg-white/10",
                  )}
                >
                  <SlidersHorizontal size={16} aria-hidden />
                </button>
              </div>
              {menuOpen && (
                <div
                  ref={filterRef}
                  data-testid="nearby-menu"
                  role="dialog"
                  aria-label="Filters"
                  className="mt-2 space-y-3 rounded-2xl border border-white/10 bg-[#121a29] p-3"
                >
                  <div>
                    <p
                      data-testid="nearby-filter-location"
                      className="text-[12px] font-semibold text-white"
                    >
                      Location
                    </p>
                    <p className="text-[12px] text-silver">{place.primary}</p>
                    <p className="text-[12px] text-silver">US ZIP codes only</p>
                    {!searchAvailable ? (
                      <p className="pt-1 text-[12px] text-silver">{SEARCH_UNAVAILABLE_COPY}</p>
                    ) : null}
                    <input
                      data-testid="nearby-zip"
                      value={placeQuery}
                      inputMode="numeric"
                      autoComplete="postal-code"
                      disabled={!searchAvailable}
                      onChange={(event) => {
                        setPlaceQuery(event.target.value);
                        setPlaceError(null);
                      }}
                      placeholder="ZIP code"
                      aria-label="US ZIP code"
                      className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none placeholder:text-silver/70 disabled:opacity-60"
                    />
                    {placeError ? (
                      <p className="pt-2 text-[12px] text-rose-300">{placeError}</p>
                    ) : null}
                    {placeHits.length > 0 ? (
                      <div className="mt-2 overflow-hidden rounded-xl border border-white/10">
                        {placeHits.map((hit) => (
                          <button
                            key={`${hit.lat}:${hit.lng}:${hit.label}`}
                            type="button"
                            onClick={() => choosePlace(hit)}
                            className="block w-full truncate px-3 py-2.5 text-left text-sm text-white hover:bg-white/5"
                          >
                            {hit.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="relative">
                      <Chip
                        testId="nearby-filter-type"
                        label={typeChip}
                        pressed={listingType !== "all"}
                        open={filter === "type"}
                        onClick={() => toggleFilter("type")}
                      />
                      {filter === "type" && (
                        <FilterMenu label="Type">
                          {LISTING_TYPES.map((type) => (
                            <MenuOption
                              key={type.id}
                              selected={listingType === type.id}
                              onSelect={() => {
                                setListingType(type.id);
                                setFilter(null);
                              }}
                            >
                              {type.label}
                            </MenuOption>
                          ))}
                        </FilterMenu>
                      )}
                    </div>
                    <div className="relative">
                      <Chip
                        testId="nearby-filter-price"
                        label={priceChip}
                        pressed={priceBand !== "any"}
                        open={filter === "price"}
                        onClick={() => toggleFilter("price")}
                      />
                      {filter === "price" && (
                        <FilterMenu label="Price ℏ">
                          {NEARBY_PRICE_BANDS.map((band) => (
                            <MenuOption
                              key={band.id}
                              selected={priceBand === band.id}
                              onSelect={() => {
                                setPriceBand(band.id);
                                setFilter(null);
                              }}
                            >
                              {band.label}
                            </MenuOption>
                          ))}
                        </FilterMenu>
                      )}
                    </div>
                    <div className="relative">
                      <Chip
                        testId="nearby-filter-condition"
                        label={conditionChip}
                        pressed={condition !== ""}
                        open={filter === "condition"}
                        onClick={() => toggleFilter("condition")}
                      />
                      {filter === "condition" && (
                        <FilterMenu label="Condition">
                          <MenuOption
                            selected={condition === ""}
                            onSelect={() => {
                              setCondition("");
                              setFilter(null);
                            }}
                          >
                            Any condition
                          </MenuOption>
                          {LISTING_CONDITIONS.map((entry) => (
                            <MenuOption
                              key={entry.label}
                              selected={condition === entry.label}
                              onSelect={() => {
                                setCondition(entry.label);
                                setFilter(null);
                              }}
                            >
                              {entry.label}
                            </MenuOption>
                          ))}
                        </FilterMenu>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <p
                data-testid="nearby-count"
                className="px-1 pt-2 text-[12px] font-medium text-silver"
              >
                {nearbyCountLabel(sheet.totalInArea)}
              </p>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-4">
              {loadError ? (
                <p className="px-1 py-6 text-center text-sm text-silver">
                  Couldn&apos;t load listings.
                </p>
              ) : sheet.items.length === 0 ? (
                <p className="px-1 py-6 text-center text-sm text-silver">
                  No listings in this area.
                </p>
              ) : (
                sheet.items.map((item) => (
                  <NearbySheetCard
                    key={item.id}
                    item={item}
                    active={item.id === activeId}
                    onClose={onClose}
                    onSelect={selectListing}
                  />
                ))
              )}
            </div>
          </>
        )}
      </section>
    </div>,
    document.body,
  );
}

function NearbySheetCard({
  item,
  active,
  onClose,
  onSelect,
}: {
  item: NearbySheetItem;
  active: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      data-nearby-card={item.id}
      data-active={active ? "true" : "false"}
      className={cn("rounded-[18px]", active && "ring-2 ring-chrome")}
      onClick={(event) => {
        const target = event.target;
        if (target instanceof Element && target.closest("a")) {
          onClose();
          return;
        }
        onSelect(item.id);
      }}
    >
      <ListingCard
        variant="softTrust"
        density="nearby"
        item={{
          id: item.id,
          title: item.title,
          price: item.price ?? undefined,
          seller: item.seller,
          imageUrl: item.imageUrl,
          mediaUrls: item.mediaUrls,
          status: item.status,
          requireEscrow: item.requireEscrow,
          category: item.category,
          condition: item.condition,
          distanceLabel: item.distanceLabel,
          itemType: "listing",
        }}
      />
    </div>
  );
}
