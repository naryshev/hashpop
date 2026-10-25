import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  BASELINE_MIGRATIONS,
  CommandFailed,
  commandOutput,
  prismaErrorCode,
  runStartupMigrations,
  shouldAttemptBaseline,
} from "../startupMigrations";

const cwd = "/backend";
const env = { PATH: process.env.PATH ?? "" };

function logCapture() {
  const lines: string[] = [];
  const log = {
    info: (msg: string) => lines.push(`info ${msg}`),
    warn: (msg: string) => lines.push(`warn ${msg}`),
    error: (msg: string) => lines.push(`error ${msg}`),
  };
  return { lines, log };
}

function columnsForBaseline(): Array<Record<string, unknown>> {
  const required: Record<string, string[]> = {
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
  const rows: Array<Record<string, unknown>> = [];
  for (const [table, cols] of Object.entries(required)) {
    for (const column of cols) rows.push({ table_name: table, column_name: column });
  }
  return rows;
}

describe("startup migration baseline", () => {
  it("names the five migrations that existed before the updatedAt backfill and nothing later", () => {
    expect([...BASELINE_MIGRATIONS]).toEqual([
      "0_baseline",
      "20260324_add_tx_hash",
      "20260506_add_listing_location",
      "20260508_add_offer",
      "20260923_listing_moderation",
    ]);
    expect(BASELINE_MIGRATIONS.join(" ")).not.toContain("20261025");
  });

  it("puts stdout, stderr, and P3005 in the failure text", () => {
    const err = new CommandFailed(
      "migrate failed",
      "applying 0 migrations",
      "Error: P3005\n\nThe database schema is not empty.",
      1,
    );
    const text = commandOutput(err);
    expect(text).toContain("stdout:");
    expect(text).toContain("applying 0 migrations");
    expect(text).toContain("stderr:");
    expect(text).toContain("The database schema is not empty.");
    expect(prismaErrorCode(text)).toBe("P3005");
  });

  it("baselines only missing pre-backfill names after P3005 when the schema matches, then deploys again", async () => {
    const { lines, log } = logCapture();
    const commands: string[][] = [];
    let deployAttempts = 0;
    await runStartupMigrations({
      cwd,
      env,
      log,
      query: async (sql) => {
        if (sql.includes("information_schema.tables")) return [{ present: false }];
        if (sql.includes("information_schema.columns")) return columnsForBaseline();
        throw new Error(`unexpected sql ${sql}`);
      },
      run: (args) => {
        commands.push(args);
        if (args[0] === "migrate" && args[1] === "deploy") {
          deployAttempts += 1;
          if (deployAttempts === 1) {
            throw new CommandFailed(
              "failed",
              "",
              "Error: P3005\n\nThe database schema is not empty.",
              1,
            );
          }
          return { stdout: "All migrations have been successfully applied.", stderr: "" };
        }
        return { stdout: `applied ${args.at(-1)}`, stderr: "" };
      },
    });

    expect(lines.join("\n")).toContain("Migration failed (P3005)");
    expect(lines.join("\n")).toContain("P3005");
    expect(lines.join("\n")).toContain("stderr:");
    const resolved = commands.filter((args) => args[1] === "resolve").map((args) => args.at(-1));
    expect(resolved).toEqual([...BASELINE_MIGRATIONS]);
    expect(resolved).not.toContain("20261025_reset_repolled_listing_updated_at");
    expect(commands.filter((args) => args[1] === "deploy")).toHaveLength(2);
    expect(lines.join("\n")).toContain("Database migrations applied");
    expect(lines.join("\n")).toContain("Baselining migration 0_baseline as applied");
  });

  it("resolves only the baseline names missing from _prisma_migrations", async () => {
    const { lines, log } = logCapture();
    const commands: string[][] = [];
    let deployAttempts = 0;
    await runStartupMigrations({
      cwd,
      env,
      log,
      query: async (sql) => {
        if (sql.includes("information_schema.tables")) return [{ present: true }];
        if (sql.includes('FROM "_prisma_migrations"')) {
          return [
            { migration_name: "0_baseline" },
            { migration_name: "20260324_add_tx_hash" },
            { migration_name: "20260506_add_listing_location" },
          ];
        }
        if (sql.includes("information_schema.columns")) return columnsForBaseline();
        throw new Error(`unexpected sql ${sql}`);
      },
      run: (args) => {
        commands.push(args);
        if (args[1] === "deploy") {
          deployAttempts += 1;
          if (deployAttempts === 1) {
            throw new CommandFailed("failed", "", "Error: P3018\nA migration failed to apply.", 1);
          }
        }
        return { stdout: "", stderr: "" };
      },
    });

    const resolved = commands.filter((args) => args[1] === "resolve").map((args) => args.at(-1));
    expect(resolved).toEqual(["20260508_add_offer", "20260923_listing_moderation"]);
    expect(lines.join("\n")).not.toContain("Baselining migration 0_baseline");
  });

  it("does not baseline when the database is missing a column those migrations create", async () => {
    const { lines, log } = logCapture();
    const commands: string[][] = [];
    const rows = columnsForBaseline().filter((row) => row.column_name !== "txHash");
    await runStartupMigrations({
      cwd,
      env,
      log,
      query: async (sql) => {
        if (sql.includes("information_schema.tables")) return [{ present: false }];
        if (sql.includes("information_schema.columns")) return rows;
        throw new Error(`unexpected sql ${sql}`);
      },
      run: (args) => {
        commands.push(args);
        throw new CommandFailed(
          "failed",
          "stdout-marker",
          "Error: P3005\n\nschema is not empty",
          1,
        );
      },
    });

    expect(commands.filter((args) => args[1] === "resolve")).toHaveLength(0);
    expect(commands.filter((args) => args[1] === "deploy")).toHaveLength(1);
    const text = lines.join("\n");
    expect(text).toContain("Refusing to baseline");
    expect(text).toContain("Listing.txHash");
    expect(text).toContain("Sale.txHash");
  });

  it("does not baseline a non-P3005 failure when there is no migration history table", () => {
    expect(
      shouldAttemptBaseline({
        errorText: "Error: P1001\nCan't reach database server",
        historyExists: false,
        missingBaseline: [...BASELINE_MIGRATIONS],
      }),
    ).toBe(false);
  });
});

describe("db-push schema drift migration", () => {
  const sql = readFileSync(
    path.join(__dirname, "../../prisma/migrations/20261025_sync_schema_from_db_push/migration.sql"),
    "utf8",
  );

  it("adds the columns db push was covering, idempotently, and is not a baseline name", () => {
    expect(BASELINE_MIGRATIONS).not.toContain("20261025_sync_schema_from_db_push");
    for (const snippet of [
      'ADD COLUMN IF NOT EXISTS "onChainConfirmed"',
      'ADD COLUMN IF NOT EXISTS "disputeStatus"',
      'ADD COLUMN IF NOT EXISTS "variants"',
      'ADD COLUMN IF NOT EXISTS "publicKey"',
      'ADD COLUMN IF NOT EXISTS "kycStatus"',
      'ADD COLUMN IF NOT EXISTS "encrypted"',
      'CREATE TABLE IF NOT EXISTS "ShippingAddress"',
      'CREATE INDEX IF NOT EXISTS "Sale_listingId_idx"',
      'CREATE INDEX IF NOT EXISTS "Sale_buyer_idx"',
    ]) {
      expect(sql).toContain(snippet);
    }
    expect(sql).not.toMatch(/ADD COLUMN\s+"/);
    expect(sql).not.toContain("20261025_reset_repolled");
  });
});
