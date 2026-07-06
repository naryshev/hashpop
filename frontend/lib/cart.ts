"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Shopping cart — a client-side list of listing ids saved in localStorage.
 * Payment only happens at checkout (one on-chain buy per item), so there is
 * no server state to keep in sync; a storage event + a custom event keep all
 * mounted components (header badge, listing page, cart page) consistent.
 */

const KEY = "hashpop.cart.v1";
const EVT = "hashpop:cart";

const EMPTY: string[] = [];
let cache: { raw: string; ids: string[] } | null = null;

function parse(raw: string): string[] {
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function getSnapshot(): string[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(KEY) ?? "[]";
  if (!cache || cache.raw !== raw) cache = { raw, ids: parse(raw) };
  return cache.ids;
}

function getServerSnapshot(): string[] {
  return EMPTY;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function write(ids: string[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // storage full/blocked — cart just won't persist
  }
  window.dispatchEvent(new Event(EVT));
}

export function cartIds(): string[] {
  return getSnapshot();
}

export function addToCart(id: string): void {
  const ids = getSnapshot();
  if (ids.includes(id)) return;
  write([...ids, id]);
}

export function removeFromCart(id: string): void {
  write(getSnapshot().filter((x) => x !== id));
}

export function clearCart(): void {
  write([]);
}

export function useCart() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const has = useCallback((id: string) => ids.includes(id), [ids]);
  return {
    ids,
    count: ids.length,
    has,
    add: addToCart,
    remove: removeFromCart,
    clear: clearCart,
  };
}
