"use client";

import { Suspense } from "react";
import { MessagesPageContent } from "../../components/MessagesContent";

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-silver">Loading…</div>
      }
    >
      <MessagesPageContent />
    </Suspense>
  );
}
