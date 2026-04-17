"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { AddressDisplay } from "../../../components/AddressDisplay";
import { BackToHashpop } from "../../../components/BackToHashpop";
import { getApiUrl } from "../../../lib/apiUrl";
import { formatListingDate } from "../../../lib/formatDate";

type Profile = {
  totalSales?: number;
  activeListings?: number;
  ratingAverage?: number;
  ratingCount?: number;
  reputation?: number;
  successful?: number;
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [ratingsLoading, setRatingsLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    fetch(`${getApiUrl()}/api/user/${address}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setProfile)
      .catch(() => setProfile(null));

    setRatingsLoading(true);
    fetch(`${getApiUrl()}/api/ratings/${encodeURIComponent(address.toLowerCase())}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { ratings?: Rating[] } | null) => setRatings(d?.ratings ?? []))
      .catch(() => setRatings([]))
      .finally(() => setRatingsLoading(false));
  }, [address]);

  const avg = profile?.ratingAverage != null ? Number(profile.ratingAverage) : null;
  const count = profile?.ratingCount ?? 0;

  return (
    <main className="min-h-screen slide-in-right">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <BackToHashpop />

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#00ffa3] text-2xl font-black text-black select-none">
            {address ? address[2]?.toUpperCase() ?? "?" : "?"}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white truncate">
              <AddressDisplay address={address} />
            </h1>
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
            Reviews {count > 0 && <span className="text-silver/60 font-normal text-sm">({count})</span>}
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
                    <span className="text-xs text-silver/50 shrink-0">
                      {formatListingDate(r.createdAt)}
                    </span>
                  </div>
                  {r.comment ? (
                    <p className="text-sm text-white/90 leading-relaxed">{r.comment}</p>
                  ) : null}
                  <p className="text-xs text-silver/50 font-mono">
                    by <AddressDisplay address={r.reviewerAddress} />
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
