import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "../NotificationBell";
import { notificationsPanelMotion, splitNotificationFeed } from "../NotificationsPanel";
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

function unseenStubs(count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: `u${i}` }));
}

async function renderBell(variant: "mobile" | "desktop" = "mobile") {
  host = document.createElement("div");
  document.body.appendChild(host);
  const next = createRoot(host);
  root = next;
  await act(async () => {
    next.render(createElement(NotificationBell, { variant }));
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

  it("hides the count bubble at 0 unread", async () => {
    mockState = { items: [], unseen: [], tone: null, loading: false };
    await renderBell();
    const btn = document.querySelector('button[aria-label="Notifications"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.querySelector("[data-dock-badge]")).toBeNull();
    expect(btn.querySelector("[data-bell-dot]")).toBeNull();
  });

  it("shows a mint DockBadge for unread deal updates (1 / 9 / 9+)", async () => {
    mockState = { items: [], unseen: unseenStubs(1), tone: "mint", loading: false };
    await renderBell();
    let btn = document.querySelector('button[aria-label="Notifications, 1"]') as HTMLButtonElement;
    let badge = btn.querySelector("[data-dock-badge]") as HTMLElement;
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe("1");
    expect(badge.className).toContain("bg-[#00ffa3]");
    expect(badge.className).toContain("text-[#0a0e14]");
    expect(btn.querySelector("[data-bell-dot]")).toBeNull();

    mockState = { items: [], unseen: unseenStubs(9), tone: "mint", loading: false };
    await act(async () => {
      root!.render(createElement(NotificationBell, { variant: "mobile" }));
    });
    btn = document.querySelector('button[aria-label="Notifications, 9"]') as HTMLButtonElement;
    expect(btn.querySelector("[data-dock-badge]")?.textContent).toBe("9");

    mockState = { items: [], unseen: unseenStubs(10), tone: "red", loading: false };
    await act(async () => {
      root!.render(createElement(NotificationBell, { variant: "mobile" }));
    });
    btn = document.querySelector('button[aria-label="Notifications, 9+"]') as HTMLButtonElement;
    expect(btn.querySelector("[data-dock-badge]")?.textContent).toBe("9+");
    expect(btn.querySelector("[data-bell-dot]")).toBeNull();
  });

  it("uses compact DockBadge on the smaller desktop header bell", async () => {
    mockState = { items: [], unseen: unseenStubs(3), tone: "mint", loading: false };
    await renderBell("desktop");
    const badge = document.querySelector("[data-dock-badge]") as HTMLElement;
    expect(badge.getAttribute("data-dock-badge-size")).toBe("compact");
  });

  it("opens a deal-update list with notification empty copy", async () => {
    await renderBell();
    const btn = document.querySelector('button[aria-label="Notifications"]') as HTMLButtonElement;
    await act(async () => {
      btn.click();
    });
    expect(markSeen).toHaveBeenCalled();
    expect(document.querySelector("h2")?.textContent).toBe("Notifications");
    expect(document.body.textContent).toContain("No notifications yet.");
    expect(document.body.textContent).not.toContain(DEAL_UPDATES_EMPTY_TITLE);
    expect(document.body.textContent).toContain(DEAL_UPDATES_EMPTY_BODY);
  });

  it("slides a narrow desktop drawer in from the right", async () => {
    await renderBell("desktop");
    const btn = document.querySelector('button[aria-label="Notifications"]') as HTMLButtonElement;
    await act(async () => {
      btn.click();
    });
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("data-notifications-variant")).toBe("desktop");
    expect(dialog.getAttribute("data-notifications-motion")).toBe("slide-right");
    expect(dialog.className).toContain("right-0");
    expect(dialog.className).toContain("w-[min(100vw,380px)]");
    expect(dialog.className).toContain("border-hairline");
    expect(dialog.getAttribute("data-sheet-edge")).toBeNull();
    expect(document.querySelector("[data-notifications-backdrop]")).toBeTruthy();
    expect(dialog.querySelector("h2")?.textContent).toBe("Notifications");
    expect(dialog.querySelector('[aria-label="Notification options"]')).toBeTruthy();
    expect(dialog.querySelector('[aria-label="Close notifications"]')).toBeTruthy();
    expect(dialog.textContent).not.toContain("Inbox");
    expect(document.activeElement).toBe(dialog);
  });

  it("opens a full-screen inbox on mobile", async () => {
    await renderBell("mobile");
    const btn = document.querySelector('button[aria-label="Notifications"]') as HTMLButtonElement;
    await act(async () => {
      btn.click();
    });
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute("data-notifications-variant")).toBe("mobile");
    expect(dialog.getAttribute("data-notifications-motion")).toBe("slide-right");
    expect(dialog.className).toContain("inset-0");
    expect(dialog.className).not.toContain("w-[min(100vw,380px)]");
    expect(document.querySelector("[data-notifications-backdrop]")).toBeNull();
    const title = dialog.querySelector("h2") as HTMLElement;
    expect(title.textContent).toBe("Notifications");
    expect(title.className).toContain("text-center");
    expect(dialog.querySelector('[aria-label="Back"]')).toBeTruthy();
    expect(dialog.querySelector('[aria-label="Notification options"]')).toBeTruthy();
    const tabs = dialog.querySelectorAll('[role="tab"]');
    expect(Array.from(tabs).map((tab) => tab.textContent)).toEqual(["Inbox", "Action needed"]);
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
    expect(tabs[0]?.className).toContain("rounded-full");
    expect(tabs[0]?.className).toContain("bg-material-chrome");
    expect(tabs[0]?.className).toContain("border-hairline");
    expect(tabs[0]?.className).not.toContain("border-2");
    expect(tabs[0]?.className).not.toContain("border-white/90");
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
          urgent: false,
        },
      ],
      unseen: [],
      tone: null,
      loading: false,
    };
    await renderBell();
    const btn = document.querySelector('button[aria-label="Notifications"]') as HTMLButtonElement;
    await act(async () => {
      btn.click();
    });
    expect(document.body.textContent).toContain("New offer");
    expect(document.body.textContent).toContain("12 ℏ on Polaroid");
    expect(document.body.textContent).toContain("just now");
    expect(document.body.textContent).not.toContain("New message");
    const row = document.querySelector("[data-notification-row]") as HTMLElement;
    expect(row?.className).toContain("border-hairline");
    expect(row?.className).not.toContain("border-white/[0.06]");
    expect(row?.querySelector("[data-notification-chevron]")).toBeTruthy();
    expect(row?.querySelector("a")?.className).not.toContain("bg-material-regular");
    const mark = row?.querySelector("[data-kind-mark]") as HTMLElement;
    expect(mark?.className).toContain("bg-material-regular");
    expect(mark?.className).toContain("border-hairline");
    expect(document.querySelector("[data-notification-featured]")).toBeNull();
  });

  it("features urgent updates on mobile and keeps them as rows on desktop", async () => {
    mockState = {
      items: [
        {
          id: "urgent-1",
          kind: "meetup",
          when: new Date(),
          title: "Confirm meetup",
          body: "Meet the buyer for Polaroid",
          href: "/listing/lst-1",
          urgent: true,
        },
        {
          id: "calm-1",
          kind: "rating",
          when: new Date(Date.now() - 60_000),
          title: "New rating",
          body: "5-star review",
          href: "/profile/0.0.1",
          urgent: false,
        },
      ],
      unseen: [{ id: "urgent-1" }],
      tone: "red",
      loading: false,
    };
    await renderBell("mobile");
    let btn = document.querySelector('button[aria-label="Notifications, 1"]') as HTMLButtonElement;
    await act(async () => {
      btn.click();
    });
    const featured = document.querySelector("[data-notification-featured]") as HTMLElement;
    expect(featured?.textContent).toContain("Confirm meetup");
    expect(featured?.querySelector("[data-notification-unread]")).toBeTruthy();
    const row = document.querySelector("[data-notification-row]") as HTMLElement;
    expect(row?.textContent).toContain("New rating");
    expect(row?.querySelector("[data-notification-unread]")).toBeNull();

    const action = document.querySelector(
      '[role="tab"][aria-selected="false"]',
    ) as HTMLButtonElement;
    await act(async () => {
      action.click();
    });
    expect(document.body.textContent).toContain("Confirm meetup");
    expect(document.body.textContent).not.toContain("New rating");
    expect(document.querySelector("[data-notification-featured]")).toBeNull();

    await act(async () => {
      root!.unmount();
    });
    host?.remove();
    await renderBell("desktop");
    btn = document.querySelector('button[aria-label="Notifications, 1"]') as HTMLButtonElement;
    await act(async () => {
      btn.click();
    });
    expect(document.querySelector("[data-notification-featured]")).toBeNull();
    expect(document.querySelectorAll("[data-notification-row]")).toHaveLength(2);
  });

  it("closes from the scrim, the close button, and Escape, and traps tab", async () => {
    await renderBell("desktop");
    const btn = document.querySelector('button[aria-label="Notifications"]') as HTMLButtonElement;
    await act(async () => {
      btn.click();
    });
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    const close = dialog.querySelector('[aria-label="Close notifications"]') as HTMLButtonElement;
    const options = dialog.querySelector(
      '[aria-label="Notification options"]',
    ) as HTMLButtonElement;
    close.focus();
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }),
      );
    });
    expect(document.activeElement).toBe(options);

    options.focus();
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          bubbles: true,
          cancelable: true,
          shiftKey: true,
        }),
      );
    });
    expect(document.activeElement).toBe(close);

    await act(async () => {
      options.click();
    });
    expect(dialog.querySelector('[role="menu"]')?.textContent).toContain("View activity");
    expect(dialog.querySelector('a[href="/activity"]')).toBeTruthy();
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
    });
    expect(dialog.querySelector('[role="menu"]')).toBeNull();
    expect(btn.getAttribute("aria-expanded")).toBe("true");

    const backdrop = document.querySelector("[data-notifications-backdrop]") as HTMLElement;
    await act(async () => {
      backdrop.click();
    });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("notificationsPanelMotion", () => {
  it("enters from the right and fades when reduced motion is requested", () => {
    const motion = notificationsPanelMotion(false);
    expect(motion.initial).toEqual({ x: "100%" });
    expect(motion.animate).toEqual({ x: 0 });
    expect(motion.exit).toMatchObject({ x: "100%" });
    expect(motion.transition.duration).toBeGreaterThanOrEqual(0.2);
    expect(motion.transition.duration).toBeLessThanOrEqual(0.28);

    const reduced = notificationsPanelMotion(true);
    expect(reduced.initial).toEqual({ opacity: 0 });
    expect(reduced.animate).toEqual({ opacity: 1 });
    expect(reduced.exit).toMatchObject({ opacity: 0 });
    expect(reduced.initial).not.toHaveProperty("x");
  });
});

