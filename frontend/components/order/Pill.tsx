import { type ReactNode } from "react";
import { Capsule, type CapsuleTone } from "@/components/ui/Capsule";

/** Shim: prefer Capsule + PHASE_LABEL / STATE_LABEL. */
export function Pill({
  children,
  tone = "mint",
}: {
  children: ReactNode;
  tone?: CapsuleTone;
  /** @deprecated Ignored — tones come from the shared capsule map. */
  c?: string;
  fg?: string;
}) {
  return <Capsule tone={tone}>{children}</Capsule>;
}
