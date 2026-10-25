import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MarketplacePageClient from "../marketplace-page-client";

const { nav } = vi.hoisted(() => ({
  nav: {
    params: new URLSearchParams("q=galaxy"),
    push: vi.fn(),
  },
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
  useSearchParams: () => nav.params,
}));

vi.mock("../../../lib/hashpackWallet", () => ({
  useHashpackWallet: () => ({
    accountId: null,
    address: null,
    isConnected: false,
  }),
}));

vi.mock("../../../lib/signInModal", () => ({
  useSignInModal: () => ({ openSignIn: vi.fn() }),
}));

vi.mock("../../../lib/profiles", () => ({
  useProfiles: () => ({}),
  useProfile: () => undefined,
  profileAvatarUrl: () => null,
}));

vi.mock("../../../components/NotificationBell", () => ({
  NotificationBell: () => null,
}));

let root: Root | undefined;
let host: HTMLElement | undefined;

async function renderPage() {
  if (!root) {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  }
  await act(async () => {
    root?.render(createElement(MarketplacePageClient, { initialItems: [], initialError: null }));
  });
}

function searchValues(): string[] {
  return [...document.querySelectorAll("input")].map((input) => (input as HTMLInputElement).value);
}

describe("marketplace header search query", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    nav.params = new URLSearchParams("q=galaxy");
    nav.push.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ listings: [] }) })),
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

  it("fills both header searches from q and follows client navigations", async () => {
    await renderPage();
    const desktop = document.querySelector(
      'input[aria-label="Search marketplace"]',
    ) as HTMLInputElement;
    const mobile = document.querySelector('input[aria-label="Search Hashpop"]') as HTMLInputElement;
    expect(desktop.value).toBe("galaxy");
    expect(mobile.value).toBe("galaxy");

    nav.params = new URLSearchParams("q=wrist%20watch");
    await renderPage();
    const desktopNext = document.querySelector(
      'input[aria-label="Search marketplace"]',
    ) as HTMLInputElement;
    const mobileNext = document.querySelector(
      'input[aria-label="Search Hashpop"]',
    ) as HTMLInputElement;
    expect(desktopNext.value).toBe("wrist watch");
    expect(mobileNext.value).toBe("wrist watch");
    expect(searchValues().filter((value) => value === "galaxy")).toHaveLength(0);
  });
});
