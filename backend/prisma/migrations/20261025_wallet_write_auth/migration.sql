-- Wallet write auth: nonces, revocable sessions, and the audit log.
--
-- Prod currently creates tables with `prisma db push` because `migrate deploy`
-- has no baseline (#126 removes db push). This migration sorts after
-- 20261025_reset_repolled_listing_updated_at and must succeed either on a
-- fresh database or after db push has already created these tables.

CREATE TABLE IF NOT EXISTS "AuthNonce" (
    "nonce" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthNonce_pkey" PRIMARY KEY ("nonce")
);

CREATE INDEX IF NOT EXISTS "AuthNonce_expiresAt_idx" ON "AuthNonce"("expiresAt");

CREATE TABLE IF NOT EXISTS "WalletSession" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WalletSession_expiresAt_idx" ON "WalletSession"("expiresAt");
CREATE INDEX IF NOT EXISTS "WalletSession_accountId_idx" ON "WalletSession"("accountId");

CREATE TABLE IF NOT EXISTS "WalletAuditLog" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "resourceId" TEXT,
    "accountId" TEXT NOT NULL,
    "evmAddress" TEXT,
    "accountVerified" BOOLEAN NOT NULL DEFAULT false,
    "outcome" TEXT NOT NULL DEFAULT 'allowed',
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletAuditLog_pkey" PRIMARY KEY ("id")
);

-- An earlier db push may have created WalletAuditLog without the attribution columns.
ALTER TABLE "WalletAuditLog" ADD COLUMN IF NOT EXISTS "resourceId" TEXT;
ALTER TABLE "WalletAuditLog" ADD COLUMN IF NOT EXISTS "evmAddress" TEXT;
ALTER TABLE "WalletAuditLog" ADD COLUMN IF NOT EXISTS "accountVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WalletAuditLog" ADD COLUMN IF NOT EXISTS "outcome" TEXT;
ALTER TABLE "WalletAuditLog" ADD COLUMN IF NOT EXISTS "ip" TEXT;
ALTER TABLE "WalletAuditLog" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

ALTER TABLE "WalletAuditLog" ALTER COLUMN "evmAddress" DROP NOT NULL;

UPDATE "WalletAuditLog" SET "outcome" = 'allowed' WHERE "outcome" IS NULL;
UPDATE "WalletAuditLog" SET "accountVerified" = false WHERE "accountVerified" IS NULL;

-- No foreign keys or enums. Guard the NOT NULL flip the same way a later
-- constraint would be guarded, so a second deploy is a no-op.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'WalletAuditLog'
      AND column_name = 'outcome'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE "WalletAuditLog" ALTER COLUMN "outcome" SET NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WalletAuditLog_pkey'
  ) THEN
    ALTER TABLE "WalletAuditLog" ADD CONSTRAINT "WalletAuditLog_pkey" PRIMARY KEY ("id");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "WalletAuditLog_createdAt_idx" ON "WalletAuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "WalletAuditLog_accountId_idx" ON "WalletAuditLog"("accountId");
CREATE INDEX IF NOT EXISTS "WalletAuditLog_outcome_idx" ON "WalletAuditLog"("outcome");
