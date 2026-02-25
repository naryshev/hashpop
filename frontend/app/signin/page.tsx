"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { MorphButton } from "../../components/ui/morph-button";

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
        <div className="mx-auto w-full max-w-md">
          <div className="glass-card rounded-xl p-6">
            <h1 className="text-center text-2xl font-bold text-white">Sign in to your account</h1>
            <p className="mt-2 text-center text-sm text-silver">
              Connect a wallet to continue.
            </p>

            <MorphButton
              onClick={() => void connect()}
              disabled={!isReady || isConnecting}
              className="mt-6 w-full"
              text={!isReady ? "Loading wallet..." : isConnecting ? "Connecting..." : "Continue with HashPack"}
              isLoading={isConnecting}
            />

            {error && (
              <p className="mt-3 text-center text-xs text-amber-300">{error}</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
