/**
 * HashPack return-path restore indicator — decision helpers.
 *
 * Shown after a hashpack:// leave (or hide→visible swipe-back) while the
 * wallet is still pairing / restoring. Not a BootSplash remount.
 */

export const HASHPACK_RESTORE_MIN_VISIBLE_MS = 300;
export const HASHPACK_RESTORE_MAX_VISIBLE_MS = 10_000;
/** Soft fade in/out; spec range is 200–280ms. */
export const HASHPACK_RESTORE_FADE_MS = 240;

export const HASHPACK_RESTORE_TITLE = "Reconnecting wallet…";
export const HASHPACK_RESTORE_SUBTITLE = "Finishing HashPack…";

export type HashpackRestoreWalletState = {
  isConnecting: boolean;
  isReady: boolean;
  isConnected: boolean;
  error: string | null;
};

let awaitingHashpackReturn = false;
const awaitingListeners = new Set<() => void>();

function notifyAwaitingListeners(): void {
  for (const listener of awaitingListeners) listener();
}

/** Set when opening a hashpack:// deep link so the overlay can show on return. */
export function markAwaitingHashpackReturn(): void {
  awaitingHashpackReturn = true;
  notifyAwaitingListeners();
}

export function clearAwaitingHashpackReturn(): void {
  if (!awaitingHashpackReturn) return;
  awaitingHashpackReturn = false;
  notifyAwaitingListeners();
}

export function isAwaitingHashpackReturn(): boolean {
  return awaitingHashpackReturn;
}

export function subscribeAwaitingHashpackReturn(listener: () => void): () => void {
  awaitingListeners.add(listener);
  return () => {
    awaitingListeners.delete(listener);
  };
}

export function isWalletUnsettled(wallet: HashpackRestoreWalletState): boolean {
  if (wallet.error) return false;
  return wallet.isConnecting || !wallet.isReady;
}

export function isWalletSessionSettled(wallet: HashpackRestoreWalletState): boolean {
  if (wallet.error) return true;
  if (!wallet.isReady) return false;
  return wallet.isConnected || !wallet.isConnecting;
}

export function shouldEngageHashpackRestore(input: {
  awaitingHashpackReturn: boolean;
  returnedFromBackground: boolean;
  wallet: HashpackRestoreWalletState;
}): boolean {
  if (!input.awaitingHashpackReturn && !input.returnedFromBackground) return false;
  return isWalletUnsettled(input.wallet);
}

export function noteVisibilityReturn(
  previous: DocumentVisibilityState,
  next: DocumentVisibilityState,
  hadBeenVisible: boolean,
): { isReturn: boolean; hadBeenVisible: boolean } {
  const isReturn = hadBeenVisible && previous === "hidden" && next === "visible";
  return {
    isReturn,
    hadBeenVisible: hadBeenVisible || previous === "visible" || next === "visible",
  };
}

export function shouldKeepHashpackRestoreVisible(input: {
  engaged: boolean;
  shownAt: number | null;
  now: number;
  hardCapped: boolean;
}): boolean {
  if (input.hardCapped) return false;
  if (input.shownAt == null) return input.engaged;
  const elapsed = input.now - input.shownAt;
  if (elapsed >= HASHPACK_RESTORE_MAX_VISIBLE_MS) return false;
  if (input.engaged) return true;
  return elapsed < HASHPACK_RESTORE_MIN_VISIBLE_MS;
}
