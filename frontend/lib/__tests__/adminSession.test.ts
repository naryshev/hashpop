import { afterEach, describe, expect, it } from "vitest";
import {
  ADMIN_TOKEN_KEY,
  adminHeader,
  loadAdminToken,
  saveAdminToken,
  type AdminToken,
} from "../adminSession";

const valid: AdminToken = {
  address: "0xabc",
  t: Date.now(),
  signature: "0xsig",
};

afterEach(() => {
  window.localStorage.clear();
});

describe("adminSession", () => {
  it("returns null when nothing is stored", () => {
    expect(loadAdminToken()).toBeNull();
  });

  it("round-trips a valid token", () => {
    saveAdminToken(valid);
    expect(loadAdminToken()).toEqual(valid);
  });

  it("drops an expired token", () => {
    saveAdminToken({ ...valid, t: Date.now() - 25 * 60 * 60 * 1000 });
    expect(loadAdminToken()).toBeNull();
    expect(window.localStorage.getItem(ADMIN_TOKEN_KEY)).toBeNull();
  });

  it("encodes the token as x-admin-token", () => {
    const headers = adminHeader(valid);
    expect(headers["x-admin-token"]).toBe(window.btoa(JSON.stringify(valid)));
  });

  it("clears storage on sign-out", () => {
    saveAdminToken(valid);
    saveAdminToken(null);
    expect(loadAdminToken()).toBeNull();
  });
});
