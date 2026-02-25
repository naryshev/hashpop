"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion, type PanInfo } from "framer-motion";

function cn(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(" ");
}

export type CardStackItem = {
  id: string | number;
  title: string;
  description?: string;
  imageSrc?: string;
  href?: string;
  ctaLabel?: string;
  tag?: string;
};

export type CardStackProps<T extends CardStackItem> = {
  items: T[];
  initialIndex?: number;
  maxVisible?: number;
  cardWidth?: number;
  cardHeight?: number;
  overlap?: number;
  spreadDeg?: number;
  perspectivePx?: number;
  depthPx?: number;
  tiltXDeg?: number;
  activeLiftPx?: number;
  activeScale?: number;
  inactiveScale?: number;
  springStiffness?: number;
  springDamping?: number;
  loop?: boolean;
  autoAdvance?: boolean;
  intervalMs?: number;
  pauseOnHover?: boolean;
  showDots?: boolean;
  className?: string;
  onChangeIndex?: (index: number, item: T) => void;
  renderCard?: (item: T, state: { active: boolean }) => React.ReactNode;
};

function wrapIndex(n: number, len: number) {
  if (len <= 0) return 0;
  return ((n % len) + len) % len;
}

function signedOffset(i: number, active: number, len: number, loop: boolean) {
  const raw = i - active;
  if (!loop || len <= 1) return raw;
  const alt = raw > 0 ? raw - len : raw + len;
  return Math.abs(alt) < Math.abs(raw) ? alt : raw;
}

