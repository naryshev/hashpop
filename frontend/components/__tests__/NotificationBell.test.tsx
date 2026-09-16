import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "../NotificationBell";
import { DEAL_UPDATES_EMPTY_BODY, DEAL_UPDATES_EMPTY_TITLE } from "../../lib/dealNotifications";

const markSeen = vi.fn();

vi.mock("../../hooks/useDealNotifications", () => ({
  useDealNotifications: () => mockState,
  markDealUpdatesSeen: (...args: unknown[]) => markSeen(...args),
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

let mockState: {
  items: Array<{
    id: string;
    kind: string;
    when: Date;
    title: string;
    body: string;
    href?: string;
    urgent: boolean;
  }>;
  unseen: unknown[];
  tone: "mint" | "red" | null;
  loading: boolean;
};

let root: Root | undefined;
let host: HTMLElement | undefined;

async function renderBell() {
  host = document.createElement("div");
  document.body.appendChild(host);
  const next = createRoot(host);
  root = next;
  await act(async () => {
    next.render(createElement(NotificationBell, { variant: "mobile" }));
  });
}

describe("NotificationBell", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    markSeen.mockReset();
    mockState = { items: [], unseen: [], tone: null, loading: false };
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

  it("shows a quiet mint/red dot with no numeral", async () => {
    mockState = { items: [], unseen: [], tone: "mint", loading: false };
    await renderBell();
    const btn = document.querySelector(
      'button[aria-label="Notifications, new updates"]',
    ) as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.querySelector("[data-bell-dot='mint']")).toBeTruthy();
    expect(btn.querySelector("[data-dock-badge]")).toBeNull();
    expect(btn.textContent?.replace(/\s+/g, "")).not.toMatch(/\d/);
  });

  it("opens a deal-update list with frozen empty copy", async () => {
    await renderBell();
    const btn = document.querySelector('button[aria-label="Notifications"]') as HTMLButtonElement;
    await act(async () => {
      btn.click();
    });
    expect(markSeen).toHaveBeenCalled();
    expect(document.body.textContent).toContain(DEAL_UPDATES_EMPTY_TITLE);
    expect(document.body.textContent).toContain(DEAL_UPDATES_EMPTY_BODY);
  });

  it("renders sentence-case title, one-line body, and relative time", async () => {
    mockState = {
      items: [
        {
          id: "o1",
          kind: "offer",
          when: new Date(),
          title: "New offer",
          body: "12 ℏ on Polaroid",
          href: "/listing/lst-1",
          urgent: true,
        },
      ],
      unseen: [],
      tone: "red",
      loading: false,
    };
    await renderBell();
    const btn = document.querySelector(
      "button[aria-label='Notifications, new updates']",
    ) as HTMLButtonElement;
    await act(async () => {
      btn.click();
    });
    expect(document.body.textContent).toContain("New offer");
    expect(document.body.textContent).toContain("12 ℏ on Polaroid");
    expect(document.body.textContent).toContain("just now");
    expect(document.body.textContent).not.toContain("New message");
    const row = document.querySelector("li");
    expect(row?.className).toContain("border-hairline");
    expect(row?.className).not.toContain("border-white/[0.06]");
    expect(row?.querySelector("a")?.className).toContain("bg-material-regular");
    expect(row?.querySelector("a")?.className).toContain("border-hairline");
  });
});
