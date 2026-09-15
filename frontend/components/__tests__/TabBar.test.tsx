import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TabBar, type TabBarItem } from "../ui/TabBar";

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

let root: Root | undefined;
let host: HTMLElement | undefined;

const items: TabBarItem[] = [
  { id: "marketplace", label: "Marketplace", href: "/marketplace", icon: createElement("span") },
  { id: "nearby", label: "Nearby", icon: createElement("span") },
  { id: "cart", label: "Cart", href: "/cart", icon: createElement("span"), badge: 3 },
  { id: "messages", label: "Messages", href: "/messages", icon: createElement("span"), badge: 12 },
];

async function render(props?: Partial<React.ComponentProps<typeof TabBar>>) {
  host = document.createElement("div");
  document.body.appendChild(host);
  const next = createRoot(host);
  root = next;
  await act(async () => {
    next.render(
      createElement(TabBar, {
        items,
        centerAction: { href: "/create", label: "Create listing" },
        ...props,
      }),
    );
  });
}

describe("TabBar badges", () => {
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

  it("shows cart unique-count and messages 9+ on the dock", async () => {
    await render();
    const cart = document.querySelector('a[href="/cart"]');
    const messages = document.querySelector('a[href="/messages"]');
    expect(cart?.getAttribute("aria-label")).toBe("Cart, 3");
    expect(messages?.getAttribute("aria-label")).toBe("Messages, 9+");
    expect(cart?.querySelector("[data-dock-badge]")?.textContent).toBe("3");
    expect(messages?.querySelector("[data-dock-badge]")?.textContent).toBe("9+");
  });

  it("hides the whole bar when immersive", async () => {
    await render({ hidden: true });
    expect(document.querySelector('nav[aria-label="Primary navigation"]')).toBeNull();
  });
});
