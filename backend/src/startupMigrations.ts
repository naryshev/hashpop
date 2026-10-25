import { spawnSync } from "child_process";

/**
 * Migrations that already existed before the updatedAt backfill
 * (20261025_reset_repolled_listing_updated_at) and the db-push drift
 * migration. Hard-coded on purpose: a directory listing would mark the
 * backfill applied and skip its UPDATE.
 */
export const BASELINE_MIGRATIONS = [
  "0_baseline",
  "20260324_add_tx_hash",
  "20260506_add_listing_location",
  "20260508_add_offer",
  "20260923_listing_moderation",
] as const;

/**
 * Columns those five migrations create. Extras from later schema changes are fine.
 * Prisma 7 `migrate diff --from-migrations` needs a shadow database, and pointing
 * that shadow at production can drop the schema, so boot checks these columns
 * through the existing pg pool instead.
 */
export const BASELINE_REQUIRED_COLUMNS: Record<string, readonly string[]> = {
  Listing: [
    "id",
    "seller",
    "price",
    "status",
    "requireEscrow",
    "txHash",
    "city",
    "locationLat",
    "locationLng",
    "trackingNumber",
    "updatedAt",
    "moderationStatus",
    "moderationReason",
    "moderationNote",
  ],
  Sale: ["id", "txHash", "listingId", "buyer"],
  Offer: ["id", "listingId", "buyer", "amount", "status", "txHash"],
  User: ["id", "address"],
  Auction: ["id", "seller"],
  Bid: ["id", "auctionId"],
  Rating: ["id", "saleId"],
  Message: ["id", "body"],
  WishlistItem: ["id", "userAddress", "itemId"],
};

export type MigrationLog = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

export type SqlQuery = (sql: string, params?: unknown[]) => Promise<Array<Record<string, unknown>>>;

export type PrismaRun = (args: string[]) => { stdout: string; stderr: string };

export class CommandFailed extends Error {
  stdout: string;
  stderr: string;
  status: number | null;

  constructor(message: string, stdout: string, stderr: string, status: number | null) {
    super(message);
    this.name = "CommandFailed";
    this.stdout = stdout;
    this.stderr = stderr;
    this.status = status;
  }
}

export function execPrisma(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): { stdout: string; stderr: string } {
  const result = spawnSync("npx", ["prisma", ...args], {
    cwd,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (result.status !== 0) {
    throw new CommandFailed(
      stderr || stdout || result.error?.message || `prisma ${args.join(" ")} failed`,
      stdout,
      stderr,
      result.status,
    );
  }
  return { stdout, stderr };
}

export function commandOutput(err: unknown): string {
  if (err instanceof CommandFailed) {
    return [
      `exit ${err.status ?? "?"}`,
      err.message,
      err.stdout ? `stdout:\n${err.stdout}` : "",
      err.stderr ? `stderr:\n${err.stderr}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export function prismaErrorCode(text: string): string | null {
  const match = text.match(/\bP\d{4}\b/);
  return match ? match[0] : null;
}

export function shouldAttemptBaseline(opts: {
  errorText: string;
  historyExists: boolean;
  missingBaseline: readonly string[];
}): boolean {
  if (opts.missingBaseline.length === 0) return false;
  if (opts.errorText.includes("P3005")) return true;
  return opts.historyExists;
}

function asBool(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1;
}

async function readMigrationHistory(
  query: SqlQuery,
): Promise<{ historyExists: boolean; applied: Set<string> }> {
  const present = await query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
     ) AS present`,
  );
  const historyExists = asBool(present[0]?.present);
  if (!historyExists) return { historyExists: false, applied: new Set() };
  const rows = await query(
    `SELECT migration_name FROM "_prisma_migrations"
     WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
  );
  return {
    historyExists: true,
    applied: new Set(rows.map((row) => String(row.migration_name))),
  };
}

async function missingBaselineColumns(query: SqlQuery): Promise<string[]> {
  const tables = Object.keys(BASELINE_REQUIRED_COLUMNS);
  const rows = await query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [tables],
  );
  const have = new Set(rows.map((row) => `${row.table_name}.${row.column_name}`));
  const missing: string[] = [];
  for (const [table, columns] of Object.entries(BASELINE_REQUIRED_COLUMNS)) {
    for (const column of columns) {
      const key = `${table}.${column}`;
      if (!have.has(key)) missing.push(key);
    }
  }
  return missing;
}

export async function runStartupMigrations(opts: {
  cwd: string;
  env: NodeJS.ProcessEnv;
  log: MigrationLog;
  query: SqlQuery;
  run?: PrismaRun;
}): Promise<void> {
  const run = opts.run ?? ((args: string[]) => execPrisma(args, opts.cwd, opts.env));
  try {
    opts.log.info("Applying pending database migrations…");
    try {
      const applied = run(["migrate", "deploy"]);
      opts.log.info("Database migrations applied");
      const detail = applied.stdout.trim();
      if (detail) opts.log.info(detail);
      return;
    } catch (err) {
      const text = commandOutput(err);
      const code = prismaErrorCode(text);
      opts.log.warn(`Migration failed${code ? ` (${code})` : ""} — stdout and stderr follow`);
      opts.log.warn(text);
      await baselineAndRetry(opts.log, opts.query, run, text);
    }
  } catch (err) {
    opts.log.error(
      `Migration baseline aborted: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function baselineAndRetry(
  log: MigrationLog,
  query: SqlQuery,
  run: PrismaRun,
  errorText: string,
): Promise<void> {
  const history = await readMigrationHistory(query);
  const missing = BASELINE_MIGRATIONS.filter((name) => !history.applied.has(name));
  if (
    !shouldAttemptBaseline({
      errorText,
      historyExists: history.historyExists,
      missingBaseline: missing,
    })
  ) {
    log.warn("Migration failed and no safe baseline was attempted");
    return;
  }

  const missingColumns = await missingBaselineColumns(query);
  if (missingColumns.length > 0) {
    log.error(
      `Refusing to baseline: database schema does not match the pre-backfill migrations. Missing: ${missingColumns.join(", ")}. Later migrations were not marked applied.`,
    );
    return;
  }

  log.info(
    "Database schema matches the pre-backfill migrations. Baselining only that hardcoded history so later migrations still run.",
  );
  for (const name of missing) {
    log.info(`Baselining migration ${name} as applied`);
    run(["migrate", "resolve", "--applied", name]);
  }
  log.info("Retrying prisma migrate deploy for migrations that were not baselined");
  try {
    const applied = run(["migrate", "deploy"]);
    log.info("Database migrations applied");
    const detail = applied.stdout.trim();
    if (detail) log.info(detail);
  } catch (err) {
    const text = commandOutput(err);
    const code = prismaErrorCode(text);
    log.warn(`Migration retry failed${code ? ` (${code})` : ""}. Not baselining again.`);
    log.warn(text);
  }
}
