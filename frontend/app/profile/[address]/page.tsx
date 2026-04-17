"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Star, Pencil, Camera } from "lucide-react";
import { AddressDisplay } from "../../../components/AddressDisplay";
import { BackToHashpop } from "../../../components/BackToHashpop";
import { getApiUrl } from "../../../lib/apiUrl";
import { formatListingDate } from "../../../lib/formatDate";
import { useHashpackWallet } from "../../../lib/hashpackWallet";
import { invalidateProfileImage } from "../../../lib/profileImageCache";

type Profile = {
  totalSales?: number;
  activeListings?: number;
  ratingAverage?: number;
  ratingCount?: number;
  reputation?: number;
  successful?: number;
  profileImageUrl?: string | null;
};

type Rating = {
  id: string;
  reviewerAddress: string;
  ratedAddress: string;
  score: number;
  comment?: string | null;
  createdAt: string;
};

function StarRow({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${n <= score ? "fill-[#00ffa3] text-[#00ffa3]" : "text-white/20"}`}
        />
      ))}
    </span>
  );
}

export default function ProfilePage() {
  const params = useParams();
  const address = params.address as string;
  const { address: walletAddress } = useHashpackWallet();
  const isOwnProfile = walletAddress?.toLowerCase() === address?.toLowerCase();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [ratingsLoading, setRatingsLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchProfile = () => {
    if (!address) return;
    fetch(`${getApiUrl()}/api/user/${address}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setProfile)
      .catch(() => setProfile(null));
  };

  useEffect(() => {
    fetchProfile();
    setRatingsLoading(true);
    fetch(`${getApiUrl()}/api/ratings/${encodeURIComponent(address.toLowerCase())}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { ratings?: Rating[] } | null) => setRatings(d?.ratings ?? []))
      .catch(() => setRatings([]))
      .finally(() => setRatingsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const avatarUrl = localAvatarUrl ?? profile?.profileImageUrl ?? null;
  const avg = profile?.ratingAverage != null ? Number(profile.ratingAverage) : null;
  const count = profile?.ratingCount ?? 0;
  const avatarLetter = address ? (address[2]?.toUpperCase() ?? "?") : "?";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !walletAddress) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image must be under 5 MB.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("avatar", file);
      form.append("address", walletAddress.toLowerCase());
      const res = await fetch(`${getApiUrl()}/api/upload-avatar`, { method: "POST", body: form });
      let data: { profileImageUrl?: string; error?: string } = {};
      try { data = await res.json(); } catch { /* non-JSON response */ }
      if (!res.ok) { setUploadError(data.error ?? `Upload failed (${res.status})`); return; }
      if (!data.profileImageUrl) { setUploadError("Upload failed — no URL returned."); return; }
      setLocalAvatarUrl(data.profileImageUrl);
      invalidateProfileImage(walletAddress);
      setEditOpen(false);
      fetchProfile();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <main className="min-h-screen slide-in-right">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <BackToHashpop />

        {/* Profile header */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Profile"
                className="h-16 w-16 rounded-full object-cover ring-2 ring-[#00ffa3]/30"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00ffa3] text-2xl font-black text-black select-none">
                {avatarLetter}
              </div>
            )}
            {isOwnProfile && (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/20 border border-white/30 hover:bg-white/30 transition-colors"
                aria-label="Edit profile photo"
              >
                <Camera className="h-3 w-3 text-white" />
              </button>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white truncate">
                <AddressDisplay address={address} />
              </h1>
              {isOwnProfile && (
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-white/20 px-2 py-1 text-xs text-silver hover:text-white hover:border-white/30 transition-colors"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
              )}
            </div>
            {avg != null && count > 0 ? (
              <div className="flex items-center gap-2 mt-0.5">
                <StarRow score={Math.round(avg)} />
                <span className="text-sm text-white font-semibold">{avg.toFixed(1)}</span>
                <span className="text-xs text-silver/60">({count} review{count !== 1 ? "s" : ""})</span>
              </div>
            ) : (
              <p className="text-xs text-silver/60 mt-0.5">No reviews yet</p>
            )}
          </div>
        </div>

        {/* Stats grid */}
        {profile && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Sales", value: profile.totalSales ?? 0 },
              { label: "Listings", value: profile.activeListings ?? 0 },
              { label: "Completed", value: profile.successful ?? 0 },
            ].map(({ label, value }) => (
              <div key={label} className="glass-card rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-silver mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Reviews */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            Reviews{count > 0 && <span className="text-silver/60 font-normal text-sm ml-1">({count})</span>}
          </h2>
          {ratingsLoading ? (
            <p className="text-silver text-sm">Loading reviews…</p>
          ) : ratings.length === 0 ? (
            <div className="glass-card rounded-xl p-6 text-center">
              <p className="text-silver text-sm">No reviews yet for this seller.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ratings.map((r) => (
                <div key={r.id} className="glass-card rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <StarRow score={r.score} />
                    <span className="text-xs text-silver/50 shrink-0">{formatListingDate(r.createdAt)}</span>
                  </div>
                  {r.comment ? (
                    <p className="text-sm text-white/90 leading-relaxed">{r.comment}</p>
                  ) : null}
                  <p className="text-xs text-silver/50">
                    by <AddressDisplay address={r.reviewerAddress} className="font-mono" showAvatar />
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Edit profile photo modal */}
      {editOpen && isOwnProfile && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => { if (!uploading) setEditOpen(false); }}
        >
          <div
            className="glass-card w-full max-w-sm rounded-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white">Update profile photo</h3>
            <p className="text-sm text-silver/70">Choose a JPG, PNG, GIF, or WebP image (max 5 MB).</p>

            <label className="flex items-center justify-center w-full cursor-pointer rounded-xl border-2 border-dashed border-white/20 hover:border-[#00ffa3]/40 bg-white/5 py-8 transition-colors">
              <div className="text-center">
                <Camera className="h-8 w-8 text-white/30 mx-auto mb-2" />
                <p className="text-sm text-silver">{uploading ? "Uploading…" : "Tap to choose photo"}</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                className="sr-only"
                disabled={uploading}
                onChange={handleFileChange}
              />
            </label>

            {uploadError && <p className="text-sm text-rose-400">{uploadError}</p>}

            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="w-full rounded-xl border border-white/20 py-2.5 text-sm text-silver hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
