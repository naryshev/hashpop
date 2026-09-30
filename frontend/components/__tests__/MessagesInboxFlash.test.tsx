import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessagesPageContent } from "../MessagesContent";

const me = "0xabc";

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
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/messages",
}));

vi.mock("../../lib/hashpackWallet", () => ({
  useHashpackWallet: () => ({
    address: me,
    accountId: null,
    isConnected: true,
    hashconnect: null,
  }),
}));

type ListingGate = (body: unknown) => void;

function conversation(preview: string, listingId: string, createdAt: string) {
  return {
    otherAddress: "0x1111111111111111111111111111111111111111",
    listingId,
    preview,
    lastMessage: {
      fromAddress: "0x1111111111111111111111111111111111111111",
      toAddress: me,
      body: preview,
      createdAt,
    },
  };
}

function listing(seller: string, title: string) {
  return {
    listing: {
      seller,
      title,
      price: "1",
      status: "LISTED",
    },
  };
}

let root: Root | undefined;
let host: HTMLElement | undefined;
let gates: Map<string, ListingGate>;

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderInbox(conversations: ReturnType<typeof conversation>[]) {
  gates = new Map();
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      const href = String(url);
      if (href.includes("/api/messages/inbox")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ conversations }),
        });
      }
      const match = href.match(/\/api\/listing\/([^/?]+)/);
      if (match) {
        const id = decodeURIComponent(match[1]);
        return new Promise((resolve) => {
          gates.set(id, (body: unknown) => {
            resolve({ ok: true, json: async () => body });
          });
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }),
  );

  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(createElement(MessagesPageContent));
  });
  await flush();
  await flush();
}

function listPhase() {
  return document.querySelector("[data-testid='inbox-list']")?.getAttribute("data-phase");
}

describe("Messages Buying/Selling flash", () => {
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
    vi.unstubAllGlobals();
  });

  it("does not paint Selling rows on Buying while listing roles are still loading", async () => {
    await renderInbox([
      conversation("SELLING_ONE", "sell-1", "2026-09-02T00:00:00.000Z"),
      conversation("SELLING_TWO", "sell-2", "2026-09-01T00:00:00.000Z"),
      conversation("BUYING_ONE", "buy-1", "2026-09-03T00:00:00.000Z"),
    ]);

    expect(listPhase()).toBe("loading");
    expect(document.body.textContent).not.toContain("SELLING_ONE");
    expect(document.body.textContent).not.toContain("SELLING_TWO");
    expect(document.body.textContent).not.toContain("BUYING_ONE");

    await act(async () => {
      gates.get("sell-1")?.(listing(me, "Sold lamp"));
      gates.get("sell-2")?.(listing(me, "Sold chair"));
    });
    await flush();

    expect(listPhase()).toBe("loading");
    expect(document.body.textContent).not.toContain("SELLING_ONE");
    expect(document.body.textContent).not.toContain("Sold lamp");
    expect(document.body.textContent).not.toContain("BUYING_ONE");

    await act(async () => {
      gates.get("buy-1")?.(listing("0x9999999999999999999999999999999999999999", "Bought watch"));
    });
    await flush();

    expect(listPhase()).toBe("rows");
    expect(document.body.textContent).toContain("BUYING_ONE");
    expect(document.body.textContent).toContain("Bought watch");
    expect(document.body.textContent).not.toContain("SELLING_ONE");
    expect(document.body.textContent).not.toContain("SELLING_TWO");
    expect(document.body.textContent).not.toContain("Sold lamp");

    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='inbox-tab-selling']")?.click();
    });

    expect(listPhase()).toBe("rows");
    expect(document.body.textContent).toContain("SELLING_ONE");
    expect(document.body.textContent).toContain("SELLING_TWO");
    expect(document.body.textContent).not.toContain("BUYING_ONE");
  });

  it("shows an empty Buying tab instead of Selling rows when Buying has nothing", async () => {
    await renderInbox([
      conversation("SELLING_ONE", "sell-1", "2026-09-02T00:00:00.000Z"),
      conversation("SELLING_TWO", "sell-2", "2026-09-01T00:00:00.000Z"),
    ]);

    expect(listPhase()).toBe("loading");
    expect(document.body.textContent).not.toContain("SELLING_ONE");
    expect(document.body.textContent).not.toContain("No buying conversations yet.");

    await act(async () => {
      gates.get("sell-1")?.(listing(me, "Sold lamp"));
      gates.get("sell-2")?.(listing(me, "Sold chair"));
    });
    await flush();

    expect(listPhase()).toBe("empty-tab");
    expect(document.body.textContent).toContain("No buying conversations yet.");
    expect(document.body.textContent).not.toContain("SELLING_ONE");
    expect(document.body.textContent).not.toContain("Sold lamp");
  });
});
