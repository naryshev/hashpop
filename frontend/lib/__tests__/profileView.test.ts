import { describe, expect, it } from "vitest";
import {
  OWN_SHOP_EMPTY,
  PUBLIC_SHOP_EMPTY,
  activeListingsLabel,
  earnedLast30Hbar,
  filterShopListings,
  profileEarnings,
  profileStatColumns,
  profileTabList,
  profileTileBadge,
  selectSoldEntries,
  summarizeOpenEscrow,
} from "../profileView";

const NOW = Date.parse("2026-10-16T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("profileTabList", () => {
  it("maps own profile to Shop, Sold, Purchased, and Likes", () => {
    expect(profileTabList(true, false).map((tab) => tab.label)).toEqual([
      "Shop",
      "Sold",
      "Purchased",
      "Likes",
    ]);
  });

  it("maps a public profile to Shop, Sold, and Reviews, adding Likes when that read exists", () => {
    expect(profileTabList(false, false).map((tab) => tab.id)).toEqual(["shop", "sold", "reviews"]);
    expect(profileTabList(false, true).map((tab) => tab.id)).toEqual([
      "shop",
      "sold",
      "likes",
      "reviews",
    ]);
  });
});

describe("profileStatColumns", () => {
  it("counts Sold-tab rows as deals, even when successfulCompletions is zero", () => {
    expect(
      profileStatColumns({
        soldCount: 3,
        successfulCompletions: 0,
        totalSales: 0,
        ratingAverage: 4.5,
        ratingCount: 2,
      }),
    ).toEqual([
      { id: "deals", value: "3", label: "deals" },
      { id: "completion", value: "—", label: "completion" },
      { id: "rating", value: "★ 4.5", label: "rating (2)" },
    ]);
  });

  it("keeps completion and rating beside the deals count", () => {
    expect(
      profileStatColumns({
        soldCount: 3,
        successfulCompletions: 4,
        totalSales: 5,
        ratingAverage: 4.5,
        ratingCount: 2,
      }),
    ).toEqual([
      { id: "deals", value: "3", label: "deals" },
      { id: "completion", value: "80%", label: "completion" },
      { id: "rating", value: "★ 4.5", label: "rating (2)" },
    ]);
  });

  it("always returns three columns and uses an em dash where a number is missing", () => {
    expect(
      profileStatColumns({
        soldCount: 0,
        successfulCompletions: 0,
        totalSales: 0,
        ratingAverage: null,
        ratingCount: 0,
      }),
    ).toEqual([
      { id: "deals", value: "0", label: "deals" },
      { id: "completion", value: "—", label: "completion" },
      { id: "rating", value: "—", label: "rating" },
    ]);
  });

  it("lets the listings count stand in when the Sold tab has not loaded", () => {
    expect(
      profileStatColumns({
        soldCount: null,
        activeListings: 4,
        successfulCompletions: null,
        totalSales: null,
      }).map((stat) => ({ id: stat.id, value: stat.value, label: stat.label })),
    ).toEqual([
      { id: "listings", value: "4", label: "listings" },
      { id: "completion", value: "—", label: "completion" },
      { id: "rating", value: "—", label: "rating" },
    ]);
  });

  it("uses an em dash for deals when neither sold rows nor listings have loaded", () => {
    expect(profileStatColumns({}).map((stat) => stat.value)).toEqual(["—", "—", "—"]);
  });
});

describe("selectSoldEntries", () => {
  it("matches the Sold tab: seller sales plus archived listings that are not still listed", () => {
    const selected = selectSoldEntries(
      [
        { id: "sale-1", role: "seller", listingId: "scarf" },
        { id: "sale-2", role: "buyer", listingId: "lamp" },
        { id: "sale-3", role: "seller", listingId: "old" },
      ],
      [
        { id: "jacket", status: "LOCKED" },
        { id: "scarf", status: "COMPLETED" },
        { id: "still", status: "LISTED" },
      ],
    );
    expect(selected.sales.map((sale) => sale.id)).toEqual(["sale-1", "sale-3"]);
    expect(selected.archived.map((listing) => listing.id)).toEqual(["jacket"]);
  });
});

