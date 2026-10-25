# Hashpop Deployment Guide (Vercel + Hosted Backend)

This project is best deployed as:

- **Frontend:** Vercel (`frontend/`)
- **Backend:** Railway / Render / Fly (`backend/`)
- **Database:** Hosted PostgreSQL (Neon/Supabase/Railway/etc)

> The backend is an Express server with indexer/background behavior; that is why it should run on a long-running Node host.

## 1) Required Accounts / Keys

### Hedera

- Hedera Testnet account (deployer)
- Private key for deployer (`HEDERA_TESTNET_OPERATOR`)
- Test HBAR for gas

### WalletConnect / Reown

- Project ID for wallet sessions (`NEXT_PUBLIC_WC_PROJECT_ID`)

### Database

- PostgreSQL connection string (`DATABASE_URL`)

## 2) Deploy Contracts First

From repo root:

```bash
npm install
npm run compile
npm run deploy:testnet
```

Save contract addresses from deploy output:

- `MARKETPLACE_ADDRESS`
- `ESCROW_ADDRESS`

## 3) Backend Deployment (Railway/Render/Fly)

Deploy `backend/` as a Node service.

### Backend env variables

Set these in your backend hosting provider:

```env
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DB?sslmode=require
MARKETPLACE_ADDRESS=0x...
ESCROW_ADDRESS=0x...
HEDERA_RPC_URL=https://testnet.hashio.io/api
MIRROR_URL=https://testnet.mirrornode.hedera.com
PORT=4000
LOG_LEVEL=info
CORS_ORIGIN=https://your-frontend.vercel.app
RELAYER_PRIVATE_KEY=
```

Optional media storage:

```env
S3_BUCKET=
S3_PUBLIC_URL=
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_ENDPOINT=
```

### Backend build/start

- Build command: `npm install && npm run build`
- Start command: `npm start`, which is `node dist/index.js`

Do not start the process with `prisma db push`, and do not pass `--accept-data-loss`. `db push` copies `schema.prisma` onto the database without recording a migration, and it can drop columns. The server applies `prisma migrate deploy` itself, before it listens.

`backend/prisma/migrations/migration_lock.toml` has to be in the image. Without it, deploy cannot open the migration directory.

On startup `backend/src/index.ts`:

1. Logs `Applying pending database migrations…`.
2. Runs `prisma migrate deploy`. The failure log includes the exit status, stdout, stderr, and the Prisma code such as `P3005`.
3. A database created by `db push` has tables and no `_prisma_migrations` rows, so deploy fails with `P3005`. The process then checks that the tables and columns from the five historical migrations are present (`Listing.txHash`, location columns, `Offer`, moderation columns, and the original tables). If any of those are missing, it logs `Refusing to baseline` and does not mark anything applied.
4. When the schema matches, it runs `prisma migrate resolve --applied` only for historical migrations that are not already recorded: `0_baseline`, `20260324_add_tx_hash`, `20260506_add_listing_location`, `20260508_add_offer`, `20260923_listing_moderation`. Later migrations are not marked applied. That includes `20261025_sync_schema_from_db_push` and, when that file is in the image, `20261025_reset_repolled_listing_updated_at`.
5. Runs `prisma migrate deploy` again. Only those later migrations execute. On a database `db push` already synced, the schema migration uses `IF NOT EXISTS` and changes nothing. The `updatedAt = createdAt` backfill runs once and is recorded, so a later boot does not run it again.
6. Logs `Database migrations applied`, then starts the HTTP server, indexer, and settlement loop.

A database that already has `_prisma_migrations` but is missing some of those five names gets `resolve --applied` for the missing names only, after the same schema check.

You can still run the same commands by hand against a database you own:

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
```

## 4) Frontend Deployment (Vercel)

Create a Vercel project with:

- **Root Directory:** `frontend`
- Framework: Next.js (auto)

### Frontend env variables (Vercel)

```env
NEXT_PUBLIC_API_URL=https://your-backend-domain.com
NEXT_PUBLIC_HEDERA_RPC=https://testnet.hashio.io/api
NEXT_PUBLIC_MARKETPLACE_ADDRESS=0x...
NEXT_PUBLIC_ESCROW_ADDRESS=0x...
# Optional. Admin → Contracts still displays an already-deployed AuctionHouse.
NEXT_PUBLIC_AUCTION_HOUSE_ADDRESS=0x...
NEXT_PUBLIC_WC_PROJECT_ID=your_project_id
NEXT_PUBLIC_HASHPACK_EXTENSION_ONLY=false
NEXT_PUBLIC_APP_URL=https://your-frontend.vercel.app
NEXT_PUBLIC_HBAR_USD=
NEXT_PUBLIC_FEATURE_OFFERS=true
NEXT_PUBLIC_FEATURE_MESSAGING_HCS_SEAM=true
NEXT_PUBLIC_FEATURE_RATINGS=true
```

## 5) Root `.env` for Contract Scripts

Keep these local for deploy/maintenance scripts:

```env
HEDERA_TESTNET_OPERATOR=your_private_key_without_0x
PRIVATE_KEY=your_private_key_without_0x
HEDERA_TESTNET_RPC=https://testnet.hashio.io/api
PLATFORM_FEE_BPS=300
```

## 6) Database Provider Recommendations

Any PostgreSQL provider is supported. Good options:

- Neon (recommended for speed/ease)
- Supabase Postgres
- Railway Postgres
- Render Postgres
- AWS RDS Postgres

If provider gives pooled and direct URLs, use pooled URL for runtime and SSL-enabled config.

## 7) Post-Deploy Checklist

- Frontend loads from Vercel URL
- Wallet connect works (HashPack)
- Create listing works
- Non-escrow purchases settle immediately with 2% fee
- Escrow-required purchases go to LOCKED and require escrow completion
- Dashboard/messages/purchases pages load with backend data
