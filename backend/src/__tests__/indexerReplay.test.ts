import { describe, expect, it } from "vitest";
import { handleEvent } from "../indexer";

const LISTING_ID = "0x" + "ab".repeat(32);

function logger() {
  const info: unknown[] = [];
  return {
    info,
    log: {
      info: (...args: unknown[]) => info.push(args),
      debug: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
  };
}

describe("indexer replays", () => {
  it("does not turn a SOLD or REFUNDED listing back into LISTED", async () => {
    for (const status of ["SOLD", "REFUNDED"] as const) {
      const writes: string[] = [];
      const { log } = logger();
      await handleEvent(
        {
          type: "ItemListed",
          listingId: LISTING_ID,
          seller: "0x1111111111111111111111111111111111111111",
          price: 100_000_000n,
        },
        {
          listing: {
            findUnique: async () => ({ status }),
            upsert: async () => {
              writes.push("upsert");
            },
            update: async () => {
              writes.push("update");
            },
            updateMany: async () => {
              writes.push("updateMany");
              return { count: 1 };
            },
          },
          sale: { upsert: async () => undefined },
        } as never,
        log as never,
      );
      expect(writes).toEqual([]);
    }
  });

  it("does not turn a finalized escrow listing back into LOCKED when ItemPurchased is replayed", async () => {
    const writes: Array<{ status?: string }> = [];
    let sales = 0;
    const { log } = logger();
    await handleEvent(
      {
        type: "ItemPurchased",
        listingId: LISTING_ID,
        buyer: "0x2222222222222222222222222222222222222222",
        seller: "0x1111111111111111111111111111111111111111",
        price: 100_000_000n,
      },
      {
        listing: {
          findUnique: async () => ({ status: "REFUNDED", requireEscrow: true }),
          update: async (args: { data: { status?: string } }) => {
            writes.push(args.data);
          },
          updateMany: async (args: { data: { status?: string } }) => {
            writes.push(args.data);
            return { count: 1 };
          },
          upsert: async () => undefined,
        },
        sale: {
          upsert: async () => {
            sales += 1;
          },
        },
      } as never,
      log as never,
    );
    expect(sales).toBe(1);
    expect(writes).toEqual([]);
  });

  it("still locks an in-flight escrow purchase", async () => {
    const writes: Array<{ status?: string }> = [];
    const { log } = logger();
    await handleEvent(
      {
        type: "ItemPurchased",
        listingId: LISTING_ID,
        buyer: "0x2222222222222222222222222222222222222222",
        seller: "0x1111111111111111111111111111111111111111",
        price: 100_000_000n,
      },
      {
        listing: {
          findUnique: async () => ({ status: "LISTED", requireEscrow: true }),
          update: async (args: { data: { status?: string } }) => {
            writes.push(args.data);
          },
          upsert: async () => undefined,
          updateMany: async () => ({ count: 0 }),
        },
        sale: { upsert: async () => undefined },
      } as never,
      log as never,
    );
    expect(writes).toEqual([expect.objectContaining({ status: "LOCKED" })]);
  });

  it("does not cancel a finalized listing", async () => {
    const writes: Array<{ where: { status?: unknown } }> = [];
    const { log } = logger();
    await handleEvent(
      { type: "ListingCancelled", listingId: LISTING_ID, seller: "0xabc" },
      {
        listing: {
          updateMany: async (args: { where: { status?: unknown } }) => {
            writes.push(args);
            return { count: 0 };
          },
          findUnique: async () => null,
          upsert: async () => undefined,
          update: async () => undefined,
        },
        sale: { upsert: async () => undefined },
      } as never,
      log as never,
    );
    expect(writes[0]?.where.status).toEqual({ notIn: ["SOLD", "REFUNDED"] });
  });
});
