# hbay (v1)

Production-ready decentralized marketplace on Hedera Hashgraph. Replicates core eBay functionality with trustless escrow, English auctions, and immutable reputation.

## 🎯 Product Goal

Build a decentralized commerce marketplace where every sale, bid, and settlement is finalized on-chain using HBAR. Platform never custodies funds. All transactions are transparent and verifiable.

## 📁 Project Structure

```
hbay/
├── contracts/
│   ├── core/
│   │   ├── Marketplace.sol      # Fixed-price listings
│   │   ├── AuctionHouse.sol     # English auctions
│   │   ├── Escrow.sol           # Buyer protection
│   │   ├── Reputation.sol      # Immutable reputation
│   │   ├── Treasury.sol         # Platform fees
│   │   └── Roles.sol            # Access control
│   ├── interfaces/
│   └── test/
├── frontend/                    # Next.js 14 App Router
│   ├── app/
│   │   ├── marketplace/
│   │   ├── listing/[id]/
│   │   ├── create/
│   │   ├── dashboard/
│   │   └── profile/[address]/
│   ├── components/
│   ├── hooks/
│   └── lib/
├── backend/                     # Node.js + Prisma
│   ├── src/
│   │   ├── indexer/            # Mirror Node indexer
│   │   ├── api/                # REST API
│   │   └── mirror/             # Mirror Node client
│   └── prisma/
├── deploy/                      # Deployment scripts
└── hardhat.config.ts
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Hardhat
- Docker & Docker Compose
- PostgreSQL (or use Docker)
- Hedera testnet account with HBAR

---

## 📋 Runbook: What You Need & Where to Get It

### 1. Hedera testnet wallet (deploy contracts + pay gas)

| What | Where | What you get |
|------|--------|----------------|
| **Wallet + test HBAR** | [Portal (Hedera)](https://portal.hedera.com/register) | Create account → get **Account ID** and **Private Key** (or use HashPack and export key). |
| **Test HBAR (faucet)** | [Hedera Faucet](https://portal.hedera.com/faucet) or [HashPack Faucet](https://www.hashpack.app/faucet) | Free testnet HBAR for gas. |

- **Private key**: Used as `PRIVATE_KEY` in root `.env` for deploying contracts.  
- **Format**: 64 hex chars, no `0x` (e.g. `a1b2c3...`). If your wallet shows `0x...`, strip the `0x`.  
- **Never commit this key or use a mainnet key on testnet.**

### 2. WalletConnect (optional, for “Connect wallet” in the frontend)

| What | Where | What you get |
|------|--------|----------------|
| **Project ID** | [WalletConnect Cloud](https://cloud.walletconnect.com/) → Sign up → Create Project | **Project ID** (string like `a1b2c3d4...`). |

- Used as `NEXT_PUBLIC_WC_PROJECT_ID` in `frontend/.env.local`.  
- Without it, “Connect wallet” may still work with injected (e.g. HashPack) but WalletConnect won’t.

### 3. No signup required

- **Hedera RPC**: `https://testnet.hashio.io/api` (public, no key).  
- **Mirror Node**: `https://testnet.mirrornode.hedera.com` (public, no key).  
- **PostgreSQL**: Use Docker (no signup) or your own DB; only need `DATABASE_URL`.

---

### Order of operations to run the app

1. **Sign up / get keys**  
   - Hedera Portal (wallet + test HBAR).  
   - (Optional) WalletConnect Cloud → Project ID.

2. **Install deps** (root, frontend, backend).  
3. **Add env files** (see below) using the keys/IDs above.  
4. **Deploy contracts** → get `MARKETPLACE_ADDRESS` and `AUCTION_HOUSE_ADDRESS`.  
5. **Put contract addresses** into frontend and backend env.  
6. **Database**: run migrations (or start Docker).  
7. **Run**: backend + frontend (or `docker compose up`).

---

### 1. Install Dependencies

```bash
# Root (Hardhat)
npm install

# Frontend
cd frontend && npm install

# Backend
cd ../backend && npm install
```

### 2. Configure Environment

Create `.env` in root:

```env
PRIVATE_KEY=your_private_key
HEDERA_TESTNET_RPC=https://testnet.hashio.io/api
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_HEDERA_RPC=https://testnet.hashio.io/api
NEXT_PUBLIC_MARKETPLACE_ADDRESS=0x...
NEXT_PUBLIC_AUCTION_HOUSE_ADDRESS=0x...
NEXT_PUBLIC_WC_PROJECT_ID=your_walletconnect_project_id
```

Create `backend/.env`:

```env
DATABASE_URL=postgres://hedera:hedera@localhost:5432/marketplace
MIRROR_URL=https://testnet.mirrornode.hedera.com
MARKETPLACE_ADDRESS=0x...
AUCTION_HOUSE_ADDRESS=0x...
```

**Where each value comes from:**

