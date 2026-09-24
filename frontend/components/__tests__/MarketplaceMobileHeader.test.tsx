import { createElement, act, useState, type FormEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketplaceMobileHeader } from "../MarketplaceMobileHeader";
import { MarketplaceFilterPanel, MarketplaceSortPanel } from "../MarketplaceFilterPanel";
import {
  marketplaceHref,
  withAdvancedFilters,
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
        filterCount: 0,
        resultCount: 2,
        onClearFilters: () => {},
        onShowResults: () => {},
        filterSheet: null,
        sortOpen: false,
        onOpenSort: () => {},
        onCloseSort: () => {},
        sortSheet: null,
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
    expect(header.className).toContain("md:hidden");
    const logo = document.querySelector('[data-testid="marketplace-logo"]') as SVGElement;
    expect(logo.tagName.toLowerCase()).toBe("svg");
    expect(logo.getAttribute("aria-label")).toBe("Hashpop");
    expect(logo.className.baseVal).toContain("w-[124px]");
    expect(logo.className.baseVal).toContain("h-auto");
    expect(logo.className.baseVal).toContain("text-white");
    expect(header.className).toContain("pt-[calc(env(safe-area-inset-top)+12px)]");
    const searchField = document.querySelector(
      '[data-testid="marketplace-search-field"]',
    ) as HTMLElement;
    expect(searchField.className).toContain("bg-material-chrome");
    expect(searchField.className).toContain("border-white/10");
    expect(searchField.className).not.toContain("border-[#00ffa3]");
    const filterButton = document.querySelector(
      '[data-testid="marketplace-filter-button"]',
    ) as HTMLElement;
    expect(filterButton.className).toContain("bg-material-chrome");
    expect(filterButton.className).toContain("border-[#00ffa3]/40");
    expect(filterButton.className).toContain("text-[#00ffa3]");
    expect(logo.querySelector("path")?.getAttribute("fill")).toBe("currentColor");
    const ring = document.querySelector('[data-testid="hashpop-ring-o"]') as SVGGElement;
    expect(ring.tagName.toLowerCase()).toBe("g");
    expect(ring.id).toBe("ring-o");
    expect(ring.getAttribute("fill")).toBe("var(--color-chrome)");
    expect(ring.textContent).not.toBe("o");
    const wordmark = document.querySelector('[data-testid="marketplace-wordmark"]') as HTMLElement;
    expect(wordmark.textContent).toBe("marketplace");
    expect(wordmark.className).toContain("tracking-[0.12em]");
    expect(wordmark.className).toContain("text-white/60");
    expect(wordmark.className).toContain("text-[12px]");
    const home = document.querySelector('a[aria-label="Hashpop home"]') as HTMLElement;
    expect(home.parentElement?.className).toContain("grid-cols-");
    expect(document.body.textContent).not.toContain("Sign in");
    const profileButton = document.querySelector(
      '[data-testid="marketplace-profile"]',
    ) as HTMLButtonElement;
    expect(profileButton.getAttribute("aria-label")).toBe("Sign in");
    expect(profileButton.className).toContain("h-10");
    expect(profileButton.className).toContain("w-10");
    expect(profileButton.className).toContain("rounded-full");
    await act(async () => {
      profileButton.click();
    });
    expect(openSignIn).toHaveBeenCalledOnce();
    const bell = document.querySelector('[aria-label="Notifications"]') as HTMLElement;
    expect(bell.dataset.variant).toBe("marketplace");
    const search = document.querySelector('input[aria-label="Search Hashpop"]') as HTMLInputElement;
    expect(search.placeholder).toBe("Search Hashpop…");
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

  it("opens Sort from the sliders and the filter sheet from Filter", async () => {
    const pushes: string[] = [];
    function Harness() {
      const [filters, setFilters] = useState(false);
      const [sort, setSort] = useState(false);
      const [draft, setDraft] = useState<AdvancedFilterDraft>(emptyDraft);
      const params = new URLSearchParams("q=sony");
      return createElement(MarketplaceMobileHeader, {
        searchValue: "",
        onSearchChange: () => {},
        onSearchSubmit: (event: FormEvent) => event.preventDefault(),
        filterOpen: filters,
        onOpenFilters: () => {
          setSort(false);
          setFilters(true);
        },
        onCloseFilters: () => setFilters(false),
        filterCount: 2,
        resultCount: 4,
        onClearFilters: () => pushes.push("clear"),
        onShowResults: () => pushes.push(marketplaceHref(withAdvancedFilters(params, draft))),
        filterSheet: createElement(MarketplaceFilterPanel, {
          browse: true,
          showSort: false,
          showActions: false,
          sortMode: "recent",
          type: "all",
          category: "Watches",
          categories: ["Watches"],
          cities: ["Austin"],
          draft,
          onDraft: setDraft,
          onSort: () => {},
          onType: (type) => pushes.push(marketplaceHref(withListingType(params, type))),
          onCategory: (category) => pushes.push(marketplaceHref(withCategory(params, category))),
          onReset: () => {},
          onApply: () => {},
        }),
        sortOpen: sort,
        onOpenSort: () => {
          setFilters(false);
          setSort(true);
        },
        onCloseSort: () => setSort(false),
        sortSheet: createElement(MarketplaceSortPanel, {
          sortMode: "recent",
          viewMode: "grid",
          onSort: (mode) => pushes.push(marketplaceHref(withSort(params, mode))),
          onView: (view) => pushes.push(view),
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
    const filterButton = document.querySelector(
      '[data-testid="marketplace-filter-button"]',
    ) as HTMLButtonElement;
    expect(filterButton.textContent).toContain("Filter · 2");
    expect(filterButton.className).toContain("border-[#00ffa3]");
    expect(filterButton.className).not.toContain("border-[#00ffa3]/40");

    const sliders = document.querySelector(
      '[data-testid="marketplace-sort-button"]',
    ) as HTMLButtonElement;
    await act(async () => {
      sliders.click();
    });
    expect(document.querySelector('[role="dialog"][aria-label="Sort"]')).toBeTruthy();
    expect(document.querySelector('[role="dialog"][aria-label="Filters"]')).toBeNull();
    await act(async () => {
      (document.querySelector('[data-testid="sort-price-asc"]') as HTMLButtonElement).click();
    });
    expect(pushes.at(-1)).toContain("sort=price-asc");
    await act(async () => {
      (document.querySelector('[data-testid="view-editorial"]') as HTMLButtonElement).click();
    });
    expect(pushes.at(-1)).toBe("editorial");

    await act(async () => {
      filterButton.click();
    });
    expect(document.querySelector('[role="dialog"][aria-label="Filters"]')).toBeTruthy();
    expect(document.querySelector('[role="dialog"][aria-label="Sort"]')).toBeNull();
    expect(document.querySelector('[data-testid="sort-recent"]')).toBeNull();
    const selected = document.querySelector(
      '[data-testid="listing-category-Watches"]',
    ) as HTMLElement;
    expect(selected.className).toContain("bg-material-chrome");
    expect(selected.className).toContain("text-chrome");

    await act(async () => {
      (
        document.querySelector('[data-testid="listing-type-physical"]') as HTMLButtonElement
      ).click();
    });
    expect(pushes.at(-1)).toContain("type=physical");
    expect(pushes.at(-1)).toContain("q=sony");
    expect(pushes.at(-1)).not.toContain("category=");

    const min = document.querySelector('[data-testid="filter-min-price"]') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(min, "1.5");
      min.dispatchEvent(new Event("input", { bubbles: true }));
      min.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      (document.querySelector('[data-testid="filter-show"]') as HTMLButtonElement).click();
    });
    expect(pushes.at(-1)).toContain("minPrice=1.5");
    expect(document.body.textContent).toContain("Show 4 results");
  });
});
