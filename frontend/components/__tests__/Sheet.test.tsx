import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Sheet, sheetPanelMotion } from "../ui/Sheet";

let root: Root | undefined;
let host: HTMLElement | undefined;

async function renderSheet(edge: "top" | "bottom" = "bottom") {
  host = document.createElement("div");
  document.body.appendChild(host);
  const next = createRoot(host);
  root = next;
  await act(async () => {
    next.render(
      createElement(Sheet, { open: true, onClose: () => {}, title: "Updates", edge }, "body"),
    );
  });
}

describe("sheetPanelMotion", () => {
  it("enters from above and exits upward for the top edge", () => {
    const motion = sheetPanelMotion("top", false);
    expect(motion.initial).toEqual({ y: "-100%" });
    expect(motion.animate).toEqual({ y: 0 });
    expect(motion.exit).toMatchObject({ y: "-100%" });
    expect(motion.transition?.duration).toBeGreaterThanOrEqual(0.2);
    expect(motion.transition?.duration).toBeLessThanOrEqual(0.28);
  });

  it("keeps bottom sheets rising from below", () => {
    const motion = sheetPanelMotion("bottom", false);
    expect(motion.initial).toEqual({ y: "100%" });
    expect(motion.exit).toMatchObject({ y: "100%" });
  });

  it("fades when reduced motion is requested", () => {
    const motion = sheetPanelMotion("top", true);
    expect(motion.initial).toEqual({ opacity: 0 });
    expect(motion.animate).toEqual({ opacity: 1 });
    expect(motion.exit).toMatchObject({ opacity: 0 });
    expect(motion.initial).not.toHaveProperty("y");
  });
});

describe("Sheet", () => {
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

  it("anchors a top-edge panel under the top bar", async () => {
    await renderSheet("top");
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute("data-sheet-edge")).toBe("top");
    expect(dialog.className).toContain("items-start");
    expect(dialog.className).toContain("md:top-14");
    expect(dialog.className).toContain("max-md:top-[calc(env(safe-area-inset-top)+3.5rem)]");
    expect(dialog.className).not.toContain("items-end");
    const panel = dialog.querySelector("[data-sheet-panel]") as HTMLElement;
    expect(panel.className).toContain("rounded-sheet");
    expect(panel.className).not.toContain("rounded-t-sheet");
    expect(panel.getAttribute("data-sheet-motion")).toBe("slide-down");
    expect(panel.querySelector(".pb-safe")).toBeNull();
  });

  it("keeps the default bottom sheet layout", async () => {
    await renderSheet("bottom");
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute("data-sheet-edge")).toBe("bottom");
    expect(dialog.className).toContain("items-end");
    const panel = dialog.querySelector("[data-sheet-panel]") as HTMLElement;
    expect(panel.className).toContain("rounded-t-sheet");
    expect(panel.getAttribute("data-sheet-motion")).toBe("slide-up");
  });
});
