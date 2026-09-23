import type { PrismaClient } from "./generated/prisma/client";

export const ADMIN_ACTIVITY_LIMIT = 100;
const LISTING_UPDATE_MIN_GAP_MS = 2000;
const DEFAULT_STUCK_DAYS = 7;

export type AdminActivityType =
  | "sale"
  | "listing_created"
  | "listing_updated"
  | "offer"
  | "dispute_opened";

export type AdminActivityEvent = {
  type: AdminActivityType;
  at: string;
  listingId?: string | null;
  listingTitle?: string | null;
  actor?: string | null;
  counterparty?: string | null;
  amountHbar?: string | null;
  status?: string | null;
};

export type AdminStats = {
  listings: {
    total: number;
    active: number;
    pending: number;
    sold: number;
    locked: number;
    cancelled: number;
  };
  sales: { count: number; volumeHbar: string };
  users: { count: number };
  deals: { locked: number; openDisputes: number; sold: number; withBuyer: number };
};

export type DealStage = "Offered" | "Locked" | "Meetup" | "Complete" | "Disputed";

export type AdminDeal = {
  listingId: string;
  title: string | null;
  imageUrl: string | null;
  seller: string;
  buyer: string | null;
  amountHbar: string;
  status: string;
  stage: DealStage;
  disputeStatus: string | null;
  disputeOpenedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attentionAt: string;
  ageDays: number;
  stuck: boolean;
};

export function dealStage(row: {
  status?: string | null;
  disputeStatus?: string | null;
  shippedAt?: Date | string | null;
  exchangeConfirmedAt?: Date | string | null;
}): DealStage {
  if (row.disputeStatus === "OPEN") return "Disputed";
  const s = (row.status ?? "").toUpperCase();
  if (s === "SOLD") return "Complete";
  if (s === "LOCKED" && (row.shippedAt || row.exchangeConfirmedAt)) return "Meetup";
  if (s === "LOCKED") return "Locked";
  return "Offered";
}

function weiToHbar(wei: bigint): string {
  if (wei === 0n) return "0";
  const div = 10n ** 18n;
  const whole = wei / div;
  const frac = wei % div;
  const fracStr = frac.toString().padStart(18, "0").slice(0, 18).replace(/0+$/, "") || "0";
  return fracStr === "0" ? whole.toString() : `${whole}.${fracStr}`;
}

function tinybarToHbar(tinybar: bigint): string {
  if (tinybar === 0n) return "0";
  const div = 10n ** 8n;
  const whole = tinybar / div;
  const frac = tinybar % div;
  const fracStr = frac.toString().padStart(8, "0").replace(/0+$/, "") || "0";
  return fracStr === "0" ? whole.toString() : `${whole}.${fracStr}`;
}

/** Match the listings API: long numeric strings are chain units; otherwise HBAR. */
export function adminAmountToHbar(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  const s = String(value).trim();
  if (/^\d+$/.test(s)) {
    const n = BigInt(s);
    if (n >= 10n ** 15n) return weiToHbar(n);
    if (s.length > 8) return tinybarToHbar(n);
  }
  return s;
}

export function adminListingsWhere(q: string, status: string): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const statusNorm = status.trim().toUpperCase();
  const query = q.trim();
  if (statusNorm === "ACTIVE") {
    where.status = "LISTED";
    where.onChainConfirmed = true;
  } else if (statusNorm === "PENDING") {
    where.status = "LISTED";
    where.onChainConfirmed = false;
  } else if (statusNorm) {
    where.status = statusNorm;
  }
  if (query) {
    where.OR = [
      { id: { contains: query } },
      { title: { contains: query, mode: "insensitive" } },
      { seller: { contains: query.toLowerCase() } },
      { buyer: { contains: query.toLowerCase() } },
    ];
  }
  return where;
}

export function mergeAdminEvents(
  events: AdminActivityEvent[],
  limit = ADMIN_ACTIVITY_LIMIT,
): AdminActivityEvent[] {
  const createdAtByListing = new Map<string, number>();
  for (const event of events) {
    if (event.type === "listing_created" && event.listingId) {
      createdAtByListing.set(event.listingId, Date.parse(event.at));
    }
  }
  const filtered = events.filter((event) => {
    if (event.type !== "listing_updated" || !event.listingId) return true;
    const created = createdAtByListing.get(event.listingId);
    if (created == null) return true;
    const updated = Date.parse(event.at);
    if (Number.isNaN(updated) || Number.isNaN(created)) return true;
    return updated - created > LISTING_UPDATE_MIN_GAP_MS;
  });
  return filtered
    .slice()
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, limit);
}

