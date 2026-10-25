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

vi.mock("../MessagesModal", () => ({
  MessagesModal: () => null,
}));

vi.mock("../Footer", () => ({
  Footer: () => createElement("footer", null, "footer"),
}));

vi.mock("../MobileTopBar", () => ({
  MobileTopBar: () => createElement("div", { "data-testid": "mobile-top-bar" }, "mobile"),
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

  it("hides the icon row, Connect chip, and Sign in pill on marketplace", async () => {
    await renderShell();
    expect(document.querySelector('nav[aria-label="Primary navigation"]')).toBeNull();
    expect(document.body.textContent).not.toContain("Sign in");
    expect(document.body.textContent).not.toContain("Connect");
    expect(document.querySelector('[data-testid="mobile-top-bar"]')).toBeNull();
    expect(document.body.textContent).toContain("page");
  });

  it("keeps the shared desktop bar on other routes", async () => {
    nav.pathname = "/purchases";
    await renderShell();
    expect(document.querySelector('nav[aria-label="Primary navigation"]')).toBeTruthy();
    expect(document.body.textContent).toContain("Sign in");
    expect(document.querySelector('[data-testid="mobile-top-bar"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="marketplace-brand-header"]')).toBeNull();
    const shellHeader = document.querySelector("header");
    expect(shellHeader?.className).toContain("hp-desktop-bar");
    expect(shellHeader?.className).toContain("h-0");
    expect(shellHeader?.className).toContain("md:h-14");
    expect(shellHeader?.className).not.toContain(" h-14 ");
  });

  it.each(["/cart", "/messages", "/offers", "/create", "/dashboard", "/profile/0.0.1234"])(
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
    },
  );

  it("keeps the zero-height desktop bar on create and the brand row on mobile only", async () => {
    nav.pathname = "/create";
    await renderShell();
    const shellHeader = document.querySelector("header.hp-desktop-bar") as HTMLElement;
    expect(shellHeader.className).toContain("h-0");
    expect(shellHeader.className).toContain("md:h-14");
    const brand = document.querySelector('[data-testid="marketplace-brand-header"]') as HTMLElement;
    expect(brand.parentElement?.className).toBe("hp-brand-safe-top");
    expect(brand.parentElement?.parentElement?.className).toContain("md:hidden");
    expect(document.querySelector('[data-testid="mobile-top-bar"]')).toBeNull();
    expect(document.querySelector('[data-testid="marketplace-search-field"]')).toBeNull();
    expect(document.querySelector('[data-testid="marketplace-filter-button"]')).toBeNull();
    expect(document.querySelector('nav[aria-label="Primary navigation"]')).toBeTruthy();
  });

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

  it("keeps the shell bar on purchases", async () => {
    nav.pathname = "/purchases";
    await renderShell();
    expect(document.querySelector('[data-testid="marketplace-desktop-header"]')).toBeNull();
    expect(document.querySelector('nav[aria-label="Primary navigation"]')).toBeTruthy();
  });

  it("links the desktop account chip to the profile", async () => {
    wallet.isConnected = true;
    wallet.address = "0xabc";
    nav.pathname = "/purchases";
    await renderShell();
    const chip = document.querySelector('[aria-label="Open profile"]') as HTMLAnchorElement;
    expect(chip.tagName).toBe("A");
    expect(chip.getAttribute("href")).toBe("/profile/0xabc");
    expect(document.body.textContent).not.toContain("Your profile");
  });
});
