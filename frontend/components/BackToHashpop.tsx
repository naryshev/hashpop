"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function BackToHashpop({ label = "My Hashpop", href = "/dashboard" }: { label?: string; href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm text-silver/60 hover:text-white transition-colors"
    >
      <ChevronLeft className="h-4 w-4" />
      {label}
    </Link>
  );
}
