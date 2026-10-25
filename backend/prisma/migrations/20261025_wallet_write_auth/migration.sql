-- Wallet write auth: one-time signature nonces, revocable sessions, and the audit log.
-- Additive and idempotent so a database that already has these tables (db push)
-- can still apply the migration.

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
    "evmAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WalletAuditLog_createdAt_idx" ON "WalletAuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "WalletAuditLog_accountId_idx" ON "WalletAuditLog"("accountId");
