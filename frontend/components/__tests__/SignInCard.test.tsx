import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HASHPACK_NICKNAME_REQUIRED_MESSAGE } from "../../lib/hashpackSessionAlias";

const wallet = {
  connect: vi.fn(async () => {}),
  isConnecting: false,
  isReady: true,
  error: null as string | null,
  isConnected: false,
  notDetected: false,
  nicknameRequired: false,
  pairingUri: "wc:abc@2?relay-protocol=irn&symKey=deadbeef",
};

vi.mock("../../lib/hashpackWallet", () => ({
  useHashpackWallet: () => wallet,
  openHashPackDeepLink: () => {},
}));

import { SignInCard } from "../ui/SignInCard";

let root: Root | undefined;
let host: HTMLElement | undefined;

async function renderCard() {
  host = document.createElement("div");
  document.body.appendChild(host);
  const next = createRoot(host);
  root = next;
  await act(async () => {
    next.render(createElement(SignInCard));
  });
}

describe("SignInCard HashPack approval states", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    wallet.isConnecting = false;
    wallet.isConnected = false;
    wallet.notDetected = false;
    wallet.nicknameRequired = false;
    wallet.error = null;
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
    host?.remove();
    root = undefined;
  });

  it("explains the empty-nickname approval failure when the extension answered", async () => {
    wallet.nicknameRequired = true;
    wallet.error = HASHPACK_NICKNAME_REQUIRED_MESSAGE;
    await renderCard();
    expect(host?.textContent).toContain("HashPack could not approve");
    expect(host?.textContent).toContain("wallet nickname");
    expect(host?.textContent).not.toContain("HashPack not detected");
  });

  it("still offers install guidance when no extension answered", async () => {
    wallet.notDetected = true;
    await renderCard();
    expect(host?.textContent).toContain("HashPack not detected");
    expect(host?.textContent).toContain("Install HashPack");
    expect(host?.textContent).not.toContain("HashPack could not approve");
  });
});
