import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const disconnect = vi.fn();

vi.mock("../../lib/hashpackWallet", () => ({
  useHashpackWallet: () => ({
    address: "0.0.100",
    accountId: "0.0.100",
    disconnect,
  }),
}));

vi.mock("../../lib/profiles", () => ({
  useProfile: () => undefined,
  profileDisplayName: () => null,
  profileAvatarUrl: () => null,
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

import { ProfileCardSheet, shouldDismissRightSwipe } from "../ProfileCardSheet";

let root: Root | undefined;
let host: HTMLElement | undefined;

function mockViewport(mobile: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: mobile && query.includes("max-width"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

async function renderSheet(onClose: () => void = () => {}) {
  host = document.createElement("div");
  document.body.appendChild(host);
  const next = createRoot(host);
  root = next;
  await act(async () => {
    next.render(createElement(ProfileCardSheet, { open: true, onClose }));
  });
}

describe("shouldDismissRightSwipe", () => {
  it("closes after a rightward drag or flick and ignores leftward motion", () => {
    expect(shouldDismissRightSwipe(81, 0)).toBe(true);
    expect(shouldDismissRightSwipe(0, 501)).toBe(true);
    expect(shouldDismissRightSwipe(80, 500)).toBe(false);
    expect(shouldDismissRightSwipe(-120, -800)).toBe(false);
  });
});

describe("ProfileCardSheet", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    disconnect.mockReset();
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
    document.body.style.overflow = "";
  });

  it("opens a full-screen panel from the right on mobile", async () => {
    mockViewport(true);
    const onClose = vi.fn();
    await renderSheet(onClose);

    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute("data-profile-variant")).toBe("mobile");
    expect(dialog.getAttribute("data-profile-motion")).toBe("slide-right");
    expect(dialog.className).toContain("inset-0");
    expect(dialog.className).not.toContain("rounded-t-sheet");
    expect(dialog.getAttribute("data-sheet-edge")).toBeNull();
    expect(dialog.querySelector("h2")?.textContent).toBe("Your profile");
    expect(document.querySelector("[data-profile-backdrop]")).toBeTruthy();
    expect(document.body.textContent).toContain("Sign out");

    const back = dialog.querySelector('[aria-label="Back"]') as HTMLButtonElement;
    await act(async () => {
      back.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("dismisses the mobile panel from the backdrop and Escape", async () => {
    mockViewport(true);
    const onClose = vi.fn();
    await renderSheet(onClose);

    const backdrop = document.querySelector("[data-profile-backdrop]") as HTMLElement;
    await act(async () => {
      backdrop.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("keeps the centered sheet on desktop", async () => {
    mockViewport(false);
    await renderSheet();

    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute("data-sheet-edge")).toBe("bottom");
    expect(dialog.getAttribute("aria-label")).toBe("Your profile");
    expect(dialog.className).toContain("md:items-center");
    expect(document.querySelector("[data-profile-panel]")).toBeNull();
    expect(dialog.querySelector('[aria-label="Close"]')).toBeTruthy();
    const panel = dialog.querySelector("[data-sheet-panel]") as HTMLElement;
    expect(panel.getAttribute("data-sheet-motion")).toBe("slide-up");
  });
});