describe("profileEarnings", () => {
  const sales = [
    { role: "seller", amount: "10", createdAt: new Date(NOW - 2 * DAY).toISOString() },
    { role: "seller", amount: "4.5", createdAt: new Date(NOW - 40 * DAY).toISOString() },
    { role: "buyer", amount: "99", createdAt: new Date(NOW - DAY).toISOString() },
    { role: "seller", amount: "nope", createdAt: new Date(NOW - DAY).toISOString() },
  ];

  it("sums seller sales inside 30 days and active listing prices, with fiat under each", () => {
    expect(earnedLast30Hbar(sales, NOW)).toBe(10);
    const columns = profileEarnings({
      sales,
      activeListings: [{ price: "3" }, { price: "1.5" }],
      openEscrow: null,
      usdPerHbar: 0.1,
      now: NOW,
    });
    expect(columns.map((column) => column.id)).toEqual(["earned", "potential"]);
    expect(columns[0]).toMatchObject({
      amountLabel: "10 ℏ",
      caption: "earned",
      detail: "Last 30 days",
      fiatLabel: "≈ $1.00",
    });
    expect(columns[1]).toMatchObject({
      amountLabel: "4.5 ℏ",
      caption: "potential",
      detail: "From 2 active listings",
      fiatLabel: "≈ $0.45",
    });
  });

  it("adds in-escrow only when an open deal amount exists", () => {
    const without = profileEarnings({
      sales: [],
      activeListings: [],
      openEscrow: null,
      usdPerHbar: null,
      now: NOW,
    });
    expect(without.map((column) => column.id)).toEqual(["earned", "potential"]);
    expect(without[0].fiatLabel).toBeNull();
    expect(without[1].detail).toBe("From 0 active listings");

    const withEscrow = profileEarnings({
      sales: [],
      activeListings: [],
      openEscrow: { hbar: 320, deals: 3 },
      usdPerHbar: 0.05,
      now: NOW,
    });
    expect(withEscrow[2]).toMatchObject({
      id: "escrow",
      amountLabel: "320 ℏ",
      caption: "in escrow",
      detail: "From 3 open deals",
      fiatLabel: "≈ $16.00",
    });
  });

  it("ignores complete and refunded escrow views", () => {
    expect(
      summarizeOpenEscrow([
        { state: "COMPLETE", amount: "100000000" },
        { state: "REFUNDED", amount: "100000000" },
      ]),
    ).toBeNull();
    expect(
      summarizeOpenEscrow([
        { state: "AWAITING_SHIPMENT", amount: "250000000" },
        { state: "SHIPPED", amount: "100000000" },
      ]),
    ).toEqual({ hbar: 3.5, deals: 2 });
  });
});

describe("profile grid helpers", () => {
  it("keeps a single badge and prefers sold over escrow over offer", () => {
    expect(profileTileBadge({ status: "SOLD", hasActiveOffer: true })).toEqual({
      label: "Sold",
      tone: "sold",
    });
    expect(profileTileBadge({ status: "COMPLETED" })?.tone).toBe("sold");
    expect(profileTileBadge({ status: "LOCKED", hasActiveOffer: true })).toEqual({
      label: "In escrow",
      tone: "escrow",
    });
    expect(profileTileBadge({ status: "LISTED", hasActiveOffer: true })).toEqual({
      label: "Offer",
      tone: "offer",
    });
    expect(profileTileBadge({ status: "LISTED" })).toBeNull();
    expect(profileTileBadge({ status: "CANCELLED" })).toBeNull();
  });

  it("filters shop listings by category and price and sorts by price", () => {
    const items = [
      { id: "a", price: "10", category: "Shoes", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "b", price: "4", category: "Shoes", createdAt: "2026-06-01T00:00:00.000Z" },
      { id: "c", price: "8", category: "Coats", createdAt: "2026-03-01T00:00:00.000Z" },
    ];
    expect(
      filterShopListings(items, {
        sort: "price-asc",
        category: "Shoes",
        minPrice: null,
        maxPrice: null,
      }).map((item) => item.id),
    ).toEqual(["b", "a"]);
    expect(
      filterShopListings(items, {
        sort: "newest",
        category: null,
        minPrice: 5,
        maxPrice: 9,
      }).map((item) => item.id),
    ).toEqual(["c"]);
  });

  it("labels the active row and keeps the locked empty copy", () => {
    expect(activeListingsLabel(0)).toBe("Active (0 listings)");
    expect(activeListingsLabel(1)).toBe("Active (1 listing)");
    expect(OWN_SHOP_EMPTY.cta).toBe("Start selling");
    expect(PUBLIC_SHOP_EMPTY.headline).toBe("Nothing listed right now.");
  });
});
