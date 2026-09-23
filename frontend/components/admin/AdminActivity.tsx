"use client";

import Link from "next/link";
import { listingHref } from "../../lib/listingUrl";
import { activitySentence, formatRelativeAge } from "../../lib/adminFormat";
import { material } from "../../lib/materials";

export type ActivityEvent = {
  type: string;
  at: string;
  listingId?: string | null;
  listingTitle?: string | null;
  actor?: string | null;
  counterparty?: string | null;
  amountHbar?: string | null;
  status?: string | null;
};

const VISIBLE = 16;

export function AdminActivity({
  events,
  loading,
  className = "",
}: {
  events: ActivityEvent[];
  loading?: boolean;
  className?: string;
}) {
  const visible = events.slice(0, VISIBLE);

  return (
    <section className={`${material.regular} overflow-hidden rounded-[14px] ${className}`}>
      <div className="border-b border-hairline px-3 py-2.5">
        <h2 className="text-sm font-semibold text-white">Activity</h2>
      </div>
      {visible.length === 0 ? (
        <p className="px-3 py-6 text-sm text-silver">
          {loading ? "Loading…" : "No recent activity."}
        </p>
      ) : (
        <ul>
          {visible.map((event, i) => {
            const href = event.listingId ? listingHref(event.listingId) : null;
            const line = activitySentence(event);
            return (
              <li
                key={`${event.type}-${event.at}-${event.listingId ?? i}`}
                className="flex items-center gap-2 border-t border-hairline px-3 py-2 first:border-t-0"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#00ffa3]" aria-hidden />
                <div className="min-w-0 flex-1 truncate text-sm text-white">
                  {href ? (
                    <Link href={href} className="hover:text-chrome" target="_blank">
                      {line}
                    </Link>
                  ) : (
                    line
                  )}
                </div>
                <time className="shrink-0 text-[11px] text-silver" dateTime={event.at}>
                  {formatRelativeAge(event.at)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
