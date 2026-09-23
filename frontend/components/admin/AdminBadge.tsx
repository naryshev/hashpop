import { STATUS_PILL_CLASS, truncateAdminAddr } from "../../lib/adminFormat";
import { material } from "../../lib/materials";

export function AdminBadge() {
  return (
    <span
      className={`${material.regular} ${STATUS_PILL_CLASS.mint} rounded-full px-2 py-0.5 text-[11px] font-medium`}
    >
      Admin
    </span>
  );
}

export function AdminWallet({
  address,
  isAdmin = false,
}: {
  address?: string | null;
  isAdmin?: boolean;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      <span className="truncate font-mono text-xs text-silver" title={address ?? undefined}>
        {truncateAdminAddr(address)}
      </span>
      {isAdmin ? <AdminBadge /> : null}
    </span>
  );
}
