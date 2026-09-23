"use client";

import { useState } from "react";
import Link from "next/link";
import { listingHref } from "../../lib/listingUrl";
import { formatRelativeAge, STATUS_PILL_CLASS, truncateAdminAddr } from "../../lib/adminFormat";
import { material } from "../../lib/materials";
import { Sheet } from "../ui/Sheet";
import {
  TRUST_EMPTY,
  TRUST_LISTING_FILTERS,
  TRUST_SEARCH_MISS,
  TRUST_SEARCH_PLACEHOLDER,
  trustListingActions,
  trustReasonChip,
  trustStatusPill,
  type TrustListingFilter,
} from "../../lib/adminTrust";

export type TrustListing = {
  id: string;
  title: string | null;
  imageUrl: string | null;
  seller: string;
  status: string;
  onChainConfirmed: boolean;
  disputeStatus: string | null;
  moderationStatus: string | null;
  moderationReason: string | null;
  updatedAt: string;
};

type ConfirmKind = "hide" | "remove";

function listingTitle(listing: TrustListing): string {
  return listing.title?.trim() || `${listing.id.slice(0, 14)}…`;
}

function StatusPill({ moderationStatus }: { moderationStatus: string | null }) {
  const pill = trustStatusPill(moderationStatus);
  return (
    <span
      className={`${material.regular} ${STATUS_PILL_CLASS[pill.tone]} rounded-full px-2 py-0.5 text-[11px]`}
    >
      {pill.label}
    </span>
  );
}

function ReasonChip({ code }: { code: string | null }) {
  const chip = trustReasonChip(code);
  const tone =
    chip.tone === "danger"
      ? "bg-danger/15 text-danger"
      : chip.tone === "silver"
        ? "bg-white/5 text-silver"
        : "bg-warning/15 text-warning";
  return (
    <span className={`${material.regular} ${tone} rounded-full px-2 py-0.5 text-[11px]`}>
      {chip.label}
    </span>
  );
}

function QueueEmpty({ appliedSearch }: { appliedSearch: string }) {
  const copy = appliedSearch.trim() ? TRUST_SEARCH_MISS : TRUST_EMPTY.listings;
  return (
    <>
      <p className="text-sm text-white">{copy.title}</p>
      <p className="mt-1 text-xs text-silver">{copy.sub}</p>
    </>
  );
}

function QueueSkeleton() {
  return (
    <div className="space-y-2 px-3 py-3" data-trust-skeleton="">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-8 animate-pulse rounded-[14px] bg-white/[0.04]" />
      ))}
    </div>
  );
}

function RowActions({
  listing,
  busy,
  onHide,
  onRemove,
  onFlag,
  onClear,
}: {
  listing: TrustListing;
  busy: boolean;
  onHide: () => void;
  onRemove: () => void;
  onFlag: () => void;
  onClear: () => void;
}) {
  const actions = trustListingActions(listing.moderationStatus, listing.moderationReason);
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      {actions.view && (
        <Link
          href={listingHref(listing.id)}
          target="_blank"
          className="text-xs text-silver hover:text-white"
        >
          View
        </Link>
      )}
      {actions.hide && (
        <button
          type="button"
          onClick={onHide}
          disabled={busy}
          className="text-xs text-warning hover:underline disabled:opacity-60"
        >
          Hide
        </button>
      )}
      {actions.remove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          className="text-xs text-danger hover:underline disabled:opacity-60"
        >
          Remove
        </button>
      )}
      {actions.flag && (
        <button
          type="button"
          onClick={onFlag}
          disabled={busy}
          aria-pressed={actions.flagActive}
          className={`text-xs hover:underline disabled:opacity-60 ${
            actions.flagActive ? "text-warning" : "text-silver"
          }`}
        >
          Flag
        </button>
      )}
      {actions.clear && (
        <button
          type="button"
          onClick={onClear}
          disabled={busy}
          className="text-xs text-[#00ffa3] hover:underline disabled:opacity-60"
        >
          Clear
        </button>
      )}
    </span>
  );
}

