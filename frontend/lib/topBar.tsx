"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type TopBarSlotName = "title" | "center" | "actions";

type Ctx = {
  /** Called by the slot host (DesktopShell) when each slot's DOM node mounts. */
  registerSlot: (name: TopBarSlotName, el: HTMLElement | null) => void;
  /** Read the live DOM node for a given slot, or null if it isn't mounted. */
  getSlot: (name: TopBarSlotName) => HTMLElement | null;
  /** Called by <TopBarSlot> on mount/unmount so the host knows when a page is
   *  providing its own content and the chrome can hide its fallback. */
  setFilled: (name: TopBarSlotName, filled: boolean) => void;
  /** Synchronous "is the slot currently filled by a page?" check. */
  isFilled: (name: TopBarSlotName) => boolean;
  /** Subscribe to any registry change (slot mounted, fill flipped). */
  subscribe: (cb: () => void) => () => void;
};

const TopBarContext = createContext<Ctx | null>(null);

/**
 * Site-wide top-bar slot registry. The desktop chrome mounts three empty
 * `<div>`s (title / center / actions). Pages use <TopBarSlot> to portal their
 * JSX into them. The host divs must be left empty — `createPortal` appends
 * to existing children, so any chrome-provided fallback content lives in a
 * sibling node that's hidden via `isFilled(name)`.
 */
export function TopBarProvider({ children }: { children: ReactNode }) {
  const slots = useRef<Record<TopBarSlotName, HTMLElement | null>>({
    title: null,
    center: null,
    actions: null,
  });
  const filled = useRef<Record<TopBarSlotName, number>>({
    title: 0,
    center: 0,
    actions: 0,
  });
  const subscribers = useRef<Set<() => void>>(new Set());

  const value = useMemo<Ctx>(() => {
    const notify = () => subscribers.current.forEach((cb) => cb());
    return {
      registerSlot(name, el) {
        if (slots.current[name] === el) return;
        slots.current[name] = el;
        notify();
      },
      getSlot(name) {
        return slots.current[name];
      },
      setFilled(name, on) {
        const next = (filled.current[name] ?? 0) + (on ? 1 : -1);
        filled.current[name] = Math.max(0, next);
        notify();
      },
      isFilled(name) {
        return (filled.current[name] ?? 0) > 0;
      },
      subscribe(cb) {
        subscribers.current.add(cb);
        return () => {
          subscribers.current.delete(cb);
        };
      },
    };
  }, []);

  return <TopBarContext.Provider value={value}>{children}</TopBarContext.Provider>;
}

/**
 * Imperative ref callback for the slot host. Stable identity across renders.
 */
export function useTopBarSlotRef(name: TopBarSlotName) {
  const ctx = useContext(TopBarContext);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  return useCallback(
    (el: HTMLElement | null) => {
      ctxRef.current?.registerSlot(name, el);
    },
    [name],
  );
}

/** Returns the current "filled" state for a slot and re-renders on change. */
export function useTopBarSlotFilled(name: TopBarSlotName) {
  const ctx = useContext(TopBarContext);
  const [filled, setFilledState] = useState(false);
  useEffect(() => {
    if (!ctx) return;
    setFilledState(ctx.isFilled(name));
    return ctx.subscribe(() => setFilledState(ctx.isFilled(name)));
  }, [ctx, name]);
  return filled;
}

/**
 * Render `children` into the named top-bar slot via a portal. Marks the slot
 * as filled so the chrome can hide its fallback. Falls back to nothing if
 * the slot host hasn't mounted yet.
 */
export function TopBarSlot({ name, children }: { name: TopBarSlotName; children: ReactNode }) {
  const ctx = useContext(TopBarContext);
  const [, force] = useState(0);

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe(() => force((v) => v + 1));
  }, [ctx]);

  // Mark the slot as filled while this component is mounted, regardless of
  // whether the portal target is available yet (the chrome should hide its
  // fallback as soon as a page declares intent to fill the slot).
  useEffect(() => {
    if (!ctx) return;
    ctx.setFilled(name, true);
    return () => ctx.setFilled(name, false);
  }, [ctx, name]);

  if (!ctx) return null;
  const target = ctx.getSlot(name);
  if (!target) return null;
  return createPortal(children, target);
}
