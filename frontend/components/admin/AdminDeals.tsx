"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { listingHref } from "../../lib/listingUrl";
import {
  dealStageFromRow,
  formatRelativeAge,
  STATUS_PILL_CLASS,
  truncateAdminAddr,
  type ListingStatusTone,
} from "../../lib/adminFormat";
import { material } from "../../lib/materials";

export type AdminDeal = {
  listingId: string;
  title: string | null;
  imageUrl: string | null;
  seller: string;
  buyer: string | null;
  amountHbar: string;
  status: string;
  stage?: string;
  disputeStatus: string | null;
  updatedAt?: string;
  createdAt?: string;
  ageDays: number;
  stuck: boolean;
};

const STAGE_TONE: Record<string, ListingStatusTone> = {
  Offered: "silver",
  Locked: "bright",
  Meetup: "warning",
  Complete: "mint",
  Disputed: "danger",
};

export const AdminDeals = forwardRef<
  HTMLElement,
  {
    deals: AdminDeal[];
    stuckOnly: boolean;
    onStuckOnly: (value: boolean) => void;
    loading?: boolean;
    className?: string;
  }
>(function AdminDeals({ deals, stuckOnly, onStuckOnly, loading, className = "" }, ref) {
  return (
    <section
      ref={ref}
      id="deals"
      className={`${material.regular} overflow-hidden rounded-[14px] ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-3 py-2.5">
        <h2 className="text-sm font-semibold text-white">Deals</h2>
        {deals.length > 0 && (
          <span className="rounded-full bg-[#00ffa3]/15 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[#00ffa3]">
            {deals.length}
          </span>
        )}
        <label className="ml-auto flex items-center gap-2 text-xs text-silver">
          <input
            type="checkbox"
            checked={stuckOnly}
            onChange={(e) => onStuckOnly(e.target.checked)}
            className="accent-[#00ffa3]"
          />
          Stuck only
        </label>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-[#0e1422] text-xs text-silver">
            <tr>
              <th className="px-3 py-2 font-medium">Listing</th>
              <th className="px-3 py-2 font-medium">Buyer</th>
              <th className="px-3 py-2 font-medium">Seller</th>
              <th className="px-3 py-2 font-medium">Amount ℏ</th>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 font-medium">Updated</th>
              <th className="px-3 py-2 font-medium text-right">View</th>
            </tr>
          </thead>
          <tbody>
            {deals.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center">
                  {loading ? (
                    <p className="text-sm text-silver">Loading…</p>
                  ) : (
                    <>
                      <p className="text-sm text-white">No open deals.</p>
                      <p className="mt-1 text-xs text-silver">
                        Escrow and in-flight sales show up here.
                      </p>
                    </>
                  )}
                </td>
              </tr>
            ) : (
              deals.map((d) => {
                const stage = d.stage || dealStageFromRow(d);
                const tone = STAGE_TONE[stage] ?? "silver";
                return (
                  <tr
                    key={d.listingId}
                    className="h-11 border-t border-hairline hover:bg-white/[0.04]"
                  >
                    <td className="max-w-[220px] truncate px-3 text-white">
                      {d.title || d.listingId.slice(0, 14) + "…"}
                      {d.stuck && <span className="ml-2 text-[10px] text-danger">Stuck</span>}
                    </td>
                    <td className="px-3 font-mono text-xs text-silver">
                      {truncateAdminAddr(d.buyer)}
                    </td>
                    <td className="px-3 font-mono text-xs text-silver">
                      {truncateAdminAddr(d.seller)}
                    </td>
                    <td className="px-3 font-mono text-xs tabular-nums text-white">
                      {d.amountHbar}
                    </td>
                    <td className="px-3">
                      <span
                        className={`${material.regular} ${STATUS_PILL_CLASS[tone]} rounded-full px-2 py-0.5 text-[11px]`}
                      >
                        {stage}
                      </span>
                    </td>
                    <td className="px-3 text-xs text-silver">
                      {formatRelativeAge(d.updatedAt || d.createdAt || "")}
                    </td>
                    <td className="px-3 text-right">
                      <Link
                        href={listingHref(d.listingId)}
                        target="_blank"
                        className="text-xs text-silver hover:text-white"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-hairline md:hidden">
        {deals.length === 0 ? (
          <div className="px-3 py-8 text-center">
            {loading ? (
              <p className="text-sm text-silver">Loading…</p>
            ) : (
              <>
                <p className="text-sm text-white">No open deals.</p>
                <p className="mt-1 text-xs text-silver">Escrow and in-flight sales show up here.</p>
              </>
            )}
          </div>
        ) : (
          deals.map((d) => {
            const stage = d.stage || dealStageFromRow(d);
            const tone = STAGE_TONE[stage] ?? "silver";
            return (
              <div key={d.listingId} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-white">
                    {d.title || d.listingId.slice(0, 14) + "…"}
                  </span>
                  <span
                    className={`${material.regular} ${STATUS_PILL_CLASS[tone]} rounded-full px-2 py-0.5 text-[11px]`}
                  >
                    {stage}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-silver">
                  <span className="tabular-nums text-white">{d.amountHbar} ℏ</span>
                  <Link
                    href={listingHref(d.listingId)}
                    target="_blank"
                    className="hover:text-white"
                  >
                    View
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
      {loading && deals.length > 0 && (
        <p className="border-t border-hairline px-3 py-2 text-[11px] text-silver">Refreshing…</p>
      )}
    </section>
  );
});
