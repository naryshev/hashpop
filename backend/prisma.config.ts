import path from "node:path";
import { config } from "dotenv";

// Load .env from backend directory so migrate works when run from backend/
config({ path: path.join(__dirname, ".env") });

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
    datasource: {
    url: process.env.DATABASE_URL || "postgres://hedera:hedera@localhost:5432/marketplace",
  },
  migrations: {
    path: "prisma/migrations",
    seed: "npx ts-node prisma/seed.ts",
  },
});
