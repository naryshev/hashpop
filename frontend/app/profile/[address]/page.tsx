"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AddressDisplay } from "../../../components/AddressDisplay";
import { getApiUrl } from "../../../lib/apiUrl";

export default function ProfilePage() {
  const params = useParams();
  const address = params.address as string;
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetch(`${getApiUrl()}/api/user/${address}`)
      .then((res) => res.json())
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [address]);

  return (
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Profile</h1>
            <p className="text-sm text-silver mt-1">
              <AddressDisplay address={address} />
            </p>
          </div>
          <Link href="/" className="text-sm text-chrome hover:text-white font-medium">
            Home
          </Link>
        </div>

        {profile ? (
          <div className="glass-card p-6 space-y-4 rounded-xl">
            <div>
              <p className="text-sm text-silver">Reputation Score</p>
              <p className="text-3xl font-semibold text-chrome mt-1">
                {profile.reputation || "N/A"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-silver">Average Rating</p>
                <p className="text-xl font-semibold text-white mt-1">
                  {profile.ratingAverage != null ? Number(profile.ratingAverage).toFixed(1) : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-silver">Ratings Count</p>
                <p className="text-xl font-semibold text-white mt-1">{profile.ratingCount || 0}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-silver">Total Sales</p>
                <p className="text-xl font-semibold text-white mt-1">{profile.totalSales || 0}</p>
              </div>
              <div>
                <p className="text-sm text-silver">Successful</p>
                <p className="text-xl font-semibold text-white mt-1">{profile.successful || 0}</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-silver">Loading profile...</p>
        )}
      </div>
    </main>
  );
}
