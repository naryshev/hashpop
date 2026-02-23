"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black/40 mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-6">
        <p className="text-xs text-silver/90 max-w-2xl mb-4">
          Hashpop is provided &quot;as is&quot; with no warranties. Listings are created by users; we do not endorse or
          guarantee any listing or transaction. Use of crypto and listings is at your own risk. This is not
          financial or legal advice. We do not guarantee security, uptime, or any particular outcome.
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <Link href="/terms" className="text-chrome hover:text-white">
            Terms of Service
          </Link>
          <Link href="/privacy" className="text-chrome hover:text-white">
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
