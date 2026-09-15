"use client";

import { useRouter } from "next/navigation";
import { Sheet } from "./ui/Sheet";
import { listingCta, material } from "../lib/materials";
import { listingHref } from "../lib/listingUrl";
import {
  LOCK_ESCROW_CTA,
  LOCK_ESCROW_SECONDARY,
  LOCK_ESCROW_SHEET_BODY,
  LOCK_ESCROW_SHEET_TITLE,
} from "../lib/dealRoom";
import { cn } from "../lib/utils";

export function LockEscrowSheet({
  open,
  listingId,
  onClose,
}: {
  open: boolean;
  listingId: string;
  onClose: () => void;
}) {
  const router = useRouter();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      detent="medium"
      title={LOCK_ESCROW_SHEET_TITLE}
      footer={
        <div className="space-y-2">
          <button
            type="button"
            className={listingCta.filled}
            onClick={() => {
              onClose();
              router.push(listingHref(listingId));
            }}
          >
            {LOCK_ESCROW_CTA}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              material.regular,
              "flex h-11 w-full items-center justify-center rounded-[14px] text-[15px] font-medium text-white/80",
            )}
          >
            {LOCK_ESCROW_SECONDARY}
          </button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-silver">{LOCK_ESCROW_SHEET_BODY}</p>
    </Sheet>
  );
}
