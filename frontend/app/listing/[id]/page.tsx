"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, Clock } from "lucide-react";
import { BuyButton } from "../../../components/BuyButton";
import { EscrowPanel } from "../../../components/EscrowPanel";
import { AddressDisplay } from "../../../components/AddressDisplay";
import { formatContractAmountToHbar, formatPriceForDisplay } from "../../../lib/formatPrice";
import { formatHbarWithUsd } from "../../../lib/hbarUsd";
import { useHbarUsd } from "../../../hooks/useHbarUsd";
import { formatListingDate } from "../../../lib/formatDate";
import { useCancelListing } from "../../../hooks/useCancelListing";
import { getTransactionErrorMessage } from "../../../lib/transactionError";
import { useUpdateListingPrice } from "../../../hooks/useUpdateListingPrice";
import { compressImage } from "../../../lib/compressImage";
import { listingIdToBytes32 } from "../../../lib/bytes32";
import { useHashpackWallet } from "../../../lib/hashpackWallet";
import { ConnectWalletButton } from "../../../components/ConnectWalletButton";
import { activeHederaChain } from "../../../lib/hederaChains";
import { readListingCompat } from "../../../lib/marketplaceRead";
import { getTransactionExplorerUrl } from "../../../lib/explorer";

import { getApiUrl } from "../../../lib/apiUrl";
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = "image/jpeg,image/jpg,image/png,image/gif,image/webp";

function isVideoMedia(url: string): boolean {
  return /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
}

function formatListingId(id: string): string {
  if (!id || !id.startsWith("0x") || id.length !== 66) return id;
  try {
    const hex = id.slice(2).replace(/0+$/, "");
    if (hex.length % 2) return id;
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    const str = new TextDecoder().decode(bytes);
    return /^[\x20-\x7e]+$/.test(str) ? str : `${id.slice(0, 10)}…`;
  } catch {
    return `${id.slice(0, 10)}…`;
  }
}

type Listing = {
  id: string;
  seller: string;
  buyer?: string | null;
  price: string;
  status: string;
  requireEscrow?: boolean;
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
  shippedAt?: string | null;
  exchangeConfirmedAt?: string | null;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  category?: string | null;
  condition?: string | null;
  yearOfProduction?: string | null;
  originalBox?: string | null;
  originalPapers?: string | null;
  imageUrl?: string | null;
  mediaUrls?: string[];
  txHash?: string | null;
  createdAt?: string;
  onChainConfirmed?: boolean;
  location?: string | null;
};

