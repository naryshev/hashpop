import { describe, expect, it } from "vitest";
import { executeSettlementPlan, planV1, planV2, type SettlementAction } from "../settlement/plan";
import { finalizeLockedListing } from "../settlement/finalize";
import type { PrismaClient } from "../generated/prisma/client";

function txNames(actions: SettlementAction[]): string[] {
  return actions.map((action) => action.type);
}

describe("settlement plans", () => {
  it("reconciles a completed v1 escrow without a transaction even if the timeout is due", () => {
    const actions = planV1({
      hasBuyer: true,
      state: 2,
      now: 9_999,
      timeoutAt: 1,
      disputeStatus: "OPEN",
    });
    expect(actions).toEqual([{ type: "reconcile", release: true }]);
    expect(txNames(actions)).not.toContain("resolve-timeout");
  });

  it("does not call resolveTimeout before the v1 timeout", () => {
    expect(
      planV1({
        hasBuyer: true,
        state: 0,
        now: 100,
        timeoutAt: 101,
        disputeStatus: null,
      }),
    ).toEqual([]);
  });

  it("calls resolveTimeout only once the v1 timeout is due", () => {
    expect(
      planV1({
        hasBuyer: true,
        state: 0,
        now: 100,
        timeoutAt: 100,
        disputeStatus: null,
      }),
    ).toEqual([{ type: "resolve-timeout", release: false }]);
    expect(
      planV1({
        hasBuyer: true,
        state: 1,
        now: 100,
        timeoutAt: 100,
        disputeStatus: null,
      }),
    ).toEqual([{ type: "resolve-timeout", release: true }]);
  });

  it("reconciles v2 final states and sends no transaction", () => {
    const released = planV2({
      hasBuyer: true,
      state: 2,
      now: 500,
      createdAt: 0,
      shipDeadline: 0,
      shippedAt: 0,
      chainDisputed: false,
      dbDisputed: true,
      hasTracking: true,
      hardTimeout: 1,
      autoReleaseWindow: 1,
    });
    const refunded = planV2({
      hasBuyer: true,
      state: 3,
      now: 500,
      createdAt: 0,
      shipDeadline: 0,
      shippedAt: 0,
      chainDisputed: true,
      dbDisputed: false,
      hasTracking: true,
      hardTimeout: 1,
      autoReleaseWindow: 1,
    });
    expect(released).toEqual([{ type: "reconcile", release: true }]);
    expect(refunded).toEqual([{ type: "reconcile", release: false }]);
  });

  it("does not resolve a v2 escrow before it is due, and does resolve it when it is", () => {
    const waiting = planV2({
      hasBuyer: true,
      state: 0,
      now: 10,
      createdAt: 0,
      shipDeadline: 11,
      shippedAt: 0,
      chainDisputed: false,
      dbDisputed: false,
      hasTracking: false,
      hardTimeout: 100,
      autoReleaseWindow: 100,
    });
    const due = planV2({
      hasBuyer: true,
      state: 1,
      now: 50,
      createdAt: 0,
      shipDeadline: 10,
      shippedAt: 20,
      chainDisputed: false,
      dbDisputed: false,
      hasTracking: false,
      hardTimeout: 100,
      autoReleaseWindow: 30,
    });
    expect(waiting.some((action) => action.type === "resolve-timeout")).toBe(false);
    expect(due).toEqual([{ type: "resolve-timeout", release: true }]);
  });

  it("does not send a transaction when executing a reconcile plan", async () => {
    const calls: string[] = [];
    await executeSettlementPlan([{ type: "reconcile", release: true }], {
      finalize: async () => {
        calls.push("finalize");
      },
      setDisputed: async () => {
        calls.push("set-disputed");
      },
      markShipped: async () => {
        calls.push("mark-shipped");
      },
      resolveTimeout: async () => {
        calls.push("resolve-timeout");
      },
    });
    expect(calls).toEqual(["finalize"]);
  });

  it("sends resolveTimeout only for a resolve-timeout action, then finalizes", async () => {
    const calls: string[] = [];
    await executeSettlementPlan([{ type: "resolve-timeout", release: false }], {
      finalize: async (release) => {
        calls.push(`finalize:${release}`);
      },
      setDisputed: async () => {
        calls.push("set-disputed");
      },
      markShipped: async () => {
        calls.push("mark-shipped");
      },
      resolveTimeout: async () => {
        calls.push("resolve-timeout");
      },
    });
    expect(calls).toEqual(["resolve-timeout", "finalize:false"]);
  });
});

describe("finalizeLockedListing", () => {
  it("updates only LOCKED rows and logs only when a row changed", async () => {
    const calls: Array<{ where: unknown; data: unknown }> = [];
    const logs: string[] = [];
    const count = await finalizeLockedListing(
      {
        listing: {
          updateMany: async (args: { where: unknown; data: unknown }) => {
            calls.push(args);
            return { count: 0 };
          },
        },
      } as unknown as PrismaClient,
      {
        info: () => logs.push("settled"),
      },
      "listing-1",
      true,
      "0xabc",
    );
    expect(count).toBe(0);
    expect(logs).toEqual([]);
    expect(calls).toEqual([
      {
        where: { id: "listing-1", status: "LOCKED" },
        data: expect.objectContaining({ status: "SOLD" }),
      },
    ]);
  });

  it("logs Escrow settled and closes an open dispute when the LOCKED row updates", async () => {
    const calls: Array<{ where: unknown; data: unknown }> = [];
    const logs: Array<{ msg: string; outcome?: string }> = [];
    let n = 0;
    await finalizeLockedListing(
      {
        listing: {
          updateMany: async (args: { where: unknown; data: unknown }) => {
            calls.push(args);
            n += 1;
            return { count: n === 1 ? 1 : 1 };
          },
        },
      } as unknown as PrismaClient,
      {
        info: (obj, msg) => logs.push({ msg, outcome: (obj as { outcome?: string }).outcome }),
      },
      "listing-1",
      false,
    );
    expect(logs).toEqual([{ msg: "Escrow settled", outcome: "refunded" }]);
    expect(calls[0]?.where).toEqual({ id: "listing-1", status: "LOCKED" });
    expect(calls[1]?.where).toEqual({ id: "listing-1", disputeStatus: "OPEN" });
    expect(calls[1]?.data).toEqual({ disputeStatus: "RESOLVED" });
  });
});
