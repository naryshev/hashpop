import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ListingVariantsEditor } from "../ListingVariantsEditor";
import { ListingVariantPicker } from "../ListingVariantPicker";
import type { ListingVariant } from "../../lib/listingVariants";

let root: Root | undefined;
let host: HTMLElement | undefined;

async function render(node: React.ReactElement) {
  if (!host) {
    host = document.createElement("div");
    document.body.appendChild(host);
  }
  if (!root) {
    root = createRoot(host);
  }
  await act(async () => {
    root!.render(node);
  });
}

describe("ListingVariantsEditor", () => {
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
    root = undefined;
    host?.remove();
    host = undefined;
  });

  it("adds, reorders, and removes options", async () => {
    let variants: ListingVariant[] = [
      { id: "a", label: "Black", price: "100", mediaIndex: null },
      { id: "b", label: "Blue", price: "110", mediaIndex: null },
    ];
    const rerender = async () => {
      await render(
        createElement(ListingVariantsEditor, {
          variants,
          onChange: (next) => {
            variants = next;
          },
          defaultPrice: "100",
        }),
      );
    };
    await rerender();
    const labels = () =>
      Array.from(
        document.querySelectorAll('input[placeholder="e.g. Blue · 256GB · Like new"]'),
      ).map((el) => (el as HTMLInputElement).value);
    expect(labels()).toEqual(["Black", "Blue"]);

    await act(async () => {
      const add = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Add option"),
      );
      add?.click();
    });
    await rerender();
    expect(variants).toHaveLength(3);
    expect(variants[2].price).toBe("100");

    await act(async () => {
      const down = document.querySelector(
        'button[aria-label="Move option 1 down"]',
      ) as HTMLButtonElement;
      down.click();
    });
    await rerender();
    expect(variants.map((v) => v.id)).toEqual(["b", "a", variants[2].id]);

    await act(async () => {
      const remove = document.querySelector(
        'button[aria-label="Remove option Black"]',
      ) as HTMLButtonElement;
      remove.click();
    });
    await rerender();
    expect(variants.map((v) => v.label)).toEqual(["Blue", ""]);
  });

  it("uses 44px glass chips for reorder and remove", async () => {
    await render(
      createElement(ListingVariantsEditor, {
        variants: [
          { id: "a", label: "Black", price: "100", mediaIndex: null },
          { id: "b", label: "Blue", price: "110", mediaIndex: null },
        ],
        onChange: () => {},
      }),
    );
    const up = document.querySelector('button[aria-label="Move option 2 up"]') as HTMLButtonElement;
    const down = document.querySelector(
      'button[aria-label="Move option 1 down"]',
    ) as HTMLButtonElement;
    const remove = document.querySelector(
      'button[aria-label="Remove option Black"]',
    ) as HTMLButtonElement;
    for (const btn of [up, down, remove]) {
      expect(btn.className).toMatch(/\bh-11\b/);
      expect(btn.className).toMatch(/\bw-11\b/);
      expect(btn.className).toContain("bg-material-regular");
      expect(btn.className).not.toMatch(/\bh-7\b/);
    }
  });
});

describe("ListingVariantPicker", () => {
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
    root = undefined;
    host?.remove();
    host = undefined;
  });

  it("renders nothing without variants and selects an option", async () => {
    await render(
      createElement(ListingVariantPicker, {
        variants: [],
        selectedId: null,
        onSelect: () => {},
      }),
    );
    expect(document.body.textContent).toBe("");

    let selected = "a";
    const variants: ListingVariant[] = [
      { id: "a", label: "128GB", price: "80", mediaIndex: null },
      { id: "b", label: "256GB", price: "95", mediaIndex: 1 },
    ];
    await render(
      createElement(ListingVariantPicker, {
        variants,
        selectedId: selected,
        onSelect: (id) => {
          selected = id;
        },
      }),
    );
    expect(document.body.textContent).toContain("128GB");
    expect(document.body.textContent).toContain("256GB");
    await act(async () => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("256GB"),
      );
      btn?.click();
    });
    expect(selected).toBe("b");
  });

  it("uses material.chrome for the selected option instead of hand-rolled mint", async () => {
    const variants: ListingVariant[] = [
      { id: "a", label: "128GB", price: "80", mediaIndex: null },
      { id: "b", label: "256GB", price: "95", mediaIndex: 1 },
    ];
    await render(
      createElement(ListingVariantPicker, {
        variants,
        selectedId: "b",
        onSelect: () => {},
      }),
    );
    const selected = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("256GB"),
    ) as HTMLButtonElement;
    const idle = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("128GB"),
    ) as HTMLButtonElement;
    expect(selected.className).toContain("bg-material-chrome");
    expect(selected.className).not.toContain("bg-[#00ffa3]/10");
    expect(selected.className).not.toContain("bg-white/5");
    expect(idle.className).toContain("bg-material-regular");
    expect(idle.className).not.toContain("bg-material-chrome");
    expect(idle.className).not.toContain("bg-white/5");
  });
});
