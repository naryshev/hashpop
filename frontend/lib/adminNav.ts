export type AdminTabId = "overview" | "trust" | "money" | "contracts";

export type AdminNavItem = {
  id: AdminTabId;
  label: string;
  href: string;
  comingSoon?: boolean;
  /** Quieter rail item. Contracts stays reachable without competing with queues. */
  secondary?: boolean;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { id: "overview", label: "Overview", href: "/admin" },
  { id: "trust", label: "Trust & safety", href: "/admin/trust" },
  { id: "money", label: "Money", href: "/admin/money" },
  { id: "contracts", label: "Contracts", href: "/admin/contracts", secondary: true },
];

export function adminTabFromPath(pathname: string): AdminTabId {
  if (pathname.startsWith("/admin/trust")) return "trust";
  if (pathname.startsWith("/admin/money") || pathname.startsWith("/admin/deals")) return "money";
  if (pathname.startsWith("/admin/contracts")) return "contracts";
  return "overview";
}
