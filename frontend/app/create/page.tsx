"use client";
import { listingHref } from "../../lib/listingUrl";

import { useRef, useState, useMemo, useCallback, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCreateListing } from "../../hooks/useCreateListing";
import { CategorySearch } from "../../components/CategorySearch";
import { LocationPicker, type LocationValue } from "../../components/LocationPicker";
import { compressImage } from "../../lib/compressImage";
import { formatPriceForDisplay } from "../../lib/formatPrice";
import { getTransactionErrorMessage } from "../../lib/transactionError";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { ConnectWalletButton } from "../../components/ConnectWalletButton";
import { activeHederaChain } from "../../lib/hederaChains";
import { getTransactionExplorerUrl } from "../../lib/explorer";

import { getApiUrl } from "../../lib/apiUrl";
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_MEDIA_SIZE = 15 * 1024 * 1024; // 15MB for video
const ALLOWED_IMAGE_TYPES = "image/jpeg,image/jpg,image/png,image/gif,image/webp";
const ALLOWED_VIDEO_TYPES = "video/mp4,video/webm,video/quicktime";
const ALLOWED_MEDIA_TYPES = `${ALLOWED_IMAGE_TYPES},${ALLOWED_VIDEO_TYPES}`;

const CONDITIONS: { label: string; desc: string }[] = [
  { label: "New", desc: "Sealed or unused" },
  { label: "Like new", desc: "Used briefly · no flaws" },
  { label: "Used", desc: "Normal wear · works perfectly" },
  { label: "Worn", desc: "Visible wear · functional" },
  { label: "For parts", desc: "Damaged / incomplete" },
];

type MediaItem = {
  id: string;
  file: File;
  previewUrl: string;
  isVideo: boolean;
};

function isVideoFile(file: File): boolean {
  return /^video\/(mp4|webm|quicktime)$/i.test(file.type);
}

