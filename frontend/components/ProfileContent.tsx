"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Settings,
  Share2,
  SlidersHorizontal,
  User,
  Mail,
} from "lucide-react";
import { AddressDisplay } from "./AddressDisplay";
import { TrustStrip } from "./TrustStrip";
import { getApiUrl } from "../lib/apiUrl";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { compressImage } from "../lib/compressImage";
import { useHbarUsd } from "../hooks/useHbarUsd";
import { useCancelListing } from "../hooks/useCancelListing";
import { getListingMediaUrls } from "../lib/listingMedia";
import { listingHref } from "../lib/listingUrl";
import { material } from "../lib/materials";
import { profileAvatarUrl, profileDisplayName, useProfile } from "../lib/profiles";
import {
  DEFAULT_SHOP_FILTER,
  OWN_SHOP_EMPTY,
  PUBLIC_SHOP_EMPTY,
  activeListingsLabel,
  filterShopListings,
  profileEarnings,
  profileStatColumns,
  profileTabList,
  profileTileBadge,
  shopCategories,
  shopFilterIsConstrained,
  summarizeOpenEscrow,
  formatProfileHbar,
  hbarNumber,
  type OpenEscrowSummary,
  type ProfileTabId,
  type ShopFilter,
  type ShopSort,
} from "../lib/profileView";
import { identityTitle, profileAddressKey, profileEmptyCopy } from "../lib/trustStrip";
import { cn } from "../lib/utils";

type ProfileStats = {
  successfulCompletions?: number;
  successful?: number;
  totalSales?: number;
  ratingCount?: number;
  ratingAverage?: number | null;
  reputation?: number;
  reputationScore?: number;
  refunds?: number;
  timeouts?: number;
  completedBuys?: number;
};

type Kyc = {
  status?: string | null;
  legalName?: string | null;
  dateOfBirth?: string | null;
  country?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
};

type ProfileData = {
  address: string;
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  kyc: Kyc;
};

type RatingRow = {
  id: string;
  reviewerAddress: string;
  score: number;
  comment?: string | null;
  createdAt: string;
};

type ProfileListing = {
  id: string;
  title?: string | null;
  price?: string | null;
  imageUrl?: string | null;
  mediaUrls?: string[] | null;
  status?: string | null;
  category?: string | null;
  createdAt?: string | null;
  onChainConfirmed?: boolean;
  requireEscrow?: boolean | null;
};

type SaleRow = {
  id: string;
  listingId?: string | null;
  role?: string | null;
  amount?: string | null;
  createdAt?: string | null;
  listing?: {
    id?: string;
    title?: string | null;
    status?: string | null;
    imageUrl?: string | null;
    mediaUrls?: string[] | null;
    requireEscrow?: boolean | null;
  } | null;
};

type OfferRow = {
  listingId?: string | null;
  status?: string | null;
};

type GridTile = {
  key: string;
  listingId: string | null;
  href: string | null;
  title: string;
  imageUrl: string | null;
  price?: string | null;
  status?: string | null;
  createdAt?: string | null;
  category?: string | null;
  selectableId?: string | null;
};

const iconBtn =
  "flex h-11 w-11 items-center justify-center rounded-full text-white/90 hover:bg-white/[0.08]";

function listingImage(listing: {
  imageUrl?: string | null;
  mediaUrls?: string[] | null;
}): string | null {
  return getListingMediaUrls(listing)[0] ?? null;
}

function listingToTile(listing: ProfileListing, keyPrefix: string): GridTile {
  return {
    key: `${keyPrefix}-${listing.id}`,
    listingId: listing.id,
    href: listingHref(listing.id),
    title: listing.title?.trim() || "Listing",
    imageUrl: listingImage(listing),
    price: listing.price,
    status: listing.status,
    createdAt: listing.createdAt,
    category: listing.category,
    selectableId: keyPrefix === "shop" ? listing.id : null,
  };
}

function saleToTile(sale: SaleRow): GridTile {
  const listingId = sale.listingId || sale.listing?.id || null;
  return {
    key: `sale-${sale.id}`,
    listingId,
    href: listingId ? listingHref(listingId) : null,
    title: sale.listing?.title?.trim() || "Listing",
    imageUrl: sale.listing ? listingImage(sale.listing) : null,
    price: sale.amount,
    status: sale.listing?.status || "SOLD",
    createdAt: sale.createdAt,
    selectableId: null,
  };
}

