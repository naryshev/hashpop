import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketplaceDesktopToolbar } from "../MarketplaceDesktopToolbar";

let root: Root | undefined;
let host: HTMLElement | undefined;

describe("MarketplaceDesktopToolbar", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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

  it("counts results and collapses the rail to a Filter button below lg", async () => {
    const onSort = vi.fn();
    const onOpenFilters = vi.fn();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(
        createElement(MarketplaceDesktopToolbar, {
          resultCount: 6,
          sortMode: "recent",
          filterCount: 0,
          onSort,
          onOpenFilters,
        }),
      );
    });
    const bar = document.querySelector(
      '[data-testid="marketplace-desktop-toolbar"]',
    ) as HTMLElement;
    expect(bar.className).toContain("hidden");
    expect(bar.className).toContain("md:flex");
    expect(document.querySelector('[data-testid="marketplace-result-count"]')?.textContent).toBe(
      "6 results",
    );
    const filter = document.querySelector(
      '[data-testid="marketplace-desktop-filter"]',
    ) as HTMLButtonElement;
    expect(filter.className).toContain("lg:hidden");
    expect(filter.textContent).toContain("Filter");
    await act(async () => {
      filter.click();
    });
    expect(onOpenFilters).toHaveBeenCalledOnce();

    await act(async () => {
      (
        document.querySelector('[data-testid="marketplace-sort-trigger"]') as HTMLButtonElement
      ).click();
    });
    await act(async () => {
      (
        document.querySelector('[data-testid="desktop-sort-price-asc"]') as HTMLButtonElement
      ).click();
    });
    expect(onSort).toHaveBeenCalledWith("price-asc");
    expect(document.querySelector('[data-testid="marketplace-view-trigger"]')).toBeNull();
    expect(document.querySelector('[data-testid="desktop-view-editorial"]')).toBeNull();
    expect(document.querySelector('[data-testid="desktop-view-feed"]')).toBeNull();
  });
});
