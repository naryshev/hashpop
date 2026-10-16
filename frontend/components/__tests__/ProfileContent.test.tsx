import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SELF = "0xabc0000000000000000000000000000000000001";
const PUBLIC = "0xdef0000000000000000000000000000000000002";

const { wallet } = vi.hoisted(() => ({
  wallet: {
    address: "0xabc0000000000000000000000000000000000001" as string | null,
    accountId: null as string | null,
  },
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => createElement("a", { href, ...rest }, children),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

vi.mock("../../lib/hashpackWallet", () => ({
  useHashpackWallet: () => wallet,
}));

vi.mock("../../hooks/useHbarUsd", () => ({
  useHbarUsd: () => 0.1,
}));

vi.mock("../../hooks/useCancelListing", () => ({
  useCancelListing: () => ({
    cancel: vi.fn(async () => false),
    isPending: false,
    isSuccess: false,
    hash: null,
    error: null,
  }),
}));

vi.mock("../../lib/profiles", () => ({
  useProfile: () => undefined,
  profileDisplayName: () => null,
  profileAvatarUrl: () => null,
}));

import { ProfileContent } from "../ProfileContent";

let root: Root | undefined;
let host: HTMLElement | undefined;
let active: { id: string; title: string; price: string; status: string; category: string }[] = [];

function json(body: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    json: async () => body,
  };
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  wallet.address = SELF;
  wallet.accountId = null;
  active = [
    {
      id: "coat-1",
      title: "Coat",
      price: "7.5",
      status: "LISTED",
      category: "Coats",
    },
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/listings")) return json({ active, archived: [] });
      if (url.includes("/profile")) {
        return json({
          address: SELF,
          displayName: "Ada",
          bio: "Short bio",
          avatarUrl: null,
          kyc: { status: "VERIFIED" },
        });
      }
      if (url.includes("/purchases")) {
        return json({
          purchases: [
            {
              id: "sale-1",
              listingId: "sold-1",
              role: "seller",
              amount: "10",
              createdAt: new Date().toISOString(),
              listing: { id: "sold-1", title: "Sold coat", status: "COMPLETED", imageUrl: null },
            },
          ],
        });
      }
      if (url.includes("/ratings")) return json({ ratings: [], count: 2, averageScore: 4.5 });
      if (url.includes("/wishlist")) return json({ items: [] });
      if (url.includes("/offers")) return json({ received: [], sent: [] });
      if (url.includes("/escrow/")) return json({ error: "none" }, 404);
      if (url.includes("/api/user/")) {
        return json({
          address: SELF,
          successfulCompletions: 4,
          totalSales: 5,
          ratingAverage: 4.5,
          ratingCount: 2,
          refunds: 0,
          timeouts: 0,
          activeListings: active.length,
          completedBuys: 0,
        });
      }
      return json({});
    }),
  );
});

afterEach(async () => {
  if (root) {
    await act(async () => {
      root!.unmount();
    });
  }
  host?.remove();
  root = undefined;
  host = undefined;
  vi.unstubAllGlobals();
});

