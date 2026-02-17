"use client";

import { useState } from "react";
import Link from "next/link";
import { useCreateListing } from "../../hooks/useCreateListing";

export default function CreatePage() {
  const [listingId, setListingId] = useState("");
  const [price, setPrice] = useState("");
  const { create, isPending, isSuccess, error } = useCreateListing();

  return (
    <main className="p-6 space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-white">Create Listing</h1>

      <div className="glass-card p-6 space-y-4">
        <label className="block">
          <span className="text-sm text-silver">Listing ID</span>
          <input
            value={listingId}
            onChange={(e) => setListingId(e.target.value)}
            className="input-frost mt-1 w-full"
            placeholder="LIST-001"
          />
        </label>

        <label className="block">
          <span className="text-sm text-silver">Price (HBAR)</span>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="input-frost mt-1 w-full"
            placeholder="1.5"
          />
        </label>

        <button
          onClick={() => create(listingId, price)}
          disabled={isPending || !listingId || !price}
          className="btn-frost-cta w-full disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? "Confirm in wallet…" : "Create Listing"}
        </button>

        {isSuccess && (
          <p className="text-emerald-400 text-sm">
            Listing submitted. It should appear on the{" "}
            <Link href="/marketplace" className="underline hover:text-white">
              marketplace
            </Link>{" "}
            within a few seconds.
          </p>
        )}
        {error && <p className="text-rose-400 text-sm">{error.message}</p>}
      </div>
    </main>
  );
}
