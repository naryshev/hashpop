import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PurchaseSuccessPage from "../[id]/page";

const nav = vi.hoisted(() => ({
  search: new URLSearchParams("tx=0.0.999"),
}));

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
  useSearchParams: () => nav.search,
}));

vi.mock("../../../hooks/useHbarUsd", () => ({
  useHbarUsd: () => null,
}));

type ListingBody = {
  requireEscrow?: boolean;
};

function listingPayload(requireEscrow: boolean | undefined) {
  const listing: ListingBody & {
    id: string;
    title: string;
    price: string;
    seller: string;
    status: string;
  } = {
    id: "lst-1",
    title: "Camera",
    price: "12",
    seller: "0xabc0000000000000000000000000000000000001",
    status: requireEscrow ? "LOCKED" : "SOLD",
  };
  if (requireEscrow !== undefined) listing.requireEscrow = requireEscrow;
  return { listing };
}

let root: Root | undefined;
let host: HTMLElement | undefined;

async function renderPage(fetchImpl: () => Promise<unknown> | unknown) {
  vi.stubGlobal("fetch", vi.fn(fetchImpl));
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

function text() {
  return host?.textContent ?? "";
}

function heading() {
  return host?.querySelector("h1")?.textContent ?? "";
}

function expectNoProtectionClaim() {
  const body = text();
  expect(body).not.toContain("Funds locked in a protected payment");
  expect(body).not.toContain("Your payment is held by an on-chain smart contract");
  expect(body).not.toContain("You paid the seller directly");
  expect(body).not.toContain("did not offer a protected payment");
  expect(body).not.toContain("releases when you confirm delivery");
  expect(body).not.toContain("View listing & payment protection");
  expect(body).not.toContain("Locked");
}

function expectNeutral() {
  expect(heading()).toBe("Payment sent");
  expect(text()).toContain("Your payment was sent.");
  expect(text()).toContain("0.0.999");
  expectNoProtectionClaim();
}

describe("purchase success copy", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    nav.search = new URLSearchParams("tx=0.0.999");
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

  it("stays neutral while the listing is still loading", async () => {
    await renderPage(() => new Promise(() => {}));
    expect(text()).toContain("Loading purchase details…");
    expectNeutral();
  });

  it("stays neutral when the listing fetch fails", async () => {
    await renderPage(async () => {
      throw new Error("offline");
    });
    expect(text()).not.toContain("Loading purchase details");
    expectNeutral();
  });

  it("stays neutral when the listing returns 404", async () => {
    await renderPage(async () => ({ ok: false, status: 404 }));
    expect(text()).not.toContain("Loading purchase details");
    expectNeutral();
  });

  it("stays neutral when the listing omits requireEscrow", async () => {
    await renderPage(async () => ({
      ok: true,
      json: async () => listingPayload(undefined),
    }));
    expect(text()).toContain("Camera");
    expect(text()).not.toContain("Loading purchase details");
    expectNeutral();
  });

  it("uses the direct-sale paragraph when the listing's requireEscrow is false", async () => {
    await renderPage(async () => ({
      ok: true,
      json: async () => listingPayload(false),
    }));
    const body = text();
    expect(heading()).toBe("Purchase complete");
    expect(body).toContain("You paid the seller directly.");
    expect(body).toContain("did not offer a protected payment");
    expect(body).toContain("0.0.999");
    expect(body).not.toContain("Payment sent");
    expect(body).not.toContain("Funds locked in a protected payment");
    expect(body).not.toContain("Your payment is held by an on-chain smart contract.");
    expect(body).not.toContain("View listing & payment protection");
    expect(body).not.toContain("Locked");
    expect(body).not.toContain("releases when you confirm delivery");
  });

  it("uses the protected-payment paragraph when the listing's requireEscrow is true", async () => {
    await renderPage(async () => ({
      ok: true,
      json: async () => listingPayload(true),
    }));
    const body = text();
    expect(heading()).toBe("Funds locked in a protected payment");
    expect(body).toContain("Your payment is held by an on-chain smart contract.");
    expect(body).toContain("The seller has a week to ship");
    expect(body).toContain("releases when you confirm delivery");
    expect(body).toContain("View listing & payment protection");
    expect(body).toContain("Locked");
    expect(body).toContain("0.0.999");
    expect(body).not.toContain("You paid the seller directly.");
    expect(body).not.toContain("Purchase complete");
    expect(body).not.toContain("Payment sent");
  });
});
