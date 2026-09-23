import { describe, expect, it } from "vitest";
import {
  MONEY_EMPTY,
  MONEY_PAGE,
  MONEY_SEARCH_MISS,
  MONEY_SEARCH_PLACEHOLDER,
  dealsMatchingFilter,
  filterMoneySearch,
  moneyEmptyCopy,
  moneyKpis,
  moneyRowActions,
  moneyStage,
  moneyTabBadge,
  rowsForMoneyTab,
  type MoneyDeal,
} from "../adminMoney";

function deal(partial: Partial<MoneyDeal> & Pick<MoneyDeal, "listingId" | "status">): MoneyDeal {
  return {
    title: partial.title ?? partial.listingId,
    seller: partial.seller ?? "0xseller",
    buyer: partial.buyer ?? "0xbuyer",
    amountHbar: partial.amountHbar ?? "1",
    disputeStatus: partial.disputeStatus ?? null,
    ageDays: partial.ageDays ?? 1,
    stuck: partial.stuck ?? false,
    ...partial,
  };
}

describe("moneyStage", () => {
  it("matches overview stages and labels refunded escrow", () => {
    expect(moneyStage({ disputeStatus: "OPEN", status: "LOCKED" })).toBe("Disputed");
    expect(moneyStage({ status: "SOLD" })).toBe("Complete");
    expect(moneyStage({ status: "REFUNDED" })).toBe("Refunded");
    expect(moneyStage({ status: "LOCKED", shippedAt: "2026-01-01" })).toBe("Meetup");
    expect(moneyStage({ status: "LOCKED" })).toBe("Locked");
    expect(moneyStage({ status: "LISTED" })).toBe("Offered");
    expect(moneyStage({ stage: "Meetup" })).toBe("Meetup");
  });
});

describe("money queues", () => {
  const open = deal({ listingId: "open", status: "LISTED", stage: "Offered" });
  const locked = deal({
    listingId: "locked",
    status: "LOCKED",
    stage: "Locked",
    stuck: true,
    ageDays: 9,
  });
  const meetup = deal({
    listingId: "meetup",
    status: "LOCKED",
    shippedAt: "2026-09-01",
    stage: "Meetup",
  });
  const disputed = deal({
    listingId: "dispute",
    status: "LOCKED",
    disputeStatus: "OPEN",
    stage: "Disputed",
    stuck: true,
    ageDays: 8,
  });
  const released = [
    deal({ listingId: "sold", status: "SOLD", stage: "Complete" }),
    deal({ listingId: "refund", status: "REFUNDED", stage: "Refunded" }),
  ];
  const inflight = [open, locked, meetup, disputed];

  it("filters the deals tab without pulling in settled escrow", () => {
    expect(dealsMatchingFilter(inflight, "open").map((row) => row.listingId)).toEqual([
      "open",
      "locked",
      "meetup",
    ]);
    expect(dealsMatchingFilter(inflight, "locked").map((row) => row.listingId)).toEqual(["locked"]);
    expect(dealsMatchingFilter(inflight, "meetup").map((row) => row.listingId)).toEqual(["meetup"]);
    expect(dealsMatchingFilter(inflight, "stuck").map((row) => row.listingId)).toEqual([
      "locked",
      "dispute",
    ]);
    expect(dealsMatchingFilter(inflight, "all").map((row) => row.listingId)).toEqual([
      "open",
      "locked",
      "meetup",
      "dispute",
    ]);
  });

  it("maps disputes and released tabs", () => {
    expect(
      rowsForMoneyTab(inflight, released, "disputes", "open").map((row) => row.listingId),
    ).toEqual(["dispute"]);
    expect(
      rowsForMoneyTab(inflight, released, "released", "open").map((row) => row.listingId),
    ).toEqual(["sold", "refund"]);
  });

  it("searches id, title, and wallet", () => {
    const rows = [
      deal({ listingId: "lst-1", title: "Chrome watch", seller: "0xaaa", status: "LOCKED" }),
    ];
    expect(filterMoneySearch(rows, "chrome")).toHaveLength(1);
    expect(filterMoneySearch(rows, "0xAAA")).toHaveLength(1);
    expect(filterMoneySearch(rows, "lst-1")).toHaveLength(1);
    expect(filterMoneySearch(rows, "missing")).toHaveLength(0);
  });

  it("counts KPIs and hides zero badges", () => {
    expect(moneyKpis(inflight)).toEqual({ open: 3, locked: 1, disputed: 1, stuck: 2 });
    expect(moneyTabBadge("deals", moneyKpis(inflight), 2)).toEqual({ count: 3, tone: "mint" });
    expect(moneyTabBadge("disputes", moneyKpis(inflight), 2)).toEqual({ count: 1, tone: "danger" });
    expect(moneyTabBadge("released", moneyKpis([]), 2)).toEqual({ count: 2, tone: "mint" });
    expect(moneyTabBadge("disputes", moneyKpis([]), 0)).toBeNull();
  });

  it("keeps frozen empty copy and view-only actions", () => {
    expect(MONEY_PAGE).toEqual({
      title: "Money",
      sub: "Escrow and deals that need a release, refund, or look.",
    });
    expect(MONEY_SEARCH_PLACEHOLDER).toBe("Search id, title, wallet…");
    expect(moneyEmptyCopy("deals", "")).toEqual(MONEY_EMPTY.deals);
    expect(moneyEmptyCopy("disputes", "")).toEqual(MONEY_EMPTY.disputes);
    expect(moneyEmptyCopy("released", "")).toEqual(MONEY_EMPTY.released);
    expect(moneyEmptyCopy("deals", "watch")).toEqual(MONEY_SEARCH_MISS);
    expect(MONEY_SEARCH_MISS).toEqual({
      title: "Nothing matches.",
      sub: "Check the id or try another filter.",
    });
    expect(moneyRowActions()).toEqual({ view: true });
  });
});
