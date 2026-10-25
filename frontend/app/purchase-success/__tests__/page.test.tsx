import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PurchaseSuccessPage from "../[id]/page";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => createElement("a", { href, ...rest }, children),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "lst-1" }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../../../hooks/useHbarUsd", () => ({
  useHbarUsd: () => null,
}));

function listingResponse(requireEscrow: boolean) {
  return {
    ok: true,
    json: async () => ({
      listing: {
        id: "lst-1",
        title: "Camera",
        price: "12",
        seller: "0xabc0000000000000000000000000000000000001",
        status: requireEscrow ? "LOCKED" : "SOLD",
        requireEscrow,
      },
    }),
  };
}

let root: Root | undefined;
let host: HTMLElement | undefined;

async function renderFor(requireEscrow: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => listingResponse(requireEscrow)),
  );
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(PurchaseSuccessPage));
  });
  await act(async () => {
    await Promise.resolve();
  });
}

describe("purchase success copy", () => {
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
    root = undefined;
    host = undefined;
    vi.unstubAllGlobals();
  });

  it("uses the direct-sale paragraph when the listing's requireEscrow is false", async () => {
    await renderFor(false);
    const text = host?.textContent ?? "";
    expect(text).toContain("Purchase complete");
    expect(text).toContain("You paid the seller directly.");
    expect(text).toContain("did not offer a protected payment");
    expect(text).not.toContain("Funds locked in a protected payment");
    expect(text).not.toContain("Your payment is held by an on-chain smart contract.");
  });

  it("uses the protected-payment paragraph when the listing's requireEscrow is true", async () => {
    await renderFor(true);
    const text = host?.textContent ?? "";
    expect(text).toContain("Funds locked in a protected payment");
    expect(text).toContain("Your payment is held by an on-chain smart contract.");
    expect(text).toContain("The seller has a week to ship");
    expect(text).not.toContain("You paid the seller directly.");
    expect(text).not.toContain("Purchase complete");
  });
});
