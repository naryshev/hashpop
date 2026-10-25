import Link from "next/link";

/**
 * Terminal states for a listing URL. "loading" is only an in-progress retry;
 * missing and unavailable both leave the spinner.
 */
export function ListingFetchFallback({
  phase,
  onRetry,
}: {
  phase: "loading" | "missing" | "unavailable";
  onRetry?: () => void;
}) {
  if (phase === "loading") {
    return (
      <main className="min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <p className="text-silver">Loading…</p>
        </div>
      </main>
    );
  }

  if (phase === "unavailable") {
    return (
      <main className="min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <h1 className="text-lg text-white">Couldn&apos;t load this listing</h1>
          <p className="mt-2 text-silver">
            The listing service didn&apos;t respond. Try again in a moment.
          </p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-block text-chrome underline hover:text-white"
            >
              Try again
            </button>
          ) : null}
          <Link href="/marketplace" className="mt-2 block text-chrome underline hover:text-white">
            Back to marketplace
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-lg text-white">Listing not found</h1>
        <p className="mt-2 text-silver">This listing doesn&apos;t exist or was removed.</p>
        <Link
          href="/marketplace"
          className="mt-2 inline-block text-chrome underline hover:text-white"
        >
          Back to marketplace
        </Link>
      </div>
    </main>
  );
}