function volumeHbarFromAmounts(amounts: Array<{ amount?: string | null }>): string {
  const volumeTinybar = amounts.reduce((sum, s) => {
    try {
      return sum + BigInt(s.amount || "0");
    } catch {
      return sum;
    }
  }, 0n);
  return (Number(volumeTinybar) / 1e8).toFixed(2);
}

export async function computeAdminStats(prisma: PrismaClient): Promise<AdminStats> {
  const [
    total,
    active,
    pending,
    sold,
    locked,
    cancelled,
    openDisputes,
    withBuyer,
    salesCount,
    salesAgg,
    usersCount,
  ] = await Promise.all([
    prisma.listing.count(),
    prisma.listing.count({ where: { status: "LISTED", onChainConfirmed: true } }),
    prisma.listing.count({ where: { status: "LISTED", onChainConfirmed: false } }),
    prisma.listing.count({ where: { status: "SOLD" } }),
    prisma.listing.count({ where: { status: "LOCKED" } }),
    prisma.listing.count({ where: { status: "CANCELLED" } }),
    prisma.listing.count({ where: { disputeStatus: "OPEN" } }),
    prisma.listing.count({
      where: { buyer: { not: null }, status: { notIn: ["SOLD", "CANCELLED"] } },
    }),
    prisma.sale.count(),
    prisma.sale.findMany({ select: { amount: true } }),
    prisma.user.count(),
  ]);

  return {
    listings: { total, active, pending, sold, locked, cancelled },
    sales: {
      count: salesCount,
      volumeHbar: volumeHbarFromAmounts(salesAgg as { amount?: string }[]),
    },
    users: { count: usersCount },
    deals: { locked, openDisputes, sold, withBuyer },
  };
}

type SaleRow = {
  listingId?: string | null;
  buyer?: string | null;
  seller?: string | null;
  amount?: string | null;
  createdAt: Date;
  listing?: { title?: string | null } | null;
};

type ListingRow = {
  id: string;
  title?: string | null;
  seller?: string | null;
  buyer?: string | null;
  price?: string | null;
  status?: string | null;
  createdAt: Date;
  updatedAt: Date;
  disputeStatus?: string | null;
  disputeOpenedAt?: Date | null;
};

type OfferRow = {
  listingId?: string | null;
  buyer?: string | null;
  amount?: string | null;
  status?: string | null;
  createdAt: Date;
  listing?: { title?: string | null } | null;
};

function iso(d: Date | string): string {
  return new Date(d).toISOString();
}

export async function fetchAdminActivity(
  prisma: PrismaClient,
  opts?: { limit?: number; now?: number },
): Promise<{ events: AdminActivityEvent[] }> {
  const limit = Math.min(Math.max(opts?.limit ?? ADMIN_ACTIVITY_LIMIT, 1), ADMIN_ACTIVITY_LIMIT);
  const listingSelect = {
    id: true,
    title: true,
    seller: true,
    buyer: true,
    price: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    disputeStatus: true,
    disputeOpenedAt: true,
  };

  const [sales, listings, disputed, offers] = await Promise.all([
    prisma.sale.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        listingId: true,
        buyer: true,
        seller: true,
        amount: true,
        createdAt: true,
        listing: { select: { title: true } },
      },
    }) as Promise<SaleRow[]>,
    prisma.listing.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: listingSelect,
    }) as Promise<ListingRow[]>,
    prisma.listing.findMany({
      where: { disputeOpenedAt: { not: null } },
      orderBy: { disputeOpenedAt: "desc" },
      take: limit,
      select: listingSelect,
    }) as Promise<ListingRow[]>,
    prisma.offer.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        listingId: true,
        buyer: true,
        amount: true,
        status: true,
        createdAt: true,
      },
    }) as Promise<OfferRow[]>,
  ]);

  const events: AdminActivityEvent[] = [];

  for (const sale of sales) {
    events.push({
      type: "sale",
      at: iso(sale.createdAt),
      listingId: sale.listingId ?? null,
      listingTitle: sale.listing?.title ?? null,
      actor: sale.buyer ?? null,
      counterparty: sale.seller ?? null,
      amountHbar: adminAmountToHbar(sale.amount),
    });
  }

  for (const listing of listings) {
    events.push({
      type: "listing_created",
      at: iso(listing.createdAt),
      listingId: listing.id,
      listingTitle: listing.title ?? null,
      actor: listing.seller ?? null,
      amountHbar: adminAmountToHbar(listing.price),
      status: listing.status ?? null,
    });
    events.push({
      type: "listing_updated",
      at: iso(listing.updatedAt),
      listingId: listing.id,
      listingTitle: listing.title ?? null,
      actor: listing.seller ?? null,
      status: listing.status ?? null,
    });
  }

  for (const listing of disputed) {
    events.push({
      type: "listing_updated",
      at: iso(listing.updatedAt),
      listingId: listing.id,
      listingTitle: listing.title ?? null,
      actor: listing.seller ?? null,
      status: listing.status ?? null,
    });
    if (listing.disputeOpenedAt) {
      events.push({
        type: "dispute_opened",
        at: iso(listing.disputeOpenedAt),
        listingId: listing.id,
        listingTitle: listing.title ?? null,
        actor: listing.buyer ?? listing.seller ?? null,
        counterparty: listing.seller ?? null,
        status: listing.disputeStatus ?? "OPEN",
      });
    }
  }

  const titleById = new Map<string, string | null>();
  for (const listing of [...listings, ...disputed]) {
    titleById.set(listing.id, listing.title ?? null);
  }
  for (const sale of sales) {
    if (sale.listingId && sale.listing?.title) titleById.set(sale.listingId, sale.listing.title);
  }

  for (const offer of offers) {
    events.push({
      type: "offer",
      at: iso(offer.createdAt),
      listingId: offer.listingId ?? null,
      listingTitle: offer.listing?.title ?? titleById.get(offer.listingId ?? "") ?? null,
      actor: offer.buyer ?? null,
      amountHbar: adminAmountToHbar(offer.amount),
      status: offer.status ?? null,
    });
  }

  return { events: mergeAdminEvents(events, limit) };
}

