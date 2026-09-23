"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  Lock,
  MapPin,
  Package,
  Settings,
  Star,
  Tag,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { material } from "@/lib/materials";
import {
  DEAL_UPDATES_EMPTY_BODY,
  formatRelativeTime,
  type DealNotification,
  type DealNotificationKind,
} from "@/lib/dealNotifications";

const PANEL_EASE = [0.32, 0.72, 0, 1] as const;
const ENTER_S = 0.28;
const EXIT_S = 0.22;
const FEATURED_LIMIT = 2;

const ACTION_EMPTY_TITLE = "Nothing needs action.";
const ACTION_EMPTY_BODY = "Offers and meetups that need you show up here.";
/** Header stays “Notifications”; this is only the empty-state title. */
const NOTIFICATIONS_EMPTY_TITLE = "No notifications yet.";

const KIND_ICON: Record<DealNotificationKind, LucideIcon> = {
  offer: Tag,
  escrow: Lock,
  meetup: MapPin,
  ship: Package,
  rating: Star,
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const iconButton =
  "flex items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chrome";

export type NotificationsVariant = "mobile" | "desktop";
export type NotificationFilter = "inbox" | "action";

export type NotificationsPanelMotion = {
  initial: { x: string } | { opacity: number };
  animate: { x: number } | { opacity: number };
  exit: { x: string; transition: Transition } | { opacity: number; transition: Transition };
  transition: Transition;
};

/** Drawer enter/exit. Reduced motion fades in place instead of sliding. */
export function notificationsPanelMotion(reduceMotion: boolean): NotificationsPanelMotion {
  if (reduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0, transition: { duration: EXIT_S } },
      transition: { duration: ENTER_S },
    };
  }
  return {
    initial: { x: "100%" },
    animate: { x: 0 },
    exit: { x: "100%", transition: { duration: EXIT_S, ease: PANEL_EASE } },
    transition: { duration: ENTER_S, ease: PANEL_EASE },
  };
}

/**
 * Inbox shows every update and lifts the newest urgent items into featured cards.
 * Action needed keeps only urgent rows, so those cards are not listed twice.
 */
export function splitNotificationFeed(
  items: DealNotification[],
  filter: NotificationFilter,
  featureUrgent: boolean,
): { featured: DealNotification[]; rows: DealNotification[] } {
  const pool = filter === "action" ? items.filter((item) => item.urgent) : items;
  if (!featureUrgent || filter !== "inbox") return { featured: [], rows: pool };
  const featured: DealNotification[] = [];
  const rows: DealNotification[] = [];
  for (const item of pool) {
    if (item.urgent && featured.length < FEATURED_LIMIT) featured.push(item);
    else rows.push(item);
  }
  return { featured, rows };
}

function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getAttribute("aria-hidden") !== "true" && el.tabIndex >= 0,
  );
}

function KindMark({ kind }: { kind: DealNotificationKind }) {
  const Icon = KIND_ICON[kind];
  return (
    <span
      data-kind-mark=""
      className={cn(
        material.regular,
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-chrome",
      )}
      aria-hidden
    >
      <Icon size={16} />
    </span>
  );
}

function UnreadDot({ unread, featured }: { unread: boolean; featured?: boolean }) {
  return (
    <span
      data-notification-unread={unread ? "" : undefined}
      className={cn(
        "h-1.5 w-1.5 shrink-0 rounded-full",
        featured ? "mt-3.5" : null,
        unread ? "bg-chrome shadow-[0_0_6px_rgba(0,255,163,0.65)]" : "bg-transparent",
      )}
      aria-hidden
    />
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
      <p className="text-[15px] font-semibold text-white">{title}</p>
      <p className="mt-1 max-w-[16rem] text-[13px] leading-relaxed text-silver">{body}</p>
    </div>
  );
}

