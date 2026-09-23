import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrustListingsTable, type TrustListing } from "../TrustListingsTable";

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

const clean: TrustListing = {
  id: "lst-1",
  title: "Submariner",
  imageUrl: null,
  seller: "0x1234567890abcdef1234567890abcdef12345678",
  status: "LISTED",
  onChainConfirmed: true,
  disputeStatus: null,
  moderationStatus: null,
  moderationReason: null,
  updatedAt: "2026-09-20T11:00:00.000Z",
};

let root: Root | undefined;
let host: HTMLElement | undefined;

function renderTable(
  listings: TrustListing[],
  extra?: {
    onFlag?: () => void;
    onHide?: () => void;
    loading?: boolean;
    appliedSearch?: string;
  },
) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      createElement(TrustListingsTable, {
        listings,
        loading: extra?.loading ?? false,
        search: extra?.appliedSearch ?? "",
        onSearch: () => {},
        onApplySearch: () => {},
        appliedSearch: extra?.appliedSearch ?? "",
        filter: "needs_review",
        onFilter: () => {},
        busyId: null,
        onHide: extra?.onHide ?? (() => {}),
        onRemove: () => {},
        onFlag: extra?.onFlag ?? (() => {}),
        onClear: () => {},
      }),
    );
  });
}

describe("TrustListingsTable", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = undefined;
    host = undefined;
  });

  it("shows the locked empty copy when the queue has no rows", () => {
    renderTable([]);
    expect(host?.textContent).toContain("No listings in this queue.");
    expect(host?.textContent).toContain("Try another filter or clear search.");
    expect(host?.querySelector("input")?.getAttribute("placeholder")).toBe(
      "Search id, title, wallet…",
    );
  });

  it("uses a skeleton while loading and a search-miss empty state", () => {
    renderTable([], { loading: true });
    expect(host?.querySelector("[data-trust-skeleton]")).toBeTruthy();
    expect(host?.textContent).not.toContain("No listings in this queue.");

    act(() => root?.unmount());
    host?.remove();
    renderTable([], { appliedSearch: "0xmissing" });
    expect(host?.textContent).toContain("Nothing matches.");
    expect(host?.textContent).toContain("Check the id or try another filter.");
  });

  it("shows Live or Hidden from moderation status, and a reason chip instead of free text", () => {
    renderTable([
      {
        ...clean,
        moderationStatus: "HIDDEN",
        moderationReason: "counterfeit watch",
        status: "LISTED",
        onChainConfirmed: true,
      },
    ]);
    expect(host?.textContent).toContain("Hidden");
    expect(host?.textContent).not.toContain("Active");
    expect(host?.textContent).toContain("Pending review");
    expect(host?.textContent).not.toContain("counterfeit watch");
  });

  it("paints Flag silver until the listing is flagged", () => {
    renderTable([clean]);
    const idle = Array.from(host!.querySelectorAll("button")).find((b) => b.textContent === "Flag");
    expect(idle?.className).toContain("text-silver");
    expect(idle?.className).not.toContain("text-warning");

    act(() => root?.unmount());
    host?.remove();
    renderTable([{ ...clean, moderationReason: "FLAGGED" }]);
    const active = Array.from(host!.querySelectorAll("button")).find(
      (b) => b.textContent === "Flag",
    );
    expect(active?.className).toContain("text-warning");
    expect(host?.textContent).toContain("Live");
    expect(host?.textContent).toContain("Flagged");
  });

  it("shows a read-only Admin pill when the seller wallet is allowlisted", () => {
    renderTable([{ ...clean, sellerIsAdmin: true }]);
    const pills = Array.from(host!.querySelectorAll("span")).filter(
      (node) => node.textContent === "Admin",
    );
    expect(pills.length).toBeGreaterThan(0);
    expect(
      Array.from(host!.querySelectorAll("button")).some((button) => button.textContent === "Admin"),
    ).toBe(false);

    act(() => root?.unmount());
    host?.remove();
    renderTable([clean]);
    expect(host?.textContent).not.toContain("Admin");
  });

  it("offers view, hide, remove, and flag, and confirms hide before mutating", () => {
    const onHide = vi.fn();
    const onFlag = vi.fn();
    renderTable([clean], { onHide, onFlag });
    expect(host?.textContent).toContain("Submariner");
    expect(host?.textContent).toContain("View");
    expect(host?.textContent).toContain("Hide");
    expect(host?.textContent).toContain("Remove");
    expect(host?.textContent).toContain("Flag");
    expect(host?.textContent).not.toContain("Clear");

    const flag = Array.from(host!.querySelectorAll("button")).find((b) => b.textContent === "Flag");
    act(() => flag?.click());
    expect(onFlag).toHaveBeenCalledWith(clean);

    const hide = Array.from(host!.querySelectorAll("button")).find((b) => b.textContent === "Hide");
    act(() => hide?.click());
    expect(onHide).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Hide this listing?");
    const confirm = Array.from(document.body.querySelectorAll("button")).find(
      (b) => b.textContent === "Hide listing",
    );
    act(() => confirm?.click());
    expect(onHide).toHaveBeenCalledWith(clean, expect.any(String));
  });
});
