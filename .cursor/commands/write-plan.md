# Superpowers Execution Plan - Hedera Marketplace

Each task is designed for ~2-5 minutes and includes verification.

## Phase A - Core reliability (must pass before feature expansion)

### Task A1 (done): Price update event propagation

- Files:
  - `contracts/core/Marketplace.sol`
  - `backend/src/indexer/decoder.ts`
  - `backend/src/indexer/index.ts`
  - `contracts/test/Marketplace.test.ts`
- Code outline:
  - Emit `PriceUpdated(listingId, newPrice)` in `updateListingPrice`.
  - Decode `PriceUpdated` in indexer decoder and update DB price.
  - Add/modernize Hardhat tests for event emission and authorization.
- Verification:
  - `npm test -- contracts/test/Marketplace.test.ts`
  - `npm run build --prefix backend`

### Task A2 (done): Transaction timeout + receipt fallback

- Files:
  - `frontend/hooks/useRobustContractWrite.ts`
  - `frontend/lib/transactionError.ts`
- Code outline:
  - Add timeout wrapper around `waitForTransactionReceipt`.
  - Retry transient wallet/session failures with bounded exponential backoff.
  - Add deterministic timeout error to UI mapper.
- Verification:
  - `npm run lint --prefix frontend`
  - Manual: create/edit listing and observe timeout/error UX when wallet is delayed.

### Task A3 (done): Wallet communication hardening (HashPack/Testnet)

- Files:
  - `frontend/components/WalletButton.tsx`
  - `frontend/lib/wagmiConfig.ts`
  - `frontend/hooks/useRobustContractWrite.ts`
- Code outline:
  - Improve connector/session-expiry handling.
  - Add reconnect guidance for known WalletConnect/IndexedDB failure modes.
- Verification:
  - Manual reconnect cycle: disconnect -> reconnect -> sign tx.
  - Confirm clear user-facing error for rejected/expired requests.

### Task A4 (done): Edit-listing confirmation flow reliability

- Files:
  - `frontend/hooks/useUpdateListingPrice.ts`
  - `frontend/app/listing/[id]/page.tsx`
- Code outline:
  - Keep DB update conditional on confirmed on-chain price update.
  - Add explicit banner for "details saved, price not confirmed in wallet".
- Verification:
  - Manual edit with wallet reject and with wallet approve.
  - Confirm listing page on-chain price and API price converge after approval.

### Task A5 (done): Atomic buy/sell escrow guards

- Files:
  - `contracts/core/Marketplace.sol`
  - `contracts/core/Escrow.sol`
  - `contracts/test/Marketplace.test.ts`
- Code outline:
  - Add tests for stale price, duplicate buy attempts, and locked-state transitions.
  - Ensure escrow creation and listing lock are atomic under revert semantics.
- Verification:
  - `npm test -- contracts/test/Marketplace.test.ts`

## Phase B - Marketplace completeness

### Task B1 (done): Offer system (make/accept/reject/cancel)

- Files:
  - `contracts/core/Marketplace.sol`
  - `contracts/interfaces/IMarketplace.sol`
  - `frontend/components/BidPanel.tsx` (or offer-specific component)
- Code outline:
  - Add offer struct + lifecycle events.
  - Add escrowed offer acceptance path.
- Verification:
  - Contract tests for each state transition and unauthorized actions.

### Task B2 (done): Messaging via HCS integration seam

- Files:
  - `backend/src/api/index.ts`
  - `frontend/app/dashboard/page.tsx`
- Code outline:
  - Define message topic/thread mapping and persistence boundary.
- Verification:
  - Send/receive negotiation message path in dashboard thread.

### Task B3 (done): Ratings after completed sale

- Files:
  - `contracts/core/Reputation.sol`
  - `backend/src/api/index.ts`
  - `frontend/app/profile/[address]/page.tsx`
- Verification:
  - Post-sale rating allowed only after completed escrow.

## Phase C - Deploy + ops polish

### Task C1 (partially done): Testnet deployment and sync checks

- Files:
  - `deploy/deploy.ts`
  - `backend/.env.example`
  - `frontend/.env.example`
- Verification:
  - `npm run deploy:testnet`
  - Mirror node event visibility for create/edit/buy events.

### Task C2 (done): README operational updates

- Files:
  - `README.md`
  - `SETUP.md`
- Required additions:
  - `HEDERA_TESTNET_OPERATOR` and related env guidance
  - faucet/debug tips
  - feature flags/toggles for optional modules
- Verification:
  - Fresh setup dry-run from docs.
