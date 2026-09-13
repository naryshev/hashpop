import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShippingAddressModal } from "../ShippingAddressModal";
import { listingCta } from "../../lib/materials";

let root: Root;
let host: HTMLElement;

async function renderModal(props: {
  open?: boolean;
  listingId?: string;
  listingIds?: string[];
  buyerAddress?: string;
  ctaLabel?: string;
  onConfirmed?: () => void;
  onClose?: () => void;
}) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(ShippingAddressModal, {
        open: true,
        listingId: "listing-1",
        buyerAddress: "0xbuyer",
        onConfirmed: () => {},
        onClose: () => {},
        ...props,
      }),
    );
  });
}

function dialog(): HTMLElement {
  const el = document.querySelector('[role="dialog"]');
  if (!el) throw new Error("dialog not found");
  return el as HTMLElement;
}

function setInput(placeholder: string, value: string) {
  const input = document.querySelector(
    `input[placeholder="${placeholder}"]`,
  ) as HTMLInputElement | null;
  if (!input) throw new Error(`input not found: ${placeholder}`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("input value setter missing");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function saveButton(): HTMLButtonElement {
  const cta = document.querySelector("button.btn-mint") as HTMLButtonElement | null;
  if (!cta) throw new Error("save button not found");
  return cta;
}

describe("ShippingAddressModal", () => {
  beforeEach(() => {
    // React 19 / testing without RTL: allow act() wrapping.
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    window.localStorage.clear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    host.remove();
    vi.unstubAllGlobals();
  });

  it("presents as a shared medium Sheet with listingCta footer (no ad-hoc backdrop)", async () => {
    await renderModal({ ctaLabel: "Save & continue to payment" });

    const sheet = dialog();
    expect(sheet.querySelector("h2")?.textContent).toBe("Where should this ship?");
    expect(sheet.querySelector(".max-h-\\[56dvh\\]")).not.toBeNull();
    expect(sheet.querySelector(".bg-scrim")).not.toBeNull();

    const cta = saveButton();
    expect(cta.textContent).toBe("Save & continue to payment");
    expect(cta.className).toContain(listingCta.filled.split(" ")[0]);
    expect(cta.className).toContain("btn-mint");

    expect(sheet.className).not.toMatch(/z-\[300\]/);
    expect(sheet.innerHTML).not.toMatch(/bg-black\/80/);
    expect(sheet.innerHTML).not.toMatch(/btn-frost-cta/);
  });

  it("POSTs the trimmed address to the existing shipping-address API", async () => {
    const onConfirmed = vi.fn();
    await renderModal({
      listingIds: ["a", "b"],
      onConfirmed,
    });

    await act(async () => {
      setInput("Full name *", "  Ada Lovelace  ");
      setInput("Street address *", "  12 Computation Ave  ");
      setInput("City *", "  London  ");
      setInput("Postal / ZIP *", "  SW1A  ");
      setInput("Country (US) *", "gb");
    });

    await act(async () => {
      saveButton().click();
    });

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:4000/api/listing/a/shipping-address");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      buyerAddress: "0xbuyer",
      name: "Ada Lovelace",
      line1: "12 Computation Ave",
      city: "London",
      postalCode: "SW1A",
      country: "GB",
    });

    const [urlB] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(urlB).toBe("http://localhost:4000/api/listing/b/shipping-address");
    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });

  it("blocks dismiss while saving", async () => {
    const onClose = vi.fn();
    let release!: () => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            release = () => resolve(new Response("{}", { status: 200 }));
          }),
      ),
    );

    await renderModal({ onClose });

    await act(async () => {
      setInput("Full name *", "Ada Lovelace");
      setInput("Street address *", "12 Computation Ave");
      setInput("City *", "London");
      setInput("Postal / ZIP *", "SW1A");
    });

    const cta = saveButton();
    await act(async () => {
      cta.click();
    });

    expect(saveButton().disabled).toBe(true);
    expect(saveButton().textContent).toMatch(/Saving/);

    const scrim = document.querySelector(".bg-scrim") as HTMLElement;
    expect(scrim).toBeTruthy();
    await act(async () => {
      scrim.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      release();
    });
  });
});
