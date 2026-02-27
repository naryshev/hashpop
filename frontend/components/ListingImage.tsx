"use client";

import { useState } from "react";
import { resolveListingImageUrl } from "../lib/listingImageUrl";

type ListingImageProps = {
  className?: string;
  aspectRatio?: "square" | "video";
  imageUrl?: string | null;
};

export function ListingImage({ className = "", aspectRatio = "square", imageUrl }: ListingImageProps) {
  const [imgError, setImgError] = useState(false);
  const ratioClass = aspectRatio === "video" ? "aspect-video" : "aspect-square";
  const resolvedUrl = resolveListingImageUrl(imageUrl);

  if (resolvedUrl && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolvedUrl}
        alt="Listing"
        className={`rounded-glass-lg border border-white/10 object-cover w-full h-full ${ratioClass} ${className}`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-glass-lg border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-sm text-silver ${ratioClass} ${className}`}
      role="img"
      aria-label="Listing image placeholder"
    >
      <span className="text-sm font-medium">No image</span>
    </div>
  );
}
