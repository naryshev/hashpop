import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopShell } from "../DesktopShell";

const { nav, wallet } = vi.hoisted(() => ({
  nav: { pathname: "/marketplace" },
  wallet: {
    isConnected: false,
    accountId: null as string | null,
    address: null as string | null,
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

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("../../lib/hashpackWallet", () => ({
  useHashpackWallet: () => wallet,
}));

vi.mock("../../lib/signInModal", () => ({
  useSignInModal: () => ({ openSignIn: vi.fn() }),
}));

vi.mock("../../hooks/useUnreadCount", () => ({
  useUnreadCount: () => 0,
}));

vi.mock("../NotificationBell", () => ({
  NotificationBell: () => null,
}));

vi.mock("../Footer", () => ({
  Footer: () => createElement("footer", null, "footer"),
}));

let root: Root | undefined;
let host: HTMLElement | undefined;

async function renderShell() {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(createElement(DesktopShell, null, createElement("div", null, "page")));
  });
}

describe("DesktopShell marketplace chrome", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    nav.pathname = "/marketplace";
    wallet.isConnected = false;
    wallet.accountId = null;
    wallet.address = null;
    window.localStorage.clear();
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

  it.each(["/marketplace", "/"])(
    "hides the icon row, Connect chip, and Sign in pill on %s",
    async (pathname) => {
      nav.pathname = pathname;
      await renderShell();
      expect(document.querySelector('nav[aria-label="Primary navigation"]')).toBeNull();
      expect(document.body.textContent).not.toContain("Sign in");
      expect(document.body.textContent).not.toContain("Connect");
      // The page renders its own MarketplaceDesktopHeader here, not the shell.
      expect(document.querySelector('[data-testid="marketplace-desktop-header"]')).toBeNull();
      expect(document.body.textContent).toContain("page");
      expect(document.querySelector("footer")).toBeTruthy();
    },
  );

  it.each([
    "/purchases",
    "/support",
    "/help",
    "/about",
    "/listing/lst-galaxy",
    "/profile/0.0.1234",
    "/cart",
    "/messages",
    "/offers",
    "/create",
    "/watchlist",
    "/categories",
    "/dashboard",
    "/activity",
    "/purchase-success/1",
    "/terms",
    "/privacy",
    "/no-such-page",
  ])(
    "uses the new marketplace desktop header (never the old compact bar) on %s",
    async (pathname) => {
      nav.pathname = pathname;
      await renderShell();
      const headers = document.querySelectorAll("header");
      expect(headers).toHaveLength(1);
      const header = document.querySelector(
        '[data-testid="marketplace-desktop-header"]',
      ) as HTMLElement;
      expect(header).toBeTruthy();
      expect(header.className).toContain("hp-desktop-bar");
      expect(header.className).toContain("md:h-[72px]");
      expect(document.querySelector('[data-testid="marketplace-desktop-brand"]')).toBeTruthy();
      expect(document.querySelector('nav[aria-label="Primary navigation"]')).toBeNull();
      expect(document.body.textContent).not.toContain("Search listings");
      expect(document.body.textContent).not.toContain("Sign in");
      const input = header.querySelector(
        'input[aria-label="Search marketplace"]',
      ) as HTMLInputElement;
      expect(input.placeholder).toBe("Search marketplace…");
      expect(
        document.querySelector('[data-testid="marketplace-desktop-create"]')?.textContent,
      ).toBe("Create");
      expect(document.querySelector('[data-testid="marketplace-desktop-cart"]')).toBeTruthy();
      // Signed out, the avatar is the sign-in control.
      const profile = document.querySelector(
        '[data-testid="marketplace-desktop-profile"]',
      ) as HTMLElement;
      expect(profile.getAttribute("aria-label")).toBe("Sign in");
    },
  );

  it.each([
    "/cart",
    "/messages",
    "/purchases",
    "/offers",
    "/create",
    "/dashboard",
    "/profile/0.0.1234",
  ])(
    "uses the marketplace brand header on %s without search or the old mobile bar",
    async (pathname) => {
      nav.pathname = pathname;
      await renderShell();
      const brand = document.querySelector(
        '[data-testid="marketplace-brand-header"]',
      ) as HTMLElement;
      expect(brand).toBeTruthy();
      expect(brand.className).toContain("grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]");
      expect(brand.parentElement?.className).toBe("hp-brand-safe-top");
      expect(brand.parentElement?.parentElement?.className).toContain("md:hidden");
      expect(brand.parentElement?.parentElement?.className).not.toContain("pt-[");
      expect(brand.parentElement?.className).not.toContain("mb-");
      const wordmark = document.querySelector(
        '[data-testid="marketplace-wordmark"]',
      ) as HTMLElement;
      expect(wordmark.textContent).toBe("marketplace");
      expect(wordmark.className).toContain("text-white/60");
      expect(document.querySelector('[data-testid="marketplace-logo"]')).toBeTruthy();
      expect(document.querySelector('[data-testid="hashpop-ring-o"]')).toBeTruthy();
      expect(document.querySelector('[data-testid="marketplace-profile"]')).toBeTruthy();
      expect(document.querySelector('[data-testid="mobile-top-bar"]')).toBeNull();
      expect(document.querySelector('[data-testid="marketplace-search-field"]')).toBeNull();
      expect(document.querySelector('[data-testid="marketplace-filter-button"]')).toBeNull();
      expect(wordmark.textContent).not.toBe("cart");
      expect(wordmark.textContent).not.toBe("messages");
      const logo = document.querySelector('[data-testid="marketplace-logo"]') as HTMLElement;
      expect(logo.querySelector(".sr-only")?.textContent).toBe("Hashpop");
      expect(logo.getAttribute("aria-label")).toBe("Hashpop");
      const visual = [...logo.querySelectorAll("[aria-hidden='true']")].map(
        (node) => node.textContent,
      );
      expect(visual.join("")).toBe("Hashpp");
      expect(logo.textContent?.replace(/\s+/g, "")).toContain("Hashpop");
    },
  );

  it.each(["/listing/lst-galaxy", "/terms", "/privacy"])(
    "uses the shared marketplace desktop header on %s",
    async (pathname) => {
      nav.pathname = pathname;
      await renderShell();
      const header = document.querySelector(
        '[data-testid="marketplace-desktop-header"]',
      ) as HTMLElement;
      expect(header).toBeTruthy();
      expect(header.className).toContain("hp-desktop-bar");
      expect(header.className).toContain("md:h-[72px]");
      expect(document.querySelector('nav[aria-label="Primary navigation"]')).toBeNull();
      expect(document.body.textContent).not.toContain("Search listings");
      expect(document.body.textContent).not.toContain("Sign in");
      const input = header.querySelector(
        'input[aria-label="Search marketplace"]',
      ) as HTMLInputElement;
      expect(input.placeholder).toBe("Search marketplace…");
      expect(
        document.querySelector('[data-testid="marketplace-desktop-create"]')?.textContent,
      ).toBe("Create");
      expect(document.querySelector('[data-testid="marketplace-desktop-profile"]')).toBeTruthy();
    },
  );

  it.each(["/terms", "/privacy"])(
    "uses the marketplace brand header on mobile for %s",
    async (pathname) => {
      nav.pathname = pathname;
      await renderShell();
      const brand = document.querySelector(
        '[data-testid="marketplace-brand-header"]',
      ) as HTMLElement;
      expect(brand).toBeTruthy();
      expect(brand.parentElement?.className).toBe("hp-brand-safe-top");
      expect(brand.parentElement?.parentElement?.className).toContain("md:hidden");
      expect(document.querySelector('[data-testid="mobile-top-bar"]')).toBeNull();
      expect(document.querySelector('[data-testid="marketplace-search-field"]')).toBeNull();
      expect(document.querySelector('[data-testid="marketplace-filter-button"]')).toBeNull();
    },
  );

  it("leaves listing mobile on its own chrome", async () => {
    nav.pathname = "/listing/lst-galaxy";
    await renderShell();
    expect(document.querySelector('[data-testid="marketplace-brand-header"]')).toBeNull();
    expect(document.querySelector('[data-testid="mobile-top-bar"]')).toBeNull();
    expect(document.querySelector('[data-testid="marketplace-desktop-header"]')).toBeTruthy();
  });

  it("uses the shared marketplace desktop header on /about", async () => {
    nav.pathname = "/about";
    await renderShell();
    const header = document.querySelector(
      '[data-testid="marketplace-desktop-header"]',
    ) as HTMLElement;
    expect(header).toBeTruthy();
    expect(header.className).toContain("hp-desktop-bar");
    expect(header.className).toContain("md:h-[72px]");
    expect(document.querySelector('nav[aria-label="Primary navigation"]')).toBeNull();
    expect(document.body.textContent).not.toContain("Search listings");
    expect(document.body.textContent).not.toContain("Sign in");
    const input = header.querySelector(
      'input[aria-label="Search marketplace"]',
    ) as HTMLInputElement;
    expect(input.placeholder).toBe("Search marketplace…");
    expect(document.querySelector('[data-testid="marketplace-desktop-create"]')?.textContent).toBe(
      "Create",
    );
    expect(document.querySelector('[data-testid="marketplace-desktop-profile"]')).toBeTruthy();
    const brand = document.querySelector('[data-testid="marketplace-brand-header"]') as HTMLElement;
    expect(brand).toBeTruthy();
    expect(brand.parentElement?.parentElement?.className).toContain("md:hidden");
    expect(document.querySelector('[data-testid="mobile-top-bar"]')).toBeNull();
    expect(document.querySelector("footer")).toBeTruthy();
  });

  it("links the desktop profile avatar to the signed-in profile", async () => {
    wallet.isConnected = true;
    wallet.address = "0xabc";
    nav.pathname = "/purchases";
    await renderShell();
    const chip = document.querySelector(
      '[data-testid="marketplace-desktop-profile"]',
    ) as HTMLAnchorElement;
    expect(chip.getAttribute("aria-label")).toBe("Open profile");
    expect(chip.tagName).toBe("A");
    expect(chip.getAttribute("href")).toBe("/profile/0xabc");
    expect(document.body.textContent).not.toContain("Your profile");
  });
});
