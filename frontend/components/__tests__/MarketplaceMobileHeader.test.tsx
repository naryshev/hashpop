import { createElement, act, useState, type FormEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketplaceMobileHeader } from "../MarketplaceMobileHeader";
import { MarketplaceFilterPanel } from "../MarketplaceFilterPanel";
import {
  marketplaceHref,
  resetMarketplaceFilters,
  withAdvancedFilters,
  withCategory,
  withListingType,
  withSort,
  type AdvancedFilterDraft,
} from "../../lib/marketplaceFilters";

const { wallet, openSignIn, profile } = vi.hoisted(() => ({
  wallet: {
    accountId: null as string | null,
    address: null as string | null,
    isConnected: false,
  },
  openSignIn: vi.fn(),
  profile: {
    current: undefined as
      | undefined
      | {
          avatarUrl: string | null;
          hashpackAvatarUrl: string | null;
        },
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
    [k: string]: unknown;
  }) => createElement("a", { href, ...rest }, children),
}));

vi.mock("../../lib/hashpackWallet", () => ({
  useHashpackWallet: () => wallet,
}));

vi.mock("../../lib/signInModal", () => ({
  useSignInModal: () => ({ openSignIn }),
}));

vi.mock("../../lib/profiles", () => ({
  useProfile: () => profile.current,
  profileAvatarUrl: (
    value: { avatarUrl?: string | null; hashpackAvatarUrl?: string | null } | undefined,
  ) => value?.avatarUrl || value?.hashpackAvatarUrl || null,
}));

vi.mock("../NotificationBell", () => ({
  NotificationBell: ({ variant }: { variant?: string }) =>
    createElement(
      "button",
      { type: "button", "aria-label": "Notifications", "data-variant": variant },
      "bell",
    ),
}));

vi.mock("../ProfileCardSheet", () => ({
  ProfileCardSheet: ({ open }: { open: boolean }) =>
    open ? createElement("div", { "data-testid": "profile-sheet" }, "profile") : null,
}));

let root: Root | undefined;
let host: HTMLElement | undefined;

const emptyDraft: AdvancedFilterDraft = {
  minPrice: "",
  maxPrice: "",
  postedWithin: "",
  condition: "",
  location: "",
};

async function renderHeader(
  props: Partial<React.ComponentProps<typeof MarketplaceMobileHeader>> = {},
) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(
      createElement(MarketplaceMobileHeader, {
        searchValue: "",
        onSearchChange: () => {},
        onSearchSubmit: (event: FormEvent) => event.preventDefault(),
        filterOpen: false,
        onOpenFilters: () => {},
        onCloseFilters: () => {},
        filterSheet: null,
        ...props,
      }),
    );
  });
}

