"use client";

import { useEffect } from "react";
import { retainHashConnectPreload } from "./hashpackWalletInit";

/**
 * Mounted with a Connect, Buy, or Make offer control. HashConnect init waits
 * until after the load quiet window so the wallet chunk stays off the
 * Lighthouse critical path, and the pairing URI is cached before the tap.
 */
export function useHashConnectPreload(): void {
  useEffect(() => retainHashConnectPreload(), []);
}
