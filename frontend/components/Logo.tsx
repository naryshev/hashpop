"use client";

import Link from "next/link";
export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 text-xl font-bold text-white transition hover:text-chrome"
      aria-label="Hashpop home"
    >
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/5">
        <span className="absolute inset-0 rounded-lg bg-[linear-gradient(145deg,#ff2f3d_0%,#ff8f00_35%,#14a4ff_65%,#6ddf85_100%)] opacity-35" />
        <span className="relative text-base font-black text-white">H</span>
      </span>
      <span className="bg-[linear-gradient(100deg,#ff2f3d_0%,#ff8f00_30%,#14a4ff_60%,#6ddf85_100%)] bg-clip-text text-transparent">
        Hashpop
      </span>
    </Link>
  );
}
