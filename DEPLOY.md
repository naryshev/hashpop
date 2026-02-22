# Deploy to Vercel + Backend (Beta v1)

This guide gets hbay live so testers can use it at a Vercel URL.

## Architecture

| Part | Where it runs | Notes |
|------|----------------|--------|
| **Frontend** | **Vercel** | Next.js; Vercel builds and serves it. |
| **Backend** | **Railway / Render / Fly.io** (your choice) | Express + Prisma; needs a long-running process. Vercel does not run Express. |
| **Database** | **Neon / Supabase / Railway Postgres** | Hosted PostgreSQL. Backend connects via `DATABASE_URL`. |
| **Contracts** | **Hedera testnet** (already deployed) | Same addresses in frontend + backend env. |

---

## Get the backend running (with Neon)

Use this when you already have a Neon database and want to run the backend locally or on a server.

### 1. Get your Neon connection string

- Go to [Neon Console](https://console.neon.tech) → your project → **Connection details**.
- Copy the connection string (e.g. `postgres://user:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require`).  
- Neon often shows a “Pooled” and “Direct” URL; either works. Prefer **Pooled** for server/backend.

### 2. Create `backend/.env`

From the repo root:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and set at least:

```env
# Required: your Neon connection string (use the one from step 1)
DATABASE_URL=postgres://USER:PASSWORD@HOST/DBNAME?sslmode=require

# Required for the API to work (from npm run deploy:testnet)
MARKETPLACE_ADDRESS=0x...
ESCROW_ADDRESS=0x...
AUCTION_HOUSE_ADDRESS=0x...

# Optional: defaults are fine for local
PORT=4000
MIRROR_URL=https://testnet.mirrornode.hedera.com
LOG_LEVEL=info
```

If you only want to run the backend and hit `/health` and `/api/listings`, you can leave the contract addresses as placeholders; the indexer and listing sync will need the real addresses later.

### 3. Install dependencies and set up the database

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
```

- `prisma generate` – generates the Prisma client.  
- `prisma migrate deploy` – applies existing migrations to your Neon database (creates tables).  
- If this is a brand‑new DB and you get “no migrations,” run once: `npx prisma migrate dev --name init` (then use `migrate deploy` for future runs).

### 4. Wipe the marketplace (fresh reset)

To delete **all** listings, auctions, bids, sales, and wishlist items:

```bash
cd backend
npm run clear-listings
```

The indexer’s “last processed” state is stored in `backend/.indexer-state.json` and is **not** cleared by this script. After a wipe, restarting the backend will **not** re-create old listings from the chain; only new on-chain events are indexed.

Or wipe and leave the DB empty for manual listing creation:

```bash
npm run db:seed
```

(Seed is currently wipe-only; add listings via the app or extend `prisma/seed.ts`.)

### 5. Start the backend

**Development (with auto-reload):**

```bash
npm run dev
```

**Production (build then run):**

```bash
npm run build
npm start
```

The API will listen on `http://localhost:4000` (or the `PORT` in `.env`).

### 5. Check that it’s running

```bash
curl http://localhost:4000/health
```

You should get JSON like: `{"ok":true,"timestamp":"..."}`.

Then try:

```bash
curl http://localhost:4000/api/listings
```

You should get `{"listings":[],"auctions":[]}` until you have data.

### 6. Run the frontend against this backend

In the frontend `.env.local` set:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Then from the repo root:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` – the app will use your local backend and Neon database.

---

## Linking S3 or R2 for images

Listing images and media are stored either on the backend server (disk) or in **S3-compatible storage** (e.g. AWS S3 or Cloudflare R2). You link a bucket by setting env vars in **`backend/.env`**.

### Where to configure

| What | Where |
|------|--------|
| **Env vars** | `backend/.env` (see `backend/.env.example`) |
| **Code** | `backend/src/storage.ts` — uploads to S3 when vars are set; otherwise writes to disk |

### Env vars (all in `backend/.env`)

Set these **together** to enable S3/R2 (if any are missing, uploads fall back to local disk):

| Variable | Description |
|----------|-------------|
| `S3_BUCKET` | Bucket name |
| `S3_PUBLIC_URL` | Base URL for public access (e.g. `https://your-bucket.s3.region.amazonaws.com` or your R2 public URL) |
| `S3_ACCESS_KEY_ID` | Access key |
| `S3_SECRET_ACCESS_KEY` | Secret key |
| `S3_REGION` | Region (e.g. `us-east-1`; for R2 use `auto`) |
| `S3_ENDPOINT` | Optional. For **Cloudflare R2** set to `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |

- **AWS S3**: Create a bucket, enable public read if you want direct image URLs, or use a CDN. Set `S3_PUBLIC_URL` to the bucket URL or CDN base (no trailing slash).
- **Cloudflare R2**: Create bucket → R2 → API Tokens → Create API token. Use endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, region `auto`, and a public URL (e.g. custom domain or R2 dev subdomain).

After setting env vars, restart the backend. New uploads will go to the bucket and the API will return URLs under `S3_PUBLIC_URL`.

---

## Beta v1 readiness checklist

### Already in good shape
- [x] Frontend: Next.js build passes; Suspense for `useSearchParams`; hydration fixes; `getApiUrl()` for LAN/Vercel.
- [x] Backend: CORS allows `*.vercel.app` and configurable `CORS_ORIGIN`; Dockerfile for backend.
- [x] API: Public `GET /api/listings`; no per-wallet filtering.
- [x] Env examples: `frontend/.env.example`, `backend/.env.example` document required vars.

### Before first deploy
- [ ] Contracts deployed to Hedera testnet and addresses in env (see README).
- [ ] WalletConnect Project ID in frontend env (for HashPack / Connect wallet).
- [ ] Relayer wallet (optional): if you want ED25519 buy/bid, set `RELAYER_PRIVATE_KEY` and keep that wallet funded on testnet.

**Seller-editable price:** The Marketplace contract includes `updateListingPrice` so sellers can change the listing price when editing. If you use an older deployment that doesn’t have this function, redeploy Marketplace and set `NEXT_PUBLIC_MARKETPLACE_ADDRESS` and backend `MARKETPLACE_ADDRESS` to the new contract; otherwise editing price only updates the database and the buy-now amount stays the old on-chain price.

### After deploy (verify)
- [ ] Frontend at `https://your-app.vercel.app` loads and shows listings.
- [ ] Connect wallet works (injected or WalletConnect).
- [ ] Create listing → confirm in wallet → listing appears on marketplace.
- [ ] Listing page: buy now or place bid works; images load (from backend URL).
- [ ] Dashboard and wishlist work when wallet connected.

---

## Step-by-step deployment

### 1. Backend + database

**1a. Create a Postgres database**

- **Neon**: [neon.tech](https://neon.tech) → Create project → copy connection string (e.g. `postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`).
- **Supabase**: [supabase.com](https://supabase.com) → New project → Settings → Database → connection string.
- **Railway**: [railway.app](https://railway.app) → New project → Add PostgreSQL → copy `DATABASE_URL`.

**1b. Run migrations**

From your machine (with `DATABASE_URL` pointing at the hosted DB):

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

(Optional) Seed or create one listing via the app later.

**1c. Deploy the backend**

- **Railway**: New project → Add service → “Deploy from GitHub” (backend folder) or “Dockerfile” and point at `backend/`. Add env vars (see table below). Set root to `backend` if repo is monorepo.
- **Render**: New → Web Service → connect repo → root directory `backend`, build `npm install && npm run build`, start `node dist/index.js`. Add env vars.
- **Fly.io**: `fly launch` in `backend` (with Dockerfile), set env via `fly secrets set`.

Backend env vars:

| Variable | Required | Example / notes |
|----------|----------|------------------|
| `DATABASE_URL` | Yes | `postgres://...` from Neon/Supabase/Railway |
| `PORT` | No | Default 4000 |
| `CORS_ORIGIN` | Yes for Vercel | `https://your-app.vercel.app` (or comma-separated with preview URL) |
| `MARKETPLACE_ADDRESS` | Yes | From `npm run deploy:testnet` |
| `ESCROW_ADDRESS` | Yes | From deploy |
| `AUCTION_HOUSE_ADDRESS` | Yes | From deploy |
| `MIRROR_URL` | No | `https://testnet.mirrornode.hedera.com` |
| `HEDERA_RPC_URL` | No | `https://testnet.hashio.io/api` |
| `RELAYER_PRIVATE_KEY` | Optional | ECDSA key (no 0x) for ED25519 relay |
| `LOG_LEVEL` | No | `info` |
| **S3 (optional)** | No | See [Linking S3 or R2 for images](#linking-s3-or-r2-for-images) below. Set `S3_BUCKET`, `S3_PUBLIC_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` (and `S3_ENDPOINT` for R2) so listing images are stored in a bucket instead of local disk. |

After deploy, note the backend URL (e.g. `https://your-backend.railway.app`).

**Uploads:** By default the backend stores images in `./uploads`. On Railway/Render/Fly the filesystem is often ephemeral, so uploads can be lost on restart. To persist images, link an S3 or R2 bucket — see **[Linking S3 or R2 for images](#linking-s3-or-r2-for-images)** above.

---

### 2. Frontend on Vercel

**2a. Push repo and import in Vercel**

- Push the repo to GitHub (if not already).
- [vercel.com](https://vercel.com) → Add New Project → import repo.
- **Root Directory**: set to `frontend` (so Vercel builds the Next app).
- Framework: Next.js (auto-detected).

**2b. Environment variables (Vercel project settings)**

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | Your backend URL, e.g. `https://your-backend.railway.app` (no trailing slash) |
| `NEXT_PUBLIC_HEDERA_RPC` | `https://testnet.hashio.io/api` |
| `NEXT_PUBLIC_MARKETPLACE_ADDRESS` | Same as backend |
| `NEXT_PUBLIC_ESCROW_ADDRESS` | Same as backend (for escrow panel: mark shipped / confirm receipt) |
| `NEXT_PUBLIC_AUCTION_HOUSE_ADDRESS` | Same as backend |
| `NEXT_PUBLIC_WC_PROJECT_ID` | WalletConnect Cloud project ID |

**2c. Deploy**

- Deploy. Vercel will build and publish the frontend.
- Your app will be at `https://your-app.vercel.app` (or your custom domain).

---

### 3. CORS and final checks

- Backend `CORS_ORIGIN` must include the exact Vercel URL testers use (e.g. `https://your-app.vercel.app`). Preview deployments use `*.vercel.app`, which the backend already allows.
- If you use a custom domain on Vercel, add it to `CORS_ORIGIN` (comma-separated).

Then:

1. Open the Vercel URL and confirm the homepage loads and shows “No listings” or existing listings.
2. Connect wallet (e.g. HashPack) and create a listing; confirm it appears.
3. Open a listing and confirm images load (they’re served from the backend URL).
4. Test buy now or place bid once to confirm flow.

---

## Optional: `vercel.json` (frontend)

Only if you need redirects or headers. For a standard Next app you often don’t need this.

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

Vercel detects Next.js automatically, so this is optional.

---

## Summary: “Is everything good for beta v1?”

| Area | Status |
|------|--------|
| Frontend build & run | Ready (build passes, env via `getApiUrl()` and `NEXT_PUBLIC_*`) |
| Backend API & CORS | Ready (Vercel + LAN origins supported) |
| DB & migrations | You run `prisma migrate deploy` against hosted DB |
| Contracts | You ensure testnet addresses in both frontend and backend env |
| WalletConnect | Set `NEXT_PUBLIC_WC_PROJECT_ID` for Connect wallet |
| Uploads | Backend disk; fine for beta; plan S3/volume for production later |
| Relayer (ED25519) | Optional; set `RELAYER_PRIVATE_KEY` if you want that flow |

Once backend and DB are deployed and env is set, pushing the frontend to Vercel and setting `NEXT_PUBLIC_API_URL` (and other vars) is enough for testers to use the app at the Vercel link.
