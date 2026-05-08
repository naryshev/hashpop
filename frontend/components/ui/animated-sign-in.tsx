"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { SignInCard } from "./SignInCard";

export default function AnimatedSignIn() {
  const router = useRouter();
  const { isConnected } = useHashpackWallet();

  useEffect(() => {
    if (!isConnected) return;
    router.replace("/dashboard");
  }, [isConnected, router]);

  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071b38]">
      {/* Ambient glow orbs */}
      <div className="pointer-events-none absolute -top-28 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-100px] left-[-80px] h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-110px] right-[-90px] h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-5 flex items-center justify-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hashpop-cart-3d.PNG"
              alt="Hashpop cart"
              className="h-16 w-auto object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.35)]"
            />
            <span className="bg-[linear-gradient(100deg,#ff2f3d_0%,#ff8f00_32%,#13a0ff_62%,#6ddf85_100%)] bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
              hashpop
            </span>
          </div>

          <SignInCard />

          <p className="mt-4 text-center text-xs text-slate-500">
            Don&apos;t have HashPack?{" "}
            <a
              href="https://www.hashpack.app/download"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 underline underline-offset-2 hover:text-white"
            >
              Get it free
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
