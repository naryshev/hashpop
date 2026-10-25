import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ListingFetchFallback } from "../ListingFetchFallback";

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

describe("ListingFetchFallback", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  afterEach(() => {
    root?.unmount();
    host?.remove();
    root = null;
    host = null;
  });

  function render(phase: "loading" | "missing" | "unavailable") {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    root.render(createElement(ListingFetchFallback, { phase, onRetry: vi.fn() }));
    return host;
  }

  it("shows a marketplace link on a confirmed miss and does not spin", async () => {
    const el = render("missing");
    await vi.waitFor(() => {
      expect(el.textContent).toContain("Listing not found");
    });
    expect(el.querySelector("a")?.getAttribute("href")).toBe("/marketplace");
    expect(el.textContent).not.toContain("Loading…");
  });

  it("offers a retry on a transient failure and does not claim the listing loaded", async () => {
    const el = render("unavailable");
    await vi.waitFor(() => {
      expect(el.textContent).toContain("Try again");
    });
    expect(el.querySelector("a")?.getAttribute("href")).toBe("/marketplace");
    expect(el.textContent).not.toContain("Loading…");
  });
});
