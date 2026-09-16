import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BottomNav } from "../BottomNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/marketplace",
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
  useCart: () => ({ count: 2, ids: ["a", "b"] }),
}));

vi.mock("../../hooks/useUnreadCount", () => ({
  useUnreadCount: () => 4,
}));

vi.mock("../NearbyMap", () => ({
  NearbyMap: () => null,
}));

let root: Root | undefined;
let host: HTMLElement | undefined;

describe("BottomNav badges", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(async () => {
    const current = root;
    if (current) {
      await act(async () => {
        current.unmount();
      });
    }
    host?.remove();
  });

  it("passes unique cart count and unread thread count to the dock", async () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root!.render(createElement(BottomNav));
    });
    expect(document.querySelector('a[href="/cart"]')?.getAttribute("aria-label")).toBe("Cart, 2");
    expect(document.querySelector('a[href="/messages"]')?.getAttribute("aria-label")).toBe(
      "Messages, 4",
    );
  });

  it("hides the dock on immersive deal-room", async () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root!.render(createElement(BottomNav));
    });
    await act(async () => {
      window.dispatchEvent(new CustomEvent("hashpop:immersive", { detail: true }));
    });
    expect(document.querySelector('nav[aria-label="Primary navigation"]')).toBeNull();
  });
});
