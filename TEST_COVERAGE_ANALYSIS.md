# Test Coverage Analysis

## Current State

The codebase has a single test file — `contracts/test/Marketplace.test.ts` (219 lines, 12 tests) — covering only the `Marketplace` smart contract. Everything else is untested.

| Layer           | Source files          | Lines of code | Tests                       |
| --------------- | --------------------- | ------------- | --------------------------- |
| Smart contracts | 7 core + 3 interfaces | ~971          | 12 tests (Marketplace only) |
| Backend         | 8 modules             | ~2,589        | 0                           |
| Frontend        | ~75 files             | ~8,549        | 0                           |
| **Total**       | **~90 files**         | **~12,109**   | **12 tests**                |

Estimated coverage: **< 2%**

---

## Priority Areas for Improvement

### 1. Smart Contracts — Missing contracts (HIGH)

The existing Marketplace tests are a good baseline. Three other contracts with meaningful logic have zero coverage:

#### `AuctionHouse.sol` (244 lines) — **highest priority**

The auction contract is the most complex untested contract. Key scenarios to cover:

- **Happy path**: `createAuction` → `placeBid` (multiple bidders) → `settleAuction` → escrow/shipment/receipt flow
- **Anti-sniping extension**: bid placed in the last 5 minutes should extend `endTime` by `EXTENSION_WINDOW`
- **Minimum bid increment**: a new bid below `currentBid + 5%` should revert with `"Bid too low"`
- **Outbid refund**: the previous highest bidder's funds should be credited and withdrawable via `withdrawRefund`
- **Reserve price**: bidding below reserve price should revert
- **Settlement with no bids**: `settleAuction` should revert with `"No bids"`
- **Fee split**: verify treasury receives `platformFeeBps` of the winning bid and escrow receives the remainder
- **Pause/unpause**: `createAuction` and `placeBid` should revert when paused

#### `Escrow.sol` (195 lines) — **high priority**

Only the happy-path receipt confirmation is indirectly exercised by the Marketplace tests. Untested paths:

- **Timeout — seller silent**: `resolveTimeout` called after 7 days with state `AWAITING_SHIPMENT` should refund buyer
- **Timeout — buyer silent**: `resolveTimeout` called after 7 days with state `AWAITING_CONFIRMATION` should pay seller
- **Early timeout call**: `resolveTimeout` before deadline should revert with `"Not timed out"`
- **Double completion**: calling `confirmReceipt` on a `COMPLETE` escrow should revert
- **Access control on `createEscrow`**: a non-marketplace caller should revert
- **`confirmShipment` by non-seller**: should revert with `"Not seller"`

#### `Reputation.sol` (100 lines) — **medium priority**

- `getReputationScore` returns 50 for new users (zero sales)
- Score after a mix of completions, refunds, and timeouts — verify the formula `(successfulCompletions * 100 / totalSales) - (timeouts * 10)`
- Score floors at 0, not underflow
- `recordSale`/`recordRefund`/`recordTimeout` access-controlled to `DEFAULT_ADMIN_ROLE`

---

### 2. Backend API — No tests at all (HIGH)

`backend/src/api/index.ts` is 1,715 lines with no test framework configured. The following endpoint groups carry the most risk:

#### Financial / state-changing endpoints

These touch on-chain state or escrow and are the most critical to get right:

- **`POST /relay`** — submits signed transactions to the chain. Tests should verify that unsigned or tampered payloads are rejected and that the ED25519 signature check cannot be bypassed.
- **Offer acceptance / rejection flow** — ensure database state is updated atomically with on-chain calls and that partial failures are handled.

#### Data integrity endpoints

- **Listing CRUD** — create, update, cancel. Verify that only the listing owner can mutate their listing, and that invalid inputs (missing fields, wrong types) return 400 not 500.
- **Image upload** — verify file-type validation, size limits, and that the S3 URL is stored correctly.

#### A practical starting point