export function TrustListingsTable({
  listings,
  loading,
  search,
  onSearch,
  onApplySearch,
  appliedSearch = "",
  filter,
  onFilter,
  busyId,
  onHide,
  onRemove,
  onFlag,
  onClear,
}: {
  listings: TrustListing[];
  loading?: boolean;
  search: string;
  onSearch: (value: string) => void;
  onApplySearch: (next?: string) => void;
  appliedSearch?: string;
  filter: TrustListingFilter;
  onFilter: (value: TrustListingFilter) => void;
  busyId: string | null;
  onHide: (listing: TrustListing, reason: string) => void;
  onRemove: (listing: TrustListing) => void;
  onFlag: (listing: TrustListing) => void;
  onClear: (listing: TrustListing) => void;
}) {
  const [confirm, setConfirm] = useState<{ kind: ConfirmKind; listing: TrustListing } | null>(null);
  const [reason, setReason] = useState("");

  const openConfirm = (kind: ConfirmKind, listing: TrustListing) => {
    setReason("");
    setConfirm({ kind, listing });
  };

  const closeConfirm = () => setConfirm(null);

  const submitConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === "hide") onHide(confirm.listing, reason.trim());
    else onRemove(confirm.listing);
    closeConfirm();
  };

  return (
    <section className={`${material.regular} overflow-hidden rounded-[14px]`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-3 py-2.5">
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onApplySearch();
          }}
          placeholder={TRUST_SEARCH_PLACEHOLDER}
          aria-label="Search listings"
          className={`${material.regular} h-8 min-w-[200px] flex-1 rounded-[14px] px-3 text-sm text-white placeholder:text-silver/50 focus:outline-none`}
        />
        {search.trim() && (
          <button
            type="button"
            onClick={() => {
              onSearch("");
              onApplySearch("");
            }}
            className="text-xs text-silver hover:text-white"
          >
            Clear search
          </button>
        )}
        <div className="flex flex-wrap gap-1" role="group" aria-label="Listing filters">
          {TRUST_LISTING_FILTERS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => onFilter(chip.id)}
              aria-pressed={filter === chip.id}
              className={`rounded-full px-2.5 py-1 text-[11px] ${
                filter === chip.id
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
              <th className="px-3 py-2 font-medium">Reason</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Seller</th>
              <th className="px-3 py-2 font-medium">Updated</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-3 text-center">
                  {loading ? <QueueSkeleton /> : <QueueEmpty appliedSearch={appliedSearch} />}
                </td>
              </tr>
            ) : (
              listings.map((listing) => {
                return (
                  <tr
                    key={listing.id}
                    className="h-11 border-t border-hairline hover:bg-white/[0.04]"
                  >
                    <td className="px-3">
                      {listing.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={listing.imageUrl}
                          alt=""
                          className="h-8 w-8 rounded object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded bg-white/5" />
                      )}
                    </td>
                    <td className="max-w-[220px] truncate px-3 text-white">
                      {listingTitle(listing)}
                    </td>
                    <td className="px-3">
                      <ReasonChip code={listing.moderationReason} />
                    </td>
                    <td className="px-3">
                      <StatusPill moderationStatus={listing.moderationStatus} />
                    </td>
                    <td className="px-3 font-mono text-xs text-silver">
                      {truncateAdminAddr(listing.seller)}
                    </td>
                    <td className="px-3 text-xs text-silver">
                      {formatRelativeAge(listing.updatedAt)}
                    </td>
                    <td className="px-3 text-right">
                      <RowActions
                        listing={listing}
                        busy={busyId === listing.id}
                        onHide={() => openConfirm("hide", listing)}
                        onRemove={() => openConfirm("remove", listing)}
                        onFlag={() => onFlag(listing)}
                        onClear={() => onClear(listing)}
                      />
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
          <div className="px-3 py-3 text-center">
            {loading ? <QueueSkeleton /> : <QueueEmpty appliedSearch={appliedSearch} />}
          </div>
        ) : (
          listings.map((listing) => {
            return (
              <div key={listing.id} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-white">{listingTitle(listing)}</span>
                  <StatusPill moderationStatus={listing.moderationStatus} />
                </div>
                <div className="mt-1">
                  <ReasonChip code={listing.moderationReason} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-silver">
                  <span>{truncateAdminAddr(listing.seller)}</span>
                  <span>{formatRelativeAge(listing.updatedAt)}</span>
                </div>
                <div className="mt-2">
                  <RowActions
                    listing={listing}
                    busy={busyId === listing.id}
                    onHide={() => openConfirm("hide", listing)}
                    onRemove={() => openConfirm("remove", listing)}
                    onFlag={() => onFlag(listing)}
                    onClear={() => onClear(listing)}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      <Sheet
        open={confirm !== null}
        onClose={closeConfirm}
        detent="medium"
        ariaLabel={confirm?.kind === "remove" ? "Remove this listing?" : "Hide this listing?"}
        title={confirm?.kind === "remove" ? "Remove this listing?" : "Hide this listing?"}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeConfirm}
              className="rounded-[14px] px-4 py-2 text-sm text-silver hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitConfirm}
              className={`rounded-[14px] px-4 py-2 text-sm font-bold ${
                confirm?.kind === "remove" ? "bg-danger text-white" : "bg-warning text-on-warning"
              }`}
            >
              {confirm?.kind === "remove" ? "Remove listing" : "Hide listing"}
            </button>
          </div>
        }
      >
        {confirm?.kind === "remove" ? (
          <p className="text-sm text-silver">
            Permanently remove {listingTitle(confirm.listing)} from the marketplace. Sale history
            stays.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-silver">
              {confirm ? listingTitle(confirm.listing) : "This listing"} leaves the marketplace
              until you clear the hide.
            </p>
            <label className="block text-xs text-silver" htmlFor="hide-reason">
              Reason
            </label>
            <textarea
              id="hide-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Why is this hidden?"
              className={`${material.regular} w-full rounded-[14px] px-3 py-2 text-sm text-white placeholder:text-silver/50 focus:outline-none`}
            />
          </div>
        )}
      </Sheet>
    </section>
  );
}
