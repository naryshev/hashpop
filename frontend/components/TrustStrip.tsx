"use client";

import Link from "next/link";
import { BadgeCheck, Star, User } from "lucide-react";
import { material } from "../lib/materials";
import { cn } from "../lib/utils";
import { profileAvatarUrl, profileDisplayName, useProfile } from "../lib/profiles";
import { identityTitle, trustStripView, type TrustStripDensity } from "../lib/trustStrip";

export type TrustStripProps = {
  density: TrustStripDensity;
  address: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  reputationScore?: number;
  totalSales?: number;
  successfulCompletions?: number;
  refunds?: number;
  timeouts?: number;
  kycStatus?: string | null;
  ratingsAvg?: number | null;
  ratingsCount?: number;
  completedBuys?: number;
  loading?: boolean;
  unknown?: boolean;
  onPressProfile?: () => void;
  className?: string;
  /** When false, the strip is not a profile link (used under an existing identity header). */
  linkToProfile?: boolean;
};

function Chip({
  children,
  className,
  mint,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  mint?: boolean;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        mint
          ? "border border-[#00ffa3]/25 bg-[#00ffa3]/10 text-chrome"
          : "border border-hairline bg-white/[0.04] text-white/80",
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

/**
 * Shared trust primitive for profile (full), listing + chat (compact),
 * and ListingCard (inline). Tap routes to `/profile/[address]`.
 */
export function TrustStrip({
  density,
  address,
  displayName,
  avatarUrl,
  reputationScore,
  totalSales,
  successfulCompletions,
  refunds,
  timeouts,
  kycStatus,
  ratingsAvg,
  ratingsCount,
  completedBuys,
  loading,
  unknown,
  onPressProfile,
  className,
  linkToProfile = true,
}: TrustStripProps) {
  const profile = useProfile(address);
  const resolvedName = identityTitle({
    displayName: displayName ?? profile?.displayName,
    hashpackName: profileDisplayName(profile) ?? profile?.hashpackName,
    address,
  });
  const resolvedAvatar = avatarUrl ?? profileAvatarUrl(profile);
  const resolvedKyc =
    kycStatus ?? (profile?.kycVerified ? "VERIFIED" : profile ? "UNVERIFIED" : undefined);
  const resolvedRatingsAvg = ratingsAvg ?? profile?.ratingAverage ?? undefined;
  const resolvedRatingsCount = ratingsCount ?? profile?.ratingCount;

  const view = trustStripView({
    density,
    loading,
    unknown,
    reputationScore,
    totalSales,
    successfulCompletions,
    refunds,
    timeouts,
    kycStatus: resolvedKyc,
    ratingsAvg: resolvedRatingsAvg,
    ratingsCount: resolvedRatingsCount,
    completedBuys,
  });

  const href = `/profile/${encodeURIComponent(address)}`;
  const interactive = linkToProfile && !!address;

  const identity = density !== "full" && (
    <span className="flex min-w-0 items-center gap-2">
      {density === "compact" &&
        (resolvedAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolvedAvatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-silver">
            <User size={16} />
          </span>
        ))}
      {density === "inline" && resolvedAvatar && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolvedAvatar} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />
      )}
      <span
        className={cn(
          "truncate",
          density === "compact" ? "text-sm font-semibold text-white" : "text-[12px] text-silver/70",
        )}
      >
        {resolvedName}
      </span>
    </span>
  );

  const scoreCue = view.scoreLabel ? (
    <span
      className={cn(
        "shrink-0 font-bold tabular-nums text-white",
        view.scoreSize === "large" ? "text-[32px] leading-none tracking-tight" : "text-sm",
      )}
    >
      {view.scoreLabel}
    </span>
  ) : null;

  const chips = (
    <>
      {view.showRatings && view.ratingsLabel && (
        <Chip className="text-amber-300/90">
          <Star size={11} className="fill-amber-400 text-amber-400" />
          {view.ratingsLabel}
        </Chip>
      )}
      {view.showKyc && (
        <Chip mint className="text-chrome" data-testid="trust-kyc-chip">
          <BadgeCheck size={12} className="text-chrome" aria-hidden />
          {density === "full" ? view.kycLabel : null}
        </Chip>
      )}
      {view.refundsLabel && <Chip className="text-silver/70">{view.refundsLabel}</Chip>}
      {view.timeoutsLabel && <Chip className="text-silver/70">{view.timeoutsLabel}</Chip>}
    </>
  );

  const signals = (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
      {view.showSkeleton && (
        <span className="h-4 w-24 animate-pulse rounded-full bg-white/10" aria-hidden />
      )}
      {density !== "full" && scoreCue}
      {view.unknownLabel && (
        <span className={cn("text-silver/70", density === "full" ? "text-sm" : "text-[11px]")}>
          {view.unknownLabel}
        </span>
      )}
      {density !== "full" && view.completedLine && (
        <span className="text-sm text-white/80">{view.completedLine}</span>
      )}
      {density !== "full" && chips}
    </span>
  );

  const inner =
    density === "full" ? (
      <div
        className={cn(
          material.regular,
          "flex min-h-[72px] max-h-[88px] items-center gap-3 rounded-[16px] px-4 py-3",
          className,
        )}
      >
        {view.showSkeleton ? (
          <span className="h-4 w-24 animate-pulse rounded-full bg-white/10" aria-hidden />
        ) : (
          <>
            {scoreCue}
            <span className="flex min-w-0 flex-col justify-center gap-1">
              {view.unknownLabel && (
                <span className="text-sm text-silver/70">{view.unknownLabel}</span>
              )}
              {view.completedLine && (
                <span className="text-sm text-white/80">{view.completedLine}</span>
              )}
              <span className="flex min-w-0 flex-wrap items-center gap-1.5">{chips}</span>
            </span>
          </>
        )}
      </div>
    ) : density === "compact" ? (
      <div
        className={cn("flex min-h-9 items-center justify-between gap-3", className)}
        style={{ minHeight: 36, maxHeight: 44 }}
      >
        {identity}
        {signals}
      </div>
    ) : (
      <div className={cn("flex min-w-0 items-center gap-1.5", className)}>
        {identity}
        {signals}
      </div>
    );

  if (!interactive) return inner;

  if (onPressProfile) {
    return (
      <button type="button" onClick={onPressProfile} className="block w-full text-left">
        {inner}
      </button>
    );
  }

  return (
    <Link
      href={href}
      className="block w-full text-left"
      aria-label={`View ${resolvedName} profile`}
    >
      {inner}
    </Link>
  );
}
