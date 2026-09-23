/**
 * How a connect click should reach HashPack.
 *
 * `hashpack://` is a mobile OS protocol handler. Desktop Chrome does not
 * register one, so `window.open("hashpack://wc?uri=…", "_self")` shows
 * "Failed to launch … scheme does not have a registered handler" and can
 * unload the page before HashConnect posts `hashconnect-connect-extension`.
 * The extension never sees the pairing URI, and WalletConnect times out.
 *
 * Desktop fallback when the extension is not installed: do **not** open
 * `hashpack://`. The connect path keeps the short notDetected timeout and
 * the existing install-link + QR pairing UI.
 */
export type HashPackConnectChannel = "extension" | "deeplink" | "iframe";

export function selectHashPackConnectChannel(input: {
  mobile: boolean;
  framed: boolean;
}): HashPackConnectChannel {
  // HashPack's dApp browser is an iframe. Navigating it to hashpack://
  // replaces the app with the browser's blocked-content page.
  if (input.framed) return "iframe";
  if (input.mobile) return "deeplink";
  return "extension";
}

export function buildHashPackDeepLink(pairingUri: string): string {
  return `hashpack://wc?uri=${encodeURIComponent(pairingUri)}`;
}

export type DeepLinkNavigation = {
  assignHref: (href: string) => void;
  markAwaitingReturn: () => void;
};

/**
 * Navigate to hashpack:// only on the mobile deep-link channel.
 * Desktop and framed callers are no-ops so a click cannot launch an
 * unregistered custom scheme.
 *
 * Returns true when a deep link was opened.
 */
export function openHashPackDeepLinkIfMobile(options: {
  pairingUri: string;
  mobile: boolean;
  framed: boolean;
  navigation: DeepLinkNavigation;
}): boolean {
  if (!options.pairingUri) return false;
  if (selectHashPackConnectChannel(options) !== "deeplink") return false;
  options.navigation.markAwaitingReturn();
  options.navigation.assignHref(buildHashPackDeepLink(options.pairingUri));
  return true;
}
