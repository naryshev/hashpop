import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopShell } from "../DesktopShell";

const nav = vi.hoisted(() => ({ pathname: "/marketplace" }));

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
  useHashpackWallet: () => ({ isConnected: false, accountId: null, address: null }),
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

vi.mock("../ProfileCardSheet", () => ({
  ProfileCardSheet: () => null,
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
  });
});