export function CardStack<T extends CardStackItem>({
  items,
  initialIndex = 0,
  maxVisible = 7,
  cardWidth = 520,
  cardHeight = 320,
  overlap = 0.48,
  spreadDeg = 48,
  perspectivePx = 1100,
  depthPx = 140,
  tiltXDeg = 12,
  activeLiftPx = 22,
  activeScale = 1.03,
  inactiveScale = 0.94,
  springStiffness = 280,
  springDamping = 28,
  loop = true,
  autoAdvance = false,
  intervalMs = 2800,
  pauseOnHover = true,
  showDots = true,
  className,
  onChangeIndex,
  renderCard,
}: CardStackProps<T>) {
  const reduceMotion = useReducedMotion();
  const len = items.length;
  const [active, setActive] = React.useState(() => wrapIndex(initialIndex, len));
  const [hovering, setHovering] = React.useState(false);
  const lastDragAtRef = React.useRef(0);
  const [draggingId, setDraggingId] = React.useState<string | number | null>(null);
  const [panX, setPanX] = React.useState(0);
  const touchStartXRef = React.useRef(0);
  const touchStartYRef = React.useRef(0);
  const touchStartAtRef = React.useRef(0);

  React.useEffect(() => {
    setActive((a) => wrapIndex(a, len));
  }, [len]);

  React.useEffect(() => {
    if (!len) return;
    onChangeIndex?.(active, items[active]!);
  }, [active, items, len, onChangeIndex]);

  const maxOffset = Math.max(0, Math.floor(maxVisible / 2));
  const cardSpacing = Math.max(10, Math.round(cardWidth * (1 - overlap)));
  const stepDeg = maxOffset > 0 ? spreadDeg / maxOffset : 0;
  const canGoPrev = loop || active > 0;
  const canGoNext = loop || active < len - 1;

  const prev = React.useCallback(() => {
    if (!len || !canGoPrev) return;
    setActive((a) => wrapIndex(a - 1, len));
  }, [canGoPrev, len]);

  const next = React.useCallback(() => {
    if (!len || !canGoNext) return;
    setActive((a) => wrapIndex(a + 1, len));
  }, [canGoNext, len]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
  };

  const triggerSwipe = React.useCallback(
    (offsetX: number, velocityX: number) => {
      if (reduceMotion) return;
      // Dedicated gesture thresholds for smooth, reliable swipe-to-next behavior.
      const distanceThreshold = Math.max(18, Math.round(cardWidth * 0.1));
      const velocityThreshold = 320;
      if (offsetX > distanceThreshold || velocityX > velocityThreshold) prev();
      else if (offsetX < -distanceThreshold || velocityX < -velocityThreshold) next();
    },
    [cardWidth, next, prev, reduceMotion]
  );

  React.useEffect(() => {
    setPanX(0);
  }, [active]);

  React.useEffect(() => {
    if (!autoAdvance || reduceMotion || !len || (pauseOnHover && hovering)) return;
    const id = window.setInterval(() => {
      if (loop || active < len - 1) next();
    }, Math.max(700, intervalMs));
    return () => window.clearInterval(id);
  }, [autoAdvance, intervalMs, hovering, pauseOnHover, reduceMotion, len, loop, active, next]);

  if (!len) return null;

  return (
    <div className={cn("w-full", className)} onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
      <div className="relative w-full" style={{ height: Math.max(300, cardHeight + 70) }} tabIndex={0} onKeyDown={onKeyDown}>
        <div className="pointer-events-none absolute inset-x-0 top-6 mx-auto h-48 w-[70%] rounded-full bg-black/25 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto h-40 w-[76%] rounded-full bg-black/35 blur-3xl" aria-hidden />

        <div className="absolute inset-0 flex items-end justify-center" style={{ perspective: `${perspectivePx}px` }}>
          <AnimatePresence initial={false}>
            {items.map((item, i) => {
              const off = signedOffset(i, active, len, loop);
              const abs = Math.abs(off);
              if (abs > maxOffset) return null;

              const rotateZ = off * stepDeg;
              const x = off * cardSpacing;
              const y = abs * 10;
              const z = -abs * depthPx;
              const isActive = off === 0;
              const scale = isActive ? activeScale : inactiveScale;
              const lift = isActive ? -activeLiftPx : 0;
              const rotateX = isActive ? 0 : tiltXDeg;
              const zIndex = 100 - abs;

              return (
                <motion.div
                  key={item.id}
                  className={cn(
                    "absolute bottom-0 overflow-hidden rounded-2xl border-4 border-black/10 shadow-xl will-change-transform select-none touch-manipulation"
                  )}
                  style={{
                    width: cardWidth,
                    height: cardHeight,
                    zIndex,
                    transformStyle: "preserve-3d",
                    touchAction: isActive ? "none" : "auto",
                    cursor: draggingId === item.id ? "grabbing" : "grab",
                  }}
                  initial={
                    reduceMotion
                      ? false
                      : {
                          opacity: 0,
                          y: y + 40,
                          x,
                          rotateZ,
                          rotateX,
                          scale,
                        }
                  }
                  animate={{ opacity: 1, x: x + (isActive ? panX : 0), y: y + lift, rotateZ, rotateX, scale }}
                  transition={
                    isActive && draggingId === item.id
                      ? { duration: 0 }
                      : { type: "spring", stiffness: springStiffness, damping: springDamping }
                  }
                  onPanStart={() => {
                    if (!isActive) return;
                    setDraggingId(item.id);
                    lastDragAtRef.current = Date.now();
                  }}
                  onPan={(_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
                    if (!isActive) return;
                    const maxPan = cardWidth * 0.4;
                    const nextPan = Math.max(-maxPan, Math.min(maxPan, info.offset.x));
                    setPanX(nextPan);
                  }}
                  onPanEnd={(_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
                    if (!isActive) return;
                    setDraggingId(null);
                    lastDragAtRef.current = Date.now();
                    triggerSwipe(info.offset.x, info.velocity.x);
                    setPanX(0);
                  }}
                  onTouchStart={(e) => {
                    if (!isActive) return;
                    const t = e.touches[0];
                    if (!t) return;
                    touchStartXRef.current = t.clientX;
                    touchStartYRef.current = t.clientY;
                    touchStartAtRef.current = Date.now();
                    setDraggingId(item.id);
                  }}
                  onTouchMove={(e) => {
                    if (!isActive) return;
                    const t = e.touches[0];
                    if (!t) return;
                    const dx = t.clientX - touchStartXRef.current;
                    const dy = t.clientY - touchStartYRef.current;
                    // Prefer horizontal gesture capture when horizontal intent is clear.
                    if (Math.abs(dx) > Math.abs(dy)) e.preventDefault();
                    const maxPan = cardWidth * 0.4;
                    setPanX(Math.max(-maxPan, Math.min(maxPan, dx)));
                  }}
                  onTouchEnd={() => {
                    if (!isActive) return;
                    const elapsed = Math.max(1, Date.now() - touchStartAtRef.current);
                    const velocityX = (panX / elapsed) * 1000;
                    setDraggingId(null);
                    lastDragAtRef.current = Date.now();
                    triggerSwipe(panX, velocityX);
                    setPanX(0);
                  }}
                  onClick={() => {
                    // iOS can emit a click right after drag end; ignore that so swipe advances persist.
                    if (Date.now() - lastDragAtRef.current < 280) return;
                    setActive(i);
                  }}
                >
                  <div className="h-full w-full" style={{ transform: `translateZ(${z}px)`, transformStyle: "preserve-3d" }}>
                    {renderCard ? renderCard(item, { active: isActive }) : <DefaultFanCard item={item} />}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {showDots ? (
        <div className="mt-6 flex items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            {items.map((it, idx) => {
              const on = idx === active;
              return (
                <button
                  key={it.id}
                  onClick={() => setActive(idx)}
                  className={cn("h-2 w-2 rounded-full transition", on ? "bg-white" : "bg-white/35 hover:bg-white/55")}
                  aria-label={`Go to ${it.title}`}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DefaultFanCard({ item }: { item: CardStackItem }) {
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0">
        {item.imageSrc ? (
          <img
            src={item.imageSrc}
            alt={item.title}
            className="h-full w-full object-cover"
            draggable={false}
            loading="eager"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-black/30 text-sm text-white/70">
            No image
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="relative z-10 flex h-full flex-col justify-end p-5">
        <div className="truncate text-lg font-semibold text-white">{item.title}</div>
        {item.description ? <div className="mt-1 line-clamp-2 text-sm text-white/85">{item.description}</div> : null}
      </div>
    </div>
  );
}
