import { afterEach, describe, expect, it } from "vitest";
import {
  HASHPACK_RESTORE_FADE_MS,
  HASHPACK_RESTORE_MAX_VISIBLE_MS,
  HASHPACK_RESTORE_MIN_VISIBLE_MS,
  HASHPACK_RESTORE_SUBTITLE,
  HASHPACK_RESTORE_TITLE,
  clearAwaitingHashpackReturn,
  isAwaitingHashpackReturn,
  isWalletSessionSettled,
  isWalletUnsettled,
  markAwaitingHashpackReturn,
  noteVisibilityReturn,
  shouldEngageHashpackRestore,
  shouldKeepHashpackRestoreVisible,
  subscribeAwaitingHashpackReturn,
} from "../hashpackRestore";

const connecting = {
  isConnecting: true,
  isReady: true,
  isConnected: false,
  error: null,
};

const restoring = {
  isConnecting: false,
  isReady: false,
  isConnected: false,
  error: null,
};

const connected = {
  isConnecting: false,
  isReady: true,
  isConnected: true,
  error: null,
};

const idleDisconnected = {
  isConnecting: false,
  isReady: true,
  isConnected: false,
  error: null,
};

const terminalError = {
  isConnecting: false,
  isReady: true,
  isConnected: false,
  error: "Couldn't initialize HashPack.",
};

describe("isWalletUnsettled", () => {
  it("is true while pairing is in flight", () => {
    expect(isWalletUnsettled(connecting)).toBe(true);
  });

  it("is true while HashConnect is not ready and there is no terminal error", () => {
    expect(isWalletUnsettled(restoring)).toBe(true);
  });

  it("is false once the session is connected", () => {
    expect(isWalletUnsettled(connected)).toBe(false);
  });

  it("is false when restore finished idle/disconnected", () => {
    expect(isWalletUnsettled(idleDisconnected)).toBe(false);
  });

  it("is false on a terminal error so existing error UI can take over", () => {
    expect(isWalletUnsettled(terminalError)).toBe(false);
    expect(isWalletUnsettled({ ...restoring, error: "init failed" })).toBe(false);
  });
});

describe("isWalletSessionSettled", () => {
  it("is settled when connected after restore", () => {
    expect(isWalletSessionSettled(connected)).toBe(true);
  });

  it("is settled when clearly idle disconnected after a restore attempt", () => {
    expect(isWalletSessionSettled(idleDisconnected)).toBe(true);
  });

  it("is settled on a terminal error", () => {
    expect(isWalletSessionSettled(terminalError)).toBe(true);
  });

  it("is not settled while connecting or restoring", () => {
    expect(isWalletSessionSettled(connecting)).toBe(false);
    expect(isWalletSessionSettled(restoring)).toBe(false);
  });
});

describe("shouldEngageHashpackRestore", () => {
  it("does not engage on a cold idle page with no HashPack leave", () => {
    expect(
      shouldEngageHashpackRestore({
        awaitingHashpackReturn: false,
        returnedFromBackground: false,
        wallet: restoring,
      }),
    ).toBe(false);
  });

  it("engages immediately when the hashpack:// flag is set, even before visibility fires", () => {
    expect(
      shouldEngageHashpackRestore({
        awaitingHashpackReturn: true,
        returnedFromBackground: false,
        wallet: connecting,
      }),
    ).toBe(true);
  });

  it("engages on hide→visible return while the wallet is still restoring", () => {
    expect(
      shouldEngageHashpackRestore({
        awaitingHashpackReturn: false,
        returnedFromBackground: true,
        wallet: restoring,
      }),
    ).toBe(true);
  });

  it("does not engage on a background return when the wallet is already settled", () => {
    expect(
      shouldEngageHashpackRestore({
        awaitingHashpackReturn: true,
        returnedFromBackground: true,
        wallet: connected,
      }),
    ).toBe(false);
    expect(
      shouldEngageHashpackRestore({
        awaitingHashpackReturn: false,
        returnedFromBackground: true,
        wallet: idleDisconnected,
      }),
    ).toBe(false);
    expect(
      shouldEngageHashpackRestore({
        awaitingHashpackReturn: true,
        returnedFromBackground: false,
        wallet: terminalError,
      }),
    ).toBe(false);
  });
});

