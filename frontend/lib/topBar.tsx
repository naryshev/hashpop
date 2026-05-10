"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  /** Bumped whenever any slot mounts so portal consumers re-render. */
  version: number;
};

const TopBarContext = createContext<Ctx | null>(null);

/**
 * Site-wide top-bar slot registry. The desktop chrome mounts three empty
 * `<div>`s (title / center / actions) and pages use <TopBarSlot> to portal
 * their own JSX into them. Portals keep the page's React tree intact so any
 * state inside the slot (e.g. the marketplace search input) survives nav.
 */
export function TopBarProvider({ children }: { children: ReactNode }) {
  const slots = useRef<Record<TopBarSlotName, HTMLElement | null>>({
    title: null,
    center: null,
    actions: null,
  });
  const [version, setVersion] = useState(0);

  const registerSlot = useCallback((name: TopBarSlotName, el: HTMLElement | null) => {
    slots.current[name] = el;
    setVersion((v) => v + 1);
  }, []);

  const getSlot = useCallback((name: TopBarSlotName) => slots.current[name], []);

  return (
    <TopBarContext.Provider value={{ registerSlot, getSlot, version }}>
      {children}
    </TopBarContext.Provider>
  );
}

/**
 * Imperative ref callback for the slot host. Pass to `ref` on the slot's
 * placeholder element inside DesktopShell.
 */
export function useTopBarSlotRef(name: TopBarSlotName) {
  const ctx = useContext(TopBarContext);
  return useCallback(
    (el: HTMLElement | null) => {
      ctx?.registerSlot(name, el);
    },
    [ctx, name],
  );
}

/**
 * Render `children` into the named top-bar slot via a portal. Mounts to null
 * on first paint if the slot hasn't registered yet, then portal-mounts on the
 * next render once the slot's ref fires.
 */
export function TopBarSlot({ name, children }: { name: TopBarSlotName; children: ReactNode }) {
  const ctx = useContext(TopBarContext);
  const [, force] = useState(0);
  // Re-evaluate the target whenever the registry version changes.
  useEffect(() => {
    if (!ctx) return;
    force((v) => v + 1);
  }, [ctx, ctx?.version]);
  if (!ctx) return null;
  const target = ctx.getSlot(name);
  if (!target) return null;
  return createPortal(children, target);
}
