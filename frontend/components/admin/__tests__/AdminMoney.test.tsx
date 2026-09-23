import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminMoney } from "../AdminMoney";

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

vi.mock("../AdminShell", () => {
  const headers = { "x-admin-token": "test" };
  const handleAuthStatus = () => false;
  return {
    useAdminSession: () => ({ headers, handleAuthStatus }),
  };
});

vi.mock("../../../lib/apiUrl", () => ({
  getApiUrl: () => "http://api.test",
}));

const locked = {
  listingId: "lock-1",
  title: "Chrome watch",
  seller: "0x1111111111111111111111111111111111111111",
  buyer: "0x2222222222222222222222222222222222222222",
  amountHbar: "12",
  status: "LOCKED",
  stage: "Locked",
  disputeStatus: null,
  attentionAt: "2026-09-20T00:00:00.000Z",
  ageDays: 2,
  stuck: false,
};

const disputed = {
  listingId: "dispute-1",
  title: "Disputed bag",
  seller: "0x3333333333333333333333333333333333333333",
  buyer: "0x4444444444444444444444444444444444444444",
  amountHbar: "4",
  status: "LOCKED",
  stage: "Disputed",
  disputeStatus: "OPEN",
  attentionAt: "2026-09-10T00:00:00.000Z",
  ageDays: 10,
  stuck: true,
};

const released = {
  listingId: "sold-1",
  title: "Released lamp",
  seller: "0x5555555555555555555555555555555555555555",
  buyer: "0x6666666666666666666666666666666666666666",
  amountHbar: "9",
  status: "SOLD",
  stage: "Complete",
  disputeStatus: null,
  attentionAt: "2026-09-01T00:00:00.000Z",
  ageDays: 19,
  stuck: false,
};

let root: Root | undefined;
let host: HTMLElement | undefined;

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

describe("AdminMoney", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = undefined;
    host = undefined;
    vi.unstubAllGlobals();
  });

  async function renderMoney() {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root!.render(createElement(AdminMoney));
    });
  }

  function buttonNamed(label: string) {
    return Array.from(host!.querySelectorAll("button")).find((button) =>
      button.textContent?.startsWith(label),
    );
  }

  it("shows a skeleton until the deals load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)),
    );
    await renderMoney();
    expect(host?.querySelector("[data-money-skeleton]")).toBeTruthy();
    expect(host?.textContent).not.toContain("No open deals.");
  });

  it("renders the locked money desk as view-only", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes("scope=released")) {
        return Promise.resolve(jsonResponse({ deals: [released] }));
      }
      return Promise.resolve(jsonResponse({ deals: [locked, disputed] }));
    });
    vi.stubGlobal("fetch", fetchMock);
    await renderMoney();

    expect(host?.textContent).toContain("Money");
    expect(host?.textContent).toContain("Escrow and deals that need a release, refund, or look.");
    expect(host?.querySelector("input")?.getAttribute("placeholder")).toBe(
      "Search id, title, wallet…",
    );
    expect(host?.textContent).toContain("Chrome watch");
    expect(host?.textContent).toContain("Locked");
    expect(host?.textContent).not.toContain("Disputed bag");
    expect(host?.textContent).toContain("View");
    const actionLabels = Array.from(host!.querySelectorAll("button, a")).map((el) =>
      el.textContent?.trim(),
    );
    expect(actionLabels).not.toContain("Release");
    expect(actionLabels).not.toContain("Refund");
    expect(actionLabels).not.toContain("Resolve");

    const dealsBadge = host?.querySelector("[data-money-badge='deals']");
    const disputesBadge = host?.querySelector("[data-money-badge='disputes']");
    expect(dealsBadge?.textContent).toBe("1");
    expect(dealsBadge?.getAttribute("data-tone")).toBe("mint");
    expect(disputesBadge?.textContent).toBe("1");
    expect(disputesBadge?.getAttribute("data-tone")).toBe("danger");
    expect(host?.querySelector("[data-money-kpi='disputed']")).toBeTruthy();

    const openCall = String(fetchMock.mock.calls[0]?.[0]);
    const releasedCall = String(fetchMock.mock.calls[1]?.[0]);
    expect(openCall).toContain("stuckDays=7");
    expect(openCall).not.toContain("scope=released");
    expect(releasedCall).toContain("scope=released");
    expect(releasedCall).toContain("limit=80");

    await act(async () => buttonNamed("Disputes")?.click());
    expect(host?.textContent).toContain("Disputed bag");
    expect(host?.querySelector("[aria-label='Deal filters']")).toBeNull();

    await act(async () => buttonNamed("Released")?.click());
    expect(host?.textContent).toContain("Released lamp");
    expect(host?.textContent).toContain("Complete");
    expect(
      Array.from(host!.querySelectorAll("button, a")).map((el) => el.textContent?.trim()),
    ).not.toContain("Release");

    const input = host?.querySelector("input");
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(input, "missing-id");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
      input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(host?.textContent).toContain("Nothing matches.");
    expect(host?.textContent).toContain("Check the id or try another filter.");
  });

  it("uses the frozen empties and hides a zero dispute KPI", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (String(url).includes("scope=released")) {
          return Promise.resolve(jsonResponse({ deals: [] }));
        }
        return Promise.resolve(jsonResponse({ deals: [] }));
      }),
    );
    await renderMoney();
    expect(host?.textContent).toContain("No open deals.");
    expect(host?.textContent).toContain("Escrow and in-flight sales show up here.");
    expect(host?.querySelector("[data-money-kpi='disputed']")).toBeNull();
    expect(host?.querySelector("[data-money-badge='disputes']")).toBeNull();

    await act(async () => buttonNamed("Disputes")?.click());
    expect(host?.textContent).toContain("No open disputes.");
    expect(host?.textContent).toContain("Escrow disputes that need a money decision land here.");

    await act(async () => buttonNamed("Released")?.click());
    expect(host?.textContent).toContain("No released deals yet.");
    expect(host?.textContent).toContain("Completed and refunded escrow will show up here.");
  });

  it("lets KPI cards filter the deals table", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (String(url).includes("scope=released")) {
          return Promise.resolve(jsonResponse({ deals: [] }));
        }
        return Promise.resolve(jsonResponse({ deals: [locked, disputed] }));
      }),
    );
    await renderMoney();
    await act(async () => {
      host?.querySelector<HTMLButtonElement>("[data-money-kpi='stuck']")?.click();
    });
    expect(host?.textContent).toContain("Disputed bag");
    expect(host?.querySelector("[data-money-kpi='stuck']")?.getAttribute("aria-pressed")).toBe(
      "true",
    );

    await act(async () => {
      host?.querySelector<HTMLButtonElement>("[data-money-kpi='locked']")?.click();
    });
    expect(host?.textContent).toContain("Chrome watch");
    expect(host?.textContent).not.toContain("Disputed bag");
  });
});
