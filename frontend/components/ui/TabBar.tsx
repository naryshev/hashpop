"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { material } from "@/lib/materials";

export type TabBarItem = {
  id: string;
  icon: React.ReactNode;
  label: string;
  href?: string;
  badge?: number;
};

export type TabBarCenterAction = {
  id?: string;
  icon?: React.ReactNode;
  label: string;
  href?: string;
};

export type TabBarProps = {
  items: TabBarItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  centerAction?: TabBarCenterAction;
  hidden?: boolean;
};

function TabCell({
  item,
  active,
  onSelect,
}: {
  item: TabBarItem;
  active: boolean;
  onSelect?: (id: string) => void;
}) {
  const badge =
    item.badge != null && item.badge > 0 ? (item.badge > 9 ? "9+" : String(item.badge)) : null;

  const inner = (
    <>
      <span
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full transition-colors",
          active ? cn(material.chrome, "text-chrome") : "text-silver/70 hover:text-white",
        )}
      >
        {item.icon}
      </span>
      {badge && (
        <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-chrome px-1 text-[9px] font-bold text-black">
          {badge}
        </span>
      )}
    </>
  );

  const className = "relative flex h-11 items-center justify-center";

  if (item.href) {
    return (
      <Link
        href={item.href}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        onClick={() => onSelect?.(item.id)}
        className={className}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label={item.label}
      aria-pressed={active}
      onClick={() => onSelect?.(item.id)}
      className={className}
    >
      {inner}
    </button>
  );
}

function CenterFab({
  action,
  onSelect,
}: {
  action: TabBarCenterAction;
  onSelect?: (id: string) => void;
}) {
  const id = action.id ?? "create";
  const icon = action.icon ?? <Plus className="h-6 w-6" strokeWidth={2.6} />;
  const fab = (
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#00b37a_0%,#00ffa3_55%,#00e5ff_100%)] text-black ring-1 ring-[#00ffa3]/40">
      {icon}
    </span>
  );

  const className = "flex items-center justify-center";

  if (action.href) {
    return (
      <Link
        href={action.href}
        aria-label={action.label}
        onClick={() => onSelect?.(id)}
        className={className}
      >
        {fab}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label={action.label}
      onClick={() => onSelect?.(id)}
      className={className}
    >
      {fab}
    </button>
  );
}

/**
 * Floating 5-cell capsule tab bar. Side items are icon-only; the center slot
 * is an integrated mint Create FAB. Positioning and materials live here so
 * screens do not fork chrome.
 */
export function TabBar({ items, activeId, onSelect, centerAction, hidden }: TabBarProps) {
  if (hidden) return null;

  const mid = Math.floor(items.length / 2);
  const left = items.slice(0, mid);
  const right = items.slice(mid);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[60] px-3 md:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
      aria-label="Primary navigation"
    >
      <div
        className={cn(
          material.regular,
          "mx-auto grid max-w-sm grid-cols-5 items-center rounded-tab px-2 py-1.5 shadow-tab",
        )}
      >
        {left.map((item) => (
          <TabCell key={item.id} item={item} active={item.id === activeId} onSelect={onSelect} />
        ))}
        {centerAction ? <CenterFab action={centerAction} onSelect={onSelect} /> : <span />}
        {right.map((item) => (
          <TabCell key={item.id} item={item} active={item.id === activeId} onSelect={onSelect} />
        ))}
      </div>
    </nav>
  );
}
