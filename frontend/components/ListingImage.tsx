"use client";

type ListingImageProps = {
  className?: string;
  aspectRatio?: "square" | "video";
};

export function ListingImage({ className = "", aspectRatio = "square" }: ListingImageProps) {
  const ratioClass = aspectRatio === "video" ? "aspect-video" : "aspect-square";

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
