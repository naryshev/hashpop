import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WishlistButton } from "../WishlistButton";

vi.mock("../../lib/hashpackWallet", () => ({
  useHashpackWallet: () => ({ address: "0xabc" }),
}));

let root: Root | undefined;
let host: HTMLElement | undefined;

async function renderButton(surface?: "default" | "glass" | "neutral") {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(
      createElement(WishlistButton, {
        itemId: "lst-sony",
        itemType: "listing",
        compact: true,
        surface,
      }),
    );
  });
}

describe("WishlistButton glass heart", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ items: [] }),
      })),
    );
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
    vi.unstubAllGlobals();
  });

  it("puts a black tint under the chrome glass and keeps the 44px hit target", async () => {
    await renderButton("glass");
    const button = document.querySelector("button") as HTMLButtonElement;
    expect(button.className).toContain("h-11");
    expect(button.className).toContain("w-11");
    expect(button.className).toContain("backdrop-blur-material");
    expect(button.className).toContain("border-hairline");
    expect(button.className).toContain("bg-black/40");
    expect(button.className).toContain("var(--material-chrome)");
    expect(button.className).not.toContain("bg-material-chrome");
    expect(button.className).not.toContain("bg-chrome");
  });

  it("stays a neutral dark circle on bright photos", async () => {
    await renderButton("neutral");
    const button = document.querySelector("button") as HTMLButtonElement;
    expect(button.className).toContain("h-11");
    expect(button.className).toContain("w-11");
    expect(button.className).toContain("bg-black/50");
    expect(button.className).toContain("backdrop-blur-md");
    expect(button.className).toContain("border-white/15");
    expect(button.className).not.toContain("bg-black/40");
    expect(button.className).not.toContain("var(--material-chrome)");
    expect(button.className).not.toContain("bg-chrome");
  });

  it("stays mint when the listing is already saved", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ items: [{ itemId: "lst-sony" }] }),
      })),
    );
    await renderButton("glass");
    const button = document.querySelector("button") as HTMLButtonElement;
    expect(button.className).toContain("bg-chrome");
    expect(button.className).toContain("h-11");
    expect(button.className).not.toContain("bg-black/40");
  });
});
