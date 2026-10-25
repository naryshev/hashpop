import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BottomNav } from "../BottomNav";

const nav = vi.hoisted(() => ({
  replace: vi.fn(),
  search: "",
  pathname: "/marketplace",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ replace: nav.replace }),
  useSearchParams: () => new URLSearchParams(nav.search),
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

vi.mock("../../lib/cart", () => ({
  useCart: () => ({ count: 0, ids: [] }),
}));

vi.mock("../../hooks/useUnreadCount", () => ({
  useUnreadCount: () => 0,
}));

vi.mock("../NearbyMap", () => ({
  NearbyMap: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open
      ? createElement(
          "div",
          { "data-testid": "nearby-overlay" },
          createElement("button", { type: "button", onClick: onClose }, "Close nearby"),
        )
      : null,
}));

let root: Root | undefined;
let host: HTMLElement | undefined;

describe("Nearby deep link", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    nav.replace.mockClear();
    nav.search = "";
    nav.pathname = "/marketplace";
  });

  afterEach(async () => {
    const current = root;
    if (current) {
      await act(async () => {
        current.unmount();
      });
    }
    host?.remove();
    root = undefined;
    host = undefined;
  });

  async function renderNav() {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root!.render(createElement(BottomNav));
    });
  }

  it("opens the overlay when the marketplace URL has view=nearby", async () => {
    nav.search = "view=nearby";
    await renderNav();
    expect(document.querySelector('[data-testid="nearby-overlay"]')).not.toBeNull();
  });

  it("drops view=nearby with replace when the overlay closes", async () => {
    nav.search = "q=bike&view=nearby";
    await renderNav();
    const close = document.querySelector('[data-testid="nearby-overlay"] button');
    expect(close?.textContent).toBe("Close nearby");
    await act(async () => {
      close!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.querySelector('[data-testid="nearby-overlay"]')).toBeNull();
    expect(nav.replace).toHaveBeenCalledWith("/marketplace?q=bike", { scroll: false });
  });
});
