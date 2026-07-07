"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ProfileContent } from "../../../components/ProfileContent";

function ProfilePageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const address = params.address as string;
  return <ProfileContent address={address} startInEdit={searchParams.get("edit") === "1"} />;
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-silver">Loading…</div>
      }
    >
      <ProfilePageInner />
    </Suspense>
  );
}
