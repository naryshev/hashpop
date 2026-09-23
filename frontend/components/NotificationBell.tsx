"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDockBadgeCount } from "@/lib/dockBadge";
import { DockBadge } from "./ui/DockBadge";
import { NotificationsPanel } from "./NotificationsPanel";
import { useDealNotifications, markDealUpdatesSeen } from "../hooks/useDealNotifications";

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
  const { items, unseen, loading } = useDealNotifications();
  const [open, setOpen] = useState(false);
  // Snapshot of ids that were unread at open. Marking seen clears the bell
  // immediately; the dots stay until this panel visit ends or mark-all-read.
  const [unreadIds, setUnreadIds] = useState<ReadonlySet<string>>(() => new Set());
  const badgeLabel = formatDockBadgeCount(unseen.length);

  const openPanel = () => {
    setUnreadIds(new Set(unseen.map((item) => item.id)));
    markDealUpdatesSeen();
    setOpen(true);
  };

  const markAllRead = () => {
    markDealUpdatesSeen();
    setUnreadIds(new Set());
  };

  const hit =
    variant === "desktop"
      ? "relative flex h-9 w-9 items-center justify-center rounded-glass text-neutral-300 hover:bg-white/5 hover:text-white"
      : "relative rounded-full p-2 text-silver hover:text-white";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          openPanel();
        }}
        aria-expanded={open}
        aria-label={badgeLabel ? `Notifications, ${badgeLabel}` : "Notifications"}
        className={cn(hit, className)}
      >
        <span className="relative inline-flex">
          <Bell className={iconClassName} size={variant === "desktop" ? 16 : 18} />
          <DockBadge count={unseen.length} size="compact" />
        </span>
      </button>
      <NotificationsPanel
        open={open}
        onClose={() => setOpen(false)}
        variant={variant}
        items={items}
        loading={loading}
        unreadIds={unreadIds}
        onMarkAllRead={markAllRead}
      />
    </>
  );
}
