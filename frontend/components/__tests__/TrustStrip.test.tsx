import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrustStrip } from "../TrustStrip";
import { UNKNOWN_ON_HASHPOP, ZERO_DEALS_FULL } from "../../lib/trustStrip";

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

let root: Root | undefined;
let host: HTMLElement | undefined;

async function renderStrip(props: React.ComponentProps<typeof TrustStrip>) {
  host = document.createElement("div");
  document.body.appendChild(host);
  const next = createRoot(host);
  root = next;
  await act(async () => {
    next.render(createElement(TrustStrip, props));
  });
}

describe("TrustStrip", () => {
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

  it("renders full unknown copy and links to /profile/[address]", async () => {
    await renderStrip({
      density: "full",
      address: "0xabc0000000000000000000000000000000000001",
      unknown: true,
    });
    expect(document.body.textContent).toContain(UNKNOWN_ON_HASHPOP);
    expect(document.body.textContent).not.toContain("0.0 (0)");
    const link = document.querySelector("a") as HTMLAnchorElement;
    expect(link.href).toContain("/profile/0xabc0000000000000000000000000000000000001");
  });

  it("renders zero-deals copy on full density", async () => {
    await renderStrip({
      density: "full",
      address: "0xabc0000000000000000000000000000000000001",
      unknown: false,
      successfulCompletions: 0,
      reputationScore: 0,
      linkToProfile: false,
    });
    expect(document.body.textContent).toContain(ZERO_DEALS_FULL);
    expect(document.body.textContent).toContain("0");
  });

  it("renders reputationScore as a large cue on full and primary number on compact", async () => {
    await renderStrip({
      density: "full",
      address: "0xseller",
      unknown: false,
      successfulCompletions: 3,
      reputationScore: 27,
      linkToProfile: false,
    });
    expect(document.body.textContent).toContain("27");
    expect(document.body.textContent).toContain("3 completed");

    await act(async () => {
      root!.render(
        createElement(TrustStrip, {
          density: "compact",
          address: "0xseller",
          displayName: "Ada",
          unknown: false,
          successfulCompletions: 3,
          reputationScore: 27,
          linkToProfile: false,
        }),
      );
    });
    expect(document.body.textContent).toContain("27");
    expect(document.body.textContent).toContain("Ada");
  });

  it("styles the KYC chip with mint fill and mint border", async () => {
    await renderStrip({
      density: "full",
      address: "0xseller",
      unknown: false,
      successfulCompletions: 1,
      kycStatus: "VERIFIED",
      linkToProfile: false,
    });
    const kyc = document.querySelector('[data-testid="trust-kyc-chip"]');
    expect(kyc?.className).toContain("bg-[#00ffa3]/10");
    expect(kyc?.className).toContain("border-[#00ffa3]/25");
  });

  it("hides ratings when missing and shows them when present", async () => {
    await renderStrip({
      density: "compact",
      address: "0xseller",
      displayName: "Ada",
      unknown: false,
      successfulCompletions: 2,
      linkToProfile: false,
    });
    expect(document.body.textContent).not.toContain("0.0 (0)");
    expect(document.body.textContent).toContain("Ada");

    await act(async () => {
      root!.render(
        createElement(TrustStrip, {
          density: "compact",
          address: "0xseller",
          displayName: "Ada",
          ratingsAvg: 4.5,
          ratingsCount: 3,
          successfulCompletions: 2,
          linkToProfile: false,
        }),
      );
    });
    expect(document.body.textContent).toContain("4.5 (3)");
  });
});
