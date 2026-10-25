import { describe, expect, it } from "vitest";
import { itemListedPersistAction } from "../indexer/index";

describe("itemListedPersistAction", () => {
  const next = { price: "5", status: "LISTED", onChainConfirmed: true };

  it("creates when the listing is new", () => {
    expect(itemListedPersistAction(null, next)).toBe("create");
  });

  it("skips a rewrite when price, status, and confirmation are unchanged", () => {
    expect(itemListedPersistAction(next, next)).toBe("skip");
  });

  it("updates when the indexed fields changed", () => {
    expect(itemListedPersistAction({ ...next, price: "4" }, next)).toBe("update");
    expect(itemListedPersistAction({ ...next, status: "LOCKED" }, next)).toBe("update");
    expect(itemListedPersistAction({ ...next, onChainConfirmed: false }, next)).toBe("update");
  });
});
