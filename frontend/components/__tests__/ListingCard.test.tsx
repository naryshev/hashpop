import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListingCard, chipCapForDensity } from "../ListingCard";

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
  WishlistButton: (props: { surface?: string }) =>
    createElement(
      "button",
      {
        type: "button",
        "aria-label": "Add to wishlist",
        "data-testid": "wishlist",
        "data-surface": props.surface ?? "default",
      },
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

describe("ListingCard softTrust", () => {
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

  it("renders an inset 4:3 photo with a one-line chip row and mint price under it", async () => {
    loadedProfile(0, 0);
    await renderCard({
      variant: "softTrust",
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

    const card = document.querySelector('[data-variant="softTrust"]') as HTMLElement;
    expect(card).toBeTruthy();
    expect(card.className).toContain("bg-material-regular");
    expect(card.className).toContain("rounded-[20px]");
    expect(card.className).toContain("border-hairline");
    const media = document.querySelector('[data-testid="soft-trust-media"]') as HTMLElement;
    expect(media.className).toContain("aspect-[4/3]");
    expect(media.className).not.toContain("aspect-square");
    expect(media.className).toContain("rounded-[14px]");
    expect(media.querySelector("h2")).toBeNull();
    expect(document.querySelector(".aspect-\\[3\\/4\\]")).toBeNull();
    expect(document.querySelector(".bg-gradient-to-t")).toBeNull();
    expect(document.body.textContent).toContain("Sony A7 III body + kit");
    expect(document.body.textContent).toContain("1240");
    expect(document.body.textContent).toContain("ℏ");
    const title = document.querySelector("h2") as HTMLElement;
    expect(title.className).toContain("line-clamp-2");
    expect(title.className).toContain("min-h-9");
    expect(card.className).toContain("flex-col");
    const priceRow = document.querySelector("p")?.parentElement as HTMLElement;
    expect(priceRow.className).toContain("mt-auto");
    const chipRow = document.querySelector('[data-testid="trust-chip-row"]') as HTMLElement;
    expect(chipRow.className).toContain("flex-nowrap");
    expect(chipRow.className).not.toContain("overflow-hidden");
    expect(chipRow.className).toContain("h-5");
    expect(chipRow.className).toContain("w-full");
    expect(chipRow.className).not.toContain("flex-wrap");
    expect(title.compareDocumentPosition(media) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(0);
    expect(media.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const heart = document.querySelector('[data-testid="wishlist"]') as HTMLElement;
    expect(heart).toBeTruthy();
    expect(heart.dataset.surface).toBe("neutral");
    expect(
      media.compareDocumentPosition(document.querySelector('[data-testid="wishlist"]')!) &
        Node.DOCUMENT_POSITION_CONTAINED_BY,
    ).toBeTruthy();
    expect(document.querySelector('[data-testid="trust-strip"]')).toBeNull();
    const chips = [...document.querySelectorAll('[data-testid="grid-trust-chip"]')];
    expect(chips.map((chip) => chip.textContent)).toEqual(["Meetup"]);
    expect(chips[0].querySelector("svg")).toBeTruthy();
    expect((chips[0] as HTMLElement).className).toContain("h-5");
    expect((chips[0] as HTMLElement).className).toContain("px-1");
    expect((chips[0] as HTMLElement).className).toContain("text-[10px]");
    expect((chips[0] as HTMLElement).className).toContain("font-semibold");
    expect((chips[0].querySelector("svg") as SVGElement).getAttribute("width")).toBe("10");
    expect((chips[0] as HTMLElement).className).toContain("text-silver");
    expect((chips[0] as HTMLElement).className).not.toContain("text-chrome");
    expect(document.querySelector('[data-testid="listing-distance"]')).toBeNull();
    expect(document.body.textContent).not.toContain("Active");
    expect(document.body.textContent).not.toContain("KYC");
    expect(document.body.textContent).not.toContain("ETH");
  });

  it("mounts all three compact chips when the row is wide enough", async () => {
    loadedProfile(49, 50);
    expect(chipCapForDensity(true, 3)).toBe(3);
    expect(chipCapForDensity(false, 3)).toBe(3);
    await renderCard({
      variant: "softTrust",
      density: "compact",
      item: {
        id: "lst-sony",
        title: "Sony WH-1000XM5",
        price: "85",
        seller,
        status: "LISTED",
        requireEscrow: true,
        meetup: true,
        distanceLabel: "1.2 km",
      },
    });
    const chips = [...document.querySelectorAll('[data-testid="grid-trust-chip"]')];
    expect(chips.map((chip) => chip.textContent)).toEqual(["98%", "Meetup", "Escrow"]);
    expect(chips.every((chip) => !chip.hidden)).toBe(true);
    const distance = document.querySelector('[data-testid="listing-distance"]') as HTMLElement;
    expect(distance.className).toContain("text-white/70");
    expect(distance.className).not.toContain("text-chrome");
    expect(distance.querySelector("svg")?.getAttribute("class")).toContain("text-chrome");
  });

  it("drops a whole chip that overflows the row and never clips it", async () => {
    loadedProfile(49, 50);
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this.dataset.testid === "trust-chip-row") {
          return {
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: 120,
            bottom: 20,
            width: 120,
            height: 20,
            toJSON() {},
          } as DOMRect;
        }
        if (this.dataset.testid === "grid-trust-chip") {
          const label = this.textContent ?? "";
          const right = label.includes("Escrow") ? 180 : label.includes("Meetup") ? 90 : 36;
          return {
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right,
            bottom: 20,
            width: right,
            height: 20,
            toJSON() {},
          } as DOMRect;
        }
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          toJSON() {},
        } as DOMRect;
      });
    try {
      await renderCard({
        variant: "softTrust",
        density: "compact",
        item: {
          id: "lst-sony",
          title: "Sony WH-1000XM5",
          price: "85",
          seller,
          status: "LISTED",
          requireEscrow: true,
          meetup: true,
        },
      });
      const chips = [...document.querySelectorAll('[data-testid="grid-trust-chip"]')];
      expect(chips.map((chip) => chip.textContent)).toEqual(["98%", "Meetup"]);
      expect(document.body.textContent).not.toContain("Escrow");
      const row = document.querySelector('[data-testid="trust-chip-row"]') as HTMLElement;
      expect(row.className).not.toContain("overflow-hidden");
    } finally {
      rect.mockRestore();
    }
  });

  it("shows completion, Meetup, and Escrow together on the desktop card", async () => {
    loadedProfile(49, 50);
    await renderCard({
      variant: "softTrust",
      density: "regular",
      item: {
        id: "lst-2",
        title: "Denim jacket",
        price: "85",
        seller,
        status: "LISTED",
        requireEscrow: true,
        meetup: true,
        distanceLabel: "1.2 km",
      },
    });
    const card = document.querySelector('[data-variant="softTrust"]') as HTMLElement;
    expect(card.className).toContain("rounded-[18px]");
    expect(card.className).toContain("bg-material-regular");
    const title = document.querySelector("h2") as HTMLElement;
    const price = document.querySelector("p") as HTMLElement;
    expect(title.className).toContain("text-[13px]");
    expect(price.className).toContain("text-[15px]");
    expect(price.className).toContain("text-chrome");
    const chips = [...document.querySelectorAll('[data-testid="grid-trust-chip"]')];
    expect(chips.map((chip) => chip.textContent)).toEqual(["98%", "Meetup", "Escrow"]);
    expect(chips.every((chip) => chip.querySelector("svg"))).toBe(true);
    const row = document.querySelector('[data-testid="trust-chip-row"]') as HTMLElement;
    expect(row.className).toContain("flex-nowrap");
    expect(row.className).not.toContain("flex-wrap");
    expect((chips[0] as HTMLElement).className).toContain("bg-[#00ffa3]/10");
    expect((chips[0] as HTMLElement).className).toContain("text-chrome");
    expect((chips[1] as HTMLElement).className).toContain("text-silver");
    expect((chips[2] as HTMLElement).className).toContain("text-silver");
    const distance = document.querySelector('[data-testid="listing-distance"]') as HTMLElement;
    expect(distance.textContent).toContain("1.2 km");
    expect(distance.className).toContain("text-chrome");
    expect(distance.className).not.toContain("text-white/60");
    expect(distance.querySelector("svg")).toBeTruthy();
  });

  it("keeps a low completion percent on silver glass and still shows Escrow", async () => {
    loadedProfile(8, 10);
    await renderCard({
      variant: "softTrust",
      item: {
        id: "lst-low",
        title: "Low completion",
        price: "40",
        seller,
        status: "LISTED",
        requireEscrow: true,
      },
    });
    const chips = [...document.querySelectorAll('[data-testid="grid-trust-chip"]')];
    expect(chips.map((chip) => chip.textContent)).toEqual(["80%", "Escrow"]);
    expect((chips[0] as HTMLElement).className).toContain("text-silver");
    expect((chips[0] as HTMLElement).className).not.toContain("text-chrome");
    expect((chips[0] as HTMLElement).className).not.toContain("bg-[#00ffa3]/10");
  });

  it("omits the chip row while the seller profile is still loading", async () => {
    profileState.current = undefined;
    await renderCard({
      variant: "softTrust",
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
    expect(document.body.textContent).toContain("Trek FX");
  });

  it("replaces the trust row with Pending or Sold", async () => {
    loadedProfile(49, 50);
    await renderCard({
      variant: "softTrust",
      item: {
        id: "lst-4",
        title: "Locked bike",
        price: "90",
        seller,
        status: "LOCKED",
        requireEscrow: true,
        meetup: true,
      },
    });
    expect(document.querySelector('[data-variant="softTrust"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="trust-strip"]')).toBeNull();
    expect(document.body.textContent).toContain("Pending");
    expect(document.querySelector('[data-testid="grid-trust-chip"]')).toBeNull();
    expect(document.body.textContent).not.toContain("98%");
    expect(document.body.textContent).not.toContain("Meetup");
    expect(document.body.textContent).not.toContain("Active");
  });

  it("still renders soft-trust when the old mediaTrust variant name is passed", async () => {
    loadedProfile(0, 0);
    await renderCard({
      variant: "mediaTrust",
      item: {
        id: "lst-alias",
        title: "Alias",
        price: "1",
        seller,
        status: "LISTED",
        requireEscrow: false,
      },
    });
    expect(document.querySelector('[data-variant="softTrust"]')).toBeTruthy();
    expect(document.querySelector(".aspect-\\[4\\/3\\]")).toBeTruthy();
    expect(document.querySelector(".aspect-square")).toBeNull();
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
    expect(document.querySelector('[data-variant="softTrust"]')).toBeNull();
    expect(document.querySelector('[data-variant="mediaTrust"]')).toBeNull();
    expect(document.body.textContent).toContain("Active");
  });
});
