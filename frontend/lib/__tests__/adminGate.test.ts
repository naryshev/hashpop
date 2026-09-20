import { describe, expect, it } from "vitest";
import { resolveAdminGateView } from "../adminGate";
import { ADMIN_NAV, adminTabFromPath } from "../adminNav";

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
  it("includes Phase 1 tabs plus later-phase stubs", () => {
    const ids = ADMIN_NAV.map((item) => item.id);
    expect(ids).toEqual(["overview", "listings", "deals", "contracts", "trust", "money"]);
    expect(ADMIN_NAV.filter((item) => item.comingSoon).map((item) => item.id)).toEqual([
      "trust",
      "money",
    ]);
  });

  it("maps admin subroutes to the active tab", () => {
    expect(adminTabFromPath("/admin")).toBe("overview");
    expect(adminTabFromPath("/admin/listings")).toBe("listings");
    expect(adminTabFromPath("/admin/deals")).toBe("deals");
    expect(adminTabFromPath("/admin/contracts")).toBe("contracts");
  });
});
