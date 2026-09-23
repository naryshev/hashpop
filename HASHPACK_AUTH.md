# HashPack (HashConnect) Wallet Auth — Reference & Reusable Prompt

How Hashpop wires up HashPack wallet login so it feels instant on both desktop
(browser extension) and mobile (deep link / QR), with actionable failure states
instead of infinite spinners.

Real implementation lives in:

- `frontend/lib/hashpackWallet.tsx` — the provider that owns the whole lifecycle
- `frontend/components/ui/SignInCard.tsx` — the connect card (QR + not-detected states)
- `frontend/lib/signInModal.tsx` — site-wide sign-in modal so gated actions resume in place
- `frontend/components/ConnectWalletButton.tsx` — the dumb button that opens the modal

---

## The two details that make it "smooth"

1. **Pre-cache the WalletConnect pairing URI.** Right after init, store the `wc:` URI in a ref/state.
   Mobile deep links MUST fire synchronously inside the click handler — you cannot `await` a pairing URI
   first, because mobile browsers block custom-scheme navigations that happen after a promise resolves.
2. **Resolve identity from the mirror node, not the wallet.** Once you have an account id (`0.0.x`), fetch
   the Hedera mirror node for the real `evm_address` and HBAR balance. Fall back to a synthesized
   long-zero address if the account has no EVM alias yet. The wallet is never asked for this.

Everything else below is what keeps it reliable across StrictMode, refreshes, network switches, and
stale WalletConnect state.

---

## Reusable prompt

Paste this into any capable coding model to reproduce the setup in a fresh Next.js dApp.

```
You are integrating HashPack wallet login into a Next.js (App Router) + TypeScript + Tailwind dApp
on Hedera, using HashConnect v3 (WalletConnect v2 under the hood). Build it as a single React
context provider that owns the entire wallet lifecycle, plus a reusable Connect button and sign-in
modal. Prioritize reliability on BOTH desktop (browser extension) and mobile (deep link / QR),
and make failure states actionable rather than infinite spinners.

## Dependencies & env
- Deps: `hashconnect@3`, `@hashgraph/sdk`.
- Env var: `NEXT_PUBLIC_WC_PROJECT_ID` (WalletConnect Cloud project id). If missing, surface a clear
  error in the UI instead of throwing.
- Network is derived from a single source of truth (e.g. chainId 295 = mainnet, else testnet).

## Core architecture: one provider, one shared client
Create `HashpackWalletProvider` (React context) exposing:
`{ hashconnect, accountId, address (0x EVM), balanceTinybar, isReady, isConnected, isConnecting,
   error, notDetected, network, pairingUri, connect(), disconnect(), refreshAccountData() }`.
Expose a `useHashpackWallet()` hook that throws if used outside the provider.

Hard requirements (these are the things that make it "smooth"):

1. Single, module-level HashConnect instance. Cache the client in a module-scoped variable keyed
   by `${network}:${projectId}`, guarded by a shared init promise so React StrictMode double-mounts,
   re-renders, and network switches never create duplicate clients. Provide a `forceFresh` path that
   nulls the cache.

2. Lazy-import the SDKs inside the init function (`await import("hashconnect")`,
   `await import("@hashgraph/sdk")`) so they stay out of the main bundle and never run on the server.

3. Initialize once on mount: create client -> `hc.init()` -> register `pairingEvent` and
   `disconnectionEvent` listeners. Wrap the bootstrap (dynamic import + `hc.init()`) in a ~12s
   timeout as a UI deadline. If it never settles, set `error` + `isReady` — never leave the UI on
   "Loading wallet…". Keep the in-flight HashConnect; if it later resolves, attach listeners then.
   Do not start a second WalletConnect init against the same storage. Before registering, remove
   any previously registered listeners (store handler refs in a ref) to prevent duplicate handlers.
   On unmount, unregister them.

4. Session restore without a prompt. On mount, read a persisted session from localStorage
   (`{network, accountId, address}`) and optimistically set state so the UI shows "connected" instantly.
   Also check `hc.connectedAccountIds` after init and rehydrate from there. Persist the session in the
   pairing handler; clear it on disconnect.

5. Resolve identity from the mirror node, not the wallet. After you get an `accountId` (0.0.x),
   fetch `https://{mainnet|testnet}.mirrornode.hedera.com/api/v1/accounts/{accountId}` to get the real
   `evm_address` and HBAR `balance.balance` (tinybar). If the account has no EVM alias yet, synthesize a
   long-zero address from the accountId as a fallback. Normalize accountIds out of CAIP-style strings
   (split on ":" and match /^\d+\.\d+\.\d+$/).

6. Pre-cache the pairing URI. Right after init, call the client's pairing-string getter and store
   the `wc:` URI in both state and a ref. This is critical: mobile deep links MUST fire synchronously
   inside the click handler — you cannot `await` a pairing URI first, because mobile browsers block
   custom-scheme navigations that happen after a promise resolves.

