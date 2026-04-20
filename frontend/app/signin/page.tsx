"use client";

import { Suspense } from "react";
import AnimatedSignIn from "../../components/ui/animated-sign-in";

export default function SignInPage() {
  return (
    <Suspense>
      <AnimatedSignIn />
    </Suspense>
  );
}
