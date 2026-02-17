"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ProfilePage() {
  const params = useParams();
  const address = params.address as string;
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/user/${address}`)
      .then((res) => res.json())
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [address]);

  return (
    <main className="p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-white">Profile</h1>
        <p className="text-sm text-silver mt-1">{address}</p>
      </div>

      {profile ? (
        <div className="glass-card p-6 space-y-4">
          <div>
            <p className="text-sm text-silver">Reputation Score</p>
            <p className="text-3xl font-semibold text-chrome mt-1">{profile.reputation || "N/A"}</p>
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
    </main>
  );
}
