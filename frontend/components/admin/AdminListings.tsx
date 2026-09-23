"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { listingHref } from "../../lib/listingUrl";
import { formatRelativeAge, listingStatusPill, STATUS_PILL_CLASS } from "../../lib/adminFormat";
import { material } from "../../lib/materials";
import { AdminWallet } from "./AdminBadge";

export type ListingChip = "" | "ACTIVE" | "PENDING" | "LOCKED" | "SOLD";

export type AdminListing = {
  id: string;
  seller: string;
  buyer: string | null;
  sellerIsAdmin?: boolean;
  buyerIsAdmin?: boolean;
  price: string;
  status: string;
  title: string | null;
  category: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt?: string;
  onChainConfirmed: boolean;
  disputeStatus: string | null;
};

const CHIPS: { id: ListingChip; label: string }[] = [
  { id: "", label: "Any" },
  { id: "ACTIVE", label: "Active" },
  { id: "PENDING", label: "Pending" },
  { id: "LOCKED", label: "Locked" },
  { id: "SOLD", label: "Sold" },
];

export const AdminListings = forwardRef<
  HTMLElement,
  {
    listings: AdminListing[];
    search: string;
    onSearch: (value: string) => void;
    statusChip: ListingChip;
    onStatusChip: (value: ListingChip) => void;
    loading?: boolean;
    deleting?: string | null;
    onApply: () => void;
    onDelete: (id: string, title: string | null) => void;
    className?: string;
  }
>(function AdminListings(
  {
    listings,
    search,
    onSearch,
    statusChip,
    onStatusChip,
    loading,
    deleting,
    onApply,
    onDelete,
    className = "",
  },
  ref,
) {
  return (
    <section
      ref={ref}
      id="listings"
      className={`${material.regular} overflow-hidden rounded-[14px] ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-3 py-2.5">
        <h2 className="text-sm font-semibold text-white">Listings</h2>
        {listings.length > 0 && (
          <span className="rounded-full bg-[#00ffa3]/15 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[#00ffa3]">
            {listings.length}
          </span>
        )}
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onApply();
          }}
          placeholder="Search id, title, seller…"
          className={`${material.regular} h-8 min-w-[200px] flex-1 rounded-[14px] px-3 text-sm text-white placeholder:text-silver/50 focus:outline-none`}
        />
        <div className="flex flex-wrap gap-1">
          {CHIPS.map((chip) => (
            <button
              key={chip.id || "any"}
              type="button"
              onClick={() => onStatusChip(chip.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] ${
                statusChip === chip.id
                  ? "bg-[#00ffa3]/15 text-[#00ffa3]"
                  : `${material.regular} text-silver`
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-[#0e1422] text-xs text-silver">
            <tr>
              <th className="px-3 py-2 font-medium"></th>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Seller</th>
              <th className="px-3 py-2 font-medium">Price ℏ</th>
              <th className="px-3 py-2 font-medium">Updated</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center">
                  {loading ? (
                    <p className="text-sm text-silver">Loading…</p>
                  ) : (
                    <>
                      <p className="text-sm text-white">No listings match.</p>
                      <p className="mt-1 text-xs text-silver">
                        Try another status or clear search.
                      </p>
                    </>
                  )}
                </td>
              </tr>
            ) : (
              listings.map((l) => {
                const pill = listingStatusPill(l.status, l.onChainConfirmed, l.disputeStatus);
                return (
                  <tr key={l.id} className="h-11 border-t border-hairline hover:bg-white/[0.04]">
                    <td className="px-3">
                      {l.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.imageUrl} alt="" className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded bg-white/5" />
                      )}
                    </td>
                    <td className="max-w-[220px] truncate px-3 text-white">
                      {l.title || l.id.slice(0, 14) + "…"}
                    </td>
                    <td className="px-3">
                      <span
                        className={`${material.regular} ${STATUS_PILL_CLASS[pill.tone]} rounded-full px-2 py-0.5 text-[11px]`}
                      >
                        {pill.label}
                      </span>
                    </td>
                    <td className="px-3">
                      <AdminWallet address={l.seller} isAdmin={l.sellerIsAdmin} />
                    </td>
                    <td className="px-3 font-mono text-xs tabular-nums text-white">{l.price}</td>
                    <td className="px-3 text-xs text-silver">
                      {formatRelativeAge(l.updatedAt || l.createdAt)}
                    </td>
                    <td className="px-3 text-right">
                      <Link
                        href={listingHref(l.id)}
                        target="_blank"
                        className="mr-2 text-xs text-silver hover:text-white"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() => onDelete(l.id, l.title)}
                        disabled={deleting === l.id}
                        className="text-xs text-danger hover:underline disabled:opacity-60"
                      >
                        {deleting === l.id ? "Removing…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-hairline md:hidden">
        {listings.length === 0 ? (
          <div className="px-3 py-8 text-center">
            {loading ? (
              <p className="text-sm text-silver">Loading…</p>
            ) : (
              <>
                <p className="text-sm text-white">No listings match.</p>
                <p className="mt-1 text-xs text-silver">Try another status or clear search.</p>
              </>
            )}
          </div>
        ) : (
          listings.map((l) => {
            const pill = listingStatusPill(l.status, l.onChainConfirmed, l.disputeStatus);
            return (
              <details key={l.id} className="px-3 py-2.5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                  <span className="truncate text-sm text-white">
                    {l.title || l.id.slice(0, 14) + "…"}
                  </span>
                  <span
                    className={`${material.regular} ${STATUS_PILL_CLASS[pill.tone]} rounded-full px-2 py-0.5 text-[11px]`}
                  >
                    {pill.label}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-white">{l.price} ℏ</span>
                </summary>
                <div className="mt-2 flex items-center justify-between text-xs text-silver">
                  <AdminWallet address={l.seller} isAdmin={l.sellerIsAdmin} />
                  <span className="flex gap-3">
                    <Link href={listingHref(l.id)} target="_blank" className="hover:text-white">
                      View
                    </Link>
                    <button
                      type="button"
                      onClick={() => onDelete(l.id, l.title)}
                      className="text-danger"
                    >
                      Delete
                    </button>
                  </span>
                </div>
              </details>
            );
          })
        )}
      </div>
      {loading && listings.length > 0 && (
        <p className="border-t border-hairline px-3 py-2 text-[11px] text-silver">Refreshing…</p>
      )}
    </section>
  );
});