async function renderProfile(address: string) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(ProfileContent, { address }));
  });
  for (let i = 0; i < 20; i += 1) {
    if (
      host.querySelector('[data-testid="profile-active-count"]') ||
      host.querySelector('[data-testid="profile-empty"]')
    ) {
      const text = host.textContent ?? "";
      if (text.includes("Active") || text.includes("Nothing listed") || text.includes("No active"))
        break;
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

describe("ProfileContent", () => {
  it("renders the own-profile dossier from real stats, earnings, and shop tabs", async () => {
    await renderProfile(SELF);
    const text = host!.textContent ?? "";
    expect(host!.querySelector('[data-testid="profile-handle"]')?.textContent).toContain("Ada");
    expect(host!.querySelector('[data-testid="profile-tab-shop"]')?.textContent).toBe("Shop");
    expect(host!.querySelector('[data-testid="profile-tab-sold"]')?.textContent).toBe("Sold");
    expect(host!.querySelector('[data-testid="profile-tab-purchased"]')?.textContent).toBe(
      "Purchased",
    );
    expect(host!.querySelector('[data-testid="profile-tab-likes"]')?.textContent).toBe("Likes");
    expect(host!.querySelector('[data-testid="profile-tab-reviews"]')).toBeNull();
    expect(host!.querySelector('[data-testid="profile-stat-deals"]')?.textContent).toContain("1");
    expect(host!.querySelector('[data-testid="profile-stat-deals"]')?.textContent).toContain(
      "deals",
    );
    expect(host!.querySelector('[data-testid="profile-stat-completion"]')?.textContent).toContain(
      "80%",
    );
    expect(host!.querySelector('[data-testid="profile-stat-rating"]')?.textContent).toContain(
      "rating (2)",
    );
    expect(text).not.toContain("completed deals");
    expect(text).not.toContain("followers");
    expect(text).not.toContain("Follow");
    expect(host!.querySelector('[data-testid="profile-earnings-earned"]')?.textContent).toContain(
      "10 ℏ",
    );
    expect(host!.querySelector('[data-testid="profile-earnings-earned"]')?.textContent).toContain(
      "≈ $1.00",
    );
    expect(
      host!.querySelector('[data-testid="profile-earnings-potential"]')?.textContent,
    ).toContain("7.5 ℏ");
    expect(host!.querySelector('[data-testid="profile-earnings-escrow"]')).toBeNull();
    expect(host!.querySelector('[data-testid="profile-active-count"]')?.textContent).toBe(
      "Active (1 listing)",
    );
    expect(host!.querySelector('[data-testid="trust-kyc-chip"]')).toBeTruthy();
    expect(host!.querySelector('a[href="/create"]')).toBeTruthy();
    const shopTiles = host!.querySelectorAll('[data-testid="profile-tile"]');
    expect(shopTiles.length).toBeGreaterThan(0);
    expect([...shopTiles].every((tile) => tile.getAttribute("data-dimmed") === "false")).toBe(
      true,
    );

    const sold = host!.querySelector('[data-testid="profile-tab-sold"]') as HTMLButtonElement;
    await act(async () => {
      sold.click();
    });
    const soldTiles = host!.querySelectorAll('[data-testid="profile-tile"]');
    expect(soldTiles.length).toBe(1);
    expect(
      [...soldTiles].every((tile) => tile.getAttribute("data-dimmed") === "true"),
    ).toBe(true);
    const soldLabels = host!.querySelectorAll('[data-testid="profile-sold-label"]');
    expect(soldLabels.length).toBe(soldTiles.length);
    expect([...soldLabels].every((label) => label.textContent === "Sold")).toBe(true);
    expect(host!.querySelector('[data-testid="profile-stat-deals"]')?.textContent).toContain("1");

    const shop = host!.querySelector('[data-testid="profile-tab-shop"]') as HTMLButtonElement;
    await act(async () => {
      shop.click();
    });
    const select = host!.querySelector('[data-testid="profile-select"]') as HTMLButtonElement;
    await act(async () => {
      select.click();
    });
    const bar = host!.querySelector('[data-testid="profile-select-bar"]') as HTMLElement;
    expect(bar).toBeTruthy();
    expect(bar.getAttribute("data-clears-dock")).toBe("true");
    expect(bar.className).toContain("bottom-[calc(env(safe-area-inset-bottom)+96px)]");
    expect(bar.textContent).toContain("Delist");
    expect(host!.textContent).not.toContain("Mark sold");
    expect(host!.textContent).toContain("0 selected");
  });

  it("shows the own empty rack with Active (0) and Start selling", async () => {
    active = [];
    await renderProfile(SELF);
    expect(host!.querySelector('[data-testid="profile-active-count"]')?.textContent).toBe(
      "Active (0 listings)",
    );
    expect(host!.querySelector('[data-testid="profile-empty"]')?.textContent).toContain(
      "No active listings",
    );
    expect(host!.querySelector('[data-testid="profile-empty"]')?.textContent).toContain(
      "List an item so buyers can find you.",
    );
    expect(host!.querySelector('[data-testid="profile-start-selling"]')?.textContent).toBe(
      "Start selling",
    );
    expect(
      host!.querySelector('[data-testid="profile-earnings-potential"]')?.textContent,
    ).toContain("From 0 active listings");
    expect(host!.querySelector('[data-testid="profile-stat-deals"]')?.textContent).toContain("1");
    expect(host!.querySelector('[data-testid="profile-stat-completion"]')?.textContent).toContain(
      "80%",
    );
    expect(host!.querySelector('[data-testid="profile-stat-rating"]')?.textContent).toContain(
      "rating (2)",
    );
    expect(host!.textContent).not.toContain("completed deals");
  });

  it("hides own-only actions on a public profile and keeps Likes when wishlist data exists", async () => {
    active = [];
    await renderProfile(PUBLIC);
    expect(host!.querySelector('[data-testid="profile-earnings"]')).toBeNull();
    expect(host!.querySelector('[data-testid="profile-start-selling"]')).toBeNull();
    expect(host!.textContent).toContain("Nothing listed right now.");
    expect(host!.textContent).not.toContain("Follow");
    expect(host!.querySelector('[aria-label="Message"]')).toBeTruthy();
    expect(host!.querySelector('[aria-label="Share profile"]')).toBeTruthy();
    expect(host!.querySelector('[aria-label="More"]')).toBeTruthy();
    expect(host!.querySelector('[data-testid="profile-tab-likes"]')).toBeTruthy();
    expect(host!.querySelector('[data-testid="profile-tab-reviews"]')).toBeTruthy();
    expect(host!.querySelector('[data-testid="profile-tab-purchased"]')).toBeNull();
    expect(host!.querySelector('a[aria-label="New listing"]')).toBeNull();
  });
});
