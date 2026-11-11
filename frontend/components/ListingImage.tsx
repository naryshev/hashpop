"use client";

import Image from "next/image";

/**
 * Hosts the image optimizer is allowed to fetch. Anything else stays a plain
 * img so an unexpected CDN cannot crash the page.
 */
const OPTIMIZED_HOST = /(?:^|\.)r2\.dev$|^cdn\.hashpop\.io$|^localhost$|^127\.0\.0\.1$/;

export function isOptimizableListingSrc(src: string): boolean {
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  try {
    return OPTIMIZED_HOST.test(new URL(src).hostname);
  } catch {
    return false;
  }
}

/**
 * Listing photo. `fill` expects a positioned parent (the card media box or
 * the listing hero). `priority` is only for the single LCP image.
 */
export function ListingImage({
  src,
  alt,
  priority = false,
  sizes,
  className = "object-cover",
  onError,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  sizes: string;
  className?: string;
  onError?: () => void;
}) {
  if (!isOptimizableListingSrc(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={`absolute inset-0 h-full w-full ${className}`}
        fetchPriority={priority ? "high" : "auto"}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onError={onError}
      />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes}
      className={className}
      onError={onError}
    />
  );
}
