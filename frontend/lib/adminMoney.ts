import { dealStageFromRow, type DealStage, type ListingStatusTone } from "./adminFormat";

export const MONEY_PAGE = {
  title: "Money",
  sub: "Escrow and deals that need a release, refund, or look.",
} as const;

export const MONEY_TABS = [
  { id: "deals", label: "Deals" },
  { id: "disputes", label: "Disputes" },
  { id: "released", label: "Released" },
] as const;

export type MoneyTabId = (typeof MONEY_TABS)[number]["id"];

export const MONEY_DEAL_FILTERS = [
  { id: "open", label: "Open" },
  { id: "locked", label: "Locked" },
  { id: "meetup", label: "Meetup" },
  { id: "stuck", label: "Stuck" },
  { id: "all", label: "All" },
] as const;

export type MoneyDealFilter = (typeof MONEY_DEAL_FILTERS)[number]["id"];

export const MONEY_SEARCH_PLACEHOLDER = "Search id, title, wallet…";

/** Same ~7 day stuck window Overview already sends to /api/admin/deals. */
export const MONEY_STUCK_DAYS = 7;

/** Released tab is view-only history. Stay inside the 50–100 cap. */
export const MONEY_RELEASED_CAP = 80;

export const MONEY_EMPTY = {
  deals: {
    title: "No open deals.",
    sub: "Escrow and in-flight sales show up here.",
  },
  disputes: {
    title: "No open disputes.",
    sub: "Escrow disputes that need a money decision land here.",
  },
  released: {
    title: "No released deals yet.",
    sub: "Completed and refunded escrow will show up here.",
  },
} as const;

export const MONEY_SEARCH_MISS = {
  title: "Nothing matches.",
  sub: "Check the id or try another filter.",
} as const;

export type MoneyStage = DealStage;

export type MoneyDeal = {
  listingId: string;
  title: string | null;
  seller: string;
  buyer: string | null;
  sellerIsAdmin?: boolean;
  buyerIsAdmin?: boolean;
  amountHbar: string;
  status: string;
  stage?: string | null;
  disputeStatus: string | null;
  updatedAt?: string;
  createdAt?: string;
  attentionAt?: string;
  ageDays: number;
  stuck: boolean;
  shippedAt?: string | null;
  exchangeConfirmedAt?: string | null;
};

export type MoneyKpiId = "open" | "locked" | "disputed" | "stuck";

const STAGE_VALUES: readonly MoneyStage[] = [
  "Offered",
  "Locked",
  "Meetup",
  "Complete",
  "Disputed",
  "Refunded",
];

export const MONEY_STAGE_TONE: Record<MoneyStage, ListingStatusTone> = {
  Offered: "silver",
  Locked: "bright",
  Meetup: "warning",
  Complete: "mint",
  Disputed: "danger",
  Refunded: "silver",
};

function isMoneyStage(value: string | null | undefined): value is MoneyStage {
  return !!value && (STAGE_VALUES as readonly string[]).includes(value);
}

/** Overview dealStage mapping, plus Refunded when settlement already stored that status. */
export function moneyStage(row: {
  status?: string | null;
  stage?: string | null;
  disputeStatus?: string | null;
  shippedAt?: string | Date | null;
  exchangeConfirmedAt?: string | Date | null;
}): MoneyStage {
  if (row.status || row.disputeStatus || row.shippedAt || row.exchangeConfirmedAt) {
    return dealStageFromRow(row);
  }
  if (isMoneyStage(row.stage)) return row.stage;
  return "Offered";
}

export function dealsMatchingFilter(deals: MoneyDeal[], filter: MoneyDealFilter): MoneyDeal[] {
  return deals.filter((deal) => {
    const stage = moneyStage(deal);
    switch (filter) {
      case "locked":
        return stage === "Locked";
      case "meetup":
        return stage === "Meetup";
      case "stuck":
        return deal.stuck;
      case "all":
        return stage !== "Complete" && stage !== "Refunded";
      case "open":
      default:
        return stage === "Offered" || stage === "Locked" || stage === "Meetup";
    }
  });
}

export function rowsForMoneyTab(
  openDeals: MoneyDeal[],
  releasedDeals: MoneyDeal[],
  tab: MoneyTabId,
  filter: MoneyDealFilter,
): MoneyDeal[] {
  if (tab === "disputes") return openDeals.filter((deal) => moneyStage(deal) === "Disputed");
  if (tab === "released") {
    return releasedDeals.filter((deal) => {
      const stage = moneyStage(deal);
      return stage === "Complete" || stage === "Refunded";
    });
  }
  return dealsMatchingFilter(openDeals, filter);
}

export function filterMoneySearch(rows: MoneyDeal[], query: string): MoneyDeal[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    [row.listingId, row.title, row.buyer, row.seller].some((part) =>
      (part ?? "").toLowerCase().includes(q),
    ),
  );
}

export function moneyEmptyCopy(tab: MoneyTabId, query: string) {
  if (query.trim()) return MONEY_SEARCH_MISS;
  return MONEY_EMPTY[tab];
}

export function moneyKpis(openDeals: MoneyDeal[]) {
  return {
    open: dealsMatchingFilter(openDeals, "open").length,
    locked: dealsMatchingFilter(openDeals, "locked").length,
    disputed: openDeals.filter((deal) => moneyStage(deal) === "Disputed").length,
    stuck: openDeals.filter((deal) => deal.stuck).length,
  };
}

export function moneyTabBadge(
  tab: MoneyTabId,
  kpis: ReturnType<typeof moneyKpis>,
  releasedCount: number,
): { count: number; tone: "mint" | "danger" | "silver" } | null {
  const count = tab === "deals" ? kpis.open : tab === "disputes" ? kpis.disputed : releasedCount;
  if (count <= 0) return null;
  if (tab === "disputes") return { count, tone: "danger" };
  if (tab === "released") return { count, tone: "silver" };
  return { count, tone: "mint" };
}

/** View only. Release / refund / resolve wait for real admin mutation APIs. */
export function moneyRowActions(): { view: true } {
  return { view: true };
}
