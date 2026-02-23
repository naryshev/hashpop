"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useHashpackWallet } from "../../lib/hashpackWallet";

export default function SignInPage() {
  const router = useRouter();
  const { connect, isConnected, isConnecting, isReady, error } = useHashpackWallet();

  useEffect(() => {
    if (isConnected) {
      router.replace("/marketplace");
    }
  }, [isConnected, router]);

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex w-full max-w-5xl flex-col px-4 py-8">
        <div className="mb-10 flex items-start justify-between">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            <span className="bg-[linear-gradient(100deg,#ff2f3d_0%,#ff8f00_32%,#13a0ff_62%,#6ddf85_100%)] bg-clip-text text-transparent">
              Hashpop
            </span>
          </Link>
          <span className="text-xs text-silver">Tell us what you think</span>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="glass-card rounded-xl p-6">
            <h1 className="text-center text-2xl font-bold text-white">Sign in to your account</h1>
            <p className="mt-2 text-center text-sm text-silver">
              Connect a wallet to continue.
            </p>

            <button
              type="button"
              onClick={() => void connect()}
              disabled={!isReady || isConnecting}
              className="btn-frost-cta mt-6 w-full disabled:opacity-50"
            >
              {!isReady ? "Loading wallet..." : isConnecting ? "Connecting..." : "Continue with HashPack"}
            </button>

            {error && (
              <p className="mt-3 text-center text-xs text-amber-300">{error}</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
