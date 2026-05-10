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
  /** Called by the slot host (DesktopShell) when each slot's DOM node mounts.
   *  Returns true if the registration changed something (helps consumers avoid
   *  no-op re-renders). */
  registerSlot: (name: TopBarSlotName, el: HTMLElement | null) => void;
  /** Read the live DOM node for a given slot, or null if it isn't mounted. */
  getSlot: (name: TopBarSlotName) => HTMLElement | null;
  /** Subscribe to "slots changed" events. Returns an unsubscribe fn. */
  subscribe: (cb: () => void) => () => void;
};

const TopBarContext = createContext<Ctx | null>(null);

/**
 * Site-wide top-bar slot registry. The desktop chrome mounts three empty
 * `<div>`s (title / center / actions) and pages use <TopBarSlot> to portal
 * their own JSX into them. Portals keep the page's React tree intact so any
 * state inside the slot (e.g. the marketplace search input) survives nav.
 *
 * Important: the context value's identity is stable (memoized once) and slot
 * change notification goes through a separate subscriber list. If the context
 * value changed on every slot registration, the ref callback handed to the
 * slot host would be re-created → React would detach + re-attach the ref →
 * registerSlot would fire again → infinite loop (React error #185). The
 * subscribe/notify pattern keeps registration idempotent.
 */
export function TopBarProvider({ children }: { children: ReactNode }) {
  const slots = useRef<Record<TopBarSlotName, HTMLElement | null>>({
    title: null,
    center: null,
    actions: null,
  });
  const subscribers = useRef<Set<() => void>>(new Set());

  const value = useMemo<Ctx>(() => {
    const notify = () => {
      subscribers.current.forEach((cb) => cb());
    };
    return {
      registerSlot(name, el) {
        if (slots.current[name] === el) return; // no-op if same node
        slots.current[name] = el;
        notify();
      },
      getSlot(name) {
        return slots.current[name];
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
 * Imperative ref callback for the slot host. Pass to `ref` on the slot's
 * placeholder element inside DesktopShell. The returned callback identity is
 * stable across renders so React doesn't ping-pong attach/detach the ref.
 */
export function useTopBarSlotRef(name: TopBarSlotName) {
  const ctx = useContext(TopBarContext);
  // Read the latest ctx through a ref so the returned callback's identity
  // can stay stable even if ctx is re-created (it shouldn't, but defensive).
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  return useCallback(
    (el: HTMLElement | null) => {
      ctxRef.current?.registerSlot(name, el);
    },
    [name],
  );
}

/**
 * Render `children` into the named top-bar slot via a portal. Subscribes to
 * registry changes so once the host slot mounts (after first paint) the
 * portal re-renders into the now-available DOM node.
 */
export function TopBarSlot({ name, children }: { name: TopBarSlotName; children: ReactNode }) {
  const ctx = useContext(TopBarContext);
  const [, force] = useState(0);
  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe(() => force((v) => v + 1));
  }, [ctx]);
  if (!ctx) return null;
  const target = ctx.getSlot(name);
  if (!target) return null;
  return createPortal(children, target);
}
