export type AdminGateView = "connect" | "checking" | "empty" | "signin" | "console";

export function resolveAdminGateView(state: {
  isConnected: boolean;
  tokenHydrated: boolean;
  isAdmin: boolean | null;
  hasToken: boolean;
}): AdminGateView {
  if (!state.isConnected) return "connect";
  if (!state.tokenHydrated || state.isAdmin === null) return "checking";
  if (!state.isAdmin) return "empty";
  if (!state.hasToken) return "signin";
  return "console";
}
