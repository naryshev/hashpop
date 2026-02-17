"use client";

import Link from "next/link";
import { useState } from "react";

/** Logo: use public/logo.png (shopping bag image) or SVG fallback. */
export function Logo() {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 text-xl font-bold text-white transition hover:text-chrome"
      aria-label="hbay home"
    >
      {!imgFailed ? (
        <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt=""
            width={36}
            height={36}
            className="h-full w-full object-contain"
            onError={() => setImgFailed(true)}
          />
        </span>
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-chrome">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
            <path d="M8 10h8v9a2 2 0 01-2 2h-4a2 2 0 01-2-2v-9z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 10V7a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      )}
      <span>hbay</span>
    </Link>
  );
}