| Env variable | Source |
|--------------|--------|
| `PRIVATE_KEY` (root `.env`) | Hedera Portal wallet — export private key (64 hex, no `0x`) |
| `NEXT_PUBLIC_WC_PROJECT_ID` | WalletConnect Cloud → your project’s Project ID |
| `MARKETPLACE_ADDRESS` / `AUCTION_HOUSE_ADDRESS` / `ESCROW_ADDRESS` | Output of `npm run deploy:testnet` (paste into frontend and backend env) |
| `RELAYER_PRIVATE_KEY` | Optional. Any ECDSA testnet wallet with HBAR; used to relay ED25519 buy/bid txs. |

### 3. Deploy Contracts

```bash
# Compile
npm run compile

# Deploy to testnet
npm run deploy:testnet

# Verify (optional)
npm run verify
```

### 4. Setup Database

```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

### 5. Run Stack

```bash
# Start all services
docker compose up --build

# Or run individually:
# Backend: cd backend && npm run dev
# Frontend: cd frontend && npm run dev
```

## 🔐 ED25519 (non-EVM) accounts

Users with **ED25519** HashPack accounts (default when you create a new wallet) can still buy and bid using **HIP-632** signature verification and a **relayer**:

1. **Contracts**: `buyNowWithED25519`, `confirmReceiptWithED25519`, and `placeBidWithED25519` verify an ED25519 signature on-chain via Hedera’s system contract at `0x167`, then run the same logic as the ECDSA path.
2. **Backend relay**: Set `RELAYER_PRIVATE_KEY` and `ESCROW_ADDRESS` in `backend/.env`. The relayer wallet (ECDSA) must hold testnet HBAR; it submits the tx and pays the value on behalf of the ED25519 user.
3. **Frontend**: On listing and bid panels, expand **“Use ED25519 account (HashPack)”**. Enter your Hedera account ID (`0.0.XXXXX`) or EVM alias (`0x...`), sign the shown message hash in HashPack, paste the signature, and submit. The relay sends the tx.

- **Frontend env**: `NEXT_PUBLIC_API_URL=http://localhost:4000` (or your backend URL) so the app can call `/api/relay/buy` and `/api/relay/place-bid`.
- **Account alias**: If the mirror node has an EVM alias for your account, the backend resolves it via `GET /api/relay/account-alias?accountId=0.0.XXXXX`. Otherwise use your EVM alias (e.g. from HashPack) directly.

## 🔒 Security Features

- **ReentrancyGuard**: All state-changing functions protected
- **Checks-Effects-Interactions**: Safe execution order
- **Pull Payments**: No push payments to untrusted addresses
- **Pausable**: Circuit breaker for emergencies
- **Access Control**: Role-based permissions
- **Escrow Timeouts**: Automatic resolution after 7 days

## 📊 Contract State Machines

### Marketplace Listing
```
NONE → LISTED → LOCKED → COMPLETED | CANCELLED
```

### Escrow
```
AWAITING_SHIPMENT → AWAITING_CONFIRMATION → COMPLETE
```

### Auction
```
CREATED → ACTIVE → ENDED → SETTLED → ESCROW
```

## 🧪 Testing

```bash
# Run Hardhat tests
npm test

# Run specific test file
npx hardhat test contracts/test/Marketplace.test.ts
```

## 📝 API Endpoints

- `GET /health` - Health check
- `GET /api/listings` - List active listings
- `GET /api/user/:address` - Get user stats and reputation

## 🔮 V2 Roadmap (Excluded from v1)

- [ ] NFT support (ERC-721 / HTS NFTs)
- [ ] HTS token payments
- [ ] DAO governance
- [ ] Messaging system
- [ ] Shipping label integration
- [ ] Cross-chain support

## 🛠️ Development

### Contract Development

```bash
# Compile contracts
npm run compile

# Run tests
npm test

# Deploy to local node (if running)
npx hardhat node
npm run deploy:testnet --network localhost
```

### Frontend Development

```bash
cd frontend
npm run dev
# Open http://localhost:3000
```

### Backend Development

```bash
cd backend
npm run dev
# API available at http://localhost:4000
```

## 📚 Documentation

- [Hedera EVM Docs](https://docs.hedera.com/hedera/smart-contracts/)
- [Hardhat Docs](https://hardhat.org/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [Wagmi Docs](https://wagmi.sh)

## ⚠️ Production Checklist

Before mainnet deployment:

- [ ] Complete security audit (Slither, Mythril, etc.)
- [ ] Test all edge cases
- [ ] Load test indexer
- [ ] Set up monitoring and alerts
- [ ] Configure backup strategies
- [ ] Document incident response procedures
- [ ] Set appropriate fee parameters
- [ ] Configure admin keys securely

## 📄 License

MIT

---

**hbay — Built for Hedera Hashgraph. Trustless. Non-custodial. Production-ready.**