Add [Vitest](https://vitest.dev/) (zero-config for TypeScript) or Jest with `supertest` for HTTP-level integration tests. Mock Prisma with `jest-mock-extended` or `prisma-mock`. A sample skeleton:

```ts
// backend/src/api/__tests__/listings.test.ts
import request from "supertest";
import app from "../index";

describe("POST /listings", () => {
  it("returns 400 when price is missing", async () => {
    const res = await request(app).post("/listings").send({ title: "hat" });
    expect(res.status).toBe(400);
  });
});
```

---

### 3. Frontend Utilities — Pure functions are easy wins (MEDIUM)

Several `lib/` files contain pure or near-pure logic that can be unit-tested without a browser or wallet:

| File                      | What to test                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `lib/formatPrice.ts`      | Edge cases: 0, very large numbers, decimal rounding                                         |
| `lib/formatDate.ts`       | Relative/absolute formatting, timezone handling                                             |
| `lib/bytes32.ts`          | Round-trip encode/decode, padding, truncation                                               |
| `lib/transactionError.ts` | All known revert strings map to user-friendly messages; unknown errors fall back gracefully |
| `lib/categories.ts`       | Category list is non-empty, slugs are unique                                                |

These require no mocking and are the cheapest tests to write. Adding Vitest to the frontend takes one `npm install` and a `vitest.config.ts`.

---

### 4. Frontend Hooks — Contract interaction logic (MEDIUM)

`hooks/useHashpackContractWrite.ts` (279 lines) and `hooks/useRobustContractWrite.ts` orchestrate the on-chain write flow, retry logic, and error surfacing. This logic is easy to get wrong silently.

Recommended approach: mock the wallet provider (`hashpackWallet`) and contract client, then test:

- Successful transaction emits the correct event / updates state
- Wallet not connected returns an appropriate error state rather than throwing
- Retry logic (in `useRobustContractWrite`) caps at the expected number of attempts
- Gas estimation failure surfaces a user-readable message

Use Vitest + React Testing Library. Keep tests in `hooks/__tests__/`.

---

### 5. Backend Indexer & Relay (MEDIUM)

`indexer/decoder.ts` (144 lines) decodes raw ABI-encoded events from the Hedera Mirror API. This is pure transformation logic — ideal for unit tests with fixture JSON that mirrors the real Mirror API response format.

`relay/index.ts` (181 lines) signs and submits transactions. Tests should verify:

- Correct ED25519 key is selected per environment
- Nonce/sequence number is incremented correctly across concurrent calls
- Network errors trigger retries with backoff, not silent failures

---

## Recommended Setup Steps

1. **Smart contracts**: run `npx hardhat coverage` — it is already supported by the Hardhat toolchain. Add it to CI.
2. **Backend**: `npm install -D vitest @vitest/coverage-v8 supertest` in `backend/`. Add `"test": "vitest"` to `package.json`.
3. **Frontend**: `npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event jsdom` in `frontend/`. Add a `vitest.config.ts` pointing at `jsdom`.
4. **CI gate**: add a coverage threshold (e.g. 60% for contracts, 50% for backend) to fail the build on regressions once initial coverage is in place.

---

## Summary

| Area                                   | Effort                       | Risk if untested            | Recommended first test                |
| -------------------------------------- | ---------------------------- | --------------------------- | ------------------------------------- |
| `AuctionHouse.sol`                     | Low (Hardhat already set up) | HIGH — funds at risk        | Anti-sniping + bid increment          |
| `Escrow.sol` timeout paths             | Low                          | HIGH — funds locked forever | `resolveTimeout` both branches        |
| Backend relay endpoint                 | Medium                       | HIGH — signed tx bypass     | Invalid signature → 401               |
| `lib/formatPrice` + `transactionError` | Very low                     | Low                         | Pure function round-trips             |
| Frontend hooks                         | Medium                       | Medium                      | Wallet-not-connected error state      |
| `indexer/decoder.ts`                   | Low                          | Medium                      | Known event fixture → expected struct |
