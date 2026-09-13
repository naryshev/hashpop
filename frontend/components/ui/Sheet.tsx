"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { material } from "@/lib/materials";

const SHEET_EASE = [0.32, 0.72, 0, 1] as const;
const DRAG_CLOSE_OFFSET = 80;
const DRAG_CLOSE_VELOCITY = 500;

const sheetPanel = cva(
  cn(
    material.thick,
    "relative flex w-full min-h-0 flex-col overflow-hidden border border-hairline rounded-t-sheet md:rounded-sheet",
  ),
  {
    variants: {
      detent: {
        medium: "max-h-[56dvh]",
        large: "max-h-[85dvh]",
      },
    },
    defaultVariants: { detent: "medium" },
  },
);

export type SheetDetent = NonNullable<VariantProps<typeof sheetPanel>["detent"]>;

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  detent?: SheetDetent;
  dismissible?: boolean;
  title?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
};

/**
 * Shared bottom sheet. Mobile is bottom-anchored; md+ is a centered card.
 * Portals to document.body at z-130 (above the tab bar).
 */
export function Sheet({
  open,
  onClose,
  detent = "medium",
  dismissible = true,
  title,
  leading,
  trailing,
  footer,
  children,
  className,
  ariaLabel,
}: SheetProps) {
  const [mounted, setMounted] = useState(false);
  const dragControls = useDragControls();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismissible, onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (!dismissible) return;
    if (info.offset.y > DRAG_CLOSE_OFFSET || info.velocity.y > DRAG_CLOSE_VELOCITY) {
      onClose();
    }
  };

  if (!mounted) return null;

  const hasHeader = Boolean(title || leading || trailing);
  const labelled = ariaLabel ?? title;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[130] flex items-end justify-center md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={labelled}
        >
          <motion.div
            className={cn("absolute inset-0", material.scrim)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={dismissible ? onClose : undefined}
          />
          <motion.div
            className={cn(sheetPanel({ detent }), className)}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%", transition: { duration: 0.22, ease: SHEET_EASE } }}
            transition={{ duration: 0.28, ease: SHEET_EASE }}
            drag={dismissible ? "y" : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.45 }}
            onDragEnd={onDragEnd}
          >
            <div
              className="flex shrink-0 cursor-grab justify-center pt-2 md:hidden"
              onPointerDown={(e) => {
                if (dismissible) dragControls.start(e);
              }}
            >
              <div className="h-[5px] w-9 rounded-full bg-white/25" />
            </div>

            {hasHeader && (
              <header
                className={cn(
                  "relative flex shrink-0 items-center px-5",
                  leading || trailing ? "min-h-10 justify-center" : "pt-1",
                )}
              >
                {leading && (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">{leading}</div>
                )}
                {title && (
                  <h2
                    className={cn(
                      "font-bold text-white",
                      leading || trailing ? "text-sm" : "text-lg",
                    )}
                  >
                    {title}
                  </h2>
                )}
                {trailing && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">{trailing}</div>
                )}
              </header>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-2">{children}</div>

            {footer ? (
              <div className="shrink-0 px-5 pt-3 pb-safe">{footer}</div>
            ) : (
              <div className="pb-safe" />
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