function FeedItem({
  item,
  unread,
  featured,
  onNavigate,
}: {
  item: DealNotification;
  unread: boolean;
  featured?: boolean;
  onNavigate: () => void;
}) {
  const time = formatRelativeTime(item.when);
  const content = (
    <div className={cn("flex min-w-0 flex-1 gap-3", featured ? "items-start" : "items-center")}>
      {unread ? <span className="sr-only">Unread</span> : null}
      <UnreadDot unread={unread} featured={featured} />
      <KindMark kind={item.kind} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-[15px] font-semibold text-white">{item.title}</p>
          {featured ? (
            <time
              dateTime={item.when.toISOString()}
              className="shrink-0 text-[12px] tabular-nums text-silver"
            >
              {time}
            </time>
          ) : null}
        </div>
        <p
          className={cn(
            "text-[13px] text-silver",
            featured ? "mt-0.5 line-clamp-2 leading-snug" : "mt-0.5 line-clamp-1",
          )}
        >
          {item.body}
        </p>
      </div>
      {featured ? null : (
        <div className="flex shrink-0 items-center gap-0.5 text-[12px] text-silver">
          <time dateTime={item.when.toISOString()} className="tabular-nums">
            {time}
          </time>
          {item.href ? (
            <span data-notification-chevron="" aria-hidden className="text-white/40">
              <ChevronRight size={16} />
            </span>
          ) : null}
        </div>
      )}
    </div>
  );

  if (!item.href) {
    return (
      <div className={featured ? undefined : "px-4 py-3"} data-notification-static="">
        {featured ? (
          <div className={cn(material.regular, "block rounded-control px-3.5 py-3")}>{content}</div>
        ) : (
          content
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={
        featured
          ? cn(
              material.regular,
              "block rounded-control px-3.5 py-3 transition-opacity hover:opacity-95",
            )
          : "flex w-full items-center px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
      }
    >
      {content}
    </Link>
  );
}

function OptionsMenu({
  gear,
  markDisabled,
  onMarkAllRead,
  onNavigate,
}: {
  gear: boolean;
  markDisabled: boolean;
  onMarkAllRead: () => void;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
    return () => {
      if (button?.isConnected) button.focus();
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative" data-notification-options="">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Notification options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(iconButton, gear ? "h-9 w-9" : "h-11 w-11")}
      >
        {gear ? <Settings size={18} aria-hidden /> : <EllipsisVertical size={20} aria-hidden />}
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Notification options"
          className={cn(
            material.regular,
            "absolute right-0 top-[calc(100%+4px)] z-20 w-52 rounded-control py-1 shadow-tab",
          )}
        >
          <button
            type="button"
            role="menuitem"
            disabled={markDisabled}
            className="block w-full px-3 py-2.5 text-left text-[13px] font-medium text-white hover:bg-white/5 disabled:opacity-40"
            onClick={() => {
              onMarkAllRead();
              setOpen(false);
            }}
          >
            Mark all as read
          </button>
          <Link
            href="/activity"
            role="menuitem"
            className="block px-3 py-2.5 text-[13px] font-medium text-white hover:bg-white/5"
            onClick={() => {
              setOpen(false);
              onNavigate();
            }}
          >
            View activity
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function FilterPill({
  id,
  controls,
  selected,
  onSelect,
  children,
}: {
  id: string;
  controls: string;
  selected: boolean;
  onSelect: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-controls={controls}
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "min-h-9 rounded-full px-3.5 text-[13px] font-medium transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chrome",
        selected
          ? cn(material.chrome, "text-white")
          : "border border-transparent text-silver hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

export type NotificationsPanelProps = {
  open: boolean;
  onClose: () => void;
  variant: NotificationsVariant;
  items: DealNotification[];
  loading: boolean;
  unreadIds: ReadonlySet<string>;
  onMarkAllRead: () => void;
};

export function NotificationsPanel({
  open,
  onClose,
  variant,
  items,
  loading,
  unreadIds,
  onMarkAllRead,
}: NotificationsPanelProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <NotificationsDialog
          onClose={onClose}
          variant={variant}
          items={items}
          loading={loading}
          unreadIds={unreadIds}
          onMarkAllRead={onMarkAllRead}
        />
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

function NotificationsDialog({
  onClose,
  variant,
  items,
  loading,
  unreadIds,
  onMarkAllRead,
}: Omit<NotificationsPanelProps, "open">) {
  const titleId = useId();
  const tabPanelId = useId();
  const inboxTabId = useId();
  const actionTabId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion() === true;
  const panelMotion = notificationsPanelMotion(reduceMotion);
  const desktop = variant === "desktop";
  const [filter, setFilter] = useState<NotificationFilter>("inbox");
  const { featured, rows } = splitNotificationFeed(items, desktop ? "inbox" : filter, !desktop);
  const empty = featured.length === 0 && rows.length === 0;
  const showLoading = loading && items.length === 0;

  useEffect(() => {
    const previously = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus({ preventScroll: true });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previously?.isConnected) previously.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        const expanded = dialogRef.current?.querySelector<HTMLButtonElement>(
          '[data-notification-options] [aria-expanded="true"]',
        );
        if (expanded) {
          expanded.click();
          return;
        }
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = focusableElements(dialogRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const root = dialogRef.current;
      if (!active || !root.contains(active) || active === root) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const emptyCopy =
    !desktop && filter === "action"
      ? { title: ACTION_EMPTY_TITLE, body: ACTION_EMPTY_BODY }
      : { title: NOTIFICATIONS_EMPTY_TITLE, body: DEAL_UPDATES_EMPTY_BODY };

  return (
    <div className="fixed inset-0 z-[130]">
      {desktop ? (
        <motion.div
          data-notifications-backdrop=""
          aria-hidden
          className={cn("absolute inset-0", material.scrim)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        />
      ) : null}
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-notifications-variant={variant}
        data-notifications-panel=""
        data-notifications-motion={reduceMotion ? "fade" : "slide-right"}
        className={cn(
          "flex min-h-0 flex-col bg-[#0b111b] text-white outline-none",
          desktop
            ? "absolute inset-y-0 right-0 w-[min(100vw,380px)] border-l border-hairline shadow-[-20px_0_48px_rgba(0,0,0,0.45)]"
            : "absolute inset-0",
        )}
        initial={panelMotion.initial}
        animate={panelMotion.animate}
        exit={panelMotion.exit}
        transition={panelMotion.transition}
      >
        <header
          className={cn(
            "relative z-20 shrink-0 bg-white/[0.04] backdrop-blur-material pt-[max(0.75rem,env(safe-area-inset-top))]",
            desktop ? "px-5" : "px-3",
          )}
        >
          {desktop ? (
            <div className="flex h-12 items-center justify-between gap-3">
              <h2 id={titleId} className="text-[17px] font-semibold tracking-tight text-white">
                Notifications
              </h2>
              <div className="flex items-center gap-1">
                <OptionsMenu
                  gear
                  markDisabled={unreadIds.size === 0}
                  onMarkAllRead={onMarkAllRead}
                  onNavigate={onClose}
                />
                <button
                  type="button"
                  aria-label="Close notifications"
                  onClick={onClose}
                  className={cn(iconButton, "h-9 w-9")}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          ) : (
            <div className="grid h-11 grid-cols-[2.75rem_1fr_2.75rem] items-center">
              <button
                type="button"
                aria-label="Back"
                onClick={onClose}
                className={cn(iconButton, "h-11 w-11 border border-hairline bg-white/10")}
              >
                <ChevronLeft size={20} />
              </button>
              <h2
                id={titleId}
                className="truncate text-center text-[17px] font-semibold text-white"
              >
                Notifications
              </h2>
              <div className="justify-self-end">
                <OptionsMenu
                  gear={false}
                  markDisabled={unreadIds.size === 0}
                  onMarkAllRead={onMarkAllRead}
                  onNavigate={onClose}
                />
              </div>
            </div>
          )}
        </header>

        {desktop ? null : (
          <div
            role="tablist"
            aria-label="Notification filters"
            className="flex shrink-0 gap-2 px-4 pb-3 pt-2"
          >
            <FilterPill
              id={inboxTabId}
              controls={tabPanelId}
              selected={filter === "inbox"}
              onSelect={() => setFilter("inbox")}
            >
              Inbox
            </FilterPill>
            <FilterPill
              id={actionTabId}
              controls={tabPanelId}
              selected={filter === "action"}
              onSelect={() => setFilter("action")}
            >
              Action needed
            </FilterPill>
          </div>
        )}

        <div
          id={desktop ? undefined : tabPanelId}
          role={desktop ? undefined : "tabpanel"}
          aria-labelledby={desktop ? undefined : filter === "inbox" ? inboxTabId : actionTabId}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-safe"
        >
          {showLoading ? (
            <p className="flex flex-1 items-center justify-center px-6 py-16 text-sm text-silver">
              Loading updates…
            </p>
          ) : empty ? (
            <EmptyState title={emptyCopy.title} body={emptyCopy.body} />
          ) : (
            <>
              {featured.length > 0 ? (
                <div className="flex flex-col gap-2 px-4 pt-1">
                  {featured.map((item) => (
                    <article key={item.id} data-notification-featured="">
                      <FeedItem
                        item={item}
                        unread={unreadIds.has(item.id)}
                        featured
                        onNavigate={onClose}
                      />
                    </article>
                  ))}
                </div>
              ) : null}
              {rows.length > 0 ? (
                <ul className={cn(featured.length > 0 ? "mt-2" : "pt-1")}>
                  {rows.map((item) => (
                    <li
                      key={item.id}
                      data-notification-row=""
                      className="border-b border-hairline last:border-b-0"
                    >
                      <FeedItem item={item} unread={unreadIds.has(item.id)} onNavigate={onClose} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
