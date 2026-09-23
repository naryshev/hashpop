export type AdminTabId = "overview" | "trust" | "money" | "contracts";

export type AdminNavItem = {
  id: AdminTabId;
  label: string;
  href: string;
  comingSoon?: boolean;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { id: "overview", label: "Overview", href: "/admin" },
  { id: "trust", label: "Trust & safety", href: "/admin", comingSoon: true },
  { id: "money", label: "Money", href: "/admin", comingSoon: true },
  { id: "contracts", label: "Contracts", href: "/admin/contracts" },
];

export function adminTabFromPath(pathname: string): AdminTabId {
  if (pathname.startsWith("/admin/contracts")) return "contracts";
  return "overview";
}
