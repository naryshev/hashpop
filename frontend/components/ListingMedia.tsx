"use client";

import { useState } from "react";
import { getListingMediaUrls } from "../lib/listingMedia";

/** Standard height for card media so all marketplace/home cards are the same size */
const CARD_MEDIA_HEIGHT = "260px";

type ListingMediaProps = {
  listing: { imageUrl?: string | null; mediaUrls?: string[] | null };
  className?: string;
  aspectRatio?: "square" | "video";
  /** If true, show all images in a horizontal scrollable strip; otherwise show first only */
  scrollable?: boolean;
  /** "arrows" = one image at a time with prev/next buttons; "scroll" = horizontal scrollbar */
  navigation?: "scroll" | "arrows";
  /** When true, use fixed height for consistent card size (e.g. marketplace cards) */
  cardSize?: boolean;
  /** Override height when cardSize (e.g. "88px" for compact carousel) */
  compactHeight?: string;
};

export function ListingMedia({
  listing,
  className = "",
  aspectRatio = "video",
  scrollable = false,
  navigation = "scroll",
  cardSize = false,
  compactHeight,
}: ListingMediaProps) {
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const [index, setIndex] = useState(0);
  const urls = getListingMediaUrls(listing);
  const ratioClass = aspectRatio === "video" ? "aspect-video" : "aspect-square";
  const useArrows = navigation === "arrows" && urls.length > 1;
  const mediaHeight = compactHeight ?? CARD_MEDIA_HEIGHT;
  const sizeClass = cardSize ? "w-full min-h-0 shrink-0" : "";

  const heightStyle = cardSize ? { height: mediaHeight } : undefined;

  if (urls.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-glass-lg border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-sm text-silver ${cardSize ? "" : ratioClass} ${sizeClass} ${className}`}
        style={heightStyle}
        role="img"
        aria-label="No media"
      >
        <span className="text-sm font-medium">No image</span>
      </div>
    );
  }

  if (urls.length === 1 && !scrollable && !useArrows) {
    if (failed.has(0)) {
      return (
        <div
          className={`flex items-center justify-center rounded-glass-lg border border-white/10 bg-white/5 text-silver ${cardSize ? "" : ratioClass} ${sizeClass} ${className}`}
          style={heightStyle}
        >
          <span className="text-sm">No image</span>
        </div>
      );
    }
    const imgEl = (
      <img
        src={urls[0]}
        alt="Listing"
        className={`rounded-glass-lg border border-white/10 object-cover w-full h-full min-h-0 ${!cardSize ? ratioClass : ""} ${!cardSize ? className : ""}`}
        onError={() => setFailed(new Set([0]))}
      />
    );
    if (cardSize) {
      return (
        <div className={`rounded-glass-lg border border-white/10 overflow-hidden ${sizeClass} ${className}`} style={{ height: mediaHeight }}>
          {imgEl}
        </div>
      );
    }
    return imgEl;
  }

  if (useArrows) {
    const safeIndex = index % urls.length;
    const currentUrl = urls[safeIndex];
    return (
      <div
        className={`rounded-glass-lg border border-white/10 overflow-hidden relative ${cardSize ? "" : ratioClass} ${sizeClass} ${className}`}
        style={heightStyle}
      >
        {failed.has(safeIndex) ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/5 text-silver">
            <span className="text-sm">Failed to load</span>
          </div>
        ) : (
          <img
            src={currentUrl}
            alt={`Listing ${safeIndex + 1}`}
            className="w-full h-full object-cover min-h-0"
            onError={() => setFailed((prev) => new Set([...prev, safeIndex]))}
          />
        )}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIndex((i) => (i - 1 + urls.length) % urls.length); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center text-lg font-medium"
          aria-label="Previous"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIndex((i) => (i + 1) % urls.length); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center text-lg font-medium"
          aria-label="Next"
        >
          ›
        </button>
      </div>
    );
  }

  return (
    <div
      className={`rounded-glass-lg border border-white/10 overflow-hidden ${cardSize ? sizeClass : ""} ${className}`}
      style={heightStyle}
    >
      <div className="flex gap-2 overflow-x-auto p-2 scroll-smooth h-full" style={{ scrollbarGutter: "stable" }}>
        {urls.map((url, i) =>
          failed.has(i) ? (
            <div
              key={i}
              className={`flex-shrink-0 flex items-center justify-center bg-white/5 rounded-lg ${ratioClass}`}
              style={{ minWidth: 280, maxHeight: cardSize ? 240 : undefined }}
            >
              <span className="text-silver text-sm">Failed to load</span>
            </div>
          ) : (
            <img
              key={i}
              src={url}
              alt={`Listing ${i + 1}`}
              className={`flex-shrink-0 object-cover rounded-lg ${ratioClass}`}
              style={{ minWidth: 280, maxHeight: 240 }}
              onError={() => setFailed((prev) => new Set([...prev, i]))}
            />
          )
        )}
      </div>
    </div>
  );
}