export default function ListingPage() {
  const accountIdToLongZeroAddress = (value: string): `0x${string}` => {
    const [shardRaw, realmRaw, numRaw] = value.split(".");
    const shard = BigInt(shardRaw || "0");
    const realm = BigInt(realmRaw || "0");
    const num = BigInt(numRaw || "0");
    const shardHex = shard.toString(16).padStart(8, "0");
    const realmHex = realm.toString(16).padStart(16, "0");
    const numHex = num.toString(16).padStart(16, "0");
    return `0x${(shardHex + realmHex + numHex).toLowerCase()}` as `0x${string}`;
  };
  const params = useParams();
  const id = (params.id as string) || "";
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSubtitle, setEditSubtitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCondition, setEditCondition] = useState("");
  const [editYearOfProduction, setEditYearOfProduction] = useState("");
  const [editImageFiles, setEditImageFiles] = useState<File[]>([]);
  const [editRemovedMediaUrls, setEditRemovedMediaUrls] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [priceUpdateFailedBanner, setPriceUpdateFailedBanner] = useState<string | null>(null);
  const [inWishlist, setInWishlist] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("scam");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<
    Array<{ id: string; fromAddress: string; toAddress: string; body: string; createdAt: string }>
  >([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatReply, setChatReply] = useState("");
  const [chatSending, setChatSending] = useState(false);
  type SimilarItem = {
    id: string;
    title?: string | null;
    price: string;
    imageUrl?: string | null;
    mediaUrls?: string[];
    category?: string | null;
    status: string;
  };
  const [similarListings, setSimilarListings] = useState<SimilarItem[]>([]);
  const router = useRouter();
  const { address, accountId } = useHashpackWallet();
  const chainId = activeHederaChain.id;
  const {
    cancel,
    isPending: cancelPending,
    isSuccess: cancelSuccess,
    hash: cancelTxHash,
    error: cancelHookError,
  } = useCancelListing();
  const [canForceCancel, setCanForceCancel] = useState(false);
  const [forceDeleting, setForceDeleting] = useState(false);
  const { updatePriceOnChain, isPending: priceUpdatePending } = useUpdateListingPrice();
  const walletConnected = !!address;
  const usdRate = useHbarUsd();

  const item = listing;

  const listingIdBytes = useMemo(
    () => (listing?.id ? listingIdToBytes32(listing.id) : undefined),
    [listing?.id],
  );
  const [onChainListing, setOnChainListing] = useState<
    { seller: string; price: bigint; status: number } | undefined
  >(undefined);
  function parsePriceWei(raw: unknown): bigint {
    if (raw == null) return 0n;
    if (typeof raw === "bigint") return raw;
    if (typeof raw === "number") return BigInt(Math.floor(raw));
    if (typeof raw === "string") return BigInt(raw);
    const o = raw as { _hex?: string; value?: string };
    if (o?._hex) return BigInt(o._hex);
    if (o?.value != null) return BigInt(o.value);
    return 0n;
  }
  useEffect(() => {
    if (!listing?.id || !listingIdBytes) {
      setOnChainListing(undefined);
      return;
    }
    let cancelled = false;
    void readListingCompat(listingIdBytes)
      .then((data) => {
        if (!cancelled)
          setOnChainListing({ seller: data.seller, price: data.price, status: data.status });
      })
      .catch(() => {
        if (!cancelled) setOnChainListing(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [listing?.id, listingIdBytes]);
  const onChainPriceWei = parsePriceWei(onChainListing?.price);
  const onChainPriceHbar =
    onChainPriceWei > 0n ? formatContractAmountToHbar(onChainPriceWei.toString()) : null;
  const apiPriceHbar = listing?.price ? formatPriceForDisplay(listing.price) : null;
  const priceMismatch =
    apiPriceHbar != null &&
    onChainPriceHbar != null &&
    Math.abs(Number(apiPriceHbar) - Number(onChainPriceHbar)) > 0.0001;

  const fetchListing = useCallback(
    (attempt = 0, clearFirst = true) => {
      if (!id) return;
      const maxRetries = 4;
      const retryDelayMs = 1600;
      if (attempt === 0 && clearFirst) {
        setLoading(true);
        setListing(null);
      }
      fetch(`${getApiUrl()}/api/listing/${encodeURIComponent(id)}`)
        .then((res) => {
          if (res.ok) return res.json().then((data: { listing: Listing }) => data.listing);
          if (res.status === 404) return null;
          return Promise.reject(res);
        })
        .then((listingData) => {
          if (listingData) {
            setListing(listingData);
            setLoading(false);
            return;
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    },
    [id],
  );

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    fetchListing(0);
  }, [id, fetchListing]);

  useEffect(() => {
    if (!listing) return;
    setEditTitle(listing.title ?? "");
    setEditSubtitle(listing.subtitle ?? "");
    setEditDescription(listing.description ?? "");
    setEditPrice(formatPriceForDisplay(listing.price));
    setEditCondition(listing.condition ?? "");
    setEditYearOfProduction(listing.yearOfProduction ?? "");
  }, [listing]);

  useEffect(() => {
    if (!cancelSuccess) return;
    if (cancelTxHash) {
      fetch(`${getApiUrl()}/api/sync-cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: cancelTxHash }),
      }).catch(() => {});
    }
    const t = setTimeout(() => router.push("/dashboard"), 2200);
    return () => clearTimeout(t);
  }, [cancelSuccess, cancelTxHash, router]);

  useEffect(() => {
    const item = listing;
    const existing = item
      ? item.mediaUrls?.length
        ? item.mediaUrls
        : item.imageUrl
          ? [item.imageUrl]
          : []
      : [];
    const kept = existing.filter((u) => !editRemovedMediaUrls.includes(u));
    if (kept.length > 0 && selectedMediaIndex >= kept.length)
      setSelectedMediaIndex(Math.max(0, kept.length - 1));
  }, [listing, editRemovedMediaUrls, selectedMediaIndex]);

  useEffect(() => {
    if (!address || !id) return;
    fetch(`${getApiUrl()}/api/wishlist?address=${encodeURIComponent(address)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { items?: { itemId: string }[] }) => {
        setInWishlist((data.items || []).some((i) => i.itemId === id));
      })
      .catch(() => {});
  }, [address, id]);

  useEffect(() => {
    if (!listing || !address) return;
    const sellerMatch = address.toLowerCase() === listing.seller.toLowerCase();
    const listed = listing.status === "LISTED";
    const buyPanelVisible = listed && walletConnected && !sellerMatch;
    void buyPanelVisible;
  }, [listing, address, walletConnected]);

  useEffect(() => {
    if (!editError && !priceUpdateFailedBanner) return;
  }, [editError, priceUpdateFailedBanner, listing?.id, id]);

  useEffect(() => {
    if (listing?.status !== "LISTED" && editing) setEditing(false);
  }, [listing?.status, editing]);

  useEffect(() => {
    if (!id || !address || !listing?.buyer || !listing?.seller) return;
    const buyerAddr = listing.buyer.toLowerCase();
    const sellerAddr = listing.seller.toLowerCase();
    const myAddr = address.toLowerCase();
    const myLongZero = accountId ? accountIdToLongZeroAddress(accountId).toLowerCase() : null;
    const isInvolved =
      myAddr === buyerAddr ||
      myAddr === sellerAddr ||
      (myLongZero !== null && (myLongZero === buyerAddr || myLongZero === sellerAddr));
    if (!isInvolved) return;
    const other = myAddr === buyerAddr ? listing.seller : listing.buyer;
    setChatLoading(true);
    const q = new URLSearchParams({ address, other, listingId: id });
    fetch(`${getApiUrl()}/api/messages/thread?${q}`)
      .then((res) => res.json())
      .then(
        (data: {
          messages?: Array<{
            id: string;
            fromAddress: string;
            toAddress: string;
            body: string;
            createdAt: string;
          }>;
        }) => {
          setChatMessages(data.messages ?? []);
        },
      )
      .catch(() => setChatMessages([]))
      .finally(() => setChatLoading(false));
  }, [id, address, accountId, listing?.buyer, listing?.seller]);

  useEffect(() => {
    if (!listing?.category || !listing?.id) return;
    fetch(`${getApiUrl()}/api/listings`)
      .then((r) => r.json())
      .then((data: { listings?: Array<{ id: string; title?: string | null; price: string; imageUrl?: string | null; mediaUrls?: string[]; category?: string | null; status: string }> }) => {
        const similar = (data.listings ?? [])
          .filter((l) => l.category === listing.category && l.id !== listing.id)
          .slice(0, 4);
        setSimilarListings(similar);
      })
      .catch(() => {});
  }, [listing?.category, listing?.id]);

  const sendChatReply = async () => {
    if (!address || !chatReply.trim() || chatSending || !listing?.buyer || !listing?.seller) return;
    const buyerAddr = listing.buyer.toLowerCase();
    const myAddr = address.toLowerCase();
    const other = myAddr === buyerAddr ? listing.seller : listing.buyer;
    setChatSending(true);
    try {
      await fetch(`${getApiUrl()}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAddress: address,
          toAddress: other,
          body: chatReply.trim(),
          listingId: id,
        }),
      });
      setChatReply("");
      const q = new URLSearchParams({ address, other, listingId: id });
      const res = await fetch(`${getApiUrl()}/api/messages/thread?${q}`);
      const data = (await res.json()) as {
        messages?: Array<{
          id: string;
          fromAddress: string;
          toAddress: string;
          body: string;
          createdAt: string;
        }>;
      };
      setChatMessages(data.messages ?? []);
    } finally {
      setChatSending(false);
    }
  };

  const toggleWishlist = async () => {
    if (!address || !id || wishlistLoading) return;
    setWishlistLoading(true);
    const itemType = "listing";
    try {
      if (inWishlist) {
        await fetch(
          `${getApiUrl()}/api/wishlist?address=${encodeURIComponent(address)}&itemId=${encodeURIComponent(id)}`,
          { method: "DELETE" },
        );
        setInWishlist(false);
      } else {
        await fetch(`${getApiUrl()}/api/wishlist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, itemId: id, itemType }),
        });
        setInWishlist(true);
      }
    } finally {
      setWishlistLoading(false);
    }
  };

  const submitReport = async () => {
    if (!listing || !address) {
      setReportMessage("Connect your wallet before reporting.");
      return;
    }
    if (address.toLowerCase() === listing.seller.toLowerCase()) {
      setReportMessage("You cannot report your own listing.");
      return;
    }
    setReportSubmitting(true);
    setReportMessage(null);
    try {
      const res = await fetch(
        `${getApiUrl()}/api/listing/${encodeURIComponent(listing.id)}/report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reporterAddress: address.toLowerCase(),
            reason: reportReason,
            details: reportDetails.trim(),
          }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Could not send report.");
      }
      setReportMessage("Report submitted. Our moderation team has been notified.");
      setReportDetails("");
      setTimeout(() => setReportOpen(false), 1200);
    } catch (e) {
      setReportMessage(e instanceof Error ? e.message : "Could not send report.");
    } finally {
      setReportSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen slide-in-right">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <p className="text-silver">Loading…</p>
        </div>
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="min-h-screen slide-in-right">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <p className="text-silver">Listing not found.</p>
          <Link
            href="/marketplace"
            className="text-chrome hover:text-white underline mt-2 inline-block"
          >
            Back to marketplace
          </Link>
        </div>
      </main>
    );
  }

  const displayId = formatListingId(id);
  const displayTitle = listing?.title || displayId || "Untitled";
  const walletAddressCandidates = [
    address?.toLowerCase(),
    accountId ? accountIdToLongZeroAddress(accountId).toLowerCase() : null,
  ].filter((v): v is string => !!v);
  const isSeller = !!item?.seller && walletAddressCandidates.includes(item.seller.toLowerCase());
  const onChainStatusNum = Number(onChainListing?.status ?? -1);
  const isListedOnChain = onChainStatusNum === -1 ? null : onChainStatusNum === 1; // 0 = not created on-chain, only 1 = active
  const isListed =
    listing?.status === "LISTED" && (isListedOnChain == null ? true : isListedOnChain);
  const isUnconfirmed =
    listing?.status === "LISTED" &&
    onChainListing !== undefined &&
    Number(onChainListing.status) === 0;
  const isSellerActiveListing = listing?.status === "LISTED";
  const isLockedOnChain = onChainStatusNum === 2;

  const existingMediaUrls = item
    ? item.mediaUrls?.length
      ? item.mediaUrls
      : item.imageUrl
        ? [item.imageUrl]
        : []
    : [];
  const keptMediaUrls = existingMediaUrls.filter((u) => !editRemovedMediaUrls.includes(u));
  const safeMediaIndex =
    keptMediaUrls.length > 0 ? Math.min(selectedMediaIndex, keptMediaUrls.length - 1) : 0;
  const removeExistingMedia = (url: string) => {
    const idx = keptMediaUrls.indexOf(url);
    setEditRemovedMediaUrls((prev) => [...prev, url]);
    if (idx >= 0 && idx <= selectedMediaIndex && selectedMediaIndex > 0)
      setSelectedMediaIndex(selectedMediaIndex - 1);
    else if (idx === selectedMediaIndex && keptMediaUrls.length > 1)
      setSelectedMediaIndex(Math.min(selectedMediaIndex, keptMediaUrls.length - 2));
  };

  const displaySubtitle = listing?.subtitle || "";
  const displayCondition = listing?.condition || "";
  const displayYear = listing?.yearOfProduction || "";
  const attributesLine = [displayCondition, displayYear].filter(Boolean).join(" | ");

  const doSaveEditListing = async () => {
    if (!address || !listing) return;
    setEditError(null);
    setEditSaving(true);
    let priceUpdateFailed = false;
    let priceUpdateError: string | null = null;
    let priceUpdateTxHash: string | null = null;
    let priceSyncFailed = false;
    const currentPriceDisplay = formatPriceForDisplay(listing.price);
    const newPriceDisplay = editPrice.trim();
    const priceChanged =
      newPriceDisplay &&
      !Number.isNaN(Number(newPriceDisplay)) &&
      Number(newPriceDisplay) >= 0 &&
      newPriceDisplay !== currentPriceDisplay;
    try {
      if (priceChanged) {
        try {
          priceUpdateTxHash = await updatePriceOnChain(listing.id, newPriceDisplay);
          const syncRes = await fetch(`${getApiUrl()}/api/sync-price-update`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              txHash: priceUpdateTxHash,
              listingId: listing.id,
              newPrice: newPriceDisplay,
            }),
          }).catch(() => null);
          if (!syncRes?.ok) {
            priceSyncFailed = true;
          }
        } catch (e) {
          priceUpdateFailed = true;
          priceUpdateError = getTransactionErrorMessage(e, { chainId });
        }
      }
      const existingUrls = listing.mediaUrls?.length
        ? listing.mediaUrls
        : listing.imageUrl
          ? [listing.imageUrl]
          : [];
      const keptUrls = existingUrls.filter((u) => !editRemovedMediaUrls.includes(u));
      let newUrls: string[] = [];
      if (editImageFiles.length > 0) {
        for (const file of editImageFiles) {
          const compressed = await compressImage(file);
          if (compressed.size > MAX_IMAGE_SIZE) {
            setEditError(
              "One or more images are still too large after compression. Try smaller images.",
            );
            setEditSaving(false);
            return;
          }
          const form = new FormData();
          form.append("image", compressed);
          const up = await fetch(`${getApiUrl()}/api/upload-listing-image`, {
            method: "POST",
            body: form,
          });
          if (!up.ok) {
            const d = await up.json().catch(() => ({}));
            throw new Error(d.error || "Image upload failed");
          }
          const data = await up.json();
          if (data.imageUrl) newUrls.push(data.imageUrl);
        }
      }
      const mediaUrls =
        keptUrls.length > 0 || newUrls.length > 0 ? [...keptUrls, ...newUrls] : undefined;
      const body: Record<string, unknown> = {
        // Use canonical DB seller value to avoid alias/long-zero mismatch on backend ownership check.
        sellerAddress: listing.seller || address,
        title: editTitle.trim() || undefined,
        subtitle: editSubtitle.trim() || undefined,
        description: editDescription.trim() || undefined,
        condition: editCondition.trim() || undefined,
        yearOfProduction: editYearOfProduction.trim() || undefined,
        ...(mediaUrls !== undefined && { mediaUrls }),
      };
      // Price is now synced only from on-chain events/tx sync endpoint to avoid DB-on-chain divergence.
      const res = await fetch(`${getApiUrl()}/api/listing/${encodeURIComponent(listing.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Update failed");
      }
      const updated = await res.json();
      setListing(updated.listing);
      if (priceUpdateTxHash) {
        // Refresh in background so the UI reflects synced/on-chain price quickly.
        fetchListing(0, false);
      }
      if (!priceUpdateFailed) {
        setEditing(false);
        setEditImageFiles([]);
        setEditRemovedMediaUrls([]);
        setEditError(null);
      } else {
        setEditError(
          "Price update was not confirmed in HashPack. Please approve the wallet request and save again.",
        );
      }
      if (priceUpdateFailed && priceUpdateError) {
        const bannerMsg =
          `Details saved, but price was not updated because the wallet confirmation did not complete. ` +
          `Your listing remains at ${currentPriceDisplay} HBAR until you retry and approve in HashPack. ` +
          priceUpdateError;
        setPriceUpdateFailedBanner(bannerMsg);
        setTimeout(() => setPriceUpdateFailedBanner(null), 15000);
      } else if (priceSyncFailed) {
        setPriceUpdateFailedBanner(
          "Price update was confirmed on-chain, but syncing the latest value to the app is delayed. Refresh in a moment if the new price is not visible yet.",
        );
        setTimeout(() => setPriceUpdateFailedBanner(null), 10000);
      }
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setEditSaving(false);
    }
  };

  const handleSaveEditListing = () => {
    if (!address || !listing) return;
    // Simplified flow: trigger HashPack directly from Save to reduce request expiry.
    void doSaveEditListing();
  };

  const handleSaveEdit = handleSaveEditListing;

  const mainImageUrl = keptMediaUrls[safeMediaIndex] ?? null;
  const categoryLabel = listing?.category || "Marketplace";

  const showPrevMedia = () => {
    if (keptMediaUrls.length <= 1) return;
    setSelectedMediaIndex((prev) => (prev - 1 + keptMediaUrls.length) % keptMediaUrls.length);
  };

  const showNextMedia = () => {
    if (keptMediaUrls.length <= 1) return;
    setSelectedMediaIndex((prev) => (prev + 1) % keptMediaUrls.length);
  };

  return (
    <main className="min-h-screen slide-in-right overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 relative overflow-x-hidden">
        {cancelSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity duration-300 p-4">
            <div className="glass-card p-8 max-w-sm w-full text-center space-y-5">
              <div className="w-14 h-14 mx-auto rounded-full border-2 border-rose-400/80 flex items-center justify-center">
                <svg className="w-7 h-7 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold text-white">Listing deleted</p>
                <p className="text-sm text-silver">The listing has been cancelled on-chain and removed.</p>
              </div>
              {cancelTxHash && (
                <a
                  href={`https://hashscan.io/mainnet/transaction/${cancelTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-rose-300/80 hover:text-white underline block"
                >
                  View transaction on HashScan
                </a>
              )}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Link href="/dashboard" className="btn-frost-cta flex-1 text-center">
                  Go to Dashboard
                </Link>
                <Link href="/create" className="btn-frost flex-1 text-center border-white/20">
                  New Listing
                </Link>
              </div>
            </div>
          </div>
        )}

        {reportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-card p-6 w-full max-w-md space-y-4">
              <h2 className="text-lg font-semibold text-white">Report listing</h2>
              <p className="text-sm text-silver">
                This report is sent to the moderation team on Discord.
              </p>
              <label className="block">
                <span className="text-xs text-silver">Reason</span>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="input-frost mt-1 w-full"
                >
                  <option value="scam">Scam / fraud</option>
                  <option value="counterfeit">Counterfeit item</option>
                  <option value="prohibited">Prohibited item</option>
                  <option value="abuse">Abusive content</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-silver">Details (optional)</span>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  className="input-frost mt-1 w-full min-h-[90px] resize-y"
                  maxLength={1000}
                  placeholder="Add any useful context for moderators."
                />
              </label>
              {reportMessage && (
                <p
                  className={`text-sm ${reportMessage.toLowerCase().includes("submitted") ? "text-emerald-300" : "text-rose-300"}`}
                >
                  {reportMessage}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (reportSubmitting) return;
                    setReportOpen(false);
                    setReportMessage(null);
                  }}
                  className="btn-frost flex-1 border-white/20"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void submitReport();
                  }}
                  disabled={reportSubmitting || !walletConnected}
                  className="btn-frost-cta flex-1 disabled:opacity-60"
                >
                  {reportSubmitting ? "Sending…" : "Send report"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirmation modal */}
        {deleteConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-card p-6 w-full max-w-sm space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full border border-rose-500/40 bg-rose-500/10 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Delete listing?</h2>
                  <p className="text-sm text-silver mt-1">
                    {listing?.onChainConfirmed
                      ? "This will cancel the listing on-chain and remove it permanently. You'll need to approve the transaction in your wallet."
                      : "This listing was never confirmed on-chain and will be removed directly — no wallet approval needed."}
                  </p>
                </div>
              </div>
              {(deleteError || cancelHookError) && (
                <p className="text-sm text-rose-300 border border-rose-500/30 bg-rose-500/5 px-3 py-2">
                  {cancelHookError?.message || deleteError}
                </p>
              )}
              {canForceCancel && (
                <p className="text-xs text-silver/70 border border-white/10 bg-white/5 px-3 py-2">
                  The on-chain transaction did not go through. You can try again or remove the listing from your account without a blockchain transaction.
                </p>
              )}
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmOpen(false);
                    setDeleteError(null);
                    setCanForceCancel(false);
                  }}
                  disabled={cancelPending || forceDeleting}
                  className="btn-frost flex-1 border-white/20 disabled:opacity-50"
                >
                  Cancel
                </button>
                {canForceCancel ? (
                  <>
                    <button
                      type="button"
                      onClick={() => { setCanForceCancel(false); setDeleteError(null); }}
                      disabled={forceDeleting}
                      className="flex-1 rounded-glass border border-white/20 bg-white/5 px-4 py-2 font-semibold text-silver transition-all hover:bg-white/10 disabled:opacity-50"
                    >
                      Try again
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!listing || forceDeleting) return;
                        setDeleteError(null);
                        setForceDeleting(true);
                        try {
                          const res = await fetch(
                            `${getApiUrl()}/api/listing/${encodeURIComponent(listing.id)}/cancel-offchain`,
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ address, force: true }),
                            },
                          );
                          if (!res.ok) throw new Error((await res.json()).error || "Failed");
                          setDeleteConfirmOpen(false);
                          setCanForceCancel(false);
                          router.push("/selling");
                        } catch (err) {
                          setDeleteError(err instanceof Error ? err.message : "Force cancel failed.");
                        } finally {
                          setForceDeleting(false);
                        }
                      }}
                      disabled={forceDeleting}
                      className="flex-1 rounded-glass border border-rose-500/50 bg-rose-500/10 px-4 py-2 font-semibold text-rose-300 transition-all duration-200 hover:bg-rose-500/20 hover:border-rose-400/70 disabled:opacity-50"
                    >
                      {forceDeleting ? "Removing…" : "Remove from account"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      setDeleteError(null);
                      if (!listing?.onChainConfirmed) {
                        try {
                          const res = await fetch(
                            `${getApiUrl()}/api/listing/${encodeURIComponent(listing!.id)}/cancel-offchain`,
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ address }),
                            },
                          );
                          if (!res.ok) throw new Error((await res.json()).error || "Failed");
                          setDeleteConfirmOpen(false);
                          router.push("/selling");
                        } catch (err) {
                          setDeleteError(err instanceof Error ? err.message : "Delete failed.");
                        }
                        return;
                      }
                      const ok = await cancel(listing!.id);
                      if (ok) {
                        setDeleteConfirmOpen(false);
                      } else {
                        setDeleteError("Transaction failed or was rejected.");
                        setCanForceCancel(true);
                      }
                    }}
                    disabled={cancelPending || forceDeleting}
                    className="flex-1 rounded-glass border border-rose-500/50 bg-rose-500/10 px-4 py-2 font-semibold text-rose-300 transition-all duration-200 hover:bg-rose-500/20 hover:border-rose-400/70 disabled:opacity-50"
                  >
                    {cancelPending ? "Confirm in wallet…" : "Delete listing"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {galleryOpen && mainImageUrl && (
          <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md p-4 sm:p-6">
            <div className="mx-auto flex h-full w-full max-w-6xl flex-col rounded-[2px] border border-white/10 bg-[#07152a]/95 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <p className="truncate text-sm text-silver">
                  Media {safeMediaIndex + 1} of {keptMediaUrls.length}
                </p>
                <button
                  type="button"
                  onClick={() => setGalleryOpen(false)}
                  className="rounded-[2px] border border-white/20 px-3 py-1 text-xs font-medium text-silver hover:text-white hover:bg-white/10"
                >
                  Close
                </button>
              </div>
              <div className="relative min-h-0 flex-1 p-3 sm:p-4">
                {isVideoMedia(mainImageUrl) ? (
                  <video
                    src={mainImageUrl}
                    className="h-full w-full object-contain"
                    controls
                    playsInline
                    autoPlay
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mainImageUrl}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                )}
                {keptMediaUrls.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={showPrevMedia}
                      className="absolute left-5 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/45 px-3 py-2 text-white hover:bg-black/70"
                      aria-label="Previous media"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={showNextMedia}
                      className="absolute right-5 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/45 px-3 py-2 text-white hover:bg-black/70"
                      aria-label="Next media"
                    >
                      ›
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {priceUpdateFailedBanner && (
          <div className="mb-4 rounded-[2px] border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {priceUpdateFailedBanner}
          </div>
        )}

        {isSeller &&
          priceMismatch &&
          apiPriceHbar &&
          onChainPriceHbar &&
          Number(apiPriceHbar) < Number(onChainPriceHbar) && (
            <div className="mb-4 rounded-[2px] border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              <strong>Complete the price update:</strong> Your listing is set to {apiPriceHbar} HBAR
              but buyers still see {onChainPriceHbar} HBAR. Click &quot;Configure&quot;, set the
              price to {apiPriceHbar} HBAR, then &quot;Save&quot; and{" "}
              <strong>approve the transaction in HashPack</strong> when the modal appears to update
              the price on chain.
            </div>
          )}

        {/* Title row — left column only, right side intentionally empty so image aligns with panel top */}
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-x-8 mb-4">
          <div>
            <nav className="flex items-center gap-1 text-sm text-silver flex-wrap mb-3">
              <Link href="/marketplace" className="hover:text-white">
                Marketplace
              </Link>
              {categoryLabel && categoryLabel !== "Marketplace" && (
                <>
                  <span>{">"}</span>
                  <span className="text-white">{categoryLabel}</span>
                </>
              )}
            </nav>
            <div className="flex items-start gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-white flex-1 min-w-0">
                {editing ? editTitle || displayTitle : displayTitle}
              </h1>
              {!isListed && !isUnconfirmed && (
                <span className="px-2 py-0.5 text-xs font-medium bg-white/10 text-silver border border-white/10 mt-1 flex-shrink-0">
                  Archived
                </span>
              )}
            </div>
            {displaySubtitle && (
              <p className="text-silver text-sm mt-1">
                {editing ? editSubtitle : displaySubtitle}
              </p>
            )}
            {attributesLine && (
              <p className="text-silver/70 text-sm mt-0.5">
                {editing
                  ? [editCondition, editYearOfProduction].filter(Boolean).join(" | ")
                  : attributesLine}
              </p>
            )}
          </div>
          {/* right side empty — right panel starts at image level below */}
        </div>

        {/* Content grid — image left, action panels right */}
        <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
          {/* Left: media gallery */}
          <div className="min-w-0 space-y-4">
            <div className="relative aspect-[4/3] max-h-[62vh] overflow-hidden rounded-glass-lg border border-white/10 bg-black">
              {mainImageUrl ? (
                <>
                  {isVideoMedia(mainImageUrl) ? (
                    <video
                      src={mainImageUrl}
                      className="h-full w-full object-contain"
                      controls
                      playsInline
                      muted
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mainImageUrl} alt="" className="h-full w-full object-contain" />
                  )}
                  <div className="absolute top-3 right-3 flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleWishlist();
                      }}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${inWishlist ? "bg-emerald-600/90" : "bg-black/60 hover:bg-black/80"}`}
                      aria-label={inWishlist ? "In wishlist" : "Add to wishlist"}
                      disabled={wishlistLoading}
                    >
                      {inWishlist ? "✓" : "♡"}
                    </button>
                    <button
                      type="button"
                      className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white"
                      aria-label="Share"
                    >
                      ⎘
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGalleryOpen(true)}
                    className="absolute inset-0 z-10 cursor-zoom-in"
                    aria-label="Open media gallery"
                  />
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-silver">
                  No image
                </div>
              )}
            </div>
            {keptMediaUrls.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {keptMediaUrls.map((url, i) => (
                  <div
                    key={url}
                    role={editing ? undefined : "button"}
                    tabIndex={editing ? undefined : 0}
                    onClick={() => !editing && setSelectedMediaIndex(i)}
                    onKeyDown={(e) =>
                      !editing && (e.key === "Enter" || e.key === " ") && setSelectedMediaIndex(i)
                    }
                    className={`relative flex-shrink-0 w-20 h-20 rounded-[2px] overflow-hidden border-2 transition-colors cursor-pointer ${i === safeMediaIndex ? "border-chrome" : "border-white/20 hover:border-white/40"}`}
                  >
                    {isVideoMedia(url) ? (
                      <video
                        src={url}
                        className="w-full h-full object-contain bg-black"
                        muted
                        playsInline
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" className="w-full h-full object-contain bg-black" />
                    )}
                    {editing && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeExistingMedia(url);
                        }}
                        className="absolute top-0 right-0 w-6 h-6 flex items-center justify-center bg-black/70 text-white text-sm rounded-bl-lg hover:bg-rose-500"
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-silver">
              <span>Want to sell a similar item?</span>
              <Link
                href="/create"
                className="text-chrome hover:text-white underline inline-flex items-center gap-1"
              >
                Create a listing now
              </Link>
              {!isSeller && (
                <>
                  <span className="text-white/40">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setReportOpen(true);
                      setReportMessage(null);
                    }}
                    className="text-silver hover:text-rose-300 underline"
                  >
                    Report listing
                  </button>
                </>
              )}
            </div>
            {/* Description — shown inline under image gallery when not editing */}
            {listing?.description && !editing && (
              <div className="border border-[#4a5e83]/40 bg-gradient-to-b from-[#121a29]/80 to-[#0f1522]/80 p-5">
                <h3 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-3">Description</h3>
                <p className="text-silver text-sm whitespace-pre-wrap leading-relaxed">{listing.description}</p>
              </div>
            )}
            {isSeller && isSellerActiveListing && editing && (
              <div className="glass-card p-4 space-y-3">
                <h3 className="text-white font-medium">Configure</h3>
                <label className="block">
                  <span className="text-xs text-silver">Title</span>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="input-frost mt-1 w-full text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-silver">Subtitle</span>
                  <input
                    value={editSubtitle}
                    onChange={(e) => setEditSubtitle(e.target.value)}
                    className="input-frost mt-1 w-full text-sm"
                    placeholder="Short description"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-silver">Description</span>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="input-frost mt-1 w-full text-sm min-h-[80px] resize-y"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-silver">Condition</span>
                  <input
                    value={editCondition}
                    onChange={(e) => setEditCondition(e.target.value)}
                    className="input-frost mt-1 w-full text-sm"
                    placeholder="e.g. Like new"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-silver">Year of production</span>
                  <input
                    value={editYearOfProduction}
                    onChange={(e) => setEditYearOfProduction(e.target.value)}
                    className="input-frost mt-1 w-full text-sm"
                    placeholder="e.g. 2023"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-silver">Price (HBAR)</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="input-frost mt-1 w-full text-sm"
                  />
                </label>
                {keptMediaUrls.length > 0 && (
                  <div className="block">
                    <span className="text-xs text-silver">Current media (× to remove)</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {keptMediaUrls.map((url) => (
                        <div
                          key={url}
                          className="relative w-16 h-16 rounded-[2px] overflow-hidden border border-white/10 flex-shrink-0"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="object-cover w-full h-full" />
                          <button
                            type="button"
                            onClick={() => removeExistingMedia(url)}
                            className="absolute top-0 right-0 w-6 h-6 flex items-center justify-center bg-black/70 text-white text-sm rounded-bl-lg hover:bg-rose-500"
                            aria-label="Remove"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <label className="block">
                  <span className="text-xs text-silver">Add photos (optional), max 2MB each</span>
                  <input
                    type="file"
                    accept={ALLOWED_TYPES}
                    multiple
                    onChange={(e) => setEditImageFiles(Array.from(e.target.files ?? []))}
                    className="input-frost mt-1 w-full text-silver text-sm file:text-xs"
                  />
                  {editImageFiles.length > 0 && (
                    <p className="text-silver text-xs mt-1">
                      {editImageFiles.length} photo(s) selected
                    </p>
                  )}
                </label>
                {editError && <p className="text-rose-400 text-xs">{editError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={editSaving}
                    className="btn-frost-cta flex-1 disabled:opacity-60"
                  >
                    {editSaving ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setEditError(null);
                      setEditImageFiles([]);
                      setEditRemovedMediaUrls([]);
                    }}
                    className="btn-frost-cta border-white/20"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: price + buy/escrow panel */}
          <div className="min-w-0 space-y-4">
            {listing && priceMismatch && onChainPriceHbar && (
              <p className="text-sm text-amber-300/90 mt-1">
                Listing price: <strong>{formatPriceForDisplay(listing.price)} HBAR</strong>.
                You&apos;ll pay <strong>{onChainPriceHbar} HBAR</strong> until the seller approves
                the price update in their wallet.
              </p>
            )}

            {listing &&
              (listing.status === "LOCKED" ||
                isLockedOnChain ||
                (!isListed && !!listing.requireEscrow)) && (
                <EscrowPanel
                  listingId={listing.id}
                  sellerAddress={listing.seller}
                  requireEscrow={!!listing.requireEscrow}
                  trackingNumber={listing.trackingNumber ?? null}
                  trackingCarrier={listing.trackingCarrier ?? null}
                  onEscrowUpdated={() => fetchListing(0, false)}
                />
              )}
            {listing &&
              isListed &&
              !isSeller &&
              (walletConnected ? (
                <BuyButton
                  listingId={listing.id}
                  price={listing.price}
                  inWishlist={inWishlist}
                  onToggleWishlist={() => {
                    void toggleWishlist();
                  }}
                  wishlistDisabled={!address || wishlistLoading}
                  onPurchaseComplete={(txHash) => {
                    router.push(
                      `/purchase-success/${encodeURIComponent(id)}${txHash ? `?tx=${encodeURIComponent(txHash)}` : ""}`,
                    );
                  }}
                  onMessage={async () => {
                    if (!walletConnected || !address || !item?.seller) return;
                    try {
                      await fetch(`${getApiUrl()}/api/messages`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          fromAddress: address,
                          toAddress: item.seller,
                          body: "Hi, I'm interested in this listing.",
                          listingId: id,
                        }),
                      });
                    } catch {}
                    router.push(
                      `/messages?openThread=${encodeURIComponent(item.seller)}&listingId=${encodeURIComponent(id)}`,
                    );
                  }}
                  onMakeOffer={() => {
                    if (!walletConnected || !address || !item?.seller) return;
                    router.push(
                      `/messages?openThread=${encodeURIComponent(item.seller)}&listingId=${encodeURIComponent(id)}&showOffer=1`,
                    );
                  }}
                />
              ) : (
                <div className="glass-card p-4 rounded-[2px] border border-white/10">
                  <p className="text-silver text-sm mb-3">
                    Connect your wallet to buy this listing.
                  </p>
                  <ConnectWalletButton className="btn-frost-cta w-full disabled:opacity-50" />
                </div>
              ))}
            {listing &&
              listing.status === "SOLD" &&
              !listing.requireEscrow &&
              listing.buyer &&
              address &&
              listing.buyer.toLowerCase() === address.toLowerCase() && (
                <div className="glass-card p-4 rounded-[2px] border border-emerald-500/30 bg-emerald-500/5">
                  <h3 className="text-lg font-semibold text-emerald-300 mb-2">Purchase Complete</h3>
                  <p className="text-sm text-silver">
                    You bought this item. Payment of{" "}
                    <span className="text-chrome">
                      {formatHbarWithUsd(formatPriceForDisplay(listing.price), usdRate)}
                    </span>{" "}
                    has been sent to the seller.
                  </p>
                  <p className="text-xs text-silver mt-2">
                    Seller: <AddressDisplay address={listing.seller} className="text-chrome" />
                  </p>
                </div>
              )}
            {listing &&
              !isListed &&
              !isUnconfirmed &&
              !isSeller &&
              !(
                listing.status === "SOLD" &&
                !listing.requireEscrow &&
                listing.buyer &&
                address &&
                listing.buyer.toLowerCase() === address.toLowerCase()
              ) &&
              !(listing.status === "LOCKED" || isLockedOnChain) && (
                <div className="glass-card p-4 rounded-[2px] border border-white/10">
                  <p className="text-silver text-sm">
                    This listing is no longer available for purchase.
                  </p>
                </div>
              )}
            {listing && (isListed || isUnconfirmed) && isSeller && (
              <div className="glass-card p-4 rounded-[2px] border border-white/10 space-y-3">
                <div>
                  <p className="text-xs text-silver uppercase tracking-wider mb-1">
                    Your listing price
                  </p>
                  <p className="text-xl font-bold text-white">
                    {formatHbarWithUsd(
                      apiPriceHbar ?? formatPriceForDisplay(listing.price || "0"),
                      usdRate,
                    )}
                  </p>
                </div>
                <p className="text-silver text-sm">You cannot buy your own listing.</p>
              </div>
            )}
            {listing &&
              onChainListing !== undefined &&
              Number(onChainListing.status) === 0 &&
              listing.status === "LISTED" && (
                <div className="rounded-[2px] border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
                  <p className="text-sm font-medium text-amber-200">Not confirmed on-chain</p>
                  <p className="text-xs text-silver">
                    This listing does not exist on the smart contract yet. The creation transaction
                    may not have completed successfully.
                  </p>
                  {isSeller && (
                    <p className="text-xs text-silver">
                      Try deleting this listing and creating a new one. Make sure to approve the
                      transaction in your wallet.
                    </p>
                  )}
                </div>
              )}

            <div className="glass-card p-4 rounded-[2px] border border-white/10">
              <h3 className="text-white font-medium mb-2">Listing info</h3>
              <div className="text-sm text-silver space-y-1.5">
                {listing?.createdAt && (
                  <p className="inline-flex items-center gap-1.5 text-xs text-silver/80">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    {formatListingDate(listing.createdAt)}
                  </p>
                )}
                {listing?.location && (
                  <p className="inline-flex items-center gap-1.5 text-xs text-silver/80">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {listing.location}
                  </p>
                )}
                {listing?.txHash && (() => {
                  const url = getTransactionExplorerUrl(listing.txHash, chainId);
                  return url ? (
                    <p>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-chrome hover:text-white underline"
                      >
                        View on HashScan
                      </a>
                    </p>
                  ) : null;
                })()}
              </div>
            </div>

            <div className="glass-card p-4 rounded-[2px] border border-white/10">
              <h3 className="text-white font-medium mb-2">Security</h3>
              <ul className="text-sm text-silver space-y-1">
                <li className="flex items-center gap-2">✓ Payment via escrow</li>
                {isUnconfirmed ? (
                  <li className="flex items-center gap-2 text-amber-300/80">
                    ✗ Ownership not yet confirmed on-chain
                  </li>
                ) : (
                  <li className="flex items-center gap-2">✓ Ownership confirmed on-chain</li>
                )}
                <li className="flex items-center gap-2 text-rose-300/80">
                  ✗ No legal obligation to accept returns for private sales
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-white font-medium mb-2">Seller</h3>
              <p className="text-silver text-sm flex items-center gap-2">
                <AddressDisplay address={item!.seller} className="text-chrome font-mono text-xs" showAvatar />
              </p>
              {isSeller && isSellerActiveListing && !isLockedOnChain && !editing && (
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="btn-frost flex-1"
                  >
                    Configure
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteConfirmOpen(true);
                    }}
                    disabled={cancelPending}
                    className="flex-1 rounded-glass border border-rose-500/50 bg-rose-500/10 px-4 py-2 font-semibold text-rose-300 transition-all duration-200 hover:bg-rose-500/20 hover:border-rose-400/70 disabled:opacity-50"
                  >
                    {cancelPending ? "Confirm in wallet…" : "Delete"}
                  </button>
                </div>
              )}
              {isSeller && (isLockedOnChain || listing.status === "LOCKED") && (
                <div className="mt-2 border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                  <p className="text-xs text-amber-300/90">
                    This listing is in escrow — it cannot be deleted until the transaction is
                    complete or resolved.
                  </p>
                </div>
              )}
              {isSeller &&
                (walletConnected ? (
                  <Link
                    href={`/create?duplicate=${encodeURIComponent(id)}`}
                    className="btn-frost-cta w-full mt-2 inline-block text-center border-white/20"
                  >
                    Duplicate listing
                  </Link>
                ) : (
                  <div className="rounded-[2px] border border-white/20 bg-white/5 px-4 py-3 text-center text-silver text-sm mt-2">
                    Connect wallet to duplicate
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Chat thread — shown when user is buyer or seller of a purchased listing */}
        {listing?.buyer &&
          address &&
          (listing.buyer.toLowerCase() === address.toLowerCase() || isSeller) && (
            <div className="mt-8 glass-card p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Messages</h2>
              {chatLoading ? (
                <p className="text-silver text-sm">Loading…</p>
              ) : chatMessages.length === 0 ? (
                <p className="text-silver text-sm">No messages yet. Start the conversation below.</p>
              ) : (
                <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
                  {chatMessages.map((msg) => {
                    const isMe = msg.fromAddress.toLowerCase() === address.toLowerCase();
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-xs lg:max-w-md rounded-[2px] px-3 py-2 text-sm ${
                            isMe
                              ? "bg-white/15 text-white"
                              : "bg-white/5 text-silver border border-white/10"
                          }`}
                        >
                          <p className="break-words">{msg.body}</p>
                          <p className="text-xs text-white/40 mt-1">
                            {new Date(msg.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-2 mt-4">
                <input
                  type="text"
                  value={chatReply}
                  onChange={(e) => setChatReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendChatReply();
                    }
                  }}
                  placeholder="Type a message…"
                  className="flex-1 bg-white/5 border border-white/20 rounded-[2px] px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00ffa3]/40"
                />
                <button
                  type="button"
                  onClick={() => void sendChatReply()}
                  disabled={chatSending || !chatReply.trim()}
                  className="px-4 py-2 bg-white/10 border border-white/20 text-white text-sm font-medium rounded-[2px] hover:bg-white/20 transition-colors disabled:opacity-40"
                >
                  {chatSending ? "…" : "Send"}
                </button>
              </div>
            </div>
          )}

        {/* Similar listings */}
        {similarListings.length > 0 && (
          <div className="mt-12">
            <h2 className="text-base font-semibold text-white/70 uppercase tracking-widest mb-4">
              Similar listings
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {similarListings.map((item) => {
                const thumb = item.mediaUrls?.[0] ?? item.imageUrl ?? null;
                return (
                  <Link
                    key={item.id}
                    href={`/listing/${encodeURIComponent(item.id)}`}
                    className="glass-card overflow-hidden group transition-all duration-200 hover:border-white/20 hover:shadow-glow"
                  >
                    <div className="aspect-square bg-black/40 overflow-hidden">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20 text-sm">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-white text-sm font-medium line-clamp-2 leading-tight">
                        {item.title || "Untitled"}
                      </p>
                      <p className="text-chrome text-sm font-semibold mt-1">
                        {item.price ? `${formatPriceForDisplay(item.price)} ℏ` : "—"}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
