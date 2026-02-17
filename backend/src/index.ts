import "dotenv/config";
import express from "express";
import pino from "pino";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { startIndexer } from "./indexer";
import { apiRouter } from "./api";
import { relayRouter } from "./relay";

const app = express();
const log = pino({ level: process.env.LOG_LEVEL || "info" });

const connectionString = process.env.DATABASE_URL || "postgres://hedera:hedera@localhost:5432/marketplace";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

app.use(express.json());
app.use("/api", apiRouter(prisma, log));
app.use("/api/relay", relayRouter(log));

app.get("/health", (_, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  log.info({ port }, "Backend server started");
  startIndexer(prisma, log).catch((err) => log.error({ err }, "Indexer failed"));
});