describe("splitNotificationFeed", () => {
  const items = [
    {
      id: "a",
      kind: "offer" as const,
      when: new Date("2026-09-01T12:00:00.000Z"),
      title: "New offer",
      body: "one",
      urgent: true,
    },
    {
      id: "b",
      kind: "rating" as const,
      when: new Date("2026-09-01T11:00:00.000Z"),
      title: "New rating",
      body: "two",
      urgent: false,
    },
    {
      id: "c",
      kind: "meetup" as const,
      when: new Date("2026-09-01T10:00:00.000Z"),
      title: "Confirm meetup",
      body: "three",
      urgent: true,
    },
    {
      id: "d",
      kind: "escrow" as const,
      when: new Date("2026-09-01T09:00:00.000Z"),
      title: "Escrow locked",
      body: "four",
      urgent: true,
    },
  ];

  it("features the two newest urgent inbox items and leaves the rest as rows", () => {
    const split = splitNotificationFeed(items, "inbox", true);
    expect(split.featured.map((item) => item.id)).toEqual(["a", "c"]);
    expect(split.rows.map((item) => item.id)).toEqual(["b", "d"]);
  });

  it("keeps action-needed as urgent rows only", () => {
    const split = splitNotificationFeed(items, "action", true);
    expect(split.featured).toEqual([]);
    expect(split.rows.map((item) => item.id)).toEqual(["a", "c", "d"]);
  });
});
