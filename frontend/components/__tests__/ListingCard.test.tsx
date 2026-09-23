import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListingCard } from "../ListingCard";

const { profileState } = vi.hoisted(() => ({
  profileState: {
    current: undefined as
      | undefined
      | {
          address: string;
          displayName: null;
          avatarUrl: null;
          hashpackName: null;
          hashpackAvatarUrl: null;
          kycVerified: boolean;
          ratingAverage: null;
          ratingCount: number;
          successfulCompletions: number;
          totalSales: number;
        },
  },
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

vi.mock("../WishlistButton", () => ({
  WishlistButton: () =>
    createElement(
      "button",
      { type: "button", "aria-label": "Add to wishlist", "data-testid": "wishlist" },
      "♡",
    ),
}));

vi.mock("../TrustStrip", () => ({
  TrustStrip: () => createElement("div", { "data-testid": "trust-strip" }, "trust"),
}));

vi.mock("../../lib/profiles", () => ({
  useProfile: () => profileState.current,
  profileDisplayName: () => null,
  profileAvatarUrl: () => null,
}));

const seller = "0xabc0000000000000000000000000000000000001";

function loadedProfile(completions: number, sales: number) {
  profileState.current = {
    address: seller,
    displayName: null,
    avatarUrl: null,
    hashpackName: null,
    hashpackAvatarUrl: null,
    kycVerified: true,
    ratingAverage: null,
    ratingCount: 0,
    successfulCompletions: completions,
    totalSales: sales,
  };
}

let root: Root | undefined;
let host: HTMLElement | undefined;

async function renderCard(props: React.ComponentProps<typeof ListingCard>) {
  host = document.createElement("div");
  document.body.appendChild(host);
  const next = createRoot(host);
  root = next;
  await act(async () => {
    next.render(createElement(ListingCard, props));
  });
}

describe("ListingCard mediaTrust", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    profileState.current = undefined;
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
  });

  it("renders a 3:4 photo tile with overlay title and mint price, not a glass body", async () => {
    loadedProfile(0, 0);
    await renderCard({
      variant: "mediaTrust",
      density: "compact",
      item: {
        id: "lst-1",
        title: "Sony A7 III body + kit",
        price: "1240",
        seller,
        status: "LISTED",
        requireEscrow: false,
      },
    });

    const card = document.querySelector('[data-variant="mediaTrust"]') as HTMLElement;
    expect(card).toBeTruthy();
    expect(card.className).not.toContain("bg-material-regular");
    expect(card.className).toContain("rounded-[16px]");
    expect(card.className).toContain("border-white/10");
    expect(document.querySelector(".aspect-\\[3\\/4\\]")).toBeTruthy();
    expect(document.body.textContent).toContain("Sony A7 III body + kit");
    expect(document.body.textContent).toContain("1240");
    expect(document.body.textContent).toContain("ℏ");
    const title = document.querySelector("h2");
    expect(title?.className).toContain("line-clamp-2");
    expect(document.querySelector('[data-testid="wishlist"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="trust-strip"]')).toBeNull();
    expect(document.body.textContent).toContain("Meetup");
    expect(document.body.textContent).not.toContain("Active");
    expect(document.body.textContent).not.toContain("KYC");
  });

  it("uses the tighter desktop radius on regular density", async () => {
    loadedProfile(49, 50);
    await renderCard({
      variant: "mediaTrust",
      density: "regular",
      item: {
        id: "lst-2",
        title: "Denim jacket",
        price: "85",
        seller,
        status: "LISTED",
        requireEscrow: true,
      },
    });
    const card = document.querySelector('[data-variant="mediaTrust"]') as HTMLElement;
    expect(card.className).toContain("rounded-[14px]");
    expect(document.body.textContent).toContain("98%");
    expect(document.body.textContent).not.toContain("Escrow");
    expect(document.body.textContent).not.toContain("Meetup");
  });

  it("omits the chip while the seller profile is still loading", async () => {
    profileState.current = undefined;
    await renderCard({
      variant: "mediaTrust",
      item: {
        id: "lst-3",
        title: "Trek FX",
        price: "420",
        seller,
        status: "LISTED",
        requireEscrow: false,
      },
    });
    expect(document.querySelector('[data-testid="grid-trust-chip"]')).toBeNull();
    expect(document.body.textContent).not.toContain("Meetup");
    expect(document.body.textContent).not.toContain("Active");
  });

  it("replaces the trust chip with Pending or Sold", async () => {
    loadedProfile(49, 50);
    await renderCard({
      variant: "mediaTrust",
      item: {
        id: "lst-4",
        title: "Locked bike",
        price: "90",
        seller,
        status: "LOCKED",
        requireEscrow: true,
      },
    });
    expect(document.querySelector('[data-variant="mediaTrust"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="trust-strip"]')).toBeNull();
    expect(document.body.textContent).toContain("Pending");
    expect(document.querySelector('[data-testid="grid-trust-chip"]')).toBeNull();
    expect(document.body.textContent).not.toContain("98%");
    expect(document.body.textContent).not.toContain("Active");
  });

  it("keeps the glass body and TrustStrip on the default variant", async () => {
    loadedProfile(49, 50);
    await renderCard({
      item: {
        id: "lst-5",
        title: "Glass card",
        price: "10",
        seller,
        status: "LISTED",
      },
    });
    const card = document.querySelector("article") as HTMLElement;
    expect(card.className).toContain("bg-material-regular");
    expect(document.querySelector('[data-testid="trust-strip"]')).toBeTruthy();
    expect(document.querySelector('[data-variant="mediaTrust"]')).toBeNull();
    expect(document.body.textContent).toContain("Active");
  });
});
