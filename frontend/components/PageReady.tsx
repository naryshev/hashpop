"use client";

import { useEffect } from "react";

/**
 * Tells BootSplash the route's HTML is already the real content.
 * Marketplace dispatches this itself; other routes (support) were waiting
 * out the 3.5s cap.
 */
export function PageReady() {
  useEffect(() => {
    (window as unknown as { __hashpopReady?: boolean }).__hashpopReady = true;
    window.dispatchEvent(new Event("hashpop:ready"));
  }, []);
  return null;
}
