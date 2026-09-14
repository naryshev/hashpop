"use client";

import { useEffect, useRef, useState } from "react";
import { useHashpackWallet } from "../lib/hashpackWallet";
import {
  HASHPACK_RESTORE_FADE_MS,
  HASHPACK_RESTORE_MAX_VISIBLE_MS,
  HASHPACK_RESTORE_MIN_VISIBLE_MS,
  HASHPACK_RESTORE_SUBTITLE,
  HASHPACK_RESTORE_TITLE,
  clearAwaitingHashpackReturn,
  isAwaitingHashpackReturn,
  noteVisibilityReturn,
  shouldEngageHashpackRestore,
  subscribeAwaitingHashpackReturn,
} from "../lib/hashpackRestore";
import { material } from "../lib/materials";
import { cn } from "../lib/utils";

/**
 * Compact return-path chip shown after hashpack:// leave while the session is
 * still restoring. Not a BootSplash remount — chrome stays in place.
 */
export function HashpackRestoreOverlay() {
  const { isConnecting, isReady, isConnected, error } = useHashpackWallet();
  const [awaitingHashpackReturn, setAwaitingHashpackReturn] = useState(isAwaitingHashpackReturn);
  const [returnedFromBackground, setReturnedFromBackground] = useState(false);
  const [hardCapped, setHardCapped] = useState(false);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const shownAtRef = useRef<number | null>(null);
  const prevVisibilityRef = useRef<DocumentVisibilityState>(
    typeof document === "undefined" ? "visible" : document.visibilityState,
  );

  useEffect(() => {
    setAwaitingHashpackReturn(isAwaitingHashpackReturn());
    return subscribeAwaitingHashpackReturn(() => {
      const next = isAwaitingHashpackReturn();
      setAwaitingHashpackReturn(next);
      if (next) setHardCapped(false);
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPreview(params.has("hpRestoreOverlay"));
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      const previous = prevVisibilityRef.current;
      const next = document.visibilityState;
      prevVisibilityRef.current = next;
      if (noteVisibilityReturn(previous, next)) {
        setReturnedFromBackground(true);
        setHardCapped(false);
      }
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setReturnedFromBackground(true);
        setHardCapped(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  const wantsShow =
    !hardCapped &&
    shouldEngageHashpackRestore({
      awaitingHashpackReturn,
      returnedFromBackground,
      wallet: { isConnecting, isReady, isConnected, error },
    });

  useEffect(() => {
    if (wantsShow) {
      if (shownAtRef.current == null) shownAtRef.current = performance.now();
      setOpen(true);
      const remaining = Math.max(
        0,
        HASHPACK_RESTORE_MAX_VISIBLE_MS - (performance.now() - shownAtRef.current),
      );
      const cap = window.setTimeout(() => setHardCapped(true), remaining);
      return () => window.clearTimeout(cap);
    }

    if (!open) return;
    const shownAt = shownAtRef.current ?? performance.now();
    const wait = Math.max(0, HASHPACK_RESTORE_MIN_VISIBLE_MS - (performance.now() - shownAt));
    const hide = window.setTimeout(() => {
      setOpen(false);
      shownAtRef.current = null;
      setReturnedFromBackground(false);
      clearAwaitingHashpackReturn();
    }, wait);
    return () => window.clearTimeout(hide);
  }, [wantsShow, open]);

  return <HashpackRestoreOverlayView open={open || preview} />;
}

export function HashpackRestoreOverlayView({ open }: { open: boolean }) {
  const [mounted, setMounted] = useState(open);
  const [opaque, setOpaque] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = window.requestAnimationFrame(() => setOpaque(true));
      return () => window.cancelAnimationFrame(frame);
    }
    setOpaque(false);
    const t = window.setTimeout(() => setMounted(false), HASHPACK_RESTORE_FADE_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!mounted) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={HASHPACK_RESTORE_TITLE}
      data-testid="hashpack-restore-overlay"
      className={cn(
        "fixed inset-0 z-[80] flex items-center justify-center px-4 transition-opacity ease-out",
        opaque ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      style={{ transitionDuration: `${HASHPACK_RESTORE_FADE_MS}ms` }}
    >
      <div className="absolute inset-0 bg-black/40" aria-hidden />
      <div
        className={cn(
          material.thick,
          "relative w-full max-w-[280px] rounded-2xl border border-hairline px-5 py-5 text-center shadow-tab",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hashpop-cart-3d.PNG"
          alt=""
          className="mx-auto h-8 w-8 object-contain drop-shadow-[0_0_12px_rgba(0,255,163,0.45)]"
        />
        <p className="mt-3 text-sm font-semibold tracking-tight text-white">
          {HASHPACK_RESTORE_TITLE}
        </p>
        <p className="mt-1 text-xs text-silver">{HASHPACK_RESTORE_SUBTITLE}</p>
        <div className="mx-auto mt-4 h-1 w-28 overflow-hidden rounded-full bg-white/10">
          <div className="hp-splash-bar h-full w-1/3 rounded-full bg-[linear-gradient(90deg,transparent,#00ffa3,#00e5ff,transparent)]" />
        </div>
      </div>
    </div>
  );
}