7. connect() flow (single-flight, guarded by a ref):
   - Ensure a client exists (await the init promise; if it failed with a transient pairing
     error, try a fresh client with cleared storage). A hung/timed-out relay init must reuse
     the in-flight client — do not wipe-and-retry.
   - If already connected, no-op.
   - Get the pre-cached `wc:` URI (or generate one).
   - Mobile only: fire `hashpack://wc?uri=${encodeURIComponent(pairingUri)}` with `window.location.href`,
     synchronously in the click handler. Do **not** open that scheme on desktop. Chrome has no
     `hashpack://` handler, so `window.open(deeplink, "_self")` shows "Failed to launch … scheme does
     not have a registered handler" and can unload the page before the extension handshake, which
     makes WalletConnect pairing time out. try/catch does not catch that — it is not a JS exception.
   - Desktop: pair through the HashPack extension relay. Call `findLocalWallets()` (posts
     `hashconnect-query-extension`) and `connectToExtension()` (posts `hashconnect-connect-extension`
     with the pairing URI). Both exist on the HashConnect instance at runtime (typed private).
     If the extension never answers, the ~6s `notDetected` state is the fallback (install link + QR).
     Do not fall back to `hashpack://` on desktop.
   - Framed HashPack dApp browser: no deep link; re-send the iframe pairing request.
   - Desktop: race the `pairingEvent` against a ~6s timeout. If nothing responds, set
     `notDetected = true` (HashPack likely not installed) — DO NOT spin forever. Keep the pairing
     listener registered so a late approval still connects.
   - Mobile: wait up to ~120s for the pairing event (user is approving in the app), then reject on timeout.
   - The pairing handler is what resolves the pending connect() promise (store the resolver in a ref and
     call it only after address/balance are fully set, so `isConnected` is true by the time callers await).

8. Resilient storage hygiene. WalletConnect leaves stale pairings that cause
   "Record was recently deleted" init errors. Before init, prune expired/inactive entries from
   `wc@2:core:0.3//pairing`. On init failure, wipe all keys matching
   [`hashconnect`, `hashpack`, `walletconnect`, `wc@`, `wc:`, your app prefix] from local+session storage
   and retry with a fresh client. Do NOT wipe-and-retry a hung/timed-out relay init — that just
   doubles the spinner.

9. disconnect() calls `hc.disconnect()` then clears wallet + connector storage and resets state.

## UI layer (keep it dumb; provider owns logic)
- `ConnectWalletButton`: opens a site-wide sign-in modal via context; disabled while loading
  (`!isReady && !error`) or `isConnecting`; label reflects state ("Loading wallet…" /
  "Connecting…" / "Connect wallet"). An init `error` must never keep the button on "Loading wallet…".
- `SignInCard` inside the modal:
  - Primary "Continue with HashPack" button calls `connect()`. Debounce rapid taps (~300ms).
  - On mobile, fire the deep link synchronously in the handler using the cached `pairingUri`.
  - Show a QR code (qrcode.react) of the `pairingUri` + a copy-pairing-string fallback for
    desktop-to-mobile pairing.
  - When `notDetected` is true, show an actionable panel: "HashPack not detected" + an
    "Install HashPack ->" link (https://www.hashpack.app/download) + "Connect via QR code instead".
  - Surface `error` inline.
- A `SignInModalProvider` context so any gated action can call `openSignIn()` and resume in place
  (fire an `onConnected` callback once `isConnected` flips true) instead of navigating to a /signin page.

## Signing & auth semantics
- Message signing uses `hashconnect.signMessages(accountId, message)` with a plain string.
  HashConnect 3 wraps that string and returns `SignerSignature[]` (`signature` is raw bytes),
  not a hex string and not `{ signedMessages }`. Do not pass `[message]` — `Buffer.from` on that
  array signs a single `0x00` byte.
- The wallet signs the HIP-820 payload `\x19Hedera Signed Message:\n` + `message.length` + message
  with the account's ED25519 or ECDSA key. Verify that on the server with the mirror-node public
  key. `ethers.verifyMessage` expects an Ethereum personal_sign and will reject it.
- For a plain "prove wallet ownership" login you generally DON'T need an on-chain transaction — a signed
  message (or just the paired accountId + mirror-resolved EVM address) is enough. Only prompt a wallet
  signature when you actually need it; never require signing just to open a page.

## Gotchas to bake in (learned the hard way)
- StrictMode/double-mount -> shared client + listener de-dup or you get double pairings.
- Deep links must be synchronous in the click handler (pre-cache the URI).
- Always have a short desktop "not detected" timeout; never an infinite "Connecting…".
- Always have a HashConnect init timeout; never an infinite "Loading wallet…".
- Read `NEXT_PUBLIC_WC_PROJECT_ID` as the literal `process.env.NEXT_PUBLIC_WC_PROJECT_ID` so Next.js
  inlines it into the client bundle. Passing `process.env` into a helper leaves the id empty at runtime.
- Mirror node, not the wallet, is the source of truth for EVM address + balance; fall back to long-zero.
- Persist/restore session so refreshes don't re-prompt.
- Prune stale WalletConnect pairings before init.
- HashPack 15 approves with `sessionProperties.alias = wallet.nickname || null`.
  WalletConnect rejects a null alias (`Received: null for key alias`) and HashPack
  then deletes the proposal (`Proposal not found` on retry). The dApp proposal
  does not carry alias — set a non-empty wallet nickname in HashPack. Do not send
  `https://hashpop.io/...` as the WalletConnect icon; the extension CSP blocks it.
  Use the inline `data:` icon from `hashpackDappMetadata.ts`.

Deliver: the provider file, the `useHashpackWallet` hook, `ConnectWalletButton`, `SignInCard`
(with QR + not-detected states), and wire the provider near the root of the app tree.
```
