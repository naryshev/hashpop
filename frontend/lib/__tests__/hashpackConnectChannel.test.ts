import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildHashPackDeepLink,
  openHashPackDeepLinkIfMobile,
  selectHashPackConnectChannel,
} from "../hashpackConnectChannel";
import { openHashPackDeepLink } from "../hashpackWallet";
import { clearAwaitingHashpackReturn, isAwaitingHashpackReturn } from "../hashpackRestore";

afterEach(() => {
  clearAwaitingHashpackReturn();
  vi.restoreAllMocks();
});

describe("selectHashPackConnectChannel", () => {
  it("uses the HashPack extension relay on desktop, never hashpack://", () => {
    expect(selectHashPackConnectChannel({ mobile: false, framed: false })).toBe("extension");
  });

  it("uses a hashpack:// deep link on mobile browsers", () => {
    expect(selectHashPackConnectChannel({ mobile: true, framed: false })).toBe("deeplink");
  });

  it("uses iframe pairing inside HashPack's dApp browser, including on mobile", () => {
    expect(selectHashPackConnectChannel({ mobile: true, framed: true })).toBe("iframe");
    expect(selectHashPackConnectChannel({ mobile: false, framed: true })).toBe("iframe");
  });
});

describe("openHashPackDeepLinkIfMobile", () => {
  const pairingUri = "wc:abc@2?relay-protocol=irn&symKey=deadbeef";

  it("navigates to hashpack:// on mobile", () => {
    const assignHref = vi.fn();
    const markAwaitingReturn = vi.fn();
    const opened = openHashPackDeepLinkIfMobile({
      pairingUri,
      mobile: true,
      framed: false,
      navigation: { assignHref, markAwaitingReturn },
    });

    expect(opened).toBe(true);
    expect(markAwaitingReturn).toHaveBeenCalledOnce();
    expect(assignHref).toHaveBeenCalledWith(buildHashPackDeepLink(pairingUri));
    expect(assignHref.mock.calls[0][0]).toMatch(/^hashpack:\/\/wc\?uri=/);
  });

  it("does not navigate to hashpack:// on desktop, even if the extension is missing", () => {
    const assignHref = vi.fn();
    const markAwaitingReturn = vi.fn();
    const opened = openHashPackDeepLinkIfMobile({
      pairingUri,
      mobile: false,
      framed: false,
      navigation: { assignHref, markAwaitingReturn },
    });

    expect(opened).toBe(false);
    expect(assignHref).not.toHaveBeenCalled();
    expect(markAwaitingReturn).not.toHaveBeenCalled();
  });

  it("does not navigate to hashpack:// inside a framed wallet browser", () => {
    const assignHref = vi.fn();
    const markAwaitingReturn = vi.fn();
    const opened = openHashPackDeepLinkIfMobile({
      pairingUri,
      mobile: true,
      framed: true,
      navigation: { assignHref, markAwaitingReturn },
    });

    expect(opened).toBe(false);
    expect(assignHref).not.toHaveBeenCalled();
    expect(markAwaitingReturn).not.toHaveBeenCalled();
  });

  it("desktop openHashPackDeepLink does not launch hashpack:// or window.open", () => {
    const desktopUa =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    Object.defineProperty(window.navigator, "userAgent", {
      value: desktopUa,
      configurable: true,
    });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const hrefBefore = window.location.href;

    openHashPackDeepLink("wc:abc@2?relay-protocol=irn&symKey=deadbeef");

    expect(open).not.toHaveBeenCalled();
    expect(window.location.href).toBe(hrefBefore);
    expect(window.location.href.startsWith("hashpack:")).toBe(false);
    expect(isAwaitingHashpackReturn()).toBe(false);
  });

  it("does nothing without a pairing URI", () => {
    const assignHref = vi.fn();
    const opened = openHashPackDeepLinkIfMobile({
      pairingUri: "",
      mobile: true,
      framed: false,
      navigation: { assignHref, markAwaitingReturn: vi.fn() },
    });
    expect(opened).toBe(false);
    expect(assignHref).not.toHaveBeenCalled();
  });
});
