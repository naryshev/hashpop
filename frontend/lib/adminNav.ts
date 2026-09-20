export type AdminTabId = "overview" | "listings" | "deals" | "contracts" | "trust" | "money";

export type AdminNavItem = {
  id: AdminTabId;
  label: string;
  href: string;
  comingSoon?: boolean;
  phase?: string;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { id: "overview", label: "Overview", href: "/admin" },
  { id: "listings", label: "Listings", href: "/admin/listings" },
  { id: "deals", label: "Deals", href: "/admin/deals" },
  { id: "contracts", label: "Contracts", href: "/admin/contracts" },
  { id: "trust", label: "Trust & Safety", href: "/admin", comingSoon: true, phase: "Phase 2" },
  { id: "money", label: "Money", href: "/admin", comingSoon: true, phase: "Phase 3" },
];

export function adminTabFromPath(pathname: string): AdminTabId {
  if (pathname.startsWith("/admin/listings")) return "listings";
  if (pathname.startsWith("/admin/deals")) return "deals";
  if (pathname.startsWith("/admin/contracts")) return "contracts";
  return "overview";
}
