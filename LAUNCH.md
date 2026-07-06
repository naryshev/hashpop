# Hashpop — Mainnet Launch Runbook

Work through this top to bottom. Steps A1/A2 are dashboard-only (nobody else
can do them); everything else is copy-paste.

## A. One-time dashboard tasks

1. **Rotate the Neon database password.** A live connection string was
   committed in `backend/.env.example`. Rotate it in the Neon console, put the
   new `DATABASE_URL` **only** in Railway, and leave a placeholder in the
   example file.
2. **Vercel → Settings → Build and Deployment → Node.js Version → 24.x.**
3. Merge the launch PR so `main` has EscrowV2, the settlement engine, the
   shipping-address gate + encryption, the cart, and the reconciler purge.

## B. Mainnet accounts (real HBAR)

Create three **separate** ECDSA accounts:

| Account   | Funding | Purpose                                                   | Custody             |
| --------- | ------- | --------------------------------------------------------- | ------------------- |
| Deployer  | ~50 ℏ   | Deploys contracts; holds `DEFAULT_ADMIN_ROLE` + pauser    | Cold after launch   |
| Arbiter   | ~20 ℏ   | Settlement engine key (`ESCROW_ARBITER_KEY` on Railway)   | Server env var      |
| Relayer   | ~20 ℏ   | ED25519 relay signer (`RELAYER_PRIVATE_KEY`)              | Server env var      |

Set low-balance alerts on arbiter + relayer — if they run dry, automatic
settlements silently stop.

## C. Deploy the contracts

```bash
PLATFORM_FEE_BPS=300 ARBITER_ADDRESS=<arbiter evm address> \
HEDERA_TESTNET_OPERATOR=<deployer private key> \
npx hardhat run deploy/deploy-v2.ts --network hederaMainnet
```

Deploys EscrowV2 + Treasury + Reputation + Marketplace + AuctionHouse, wires
the completion callback and grants the arbiter. Copy the printed addresses.

Before deploying with real funds:

- Re-run `npx hardhat test` with solc pinned to **0.8.20** (the suite was
  developed against 0.8.26 in a sandbox; same `^0.8.20` pragmas, but deploy
  what you tested).
- Strongly consider a third-party review of `contracts/core/EscrowV2.sol`.

## D. Backend env (Railway)

```
HEDERA_RPC_URL=https://mainnet.hashio.io/api
MIRROR_URL=https://mainnet.mirrornode.hedera.com
MARKETPLACE_ADDRESS=<from step C>
ESCROW_ADDRESS=<from step C>
AUCTION_HOUSE_ADDRESS=<from step C>
ESCROW_V2=true
ESCROW_ARBITER_KEY=<arbiter private key>
SHIPPING_ADDRESS_KEY=<openssl rand -hex 32>   # checkout returns 503 without it
RELAYER_ACCOUNT_ID=<mainnet relayer account id>
RELAYER_PRIVATE_KEY=<relayer private key>
ADMIN_ADDRESSES=<comma-separated admin wallets for /area51>
CORS_ORIGIN=https://hashpop.io,https://www.hashpop.io
DATABASE_URL=<rotated Neon URL>
```

Then push the schema (adds the encrypted ShippingAddress table):

```bash
cd backend && npx prisma db push
```

## E. Frontend env (Vercel)

```
NEXT_PUBLIC_HEDERA_NETWORK=mainnet
NEXT_PUBLIC_MARKETPLACE_ADDRESS=<from step C>
NEXT_PUBLIC_ESCROW_ADDRESS=<from step C>
NEXT_PUBLIC_AUCTION_HOUSE_ADDRESS=<from step C>
NEXT_PUBLIC_ESCROW_V2=true
NEXT_PUBLIC_API_URL=<railway backend url>
```

`NEXT_PUBLIC_HEDERA_NETWORK=mainnet` flips everything at once: chain id 295,
mainnet Hashio relay, mainnet mirror node, HashScan links, and HashConnect
`LedgerId.MAINNET`. Real HashPack wallets pair with no further changes.

## F. Data cutover

Automatic. Once the backend boots against the mainnet contract, the indexer's
reconciler purges every testnet listing (they all read NONE on the new
contract): phantom unconfirmed rows within minutes, previously-confirmed rows
via the rotating recheck (two consecutive NONE reads before deletion). Sales
history is preserved. For an instantly clean start, truncate the listings
table in Neon before first boot instead.

## G. Launch-day smoke test (~5 ℏ, two wallets)

1. List an item → add to cart → checkout: shipping-address form → wallet
   signature → escrow funded (check HashScan).
2. Seller enters tracking → within ~1 minute the arbiter's `markShipped`
   lands on-chain (settlement engine log + HashScan).
3. Buyer taps **Got it — release now** → seller receives funds.
4. Second order left untouched: status line shows correct dates;
   `resolveTimeout` reverts "Not timed out".
5. A no-escrow purchase settles instantly; an offer escrows and cancels with
   refund; `/area51` rejects a non-admin wallet.

## Order of operations

Rotate Neon creds → deploy contracts → Railway env + `db push` → Vercel env →
smoke test.
