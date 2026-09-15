import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LockEscrowSheet } from "../LockEscrowSheet";
import {
  LOCK_ESCROW_CTA,
  LOCK_ESCROW_SECONDARY,
  LOCK_ESCROW_SHEET_TITLE,
} from "../../lib/dealRoom";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

let root: Root | undefined;
let host: HTMLElement | undefined;

describe("LockEscrowSheet", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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

  it("uses the shared Sheet with frozen title and CTAs", async () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root!.render(
        createElement(LockEscrowSheet, {
          open: true,
          listingId: "lst-1",
          onClose: () => {},
        }),
      );
    });
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent).toContain(LOCK_ESCROW_SHEET_TITLE);
    expect(dialog?.textContent).toContain(LOCK_ESCROW_CTA);
    expect(dialog?.textContent).toContain(LOCK_ESCROW_SECONDARY);
  });
});
