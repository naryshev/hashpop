"use client";

import { AdminBadge } from "./AdminBadge";
import { truncateAdminAddr } from "../../lib/adminFormat";
import { material } from "../../lib/materials";

export type AdminIdentity = {
  address: string;
};

export function AdminAllowlist({
  admins,
  loading,
  className = "",
}: {
  admins: AdminIdentity[];
  loading?: boolean;
  className?: string;
}) {
  return (
    <section className={`${material.regular} overflow-hidden rounded-[14px] ${className}`}>
      <div className="border-b border-hairline px-3 py-2.5">
        <h2 className="text-sm font-semibold text-white">Admins</h2>
      </div>
      {admins.length === 0 ? (
        <p className="px-3 py-4 text-sm text-silver">
          {loading ? "Loading…" : "No allowlisted admins."}
        </p>
      ) : (
        <ul>
          {admins.map((admin) => (
            <li
              key={admin.address}
              className="flex items-center gap-2 border-t border-hairline px-3 py-2 first:border-t-0"
            >
              <span
                className="min-w-0 flex-1 truncate font-mono text-xs text-silver"
                title={admin.address}
              >
                {truncateAdminAddr(admin.address)}
              </span>
              <AdminBadge />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
