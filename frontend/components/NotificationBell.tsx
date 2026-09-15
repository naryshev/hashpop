"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet } from "./ui/Sheet";
import { useDealNotifications, markDealUpdatesSeen } from "../hooks/useDealNotifications";
import {
  DEAL_UPDATES_EMPTY_BODY,
  DEAL_UPDATES_EMPTY_TITLE,
  formatRelativeTime,
} from "../lib/dealNotifications";

export type NotificationBellProps = {
  className?: string;
  iconClassName?: string;
  /** Desktop header uses a 36px hit target; mobile top bar is a padded icon. */
  variant?: "mobile" | "desktop";
};

export function NotificationBell({
  className,
  iconClassName,
  variant = "mobile",
}: NotificationBellProps) {
  const { items, tone, loading } = useDealNotifications();
  const [open, setOpen] = useState(false);

  const openSheet = () => {
    markDealUpdatesSeen();
    setOpen(true);
  };

  const hit =
    variant === "desktop"
      ? "relative flex h-9 w-9 items-center justify-center rounded-glass text-neutral-300 hover:bg-white/5 hover:text-white"
      : "relative rounded-full p-2 text-silver hover:text-white";

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-label={tone ? "Notifications, new updates" : "Notifications"}
        className={cn(hit, className)}
      >
        <Bell className={iconClassName} size={variant === "desktop" ? 16 : 18} />
        {tone && (
          <span
            data-bell-dot={tone}
            className={cn(
              "absolute h-2 w-2 rounded-full",
              variant === "desktop" ? "right-1.5 top-1.5" : "right-1.5 top-1.5",
              tone === "red" ? "bg-[#f43f5e]" : "bg-[#00ffa3]",
            )}
          />
        )}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Updates" detent="medium">
        {loading && items.length === 0 ? (
          <p className="py-6 text-sm text-silver">Loading updates…</p>
        ) : items.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-[15px] font-semibold text-white">{DEAL_UPDATES_EMPTY_TITLE}</p>
            <p className="mt-1 text-[13px] text-silver">{DEAL_UPDATES_EMPTY_BODY}</p>
          </div>
        ) : (
          <ul className="pb-3">
            {items.map((item) => {
              const row = (
                <div className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-white">
                      {item.title}
                    </div>
                    <div className="mt-0.5 line-clamp-1 text-[12px] text-silver">{item.body}</div>
                  </div>
                  <div className="shrink-0 font-mono text-[11px] tabular-nums text-silver">
                    {formatRelativeTime(item.when)}
                  </div>
                </div>
              );
              return (
                <li key={item.id} className="border-b border-white/[0.06] last:border-0">
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="block hover:opacity-90"
                      onClick={() => setOpen(false)}
                    >
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Sheet>
    </>
  );
}
