"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, X } from "lucide-react";
import { useProfile } from "../lib/profiles";

const BROWSED_KEY = "hashpop.onboard.browsed";

/**
 * Zero-state onboarding checklist for brand-new users (no trades, no
 * listings). Guides them to complete their profile, browse, and post their
 * first item, then disappears permanently once they graduate (post an item)
 * or dismiss it.
 */
export function OnboardingChecklist({
  address,
  hasListings,
  hasTrades,
}: {
  address: string;
  hasListings: boolean;
  hasTrades: boolean;
}) {
  const profile = useProfile(address);
  const [browsed, setBrowsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const dismissKey = `hashpop.onboard.dismissed.${address.toLowerCase()}`;

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(dismissKey) === "1");
      setBrowsed(window.localStorage.getItem(BROWSED_KEY) === "1");
    } catch {
      // ignore
    }
    setHydrated(true);
  }, [dismissKey]);

  const markBrowsed = () => {
    setBrowsed(true);
    try {
      window.localStorage.setItem(BROWSED_KEY, "1");
    } catch {
      // ignore
    }
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(dismissKey, "1");
    } catch {
      // ignore
    }
  };

  // Only relevant for new users; established users (any trade or listing) and
  // anyone who dismissed it never see it.
  if (!hydrated || dismissed || hasTrades || hasListings) return null;

  const profileDone = !!profile?.displayName?.trim();

  const steps = [
    {
      done: profileDone,
      label: "Complete your profile",
      hint: "Add a display name and avatar so buyers see who they're dealing with.",
      href: `/profile/${encodeURIComponent(address)}`,
      cta: "Edit profile",
    },
    {
      done: browsed,
      label: "Browse listings",
      hint: "See what's for sale and how listings look.",
      href: "/marketplace",
      cta: "Browse",
      onClick: markBrowsed,
    },
    {
      done: false,
      label: "Post your first item",
      hint: "List something to start selling on Hashpop.",
      href: "/create",
      cta: "Create listing",
    },
  ];

  const completed = steps.filter((s) => s.done).length;

  return (
    <div className="relative rounded-2xl border border-[#00ffa3]/25 bg-gradient-to-br from-[#00ffa3]/[0.06] to-transparent p-5">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 text-silver/60 hover:text-white"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
      <h2 className="text-lg font-bold text-white">Welcome to Hashpop</h2>
      <p className="mt-1 text-sm text-silver">
        Here&apos;s how to get started — {completed} of {steps.length} done.
      </p>
      <ul className="mt-4 space-y-2">
        {steps.map((step) => (
          <li
            key={step.label}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
          >
            {step.done ? (
              <CheckCircle2 size={18} className="shrink-0 text-[#00ffa3]" />
            ) : (
              <Circle size={18} className="shrink-0 text-silver/40" />
            )}
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-medium ${step.done ? "text-silver line-through" : "text-white"}`}
              >
                {step.label}
              </p>
              {!step.done && <p className="text-xs text-silver/70">{step.hint}</p>}
            </div>
            {!step.done && (
              <Link
                href={step.href}
                onClick={step.onClick}
                className="shrink-0 rounded-glass border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
              >
                {step.cta}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
