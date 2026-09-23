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
  extra?: { onFlag?: () => void; onHide?: () => void },
) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      createElement(TrustListingsTable, {
        listings,
        loading: false,
        search: "",
        onSearch: () => {},
        onApplySearch: () => {},
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
