"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, ChevronLeft, LayoutDashboard, Mail, User } from "lucide-react";
import { AddressDisplay } from "./AddressDisplay";
import { ListingCard, type ListingCardItem } from "./ListingCard";
import { TrustStrip } from "./TrustStrip";
import { getApiUrl } from "../lib/apiUrl";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { compressImage } from "../lib/compressImage";
import { listingCta, material } from "../lib/materials";
import { profileAvatarUrl, profileDisplayName, useProfile } from "../lib/profiles";
import {
  PROFILE_BADGES_EMPTY,
  PROFILE_LISTINGS_EMPTY,
  PROFILE_REVIEWS_OWN_EMPTY,
  UNKNOWN_ON_HASHPOP,
  identityTitle,
  profileAddressKey,
} from "../lib/trustStrip";
import { cn } from "../lib/utils";

type ProfileStats = {
  address: string;
  totalSales?: number;
  activeListings?: number;
  reputation?: number;
  reputationScore?: number;
  ratingCount?: number;
  ratingAverage?: number | null;
  successful?: number;
  successfulCompletions?: number;
  refunds?: number;
  timeouts?: number;
  completedBuys?: number;
};

type Kyc = {
  status: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED" | string;
  submittedAt?: string | null;
  legalName?: string | null;
  dateOfBirth?: string | null;
  country?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
};

type ProfileData = {
  address: string;
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  kyc: Kyc;
};

type RatingRow = {
  id: string;
  reviewerAddress: string;
  score: number;
  comment?: string | null;
  createdAt: string;
};

type ProfileTab = "listings" | "reviews" | "badges";

const TABS: { key: ProfileTab; label: string }[] = [
  { key: "listings", label: "Listings" },
  { key: "reviews", label: "Reviews" },
  { key: "badges", label: "Badges" },
];

