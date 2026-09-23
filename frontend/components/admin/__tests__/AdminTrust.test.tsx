import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminTrust } from "../AdminTrust";

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

let root: Root | undefined;
let host: HTMLElement | undefined;

describe("AdminTrust", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          listings: [],
          counts: { listings: 2, users: 0, disputes: 0 },
        }),
      }),
    );
  });

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = undefined;
    host = undefined;
    vi.unstubAllGlobals();
  });

  async function renderTrust() {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root!.render(createElement(AdminTrust));
    });
  }

  it("renders the locked title, a listings badge, and frozen user and dispute queues", async () => {
    await renderTrust();
    expect(host?.textContent).toContain("Trust & safety");
    expect(host?.textContent).toContain("Queues for listings and users that need a decision.");
    expect(host?.textContent).toContain("2");
    expect(host?.textContent).toContain("No listings in this queue.");

    const users = Array.from(host!.querySelectorAll("button")).find((button) =>
      button.textContent?.startsWith("Users"),
    );
    await act(async () => users?.click());
    expect(host?.textContent).toContain("No users need review.");
    expect(host?.textContent).toContain("Watched and restricted wallets show up here.");

    const disputes = Array.from(host!.querySelectorAll("button")).find((button) =>
      button.textContent?.startsWith("Disputes"),
    );
    await act(async () => disputes?.click());
    expect(host?.textContent).toContain("No open disputes.");
    expect(host?.textContent).toContain("Escrow disputes will land here.");
  });
});
