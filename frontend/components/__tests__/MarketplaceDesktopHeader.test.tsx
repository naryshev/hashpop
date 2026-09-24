import { createElement, act, type FormEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketplaceDesktopHeader } from "../MarketplaceDesktopHeader";

const { wallet, openSignIn } = vi.hoisted(() => ({
  wallet: {
    accountId: null as string | null,
    address: null as string | null,
    isConnected: false,
  },
  openSignIn: vi.fn(),
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
  useProfile: () => undefined,
  profileAvatarUrl: () => null,
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
  ProfileCardSheet: () => null,
}));

let root: Root | undefined;
let host: HTMLElement | undefined;

async function renderHeader() {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(
      createElement(MarketplaceDesktopHeader, {
        searchValue: "",
        onSearchChange: () => {},
        onSearchSubmit: (event: FormEvent) => event.preventDefault(),
      }),
    );
  });
}

describe("MarketplaceDesktopHeader", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    wallet.isConnected = false;
    wallet.accountId = null;
    wallet.address = null;
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

  it("puts the cart mark left of the mint ring-o wordmark", async () => {
    await renderHeader();
    const header = document.querySelector(
      '[data-testid="marketplace-desktop-header"]',
    ) as HTMLElement;
    expect(header.className).toContain("hidden");
    expect(header.className).toContain("md:grid");
    const brand = document.querySelector(
      '[data-testid="marketplace-desktop-brand"]',
    ) as HTMLElement;
    expect(brand.className).toContain("gap-2.5");
    const cart = brand.querySelector('[data-testid="marketplace-cart-mark"]') as HTMLImageElement;
    const logo = brand.querySelector('[data-testid="marketplace-logo"]') as SVGElement;
    expect(cart.tagName.toLowerCase()).toBe("img");
    expect(cart.getAttribute("src")).toBe("/hashpop-cart-3d.PNG");
    expect(brand.querySelectorAll("svg")).toHaveLength(1);
    expect(brand.contains(document.querySelector('[data-testid="marketplace-desktop-cart"]'))).toBe(
      false,
    );
    expect(cart.compareDocumentPosition(logo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(logo.className.baseVal).toContain("h-8");
    expect(logo.className.baseVal).toContain("text-white");
    expect(logo.querySelector("path")?.getAttribute("fill")).toBe("currentColor");
    const ring = logo.querySelector('[data-testid="hashpop-ring-o"]') as SVGGElement;
    expect(ring.getAttribute("fill")).toBe("var(--color-chrome)");
    expect(header.querySelector('[data-testid="marketplace-wordmark"]')).toBeNull();
  });

  it("uses neutral glass search and a mint Create control", async () => {
    await renderHeader();
    const header = document.querySelector(
      '[data-testid="marketplace-desktop-header"]',
    ) as HTMLElement;
    const search = document.querySelector(
      '[data-testid="marketplace-desktop-search"]',
    ) as HTMLElement;
    expect(search.className).toContain("bg-white/[0.06]");
    expect(search.className).toContain("backdrop-blur-md");
    expect(search.className).toContain("border-white/10");
    const input = header.querySelector(
      'input[aria-label="Search marketplace"]',
    ) as HTMLInputElement;
    expect(input.placeholder).toBe("Search marketplace…");
    const create = document.querySelector(
      '[data-testid="marketplace-desktop-create"]',
    ) as HTMLAnchorElement;
    expect(create.textContent).toBe("Create");
    expect(create.getAttribute("href")).toBe("/create");
    expect(create.className).toContain("text-[#00ffa3]");
    const cart = document.querySelector(
      '[data-testid="marketplace-desktop-cart"]',
    ) as HTMLAnchorElement;
    expect(cart.getAttribute("href")).toBe("/cart");
    expect(cart.getAttribute("aria-label")).toBe("Cart");
    const bell = document.querySelector('[aria-label="Notifications"]') as HTMLElement;
    expect(bell.dataset.variant).toBe("marketplace");
    const profile = document.querySelector(
      '[data-testid="marketplace-desktop-profile"]',
    ) as HTMLButtonElement;
    expect(profile.className).toContain("rounded-full");
    expect(profile.className).toContain("h-10");
    expect(header.textContent).not.toContain("Sign in");
    expect(header.textContent).not.toContain("Connect");
    expect(header.textContent).not.toContain("Trending");
    expect(header.textContent).not.toContain("New Arrivals");
    expect(header.textContent).not.toContain("Top Sellers");
    expect(header.textContent).not.toContain("Collections");
    await act(async () => {
      profile.click();
    });
    expect(openSignIn).toHaveBeenCalledOnce();
  });

  it("shows a cart badge only when the cart is non-empty", async () => {
    window.localStorage.setItem("hashpop.cart.v1", JSON.stringify(["a", "b"]));
    await renderHeader();
    const badge = document.querySelector("[data-dock-badge]") as HTMLElement;
    expect(badge.textContent).toBe("2");
    const cart = document.querySelector(
      '[data-testid="marketplace-desktop-cart"]',
    ) as HTMLAnchorElement;
    expect(cart.getAttribute("aria-label")).toBe("Cart, 2");
  });
});
