import { describe, expect, it } from "vitest";
import { ADMIN_NAV, adminTabFromPath } from "../adminNav";
import { resolveAdminGateView } from "../adminGate";

describe("resolveAdminGateView", () => {
  it("asks disconnected visitors to sign in", () => {
    expect(
      resolveAdminGateView({
        isConnected: false,
        tokenHydrated: true,
        isAdmin: null,
        hasToken: false,
      }),
    ).toBe("connect");
  });

  it("shows a checking state until the allowlist and stored token hydrate", () => {
    expect(
      resolveAdminGateView({
        isConnected: true,
        tokenHydrated: false,
        isAdmin: null,
        hasToken: false,
      }),
    ).toBe("checking");
    expect(
      resolveAdminGateView({
        isConnected: true,
        tokenHydrated: true,
        isAdmin: null,
        hasToken: false,
      }),
    ).toBe("checking");
  });

  it("hides the console from wallets that are not allowlisted", () => {
    expect(
      resolveAdminGateView({
        isConnected: true,
        tokenHydrated: true,
        isAdmin: false,
        hasToken: false,
      }),
    ).toBe("empty");
  });

  it("asks allowlisted wallets to sign a session when no token is stored", () => {
    expect(
      resolveAdminGateView({
        isConnected: true,
        tokenHydrated: true,
        isAdmin: true,
        hasToken: false,
      }),
    ).toBe("signin");
  });

  it("opens the console once a signed session exists", () => {
    expect(
      resolveAdminGateView({
        isConnected: true,
        tokenHydrated: true,
        isAdmin: true,
        hasToken: true,
      }),
    ).toBe("console");
  });
});

describe("adminNav", () => {
  it("locks the rail to Overview, live Trust & safety, Money soon, quieter Contracts", () => {
    expect(ADMIN_NAV.map((item) => item.id)).toEqual(["overview", "trust", "money", "contracts"]);
    expect(ADMIN_NAV.map((item) => item.label)).toEqual([
      "Overview",
      "Trust & safety",
      "Money",
      "Contracts",
    ]);
    expect(ADMIN_NAV.find((item) => item.id === "trust")?.href).toBe("/admin/trust");
    expect(ADMIN_NAV.find((item) => item.id === "trust")?.comingSoon).toBeUndefined();
    expect(ADMIN_NAV.filter((item) => item.comingSoon).map((item) => item.id)).toEqual(["money"]);
    expect(ADMIN_NAV.find((item) => item.id === "contracts")?.secondary).toBe(true);
  });

  it("maps admin routes to the locked tabs", () => {
    expect(adminTabFromPath("/admin")).toBe("overview");
    expect(adminTabFromPath("/admin/trust")).toBe("trust");
    expect(adminTabFromPath("/admin/contracts")).toBe("contracts");
    expect(adminTabFromPath("/admin/listings")).toBe("overview");
    expect(adminTabFromPath("/admin/deals")).toBe("overview");
  });
});
