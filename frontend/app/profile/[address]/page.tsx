"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Mail, User } from "lucide-react";
import { AddressDisplay } from "../../../components/AddressDisplay";
import { getApiUrl } from "../../../lib/apiUrl";
import { useHashpackWallet } from "../../../lib/hashpackWallet";
import { compressImage } from "../../../lib/compressImage";
import { profileAvatarUrl, profileDisplayName, useProfile } from "../../../lib/profiles";

type ProfileStats = {
  address: string;
  totalSales?: number;
  activeListings?: number;
  reputation?: number;
  ratingCount?: number;
  ratingAverage?: number | null;
  successful?: number;
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

export default function ProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const address = params.address as string;
  const addressLower = address?.toLowerCase() ?? "";
  const { address: connectedAddress, accountId } = useHashpackWallet();
  const isSelf = useMemo(() => {
    const me = (connectedAddress ?? accountId ?? "").toLowerCase();
    return !!me && me === addressLower;
  }, [connectedAddress, accountId, addressLower]);

  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileData | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Allow the dashboard's "Edit profile" button to deep-link straight into
  // edit mode via ?edit=1.
  useEffect(() => {
    if (isSelf && searchParams.get("edit") === "1") setEditing(true);
  }, [isSelf, searchParams]);

  useEffect(() => {
    if (!address) return;
    const api = getApiUrl();
    fetch(`${api}/api/user/${address}`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null));
    fetch(`${api}/api/user/${address}/profile`)
      .then((r) => r.json())
      .then((p: ProfileData) => setProfile(p))
      .catch(() => setProfile(null));
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
            legalName: draft.kyc.legalName ?? "",
            dateOfBirth: draft.kyc.dateOfBirth ?? "",
            country: draft.kyc.country ?? "",
            idType: draft.kyc.idType ?? "",
            idNumber: draft.kyc.idNumber ?? "",
            addressLine1: draft.kyc.addressLine1 ?? "",
            addressLine2: draft.kyc.addressLine2 ?? "",
            city: draft.kyc.city ?? "",
            region: draft.kyc.region ?? "",
            postalCode: draft.kyc.postalCode ?? "",
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
      // Silently ignore; user can retry.
    } finally {
      setAvatarUploading(false);
    }
  };

  // Fall back to the user's HashPack wallet username + profile picture when
  // they haven't set their own on Hashpop. Editing always shows the draft so
  // upload + remove preview immediately.
  const publicProfile = useProfile(address ?? null);
  const fallbackAvatar = profileAvatarUrl(publicProfile);
  const fallbackName = profileDisplayName(publicProfile);
  const stagedAvatar = editing ? draft?.avatarUrl?.trim() || null : profile?.avatarUrl?.trim() || null;
  const avatarUrl = stagedAvatar ?? fallbackAvatar;
  const headerName = profile?.displayName?.trim() || fallbackName || "Profile";
  const isVerified = profile?.kyc?.status === "VERIFIED";

  return (
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="h-14 w-14 shrink-0 rounded-full border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-silver/60">
                <User size={26} />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="flex items-center gap-1.5 truncate text-xl sm:text-2xl font-bold text-white">
                {headerName}
                {isVerified && (
                  <BadgeCheck size={20} className="text-[#00ffa3]" aria-label="KYC verified" />
                )}
              </h1>
              <p className="mt-1 text-sm text-silver">
                <AddressDisplay address={address} showVerified={false} />
              </p>
            </div>
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
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[linear-gradient(110deg,#00b37a_0%,#00ffa3_50%,#00e5ff_100%)] px-3.5 py-2 text-xs font-bold text-black shadow-glow"
            >
              <Mail size={14} />
              Message
            </Link>
          )}
        </div>

        {stats ? (
          <div className="glass-card p-6 space-y-4 rounded-xl">
            <div>
              <p className="text-sm text-silver">Reputation Score</p>
              <p className="text-3xl font-semibold text-chrome mt-1">
                {stats.reputation ?? "N/A"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-silver">Average Rating</p>
                <p className="text-xl font-semibold text-white mt-1">
                  {stats.ratingAverage != null ? Number(stats.ratingAverage).toFixed(1) : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-silver">Ratings Count</p>
                <p className="text-xl font-semibold text-white mt-1">{stats.ratingCount ?? 0}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-silver">Total Sales</p>
                <p className="text-xl font-semibold text-white mt-1">{stats.totalSales ?? 0}</p>
              </div>
              <div>
                <p className="text-sm text-silver">Successful</p>
                <p className="text-xl font-semibold text-white mt-1">{stats.successful ?? 0}</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-silver">Loading profile...</p>
        )}

        <div className="glass-card p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">About</h2>
              <p className="text-xs text-silver mt-0.5">Display name and short bio.</p>
            </div>
            {isSelf && editing && (
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
            )}
          </div>

          {!editing ? (
            <>
              <div>
                <p className="text-xs uppercase tracking-wide text-silver">Display name</p>
                <p className="text-white mt-0.5">
                  {profile?.displayName?.trim() ||
                    (publicProfile?.hashpackName?.trim()
                      ? `${publicProfile.hashpackName} (from HashPack)`
                      : "—")}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-silver">Bio</p>
                <p className="text-white mt-0.5 whitespace-pre-wrap">{profile?.bio?.trim() || "—"}</p>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <span className="text-xs uppercase tracking-wide text-silver">Avatar</span>
                <div className="mt-1 flex items-center gap-3">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt=""
                      className="h-14 w-14 rounded-full object-cover border border-white/10"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-silver">
                      ?
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10">
                      {avatarUploading ? "Uploading…" : "Upload"}
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
                </div>
              </div>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-silver">Display name</span>
                <input
                  className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  value={draft?.displayName ?? ""}
                  onChange={(e) => setDraft((d) => (d ? { ...d, displayName: e.target.value } : d))}
                  placeholder={publicProfile?.hashpackName ?? "Your name"}
                  maxLength={80}
                />
                {publicProfile?.hashpackName && (
                  <span className="mt-1 block text-[11px] text-silver/70">
                    Leave blank to use your HashPack username
                    (<span className="text-chrome">{publicProfile.hashpackName}</span>).
                  </span>
                )}
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-silver">Bio</span>
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
        </div>

      </div>
    </main>
  );
}