type DealListingRow = ListingRow & {
  imageUrl?: string | null;
  shippedAt?: Date | null;
  exchangeConfirmedAt?: Date | null;
  sales?: Array<{ amount?: string | null }>;
};

export async function fetchAdminDeals(
  prisma: PrismaClient,
  opts?: { now?: number; stuckDays?: number; stuckOnly?: boolean; limit?: number },
): Promise<{ deals: AdminDeal[] }> {
  const now = opts?.now ?? Date.now();
  const stuckDays = opts?.stuckDays ?? DEFAULT_STUCK_DAYS;
  const limit = Math.min(Math.max(opts?.limit ?? 200, 1), 500);

  const rows = (await prisma.listing.findMany({
    where: {
      OR: [
        { status: "LOCKED" },
        { disputeStatus: "OPEN" },
        { AND: [{ buyer: { not: null } }, { status: { notIn: ["SOLD", "CANCELLED"] } }] },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      imageUrl: true,
      seller: true,
      buyer: true,
      price: true,
      status: true,
      disputeStatus: true,
      disputeOpenedAt: true,
      createdAt: true,
      updatedAt: true,
      shippedAt: true,
      exchangeConfirmedAt: true,
      sales: { orderBy: { createdAt: "desc" }, take: 1, select: { amount: true } },
    },
  })) as DealListingRow[];

  const deals: AdminDeal[] = rows.map((row) => {
    const attentionDate = row.disputeOpenedAt ?? row.updatedAt ?? row.createdAt;
    const attentionMs = new Date(attentionDate).getTime();
    const ageDays = Math.max(0, Math.floor((now - attentionMs) / 86_400_000));
    const needsWatch = row.status === "LOCKED" || row.disputeStatus === "OPEN";
    const saleAmount = row.sales?.[0]?.amount;
    return {
      listingId: row.id,
      title: row.title ?? null,
      imageUrl: row.imageUrl ?? null,
      seller: row.seller ?? "",
      buyer: row.buyer ?? null,
      amountHbar: adminAmountToHbar(saleAmount || row.price),
      status: row.status ?? "",
      stage: dealStage(row),
      disputeStatus: row.disputeStatus ?? null,
      disputeOpenedAt: row.disputeOpenedAt ? iso(row.disputeOpenedAt) : null,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
      attentionAt: iso(attentionDate),
      ageDays,
      stuck: needsWatch && ageDays >= stuckDays,
    };
  });

  deals.sort((a, b) => {
    if (a.stuck !== b.stuck) return a.stuck ? -1 : 1;
    return b.ageDays - a.ageDays;
  });

  return { deals: opts?.stuckOnly ? deals.filter((d) => d.stuck) : deals };
}

/** Drop ops-only columns before a listing is returned on a public route. */
export function omitModerationFields<
  T extends {
    moderationStatus?: unknown;
    moderationReason?: unknown;
    moderationNote?: unknown;
  },
>(row: T): Omit<T, "moderationStatus" | "moderationReason" | "moderationNote"> {
  const {
    moderationStatus: _status,
    moderationReason: _reason,
    moderationNote: _note,
    ...rest
  } = row;
  return rest;
}

/** Public feeds omit hidden and removed listings. Chain `status` stays untouched. */
export function visibleListingWhere(where: Record<string, unknown>): Record<string, unknown> {
  return {
    AND: [
      where,
      {
        OR: [{ moderationStatus: null }, { moderationStatus: { notIn: ["HIDDEN", "REMOVED"] } }],
      },
    ],
  };
}

export type TrustListingFilter = "needs_review" | "hidden" | "flagged" | "all";

export function parseTrustListingFilter(raw: string): TrustListingFilter {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (normalized === "hidden") return "hidden";
  if (normalized === "flagged") return "flagged";
  if (normalized === "all") return "all";
  return "needs_review";
}

const OPEN_REASON_CODES = ["PENDING_REVIEW", "FLAGGED", "REPORT"] as const;

/** Live rows still waiting on a decision. Hidden and removed are already acted on. */
export function trustQueueCountWhere(): Record<string, unknown> {
  return {
    moderationStatus: null,
    moderationReason: { in: [...OPEN_REASON_CODES] },
  };
}

export function trustListingsWhere(filter: string, q: string): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const queue = parseTrustListingFilter(filter);
  if (queue === "needs_review") {
    Object.assign(where, trustQueueCountWhere());
  } else if (queue === "flagged") {
    where.moderationReason = "FLAGGED";
  } else if (queue === "hidden") {
    where.moderationStatus = "HIDDEN";
  }
  const query = q.trim();
  if (query) {
    where.OR = [
      { id: { contains: query } },
      { title: { contains: query, mode: "insensitive" } },
      { seller: { contains: query.toLowerCase() } },
    ];
  }
  return where;
}

