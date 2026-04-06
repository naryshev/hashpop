# Superpowers Brainstorm Notes - Hedera Marketplace Reliability

## Scope validated

- Primary objective: stabilize core buy/sell flows before adding advanced modules.
- Target environment: Hedera Testnet + HashPack (WalletConnect) with mirror-node indexing.
- Success criterion: listing lifecycle (`create -> edit -> buy -> escrow -> complete`) works reliably under transient network failure.

## Socratic requirement checks

1. How do we prevent "hanging" transactions?
   - Add receipt timeout + fallback checks; return deterministic UI states.
2. How do we prove wallet communication is healthy?
   - Trace connect/sign/send lifecycle and classify retryable vs terminal errors.
3. How do we guarantee edit listing consistency?
   - Emit `PriceUpdated` on-chain; indexer consumes event to keep DB in sync.
4. How do we make buy/sell idempotent and atomic?
   - Keep state transitions contract-driven, guard duplicate escrow creation, and reject stale-price buys.
5. How do we avoid regressions while fixing?
   - Enforce RED-GREEN-REFACTOR tests for contract interactions and build checks for backend/frontend.

## Design decisions (core)

- Event-driven source of truth for mutable listing data (price updates).
- Defense-in-depth for writes:
  - retry for transient wallet/session failures,
  - timeout for receipt waits,
  - explicit user-facing error mapping.
- Keep low fees by:
  - minimizing on-chain writes (only needed state),
  - performing heavy read/sync logic off-chain via indexer/mirror node.

## Risks identified

- `Marketplace.authorizeEscrow()` currently cannot succeed due role context mismatch in `Escrow.setMarketplace`.
- Mirror-node-only coverage can miss updates during outages unless fallback checks exist.
- Existing tests had ethers v6 mismatch and were not validating current contract flows.

## Deferred optional modules (after core stability)

- AI recommendations, NFT/HTS enhancements, dispute workflows, analytics dashboards.
