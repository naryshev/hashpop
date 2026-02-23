# Hashpop

Hashpop is a Hedera marketplace for fixed-price sales, offers, escrow, and wallet-native checkout with HashPack.

## Stack

- `frontend/` - Next.js 14 app
- `backend/` - Express + Prisma API and indexer
- `contracts/` - Hardhat Solidity contracts (Marketplace, Escrow, AuctionHouse, Treasury)

## Core Features

- Create listings with optional escrow requirement
- Buy now flow:
  - `requireEscrow=true`: payment locks in escrow
  - `requireEscrow=false`: immediate seller payout minus 2% service fee
- Offer flow with escrow/non-escrow settlement rules
- Purchase history, messages, dashboard, ratings
- Hedera Mirror + RPC sync

## Quick Start (Local)

```bash
npm install
npm install --prefix frontend
npm install --prefix backend
```

1) Configure env files (`.env`, `frontend/.env.local`, `backend/.env`)  
2) Compile and deploy contracts  
3) Run migrations  
4) Start app

```bash
npm run compile
npm run deploy:testnet
npm run db:migrate
npm run dev
```

## Environment Variables

### Root `.env` (deploy scripts)

| Variable | Required | Notes |
|---|---|---|
| `HEDERA_TESTNET_OPERATOR` | Yes | Deployer private key (64 hex, no `0x`) |
| `PRIVATE_KEY` | Optional | Backward-compatible fallback |
| `HEDERA_TESTNET_RPC` | Yes | `https://testnet.hashio.io/api` |
| `PLATFORM_FEE_BPS` | Optional | Contract config for fee-enabled flows |

### Frontend `frontend/.env.local`

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Backend base URL |
| `NEXT_PUBLIC_HEDERA_RPC` | Yes | Hedera RPC URL |
| `NEXT_PUBLIC_MARKETPLACE_ADDRESS` | Yes | Deployed contract address |
| `NEXT_PUBLIC_ESCROW_ADDRESS` | Yes | Deployed contract address |
| `NEXT_PUBLIC_AUCTION_HOUSE_ADDRESS` | Yes | Deployed contract address |
| `NEXT_PUBLIC_WC_PROJECT_ID` | Yes | WalletConnect/Reown project ID |
| `NEXT_PUBLIC_HASHPACK_EXTENSION_ONLY` | Optional | `false` recommended |
| `NEXT_PUBLIC_APP_URL` | Optional | Public frontend URL |
| `NEXT_PUBLIC_HBAR_USD` | Optional | Fixed HBAR/USD override |
| `NEXT_PUBLIC_FEATURE_OFFERS` | Optional | `true/false` |
| `NEXT_PUBLIC_FEATURE_MESSAGING_HCS_SEAM` | Optional | `true/false` |
| `NEXT_PUBLIC_FEATURE_RATINGS` | Optional | `true/false` |

### Backend `backend/.env`

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `MARKETPLACE_ADDRESS` | Yes | Deployed contract address |
| `ESCROW_ADDRESS` | Yes | Deployed contract address |
| `AUCTION_HOUSE_ADDRESS` | Yes | Deployed contract address |
| `HEDERA_RPC_URL` | Yes | Hedera RPC URL |
| `MIRROR_URL` | Yes | `https://testnet.mirrornode.hedera.com` |
| `PORT` | Optional | Defaults to `4000` |
| `CORS_ORIGIN` | Yes for production | Frontend URL(s), comma-separated |
| `RELAYER_PRIVATE_KEY` | Optional | Needed for ED25519 relay flows |
| `LOG_LEVEL` | Optional | e.g. `info` |
| `S3_BUCKET` | Optional | S3/R2 media storage |
| `S3_PUBLIC_URL` | Optional | Public media base URL |
| `S3_REGION` | Optional | `us-east-1` or `auto` for R2 |
| `S3_ACCESS_KEY_ID` | Optional | S3/R2 credential |
| `S3_SECRET_ACCESS_KEY` | Optional | S3/R2 credential |
| `S3_ENDPOINT` | Optional | Required for R2 endpoint |

## Database Options (Backend)

Any PostgreSQL provider works. Recommended:

- Neon (easy serverless Postgres)
- Supabase Postgres
- Railway Postgres
- Render Postgres
- AWS RDS Postgres

Use SSL-enabled URLs for hosted providers (for Neon: include `?sslmode=require`).

Run Prisma:

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
```

## Deployment

Use:

- Frontend on Vercel
- Backend on Railway/Render/Fly (long-running Express process)
- Postgres on Neon/Supabase/Railway/etc

Detailed guide: see `DEPLOY.md`.

## Branding

Project branding is Hashpop with a red -> orange -> blue -> green gradient aesthetic inspired by the provided logo palette.
