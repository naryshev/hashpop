import { describe, expect, it } from "vitest";
import { itemListedPersistAction, persistItemListed, type ItemListedStore } from "../indexer/index";

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

describe("persistItemListed", () => {
  const id = "0xlisting";
  const seller = "0xseller";
  const next = { price: "5", status: "LISTED", onChainConfirmed: true };

  it("skips an unchanged replay without writing", async () => {
    const store = scriptedStore(next);
    await expect(persistItemListed(store, { id, seller, ...next })).resolves.toBe("skip");
    expect(store.creates).toEqual([]);
    expect(store.updates).toEqual([]);
  });

  it("updates a changed replay and does not create", async () => {
    const store = scriptedStore({ ...next, price: "4" });
    await expect(persistItemListed(store, { id, seller, ...next })).resolves.toBe("update");
    expect(store.creates).toEqual([]);
    expect(store.updates).toEqual([next]);
  });

  it("creates when the row is missing", async () => {
    const store = scriptedStore(null);
    await expect(persistItemListed(store, { id, seller, ...next })).resolves.toBe("create");
    expect(store.creates).toEqual([{ id, seller, ...next }]);
    expect(store.updates).toEqual([]);
  });

  it("falls back to skip when a concurrent create already wrote the same fields", async () => {
    const store = scriptedStore(null);
    store.create = async () => {
      store.row = next;
      throw uniqueViolation();
    };
    await expect(persistItemListed(store, { id, seller, ...next })).resolves.toBe("skip");
    expect(store.updates).toEqual([]);
  });

  it("falls back to update when a concurrent create wrote different fields", async () => {
    const store = scriptedStore(null);
    store.create = async () => {
      store.row = { ...next, price: "9" };
      throw uniqueViolation();
    };
    await expect(persistItemListed(store, { id, seller, ...next })).resolves.toBe("update");
    expect(store.updates).toEqual([next]);
  });

  it("rethrows a create error that is not a unique violation", async () => {
    const store = scriptedStore(null);
    store.create = async () => {
      throw new Error("database unavailable");
    };
    await expect(persistItemListed(store, { id, seller, ...next })).rejects.toThrow(
      "database unavailable",
    );
  });

  it("rethrows a unique violation when the row is still missing", async () => {
    const store = scriptedStore(null);
    store.create = async () => {
      throw uniqueViolation();
    };
    await expect(persistItemListed(store, { id, seller, ...next })).rejects.toThrow(
      "Unique constraint failed",
    );
    expect(store.updates).toEqual([]);
  });
});

function uniqueViolation(): Error {
  const err = new Error("Unique constraint failed on the fields: (`id`)");
  (err as Error & { code: string }).code = "P2002";
  return err;
}

function scriptedStore(
  row: { price: string; status: string; onChainConfirmed: boolean } | null,
): ItemListedStore & {
  row: { price: string; status: string; onChainConfirmed: boolean } | null;
  creates: Array<{
    id: string;
    seller: string;
    price: string;
    status: string;
    onChainConfirmed: boolean;
  }>;
  updates: Array<{ price: string; status: string; onChainConfirmed: boolean }>;
} {
  const store = {
    row,
    creates: [] as Array<{
      id: string;
      seller: string;
      price: string;
      status: string;
      onChainConfirmed: boolean;
    }>,
    updates: [] as Array<{ price: string; status: string; onChainConfirmed: boolean }>,
    findUnique: async () => store.row,
    create: async (data: {
      id: string;
      seller: string;
      price: string;
      status: string;
      onChainConfirmed: boolean;
    }) => {
      store.creates.push(data);
      store.row = {
        price: data.price,
        status: data.status,
        onChainConfirmed: data.onChainConfirmed,
      };
    },
    update: async (
      _id: string,
      data: { price: string; status: string; onChainConfirmed: boolean },
    ) => {
      store.updates.push(data);
      store.row = data;
    },
  };
  return store;
}
