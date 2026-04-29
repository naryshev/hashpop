"use client";

import { useEffect, useState } from "react";
import { getProfileImage } from "../lib/profileImageCache";

const sizeClass: Record<string, string> = {
  xs: "h-5 w-5 text-[9px]",
  sm: "h-7 w-7 text-[10px]",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-24 w-24 text-2xl",
};

export function UserAvatar({
  address,
  size = "md",
  className = "",
  withDot = false,
}: {
  address: string;
  size?: keyof typeof sizeClass;
  className?: string;
  withDot?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!address) return;
    setUrl(null);
    getProfileImage(address).then(setUrl).catch(() => {});
  }, [address]);

  const letter = address ? (address[2]?.toUpperCase() ?? "?") : "?";
  const cls = sizeClass[size] ?? sizeClass.md;

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.08] text-white/70 font-bold select-none ${cls} ${className}`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span>{letter}</span>
      )}
      {withDot && (
        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#00ffa3] border-2 border-[#0b111b]" />
      )}
    </div>
  );
}