function CreatePageContent() {
  const [price, setPrice] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  const [yearOfProduction, setYearOfProduction] = useState("");
  const [location, setLocation] = useState<LocationValue>({ city: null, lat: null, lng: null });
  const [requireEscrow, setRequireEscrow] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdListingId, setCreatedListingId] = useState<string | null>(null);
  const createdListingIdRef = useRef<string | null>(null);
  const duplicateMediaUrlsRef = useRef<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address } = useHashpackWallet();
  const chainId = activeHederaChain.id;

  const imageUrlRef = useRef<string | null>(null);
  const mediaUrlsRef = useRef<string[]>([]);
  const requireEscrowRef = useRef<boolean>(false);
  const titleRef = useRef<string | null>(null);
  const subtitleRef = useRef<string | null>(null);
  const descriptionRef = useRef<string | null>(null);
  const categoryRef = useRef<string | null>(null);
  const conditionRef = useRef<string | null>(null);
  const yearOfProductionRef = useRef<string | null>(null);
  const cityRef = useRef<string | null>(null);
  const locationLatRef = useRef<number | null>(null);
  const locationLngRef = useRef<number | null>(null);

  const {
    create,
    isPending: listingPending,
    isSuccess: listingSuccess,
    error: listingError,
    hash: lastTxId,
  } = useCreateListing({
    imageUrlRef,
    mediaUrlsRef,
    requireEscrowRef,
    titleRef,
    subtitleRef,
    descriptionRef,
    categoryRef,
    conditionRef,
    yearOfProductionRef,
    cityRef,
    locationLatRef,
    locationLngRef,
  });
  const isPending = listingPending;
  const isSuccess = listingSuccess;
  const error = listingError;
  const transactionExplorerUrl = getTransactionExplorerUrl(lastTxId, chainId);
  const walletConnected = !!address;

  useEffect(() => {
    const listingId = createdListingIdRef.current ?? createdListingId;
    if (!listingId || !listingSuccess) return;
    const t = setTimeout(() => router.push(listingHref(listingId)), 2200);
    return () => clearTimeout(t);
  }, [listingSuccess, createdListingId, router]);

  useEffect(() => {
    const errMsg = submitError ?? (error ? getTransactionErrorMessage(error, { chainId }) : null);
    if (!errMsg) return;
  }, [submitError, error, chainId, price, title, mediaItems.length]);

  const duplicateId = searchParams.get("duplicate");

  useEffect(() => {
    if (!duplicateId) return;
    fetch(`${getApiUrl()}/api/listing/${encodeURIComponent(duplicateId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: { listing?: any }) => {
        const item = data.listing;
        if (!item) return;
        setTitle(item.title ?? "");
        setSubtitle(item.subtitle ?? "");
        setDescription(item.description ?? "");
        setCategory(item.category ?? "");
        setCondition(item.condition ?? "");
        setYearOfProduction(item.yearOfProduction ?? "");
        if (
          item.city ||
          (typeof item.locationLat === "number" && typeof item.locationLng === "number")
        ) {
          setLocation({
            city: item.city ?? null,
            lat: typeof item.locationLat === "number" ? item.locationLat : null,
            lng: typeof item.locationLng === "number" ? item.locationLng : null,
          });
        }
        setPrice(formatPriceForDisplay(item.price ?? "0"));
        const urls = item.mediaUrls?.length ? item.mediaUrls : item.imageUrl ? [item.imageUrl] : [];
        duplicateMediaUrlsRef.current = urls;
      })
      .catch(() => {});
  }, [duplicateId]);

  const addMedia = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMediaError(null);
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const allowedImage = /^image\/(jpeg|jpg|png|gif|webp)$/i;
    const allowedVideo = /^video\/(mp4|webm|quicktime)$/i;
    const newItems: MediaItem[] = [];
    for (const file of files) {
      if (!allowedImage.test(file.type) && !allowedVideo.test(file.type)) {
        setMediaError("Only images (JPEG, PNG, GIF, WebP) or videos (MP4, WebM, MOV) allowed.");
        continue;
      }
      if (file.size > MAX_MEDIA_SIZE) {
        setMediaError("Each file must be 15MB or smaller.");
        continue;
      }
      const previewUrl = file.type.startsWith("video/")
        ? URL.createObjectURL(file)
        : URL.createObjectURL(file);
      newItems.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        previewUrl,
        isVideo: isVideoFile(file),
      });
    }
    setMediaItems((prev) => [...prev, ...newItems]);
    e.target.value = "";
  }, []);

  const removeMedia = useCallback((id: string) => {
    setMediaItems((prev) => {
      const item = prev.find((m) => m.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((m) => m.id !== id);
    });
    setMediaError(null);
  }, []);

  const reorderMedia = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setMediaItems((prev) => {
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return next;
    });
  }, []);

  const handleMediaDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("application/x-listing-media-index", String(index));
    e.dataTransfer.effectAllowed = "move";
    (e.target as HTMLElement).classList.add("opacity-50");
  }, []);

  const handleMediaDragEnd = useCallback((e: React.DragEvent) => {
    (e.target as HTMLElement).classList.remove("opacity-50");
  }, []);

  const handleMediaDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleMediaDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("application/x-listing-media-index");
      if (raw === "") return;
      const fromIndex = parseInt(raw, 10);
      if (Number.isNaN(fromIndex)) return;
      reorderMedia(fromIndex, dropIndex);
    },
    [reorderMedia],
  );

  const uploadMediaItems = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const item of mediaItems) {
      const isVideo = item.isVideo;
      const form = new FormData();
      if (isVideo) {
        form.append("media", item.file);
        const res = await fetch(`${getApiUrl()}/api/upload-listing-media`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Media upload failed");
        }
        const data = await res.json();
        if (data.mediaUrl) urls.push(data.mediaUrl);
      } else {
        const compressed = await compressImage(item.file);
        if (compressed.size > MAX_IMAGE_SIZE) {
          throw new Error(
            "One or more images are still too large after compression. Try smaller images.",
          );
        }
        form.append("media", compressed);
        const res = await fetch(`${getApiUrl()}/api/upload-listing-media`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Image upload failed");
        }
        const data = await res.json();
        if (data.mediaUrl) urls.push(data.mediaUrl);
      }
    }
    return urls;
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    const fromDuplicate = duplicateMediaUrlsRef.current.length > 0;
    titleRef.current = title.trim() || null;
    subtitleRef.current = subtitle.trim() || null;
    descriptionRef.current = description.trim() || null;
    categoryRef.current = category.trim() || null;
    conditionRef.current = condition.trim() || null;
    yearOfProductionRef.current = yearOfProduction.trim() || null;
    cityRef.current = location.city?.trim() || null;
    locationLatRef.current = typeof location.lat === "number" ? location.lat : null;
    locationLngRef.current = typeof location.lng === "number" ? location.lng : null;
    requireEscrowRef.current = requireEscrow;

    if (!price || Number(price) <= 0) {
      setSubmitError("Enter a price.");
      return;
    }

    if (!category.trim()) {
      setSubmitError("Select a category.");
      return;
    }

    let urls: string[] = fromDuplicate ? [...duplicateMediaUrlsRef.current] : [];
    if (mediaItems.length > 0) {
      try {
        const uploaded = await uploadMediaItems();
        urls = [...urls, ...uploaded];
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Media upload failed");
        return;
      }
    }
    if (urls.length > 0) {
      imageUrlRef.current = urls[0];
      mediaUrlsRef.current = urls;
    } else {
      imageUrlRef.current = null;
      mediaUrlsRef.current = [];
    }
    try {
      const listingId = await create(price);
      createdListingIdRef.current = listingId;
      setCreatedListingId(listingId);
    } catch (err) {
      const friendly = getTransactionErrorMessage(err, { chainId });
      setSubmitError(friendly || (err instanceof Error ? err.message : "Create listing failed"));
    }
  };

  const canSubmit = !!title.trim() && !!price && Number(price) > 0;

  const featuredItem = mediaItems[0];

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 relative">
        {listingSuccess && (createdListingIdRef.current ?? createdListingId) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-card p-8 max-w-sm text-center space-y-6">
              <div className="w-12 h-12 mx-auto rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
              <p className="text-lg font-semibold text-white">Listing created</p>
              <p className="text-sm text-silver">Redirecting to your listing…</p>
              {transactionExplorerUrl && (
                <a
                  href={transactionExplorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-200 hover:text-white underline"
                >
                  View transaction on HashScan
                </a>
              )}
              <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                <Link
                  href={listingHref(createdListingIdRef.current ?? createdListingId ?? "")}
                  className="btn-frost-cta text-center"
                >
                  View listing
                </Link>
                <Link href="/" className="btn-frost text-center border-white/20">
                  Home
                </Link>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Create Listing</h1>
        </div>

        {!walletConnected && (
          <div className="rounded-lg border-2 border-chrome/50 bg-chrome/10 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="text-white font-medium">Connect your wallet to create a listing.</p>
            <ConnectWalletButton className="btn-frost-cta shrink-0 ring-2 ring-chrome/70 ring-offset-2 ring-offset-[var(--bg)] shadow-glow-hover disabled:opacity-50" />
          </div>
        )}

        {duplicateId && (
          <p className="text-sm text-chrome bg-white/5 rounded-lg px-3 py-2 border border-white/10">
            Duplicating listing. Details are prefilled—review and click Create listing when ready.
          </p>
        )}

        {/* Render the form only when the wallet is connected. The disabled
            form for unauthenticated visitors served no purpose and made the
            page sensitive to leaflet/wallet cleanup races on navigation. */}
        {walletConnected && (
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:gap-10">
          <div className="space-y-8 min-w-0">
          <section>
            <SectionHeader
              title="Photos"
              sub="First image becomes the cover. Drag to reorder; max 15MB per file."
            />
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_MEDIA_TYPES}
              multiple
              onChange={addMedia}
              className="hidden"
            />
            <div className="mt-2 space-y-2">
              <div
                className="aspect-video rounded-lg border-2 border-dashed border-white/10 overflow-hidden bg-white/5 flex items-center justify-center hover:border-white/20 transition-colors"
                onDragOver={handleMediaDragOver}
                onDrop={(e) => handleMediaDrop(e, 0)}
              >
                {featuredItem ? (
                  <div
                    className="relative w-full h-full group cursor-grab active:cursor-grabbing"
                    draggable
                    onDragStart={(e) => handleMediaDragStart(e, 0)}
                    onDragEnd={handleMediaDragEnd}
                  >
                    {featuredItem.isVideo ? (
                      <video
                        src={featuredItem.previewUrl}
                        className="object-contain w-full h-full pointer-events-none"
                        muted
                        playsInline
                      />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={featuredItem.previewUrl}
                        alt="Featured"
                        className="object-contain w-full h-full pointer-events-none select-none"
                        draggable={false}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(featuredItem.id)}
                      className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center bg-black/70 text-white rounded-bl-lg hover:bg-rose-500 transition-colors"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-full flex items-center justify-center text-silver hover:text-white border-2 border-dashed border-white/20 rounded-lg"
                  >
                    + Add featured image / video
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {mediaItems.map((item, index) => (
                  <div
                    key={item.id}
                    className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors cursor-grab active:cursor-grabbing ${index === 0 ? "ring-2 ring-chrome ring-offset-2 ring-offset-[var(--bg)]" : "border-white/10"}`}
                    draggable
                    onDragStart={(e) => handleMediaDragStart(e, index)}
                    onDragEnd={handleMediaDragEnd}
                    onDragOver={handleMediaDragOver}
                    onDrop={(e) => handleMediaDrop(e, index)}
                    title={
                      index === 0
                        ? "Featured (drag to reorder)"
                        : "Drag to reorder or drag to top to set as featured"
                    }
                  >
                    {item.isVideo ? (
                      <video
                        src={item.previewUrl}
                        className="object-cover w-full h-full pointer-events-none"
                        muted
                        playsInline
                      />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.previewUrl}
                        alt=""
                        className="object-cover w-full h-full pointer-events-none select-none"
                        draggable={false}
                      />
                    )}
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => removeMedia(item.id)}
                        className="absolute top-0 right-0 w-6 h-6 flex items-center justify-center bg-black/70 text-white text-sm rounded-bl-lg hover:bg-rose-500 transition-colors"
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-white/20 text-silver hover:border-chrome hover:text-white flex items-center justify-center text-xl flex-shrink-0"
                  aria-label="Add media"
                >
                  +
                </button>
              </div>
            </div>
            {mediaError && <p className="text-rose-400 text-xs mt-1">{mediaError}</p>}
          </section>

          <section>
            <SectionHeader title="Basics" />
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-semibold text-white">
                  Title <span className="text-chrome">*</span>
                </span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input-frost mt-1 w-full h-12 text-base font-semibold"
                  placeholder="e.g. Vintage Polaroid SX-70 — restored bellows"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-white">Subtitle</span>
                <input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="input-frost mt-1 w-full"
                  placeholder="One-line teaser shown on cards"
                />
              </label>

              <label className="block">
                <span className="flex items-baseline justify-between text-xs font-semibold text-white">
                  Description
                  <span className="font-mono text-[10px] uppercase tracking-wide text-silver">
                    Markdown supported
                  </span>
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-frost mt-1 w-full min-h-[100px] resize-y"
                  placeholder="What makes it worth buying? Condition notes, what's included, any flaws."
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-semibold text-white">
                    Price <span className="text-chrome">*</span>
                  </span>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="input-frost w-full h-12 text-lg font-semibold font-mono pr-12"
                      placeholder="0"
                    />
                    <span className="absolute inset-y-0 right-3 flex items-center font-mono text-sm text-silver">
                      ℏ
                    </span>
                  </div>
                </label>
                <label className="block">
                  <span className="flex items-baseline justify-between text-xs font-semibold text-white">
                    Year of production
                    <span className="font-mono text-[10px] uppercase tracking-wide text-silver">
                      Optional
                    </span>
                  </span>
                  <input
                    type="text"
                    value={yearOfProduction}
                    onChange={(e) => setYearOfProduction(e.target.value)}
                    className="input-frost mt-1 w-full h-12"
                    placeholder="e.g. 1973"
                  />
                </label>
              </div>
            </div>
          </section>

          <section>
            <SectionHeader title="Category & condition" />
            <div className="space-y-5">
              <div>
                <span className="text-xs font-semibold text-white">
                  Category <span className="text-chrome">*</span>
                </span>
                <div className="mt-1">
                  <CategorySearch
                    value={category}
                    onChange={setCategory}
                    placeholder="Search categories (e.g. watches, cars, software)…"
                  />
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-white">
                  Condition <span className="text-chrome">*</span>
                </span>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {CONDITIONS.map((c) => {
                    const active = condition === c.label;
                    return (
                      <button
                        key={c.label}
                        type="button"
                        onClick={() => setCondition(c.label)}
                        className={`text-left rounded-lg px-2.5 py-2.5 border transition-colors ${
                          active
                            ? "bg-[#00ffa3]/10 border-[#00ffa3]/50 text-chrome shadow-[0_0_16px_rgba(0,255,163,0.15)]"
                            : "bg-white/5 border-white/10 text-white hover:border-white/20"
                        }`}
                      >
                        <div className="text-xs font-bold">{c.label}</div>
                        <div className="text-[10px] text-silver leading-tight mt-1">{c.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section>
            <SectionHeader
              title="Location"
              sub="Shown publicly only down to neighborhood. Search a city or click the map to drop a pin."
            />
            <LocationPicker value={location} onChange={setLocation} />
          </section>

          <section>
            <SectionHeader title="Shipping & escrow" />
            <button
              type="button"
              onClick={() => setRequireEscrow(!requireEscrow)}
              className={`w-full flex items-center gap-3 rounded-lg px-3.5 py-3 text-left border transition-colors ${
                requireEscrow
                  ? "bg-[#00ffa3]/[0.04] border-[#00ffa3]/25"
                  : "bg-white/5 border-white/10"
              }`}
              aria-pressed={requireEscrow}
            >
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">
                  Require shipping + on-chain escrow
                </div>
                <div className="text-xs text-silver mt-0.5 leading-snug">
                  Funds lock in the marketplace contract until the buyer confirms receipt. Tracking
                  is required before escrow releases.
                </div>
              </div>
              <span
                className={`shrink-0 inline-flex w-9 h-5 rounded-full relative transition-colors ${
                  requireEscrow ? "bg-chrome" : "bg-white/15"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                    requireEscrow ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </span>
            </button>
          </section>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-silver">
            Posting a listing costs HBAR for the Hedera network (gas) fee — there's no platform fee.
            Estimated <span className="text-chrome font-medium">~0.01 – 0.05 ℏ</span>; your wallet
            will show the exact amount.
          </div>

          {listingSuccess && !(createdListingIdRef.current ?? createdListingId) && (
            <p className="text-emerald-400 text-sm">Listing created on-chain. Redirecting…</p>
          )}
          {(error || submitError) && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 space-y-2">
              <p className="text-rose-300 text-sm">
                {submitError ?? getTransactionErrorMessage(error, { chainId })}
              </p>
              <p className="text-xs text-silver">
                You can try again or go{" "}
                <Link href="/" className="text-chrome hover:text-white underline">
                  Home
                </Link>
                .
              </p>
            </div>
          )}
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto space-y-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-silver">
              Live preview
            </div>
            <ListingPreviewCard
              title={title}
              price={price}
              category={category}
              condition={condition}
              location={location.city}
              featuredItem={featuredItem}
              account={address}
              requireEscrow={requireEscrow}
            />
            <ListingHealth
              title={title}
              price={price}
              description={description}
              hasMedia={mediaItems.length > 0}
              hasLocation={!!location.city || (location.lat != null && location.lng != null)}
              mediaCount={mediaItems.length}
            />
            <button
              onClick={handleSubmit}
              disabled={isPending || !canSubmit}
              className="w-full rounded-lg px-5 py-3 bg-chrome text-black text-sm font-bold shadow-[0_0_20px_rgba(0,255,163,0.35)] disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {isPending ? "Confirm in wallet…" : "Publish listing →"}
            </button>
          </aside>
          </div>
        )}
      </div>
    </main>
  );
}

function ListingPreviewCard({
  title,
  price,
  category,
  condition,
  location,
  featuredItem,
  account,
  requireEscrow,
}: {
  title: string;
  price: string;
  category: string;
  condition: string;
  location: string | null;
  featuredItem: MediaItem | undefined;
  account: string | null | undefined;
  requireEscrow: boolean;
}) {
  const displayTitle = title.trim() || "Your listing title";
  const displayPrice = price && Number(price) > 0 ? `${price} ℏ` : "— ℏ";
  return (
    <div className="rounded-2xl overflow-hidden bg-white/[0.03] border border-white/10">
      <div className="relative h-48 bg-gradient-to-br from-[#3b3b56] to-[#1a1a2e] flex items-center justify-center text-5xl">
        {featuredItem ? (
          featuredItem.isVideo ? (
            <video
              src={featuredItem.previewUrl}
              className="absolute inset-0 w-full h-full object-cover"
              muted
              playsInline
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={featuredItem.previewUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          )
        ) : (
          <span aria-hidden>📷</span>
        )}
        <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-chrome text-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-black/80" />
          Listed
        </span>
        {category && (
          <span className="absolute top-2.5 right-2.5 inline-flex items-center rounded-full bg-black/55 text-white px-2.5 py-0.5 text-[10px] font-medium">
            {category}
          </span>
        )}
      </div>
      <div className="p-3.5">
        <div className="text-sm font-bold text-white leading-snug line-clamp-2">{displayTitle}</div>
        <p className="text-[11px] font-mono text-silver mt-1 truncate">
          by {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "you"} · ★ 5.0
        </p>
        <div className="flex items-baseline justify-between mt-2.5">
          <span className="text-lg font-extrabold text-chrome">{displayPrice}</span>
          <span className="text-[11px] font-mono text-silver truncate ml-2">{location || "—"}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {condition && (
            <span className="rounded-full bg-white/5 text-silver px-2 py-0.5 text-[10px]">
              {condition}
            </span>
          )}
          {requireEscrow && (
            <>
              <span className="rounded-full bg-[#00ffa3]/10 text-chrome px-2 py-0.5 text-[10px]">
                Escrow
              </span>
              <span className="rounded-full bg-[#00ffa3]/10 text-chrome px-2 py-0.5 text-[10px]">
                + Ships
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ListingHealth({
  title,
  price,
  description,
  hasMedia,
  hasLocation,
  mediaCount,
}: {
  title: string;
  price: string;
  description: string;
  hasMedia: boolean;
  hasLocation: boolean;
  mediaCount: number;
}) {
  const wordCount = description.trim().split(/\s+/).filter(Boolean).length;
  const titleTrimmed = title.trim();
  const checks: { label: string; ok: boolean; hint?: string }[] = [
    {
      label: `${mediaCount >= 3 ? "3+ photos" : "Add at least 3 photos"}`,
      ok: mediaCount >= 3,
      hint: hasMedia && mediaCount < 3 ? `${3 - mediaCount} more` : undefined,
    },
    {
      label: "Title under 60 chars",
      ok: titleTrimmed.length > 0 && titleTrimmed.length <= 60,
      hint: titleTrimmed.length > 60 ? "Shorten it" : undefined,
    },
    {
      label: "Price set",
      ok: !!price && Number(price) > 0,
    },
    {
      label: "Location pinned",
      ok: hasLocation,
    },
    {
      label: "Description ≥ 60 words",
      ok: wordCount >= 60,
      hint: wordCount > 0 && wordCount < 60 ? `Add ~${60 - wordCount} more words` : undefined,
    },
  ];
  return (
    <div className="rounded-xl border border-[#00ffa3]/20 bg-[#00ffa3]/[0.04] p-3.5">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-chrome mb-2">
        Listing health
      </div>
      {checks.map((c) => (
        <div key={c.label} className="flex items-center gap-2 py-1 text-xs">
          <span
            className={`shrink-0 w-3.5 h-3.5 rounded-full inline-flex items-center justify-center text-[9px] font-extrabold ${
              c.ok ? "bg-chrome text-black" : "bg-white/8 text-transparent"
            }`}
          >
            ✓
          </span>
          <span className={`flex-1 ${c.ok ? "text-white" : "text-silver"}`}>{c.label}</span>
          {c.hint && (
            <span className="font-mono text-[10px] text-amber-300">{c.hint}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3.5">
      <h2 className="text-xs font-extrabold uppercase tracking-[0.12em] text-white">{title}</h2>
      {sub && <p className="mt-1 text-xs text-silver leading-snug">{sub}</p>}
    </div>
  );
}


export default function CreatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-silver">Loading…</div>
      }
    >
      <CreatePageContent />
    </Suspense>
  );
}