describe("noteVisibilityReturn", () => {
  it("treats hidden → visible as a deep-link/swipe-back return only after the page has been visible", () => {
    expect(noteVisibilityReturn("hidden", "visible", true).isReturn).toBe(true);
  });

  it("does not treat the first hidden → visible paint as a HashPack return", () => {
    // Prerender, background tab, or SSO bounce: document starts hidden.
    const firstPaint = noteVisibilityReturn("hidden", "visible", false);
    expect(firstPaint.isReturn).toBe(false);
    expect(firstPaint.hadBeenVisible).toBe(true);
  });

  it("ignores the initial visible state and hide-only transitions", () => {
    expect(noteVisibilityReturn("visible", "visible", true).isReturn).toBe(false);
    expect(noteVisibilityReturn("visible", "hidden", true).isReturn).toBe(false);
    expect(noteVisibilityReturn("hidden", "hidden", false).isReturn).toBe(false);
  });
});

describe("shouldKeepHashpackRestoreVisible", () => {
  it("stays hidden until engaged", () => {
    expect(
      shouldKeepHashpackRestoreVisible({
        engaged: false,
        shownAt: null,
        now: 0,
        hardCapped: false,
      }),
    ).toBe(false);
  });

  it("shows as soon as restore is engaged", () => {
    expect(
      shouldKeepHashpackRestoreVisible({
        engaged: true,
        shownAt: null,
        now: 0,
        hardCapped: false,
      }),
    ).toBe(true);
  });

  it("honors a ~300ms minimum visible window to avoid flicker", () => {
    expect(
      shouldKeepHashpackRestoreVisible({
        engaged: false,
        shownAt: 1_000,
        now: 1_000 + HASHPACK_RESTORE_MIN_VISIBLE_MS - 1,
        hardCapped: false,
      }),
    ).toBe(true);
    expect(
      shouldKeepHashpackRestoreVisible({
        engaged: false,
        shownAt: 1_000,
        now: 1_000 + HASHPACK_RESTORE_MIN_VISIBLE_MS,
        hardCapped: false,
      }),
    ).toBe(false);
  });

  it("hard-caps around 10s even if the wallet is still unsettled", () => {
    expect(
      shouldKeepHashpackRestoreVisible({
        engaged: true,
        shownAt: 0,
        now: HASHPACK_RESTORE_MAX_VISIBLE_MS - 1,
        hardCapped: false,
      }),
    ).toBe(true);
    expect(
      shouldKeepHashpackRestoreVisible({
        engaged: true,
        shownAt: 0,
        now: HASHPACK_RESTORE_MAX_VISIBLE_MS,
        hardCapped: false,
      }),
    ).toBe(false);
    expect(
      shouldKeepHashpackRestoreVisible({
        engaged: true,
        shownAt: 0,
        now: 500,
        hardCapped: true,
      }),
    ).toBe(false);
  });
});

describe("awaitingHashpackReturn flag", () => {
  afterEach(() => {
    clearAwaitingHashpackReturn();
  });

  it("is off until a hashpack:// deep link is opened", () => {
    expect(isAwaitingHashpackReturn()).toBe(false);
  });

  it("turns on when opening hashpack:// and notifies subscribers", () => {
    const seen: boolean[] = [];
    const unsub = subscribeAwaitingHashpackReturn(() => {
      seen.push(isAwaitingHashpackReturn());
    });
    markAwaitingHashpackReturn();
    expect(isAwaitingHashpackReturn()).toBe(true);
    expect(seen).toEqual([true]);
    unsub();
  });

  it("clears after restore settles so a later idle visit does not re-show", () => {
    markAwaitingHashpackReturn();
    clearAwaitingHashpackReturn();
    expect(isAwaitingHashpackReturn()).toBe(false);
  });

  it("notifies again when a later hashpack:// open happens while already awaiting", () => {
    const seen: boolean[] = [];
    const unsub = subscribeAwaitingHashpackReturn(() => {
      seen.push(isAwaitingHashpackReturn());
    });
    markAwaitingHashpackReturn();
    markAwaitingHashpackReturn();
    expect(seen).toEqual([true, true]);
    unsub();
  });
});

describe("restore overlay copy and timing DNA", () => {
  it("uses the reconnecting copy from the creative spec", () => {
    expect(HASHPACK_RESTORE_TITLE).toBe("Reconnecting wallet…");
    expect(HASHPACK_RESTORE_SUBTITLE).toBe("Finishing HashPack…");
  });

  it("fades in the 200–280ms window and caps near 10s", () => {
    expect(HASHPACK_RESTORE_FADE_MS).toBeGreaterThanOrEqual(200);
    expect(HASHPACK_RESTORE_FADE_MS).toBeLessThanOrEqual(280);
    expect(HASHPACK_RESTORE_MIN_VISIBLE_MS).toBe(300);
    expect(HASHPACK_RESTORE_MAX_VISIBLE_MS).toBe(10_000);
  });
});
