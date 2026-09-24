import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MarketplaceBrowseRail,
  MarketplaceFilterDrawer,
  priceBoundsToParams,
} from "../MarketplaceBrowseRail";

let root: Root | undefined;
let host: HTMLElement | undefined;

async function renderRail(props: Partial<React.ComponentProps<typeof MarketplaceBrowseRail>> = {}) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  const onType = vi.fn();
  const onLocation = vi.fn();
  const onCondition = vi.fn();
  const onPrice = vi.fn();
  const onClear = vi.fn();
  await act(async () => {
    root?.render(
      createElement(MarketplaceBrowseRail, {
        type: "all",
        location: "",
        condition: "",
        minPrice: "",
        maxPrice: "",
        cities: ["Austin", "Denver"],
        onType,
        onLocation,
        onCondition,
        onPrice,
        onClear,
        ...props,
      }),
    );
  });
  return { onType, onLocation, onCondition, onPrice, onClear };
}

describe("priceBoundsToParams", () => {
  it("omits bounds that sit on the scale ends", () => {
    expect(priceBoundsToParams(0, 500, 500)).toEqual({ minPrice: "", maxPrice: "" });
    expect(priceBoundsToParams(20, 500, 500)).toEqual({ minPrice: "20", maxPrice: "" });
    expect(priceBoundsToParams(0, 180, 500)).toEqual({ minPrice: "", maxPrice: "180" });
    expect(priceBoundsToParams(40, 220, 500)).toEqual({ minPrice: "40", maxPrice: "220" });
  });
});

describe("MarketplaceBrowseRail", () => {
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
    document.body.innerHTML = "";
  });

  it("renders type, location, ℏ price, and condition without categories", async () => {
    await renderRail();
    const rail = document.querySelector('[data-testid="marketplace-browse-rail"]') as HTMLElement;
    expect(rail.textContent).toContain("Type");
    expect(rail.textContent).toContain("Location");
    expect(rail.textContent).toContain("Price Range");
    expect(rail.textContent).toContain("Condition");
    expect(rail.textContent).not.toMatch(/categor/i);
    expect(rail.textContent).not.toContain("$");
    expect(document.querySelector('[data-testid="rail-price-label"]')?.textContent).toBe(
      "0 ℏ — 500 ℏ",
    );
    const all = document.querySelector('[data-testid="rail-type-all"]') as HTMLButtonElement;
    expect(all.getAttribute("aria-pressed")).toBe("true");
    expect(all.className).toContain("border-[#00ffa3]");
    expect(all.className).toContain("text-[#00ffa3]");
    const location = document.querySelector('[data-testid="rail-location"]') as HTMLSelectElement;
    expect(location.value).toBe("");
    expect(location.options[0]?.textContent).toBe("Anywhere");
    const condition = document.querySelector('[data-testid="rail-condition"]') as HTMLSelectElement;
    expect(condition.options[0]?.textContent).toBe("Any Condition");
    const clear = document.querySelector('[data-testid="browse-rail-clear"]') as HTMLButtonElement;
    expect(clear.disabled).toBe(true);
  });

  it("writes type, location, condition, price, and clear through callbacks", async () => {
    const { onType, onLocation, onCondition, onPrice, onClear } = await renderRail({
      type: "physical",
    });
    await act(async () => {
      (document.querySelector('[data-testid="rail-type-digital"]') as HTMLButtonElement).click();
    });
    expect(onType).toHaveBeenCalledWith("digital");

    const location = document.querySelector('[data-testid="rail-location"]') as HTMLSelectElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      setter?.call(location, "Austin");
      location.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onLocation).toHaveBeenCalledWith("Austin");

    const condition = document.querySelector('[data-testid="rail-condition"]') as HTMLSelectElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      setter?.call(condition, "Used");
      condition.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onCondition).toHaveBeenCalledWith("Used");

    const max = document.querySelector('[data-testid="rail-max-price"]') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(max, "180");
      max.dispatchEvent(new Event("input", { bubbles: true }));
      max.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onPrice).toHaveBeenCalledWith("", "180");

    const clear = document.querySelector('[data-testid="browse-rail-clear"]') as HTMLButtonElement;
    expect(clear.disabled).toBe(false);
    await act(async () => {
      clear.click();
    });
    expect(onClear).toHaveBeenCalledOnce();
  });
});

describe("MarketplaceFilterDrawer", () => {
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
    document.body.innerHTML = "";
  });

  it("shows the same rail fields and closes on Escape", async () => {
    const onClose = vi.fn();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(
        createElement(
          MarketplaceFilterDrawer,
          { open: true, onClose },
          createElement(MarketplaceBrowseRail, {
            type: "all",
            location: "",
            condition: "",
            minPrice: "",
            maxPrice: "",
            cities: [],
            onType: () => {},
            onLocation: () => {},
            onCondition: () => {},
            onPrice: () => {},
            onClear: () => {},
          }),
        ),
      );
    });
    const drawer = document.querySelector(
      '[data-testid="marketplace-filter-drawer"]',
    ) as HTMLElement;
    expect(drawer.className).toContain("lg:hidden");
    expect(drawer.textContent).not.toMatch(/categor/i);
    expect(document.querySelector('[data-testid="rail-type-all"]')).toBeTruthy();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