export type ModerationAction = "hide" | "flag" | "clear" | "remove";

export type ModerationPatch = {
  moderationStatus: string | null;
  moderationReason: string | null;
  moderationNote: string | null;
};

function moderationNoteText(reason: string | null | undefined): string | null {
  const trimmed = (reason ?? "").trim().slice(0, 500);
  return trimmed || null;
}

function keptVisibility(currentStatus: string | null | undefined): string | null {
  const status = (currentStatus ?? "").toUpperCase();
  if (status === "HIDDEN" || status === "REMOVED") return status;
  return null;
}

/**
 * Visibility lives on moderationStatus (null live, HIDDEN, REMOVED).
 * The reason column is a code, never the hide-sheet note.
 */
export function moderationPatch(
  action: ModerationAction,
  reason?: string | null,
  currentStatus?: string | null,
): ModerationPatch {
  if (action === "clear") {
    return { moderationStatus: null, moderationReason: null, moderationNote: null };
  }
  if (action === "flag") {
    return {
      moderationStatus: keptVisibility(currentStatus),
      moderationReason: "FLAGGED",
      moderationNote: null,
    };
  }
  if (action === "remove") {
    return { moderationStatus: "REMOVED", moderationReason: "MANUAL", moderationNote: null };
  }
  return {
    moderationStatus: "HIDDEN",
    moderationReason: "MANUAL",
    moderationNote: moderationNoteText(reason),
  };
}

export type TrustListingRow = {
  id: string;
  title: string | null;
  imageUrl: string | null;
  seller: string;
  status: string;
  onChainConfirmed: boolean;
  disputeStatus: string | null;
  moderationStatus: string | null;
  moderationReason: string | null;
  updatedAt: string;
};

type TrustListingDbRow = {
  id: string;
  title?: string | null;
  imageUrl?: string | null;
  seller?: string | null;
  status?: string | null;
  onChainConfirmed?: boolean | null;
  disputeStatus?: string | null;
  moderationStatus?: string | null;
  moderationReason?: string | null;
  updatedAt: Date | string;
};

export function toTrustListingRow(row: TrustListingDbRow): TrustListingRow {
  return {
    id: row.id,
    title: row.title ?? null,
    imageUrl: row.imageUrl ?? null,
    seller: row.seller ?? "",
    status: row.status ?? "",
    onChainConfirmed: !!row.onChainConfirmed,
    disputeStatus: row.disputeStatus ?? null,
    moderationStatus: row.moderationStatus ?? null,
    moderationReason: row.moderationReason ?? null,
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export async function fetchTrustQueue(
  prisma: PrismaClient,
  opts?: { filter?: string; q?: string },
): Promise<{
  listings: TrustListingRow[];
  counts: { listings: number; users: number; disputes: number };
}> {
  const where = trustListingsWhere(opts?.filter ?? "", opts?.q ?? "");
  const [rows, flagged] = await Promise.all([
    prisma.listing.findMany({
      where: where as never,
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: {
        id: true,
        title: true,
        imageUrl: true,
        seller: true,
        status: true,
        onChainConfirmed: true,
        disputeStatus: true,
        moderationStatus: true,
        moderationReason: true,
        updatedAt: true,
      },
    }) as Promise<TrustListingDbRow[]>,
    prisma.listing.count({ where: trustQueueCountWhere() as never }),
  ]);
  return {
    listings: rows.map(toTrustListingRow),
    // Users (2b) and disputes (2c) stay empty in this slice.
    counts: { listings: flagged, users: 0, disputes: 0 },
  };
}
