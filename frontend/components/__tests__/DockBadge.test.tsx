import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DockBadge } from "../ui/DockBadge";

let root: Root | undefined;
let host: HTMLElement | undefined;

async function render(count: number) {
  host = document.createElement("div");
  document.body.appendChild(host);
  const next = createRoot(host);
  root = next;
  await act(async () => {
    next.render(
      createElement(
        "span",
        { className: "relative inline-flex" },
        createElement(DockBadge, { count }),
      ),
    );
  });
}

describe("DockBadge", () => {
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

  it("hides at 0", async () => {
    await render(0);
    expect(document.querySelector("[data-dock-badge]")).toBeNull();
  });

  it("renders mint 9px bold tabular count and 9+ cap", async () => {
    await render(3);
    const badge = document.querySelector("[data-dock-badge]") as HTMLElement;
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe("3");
    expect(badge.className).toContain("bg-[#00ffa3]");
    expect(badge.className).toContain("text-[#0a0e14]");
    expect(badge.className).toContain("text-[9px]");
    expect(badge.className).toContain("tabular-nums");
    expect(badge.className).toContain("font-bold");
    expect(badge.className).toContain("-top-0.5");
    expect(badge.className).toContain("-right-1");

    await act(async () => {
      root!.render(
        createElement(
          "span",
          { className: "relative inline-flex" },
          createElement(DockBadge, { count: 12 }),
        ),
      );
    });
    expect(document.querySelector("[data-dock-badge]")?.textContent).toBe("9+");
  });
});
