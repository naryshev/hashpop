"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { AlignJustify, ChevronDown, LocateFixed, Search } from "lucide-react";
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

type Camera = {
  lat: number;
  lng: number;
  zoom: number;
  keepZoom: boolean;
};

type MenuId = "type" | "price" | "condition";

const LISTING_TYPES: { id: ListingType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "physical", label: "Physical" },
  { id: "digital", label: "Digital" },
];

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

function Menu({ label, children }: { label: string; children: React.ReactNode }) {
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
  const [menu, setMenu] = useState<MenuId | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeHits, setPlaceHits] = useState<GeocodeHit[]>([]);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [searchAvailable, setSearchAvailable] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const dragStart = useRef<number | null>(null);
  const [mapPadding, setMapPadding] = useState({ top: 72, right: 0, bottom: 520, left: 0 });

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
      setPlaceOpen(true);
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
        setPlaceOpen(false);
      },
      () => {
        if (cancelled) return;
        setLocating(false);
        setPlaceOpen(true);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!placeOpen || !searchAvailable) return;
    const q = placeQuery.trim();
    if (q.length < 2) {
      setPlaceHits([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void searchGeocode(q, userPos ? { lat: userPos[0], lng: userPos[1] } : undefined)
        .then((result) => {
          if (cancelled) return;
          if (!result.available) {
            setSearchAvailable(false);
            setPlaceError(SEARCH_UNAVAILABLE_COPY);
            setPlaceHits([]);
            return;
          }
          setPlaceHits(result.suggestions.slice(0, 5));
        })
        .catch(() => {
          if (!cancelled) setPlaceError("Search failed. Try again.");
        });
    }, GEOCODE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [placeOpen, placeQuery, searchAvailable, userPos]);

  useEffect(() => {
    if (!menu) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      setMenu(null);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [menu]);

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
    const sheet = sheetRef.current;
    if (!sheet) return;
    const update = () => {
      const rect = sheet.getBoundingClientRect();
      const wide =
        typeof window.matchMedia === "function" && window.matchMedia("(min-width: 768px)").matches;
      const next = wide
        ? {
            top: 88,
            right: Math.max(0, Math.round(window.innerWidth - rect.left)),
            bottom: 24,
            left: 24,
          }
        : {
            top: 72,
            right: 0,
            bottom: Math.min(
              Math.max(0, Math.round(window.innerHeight - rect.top)),
              Math.max(0, window.innerHeight - 72 - 120),
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
    observer?.observe(sheet);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [listOpen, mounted, open]);

  useProfiles(listings.map((listing) => listing.seller));

  useEffect(() => {
    if (!activeId) return;
    const escaped = window.CSS?.escape ? window.CSS.escape(activeId) : activeId;
    document.querySelector(`[data-nearby-card="${escaped}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  const selectListing = useCallback(
    (id: string) => {
      setActiveId(id);
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

  const goToUser = useCallback(() => {
    if (!userPos) {
      setPlaceOpen(true);
      return;
    }
    setCamera({
      lat: userPos[0],
      lng: userPos[1],
      zoom: NEARBY_DEFAULT_ZOOM,
      keepZoom: false,
    });
    setPlaceOpen(false);
  }, [userPos]);

  const choosePlace = useCallback((hit: GeocodeHit) => {
    setCamera({
      lat: hit.lat,
      lng: hit.lng,
      zoom: NEARBY_DEFAULT_ZOOM,
      keepZoom: false,
    });
    setPlaceOpen(false);
    setPlaceHits([]);
    setPlaceQuery("");
    setPlaceError(null);
  }, []);

  const toggleMenu = (id: MenuId) => setMenu((current) => (current === id ? null : id));

  const onGrabPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragStart.current = event.clientY;
  };
  const onGrabPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStart.current == null) return;
    const delta = event.clientY - dragStart.current;
    dragStart.current = null;
    if (delta < -36) setListOpen(true);
    else if (delta > 36) setListOpen(false);
  };

  if (!mounted || !open) return null;

  const typeChip =
    listingType === "all" ? "Type" : listingType === "physical" ? "Physical" : "Digital";
  const priceChip = NEARBY_PRICE_BANDS.find((band) => band.id === priceBand)?.chip ?? "Price ℏ";
  const conditionChip = condition || "Condition";

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
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-[max(12px,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex items-center gap-2">
          <label
            className={cn(
              material.regular,
              "flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full px-3 text-white",
            )}
          >
            <Search size={16} aria-hidden className="shrink-0 text-silver" />
            <input
              data-testid="nearby-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search nearby…"
              aria-label="Search nearby"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-silver/70"
            />
          </label>
          {placeOpen ? (
            <form
              className="relative shrink-0"
              onSubmit={(event) => {
                event.preventDefault();
                const hit = placeHits[0];
                if (hit) choosePlace(hit);
              }}
            >
              <input
                data-testid="nearby-place-search"
                value={placeQuery}
                onChange={(event) => {
                  setPlaceQuery(event.target.value);
                  setPlaceError(null);
                }}
                disabled={!searchAvailable}
                placeholder={searchAvailable ? "City or ZIP" : SEARCH_UNAVAILABLE_COPY}
                aria-label="Search city or ZIP"
                className={cn(
                  material.regular,
                  "h-11 w-36 rounded-full px-3 text-sm text-white outline-none placeholder:text-silver/70 disabled:opacity-60",
                )}
              />
            </form>
          ) : (
            <button
              type="button"
              data-testid="nearby-current-location"
              onClick={goToUser}
              aria-busy={locating}
              className={cn(
                material.regular,
                "flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-white",
              )}
            >
              <LocateFixed size={16} aria-hidden className="shrink-0 text-chrome" />
              <span className="max-w-[7.5rem] truncate">Current location</span>
            </button>
          )}
          <button
            type="button"
            data-testid="nearby-list-toggle"
            aria-pressed={listOpen}
            aria-label={listOpen ? "Show map" : "Show list"}
            onClick={() => setListOpen((openNow) => !openNow)}
            className={cn(
              material.regular,
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white",
              listOpen && "text-chrome",
            )}
          >
            <AlignJustify size={18} aria-hidden />
          </button>
        </div>
        {placeOpen && (placeError || placeHits.length > 0) && (
          <div
            className={cn(
              material.thick,
              "pointer-events-auto mt-2 overflow-hidden rounded-2xl border border-white/10 text-sm",
            )}
          >
            {placeError ? <p className="px-3 py-2 text-rose-300">{placeError}</p> : null}
            {placeHits.map((hit) => (
              <button
                key={`${hit.lat}:${hit.lng}:${hit.label}`}
                type="button"
                onClick={() => choosePlace(hit)}
                className="block w-full truncate px-3 py-2 text-left text-white hover:bg-white/5"
              >
                {hit.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <section
        ref={sheetRef}
        data-testid="nearby-sheet"
        aria-label="Nearby listings"
        className={cn(
          material.thick,
          "absolute z-20 flex min-h-0 flex-col border border-white/10 shadow-[0_-12px_40px_rgba(0,0,0,0.35)]",
          "inset-x-3 rounded-t-sheet bottom-[calc(env(safe-area-inset-bottom)+5rem)]",
          "md:inset-x-auto md:bottom-4 md:right-4 md:w-[400px] md:rounded-sheet",
          listOpen
            ? "top-[calc(env(safe-area-inset-top)+4rem)]"
            : "h-[min(56dvh,560px)] md:top-[calc(env(safe-area-inset-top)+4rem)] md:h-auto",
        )}
      >
        <div
          className="flex shrink-0 cursor-grab justify-center pt-2 pb-1 md:hidden"
          onPointerDown={onGrabPointerDown}
          onPointerUp={onGrabPointerUp}
        >
          <div className="h-[5px] w-9 rounded-full bg-white/25" />
        </div>

        <div
          ref={menuRef}
          className="relative z-10 flex shrink-0 flex-wrap items-center gap-1.5 px-3 pb-2"
        >
          <div className="relative">
            <Chip
              testId="nearby-filter-type"
              label={typeChip}
              pressed={listingType !== "all"}
              open={menu === "type"}
              onClick={() => toggleMenu("type")}
            />
            {menu === "type" && (
              <Menu label="Type">
                {LISTING_TYPES.map((type) => (
                  <MenuOption
                    key={type.id}
                    selected={listingType === type.id}
                    onSelect={() => {
                      setListingType(type.id);
                      setMenu(null);
                    }}
                  >
                    {type.label}
                  </MenuOption>
                ))}
              </Menu>
            )}
          </div>
          <div className="relative">
            <Chip
              testId="nearby-filter-price"
              label={priceChip}
              pressed={priceBand !== "any"}
              open={menu === "price"}
              onClick={() => toggleMenu("price")}
            />
            {menu === "price" && (
              <Menu label="Price ℏ">
                {NEARBY_PRICE_BANDS.map((band) => (
                  <MenuOption
                    key={band.id}
                    selected={priceBand === band.id}
                    onSelect={() => {
                      setPriceBand(band.id);
                      setMenu(null);
                    }}
                  >
                    {band.label}
                  </MenuOption>
                ))}
              </Menu>
            )}
          </div>
          <div className="relative">
            <Chip
              testId="nearby-filter-condition"
              label={conditionChip}
              pressed={condition !== ""}
              open={menu === "condition"}
              onClick={() => toggleMenu("condition")}
            />
            {menu === "condition" && (
              <Menu label="Condition">
                <MenuOption
                  selected={condition === ""}
                  onSelect={() => {
                    setCondition("");
                    setMenu(null);
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
                      setMenu(null);
                    }}
                  >
                    {entry.label}
                  </MenuOption>
                ))}
              </Menu>
            )}
          </div>
          <p
            data-testid="nearby-count"
            className="ml-auto shrink-0 text-[12px] font-medium text-silver"
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
            <p className="px-1 py-6 text-center text-sm text-silver">No listings in this area.</p>
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
        density="regular"
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
