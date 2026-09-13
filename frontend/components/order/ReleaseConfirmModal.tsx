"use client";

import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { material } from "@/lib/materials";
import { cn } from "@/lib/utils";

export function ReleaseConfirmModal({
  open,
  amount,
  sellerLabel,
  submitting,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  amount: string;
  sellerLabel: React.ReactNode;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      detent="medium"
      dismissible={!submitting}
      title={`Release ${amount} ℏ?`}
      footer={
        <div className="flex flex-col gap-2">
          <Button onClick={onConfirm} disabled={submitting}>
            {submitting ? "Submitting…" : `Yes, release ${amount} ℏ`}
          </Button>
          <Button variant="gray" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        </div>
      }
    >
      <p className="text-[13px] leading-relaxed text-muted">
        This pays the seller from escrow and closes the trade on-chain.{" "}
        <strong className="text-fg">It cannot be undone.</strong> Only release after you&apos;ve
        received and inspected the item.
      </p>
      <div
        className={cn(
          material.regular,
          "mt-3 flex items-center justify-between rounded-control px-3 py-3 text-xs",
        )}
      >
        <span className="text-muted">To seller</span>
        <span className="font-mono text-fg">{sellerLabel}</span>
      </div>
    </Sheet>
  );
}
