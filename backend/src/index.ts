import "dotenv/config";
import path from "path";
import fs from "fs";
import express from "express";
import pino from "pino";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { startIndexer } from "./indexer";
import { apiRouter } from "./api";
import { relayRouter } from "./relay";

const app = express();
const uploadsDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });
const log = pino({ level: process.env.LOG_LEVEL || "info" });

const connectionString = process.env.DATABASE_URL || "postgres://hedera:hedera@localhost:5432/marketplace";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Allow multiple origins: local dev (localhost, 127.0.0.1, LAN IPs like 192.168.x.x) and Vercel.
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
  : ["http://localhost:3000", "http://127.0.0.1:3000"];

function isLocalNetworkOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (host.startsWith("192.168.") || host.startsWith("10.")) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

function getAllowedOrigin(origin: string | undefined): string | null {
  if (!origin) return corsOrigins[0] ?? null;
  if (corsOrigins.includes(origin)) return origin;
  if (corsOrigins.some((o) => o === "*")) return origin;
  if (origin.endsWith(".vercel.app")) return origin;
  if (isLocalNetworkOrigin(origin)) return origin;
  return null;
}

app.use((req, res, next) => {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));
app.use("/api", apiRouter(prisma, log, uploadsDir));
app.use("/api/relay", relayRouter(log));

app.get("/health", (_, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  log.info({ port }, "Backend server started");
  startIndexer(prisma, log).catch((err) => log.error({ err }, "Indexer failed"));
});
