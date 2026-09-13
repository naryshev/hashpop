import Link from "next/link";

/**
 * Branded 404 — replaces Next's default black-and-white page. Kept as a
 * server component so it renders instantly with no client JS.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center">
      <p className="font-mono text-sm tracking-[0.3em] text-[#00ffa3]">404</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-silver">
        The link may be broken, or the listing may have been sold or removed.
      </p>
      <div className="mt-8 flex w-full max-w-xs flex-col gap-2">
        <Link href="/marketplace" className="btn-mint w-full py-3.5 text-sm uppercase tracking-[0.2em]">
          Browse the marketplace
        </Link>
        <Link
          href="/support"
          className="btn-mint-outline w-full py-3 text-center text-sm font-semibold normal-case tracking-normal"
        >
          Get help
        </Link>
      </div>
    </main>
  );
}
