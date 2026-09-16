"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
  type PanInfo,
  type Transition,
} from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { material } from "@/lib/materials";

const SHEET_EASE = [0.32, 0.72, 0, 1] as const;
const DRAG_CLOSE_OFFSET = 80;
const DRAG_CLOSE_VELOCITY = 500;
export const SHEET_ENTER_S = 0.28;
export const SHEET_EXIT_S = 0.22;

const sheetPanel = cva(
  cn(
    material.thick,
    "relative flex w-full min-h-0 flex-col overflow-hidden border border-hairline",
  ),
  {
    variants: {
      detent: {
        medium: "max-h-[56dvh]",
        large: "max-h-[85dvh]",
      },
      edge: {
        bottom: "rounded-t-sheet md:rounded-sheet",
        top: "rounded-b-sheet md:rounded-sheet",
      },
    },
    defaultVariants: { detent: "medium", edge: "bottom" },
  },
);

export type SheetDetent = NonNullable<VariantProps<typeof sheetPanel>["detent"]>;
export type SheetEdge = NonNullable<VariantProps<typeof sheetPanel>["edge"]>;

export type SheetPanelMotion = {
  initial: { y: string } | { opacity: number };
  animate: { y: number } | { opacity: number };
  exit: { y: string; transition: Transition } | { opacity: number; transition: Transition };
  transition: Transition;
};

/** Enter/exit for the sheet panel. Top edge slides down from above; reduced-motion fades. */
export function sheetPanelMotion(edge: SheetEdge, reduceMotion: boolean): SheetPanelMotion {
  if (reduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0, transition: { duration: SHEET_EXIT_S } },
      transition: { duration: SHEET_ENTER_S },
    };
  }
  const off = edge === "top" ? "-100%" : "100%";
  return {
    initial: { y: off },
    animate: { y: 0 },
    exit: { y: off, transition: { duration: SHEET_EXIT_S, ease: SHEET_EASE } },
    transition: { duration: SHEET_ENTER_S, ease: SHEET_EASE },
  };
}

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  detent?: SheetDetent;
  /** `bottom` (default) is a classic sheet; `top` slides down from the header. */
  edge?: SheetEdge;
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
 * Shared sheet. Mobile is edge-anchored; md+ is a centered card.
 * Portals to document.body at z-130 (above the tab bar).
 */
export function Sheet({
  open,
  onClose,
  detent = "medium",
  edge = "bottom",
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
  const reduceMotion = useReducedMotion() === true;
  const panelMotion = sheetPanelMotion(edge, reduceMotion);
  const fromTop = edge === "top";

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
    if (fromTop) {
      if (info.offset.y < -DRAG_CLOSE_OFFSET || info.velocity.y < -DRAG_CLOSE_VELOCITY) {
        onClose();
      }
      return;
    }
    if (info.offset.y > DRAG_CLOSE_OFFSET || info.velocity.y > DRAG_CLOSE_VELOCITY) {
      onClose();
    }
  };

  if (!mounted) return null;

  const hasHeader = Boolean(title || leading || trailing);
  const labelled = ariaLabel ?? title;
  const grabber = dismissible ? (
    <div
      className="flex shrink-0 cursor-grab justify-center pt-2 pb-1 md:hidden"
      onPointerDown={(e) => {
        dragControls.start(e);
      }}
    >
      <div className="h-[5px] w-9 rounded-full bg-white/25" />
    </div>
  ) : null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className={cn(
            "fixed inset-0 z-[130] flex justify-center",
            fromTop
              ? "items-start pt-[env(safe-area-inset-top)] md:items-center md:p-4"
              : "items-end md:items-center md:p-4",
          )}
          role="dialog"
          aria-modal="true"
          aria-label={labelled}
          data-sheet-edge={edge}
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
            className={cn(sheetPanel({ detent, edge }), className)}
            data-sheet-panel=""
            data-sheet-motion={reduceMotion ? "fade" : fromTop ? "slide-down" : "slide-up"}
            initial={panelMotion.initial}
            animate={panelMotion.animate}
            exit={panelMotion.exit}
            transition={panelMotion.transition}
            drag={dismissible && !reduceMotion ? "y" : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={fromTop ? { top: 0.45, bottom: 0 } : { top: 0, bottom: 0.45 }}
            onDragEnd={onDragEnd}
          >
            {!fromTop && grabber}

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

            {fromTop && grabber}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