async function readJson<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export function ProfileContent({
  address: addressParam,
  startInEdit = false,
}: {
  address: string;
  startInEdit?: boolean;
}) {
  const router = useRouter();
  const address = profileAddressKey(addressParam);
  const { address: connectedAddress, accountId } = useHashpackWallet();
  const usdRate = useHbarUsd();
  const {
    cancel,
    isPending: cancelPending,
    isSuccess: cancelSuccess,
    hash: cancelHash,
  } = useCancelListing();
  const isSelf = useMemo(() => {
    const keys = [connectedAddress, accountId]
      .filter(Boolean)
      .map((value) => profileAddressKey(String(value)));
    return !!address && keys.includes(address);
  }, [connectedAddress, accountId, address]);

  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [active, setActive] = useState<ProfileListing[]>([]);
  const [archived, setArchived] = useState<ProfileListing[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [reviews, setReviews] = useState<RatingRow[]>([]);
  const [likes, setLikes] = useState<ProfileListing[]>([]);
  const [likesAvailable, setLikesAvailable] = useState(false);
  const [offerIds, setOfferIds] = useState<Set<string>>(new Set());
  const [openEscrow, setOpenEscrow] = useState<OpenEscrowSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState<ProfileTabId>("shop");
  const [filter, setFilter] = useState<ShopFilter>(DEFAULT_SHOP_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [delisting, setDelisting] = useState(false);
  const [delistError, setDelistError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [gearOpen, setGearOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [bioOpen, setBioOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isSelf && startInEdit) setEditing(true);
  }, [isSelf, startInEdit]);

  useEffect(() => {
    if (!cancelSuccess || !cancelHash) return;
    fetch(`${getApiUrl()}/api/sync-cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txHash: cancelHash }),
    }).catch(() => {});
    setReloadKey((key) => key + 1);
  }, [cancelSuccess, cancelHash]);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    const api = getApiUrl();
    setLoaded(false);
    setStatsLoaded(false);

    const load = async () => {
      const [statsRes, profileRes, listingsRes, ratingsRes, purchasesRes, wishlistRes, offersRes] =
        await Promise.all([
          fetch(`${api}/api/user/${encodeURIComponent(address)}`),
          fetch(`${api}/api/user/${encodeURIComponent(address)}/profile`),
          fetch(`${api}/api/user/${encodeURIComponent(address)}/listings`),
          fetch(`${api}/api/ratings/${encodeURIComponent(address)}`),
          fetch(`${api}/api/user/${encodeURIComponent(address)}/purchases`),
          fetch(`${api}/api/wishlist?address=${encodeURIComponent(address)}`),
          fetch(`${api}/api/user/${encodeURIComponent(address)}/offers`),
        ]);
      if (cancelled) return;

      const statsBody = await readJson<ProfileStats>(statsRes);
      const profileBody = await readJson<ProfileData>(profileRes);
      const listingsBody = await readJson<{
        active?: ProfileListing[];
        archived?: ProfileListing[];
      }>(listingsRes);
      const ratingsBody = await readJson<{ ratings?: RatingRow[] }>(ratingsRes);
      const purchasesBody = await readJson<{ purchases?: SaleRow[] }>(purchasesRes);
      const wishlistBody = await readJson<{ items?: { itemId: string; itemType?: string }[] }>(
        wishlistRes,
      );
      const offersBody = await readJson<{ received?: OfferRow[] }>(offersRes);
      if (cancelled) return;

      setStats(statsBody);
      setStatsLoaded(true);
      setProfile(profileBody);
      setActive(listingsBody?.active ?? []);
      setArchived(listingsBody?.archived ?? []);
      setReviews(ratingsBody?.ratings ?? []);
      setSales(purchasesBody?.purchases ?? []);
      setOfferIds(
        new Set(
          (offersBody?.received ?? [])
            .filter(
              (offer) => String(offer.status ?? "").toUpperCase() === "ACTIVE" && offer.listingId,
            )
            .map((offer) => String(offer.listingId)),
        ),
      );

      if (!wishlistRes.ok || !wishlistBody) {
        setLikesAvailable(false);
        setLikes([]);
      } else {
        setLikesAvailable(true);
        const ids = (wishlistBody.items ?? [])
          .filter((item) => !item.itemType || item.itemType === "listing")
          .map((item) => item.itemId);
        const rows = await Promise.all(
          ids.map((id) =>
            fetch(`${api}/api/listing/${encodeURIComponent(id)}`)
              .then((res) => (res.ok ? res.json() : null))
              .then((body: { listing?: ProfileListing } | null) => body?.listing ?? null)
              .catch(() => null),
          ),
        );
        if (!cancelled) setLikes(rows.filter((row): row is ProfileListing => !!row));
      }
      if (!cancelled) setLoaded(true);
    };

    load().catch(() => {
      if (cancelled) return;
      setStatsLoaded(true);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [address, reloadKey]);

  useEffect(() => {
    if (!isSelf || !loaded) {
      setOpenEscrow(null);
      return;
    }
    const ids = new Set<string>();
    for (const sale of sales) {
      if (sale.role !== "seller" || !sale.listingId) continue;
      const status = String(sale.listing?.status ?? "").toUpperCase();
      if (status === "LOCKED") ids.add(sale.listingId);
      else if (
        sale.listing?.requireEscrow &&
        status !== "COMPLETED" &&
        status !== "CANCELLED" &&
        status !== "SOLD"
      ) {
        ids.add(sale.listingId);
      }
    }
    for (const listing of archived) {
      if (String(listing.status ?? "").toUpperCase() === "LOCKED") ids.add(listing.id);
    }
    const list = Array.from(ids).slice(0, 20);
    if (list.length === 0) {
      setOpenEscrow(null);
      return;
    }
    let cancelled = false;
    Promise.all(
      list.map((id) =>
        fetch(`${getApiUrl()}/api/escrow/${encodeURIComponent(id)}`)
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null),
      ),
    ).then((views) => {
      if (cancelled) return;
      setOpenEscrow(
        summarizeOpenEscrow((views.filter(Boolean) as { state?: string; amount?: string }[]) ?? []),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [isSelf, loaded, sales, archived]);

  useEffect(() => {
    if (profile && !draft) setDraft(profile);
  }, [profile, draft]);

  const tabs = useMemo(() => profileTabList(isSelf, likesAvailable), [isSelf, likesAvailable]);
  useEffect(() => {
    if (!tabs.some((item) => item.id === tab)) setTab("shop");
  }, [tabs, tab]);

  const routeHandle = /^\d+\.\d+\.\d+$/.test(addressParam.trim()) ? addressParam.trim() : null;
  const publicProfile = useProfile(address);
  const title = identityTitle({
    displayName: profile?.displayName,
    hashpackName: profileDisplayName(publicProfile) ?? publicProfile?.hashpackName,
    address: routeHandle ?? address,
  });
  const avatarUrl =
    (editing ? draft?.avatarUrl?.trim() : profile?.avatarUrl?.trim()) ||
    profileAvatarUrl(publicProfile) ||
    null;
  const isVerified = profile?.kyc?.status === "VERIFIED" || publicProfile?.kycVerified === true;
  const bioText = (editing ? draft?.bio : profile?.bio)?.trim() || "";
  const completions = stats?.successfulCompletions ?? stats?.successful;

  const statColumns = profileStatColumns(
    statsLoaded && stats
      ? {
          successfulCompletions: completions ?? 0,
          totalSales: stats.totalSales ?? 0,
          ratingAverage: stats.ratingAverage,
          ratingCount: stats.ratingCount ?? 0,
        }
      : {},
  );

  const earnings = profileEarnings({
    sales,
    activeListings: active,
    openEscrow,
    usdPerHbar: usdRate,
  });

  const shopTiles = useMemo(() => {
    const filtered = filterShopListings(active, filter);
    return filtered.map((listing) => listingToTile(listing, "shop"));
  }, [active, filter]);

  const soldTiles = useMemo(() => {
    const sellerSales = sales.filter((sale) => sale.role === "seller");
    const covered = new Set(
      sellerSales.map((sale) => sale.listingId).filter((id): id is string => !!id),
    );
    const extras = archived.filter(
      (listing) =>
        !covered.has(listing.id) && String(listing.status ?? "").toUpperCase() !== "LISTED",
    );
    return [
      ...sellerSales.map(saleToTile),
      ...extras.map((listing) => listingToTile(listing, "sold")),
    ];
  }, [sales, archived]);

  const purchasedTiles = useMemo(
    () => sales.filter((sale) => sale.role === "buyer").map(saleToTile),
    [sales],
  );
  const likeTiles = useMemo(() => likes.map((listing) => listingToTile(listing, "like")), [likes]);

  const categories = useMemo(() => shopCategories(active), [active]);
  const reviewsCopy = profileEmptyCopy("reviews", isSelf);

  const goBack = useCallback(() => {
    if (selecting) {
      setSelecting(false);
      setSelected(new Set());
      setDelistError(null);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/marketplace");
  }, [router, selecting]);

  const onShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    if (nav && typeof nav.share === "function") {
      try {
        await nav.share({ title, url });
        return;
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
      }
    }
    try {
      await nav?.clipboard?.writeText(url);
      setNotice("Link copied");
      window.setTimeout(() => setNotice(null), 2000);
    } catch {
      setNotice(null);
    }
  };

  const onSave = async () => {
    if (!draft || !isSelf) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/user/${address}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: draft.displayName ?? "",
          bio: draft.bio ?? "",
          avatarUrl: draft.avatarUrl ?? "",
          kyc: {
            legalName: draft.kyc?.legalName ?? "",
            dateOfBirth: draft.kyc?.dateOfBirth ?? "",
            country: draft.kyc?.country ?? "",
            idType: draft.kyc?.idType ?? "",
            idNumber: draft.kyc?.idNumber ?? "",
            addressLine1: draft.kyc?.addressLine1 ?? "",
            addressLine2: draft.kyc?.addressLine2 ?? "",
            city: draft.kyc?.city ?? "",
            region: draft.kyc?.region ?? "",
            postalCode: draft.kyc?.postalCode ?? "",
          },
        }),
      });
      if (!res.ok) throw new Error("save failed");
      const updated = (await res.json()) as ProfileData;
      setProfile(updated);
      setDraft(updated);
      setEditing(false);
    } catch {
      setSaveError("Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  const onAvatarSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !isSelf) return;
    if (!/^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.type)) return;
    setAvatarUploading(true);
    try {
      const compressed = await compressImage(file);
      const form = new FormData();
      form.append("media", compressed);
      const res = await fetch(`${getApiUrl()}/api/upload-listing-media`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("upload failed");
      const data = (await res.json()) as { mediaUrl?: string };
      if (data.mediaUrl)
        setDraft((current) => (current ? { ...current, avatarUrl: data.mediaUrl } : current));
    } catch {
      setSaveError("Couldn't upload photo");
    } finally {
      setAvatarUploading(false);
    }
  };

  const enterSelect = (id?: string) => {
    setSelecting(true);
    setGearOpen(false);
    setFilterOpen(false);
    setSelected(id ? new Set([id]) : new Set());
    setDelistError(null);
  };

  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const delistSelected = async () => {
    if (!address || selected.size === 0 || delisting) return;
    setDelisting(true);
    setDelistError(null);
    try {
      for (const id of selected) {
        const res = await fetch(
          `${getApiUrl()}/api/listing/${encodeURIComponent(id)}/cancel-offchain`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address }),
          },
        );
        if (res.ok) continue;
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        const message = body.error || "";
        if (res.status === 400 && /on-chain/i.test(message)) {
          const ok = await cancel(id);
          if (!ok) throw new Error("Couldn't delist on-chain.");
          continue;
        }
        throw new Error(message || "Couldn't delist");
      }
      setSelecting(false);
      setSelected(new Set());
      setReloadKey((key) => key + 1);
    } catch (err) {
      setDelistError(err instanceof Error ? err.message : "Couldn't delist");
    } finally {
      setDelisting(false);
    }
  };

  const tiles =
    tab === "shop"
      ? shopTiles
      : tab === "sold"
        ? soldTiles
        : tab === "purchased"
          ? purchasedTiles
          : likeTiles;
  const shopConstrained = shopFilterIsConstrained(filter);
  const showShopEmpty = tab === "shop" && loaded && shopTiles.length === 0 && !shopConstrained;

  return (
    <main
      className={cn("mx-auto min-h-screen w-full max-w-[720px]", selecting ? "pb-44" : "pb-28")}
    >
      <header className="sticky top-0 z-30 bg-bg md:top-14">
        <div className="grid h-14 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-1">
          <div className="flex justify-start">
            <button
              type="button"
              onClick={goBack}
              aria-label={selecting ? "Cancel selection" : "Back"}
              className={iconBtn}
            >
              <ChevronLeft size={22} />
            </button>
          </div>
          <h1
            data-testid="profile-handle"
            className="flex max-w-[60vw] items-center gap-1 text-[17px] font-semibold tracking-tight text-white"
          >
            <span className="truncate">{selecting ? `${selected.size} selected` : title}</span>
            {!selecting && isVerified && (
              <BadgeCheck size={16} className="shrink-0 text-chrome" aria-label="KYC verified" />
            )}
          </h1>
          <div className="flex items-center justify-end">
            {selecting ? (
              <span className="w-11" />
            ) : isSelf ? (
              <>
                <Link href="/create" aria-label="New listing" className={iconBtn}>
                  <Plus size={22} />
                </Link>
                <div className="relative">
                  <button
                    type="button"
                    aria-label="Settings"
                    aria-expanded={gearOpen}
                    className={iconBtn}
                    onClick={() => {
                      setGearOpen((open) => !open);
                      setMoreOpen(false);
                    }}
                  >
                    <Settings size={20} />
                  </button>
                  {gearOpen && (
                    <div
                      className={cn(
                        material.regular,
                        "absolute right-0 top-11 z-40 w-44 rounded-[14px] p-1",
                      )}
                    >
                      <button
                        type="button"
                        className="block w-full rounded-[10px] px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                        onClick={() => {
                          setGearOpen(false);
                          setEditing(true);
                        }}
                      >
                        Edit profile
                      </button>
                      <Link
                        href="/dashboard"
                        className="block rounded-[10px] px-3 py-2 text-sm text-white hover:bg-white/10"
                        onClick={() => setGearOpen(false)}
                      >
                        My Hashpop
                      </Link>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  href={`/messages?openThread=${encodeURIComponent(address)}`}
                  aria-label="Message"
                  className={iconBtn}
                >
                  <Mail size={20} />
                </Link>
                <button
                  type="button"
                  aria-label="Share profile"
                  className={iconBtn}
                  onClick={() => void onShare()}
                >
                  <Share2 size={18} />
                </button>
                <div className="relative">
                  <button
                    type="button"
                    aria-label="More"
                    aria-expanded={moreOpen}
                    className={iconBtn}
                    onClick={() => {
                      setMoreOpen((open) => !open);
                      setGearOpen(false);
                    }}
                  >
                    <MoreHorizontal size={20} />
                  </button>
                  {moreOpen && (
                    <div
                      className={cn(
                        material.regular,
                        "absolute right-0 top-11 z-40 w-40 rounded-[14px] p-1",
                      )}
                    >
                      <button
                        type="button"
                        className="block w-full rounded-[10px] px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                        onClick={() => {
                          setMoreOpen(false);
                          void onShare();
                        }}
                      >
                        Copy link
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        {notice && <p className="px-4 pb-1 text-center text-[12px] text-white/60">{notice}</p>}
      </header>

      <section className="px-4 pt-2">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className={cn(
                "h-[72px] w-[72px] shrink-0 rounded-full object-cover",
                isVerified ? "ring-2 ring-chrome" : "ring-1 ring-white/15",
              )}
            />
          ) : (
            <div
              className={cn(
                "flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-white/5 text-white/50 backdrop-blur-material",
                isVerified ? "ring-2 ring-chrome" : "ring-1 ring-white/15",
              )}
            >
              <User size={28} />
            </div>
          )}
          {!statsLoaded ? (
            <div className="grid flex-1 grid-cols-3 gap-2" aria-hidden>
              {[0, 1, 2].map((slot) => (
                <span
                  key={slot}
                  className="mx-auto h-8 w-10 animate-pulse rounded-md bg-white/10"
                />
              ))}
            </div>
          ) : statColumns.length > 0 ? (
            <div
              className="grid min-w-0 flex-1 gap-1"
              style={{ gridTemplateColumns: `repeat(${statColumns.length}, minmax(0, 1fr))` }}
            >
              {statColumns.map((stat) => (
                <div
                  key={stat.id}
                  data-testid={`profile-stat-${stat.id}`}
                  className="min-w-0 text-center"
                >
                  <p className="truncate text-[20px] font-semibold leading-none tabular-nums text-white">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-[12px] lowercase leading-tight text-white/60">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1" />
          )}
        </div>
        <div className="mt-3">
          <TrustStrip
            chipsOnly
            density="full"
            address={address}
            displayName={profile?.displayName}
            avatarUrl={avatarUrl}
            reputationScore={stats?.reputationScore ?? stats?.reputation}
            totalSales={stats?.totalSales}
            successfulCompletions={completions}
            refunds={stats?.refunds}
            timeouts={stats?.timeouts}
            kycStatus={profile?.kyc?.status}
            ratingsAvg={stats?.ratingAverage}
            ratingsCount={stats?.ratingCount}
            completedBuys={stats?.completedBuys}
            loading={!statsLoaded}
            unknown={statsLoaded && stats === null}
            linkToProfile={false}
          />
        </div>
        {bioText ? (
          <div className="mt-3">
            <p className={cn("text-[13px] leading-5 text-white/60", !bioOpen && "line-clamp-2")}>
              {bioText}
            </p>
            {bioText.length > 80 && (
              <button
                type="button"
                className="mt-0.5 text-[13px] font-medium text-white"
                onClick={() => setBioOpen((open) => !open)}
              >
                {bioOpen ? "less" : "more"}
              </button>
            )}
          </div>
        ) : null}
      </section>

      {editing && isSelf && (
        <div className={cn(material.regular, "mx-4 mt-4 space-y-3 rounded-[16px] p-4")}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Edit profile</p>
            <button
              type="button"
              onClick={() => {
                setDraft(profile);
                setEditing(false);
                setSaveError(null);
              }}
              className="text-xs text-white/60 hover:text-white"
            >
              Cancel
            </button>
          </div>
          <label className="block">
            <span className="text-xs text-white/60">Name</span>
            <input
              className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              value={draft?.displayName ?? ""}
              maxLength={80}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, displayName: event.target.value } : current,
                )
              }
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/60">Bio</span>
            <textarea
              className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              rows={3}
              value={draft?.bio ?? ""}
              maxLength={500}
              onChange={(event) =>
                setDraft((current) => (current ? { ...current, bio: event.target.value } : current))
              }
            />
          </label>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10">
              {avatarUploading ? "Uploading…" : "Upload photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                disabled={avatarUploading}
                onChange={onAvatarSelected}
              />
            </label>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="btn-mint rounded-full px-4 py-1.5 text-xs disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
          {saveError && <p className="text-xs text-danger">{saveError}</p>}
        </div>
      )}

      {isSelf && loaded && (
        <Link
          href="/dashboard"
          data-testid="profile-earnings"
          className={cn(
            material.regular,
            "mx-4 mt-4 flex items-center gap-2 rounded-[16px] px-3 py-3",
          )}
        >
          <div className="flex min-w-0 flex-1 divide-x divide-white/10">
            {earnings.map((column) => (
              <div
                key={column.id}
                data-testid={`profile-earnings-${column.id}`}
                className="min-w-0 flex-1 px-2 first:pl-0"
              >
                <p className="truncate text-[15px] font-semibold tabular-nums text-white">
                  {column.amountLabel}
                </p>
                <p className="truncate text-[11px] text-white/80">{column.caption}</p>
                <p className="truncate text-[11px] text-white/50">{column.detail}</p>
                {column.fiatLabel && (
                  <p className="truncate text-[11px] text-white/40">{column.fiatLabel}</p>
                )}
              </div>
            ))}
          </div>
          <ChevronRight size={18} className="shrink-0 text-white/50" aria-hidden />
        </Link>
      )}

      <nav
        aria-label="Profile"
        className="sticky top-14 z-30 mt-4 flex border-b border-white/10 bg-bg md:top-[7rem]"
      >
        {tabs.map((item) => {
          const activeTab = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={activeTab}
              data-testid={`profile-tab-${item.id}`}
              onClick={() => {
                setTab(item.id);
                setSelecting(false);
                setSelected(new Set());
              }}
              className={cn(
                "relative flex-1 whitespace-nowrap py-3 text-[14px] font-semibold sm:text-[15px]",
                activeTab ? "text-white" : "text-white/50",
              )}
            >
              {item.label}
              {activeTab && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-chrome" />}
            </button>
          );
        })}
      </nav>

      {tab === "shop" && (
        <div className="relative flex items-center justify-between px-3 py-2.5">
          <p data-testid="profile-active-count" className="text-[15px] font-semibold text-white">
            {activeListingsLabel(active.length)}
          </p>
          <div className="flex items-center gap-1">
            {isSelf && active.length > 0 && !selecting && (
              <button
                type="button"
                data-testid="profile-select"
                className="px-2 text-[13px] font-semibold text-white/80"
                onClick={() => enterSelect()}
              >
                Select
              </button>
            )}
            <button
              type="button"
              aria-label="Filter"
              aria-expanded={filterOpen}
              className={cn(
                material.regular,
                "flex h-9 w-9 items-center justify-center rounded-[10px] text-white",
              )}
              onClick={() => setFilterOpen((open) => !open)}
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>
          {filterOpen && (
            <div
              className={cn(
                material.regular,
                "absolute right-3 top-12 z-40 w-56 rounded-[16px] p-3 text-left",
              )}
            >
              <p className="text-[11px] uppercase tracking-wide text-white/50">Sort</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {(
                  [
                    ["newest", "Newest"],
                    ["price-asc", "Price ↑"],
                    ["price-desc", "Price ↓"],
                  ] as [ShopSort, string][]
                ).map(([sort, label]) => (
                  <button
                    key={sort}
                    type="button"
                    onClick={() => setFilter((current) => ({ ...current, sort }))}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[12px]",
                      filter.sort === sort ? "bg-chrome text-[#04150f]" : "bg-white/10 text-white",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {categories.length > 0 && (
                <>
                  <p className="mt-3 text-[11px] uppercase tracking-wide text-white/50">Category</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <FilterChip
                      active={filter.category == null}
                      onClick={() => setFilter((current) => ({ ...current, category: null }))}
                    >
                      All
                    </FilterChip>
                    {categories.map((category) => (
                      <FilterChip
                        key={category}
                        active={filter.category === category}
                        onClick={() => setFilter((current) => ({ ...current, category }))}
                      >
                        {category}
                      </FilterChip>
                    ))}
                  </div>
                </>
              )}
              <p className="mt-3 text-[11px] uppercase tracking-wide text-white/50">Price ℏ</p>
              <div className="mt-1 flex gap-2">
                <PriceField
                  label="Min"
                  value={filter.minPrice}
                  onChange={(minPrice) => setFilter((current) => ({ ...current, minPrice }))}
                />
                <PriceField
                  label="Max"
                  value={filter.maxPrice}
                  onChange={(maxPrice) => setFilter((current) => ({ ...current, maxPrice }))}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "reviews" ? (
        !loaded ? null : reviews.length === 0 ? (
          <EmptyRack headline={reviewsCopy.headline} body={reviewsCopy.body} />
        ) : (
          <ul className="space-y-2 px-4 py-3">
            {reviews.map((review) => (
              <li key={review.id} className={cn(material.regular, "rounded-[16px] px-4 py-3")}>
                <div className="flex items-center justify-between gap-2">
                  <AddressDisplay
                    address={review.reviewerAddress}
                    className="text-sm text-white"
                    showVerified={false}
                  />
                  <span className="text-sm font-semibold text-amber-300">★ {review.score}</span>
                </div>
                {review.comment?.trim() && (
                  <p className="mt-1 text-sm text-white/80">{review.comment}</p>
                )}
                <p className="mt-1 font-mono text-[10px] text-white/40">
                  {new Date(review.createdAt).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        )
      ) : showShopEmpty ? (
        <EmptyRack
          hanger
          headline={isSelf ? OWN_SHOP_EMPTY.headline : PUBLIC_SHOP_EMPTY.headline}
          body={isSelf ? OWN_SHOP_EMPTY.body : undefined}
          cta={isSelf ? OWN_SHOP_EMPTY.cta : undefined}
        />
      ) : tab === "shop" && loaded && shopTiles.length === 0 ? (
        <EmptyRack headline="No listings match" body="Try another category or price." />
      ) : tab !== "shop" && loaded && tiles.length === 0 ? (
        <EmptyRack
          headline={
            tab === "sold"
              ? "Nothing sold yet."
              : tab === "purchased"
                ? "No purchases yet."
                : "No likes yet."
          }
        />
      ) : (
        <div data-testid="profile-grid" className="grid grid-cols-3 gap-0.5">
          {tiles.map((tile) => (
            <ProfileTile
              key={tile.key}
              tile={tile}
              badge={profileTileBadge({
                status: tile.status,
                hasActiveOffer: !!tile.listingId && offerIds.has(tile.listingId),
              })}
              selecting={selecting && tab === "shop"}
              selected={!!tile.selectableId && selected.has(tile.selectableId)}
              onToggle={
                tile.selectableId
                  ? () => {
                      if (!selecting) enterSelect(tile.selectableId!);
                      else toggleSelected(tile.selectableId!);
                    }
                  : undefined
              }
              onLongPress={
                isSelf && tab === "shop" && tile.selectableId
                  ? () => enterSelect(tile.selectableId!)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {selecting && tab === "shop" && (
        <div
          data-testid="profile-select-bar"
          data-clears-dock="true"
          className="fixed inset-x-0 z-[70] px-3 bottom-[calc(env(safe-area-inset-bottom)+96px)] md:bottom-6"
        >
          <div className="mx-auto max-w-[720px]">
            <button
              type="button"
              data-testid="profile-delist"
              disabled={selected.size === 0 || delisting || cancelPending}
              onClick={() => void delistSelected()}
              className={cn(
                material.regular,
                "flex h-[52px] w-full items-center justify-center rounded-[14px] text-[15px] font-semibold text-danger disabled:opacity-40",
              )}
            >
              {delisting || cancelPending ? "Delisting…" : "Delist"}
            </button>
            {delistError && (
              <p className="mt-1 text-center text-[12px] text-danger">{delistError}</p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1 text-[12px]",
        active ? "bg-chrome text-[#04150f]" : "bg-white/10 text-white",
      )}
    >
      {children}
    </button>
  );
}

function PriceField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="block flex-1 text-[11px] text-white/50">
      {label}
      <input
        inputMode="decimal"
        value={value ?? ""}
        onChange={(event) => {
          const raw = event.target.value.trim();
          if (!raw) {
            onChange(null);
            return;
          }
          const next = Number(raw);
          onChange(Number.isFinite(next) ? next : null);
        }}
        className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-white"
      />
    </label>
  );
}

function ProfileTile({
  tile,
  badge,
  selecting,
  selected,
  onToggle,
  onLongPress,
}: {
  tile: GridTile;
  badge: { label: string; tone: "sold" | "escrow" | "offer" } | null;
  selecting: boolean;
  selected: boolean;
  onToggle?: () => void;
  onLongPress?: () => void;
}) {
  const price = tile.price != null ? formatProfileHbar(hbarNumber(tile.price)) : null;
  const body = (
    <>
      {tile.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={tile.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0 bg-white/[0.04]" />
      )}
      {badge?.tone === "sold" && <span className="absolute inset-0 bg-black/50" />}
      {badge && badge.tone !== "sold" && (
        <span
          className={cn(
            "absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
            badge.tone === "escrow" ? "bg-chrome text-[#04150f]" : "bg-warning text-on-warning",
          )}
        >
          {badge.label}
        </span>
      )}
      {badge?.tone === "sold" && (
        <span className="absolute left-1.5 top-1.5 text-[11px] font-semibold text-white">
          {badge.label}
        </span>
      )}
      {price && (
        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-material">
          {price}
        </span>
      )}
      {selecting && (
        <span
          className={cn(
            "absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full border",
            selected
              ? "border-white bg-white text-black"
              : "border-white/80 bg-black/30 text-transparent",
          )}
        >
          <Check size={12} strokeWidth={3} />
        </span>
      )}
    </>
  );

  const className = cn(
    "relative block aspect-square overflow-hidden bg-white/[0.03]",
    selected && "ring-2 ring-inset ring-chrome",
  );

  if (selecting && onToggle) {
    return (
      <button
        type="button"
        data-testid="profile-tile"
        aria-pressed={selected}
        className={className}
        onClick={onToggle}
      >
        {body}
      </button>
    );
  }

  const hold = onLongPress
    ? {
        onContextMenu: (event: React.MouseEvent) => {
          event.preventDefault();
          onLongPress();
        },
      }
    : {};

  if (!tile.href) {
    return (
      <div data-testid="profile-tile" className={className} {...hold}>
        {body}
      </div>
    );
  }

  return (
    <Link href={tile.href} data-testid="profile-tile" className={className} {...hold}>
      {body}
    </Link>
  );
}

function EmptyRack({
  headline,
  body,
  cta,
  hanger = false,
}: {
  headline: string;
  body?: string;
  cta?: string;
  hanger?: boolean;
}) {
  return (
    <div data-testid="profile-empty" className="px-6 py-14 text-center">
      {hanger && <HangerMark />}
      <p className="text-[17px] font-semibold text-white">{headline}</p>
      {body && <p className="mx-auto mt-1 max-w-[260px] text-[14px] text-white/55">{body}</p>}
      {cta && (
        <Link
          href="/create"
          data-testid="profile-start-selling"
          className="btn-mint mt-5 inline-flex h-11 items-center rounded-full px-6 text-[15px]"
        >
          {cta}
        </Link>
      )}
    </div>
  );
}

function HangerMark() {
  return (
    <svg viewBox="0 0 80 72" aria-hidden className="mx-auto mb-4 h-16 w-16 text-chrome" fill="none">
      <circle cx="40" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M40 16v6L14 44h52L40 22"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M48 36h16l-2 18H46l2-18z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M56 43h1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