export function ProfileContent({
  address: addressParam,
  startInEdit = false,
}: {
  address: string;
  startInEdit?: boolean;
}) {
  const router = useRouter();
  const address = profileAddressKey(addressParam);
  const { address: connectedAddress, accountId } = useHashpackWallet();
  const isSelf = useMemo(() => {
    const keys = [connectedAddress, accountId]
      .filter(Boolean)
      .map((v) => profileAddressKey(String(v)));
    return !!address && keys.includes(address);
  }, [connectedAddress, accountId, address]);

  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [listings, setListings] = useState<ListingCardItem[]>([]);
  const [reviews, setReviews] = useState<RatingRow[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [tab, setTab] = useState<ProfileTab>("listings");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileData | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    if (isSelf && startInEdit) setEditing(true);
  }, [isSelf, startInEdit]);

  useEffect(() => {
    if (!address) return;
    const api = getApiUrl();
    setStatsLoading(true);
    fetch(`${api}/api/user/${encodeURIComponent(address)}`)
      .then((r) => r.json())
      .then((d: ProfileStats) => setStats(d))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
    fetch(`${api}/api/user/${encodeURIComponent(address)}/profile`)
      .then((r) => r.json())
      .then((p: ProfileData) => setProfile(p))
      .catch(() => setProfile(null));
    fetch(`${api}/api/user/${encodeURIComponent(address)}/listings`)
      .then((r) => r.json())
      .then((d: { active?: ListingCardItem[] }) => setListings(d.active ?? []))
      .catch(() => setListings([]));
    fetch(`${api}/api/ratings/${encodeURIComponent(address)}`)
      .then((r) => r.json())
      .then((d: { ratings?: RatingRow[] }) => setReviews(d.ratings ?? []))
      .catch(() => setReviews([]));
  }, [address]);

  useEffect(() => {
    if (profile && !draft) setDraft(profile);
  }, [profile, draft]);

  const onSave = async () => {
    if (!draft || !isSelf) return;
    setSaving(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/user/${address}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: draft.displayName ?? "",
          bio: draft.bio ?? "",
          avatarUrl: draft.avatarUrl ?? "",
          kyc: {
            legalName: draft.kyc?.legalName ?? "",
            dateOfBirth: draft.kyc?.dateOfBirth ?? "",
            country: draft.kyc?.country ?? "",
            idType: draft.kyc?.idType ?? "",
            idNumber: draft.kyc?.idNumber ?? "",
            addressLine1: draft.kyc?.addressLine1 ?? "",
            addressLine2: draft.kyc?.addressLine2 ?? "",
            city: draft.kyc?.city ?? "",
            region: draft.kyc?.region ?? "",
            postalCode: draft.kyc?.postalCode ?? "",
          },
        }),
      });
      if (!res.ok) throw new Error("save failed");
      const updated = (await res.json()) as ProfileData;
      setProfile(updated);
      setDraft(updated);
      setEditing(false);
    } catch {
      // keep edit mode open
    } finally {
      setSaving(false);
    }
  };

  const onAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !isSelf) return;
    if (!/^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.type)) return;
    setAvatarUploading(true);
    try {
      const compressed = await compressImage(file);
      const form = new FormData();
      form.append("media", compressed);
      const res = await fetch(`${getApiUrl()}/api/upload-listing-media`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("upload failed");
      const data = (await res.json()) as { mediaUrl?: string };
      if (data.mediaUrl) {
        setDraft((d) => (d ? { ...d, avatarUrl: data.mediaUrl } : d));
      }
    } catch {
      // retry
    } finally {
      setAvatarUploading(false);
    }
  };

  const publicProfile = useProfile(address);
  const fallbackAvatar = profileAvatarUrl(publicProfile);
  const stagedAvatar = editing
    ? draft?.avatarUrl?.trim() || null
    : profile?.avatarUrl?.trim() || null;
  const avatarUrl = stagedAvatar ?? fallbackAvatar;
  const title = identityTitle({
    displayName: profile?.displayName,
    hashpackName: profileDisplayName(publicProfile) ?? publicProfile?.hashpackName,
    address,
  });
  const isVerified = profile?.kyc?.status === "VERIFIED";
  const completions = stats?.successfulCompletions ?? stats?.successful ?? 0;
  const unknown =
    !statsLoading &&
    completions === 0 &&
    (stats?.totalSales ?? 0) === 0 &&
    (stats?.ratingCount ?? 0) === 0 &&
    (stats?.completedBuys ?? 0) === 0;

  const goBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/marketplace");
  }, [router]);

  return (
    <main className="min-h-screen pb-24">
      <header className={cn(material.regular, "sticky top-0 z-20 border-b px-3 py-3 sm:px-6")}>
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white hover:bg-white/10"
          >
            <ChevronLeft size={18} />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-[28px] font-bold tracking-tight text-white">
            {isSelf ? "Profile" : title}
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
        <div className="flex items-start gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="h-[72px] w-[72px] shrink-0 rounded-full border border-hairline object-cover sm:h-[88px] sm:w-[88px]"
            />
          ) : (
            <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full border border-hairline bg-white/5 text-silver/60 sm:h-[88px] sm:w-[88px]">
              <User size={32} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-1.5 text-2xl font-bold text-white sm:text-3xl">
              <span className="truncate">{title}</span>
              {isVerified && (
                <BadgeCheck size={22} className="shrink-0 text-chrome" aria-label="KYC verified" />
              )}
            </h2>
            <p className="mt-1 font-mono text-sm text-silver">
              <AddressDisplay address={address} showVerified={false} preferName={false} />
            </p>
            {(editing ? draft?.bio : profile?.bio)?.trim() ? (
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/80">
                {editing ? draft?.bio : profile?.bio}
              </p>
            ) : null}
          </div>
          {isSelf ? (
            editing ? (
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="shrink-0 rounded-full bg-[#00ffa3] px-4 py-2 text-xs font-bold text-black hover:bg-[#00ffa3]/90 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="shrink-0 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10"
              >
                Edit
              </button>
            )
          ) : (
            <Link
              href={`/messages?openThread=${encodeURIComponent(address)}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[linear-gradient(110deg,#00b37a_0%,#00ffa3_50%,#00e5ff_100%)] px-3.5 py-2 text-xs font-bold text-black"
            >
              <Mail size={14} />
              Message
            </Link>
          )}
        </div>

        {isSelf && (
          <Link
            href="/dashboard"
            className={cn(
              listingCta.tinted,
              "inline-flex h-11 items-center justify-center gap-2 rounded-[14px] px-4",
            )}
          >
            <LayoutDashboard size={16} />
            My Hashpop
          </Link>
        )}

        <TrustStrip
          density="full"
          address={address}
          displayName={profile?.displayName}
          avatarUrl={avatarUrl}
          reputationScore={stats?.reputationScore ?? stats?.reputation}
          totalSales={stats?.totalSales}
          successfulCompletions={completions}
          refunds={stats?.refunds}
          timeouts={stats?.timeouts}
          kycStatus={profile?.kyc?.status}
          ratingsAvg={stats?.ratingAverage}
          ratingsCount={stats?.ratingCount}
          completedBuys={stats?.completedBuys}
          loading={statsLoading}
          unknown={unknown}
          linkToProfile={false}
        />

        {editing && isSelf && (
          <div className={cn(material.regular, "space-y-3 rounded-[16px] p-4")}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Edit profile</p>
              <button
                type="button"
                onClick={() => {
                  setDraft(profile);
                  setEditing(false);
                }}
                className="text-xs text-silver hover:text-white"
              >
                Cancel
              </button>
            </div>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10">
                {avatarUploading ? "Uploading…" : "Upload photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  disabled={avatarUploading}
                  onChange={onAvatarSelected}
                />
              </label>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setDraft((d) => (d ? { ...d, avatarUrl: null } : d))}
                  className="text-xs text-silver hover:text-rose-300"
                >
                  Remove
                </button>
              )}
            </div>
            <label className="block">
              <span className="text-xs text-silver">Bio</span>
              <textarea
                className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                rows={3}
                value={draft?.bio ?? ""}
                onChange={(e) => setDraft((d) => (d ? { ...d, bio: e.target.value } : d))}
                maxLength={500}
              />
            </label>
          </div>
        )}

        <div className="flex gap-1 rounded-full border border-hairline bg-white/[0.04] p-1">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex-1 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors",
                  active ? "bg-[#00ffa3]/15 text-[#00ffa3]" : "text-silver hover:text-white",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "listings" &&
          (listings.length === 0 ? (
            <EmptyState
              headline={PROFILE_LISTINGS_EMPTY}
              body={
                isSelf
                  ? "List something to start trading on Hashpop."
                  : "This seller has nothing listed right now."
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {listings.map((item) => (
                <ListingCard key={item.id} item={item} density="compact" />
              ))}
            </div>
          ))}

        {tab === "reviews" &&
          (reviews.length === 0 ? (
            <EmptyState
              headline={isSelf ? PROFILE_REVIEWS_OWN_EMPTY : UNKNOWN_ON_HASHPOP}
              body={
                isSelf
                  ? "Complete a contract and ratings will land here."
                  : "No reviews yet — reputation builds with each contract."
              }
            />
          ) : (
            <ul className="space-y-2">
              {reviews.map((r) => (
                <li key={r.id} className={cn(material.regular, "rounded-[16px] px-4 py-3")}>
                  <div className="flex items-center justify-between gap-2">
                    <AddressDisplay
                      address={r.reviewerAddress}
                      className="text-sm text-white"
                      showVerified={false}
                    />
                    <span className="text-sm font-semibold text-amber-300">★ {r.score}</span>
                  </div>
                  {r.comment?.trim() && <p className="mt-1 text-sm text-white/80">{r.comment}</p>}
                  <p className="mt-1 font-mono text-[10px] text-silver">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          ))}

        {tab === "badges" &&
          (isVerified ? (
            <div className={cn(material.regular, "flex items-center gap-3 rounded-[16px] p-4")}>
              <BadgeCheck size={28} className="text-chrome" />
              <div>
                <p className="text-sm font-semibold text-white">KYC verified</p>
                <p className="text-xs text-silver">Identity checked on Hashpop.</p>
              </div>
            </div>
          ) : (
            <EmptyState
              headline={PROFILE_BADGES_EMPTY}
              body={
                isSelf ? "KYC is the only badge in this release." : "No badges on this profile."
              }
            />
          ))}
      </div>
    </main>
  );
}

function EmptyState({ headline, body }: { headline: string; body: string }) {
  return (
    <div className={cn(material.regular, "rounded-[16px] px-5 py-8 text-center")}>
      <p className="text-base font-semibold text-white">{headline}</p>
      <p className="mt-1 text-sm text-silver">{body}</p>
    </div>
  );
}
