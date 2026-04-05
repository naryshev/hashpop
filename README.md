# Hashpop

A decentralized marketplace built on Hedera, enabling peer-to-peer commerce with native wallet integration, on-chain escrow, and end-to-end encrypted messaging.

## Platform Overview

Hashpop connects buyers and sellers through a trustless, blockchain-backed trading experience. All transactions settle on-chain via smart contracts deployed to the Hedera network, with HashPack wallet serving as the primary authentication and payment layer.

## Key Features

### Marketplace
- **Fixed-price listings** with optional escrow protection
- **Offer system** allowing buyers to negotiate directly with sellers
- **Auction house** with timed bidding and reserve prices
- **2% platform fee** collected via on-chain treasury contract

### Escrow & Settlement
- Smart contract-managed escrow for buyer/seller protection
- Immediate settlement option for trusted transactions
- Shipping confirmation and exchange tracking
- Dispute resolution through contract-level timeouts and refunds

### Wallet-to-Wallet Encrypted Messaging
- End-to-end encrypted chat between any two wallets
- X25519 ECDH key exchange with XSalsa20-Poly1305 encryption (TweetNaCl.js)
- Deterministic keypair derivation from wallet signatures — no key storage required
- Backend stores only ciphertext; server never sees plaintext
- Listing-context threads and general-purpose direct messaging

### Reputation & Ratings
- On-chain verified purchase history
- Post-sale rating system tied to completed transactions
- Seller reputation scores based on completions, refunds, and timeouts

### User Experience
- HashPack wallet authentication (browser extension and mobile deep-link)
- Real-time dashboard with purchase history, active listings, and analytics
- Wishlist tracking for listings and auctions
- Media-rich listings with image and video uploads
- Responsive design optimized for desktop and mobile

## Architecture

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, TailwindCSS |
| Backend | Express, Prisma ORM, PostgreSQL |
| Blockchain | Hedera (Hashgraph), Solidity smart contracts |
| Wallet | HashPack via HashConnect / WalletConnect |
| Encryption | TweetNaCl.js (X25519 + XSalsa20-Poly1305) |
| Contracts | Marketplace, Escrow, AuctionHouse, Treasury (Hardhat) |
| Indexer | Hedera Mirror Node event sync |

## Project Structure

```
frontend/    Next.js application
backend/     Express API server, Prisma schema, event indexer
contracts/   Solidity smart contracts (Hardhat)
```

## Deployment

See `DEPLOY.md` for production deployment instructions.

## License

Proprietary. All rights reserved.
