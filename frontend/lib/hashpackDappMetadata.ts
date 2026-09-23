/**
 * WalletConnect dApp metadata for HashConnect.
 *
 * HashPack's extension-page CSP img-src allowlist does not include
 * hashpop.io, so `https://hashpop.io/hashpop-cart-3d.PNG` is blocked in the
 * approval popup. `data:` is on that allowlist. This icon is an inline SVG
 * so the popup can paint it without a network fetch.
 *
 * Do not put Hedera `alias` here. HashPack does not read proposal
 * sessionProperties; it sets alias from the wallet nickname. See
 * hashpackSessionAlias.ts.
 */
const HASHPOP_WALLET_ICON_SVG_BASE64 =
  "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTQiIGZpbGw9IiMwYjExMWIiLz48cGF0aCBmaWxsPSIjMDBmZmEzIiBkPSJNMTYgMThoNS4ybDEuNCA2SDUwbC0zLjIgMTRIMjQuMkwyMC42IDE4SDE2em04LjggOCAyLjIgMTBoMTYuNGwyLTEwSDI0Ljh6Ii8+PGNpcmNsZSBjeD0iMjgiIGN5PSI0NiIgcj0iMy4yIiBmaWxsPSIjMDBmZmEzIi8+PGNpcmNsZSBjeD0iNDQiIGN5PSI0NiIgcj0iMy4yIiBmaWxsPSIjMDBmZmEzIi8+PC9zdmc+";

export const HASHPOP_WALLET_ICON = `data:image/svg+xml;base64,${HASHPOP_WALLET_ICON_SVG_BASE64}`;

export function buildHashpackDappMetadata(origin: string): {
  name: string;
  description: string;
  icons: string[];
  url: string;
} {
  return {
    name: "Hashpop",
    description: "Hashpop — verifiable peer-to-peer marketplace on Hedera",
    icons: [HASHPOP_WALLET_ICON],
    url: origin,
  };
}
