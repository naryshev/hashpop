export type SettlementAction =
  | { type: "reconcile"; release: boolean }
  | { type: "set-disputed"; disputed: boolean }
  | { type: "mark-shipped" }
  | { type: "resolve-timeout"; release: boolean };

export type V1SettlementInput = {
  hasBuyer: boolean;
  state: number;
  now: number;
  timeoutAt: number;
  disputeStatus: string | null;
};

export type V2SettlementInput = {
  hasBuyer: boolean;
  state: number;
  now: number;
  createdAt: number;
  shipDeadline: number;
  shippedAt: number;
  chainDisputed: boolean;
  dbDisputed: boolean;
  hasTracking: boolean;
  hardTimeout: number;
  autoReleaseWindow: number;
};

const AWAITING_SHIPMENT = 0;

/** v1: state 2 is already COMPLETE. Reconcile writes the DB and sends no transaction. */
export function planV1(input: V1SettlementInput): SettlementAction[] {
  if (!input.hasBuyer) return [];
  if (input.state === 2) return [{ type: "reconcile", release: true }];
  if (input.disputeStatus === "OPEN") return [];
  if (input.now < input.timeoutAt) return [];
  return [{ type: "resolve-timeout", release: input.state !== AWAITING_SHIPMENT }];
}

/**
 * v2: states 2 and 3 are already final on-chain. Those plans are reconcile-only,
 * so a replayed sweep cannot send setDisputed, markShipped, or resolveTimeout.
 * resolveTimeout is included only when the contract timeout is due.
 */
export function planV2(input: V2SettlementInput): SettlementAction[] {
  if (!input.hasBuyer) return [];
  if (input.state === 2) return [{ type: "reconcile", release: true }];
  if (input.state === 3) return [{ type: "reconcile", release: false }];

  const actions: SettlementAction[] = [];
  if (input.dbDisputed !== input.chainDisputed) {
    actions.push({ type: "set-disputed", disputed: input.dbDisputed });
  }
  if (input.state === AWAITING_SHIPMENT && input.hasTracking && !input.dbDisputed) {
    actions.push({ type: "mark-shipped" });
    return actions;
  }

  let due = false;
  let willRelease = false;
  if (input.dbDisputed || input.chainDisputed) {
    due = input.now >= input.createdAt + input.hardTimeout;
    willRelease = false;
  } else if (input.state === AWAITING_SHIPMENT) {
    due = input.now >= input.shipDeadline;
    willRelease = false;
  } else {
    due = input.now >= input.shippedAt + input.autoReleaseWindow;
    willRelease = true;
  }
  if (due) actions.push({ type: "resolve-timeout", release: willRelease });
  return actions;
}

export async function executeSettlementPlan(
  actions: SettlementAction[],
  deps: {
    finalize: (release: boolean) => Promise<unknown>;
    setDisputed: (disputed: boolean) => Promise<unknown>;
    markShipped: () => Promise<unknown>;
    resolveTimeout: () => Promise<unknown>;
  },
): Promise<void> {
  for (const action of actions) {
    if (action.type === "reconcile") {
      await deps.finalize(action.release);
      return;
    }
    if (action.type === "set-disputed") {
      await deps.setDisputed(action.disputed);
      continue;
    }
    if (action.type === "mark-shipped") {
      await deps.markShipped();
      return;
    }
    await deps.resolveTimeout();
    await deps.finalize(action.release);
    return;
  }
}
