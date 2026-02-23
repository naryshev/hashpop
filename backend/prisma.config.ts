import path from "node:path";
import { config } from "dotenv";

// Load .env from backend directory so migrate works when run from backend/
config({ path: path.join(__dirname, ".env") });

import { defineConfig } from "prisma/config";

// Avoid pg SSL warning: prefer sslmode=verify-full for Neon and other SSL URLs
let dbUrl = process.env.DATABASE_URL || "postgres://hedera:hedera@localhost:5432/marketplace";
if (dbUrl.includes("sslmode=require") && !dbUrl.includes("sslmode=verify-full")) {
  dbUrl = dbUrl.replace("sslmode=require", "sslmode=verify-full");
} else if (dbUrl.includes("neon.tech") && !dbUrl.includes("sslmode=")) {
  dbUrl += (dbUrl.includes("?") ? "&" : "?") + "sslmode=verify-full";
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: dbUrl,
  },
  migrations: {
    path: "prisma/migrations",
    seed: "npx ts-node prisma/seed.ts",
  },
});
