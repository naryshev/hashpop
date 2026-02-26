"use client";

import { useRef, useState, useMemo, useCallback, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCreateListing } from "../../hooks/useCreateListing";
import { CategorySearch } from "../../components/CategorySearch";
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

const CONDITIONS = [
  "Like new & unworn",
  "Like new",
  "Used",
  "Refurbished",
  "For parts or repair",
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

  const { create, isPending: listingPending, isSuccess: listingSuccess, error: listingError, hash: lastTxId } = useCreateListing({
    imageUrlRef,
    mediaUrlsRef,
    requireEscrowRef,
    titleRef,
    subtitleRef,
    descriptionRef,
    categoryRef,
    conditionRef,
    yearOfProductionRef,
  });
  const isPending = listingPending;
  const isSuccess = listingSuccess;
  const error = listingError;
  const transactionExplorerUrl = getTransactionExplorerUrl(lastTxId, chainId);
  const walletConnected = !!address;

  useEffect(() => {
    const listingId = createdListingIdRef.current ?? createdListingId;
    if (!listingId || !listingSuccess) return;
    const t = setTimeout(() => router.push(`/listing/${encodeURIComponent(listingId)}`), 2200);
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
      const previewUrl = file.type.startsWith("video/") ? URL.createObjectURL(file) : URL.createObjectURL(file);
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

  const handleMediaDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/x-listing-media-index");
    if (raw === "") return;
    const fromIndex = parseInt(raw, 10);
    if (Number.isNaN(fromIndex)) return;
    reorderMedia(fromIndex, dropIndex);
  }, [reorderMedia]);

  const uploadMediaItems = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const item of mediaItems) {
      const isVideo = item.isVideo;
      const form = new FormData();
      if (isVideo) {
        form.append("media", item.file);
        const res = await fetch(`${getApiUrl()}/api/upload-listing-media`, { method: "POST", body: form });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Media upload failed");
        }
        const data = await res.json();
        if (data.mediaUrl) urls.push(data.mediaUrl);
      } else {
        const compressed = await compressImage(item.file);
        if (compressed.size > MAX_IMAGE_SIZE) {
          throw new Error("One or more images are still too large after compression. Try smaller images.");
        }
        form.append("media", compressed);
        const res = await fetch(`${getApiUrl()}/api/upload-listing-media`, { method: "POST", body: form });
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
    requireEscrowRef.current = requireEscrow;

    if (!price || Number(price) <= 0) {
      setSubmitError("Enter a price.");
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
  const additionalItems = mediaItems.slice(1);

  return (
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6 relative">
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
                href={`/listing/${encodeURIComponent(createdListingIdRef.current ?? createdListingId ?? "")}`}
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
          <Link href="/" className="text-sm text-chrome hover:text-white font-medium">Home</Link>
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

      <div className={`glass-card p-6 space-y-4 ${!walletConnected ? "pointer-events-none opacity-60" : ""}`}>
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-200">Transaction fee (HBAR)</p>
          <p className="text-sm text-silver mt-1">
            Posting a listing costs HBAR to cover the network (gas) fee. There is no platform fee—you only pay the Hedera network fee.
          </p>
          <p className="text-chrome font-medium mt-2">
            Estimated fee: ~0.01 – 0.05 HBAR
          </p>
          <p className="text-xs text-silver mt-1">
            The exact amount will be shown in your wallet when you confirm the transaction. Fees can vary with network load.
          </p>
        </div>

        <div className="block">
          <span className="text-sm text-silver">Media (optional)</span>
          <p className="text-xs text-silver mt-0.5">Drag to reorder; drag an image to the top slot to set it as featured. Max 15MB per file.</p>
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
                    <video src={featuredItem.previewUrl} className="object-contain w-full h-full pointer-events-none" muted playsInline />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={featuredItem.previewUrl} alt="Featured" className="object-contain w-full h-full pointer-events-none select-none" draggable={false} />
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
                  title={index === 0 ? "Featured (drag to reorder)" : "Drag to reorder or drag to top to set as featured"}
                >
                  {item.isVideo ? (
                    <video src={item.previewUrl} className="object-cover w-full h-full pointer-events-none" muted playsInline />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={item.previewUrl} alt="" className="object-cover w-full h-full pointer-events-none select-none" draggable={false} />
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
        </div>

        <label className="block">
          <span className="text-sm text-silver">Price (HBAR) <span className="text-rose-400">*</span></span>
          <input
            type="number"
            step="any"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="input-frost mt-1 w-full"
            placeholder="1.5"
          />
        </label>

        <label className="block">
          <span className="text-sm text-silver">Title <span className="text-rose-400">*</span></span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-frost mt-1 w-full"
            placeholder="—"
          />
        </label>

        <label className="block">
          <span className="text-sm text-silver">Subtitle / short description</span>
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            className="input-frost mt-1 w-full"
            placeholder="—"
          />
        </label>

        <label className="block">
          <span className="text-sm text-silver">Item description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-frost mt-1 w-full min-h-[100px] resize-y"
            placeholder="—"
          />
        </label>

        <label className="block">
          <span className="text-sm text-silver">Category</span>
          <CategorySearch
            value={category}
            onChange={setCategory}
            placeholder="Search categories (e.g. watches, cars, software)…"
          />
        </label>

        <label className="block">
          <span className="text-sm text-silver">Condition</span>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="input-frost mt-1 w-full"
          >
            <option value="">Select condition</option>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-silver">Year of production</span>
          <input
            type="text"
            value={yearOfProduction}
            onChange={(e) => setYearOfProduction(e.target.value)}
            className="input-frost mt-1 w-full"
            placeholder="—"
          />
        </label>

        <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
          <input
            type="checkbox"
            checked={requireEscrow}
            onChange={(e) => setRequireEscrow(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-sm text-silver">
            <span className="text-white font-medium">Require escrow + shipping proof</span>
            <br />
            Enable this for shippable items. Buyer payment remains in escrow until seller provides shipment proof and buyer confirms receipt.
          </span>
        </label>

        {walletConnected ? (
        <button
            onClick={handleSubmit}
            disabled={isPending || !canSubmit}
          className="btn-frost-cta w-full disabled:opacity-60 disabled:cursor-not-allowed"
        >
            {isPending ? "Confirm in wallet…" : "Create listing"}
          </button>
        ) : (
          <ConnectWalletButton className="btn-frost-cta w-full ring-2 ring-chrome/70 ring-offset-2 ring-offset-[var(--bg)] disabled:opacity-50 disabled:cursor-not-allowed" />
        )}

        {listingSuccess && !(createdListingIdRef.current ?? createdListingId) && (
          <p className="text-emerald-400 text-sm">
            Listing created on-chain. Redirecting…
          </p>
        )}
        {(error || submitError) && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 space-y-2">
            <p className="text-rose-300 text-sm">
              {submitError ?? getTransactionErrorMessage(error, { chainId })}
            </p>
            <p className="text-xs text-silver">You can try again or go <Link href="/" className="text-chrome hover:text-white underline">Home</Link>.</p>
          </div>
        )}
      </div>
      </div>
    </main>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-silver">Loading…</div>}>
      <CreatePageContent />
    </Suspense>
  );
}
