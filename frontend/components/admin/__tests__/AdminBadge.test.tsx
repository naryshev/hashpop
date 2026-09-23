import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AdminAllowlist } from "../AdminAllowlist";
import { AdminBadge, AdminWallet } from "../AdminBadge";

let root: Root | undefined;
let host: HTMLElement | undefined;

async function render(node: ReturnType<typeof createElement>) {
  host = document.createElement("div");
  document.body.appendChild(host);
  const next = createRoot(host);
  root = next;
  await act(async () => {
    next.render(node);
  });
}

describe("Admin badge", () => {
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

  it("renders a sentence-case Admin pill", async () => {
    await render(createElement(AdminBadge));
    const pill = host?.querySelector("span");
    expect(pill?.textContent).toBe("Admin");
    expect(pill?.className).toContain("bg-[#00ffa3]/15");
  });

  it("shows the pill beside an allowlisted wallet and hides it otherwise", async () => {
    await render(
      createElement(
        "div",
        null,
        createElement(AdminWallet, {
          address: "0x000000000000000000000000000000000093ddbb",
          isAdmin: true,
        }),
        createElement(AdminWallet, { address: "0xbuyer", isAdmin: false }),
      ),
    );
    const text = host?.textContent ?? "";
    expect(text).toContain("Admin");
    expect(text).toContain("0x0000…ddbb");
    expect(text).toContain("0xbuyer");
    expect(host?.querySelectorAll("span").length).toBeGreaterThan(0);
    const pills = Array.from(host?.querySelectorAll("span") ?? []).filter(
      (node) => node.textContent === "Admin",
    );
    expect(pills).toHaveLength(1);
  });

  it("lists allowlisted admins as truncated read-only rows", async () => {
    await render(
      createElement(AdminAllowlist, {
        admins: [
          { address: "0.0.9690555" },
          { address: "0x0000000000000000000000000000000000000aaa" },
        ],
      }),
    );
    expect(host?.textContent).toContain("Admins");
    expect(host?.textContent).toContain("0.0.9690555");
    expect(host?.textContent).toContain("0x0000…0aaa");
    expect(host?.querySelector("button")).toBeNull();
    expect(host?.querySelector("input")).toBeNull();
  });
});