describe("MarketplaceMobileHeader", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    wallet.accountId = null;
    wallet.address = null;
    wallet.isConnected = false;
    profile.current = undefined;
    openSignIn.mockReset();
  });

  afterEach(async () => {
    if (root) {
      const current = root;
      await act(async () => {
        current.unmount();
      });
    }
    host?.remove();
    root = undefined;
    host = undefined;
  });

  it("centers the Hashpop wordmark and removes the Sign in pill", async () => {
    await renderHeader();
    const header = document.querySelector(
      '[data-testid="marketplace-mobile-header"]',
    ) as HTMLElement;
    expect(header.className).toContain("sm:hidden");
    expect(document.querySelector('[data-testid="marketplace-logo"]')?.textContent).toContain(
      "Hashpop",
    );
    const wordmark = document.querySelector('[data-testid="marketplace-wordmark"]') as HTMLElement;
    expect(wordmark.textContent).toBe("marketplace");
    expect(wordmark.className).toContain("tracking-[0.28em]");
    expect(wordmark.className).toContain("text-silver");
    expect(wordmark.className).toContain("lowercase");
    const home = document.querySelector('a[aria-label="Hashpop home"]') as HTMLElement;
    expect(home.className).toContain("left-1/2");
    expect(document.body.textContent).not.toContain("Sign in");
    const profileButton = document.querySelector(
      '[data-testid="marketplace-profile"]',
    ) as HTMLButtonElement;
    expect(profileButton.getAttribute("aria-label")).toBe("Sign in");
    expect(profileButton.className).toContain("rounded-full");
    await act(async () => {
      profileButton.click();
    });
    expect(openSignIn).toHaveBeenCalledOnce();
    const bell = document.querySelector('[aria-label="Notifications"]') as HTMLElement;
    expect(bell.dataset.variant).toBe("mobile");
    const search = document.querySelector('input[aria-label="Search Hashpop"]') as HTMLInputElement;
    expect(search.placeholder).toBe("Search Hashpop...");
    expect(
      document.querySelector('[data-testid="marketplace-filter-button"]')?.textContent,
    ).toContain("Filter");
  });

  it("opens the profile sheet from the avatar when signed in", async () => {
    wallet.isConnected = true;
    wallet.address = "0xabc";
    profile.current = { avatarUrl: "https://cdn.example/a.png", hashpackAvatarUrl: null };
    await renderHeader();
    const profileButton = document.querySelector(
      '[data-testid="marketplace-profile"]',
    ) as HTMLButtonElement;
    expect(profileButton.getAttribute("aria-label")).toBe("Open profile");
    expect(profileButton.querySelector("img")?.getAttribute("src")).toBe(
      "https://cdn.example/a.png",
    );
    await act(async () => {
      profileButton.click();
    });
    expect(document.querySelector('[data-testid="profile-sheet"]')).toBeTruthy();
    expect(openSignIn).not.toHaveBeenCalled();
  });

  it("opens one filter sheet from the sliders and the Filter button and writes params", async () => {
    const pushes: string[] = [];
    function Harness() {
      const [open, setOpen] = useState(false);
      const [draft, setDraft] = useState<AdvancedFilterDraft>(emptyDraft);
      const params = new URLSearchParams("q=sony");
      return createElement(MarketplaceMobileHeader, {
        searchValue: "",
        onSearchChange: () => {},
        onSearchSubmit: (event: FormEvent) => event.preventDefault(),
        filterOpen: open,
        onOpenFilters: () => setOpen(true),
        onCloseFilters: () => setOpen(false),
        filterSheet: createElement(MarketplaceFilterPanel, {
          browse: true,
          sortMode: "recent",
          type: "all",
          category: "",
          categories: ["Watches"],
          cities: ["Austin"],
          draft,
          onDraft: setDraft,
          onSort: (sort) => pushes.push(marketplaceHref(withSort(params, sort))),
          onType: (type) => pushes.push(marketplaceHref(withListingType(params, type))),
          onCategory: (category) => pushes.push(marketplaceHref(withCategory(params, category))),
          onReset: () => pushes.push(marketplaceHref(resetMarketplaceFilters(params))),
          onApply: () => pushes.push(marketplaceHref(withAdvancedFilters(params, draft))),
        }),
      });
    }

    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(createElement(Harness));
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    const sliders = document.querySelector(
      '[data-testid="marketplace-filter-sliders"]',
    ) as HTMLButtonElement;
    await act(async () => {
      sliders.click();
    });
    expect(document.querySelector('[role="dialog"][aria-label="Filters"]')).toBeTruthy();
    expect(document.body.textContent).not.toContain("Search listings");

    await act(async () => {
      (
        document.querySelector('[data-testid="listing-type-physical"]') as HTMLButtonElement
      ).click();
    });
    expect(pushes.at(-1)).toContain("type=physical");
    expect(pushes.at(-1)).toContain("q=sony");
    expect(pushes.at(-1)).not.toContain("category=");

    await act(async () => {
      (
        document.querySelector('[data-testid="listing-category-Watches"]') as HTMLButtonElement
      ).click();
    });
    expect(pushes.at(-1)).toContain("category=Watches");

    await act(async () => {
      (document.querySelector('[data-testid="sort-price-asc"]') as HTMLButtonElement).click();
    });
    expect(pushes.at(-1)).toContain("sort=price-asc");

    const min = document.querySelector('[data-testid="filter-min-price"]') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(min, "1.5");
      min.dispatchEvent(new Event("input", { bubbles: true }));
      min.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      (document.querySelector('[data-testid="filter-apply"]') as HTMLButtonElement).click();
    });
    expect(pushes.at(-1)).toContain("minPrice=1.5");
    expect(pushes.at(-1)).toContain("q=sony");

    await act(async () => {
      (
        document.querySelector('[data-testid="marketplace-filter-button"]') as HTMLButtonElement
      ).click();
    });
    expect(document.querySelectorAll('[role="dialog"]').length).toBe(1);
  });
});
